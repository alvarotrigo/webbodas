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
            'id,title,thumbnail_url,is_favorite,is_public,share_token,share_slug,last_accessed,created_at,updated_at',
            [
                'user_id' => $userId,
                'order' => 'last_accessed.desc'
            ]
        );

        // Compute share_url for published pages
        $baseDomain = getenv('SHARE_BASE_DOMAIN') ?: 'yeslovey.com';
        $result = [];
        foreach (($pages ?: []) as $page) {
            if (!empty($page['is_public']) && !empty($page['share_slug'])) {
                $slug = trim((string) $page['share_slug']);
                // Custom domain (e.g. "mi-boda.com"): share_slug already contains the dot
                if (strpos($slug, '.') !== false) {
                    $page['share_url'] = 'https://' . $slug;
                } else {
                    $page['share_url'] = 'https://' . $slug . '.' . $baseDomain;
                }
            } else {
                $page['share_url'] = null;
            }
            $result[] = $page;
        }

        return [
            'success' => true,
            'pages' => $result
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
            'id, share_token, is_public, share_slug',
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
            $token = $page['share_token'];
            // Ensure is_public is set
            if (!$page['is_public']) {
                $supabase->update(
                    'user_pages',
                    ['is_public' => 1],
                    ['id' => $pageId, 'user_id' => $userId]
                );
            }
            // When page is published, return the public URL (subdomain or custom domain) so Share copies the right link
            $shareUrl = buildShareUrlForPage($page);
            if ($shareUrl === null) {
                $shareUrl = buildShareUrlWithToken($token);
            }
            return [
                'success' => true,
                'share_token' => $token,
                'share_url' => $shareUrl
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

        $shareUrl = buildShareUrlWithToken($token);
        return [
            'success' => true,
            'share_token' => $token,
            'share_url' => $shareUrl
        ];
    } catch (Exception $e) {
        error_log("Error sharing page: " . $e->getMessage());
        throw $e;
    }
}

/**
 * Build published URL for a page (subdomain or custom domain). Returns null if page is not published.
 */
function buildShareUrlForPage($page) {
    if (empty($page['is_public']) || empty($page['share_slug'])) {
        return null;
    }
    $slug = trim((string) $page['share_slug']);
    // Custom domain: share_slug is full domain (e.g. mi-boda.com)
    if (strpos($slug, '.') !== false) {
        return 'https://' . $slug;
    }
    $baseDomain = getenv('SHARE_BASE_DOMAIN') ?: 'yeslovey.com';
    return 'https://' . $slug . '.' . $baseDomain;
}

/**
 * Build share URL with token (for Share button - same origin + shared.html?token=...)
 * shared.html lives at project root; when this script runs in api/, use parent as base path.
 */
function buildShareUrlWithToken($token) {
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $scriptDir = dirname($_SERVER['SCRIPT_NAME'] ?? '');
    $basePath = (basename($scriptDir) === 'api') ? dirname($scriptDir) : $scriptDir;
    $basePath = ($basePath === '' || $basePath === '.') ? '/' : (rtrim($basePath, '/') . '/');
    return $protocol . '://' . $host . $basePath . 'shared.html?token=' . $token;
}

/**
 * Publish page with custom subdomain (slug.yeslovey.com). Used by Publish button.
 */
function publishPageWithSubdomain($pageId, $userId, $supabase, $shareSlug) {
    try {
        error_log("publishPageWithSubdomain - START: pageId={$pageId}, userId={$userId}, shareSlug={$shareSlug}");

        // Verify the share_slug column exists (catches missing migration early)
        try {
            $colCheck = $supabase->select('user_pages', 'id, share_slug', ['id' => $pageId]);
            error_log("publishPageWithSubdomain - Column check OK. Current share_slug for page: " . json_encode($colCheck[0]['share_slug'] ?? 'NULL'));
        } catch (Exception $colEx) {
            error_log("publishPageWithSubdomain - COLUMN CHECK FAILED: " . $colEx->getMessage());
            throw new Exception("Migration not applied: the share_slug column is missing. Run: migrations/add_share_slug_to_user_pages.sql — SQL error: " . $colEx->getMessage());
        }

        $pages = $supabase->select(
            'user_pages',
            'id, share_token, is_public',
            [
                'id' => $pageId,
                'user_id' => $userId
            ]
        );

        error_log("publishPageWithSubdomain - Page lookup: " . (empty($pages) ? 'NOT FOUND' : 'found id=' . ($pages[0]['id'] ?? 'N/A')));

        if (empty($pages)) {
            throw new Exception("Page not found or access denied (pageId={$pageId}, userId={$userId})");
        }

        $page = $pages[0];
        $shareSlug = trim($shareSlug);
        $shareSlug = preg_replace('/\s+/', '-', $shareSlug);
        $shareSlug = strtolower($shareSlug);

        if (strlen($shareSlug) < 1 || strlen($shareSlug) > 64) {
            throw new Exception("Website name must be between 1 and 64 characters.");
        }
        if (!preg_match('/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i', $shareSlug)) {
            throw new Exception("Only letters, numbers and hyphens are allowed. Cannot start or end with a hyphen.");
        }

        $existing = $supabase->select('user_pages', 'id', ['share_slug' => $shareSlug]);
        error_log("publishPageWithSubdomain - Uniqueness check for '{$shareSlug}': " . json_encode($existing));
        if (!empty($existing) && ($existing[0]['id'] ?? null) !== $pageId) {
            throw new Exception("The chosen website name is already in use. Please choose another one.");
        }

        $updateData = [
            'share_slug' => $shareSlug,
            'is_public' => 1
        ];

        if (empty($page['share_token'])) {
            $token = sprintf(
                '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
                mt_rand(0, 0xffff), mt_rand(0, 0xffff),
                mt_rand(0, 0xffff),
                mt_rand(0, 0x0fff) | 0x4000,
                mt_rand(0, 0x3fff) | 0x8000,
                mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
            );
            $updateData['share_token'] = $token;
        } else {
            $token = $page['share_token'];
        }

        error_log("publishPageWithSubdomain - Calling UPDATE with data: " . json_encode($updateData) . " WHERE id={$pageId}, user_id={$userId}");

        $updated = $supabase->update('user_pages', $updateData, ['id' => $pageId, 'user_id' => $userId]);

        $savedSlug = $updated[0]['share_slug'] ?? 'N/A';
        error_log("publishPageWithSubdomain - UPDATE done. share_slug now in DB: {$savedSlug}");

        $baseDomain = getenv('SHARE_BASE_DOMAIN') ?: 'yeslovey.com';
        $publishedUrl = 'https://' . $shareSlug . '.' . $baseDomain;

        error_log("publishPageWithSubdomain - SUCCESS: url={$publishedUrl}");

        return [
            'success' => true,
            'share_token' => $token,
            'share_slug' => $shareSlug,
            'share_url' => $publishedUrl
        ];
    } catch (Exception $e) {
        error_log("publishPageWithSubdomain - ERROR: " . $e->getMessage());
        return ['success' => false, 'error' => $e->getMessage()];
    }
}

/**
 * Publish page with a custom domain registered via OpenSRS (Pro users only).
 * Registers the domain, then stores slug + custom_domain + is_public in the DB.
 *
 * @param string $pageId         - Page UUID
 * @param string $userId         - Internal user UUID
 * @param object $supabase       - MySQL client
 * @param string $domain         - Full domain, e.g. "mi-boda.com"
 * @param string $shareSlug      - Slug only (without TLD), e.g. "mi-boda"
 * @param bool   $isPaid         - Whether the current user has a paid plan
 * @param bool   $reactivateOnly - If true, skip OpenSRS registration (domain already registered)
 */
function publishPageWithDomain($pageId, $userId, $supabase, $domain, $shareSlug, $isPaid, $reactivateOnly = false, $contactInput = null) {
    try {
        error_log("publishPageWithDomain - START: pageId={$pageId}, userId={$userId}, domain={$domain}");

        if (!$isPaid) {
            throw new Exception("Domain registration requires a Pro plan.");
        }

        // Validate domain format (basic check before calling OpenSRS)
        if (!preg_match('/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z]{2,})$/i', $domain)) {
            throw new Exception("Invalid domain format: {$domain}");
        }

        // Retrieve the page to confirm ownership
        $pages = $supabase->select(
            'user_pages',
            'id, share_token, is_public, cloudflare_zone_id, dns_status',
            [
                'id'      => $pageId,
                'user_id' => $userId
            ]
        );

        if (empty($pages)) {
            throw new Exception("Page not found or access denied (pageId={$pageId}, userId={$userId})");
        }

        $page = $pages[0];

        // Sanitize slug
        $shareSlug = strtolower(trim($shareSlug));
        $shareSlug = preg_replace('/\s+/', '-', $shareSlug);
        if (strlen($shareSlug) < 1 || strlen($shareSlug) > 63) {
            throw new Exception("Website name must be between 1 and 63 characters.");
        }
        if (!preg_match('/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i', $shareSlug)) {
            throw new Exception("Only letters, numbers and hyphens are allowed. Cannot start or end with a hyphen.");
        }

        if (!$reactivateOnly) {
            // Register domain via OpenSRS
            require_once __DIR__ . '/../includes/OpenSrsClient.php';
            $username = getenv('OPENSRS_USERNAME');
            $testMode = strtolower(getenv('OPENSRS_TEST_MODE') ?: 'true') === 'true';
            $apiKey   = $testMode ? getenv('OPENSRS_API_KEY_TEST') : getenv('OPENSRS_API_KEY');

            if (empty($username) || empty($apiKey)) {
                throw new Exception("OpenSRS credentials are not configured.");
            }

            $opensrs = new OpenSrsClient($username, $apiKey, $testMode);

            // Final availability check before charging
            $lookup = $opensrs->lookupDomain($domain);
            if (($lookup['response_code'] ?? null) != 210) {
                throw new Exception("Domain '{$domain}' is no longer available. Please choose another.");
            }

            // Build contact info: use form data when provided, fall back to .env defaults
            $contact = [
                'first_name'  => ($contactInput['first_name']   ?? '') ?: (getenv('OPENSRS_CONTACT_FIRST')   ?: 'Wedding'),
                'last_name'   => ($contactInput['last_name']    ?? '') ?: (getenv('OPENSRS_CONTACT_LAST')    ?: 'Editor'),
                'org_name'    => ($contactInput['organization'] ?? '') ?: (getenv('OPENSRS_CONTACT_ORG')     ?: 'YesLovey'),
                'address1'    => ($contactInput['address']      ?? '') ?: (getenv('OPENSRS_CONTACT_ADDR')    ?: '123 Wedding Lane'),
                'city'        => getenv('OPENSRS_CONTACT_CITY')    ?: 'Toronto',
                'state'       => getenv('OPENSRS_CONTACT_STATE')   ?: 'ON',
                'postal_code' => getenv('OPENSRS_CONTACT_ZIP')     ?: 'M5V 2H1',
                'country'     => getenv('OPENSRS_CONTACT_COUNTRY') ?: 'CA',
                'phone'       => ($contactInput['phone']        ?? '') ?: (getenv('OPENSRS_CONTACT_PHONE')   ?: '+1.5555551234'),
                'email'       => ($contactInput['email']        ?? '') ?: (getenv('OPENSRS_CONTACT_EMAIL')   ?: 'admin@yeslovey.com'),
            ];

            $regResult = $opensrs->registerDomain($domain, $contact, 1);
            $regCode   = $regResult['response_code'] ?? null;

            if ($regCode != 200) {
                $regText = $regResult['response_text'] ?? "code {$regCode}";
                throw new Exception("Domain registration failed: {$regText}");
            }

            error_log("publishPageWithDomain - OpenSRS registration OK for {$domain}");
        } else {
            error_log("publishPageWithDomain - Reactivation only, skipping OpenSRS for {$domain}");
        }

        // ── Cloudflare DNS automation ────────────────────────────────
        $cloudflareZoneId = null;
        $dnsStatus = 'none';

        // On reactivation, check if zone already exists in DB
        $existingZoneId = $page['cloudflare_zone_id'] ?? null;

        if ($reactivateOnly && !empty($existingZoneId)) {
            // Zone already set up from previous registration
            $cloudflareZoneId = $existingZoneId;
            $dnsStatus = $page['dns_status'] ?? 'pending';
            error_log("publishPageWithDomain - Reactivation: existing Cloudflare zone {$cloudflareZoneId}");
        } else {
            try {
                require_once __DIR__ . '/../includes/CloudflareClient.php';
                $cfToken = getenv('CLOUDFLARE_API_TOKEN');
                $cfAccountId = getenv('CLOUDFLARE_ACCOUNT_ID');

                if (empty($cfToken) || empty($cfAccountId)) {
                    throw new RuntimeException("Cloudflare credentials are not configured.");
                }

                $cloudflare = new CloudflareClient($cfToken, $cfAccountId);

                // 1. Create zone (handle duplicate zone error 1061)
                try {
                    $zone = $cloudflare->createZone($domain);
                } catch (CloudflareApiException $zoneEx) {
                    if ($zoneEx->cloudflareErrorCode === 1061) {
                        // Zone already exists — look it up
                        error_log("publishPageWithDomain - Cloudflare zone already exists for {$domain}, looking up");
                        $existingZones = $cloudflare->listZones($domain);
                        if (!empty($existingZones)) {
                            $zone = $existingZones[0];
                        } else {
                            throw $zoneEx;
                        }
                    } else {
                        throw $zoneEx;
                    }
                }

                $cloudflareZoneId = $zone['id'];
                $nameservers = $zone['name_servers'] ?? [];
                error_log("publishPageWithDomain - Cloudflare zone created: {$cloudflareZoneId}");

                // 2. Add DNS records
                $serverIp = getenv('SERVER_IP');
                if (!empty($serverIp)) {
                    $cloudflare->addDnsRecord($cloudflareZoneId, 'A', $domain, $serverIp, true);
                    $cloudflare->addDnsRecord($cloudflareZoneId, 'CNAME', 'www', $domain, true);
                    error_log("publishPageWithDomain - DNS records added for {$domain}");
                } else {
                    error_log("publishPageWithDomain - SERVER_IP not set, skipping DNS records");
                }

                // 3. Update nameservers on the domain via OpenSRS
                if (!empty($nameservers)) {
                    if (!isset($opensrs)) {
                        require_once __DIR__ . '/../includes/OpenSrsClient.php';
                        $username = getenv('OPENSRS_USERNAME');
                        $testMode = strtolower(getenv('OPENSRS_TEST_MODE') ?: 'true') === 'true';
                        $apiKey   = $testMode ? getenv('OPENSRS_API_KEY_TEST') : getenv('OPENSRS_API_KEY');
                        $opensrs = new OpenSrsClient($username, $apiKey, $testMode);
                    }
                    $opensrs->updateNameservers($domain, $nameservers);
                    error_log("publishPageWithDomain - Nameservers updated to: " . implode(', ', $nameservers));
                }

                $dnsStatus = 'pending';
            } catch (Exception $cfEx) {
                // Cloudflare failed but domain is registered — continue with publish
                error_log("publishPageWithDomain - Cloudflare error (non-fatal): " . $cfEx->getMessage());
                $dnsStatus = 'failed';
            }
        }

        // Ensure share_token exists
        if (empty($page['share_token'])) {
            $token = sprintf(
                '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
                mt_rand(0, 0xffff), mt_rand(0, 0xffff),
                mt_rand(0, 0xffff),
                mt_rand(0, 0x0fff) | 0x4000,
                mt_rand(0, 0x3fff) | 0x8000,
                mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
            );
        } else {
            $token = $page['share_token'];
        }

        // Store the full domain (e.g. "mi-boda.com") as share_slug so the URL can be reconstructed
        // correctly on page reload without appending the base domain again.
        $updateData = [
            'share_slug'    => $domain,
            'is_public'     => 1,
            'share_token'   => $token,
        ];

        // Store the full custom domain + Cloudflare fields if columns exist (graceful fallback)
        $extraFields = ['custom_domain' => $domain];
        if ($cloudflareZoneId) {
            $extraFields['cloudflare_zone_id'] = $cloudflareZoneId;
        }
        if ($dnsStatus !== 'none') {
            $extraFields['dns_status'] = $dnsStatus;
        }

        try {
            $supabase->update('user_pages', array_merge($updateData, $extraFields), ['id' => $pageId, 'user_id' => $userId]);
            error_log("publishPageWithDomain - Saved custom_domain={$domain}, dns_status={$dnsStatus}");
        } catch (Exception $colEx) {
            // Columns may not exist yet; try without extra fields
            error_log("publishPageWithDomain - Extra columns missing, saving without them: " . $colEx->getMessage());
            $supabase->update('user_pages', $updateData, ['id' => $pageId, 'user_id' => $userId]);
        }

        $publishedUrl = 'https://' . $domain;
        error_log("publishPageWithDomain - SUCCESS: url={$publishedUrl}");

        return [
            'success'      => true,
            'share_token'  => $token,
            'share_slug'   => $domain,    // Return full domain so topbar/link shows the real domain
            'share_url'    => $publishedUrl,
            'dns_status'   => $dnsStatus,
        ];
    } catch (Exception $e) {
        error_log("publishPageWithDomain - ERROR: " . $e->getMessage());
        return ['success' => false, 'error' => $e->getMessage()];
    }
}

/**
 * Unpublish a page with different behavior depending on the user plan:
 *
 * - Free users: sets is_public=0 AND clears share_slug=NULL so the subdomain is
 *   released immediately. When the user publishes again they must pick a new name.
 *
 * - Pro users: sets is_public=0 but KEEPS share_slug/custom_domain intact so the
 *   domain can be reactivated later. The public URL will return a 503 response
 *   while the page is unpublished.
 *
 * @param string $pageId  - Page UUID
 * @param string $userId  - Internal user UUID
 * @param object $supabase - MySQL client
 * @param bool   $isPaid  - Whether the current user has a paid plan
 * @return array { success, is_paid, previous_slug }
 */
function unpublishPageAction($pageId, $userId, $supabase, $isPaid) {
    try {
        $pages = $supabase->select('user_pages', 'id, share_slug', [
            'id'      => $pageId,
            'user_id' => $userId
        ]);
        if (empty($pages)) {
            throw new Exception("Page not found.");
        }
        $previousSlug = $pages[0]['share_slug'] ?? null;

        $updateData = [
            'is_public'  => 0,
            'updated_at' => gmdate('Y-m-d H:i:s')
        ];

        if (!$isPaid) {
            // Free users: release the subdomain so they can choose a new one on next publish
            $updateData['share_slug'] = null;
        }
        // Pro users: keep share_slug so the domain can be reactivated later

        $supabase->update('user_pages', $updateData, [
            'id'      => $pageId,
            'user_id' => $userId
        ]);

        return [
            'success'       => true,
            'is_paid'       => (bool) $isPaid,
            'previous_slug' => $isPaid ? $previousSlug : null
        ];
    } catch (Exception $e) {
        error_log("unpublishPageAction - ERROR: " . $e->getMessage());
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

            error_log("Pages API POST - action='" . $action . "', input_keys=" . implode(',', array_keys($input)) . ", raw_snippet=" . substr($rawInput ?? '', 0, 120));
            
            if ($action === 'share') {
                $pageId = $input['id'] ?? null;
                if (!$pageId) {
                    throw new Exception("Page ID required for sharing");
                }
                $response = sharePageToken($pageId, $userId, $supabase);
            } elseif ($action === 'check-subdomain') {
                // Check if a subdomain slug is available (not used by another page in DB).
                $shareSlug = isset($input['share_slug']) ? trim((string) $input['share_slug']) : '';
                $pageId = $input['id'] ?? null;

                if ($shareSlug === '') {
                    echo json_encode(['success' => true, 'available' => false]);
                    exit();
                }

                $shareSlug = preg_replace('/\s+/', '-', $shareSlug);
                $shareSlug = strtolower($shareSlug);

                if (strlen($shareSlug) < 1 || strlen($shareSlug) > 64) {
                    echo json_encode(['success' => true, 'available' => false]);
                    exit();
                }
                if (!preg_match('/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i', $shareSlug)) {
                    echo json_encode(['success' => true, 'available' => false]);
                    exit();
                }

                $existing = $supabase->select('user_pages', 'id', ['share_slug' => $shareSlug]);
                $available = true;
                if (!empty($existing)) {
                    $existingPageId = $existing[0]['id'] ?? null;
                    // Same page keeping its slug is considered available
                    $available = ($pageId !== null && $existingPageId === $pageId);
                }
                $response = ['success' => true, 'available' => $available];
            } elseif ($action === 'publish-subdomain') {
                $pageId = $input['id'] ?? null;
                $shareSlug = isset($input['share_slug']) ? trim((string) $input['share_slug']) : '';
                if (!$pageId || $shareSlug === '') {
                    throw new Exception("Page ID and website name are required for publishing.");
                }
                $response = publishPageWithSubdomain($pageId, $userId, $supabase, $shareSlug);
                if (isset($response['success']) && !$response['success']) {
                    http_response_code(400);
                    echo json_encode($response);
                    exit();
                }
            } elseif ($action === 'publish-domain') {
                // [SIMULATE_FAILURE] Remove this block after testing the error badge in the owner form
                if (false) { // set to false to restore normal behaviour
                    http_response_code(400);
                    echo json_encode([
                        'success' => false,
                        'error'   => 'Domain registration failed. Please check your details and try again.'
                    ]);
                    exit();
                }

                $pageId         = $input['id'] ?? null;
                $domain         = isset($input['domain'])          ? trim((string) $input['domain'])     : '';
                $shareSlug      = isset($input['share_slug'])      ? trim((string) $input['share_slug']) : '';
                $reactivateOnly = !empty($input['reactivate_only']);
                // Contact data provided by the owner form (Step 2a)
                $contactInput   = isset($input['contact']) && is_array($input['contact']) ? $input['contact'] : null;

                // If domain not provided, try to extract from share_slug (reactivation case)
                if ($domain === '' && $shareSlug !== '' && strpos($shareSlug, '.') !== false) {
                    $domain = $shareSlug;
                }

                if (!$pageId || $domain === '') {
                    throw new Exception("Page ID and domain are required for custom domain publishing.");
                }

                // Derive slug (without TLD) from domain if share_slug still contains a dot or is empty
                if ($shareSlug === '' || strpos($shareSlug, '.') !== false) {
                    $dotPos    = strpos($domain, '.');
                    $shareSlug = $dotPos !== false ? substr($domain, 0, $dotPos) : $domain;
                }

                // Check paid status from session
                // Respect session is_paid and pro simulation (?pro=1) from app
$isPaidUser = !empty($_SESSION['is_paid']) || !empty($_SESSION['simulate_pro']);
                $response = publishPageWithDomain($pageId, $userId, $supabase, $domain, $shareSlug, $isPaidUser, $reactivateOnly, $contactInput);
                if (isset($response['success']) && !$response['success']) {
                    http_response_code(400);
                    echo json_encode($response);
                    exit();
                }
            } elseif ($action === 'unpublish') {
                $pageId = $input['id'] ?? null;
                if (!$pageId) {
                    throw new Exception("Page ID required for unpublishing.");
                }
                $isPaidUser = !empty($_SESSION['is_paid']) || !empty($_SESSION['simulate_pro']);
                $response = unpublishPageAction($pageId, $userId, $supabase, $isPaidUser);
            } elseif ($action === 'clone') {
                $pageId = $input['id'] ?? null;
                if (!$pageId) {
                    throw new Exception("Page ID required for cloning");
                }
                $response = clonePage($pageId, $userId, $supabase);
            } else {
                // Free users may only have 1 page; block create when already at limit
                $isPaidUser = !empty($_SESSION['is_paid']) || !empty($_SESSION['simulate_pro']);
                if (!$isPaidUser) {
                    $existing = $supabase->select('user_pages', 'id', ['user_id' => $userId]);
                    $existingCount = is_array($existing) ? count($existing) : 0;
                    if ($existingCount >= 1) {
                        http_response_code(403);
                        echo json_encode([
                            'success' => false,
                            'error' => 'Upgrade to Pro to create more than one webpage. Delete your current page to create a new one.'
                        ]);
                        exit;
                    }
                }
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

