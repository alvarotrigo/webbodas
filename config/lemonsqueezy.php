<?php
/**
 * LemonSqueezy Configuration
 * Configure your LemonSqueezy API settings here
 */


// Load .env file
loadLemonSqueezyEnv();

// LemonSqueezy API Configuration - Read from .env file
define('LEMONSQUEEZY_TEST_API_KEY', lemonsqueezy_env('LEMONSQUEEZY_TEST_API_KEY', ''));
define('LEMONSQUEEZY_API_KEY', lemonsqueezy_env('LEMONSQUEEZY_API_KEY', ''));

// Store ID (same for both test and production)
define('LEMONSQUEEZY_STORE_ID', lemonsqueezy_env('LEMONSQUEEZY_STORE_ID', '22532'));

// Production Product ID
define('LEMONSQUEEZY_PRODUCT_ID', lemonsqueezy_env('LEMONSQUEEZY_PRODUCT_ID', '610751'));
define('LEMONSQUEEZY_TEST_PRODUCT_ID', lemonsqueezy_env('LEMONSQUEEZY_TEST_PRODUCT_ID', '684505')); // Test product ID

// Production Variant ID
define('LEMONSQUEEZY_VARIANT_ID', lemonsqueezy_env('LEMONSQUEEZY_VARIANT_ID', '1076515')); // Update this if your production product has a different variant ID
define('LEMONSQUEEZY_TEST_VARIANT_ID', lemonsqueezy_env('LEMONSQUEEZY_TEST_VARIANT_ID', '1076515')); // Test variant ID - update if different from production

// Webhook secret - Read from .env file
define('LEMONSQUEEZY_WEBHOOK_SECRET', lemonsqueezy_env('LEMONSQUEEZY_WEBHOOK_SECRET', ''));
define('LEMONSQUEEZY_SUPABASE_SERVICE_ROLE_KEY', lemonsqueezy_env('LEMONSQUEEZY_SUPABASE_SERVICE_ROLE_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrdnVtaXlzZHZqeXV1dmhxdm5jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTkyMDU3MCwiZXhwIjoyMDc3NDk2NTcwfQ.U0uHsgnkNEIje5THcaI1iaCVwNGtyOhZqgjc87JcTvs'));


// Test Mode Configuration
// Set to true to use test API key and test store/product/variant IDs
// Can be overridden by LEMONSQUEEZY_TEST_MODE environment variable
$testModeEnv = getenv('LEMONSQUEEZY_TEST_MODE');
if ($testModeEnv !== false) {
    define('LEMONSQUEEZY_TEST_MODE', strtolower($testModeEnv) === 'true' || $testModeEnv === '1');
} else {
    // Default to false (production mode)
    // Change this to true to enable test mode by default
    define('LEMONSQUEEZY_TEST_MODE', true);
}


// Helper function to get env variable with fallback
function lemonsqueezy_env($key, $default = '') {
    $value = getenv($key);
    return $value !== false ? $value : $default;
}


/**
 * Load environment variables from .env file
 */
function loadLemonSqueezyEnv() {
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
 * Get the appropriate LemonSqueezy API key based on test mode
 * @return string The API key to use
 */
function getLemonSqueezyApiKey() {
    if (defined('LEMONSQUEEZY_TEST_MODE') && LEMONSQUEEZY_TEST_MODE) {
        return LEMONSQUEEZY_TEST_API_KEY;
    }
    return LEMONSQUEEZY_API_KEY;
}

/**
 * Get the appropriate LemonSqueezy Store ID based on test mode
 * @return string The Store ID to use
 */
function getLemonSqueezyStoreId() {
    // Store ID is the same for both test and production
    return LEMONSQUEEZY_STORE_ID;
}

/**
 * Get the appropriate LemonSqueezy Product ID based on test mode
 * @return string The Product ID to use
 */
function getLemonSqueezyProductId() {
    if (defined('LEMONSQUEEZY_TEST_MODE') && LEMONSQUEEZY_TEST_MODE) {
        if (!empty(LEMONSQUEEZY_TEST_PRODUCT_ID)) {
            return LEMONSQUEEZY_TEST_PRODUCT_ID;
        }
    }
    return LEMONSQUEEZY_PRODUCT_ID;
}

/**
 * Get the appropriate LemonSqueezy Variant ID based on test mode
 * @return string The Variant ID to use
 */
function getLemonSqueezyVariantId() {
    if (defined('LEMONSQUEEZY_TEST_MODE') && LEMONSQUEEZY_TEST_MODE) {
        if (!empty(LEMONSQUEEZY_TEST_VARIANT_ID)) {
            return LEMONSQUEEZY_TEST_VARIANT_ID;
        }
    }
    return LEMONSQUEEZY_VARIANT_ID;
}

/**
 * Check if currently in test mode
 * @return bool True if in test mode, false otherwise
 */
function isLemonSqueezyTestMode() {
    return defined('LEMONSQUEEZY_TEST_MODE') && LEMONSQUEEZY_TEST_MODE;
}

// Supabase Configuration
define('SUPABASE_URL', 'https://bkvumiysdvjyuuvhqvnc.supabase.co');
define('SUPABASE_SERVICE_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrdnVtaXlzZHZqeXV1dmhxdm5jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5MjA1NzAsImV4cCI6MjA3NzQ5NjU3MH0.7WMMwi7eFf8uNxwSIzUh30o7GU6x4R2dyoCKSjX4YF0');

/**
 * Supabase helper class for database operations
 */
class SupabaseClient {
    private $url;
    private $apiKey;
    
    public function __construct($url, $apiKey) {
        $this->url = rtrim($url, '/');
        $this->apiKey = $apiKey;
    }
    
    /**
     * Insert data into a table
     */
    public function insert($table, $data) {
        return $this->request('POST', "/rest/v1/{$table}", $data, [
            'Prefer' => 'return=representation'
        ]);
    }
    
    /**
     * Update data in a table
     */
    public function update($table, $data, $where) {
        $queryString = $this->buildQueryString($where);
        return $this->request('PATCH', "/rest/v1/{$table}?{$queryString}", $data, [
            'Prefer' => 'return=representation'
        ]);
    }
    
    /**
     * Select data from a table
     */
    public function select($table, $columns = '*', $where = []) {
        $queryString = $this->buildQueryString($where);
        $encodedColumns = rawurlencode($columns);
        $endpoint = "/rest/v1/{$table}?select={$encodedColumns}";
        if ($queryString) {
            $endpoint .= "&{$queryString}";
        }
        return $this->request('GET', $endpoint);
    }
    
    /**
     * Delete data from a table
     */
    public function delete($table, $where) {
        $queryString = $this->buildQueryString($where);
        return $this->request('DELETE', "/rest/v1/{$table}?{$queryString}");
    }
    
    /**
     * Build query string from where conditions
     */
    private function buildQueryString($where) {
        $parts = [];
        foreach ($where as $key => $value) {
            // Handle special query parameters that don't need eq. prefix
            if ($key === 'order' || $key === 'limit' || $key === 'offset') {
                $parts[] = "{$key}={$value}";
            } else {
                $parts[] = $this->buildCondition($key, $value);
            }
        }
        return implode('&', $parts);
    }

    /**
     * Build encoded condition string for a single where clause.
     */
    private function buildCondition($column, $value) {
        if (is_array($value)) {
            // Handle operators like ['gt', 100] or ['in', [1,2,3]]
            $operator = $value[0] ?? 'eq';
            $rawVal = $value[1] ?? null;

            if (is_array($rawVal)) {
                $encodedItems = array_map(
                    static function ($item) {
                        return rawurlencode((string) $item);
                    },
                    $rawVal
                );
                $encodedValue = '(' . implode(',', $encodedItems) . ')';
            } else {
                $encodedValue = rawurlencode((string) $rawVal);
            }

            return "{$column}={$operator}.{$encodedValue}";
        }

        // Simple equality match
        $encodedValue = rawurlencode((string) $value);
        return "{$column}=eq.{$encodedValue}";
    }
    
    /**
     * Make HTTP request to Supabase with automatic retry for transient failures
     */
    private function request($method, $endpoint, $data = null, $extraHeaders = [], $attempt = 1) {
        $maxAttempts = 3;
        $retryDelay = 500000; // 0.5 seconds in microseconds
        
        $url = $this->url . $endpoint;
        
        $headers = array_merge([
            'apikey' => $this->apiKey,
            'Authorization' => 'Bearer ' . $this->apiKey,
            'Content-Type' => 'application/json'
        ], $extraHeaders);
        
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
        
        // Configure timeouts for large payloads
        curl_setopt($ch, CURLOPT_TIMEOUT, 60); // Total timeout: 60 seconds
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10); // Connection timeout: 10 seconds
        
        // SSL/TLS configuration for better compatibility
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
        
        // Handle large payloads better
        curl_setopt($ch, CURLOPT_BUFFERSIZE, 65536); // 64KB buffer
        curl_setopt($ch, CURLOPT_TCP_NODELAY, true); // Disable Nagle's algorithm for faster small packet transmission
        
        // Set headers
        $headerArray = [];
        foreach ($headers as $key => $value) {
            $headerArray[] = "{$key}: {$value}";
        }
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headerArray);
        
        // Set request body for POST/PATCH
        if ($data && in_array($method, ['POST', 'PATCH', 'PUT'])) {
            $jsonData = json_encode($data);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $jsonData);
            
            // Log payload size for debugging (only on first attempt)
            if ($attempt === 1) {
                $payloadSize = strlen($jsonData);
                error_log("Supabase request - Method: {$method}, Endpoint: {$endpoint}, Payload size: " . number_format($payloadSize) . " bytes");
            }
        }
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        $errorNo = curl_errno($ch);
        
        curl_close($ch);
        
        // Check for transient network errors that should be retried
        $transientErrors = [
            56, // CURLE_RECV_ERROR - Failure receiving data (like "Connection reset by peer")
            55, // CURLE_SEND_ERROR - Failure sending data
            28, // CURLE_OPERATION_TIMEDOUT - Operation timeout
            7,  // CURLE_COULDNT_CONNECT - Failed to connect
            35, // CURLE_SSL_CONNECT_ERROR - SSL connection error
        ];
        
        if ($error && in_array($errorNo, $transientErrors) && $attempt < $maxAttempts) {
            error_log("Supabase transient error (attempt {$attempt}/{$maxAttempts}) - Code: {$errorNo}, Message: {$error}. Retrying...");
            usleep($retryDelay * $attempt); // Exponential backoff
            return $this->request($method, $endpoint, $data, $extraHeaders, $attempt + 1);
        }
        
        if ($error) {
            // Provide more detailed error information
            error_log("Supabase cURL error - Code: {$errorNo}, Message: {$error}, HTTP Code: {$httpCode}, Attempts: {$attempt}");
            throw new Exception("Supabase request failed after {$attempt} attempts: {$error}");
        }
        
        if ($httpCode >= 400) {
            error_log("Supabase HTTP error - Code: {$httpCode}, Response: {$response}");
            throw new Exception("Supabase error ({$httpCode}): {$response}");
        }
        
        if ($attempt > 1) {
            error_log("Supabase request succeeded after {$attempt} attempts");
        }
        
        return json_decode($response, true);
    }
}

/**
 * Get MySQL client instance (replaces Supabase)
 * This function maintains backward compatibility with existing code
 */
function getSupabaseClient() {
    // Include MySQL client if not already included
    if (!function_exists('getMySQLClient')) {
        require_once __DIR__ . '/mysql-client.php';
    }
    return getMySQLClient();
}

/**
 * Check if user has active LemonSqueezy subscription
 */
function checkLemonSqueezySubscription($email) {
    try {
        $supabase = getSupabaseClient();
        
        // Query for active subscriptions
        $subscriptions = $supabase->select(
            'subscriptions',
            '*',
            [
                'customer_email' => $email,
                'status' => 'active'
            ]
        );
        
        if (!empty($subscriptions)) {
            $subscription = $subscriptions[0];
            
            // Check if subscription is still valid
            $endsAt = isset($subscription['ends_at']) ? strtotime($subscription['ends_at']) : null;
            $isActive = $subscription['status'] === 'active' && 
                       (!$endsAt || $endsAt > time());
            
            if ($isActive) {
                return [
                    'status' => 'paid',
                    'is_paid' => true,
                    'source' => 'lemonsqueezy',
                    'subscription_id' => $subscription['subscription_id'],
                    'product_name' => $subscription['product_name'],
                    'variant_name' => $subscription['variant_name'],
                    'status_label' => $subscription['status'],
                    'renews_at' => $subscription['renews_at'],
                    'ends_at' => $subscription['ends_at'],
                    'created_at' => $subscription['created_at']
                ];
            }
        }
        
        return [
            'status' => 'free',
            'is_paid' => false,
            'message' => 'No active LemonSqueezy subscription found'
        ];
        
    } catch (Exception $e) {
        error_log("Error checking LemonSqueezy subscription: " . $e->getMessage());
        return [
            'status' => 'error',
            'is_paid' => false,
            'message' => 'Error checking subscription status'
        ];
    }
}

/**
 * Save or update LemonSqueezy subscription in Supabase
 */
function saveLemonSqueezySubscription($data) {
    try {
        $supabase = getSupabaseClient();
        
        // Check if subscription already exists
        $existing = $supabase->select(
            'subscriptions',
            '*',
            ['subscription_id' => $data['subscription_id']]
        );
        
        if (!empty($existing)) {
            // Update existing subscription
            return $supabase->update(
                'subscriptions',
                $data,
                ['subscription_id' => $data['subscription_id']]
            );
        } else {
            // Insert new subscription
            return $supabase->insert('subscriptions', $data);
        }
        
    } catch (Exception $e) {
        error_log("Error saving LemonSqueezy subscription: " . $e->getMessage());
        throw $e;
    }
}

/**
 * Link subscription payload to a user record.
 *
 * Attempts to resolve the related user using (in order):
 * 1. Provided user_id
 * 2. Provided clerk_user_id (legacy support)
 * 3. Email address from the subscription payload
 *
 * When a user is resolved the function:
 * - Adds user_id (internal users.id) to $subscriptionData
 * - Leaves customer_id untouched (should remain the LemonSqueezy customer id)
 *
 * @param array               $subscriptionData Reference to subscription data being prepared for persistence
 * @param array|string|int|null $identity       Either an array with user_id/clerk_user_id, a numeric user_id or a clerk_user_id string
 * @param string|null         $email            Customer email from LemonSqueezy payload
 *
 * @return array{
 *     user: array|null,
 *     user_id: int|null
 * }
 */
function linkSubscriptionToUser(array &$subscriptionData, $identity = null, $email = null) {
    $candidateUserId = null;
    $candidateClerkUserId = null;

    if (is_array($identity)) {
        $candidateUserId = $identity['user_id'] ?? null;
        $candidateClerkUserId = $identity['clerk_user_id'] ?? null;
    } elseif (is_numeric($identity)) {
        $candidateUserId = $identity;
    } elseif (is_string($identity)) {
        $candidateClerkUserId = $identity;
    }

    $userRecord = null;

    if ($candidateUserId !== null && $candidateUserId !== '') {
        $userRecord = getUserById($candidateUserId, 'id, email, clerk_user_id');
    }

    if (!$userRecord && !empty($candidateClerkUserId)) {
        $userRecord = getUserByClerkUserId($candidateClerkUserId, 'id, email, clerk_user_id');
    }

    if (!$userRecord && !empty($email)) {
        $userRecord = getUserByEmail($email, 'id, email, clerk_user_id');
    }

    if ($userRecord && array_key_exists('id', $userRecord) && $userRecord['id'] !== null) {
        $subscriptionData['user_id'] = $userRecord['id'];
    } else {
        unset($subscriptionData['user_id']);
    }

    return [
        'user' => $userRecord,
        'user_id' => $subscriptionData['user_id'] ?? null
    ];
}

/**
 * Get internal user id linked to a subscription.
 *
 * @param string $subscriptionId
 * @return int|null
 */
function getUserIdFromSubscription($subscriptionId) {
    try {
        if (empty($subscriptionId)) {
            return null;
        }

        $supabase = getSupabaseClient();

        $subscriptions = $supabase->select(
            'subscriptions',
            'user_id, customer_email',
            ['subscription_id' => $subscriptionId]
        );

        if (!empty($subscriptions)) {
            $userId = $subscriptions[0]['user_id'] ?? null;
            if (!empty($userId)) {
                return $userId;
            }

            $customerEmail = $subscriptions[0]['customer_email'] ?? null;
            if (!empty($customerEmail)) {
                return getUserIdFromEmail($customerEmail);
            }
        }

        return null;
    } catch (Exception $e) {
        error_log("Error getting user_id from subscription: " . $e->getMessage());
        return null;
    }
}

/**
 * Get internal user id from email address.
 *
 * @param string $email
 * @return int|null
 */
function getUserIdFromEmail($email) {
    try {
        if (empty($email)) {
            return null;
        }

        $user = getUserByEmail($email, 'id');
        return $user['id'] ?? null;
    } catch (Exception $e) {
        error_log("Error getting user_id from email: " . $e->getMessage());
        return null;
    }
}

/**
 * Get clerk_user_id from subscription_id
 * First tries subscriptions table (direct link), then falls back to users table
 */
function getClerkUserIdFromSubscription($subscriptionId) {
    try {
        if (empty($subscriptionId)) {
            return null;
        }
        
        $supabase = getSupabaseClient();
        
        // First, try to get from subscriptions table (direct link)
        $subscriptions = $supabase->select(
            'subscriptions',
            'clerk_user_id',
            ['subscription_id' => $subscriptionId]
        );
        
        if (!empty($subscriptions) && !empty($subscriptions[0]['clerk_user_id'])) {
            return $subscriptions[0]['clerk_user_id'];
        }
        
        // Fallback: Query users table by subscription_id
        $users = $supabase->select(
            'users',
            'clerk_user_id',
            ['subscription_id' => $subscriptionId]
        );
        
        if (!empty($users)) {
            return $users[0]['clerk_user_id'];
        }
        
        return null;
    } catch (Exception $e) {
        error_log("Error getting clerk_user_id from subscription: " . $e->getMessage());
        return null;
    }
}

/**
 * Resolve a user record by Clerk user ID.
 *
 * @param string $clerkUserId
 * @param string $columns
 * @return array|null
 */
function getUserByClerkUserId($clerkUserId, $columns = 'id, clerk_user_id, email') {
    try {
        if (empty($clerkUserId)) {
            return null;
        }

        $supabase = getSupabaseClient();
        $users = $supabase->select(
            'users',
            $columns,
            ['clerk_user_id' => $clerkUserId]
        );

        return !empty($users) ? $users[0] : null;
    } catch (Exception $e) {
        error_log("Error getting user by clerk_user_id: " . $e->getMessage());
        return null;
    }
}

/**
 * Resolve a user record by primary key ID.
 *
 * @param int|string $userId
 * @param string     $columns
 * @return array|null
 */
function getUserById($userId, $columns = 'id, clerk_user_id, email') {
    try {
        if ($userId === null || $userId === '') {
            return null;
        }

        $supabase = getSupabaseClient();
        $users = $supabase->select(
            'users',
            $columns,
            ['id' => $userId]
        );

        return !empty($users) ? $users[0] : null;
    } catch (Exception $e) {
        error_log("Error getting user by id: " . $e->getMessage());
        return null;
    }
}

/**
 * Resolve a user record by email address.
 *
 * @param string $email
 * @param string $columns
 * @return array|null
 */
function getUserByEmail($email, $columns = 'id, clerk_user_id, email') {
    try {
        if (empty($email)) {
            return null;
        }

        $supabase = getSupabaseClient();
        $emailNormalized = strtolower(trim($email));

        $users = $supabase->select(
            'users',
            $columns,
            ['email' => $emailNormalized]
        );

        if (empty($users)) {
            $users = $supabase->select(
                'users',
                $columns,
                ['email' => trim($email)]
            );
        }

        return !empty($users) ? $users[0] : null;
    } catch (Exception $e) {
        error_log("Error getting user by email: " . $e->getMessage());
        return null;
    }
}

/**
 * Get clerk_user_id from customer_id by querying users or subscriptions table
 * Links via internal users.id (primary) with fallback to legacy LemonSqueezy customer_id data
 * 
 * @param string|int $customerId Internal user ID preferred, legacy LemonSqueezy customer ID supported as fallback
 * @return string|null Clerk user ID if found, null otherwise
 */
function getClerkUserIdFromCustomerId($customerId) {
    try {
        if (empty($customerId)) {
            return null;
        }

        // Primary: treat as internal users.id (current behaviour)
        $user = getUserById($customerId, 'clerk_user_id');
        if ($user && !empty($user['clerk_user_id'])) {
            return $user['clerk_user_id'];
        }

        // Fallback: legacy behaviour where subscriptions.customer_id stored LemonSqueezy customer ID
        $supabase = getSupabaseClient();
        
        $subscriptions = $supabase->select(
            'subscriptions',
            'subscription_id, customer_email, clerk_user_id',
            ['customer_id' => $customerId]
        );

        if (!empty($subscriptions)) {
            $subscription = $subscriptions[0];
            $subscriptionId = $subscription['subscription_id'] ?? null;
            $subscriptionClerkId = $subscription['clerk_user_id'] ?? null;
            $customerEmail = $subscription['customer_email'] ?? null;

            if (!empty($subscriptionClerkId)) {
                return $subscriptionClerkId;
            }

            // Try to get clerk_user_id from subscription_id
            if ($subscriptionId) {
                $clerkUserId = getClerkUserIdFromSubscription($subscriptionId);
                if ($clerkUserId) {
                    return $clerkUserId;
                }
            }
            
            // Try to get clerk_user_id from email
            if ($customerEmail) {
                $clerkUserId = getClerkUserIdFromEmail($customerEmail);
                if ($clerkUserId) {
                    return $clerkUserId;
                }
            }
        }
        
        return null;
    } catch (Exception $e) {
        error_log("Error getting clerk_user_id from customer_id: " . $e->getMessage());
        return null;
    }
}

/**
 * Get clerk_user_id from email by querying users table
 * Used as fallback when subscription_id lookup fails
 * 
 * Note: Email is unique in users table, so this is a reliable way to link subscriptions to users
 * 
 * @param string $email Customer email from subscription
 * @return string|null Clerk user ID if found, null otherwise
 */
function getClerkUserIdFromEmail($email) {
    try {
        if (empty($email)) {
            return null;
        }

        $user = getUserByEmail($email, 'clerk_user_id');

        if (!empty($user) && !empty($user['clerk_user_id'])) {
            return $user['clerk_user_id'];
        }
        
        return null;
    } catch (Exception $e) {
        error_log("Error getting clerk_user_id from email: " . $e->getMessage());
        return null;
    }
}

/**
 * Create or update user in users table
 * Tracks all logged-in users (paying and non-paying)
 */
function createOrUpdateUser($clerkUserId, $email, $name = null, $isPro = false, $proStatusSource = null, $subscriptionId = null) {
    try {
        if (empty($clerkUserId)) {
            error_log("ERROR: createOrUpdateUser called with empty clerk_user_id");
            throw new Exception("clerk_user_id is required");
        }
        
        $supabase = getSupabaseClient();
        
        // Ensure is_pro is always 0 or 1 for MySQL (never null/empty string)
        $isProInt = ($isPro === true || $isPro === 1 || $isPro === '1') ? 1 : 0;
        
        $userData = [
            'clerk_user_id' => $clerkUserId,
            'email' => $email,
            'name' => $name,
            'is_pro' => $isProInt,
            'pro_status_source' => $proStatusSource,
            'subscription_id' => $subscriptionId,
            'last_login' => gmdate('Y-m-d H:i:s'),
            'updated_at' => gmdate('Y-m-d H:i:s')
        ];
        
        // Check if user already exists
        error_log("Checking for existing user with clerk_user_id: {$clerkUserId}");
        $existing = $supabase->select(
            'users',
            '*',
            ['clerk_user_id' => $clerkUserId]
        );
        
        error_log("Select query result: " . json_encode($existing) . " (type: " . gettype($existing) . ", empty: " . (empty($existing) ? 'true' : 'false') . ")");
        
        // Check if existing is an array with at least one element
        if (is_array($existing) && count($existing) > 0) {
            // Update existing user
            error_log("Updating existing user: {$clerkUserId} ({$email})");
            $result = $supabase->update(
                'users',
                $userData,
                ['clerk_user_id' => $clerkUserId]
            );
            error_log("User updated successfully: " . json_encode($result));
            return $result;
        } else {
            // Insert new user
            $userData['created_at'] = gmdate('Y-m-d H:i:s');
            error_log("Creating new user: {$clerkUserId} ({$email}), is_pro: " . ($isPro ? 'true' : 'false'));
            $result = $supabase->insert('users', $userData);
            error_log("User created successfully: " . json_encode($result));
            return $result;
        }
        
    } catch (Exception $e) {
        error_log("Error creating/updating user: " . $e->getMessage());
        error_log("Stack trace: " . $e->getTraceAsString());
        throw $e;
    }
}

/**
 * Determine if user should be considered pro based on subscription status
 * 
 * According to LemonSqueezy docs:
 * - active: Subscription is active and paid
 * - cancelled: Customer cancelled, but subscription is still valid during grace period (ends_at shows when it expires)
 * - expired: Subscription has ended (either cancelled grace period ended, or unpaid and dunning period ended)
 * - paused: Payment collection paused
 * - past_due: Payment failed, retrying (4 attempts over 2 weeks)
 * - unpaid: All payment retries failed, dunning rules determine if it becomes expired
 * - on_trial: Subscription is in trial period
 * 
 * User should be considered pro if:
 * - Status is "active" OR
 * - Status is "cancelled" but not yet expired (grace period)
 * 
 * User should NOT be considered pro if:
 * - Status is "expired"
 * - Status is "unpaid" (all retries failed)
 * 
 * @param string $status Subscription status from LemonSqueezy
 * @return bool True if user should be considered pro, false otherwise
 */
function shouldUserBePro($status) {
    // User is pro if subscription is active
    if ($status === 'active') {
        return true;
    }
    
    // User is pro if subscription is cancelled but not yet expired (grace period)
    // The subscription_updated event will fire when it actually expires with status='expired'
    if ($status === 'cancelled') {
        return true;
    }
    
    // User is pro if on trial
    if ($status === 'on_trial') {
        return true;
    }
    
    // User is pro if past_due (still trying to collect payment)
    if ($status === 'past_due') {
        return true;
    }
    
    // User is NOT pro if expired
    if ($status === 'expired') {
        return false;
    }
    
    // User is NOT pro if unpaid (all retries failed)
    if ($status === 'unpaid') {
        return false;
    }
    
    // User is NOT pro if paused (payment collection paused)
    if ($status === 'paused') {
        return false;
    }
    
    // Default: if status is unknown, don't grant pro access
    return false;
}

/**
 * Update user's pro status based on subscription
 */
function updateUserProStatus($userIdentifier, $email, $isPro, $proStatusSource = null, $subscriptionId = null) {
    try {
        $supabase = getSupabaseClient();
        
        $updateData = [
            'is_pro' => $isPro,
            'pro_status_source' => $proStatusSource,
            'subscription_id' => $subscriptionId,
            'updated_at' => gmdate('Y-m-d H:i:s')
        ];
        
        $resolvedUser = null;

        if ($userIdentifier !== null && $userIdentifier !== '') {
            if (is_numeric($userIdentifier)) {
                $resolvedUser = getUserById($userIdentifier, 'id, email');
            } else {
                $resolvedUser = getUserByClerkUserId($userIdentifier, 'id, email, clerk_user_id');
            }
        }

        if (!$resolvedUser && !empty($email)) {
            $resolvedUser = getUserByEmail($email, 'id, email, clerk_user_id');
        }

        if (!$resolvedUser || empty($resolvedUser['id'])) {
            error_log("Skipping user pro status update - user not found (identifier: " . json_encode($userIdentifier) . ", email: {$email})");
            return null;
        }

        return $supabase->update(
            'users',
            $updateData,
            ['id' => $resolvedUser['id']]
        );
        
    } catch (Exception $e) {
        error_log("Error updating user pro status: " . $e->getMessage());
        throw $e;
    }
}

/**
 * Get user's pro status from users table (fast lookup)
 */
function getUserProStatus($clerkUserId) {
    try {
        $supabase = getSupabaseClient();
        
        $users = $supabase->select(
            'users',
            '*',
            ['clerk_user_id' => $clerkUserId]
        );
        
        if (!empty($users)) {
            $user = $users[0];
            return [
                'is_pro' => (bool)($user['is_pro'] ?? false),
                'pro_status_source' => $user['pro_status_source'] ?? null,
                'subscription_id' => $user['subscription_id'] ?? null,
                'email' => $user['email'] ?? null
            ];
        }
        
        return [
            'is_pro' => false,
            'pro_status_source' => null,
            'subscription_id' => null,
            'email' => null
        ];
        
    } catch (Exception $e) {
        error_log("Error getting user pro status: " . $e->getMessage());
        return [
            'is_pro' => false,
            'pro_status_source' => null,
            'subscription_id' => null,
            'email' => null
        ];
    }
}
?>

