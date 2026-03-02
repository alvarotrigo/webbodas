<?php
/**
 * Database Configuration Example
 * Copy this file to database.php and update with your actual database credentials
 */

// Database configuration
define('DB_HOST', 'nocn.noc-n.com');     // Your database host
define('DB_NAME', 'alvarotrigo_alvarotrigo'); // Your database name
define('DB_USER', 'alvarotrigo_alvarotrigo'); // Your database username
define('DB_PASS', 'baseloco123;'); // Your database password
define('DB_CHARSET', 'utf8mb4');    // Character set

// PDO options
define('PDO_OPTIONS', [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES => false,
    Pdo\Mysql::ATTR_INIT_COMMAND => "SET NAMES " . DB_CHARSET
]);

/**
 * Get database connection
 * @return PDO
 */
function getDatabaseConnection() {
    try {
        $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
        $pdo = new PDO($dsn, DB_USER, DB_PASS, PDO_OPTIONS);
        return $pdo;
    } catch (PDOException $e) {
        error_log("Database connection failed: " . $e->getMessage());
        throw new Exception("Database connection failed");
    }
}

/**
 * Check if user has valid paid subscription
 * @param string $email User's email address
 * @return array Response with status and details
 */
function checkUserPaidStatus($email) {
    try {
        $pdo = getDatabaseConnection();
        
        // Valid products that grant paid access
        $validProducts = [
            'fullpage-professional',
            'fullpage-professional-lifetime',
            'fullpage-business',
            'fullpage-business-lifetime'
        ];
        
        // Create placeholders for the IN clause
        $placeholders = str_repeat('?,', count($validProducts) - 1) . '?';
        
        // Calculate date 12 months ago
        $twelveMonthsAgo = date('Y-m-d H:i:s', strtotime('-12 months'));
        
        // Query to find the most recent valid purchase within 12 months
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
            AND p.created >= ?
            ORDER BY p.created DESC
            LIMIT 1
        ";
        
        // Prepare parameters array
        $params = array_merge([$email], $validProducts, [$twelveMonthsAgo]);
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $result = $stmt->fetch();
        
        if ($result) {
            // Check if it's a lifetime product or within 12 months
            $purchaseDate = new DateTime($result['created']);
            $currentDate = new DateTime();
            $isLifetime = strpos($result['product'], 'lifetime') !== false;
            $isWithin12Months = $purchaseDate->diff($currentDate)->days <= 365;
            
            if ($isLifetime || $isWithin12Months) {
                return [
                    'status' => 'paid',
                    'is_paid' => true,
                    'product' => $result['product'],
                    'purchase_date' => $result['created'],
                    'is_lifetime' => $isLifetime,
                    'expires_in' => $isLifetime ? null : (365 - $purchaseDate->diff($currentDate)->days) . ' days'
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
 * Get user subscription details from database
 * @param string $email User's email address
 * @return array Subscription details
 */
function getUserSubscriptionDetailsFromDB($email) {
    try {
        $pdo = getDatabaseConnection();
        
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