<?php
/**
 * Get Page Data from MySQL
 * Retrieves JSON data (sections + theme) from MySQL by document ID
 */

// Enable error reporting for debugging (disable in production)
error_reporting(E_ALL);
ini_set('display_errors', 0); // Don't display errors, but log them
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/../debug/php_errors.log');

// Load MySQL client
require_once __DIR__ . '/../config/mysql-client.php';

// Enable CORS for cross-origin requests
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Only allow GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit();
}

try {
    // Check if this is a request for templates list
    $type = isset($_GET['type']) ? $_GET['type'] : '';
    
    if ($type === 'templates') {
        // List all templates from the templates directory
        $templatesDir = __DIR__ . '/../templates';
        
        if (!is_dir($templatesDir)) {
            http_response_code(404);
            echo json_encode([
                'success' => false,
                'error' => 'Templates directory not found'
            ]);
            exit();
        }
        
        $templates = [];
        $files = scandir($templatesDir);
        
        foreach ($files as $file) {
            if (pathinfo($file, PATHINFO_EXTENSION) === 'json' && $file !== '.gitkeep') {
                $filePath = $templatesDir . '/' . $file;
                $content = file_get_contents($filePath);
                
                if ($content !== false) {
                    $data = json_decode($content, true);
                    
                    if ($data !== null) {
                        // Get file creation/modification time
                        $createdAt = filemtime($filePath);
                        
                        $templates[] = [
                            'filename' => $file,
                            'data' => $data,
                            'created_at' => $createdAt
                        ];
                    }
                }
            }
        }
        
        // Sort by creation date (most recent first)
        usort($templates, function($a, $b) {
            return $b['created_at'] - $a['created_at'];
        });
        
        echo json_encode([
            'success' => true,
            'templates' => $templates
        ]);
        exit();
    }
    
    // Support persistent share tokens (user_pages.share_token) and share_slug (publish subdomain)
    $mysqlClient = getMySQLClient();
    $shareToken = isset($_GET['token']) ? trim($_GET['token']) : '';
    $shareSlug = isset($_GET['slug']) ? trim($_GET['slug']) : '';

    $document = null;

    if (!empty($shareToken)) {
        $result = $mysqlClient->select('user_pages', '*', [
            'share_token' => $shareToken,
            'is_public' => 1
        ]);
        if (!empty($result)) {
            $document = $result[0];
        }
    } elseif (!empty($shareSlug)) {
        $result = $mysqlClient->select('user_pages', '*', [
            'share_slug' => $shareSlug,
            'is_public' => 1
        ]);
        if (!empty($result)) {
            $document = $result[0];
        }
    }

    if ($document) {
        $data = $document['data'];
        if (is_string($data)) {
            $data = json_decode($data, true);
            if ($data === null) {
                throw new Exception('Invalid data format - failed to decode JSON');
            }
        }

        echo json_encode([
            'id' => $document['id'],
            'data' => $data,
            'created_at' => $document['created_at'] ?? null,
            'share_slug' => $document['share_slug'] ?? null
        ]);
        exit();
    }

    // No valid parameter provided or not found
    if (empty($shareToken) && empty($shareSlug)) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing token or slug parameter']);
    } else {
        http_response_code(404);
        echo json_encode(['error' => 'Shared page not found or no longer public']);
    }
    exit();

} catch (Exception $e) {
    error_log('Error in get.php: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
    http_response_code(500);
    echo json_encode([
        'error' => $e->getMessage()
    ]);
}

