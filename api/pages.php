<?php
/**
 * User Pages Management API
 * Handles CRUD operations for user-owned pages in Supabase
 */

// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/../debug/php_errors.log');

// Configure PHP for large payloads
ini_set('memory_limit', '256M');
ini_set('post_max_size', '50M');
ini_set('upload_max_filesize', '50M');
ini_set('max_execution_time', '60');
ini_set('max_input_time', '60');

// Enable CORS
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Start session to get user info
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Include required files
require_once __DIR__ . '/../config/mysql-client.php';
require_once __DIR__ . '/../includes/clerk-auth.php';

// Initialize MySQL client (replaces Supabase)
$supabase = getMySQLClient(); // Same variable name for compatibility

/**
 * Get user ID from Clerk user ID, create user if doesn't exist
 */
function getUserIdFromClerkId($clerkUserId, $supabase, $userEmail = null, $userName = null) {
    try {
        // Don't use "eq." prefix - the SupabaseClient adds it automatically
        $result = $supabase->select('users', 'id', ['clerk_user_id' => $clerkUserId]);
        
        error_log("getUserIdFromClerkId - Query result: " . json_encode($result));
        
        if (!empty($result) && isset($result[0]['id'])) {
            return $result[0]['id'];
        }
        
        // User doesn't exist - try to create if we have email
        if ($userEmail) {
            error_log("User not found in database, creating: clerk_user_id={$clerkUserId}, email={$userEmail}");
            
            // Create user in database
            createOrUpdateUser($clerkUserId, $userEmail, $userName, false, null, null);
            
            // Try to get the user ID again
            $result = $supabase->select('users', 'id', ['clerk_user_id' => $clerkUserId]);
            if (!empty($result) && isset($result[0]['id'])) {
                return $result[0]['id'];
            }
        }
        
        return null;
    } catch (Exception $e) {
        error_log("Error getting/creating user ID: " . $e->getMessage());
        return null;
    }
}

/**
 * List all pages for a user
 */
function listUserPages($userId, $supabase) {
    try {
        $pages = $supabase->select(
            'user_pages',
            'id,title,thumbnail_url,is_favorite,is_public,last_accessed,created_at,updated_at',
            [
                'user_id' => $userId,
                'order' => 'last_accessed.desc'
            ]
        );
        
        return [
            'success' => true,
            'pages' => $pages ?: []
        ];
    } catch (Exception $e) {
        error_log("Error listing pages: " . $e->getMessage());
        throw new Exception("Failed to retrieve pages");
    }
}

/**
 * Get a single page with full data
 */
function getPage($pageId, $userId, $supabase) {
    try {
        $pages = $supabase->select(
            'user_pages',
            '*',
            [
                'id' => $pageId,
                'user_id' => $userId
            ]
        );
        
        if (empty($pages)) {
            throw new Exception("Page not found or access denied");
        }
        
        return [
            'success' => true,
            'page' => $pages[0]
        ];
    } catch (Exception $e) {
        error_log("Error getting page: " . $e->getMessage());
        throw $e;
    }
}

/**
 * Create a new page
 */
function createPage($userId, $title, $data, $supabase) {
    try {
        // Clean up editor-only attributes from sections before saving
        $cleanedData = cleanSectionInitializationAttributes($data);
        
        // Encode data with UTF-8 substitution to handle any invalid characters
        $encodedData = is_string($cleanedData) ? $cleanedData : json_encode($cleanedData, JSON_INVALID_UTF8_SUBSTITUTE);
        
        // Verify encoding succeeded
        if ($encodedData === false) {
            throw new Exception("Failed to encode page data: " . json_last_error_msg());
        }
        
        $pageData = [
            'user_id' => $userId,
            'title' => $title ?: 'Untitled Page',
            'data' => $encodedData,
            'last_accessed' => gmdate('Y-m-d H:i:s'),
            'created_at' => gmdate('Y-m-d H:i:s'),
            'updated_at' => gmdate('Y-m-d H:i:s')
        ];
        
        $result = $supabase->insert('user_pages', $pageData);
        
        if (empty($result)) {
            throw new Exception("Failed to create page");
        }
        
        return [
            'success' => true,
            'page' => $result[0]
        ];
    } catch (Exception $e) {
        error_log("Error creating page: " . $e->getMessage());
        throw new Exception("Failed to create page: " . $e->getMessage());
    }
}

/**
 * Update a page with request deduplication to prevent race conditions
 */
function updatePage($pageId, $userId, $updates, $supabase) {
    try {
        // Verify ownership and get current updated_at timestamp
        $existing = $supabase->select(
            'user_pages',
            'id, updated_at',
            [
                'id' => $pageId,
                'user_id' => $userId
            ]
        );
        
        if (empty($existing)) {
            throw new Exception("Page not found or access denied");
        }
        
        // Get client timestamp if provided (for request deduplication)
        // This prevents older requests from overwriting newer data
        $clientTimestamp = $updates['_client_timestamp'] ?? null;
        $serverUpdatedAt = $existing[0]['updated_at'] ?? null;
        
        // If client provided timestamp and server version is newer, reject the update
        // This prevents race conditions where an older request overwrites newer data
        if ($clientTimestamp && $serverUpdatedAt) {
            try {
                $clientTime = strtotime($clientTimestamp);
                $serverTime = strtotime($serverUpdatedAt);
                
                // Allow small time difference for clock skew (5 seconds)
                // If server version is significantly newer, reject this update
                if ($serverTime > ($clientTime + 5)) {
                    error_log("Update rejected: Server version is newer. Client: {$clientTimestamp}, Server: {$serverUpdatedAt}, Page ID: {$pageId}");
                    return [
                        'success' => true,
                        'skipped' => true,
                        'message' => 'Update skipped - newer version exists on server',
                        'server_updated_at' => $serverUpdatedAt,
                        'client_timestamp' => $clientTimestamp
                    ];
                }
            } catch (Exception $e) {
                // If timestamp parsing fails, log but continue with update
                error_log("Warning: Failed to parse timestamps for deduplication: " . $e->getMessage());
            }
        }
        
        // Prepare update data (remove internal fields like _client_timestamp)
        $updateData = [];
        
        if (isset($updates['title'])) {
            $updateData['title'] = $updates['title'];
        }
        
        if (isset($updates['data'])) {
            // Clean up editor-only attributes from sections before saving
            $cleanedData = cleanSectionInitializationAttributes($updates['data']);
            
            // Encode data with UTF-8 substitution to handle any invalid characters
            $encodedData = is_string($cleanedData) ? $cleanedData : json_encode($cleanedData, JSON_INVALID_UTF8_SUBSTITUTE);
            
            // Verify encoding succeeded
            if ($encodedData === false) {
                throw new Exception("Failed to encode page data: " . json_last_error_msg());
            }
            
            $updateData['data'] = $encodedData;
        }
        
        if (isset($updates['thumbnail_url'])) {
            $updateData['thumbnail_url'] = $updates['thumbnail_url'];
        }
        
        if (isset($updates['is_favorite'])) {
            // Ensure boolean is always 0 or 1 for MySQL
            $updateData['is_favorite'] = ($updates['is_favorite'] === true || $updates['is_favorite'] === 1 || $updates['is_favorite'] === '1') ? 1 : 0;
        }
        
        if (isset($updates['is_public'])) {
            // Ensure boolean is always 0 or 1 for MySQL
            $updateData['is_public'] = ($updates['is_public'] === true || $updates['is_public'] === 1 || $updates['is_public'] === '1') ? 1 : 0;
        }
        
        // Always update timestamps (use gmdate for UTC)
        $updateData['last_accessed'] = gmdate('Y-m-d H:i:s');
        $updateData['updated_at'] = gmdate('Y-m-d H:i:s');
        
        $result = $supabase->update(
            'user_pages',
            $updateData,
            [
                'id' => $pageId,
                'user_id' => $userId
            ]
        );
        
        return [
            'success' => true,
            'page' => !empty($result) ? $result[0] : null
        ];
    } catch (Exception $e) {
        error_log("Error updating page: " . $e->getMessage());
        throw $e;
    }
}

/**
 * Delete a page
 */
function deletePage($pageId, $userId, $supabase) {
    try {
        // Verify ownership before deleting
        $existing = $supabase->select(
            'user_pages',
            'id',
            [
                'id' => $pageId,
                'user_id' => $userId
            ]
        );
        
        if (empty($existing)) {
            throw new Exception("Page not found or access denied");
        }
        
        $supabase->delete(
            'user_pages',
            [
                'id' => $pageId,
                'user_id' => $userId
            ]
        );
        
        return [
            'success' => true,
            'message' => 'Page deleted successfully'
        ];
    } catch (Exception $e) {
        error_log("Error deleting page: " . $e->getMessage());
        throw $e;
    }
}

/**
 * Clone a page
 */
function clonePage($pageId, $userId, $supabase) {
    try {
        // Get the original page
        $pages = $supabase->select(
            'user_pages',
            '*',
            [
                'id' => $pageId,
                'user_id' => $userId
            ]
        );
        
        if (empty($pages)) {
            throw new Exception("Page not found or access denied");
        }
        
        $original = $pages[0];
        
        // Create a copy
        $cloneData = [
            'user_id' => $userId,
            'title' => $original['title'] . ' (Copy)',
            'data' => $original['data'],
            'thumbnail_url' => $original['thumbnail_url'],
            'is_favorite' => false,
            'is_public' => false,
            'last_accessed' => gmdate('Y-m-d H:i:s'),
            'created_at' => gmdate('Y-m-d H:i:s'),
            'updated_at' => gmdate('Y-m-d H:i:s')
        ];
        
        $result = $supabase->insert('user_pages', $cloneData);
        
        if (empty($result)) {
            throw new Exception("Failed to clone page");
        }
        
        return [
            'success' => true,
            'page' => $result[0]
        ];
    } catch (Exception $e) {
        error_log("Error cloning page: " . $e->getMessage());
        throw $e;
    }
}

/**
 * Get or create a persistent share token for a page
 */
function sharePageToken($pageId, $userId, $supabase) {
    try {
        $pages = $supabase->select(
            'user_pages',
            'id, share_token, is_public',
            [
                'id' => $pageId,
                'user_id' => $userId
            ]
        );

        if (empty($pages)) {
            throw new Exception("Page not found or access denied");
        }

        $page = $pages[0];

        // If already has a share_token, return it
        if (!empty($page['share_token'])) {
            // Ensure is_public is set
            if (!$page['is_public']) {
                $supabase->update(
                    'user_pages',
                    ['is_public' => 1],
                    ['id' => $pageId, 'user_id' => $userId]
                );
            }
            return [
                'success' => true,
                'share_token' => $page['share_token']
            ];
        }

        // Generate a new share_token
        $token = sprintf(
            '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff), mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
        );

        $supabase->update(
            'user_pages',
            [
                'share_token' => $token,
                'is_public' => 1
            ],
            [
                'id' => $pageId,
                'user_id' => $userId
            ]
        );

        return [
            'success' => true,
            'share_token' => $token
        ];
    } catch (Exception $e) {
        error_log("Error sharing page: " . $e->getMessage());
        throw $e;
    }
}

/**
 * Clean up editor-only initialization attributes from section HTML
 * Removes data attributes that are added by JavaScript during initialization
 * @param mixed $data - The page data (can be string, array, or object)
 * @return mixed - The cleaned data in the same format as input
 */
function cleanSectionInitializationAttributes($data) {
    // Si es string, decodificar primero
    $isString = is_string($data);
    if ($isString) {
        $data = json_decode($data, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            return $data;
        }
    }

    // Validar y normalizar fullHtml (nuevo formato: HTML completo del template)
    if (!isset($data['fullHtml']) || !is_string($data['fullHtml'])) {
        $data['fullHtml'] = '';
    }

    // Limpiar atributos de inicialización de runtime del fullHtml
    if (!empty($data['fullHtml'])) {
        $data['fullHtml'] = preg_replace('/\s+data-accordion-initialized="[^"]*"/', '', $data['fullHtml']);
        $data['fullHtml'] = preg_replace('/\s+data-process-accordion-initialized="[^"]*"/', '', $data['fullHtml']);
        $data['fullHtml'] = preg_replace('/\s+data-popular-questions-initialized="[^"]*"/', '', $data['fullHtml']);
        $data['fullHtml'] = preg_replace('/\s+data-pricing-initialized="[^"]*"/', '', $data['fullHtml']);
        $data['fullHtml'] = preg_replace('/\s+data-gallery-initialized="[^"]*"/', '', $data['fullHtml']);
        $data['fullHtml'] = preg_replace('/\s+data-removable-initialized="[^"]*"/', '', $data['fullHtml']);
        $data['fullHtml'] = preg_replace('/\s+data-cloudinary-initialized="[^"]*"/', '', $data['fullHtml']);
        $data['fullHtml'] = preg_replace('/\s+data-video-editor-initialized="[^"]*"/', '', $data['fullHtml']);
        $data['fullHtml'] = preg_replace('/\s+data-interactive-features-initialized="[^"]*"/', '', $data['fullHtml']);
    }

    // Asegurar que el tema sea siempre un string válido
    if (isset($data['theme'])) {
        if (is_array($data['theme'])) {
            $validThemes = array_filter($data['theme'], function($t) {
                return is_string($t) && trim($t) !== '';
            });
            $data['theme'] = !empty($validThemes) ? reset($validThemes) : 'theme-light-minimal';
        } elseif (!is_string($data['theme']) || trim($data['theme']) === '') {
            $data['theme'] = 'theme-light-minimal';
        }
    } else {
        $data['theme'] = 'theme-light-minimal';
    }

    return $isString ? json_encode($data) : $data;
}

// Main request handler
try {
    $method = $_SERVER['REQUEST_METHOD'];
    
    // Read request body once and reuse it throughout the request
    // php://input can only be read once, so we store it here
    $rawInput = file_get_contents('php://input');
    $input = json_decode($rawInput, true) ?: [];
    
    // Log incoming payload size
    $payloadSize = strlen($rawInput);
    error_log("Pages API - Incoming request - Method: {$method}, Payload size: " . number_format($payloadSize) . " bytes (" . round($payloadSize / 1024, 2) . " KB)");
    
    // Get clerk_user_id - prioritize request body over session
    // This makes the API resilient to session issues and Clerk API failures
    $clerkUserId = $input['clerk_user_id'] ?? $_SESSION['clerk_user_id'] ?? null;
    
    // Debug logging
    error_log("Pages API - Method: {$method}");
    error_log("Pages API - clerk_user_id from request: " . ($input['clerk_user_id'] ?? 'null'));
    error_log("Pages API - clerk_user_id from session: " . ($_SESSION['clerk_user_id'] ?? 'null'));
    error_log("Pages API - Using clerk_user_id: " . ($clerkUserId ?: 'null'));
    
    if (!$clerkUserId) {
        error_log("Pages API - ERROR: No clerk_user_id found in session or request");
        throw new Exception("User not authenticated");
    }
    
    error_log("Pages API - Using clerk_user_id: {$clerkUserId}");
    
    // Get user ID from clerk_user_id
    $userId = getUserIdFromClerkId($clerkUserId, $supabase);
    
    error_log("Pages API - User ID from database: " . ($userId ?: 'null'));
    
    if (!$userId) {
        error_log("Pages API - ERROR: User not found in database for clerk_user_id: {$clerkUserId}");
        throw new Exception("User not found in database");
    }
    
    error_log("Pages API - Success! User ID: {$userId}");
    
    // Route based on method and action
    switch ($method) {
        case 'GET':
            // List pages or get single page
            $pageId = $_GET['id'] ?? null;
            
            if ($pageId) {
                $response = getPage($pageId, $userId, $supabase);
            } else {
                $response = listUserPages($userId, $supabase);
            }
            break;
            
        case 'POST':
            // Create new page or clone existing
            $action = $input['action'] ?? 'create';
            
            if ($action === 'share') {
                $pageId = $input['id'] ?? null;
                if (!$pageId) {
                    throw new Exception("Page ID required for sharing");
                }
                $response = sharePageToken($pageId, $userId, $supabase);
            } elseif ($action === 'clone') {
                $pageId = $input['id'] ?? null;
                if (!$pageId) {
                    throw new Exception("Page ID required for cloning");
                }
                $response = clonePage($pageId, $userId, $supabase);
            } else {
                $title = $input['title'] ?? 'Untitled Page';
                $data = $input['data'] ?? [];
                $response = createPage($userId, $title, $data, $supabase);
            }
            break;
            
        case 'PUT':
            // Update page
            $pageId = $input['id'] ?? null;
            
            if (!$pageId) {
                throw new Exception("Page ID is required");
            }
            
            $response = updatePage($pageId, $userId, $input, $supabase);
            break;
            
        case 'DELETE':
            // Delete page
            $pageId = $input['id'] ?? null;
            
            if (!$pageId) {
                throw new Exception("Page ID is required");
            }
            
            $response = deletePage($pageId, $userId, $supabase);
            break;
            
        default:
            throw new Exception("Method not allowed");
    }
    
    echo json_encode($response);
    
} catch (Exception $e) {
    error_log("Pages API error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

