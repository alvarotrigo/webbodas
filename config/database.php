<?php
/**
 * Database Configuration
 * Configure your database connection settings here
 * 
 * For local testing: Set DB_ENV to 'local' and configure local database
 * For remote testing: Set DB_ENV to 'remote' and configure SSH tunnel settings
 * For production: Set DB_ENV to 'production' and configure production database
 */

/**
 * Load environment variables from .env file
 */
require_once __DIR__ . '/env.php';

// ===================================
// LEGACY PURCHASES DATABASE CONFIGURATION
// ===================================
// This is the external database connection for the purchases table
// (separate from the main fpstudio database)
// NOTE: These must be defined AFTER .env file is loaded
define('PURCHASES_DB_HOST', getenv('PURCHASES_DB_HOST') ?: '');
define('PURCHASES_DB_NAME', getenv('PURCHASES_DB_NAME') ?: '');
define('PURCHASES_DB_USER', getenv('PURCHASES_DB_USER') ?: '');
define('PURCHASES_DB_PASS', getenv('PURCHASES_DB_PASS') ?: '');
define('PURCHASES_DB_CHARSET', 'utf8mb4');

function isLocalhost(){
    // Check SERVER_NAME first (most reliable for distinguishing local vs production)
    if (isset($_SERVER['SERVER_NAME'])) {
        $serverName = $_SERVER['SERVER_NAME'];
        // Check if it's a localhost domain
        if (preg_match('/^(localhost|127\.0\.0\.1|::1|.*\.local)(:\d+)?$/i', $serverName)) {
            return true;
        }
        // If it's a real domain (production), return false
        if (preg_match('/\.(com|net|org|io|dev|app)$/i', $serverName)) {
            return false;
        }
    }
    
    // Fallback: check HTTP_HOST
    if (isset($_SERVER['HTTP_HOST'])) {
        $httpHost = $_SERVER['HTTP_HOST'];
        // Remove port if present
        $httpHost = preg_replace('/:\d+$/', '', $httpHost);
        if (preg_match('/^(localhost|127\.0\.0\.1|::1|.*\.local)$/i', $httpHost)) {
            return true;
        }
        // If it's a real domain, return false
        if (preg_match('/\.(com|net|org|io|dev|app)$/i', $httpHost)) {
            return false;
        }
    }
    
    // Last resort: check REMOTE_ADDR (least reliable due to proxies)
    $whitelist = array('127.0.0.1', '::1');
    if (isset($_SERVER['REMOTE_ADDR']) && in_array($_SERVER['REMOTE_ADDR'], $whitelist)) {
        // Could be localhost, but could also be a proxy - default to false for safety
        return false;
    }
    
    // Default to production (false) if we can't determine
    return false;
}

// Environment: 'local', 'remote', or 'production'
// For local testing, use 'local' with a local MySQL database
// For remote testing via SSH tunnel (like TablePlus), use 'remote'
// For production, use 'production'
// Can be set via .env file or environment variable ONLY on localhost
// On production servers, this is ALWAYS forced to 'production' for security
if (isLocalhost()) {
    // On localhost, respect DB_ENV from .env or default to 'local'
    define('DB_ENV', getenv('DB_ENV') ?: 'local');
} else {
    // On production servers, ALWAYS use 'production' regardless of .env
    define('DB_ENV', 'production');
}

// ===================================
// LOCAL DATABASE CONFIGURATION
// ===================================
// Use this for local testing with a local MySQL database
// Values can be set via .env file or environment variables
define('DB_LOCAL_HOST', getenv('DB_LOCAL_HOST') ?: '127.0.0.1');
define('DB_LOCAL_NAME', getenv('DB_LOCAL_NAME') ?: 'fpstudio');
define('DB_LOCAL_USER', getenv('DB_LOCAL_USER') ?: 'root');
define('DB_LOCAL_PASS', getenv('DB_LOCAL_PASS') ?: '');
define('DB_LOCAL_PORT', (int)(getenv('DB_LOCAL_PORT') ?: 3306));

// ===================================
// REMOTE DATABASE CONFIGURATION (via SSH Tunnel)
// ===================================
// Use this for remote testing via SSH tunnel (like TablePlus)
// The SSH tunnel should be set up separately (e.g., via TablePlus or SSH command)
// Then connect to 127.0.0.1 on the tunnel port
// Values can be set via .env file or environment variables
define('DB_REMOTE_HOST', getenv('DB_REMOTE_HOST') ?: '127.0.0.1');
define('DB_REMOTE_NAME', getenv('DB_REMOTE_NAME') ?: 'fpstudio');
define('DB_REMOTE_USER', getenv('DB_REMOTE_USER') ?: 'fpstudio');
define('DB_REMOTE_PASS', getenv('DB_REMOTE_PASS') ?: '');
define('DB_REMOTE_PORT', (int)(getenv('DB_REMOTE_PORT') ?: 3306));

// SSH Tunnel Configuration (for reference - tunnel must be set up separately)
// SSH Server: 95.216.154.45
// SSH Port: 522
// SSH User: dbssh
// Remote MySQL Host: 127.0.0.1 (on remote server)
// Remote MySQL Port: 3306
// 
// To set up SSH tunnel manually:
// ssh -L 3306:127.0.0.1:3306 -p 522 dbssh@95.216.154.45

// ===================================
// PRODUCTION DATABASE CONFIGURATION
// ===================================
// Values can be set via .env file or environment variables
define('DB_PROD_HOST', getenv('DB_PROD_HOST') ?: '127.0.0.1');
define('DB_PROD_NAME', getenv('DB_PROD_NAME') ?: 'fpstudio');
define('DB_PROD_USER', getenv('DB_PROD_USER') ?: 'fpstudio');
define('DB_PROD_PASS', getenv('DB_PROD_PASS') ?: '');
define('DB_PROD_PORT', (int)(getenv('DB_PROD_PORT') ?: 3306));

// ===================================
// COMMON SETTINGS
// ===================================
define('DB_CHARSET', 'utf8mb4');

// PDO options
define('PDO_OPTIONS', [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES => false,
    Pdo\Mysql::ATTR_INIT_COMMAND => "SET NAMES " . DB_CHARSET . ", time_zone = '+00:00'"
]);

/**
 * Get purchases database connection (legacy external database)
 * @return PDO
 */
function getPurchasesDatabaseConnection() {
    // Validate that required constants are set
    if (empty(PURCHASES_DB_HOST) || empty(PURCHASES_DB_NAME) || empty(PURCHASES_DB_USER)) {
        $missing = [];
        if (empty(PURCHASES_DB_HOST)) $missing[] = 'PURCHASES_DB_HOST';
        if (empty(PURCHASES_DB_NAME)) $missing[] = 'PURCHASES_DB_NAME';
        if (empty(PURCHASES_DB_USER)) $missing[] = 'PURCHASES_DB_USER';
        
        $errorMsg = "Purchases database configuration missing. Required environment variables not set: " . implode(', ', $missing);
        error_log($errorMsg);
        throw new Exception($errorMsg);
    }
    
    try {
        $dsn = "mysql:host=" . PURCHASES_DB_HOST . ";dbname=" . PURCHASES_DB_NAME . ";charset=" . PURCHASES_DB_CHARSET;
        $pdo = new PDO($dsn, PURCHASES_DB_USER, PURCHASES_DB_PASS, PDO_OPTIONS);
        return $pdo;
    } catch (PDOException $e) {
        error_log("Purchases database connection failed: " . $e->getMessage());
        error_log("Attempted connection to: host=" . PURCHASES_DB_HOST . ", dbname=" . PURCHASES_DB_NAME . ", user=" . PURCHASES_DB_USER);
        throw new Exception("Purchases database connection failed: " . $e->getMessage());
    }
}

/**
 * Get database connection based on environment
 * @return PDO
 */
function getDatabaseConnection() {
    try {
        
        // Select configuration based on environment
        switch (DB_ENV) {
            case 'local':
                $host = DB_LOCAL_HOST;
                $name = DB_LOCAL_NAME;
                $user = DB_LOCAL_USER;
                $pass = DB_LOCAL_PASS;
                $port = DB_LOCAL_PORT;
                break;
                
            case 'remote':
                $host = DB_REMOTE_HOST;
                $name = DB_REMOTE_NAME;
                $user = DB_REMOTE_USER;
                $pass = DB_REMOTE_PASS;
                $port = DB_REMOTE_PORT;
                break;
                
            case 'production':
                $host = DB_PROD_HOST;
                $name = DB_PROD_NAME;
                $user = DB_PROD_USER;
                $pass = DB_PROD_PASS;
                $port = DB_PROD_PORT;
                break;
                
            default:
                throw new Exception("Invalid DB_ENV: " . DB_ENV);
        }
        
        $dsn = "mysql:host={$host};port={$port};dbname={$name};charset=" . DB_CHARSET;

        $pdo = new PDO($dsn, $user, $pass, PDO_OPTIONS);
        return $pdo;
    } catch (PDOException $e) {
        error_log("Database connection failed (env: " . DB_ENV . "): " . $e->getMessage());
        throw new Exception("Database connection failed: " . $e->getMessage());
    }
}

/**
 * Check if user has valid paid subscription (legacy purchases only)
 *
 * Validity periods by product:
 * - fullpage-professional: 1 month (30 days)
 * - fullpage-business: 12 months (365 days)
 * - fullpage-professional-lifetime: 12 months (365 days)
 * - fullpage-business-lifetime: Forever
 *
 * @param string $email User's email address
 * @return array Response with status and details
 */
function checkUserPaidStatus($email) {
    try {
        // Use the external purchases database connection
        $pdo = getPurchasesDatabaseConnection();

        // Valid products that grant paid access
        $validProducts = [
            'fullpage-professional',
            'fullpage-professional-lifetime',
            'fullpage-business',
            'fullpage-business-lifetime'
        ];

        // Create placeholders for the IN clause
        $placeholders = str_repeat('?,', count($validProducts) - 1) . '?';

        // Query to find the most recent purchase (no time filter - we check validity per product)
        $sql = "
            SELECT
                p.id,
                p.purchase_id,
                p.email,
                p.product,
                p.created,
                p.price,
                p.license_key
            FROM purchases p
            WHERE p.email = ?
            AND p.product IN ($placeholders)
            ORDER BY p.created DESC
            LIMIT 1
        ";

        // Prepare parameters array
        $params = array_merge([$email], $validProducts);

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $result = $stmt->fetch();

        if ($result) {
            $purchaseDate = new DateTime($result['created']);
            $currentDate = new DateTime();
            $daysSincePurchase = $purchaseDate->diff($currentDate)->days;
            $product = $result['product'];

            // Check product type and apply appropriate validity rules
            $isPaid = false;
            $isLifetime = false;
            $expiresIn = null;

            if ($product === 'fullpage-business-lifetime') {
                // Business lifetime: Valid forever
                $isPaid = true;
                $isLifetime = true;
                $expiresIn = null;
            } elseif ($product === 'fullpage-professional-lifetime') {
                // Professional lifetime: Valid for 12 months only
                $isPaid = $daysSincePurchase <= 365;
                $isLifetime = false;
                $expiresIn = $isPaid ? (365 - $daysSincePurchase) . ' days' : null;
            } elseif ($product === 'fullpage-business') {
                // Business non-lifetime: Valid for 12 months
                $isPaid = $daysSincePurchase <= 365;
                $isLifetime = false;
                $expiresIn = $isPaid ? (365 - $daysSincePurchase) . ' days' : null;
            } elseif ($product === 'fullpage-professional') {
                // Professional non-lifetime: Valid for 1 month only
                $isPaid = $daysSincePurchase <= 30;
                $isLifetime = false;
                $expiresIn = $isPaid ? (30 - $daysSincePurchase) . ' days' : null;
            }

            if ($isPaid) {
                return [
                    'status' => 'paid',
                    'is_paid' => true,
                    'source' => 'legacy',
                    'product' => $result['product'],
                    'purchase_date' => $result['created'],
                    'is_lifetime' => $isLifetime,
                    'expires_in' => $expiresIn
                ];
            }
        }

        return [
            'status' => 'free',
            'is_paid' => false,
            'message' => 'No valid paid subscription found'
        ];

    } catch (Exception $e) {
        error_log("Error checking user paid status: " . $e->getMessage());
        return [
            'status' => 'error',
            'is_paid' => false,
            'message' => 'Error checking subscription status'
        ];
    }
}

/**
 * Check if user has valid paid subscription from ANY source (legacy, Polar, or LemonSqueezy)
 * @param string $email User's email address
 * @return array Response with status and details
 */
function checkUserPaidStatusAllSources($email) {
    // Check legacy purchases first
    $legacyStatus = checkUserPaidStatus($email);
    
    if ($legacyStatus['is_paid']) {
        return $legacyStatus;
    }
    
    // Check Polar.sh subscriptions (primary payment provider)
    if (file_exists(__DIR__ . '/polar.php')) {
        require_once __DIR__ . '/polar.php';
        $polarStatus = checkPolarSubscription($email);
        
        if ($polarStatus['is_paid']) {
            return $polarStatus;
        }
    }
    
    // Fallback: check LemonSqueezy (kept for backward compatibility)
    // Only check if lemonsqueezy.php is available
    if (file_exists(__DIR__ . '/lemonsqueezy.php')) {
        require_once __DIR__ . '/lemonsqueezy.php';
        $lemonSqueezyStatus = checkLemonSqueezySubscription($email);
        
        if ($lemonSqueezyStatus['is_paid']) {
            return $lemonSqueezyStatus;
        }
    }
    
    // No paid subscription from any source
    return [
        'status' => 'free',
        'is_paid' => false,
        'message' => 'No valid paid subscription found'
    ];
}

/**
 * Get user subscription details from database
 * @param string $email User's email address
 * @return array Subscription details
 */
function getUserSubscriptionDetailsFromDB($email) {
    try {
        // Use the external purchases database connection
        $pdo = getPurchasesDatabaseConnection();
        
        $sql = "
            SELECT 
                p.id,
                p.purchase_id,
                p.email,
                p.product,
                p.created,
                p.price,
                p.license_key,
                p.country
            FROM purchases p
            WHERE p.email = ?
            ORDER BY p.created DESC
        ";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$email]);
        $purchases = $stmt->fetchAll();
        
        return [
            'status' => 'success',
            'purchases' => $purchases
        ];
        
    } catch (Exception $e) {
        error_log("Error getting user subscription details: " . $e->getMessage());
        return [
            'status' => 'error',
            'message' => 'Error retrieving subscription details'
        ];
    }
}
?> 