<?php
/**
 * Polar.sh Configuration
 * Configure your Polar.sh payment settings here
 */

// Load .env file
loadPolarEnv();

// Test Mode Configuration
// Set to true to use test/sandbox environment
$polarTestModeEnv = getenv('POLAR_TEST_MODE');
if ($polarTestModeEnv !== false) {
    define('POLAR_TEST_MODE', strtolower($polarTestModeEnv) === 'true' || $polarTestModeEnv === '1');
} else {
    // Default to false (production mode)
    define('POLAR_TEST_MODE', false);
}

// Polar API Configuration - Read from .env file
// Use sandbox credentials if in test mode, otherwise use production
if (POLAR_TEST_MODE) {
    define('POLAR_ACCESS_TOKEN', polar_env('POLAR_ACCESS_TOKEN_SANDBOX', ''));
    define('POLAR_WEBHOOK_SECRET', polar_env('POLAR_WEBHOOK_SECRET_SANDBOX', ''));
    define('POLAR_API_URL', 'https://sandbox-api.polar.sh/v1');
} else {
    define('POLAR_ACCESS_TOKEN', polar_env('POLAR_ACCESS_TOKEN', ''));
    define('POLAR_WEBHOOK_SECRET', polar_env('POLAR_WEBHOOK_SECRET', ''));
    define('POLAR_API_URL', 'https://api.polar.sh/v1');
}

// Polar Checkout Links (direct payment links)
// Use sandbox checkout links if in test mode
if (POLAR_TEST_MODE) {
    define('POLAR_CHECKOUT_ANNUAL', polar_env('POLAR_CHECKOUT_ANNUAL_SANDBOX', ''));
    define('POLAR_CHECKOUT_LIFETIME', polar_env('POLAR_CHECKOUT_LIFETIME_SANDBOX', ''));
} else {
    define('POLAR_CHECKOUT_ANNUAL', polar_env('POLAR_CHECKOUT_ANNUAL', 'https://buy.polar.sh/polar_cl_vGfXimmFJMnYqTQWN7Vu3PEhqpyHoLZFdZCXJ4geYUn'));
    define('POLAR_CHECKOUT_LIFETIME', polar_env('POLAR_CHECKOUT_LIFETIME', 'https://buy.polar.sh/polar_cl_jvXG4n0BcuDSybmQSnMqKKmqZTYgsntIEGHh12CaUM7'));
}

/**
 * Helper function to get env variable with fallback
 */
function polar_env($key, $default = '') {
    $value = getenv($key);
    return $value !== false ? $value : $default;
}

/**
 * Load environment variables from .env file
 */
function loadPolarEnv() {
    static $loaded = false;
    
    if ($loaded) {
        return;
    }
    
    $envPath = dirname(__DIR__) . '/.env';
    
    if (!file_exists($envPath)) {
        $loaded = true;
        return;
    }
    
    $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    
    if ($lines === false) {
        $loaded = true;
        return;
    }
    
    foreach ($lines as $line) {
        $line = trim($line);
        
        // Skip empty lines and comments
        if ($line === '' || strpos($line, '#') === 0) {
            continue;
        }
        
        // Parse KEY=VALUE format
        $parts = explode('=', $line, 2);
        if (count($parts) === 2) {
            $key = trim($parts[0]);
            $value = trim($parts[1]);
            
            // Remove quotes if present
            if ((substr($value, 0, 1) === '"' && substr($value, -1) === '"') ||
                (substr($value, 0, 1) === "'" && substr($value, -1) === "'")) {
                $value = substr($value, 1, -1);
            }
            
            // Only set if not already in environment
            if (getenv($key) === false) {
                putenv("{$key}={$value}");
            }
        }
    }
    
    $loaded = true;
}

/**
 * Get Polar access token
 * @return string The access token
 */
function getPolarAccessToken() {
    return POLAR_ACCESS_TOKEN;
}

/**
 * Check if Polar is in test mode
 * @return bool True if in test mode
 */
function isPolarTestMode() {
    return defined('POLAR_TEST_MODE') && POLAR_TEST_MODE;
}

/**
 * Get Polar checkout URL for a specific plan
 * @param string $plan Plan type ('annual' or 'lifetime')
 * @return string Checkout URL
 */
function getPolarCheckoutUrl($plan) {
    switch (strtolower($plan)) {
        case 'annual':
            return POLAR_CHECKOUT_ANNUAL;
        case 'lifetime':
            return POLAR_CHECKOUT_LIFETIME;
        default:
            return POLAR_CHECKOUT_ANNUAL;
    }
}

/**
 * Make authenticated request to Polar API
 * @param string $method HTTP method (GET, POST, etc.)
 * @param string $endpoint API endpoint (without base URL)
 * @param array|null $data Request body data
 * @return array Response data
 */
function polarApiRequest($method, $endpoint, $data = null) {
    $url = POLAR_API_URL . $endpoint;
    $accessToken = getPolarAccessToken();
    
    if (empty($accessToken)) {
        throw new Exception('Polar access token not configured');
    }
    
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Accept: application/json',
        'Content-Type: application/json',
        'Authorization: Bearer ' . $accessToken
    ]);
    
    if ($data && in_array($method, ['POST', 'PATCH', 'PUT'])) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    }
    
    // Configure timeouts
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    
    curl_close($ch);
    
    if ($error) {
        throw new Exception("Polar API request failed: {$error}");
    }
    
    $result = json_decode($response, true);
    
    if ($httpCode >= 400) {
        $errorMessage = $result['detail'] ?? $result['message'] ?? "HTTP {$httpCode}";
        throw new Exception("Polar API error: {$errorMessage}");
    }
    
    return $result;
}

/**
 * Get checkout session details from Polar
 * @param string $checkoutId Checkout session ID
 * @return array Checkout data
 */
function getPolarCheckout($checkoutId) {
    return polarApiRequest('GET', '/checkouts/custom/' . $checkoutId);
}

/**
 * Verify Polar webhook signature
 * @param string $payload Raw request body
 * @param string $signature Signature from X-Polar-Signature header
 * @return bool True if signature is valid
 */
function verifyPolarWebhookSignature($payload, $signature) {
    if (empty(POLAR_WEBHOOK_SECRET)) {
        // If no secret configured, skip verification (not recommended for production)
        return true;
    }
    
    $expectedSignature = hash_hmac('sha256', $payload, POLAR_WEBHOOK_SECRET);
    return hash_equals($expectedSignature, $signature);
}

/**
 * Check if user has active Polar subscription
 * @param string $email User's email address
 * @return array Status information
 */
function checkPolarSubscription($email) {
    try {
        // Include MySQL client
        require_once __DIR__ . '/mysql-client.php';
        $db = getMySQLClient();
        
        // Query users table for Polar subscription
        $users = $db->select(
            'users',
            '*',
            [
                'email' => $email,
                'pro_status_source' => 'polar'
            ]
        );
        
        if (!empty($users) && $users[0]['is_pro']) {
            return [
                'status' => 'paid',
                'is_paid' => true,
                'source' => 'polar',
                'subscription_id' => $users[0]['subscription_id'] ?? null
            ];
        }
        
        return [
            'status' => 'free',
            'is_paid' => false,
            'message' => 'No active Polar subscription found'
        ];
        
    } catch (Exception $e) {
        error_log("Error checking Polar subscription: " . $e->getMessage());
        return [
            'status' => 'error',
            'is_paid' => false,
            'message' => 'Error checking subscription status'
        ];
    }
}

/**
 * Determine if user should be considered pro based on Polar subscription status
 * @param string $status Subscription status from Polar
 * @return bool True if user should be considered pro
 */
function shouldPolarUserBePro($status) {
    // Active subscription statuses that grant pro access
    $proStatuses = [
        'active',
        'trialing',
        'incomplete' // Still attempting payment
    ];
    
    return in_array(strtolower($status), $proStatuses);
}

/**
 * Update user's pro status from Polar subscription
 * @param string $email User email
 * @param bool $isPro Whether user should be pro
 * @param string|null $subscriptionId Polar subscription ID
 * @param string|null $clerkUserId Clerk user ID if available
 */
function updatePolarUserProStatus($email, $isPro, $subscriptionId = null, $clerkUserId = null) {
    try {
        // Include MySQL client
        require_once __DIR__ . '/mysql-client.php';
        $db = getMySQLClient();
        
        // Try to find user by clerk_user_id first, then by email
        $user = null;
        
        if (!empty($clerkUserId)) {
            $users = $db->select('users', '*', ['clerk_user_id' => $clerkUserId]);
            if (!empty($users)) {
                $user = $users[0];
            }
        }
        
        if (!$user && !empty($email)) {
            $users = $db->select('users', '*', ['email' => strtolower(trim($email))]);
            if (!empty($users)) {
                $user = $users[0];
            }
        }
        
        if (!$user) {
            error_log("Polar: User not found for email: {$email}, clerk_user_id: {$clerkUserId}");
            return false;
        }
        
        // Update user pro status
        // Ensure is_pro is always 0 or 1 for MySQL (never null/empty string)
        $isProInt = ($isPro === true || $isPro === 1 || $isPro === '1') ? 1 : 0;
        
        $updateData = [
            'is_pro' => $isProInt,
            'pro_status_source' => $isProInt ? 'polar' : null,
            'subscription_id' => $subscriptionId,
            'updated_at' => gmdate('Y-m-d H:i:s')
        ];
        
        $db->update('users', $updateData, ['id' => $user['id']]);
        
        error_log("Polar: Updated user {$user['id']} pro status to " . ($isPro ? 'true' : 'false'));
        return true;
        
    } catch (Exception $e) {
        error_log("Error updating Polar user pro status: " . $e->getMessage());
        return false;
    }
}
?>

