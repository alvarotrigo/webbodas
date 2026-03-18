<?php
/**
 * Stripe Configuration
 * Single paid product: Pro (89€). Configure keys and webhook here.
 */

// Load .env file
loadStripeEnv();

// Test Mode Configuration
$stripeTestModeEnv = getenv('STRIPE_TEST_MODE');
if ($stripeTestModeEnv !== false) {
    define('STRIPE_TEST_MODE', strtolower($stripeTestModeEnv) === 'true' || $stripeTestModeEnv === '1');
} else {
    define('STRIPE_TEST_MODE', false);
}

// Stripe API keys and webhook - use test or live based on mode
if (STRIPE_TEST_MODE) {
    define('STRIPE_SECRET_KEY', stripe_env('STRIPE_TEST_SECRET_KEY', ''));
    define('STRIPE_PUBLISHABLE_KEY', stripe_env('STRIPE_TEST_PUBLISHABLE_KEY', ''));
    define('STRIPE_WEBHOOK_SECRET', stripe_env('STRIPE_TEST_WEBHOOK_SECRET', stripe_env('STRIPE_WEBHOOK_SECRET', '')));
    define('STRIPE_PRICE_ID_PRO', stripe_env('STRIPE_TEST_PRICE_ID_PRO', stripe_env('STRIPE_PRICE_ID_PRO', '')));
} else {
    define('STRIPE_SECRET_KEY', stripe_env('STRIPE_SECRET_KEY', ''));
    define('STRIPE_PUBLISHABLE_KEY', stripe_env('STRIPE_PUBLISHABLE_KEY', ''));
    define('STRIPE_WEBHOOK_SECRET', stripe_env('STRIPE_WEBHOOK_SECRET', ''));
    define('STRIPE_PRICE_ID_PRO', stripe_env('STRIPE_PRICE_ID_PRO', ''));
}

/**
 * Helper: get env variable with fallback
 */
function stripe_env($key, $default = '') {
    $value = getenv($key);
    return $value !== false ? $value : $default;
}

/**
 * Load environment variables from .env file
 */
function loadStripeEnv() {
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
        if ($line === '' || strpos($line, '#') === 0) {
            continue;
        }
        $parts = explode('=', $line, 2);
        if (count($parts) === 2) {
            $key = trim($parts[0]);
            $value = trim($parts[1]);
            if ((substr($value, 0, 1) === '"' && substr($value, -1) === '"') ||
                (substr($value, 0, 1) === "'" && substr($value, -1) === "'")) {
                $value = substr($value, 1, -1);
            }
            if (getenv($key) === false) {
                putenv("{$key}={$value}");
            }
        }
    }
    $loaded = true;
}

/**
 * Check if Stripe is in test mode
 */
function isStripeTestMode() {
    return defined('STRIPE_TEST_MODE') && STRIPE_TEST_MODE;
}

/**
 * Get Stripe secret key for API calls
 */
function getStripeSecretKey() {
    return STRIPE_SECRET_KEY;
}

/**
 * Get Stripe publishable key (for frontend if needed)
 */
function getStripePublishableKey() {
    return defined('STRIPE_PUBLISHABLE_KEY') ? STRIPE_PUBLISHABLE_KEY : '';
}

/**
 * Get Price ID for Pro product
 */
function getStripePriceIdPro() {
    return STRIPE_PRICE_ID_PRO;
}

/**
 * Get base URL for success/cancel redirects.
 * In test mode: uses STRIPE_TEST_BASE_URL if set (e.g. http://nine-screen-canvas-flow.local for local dev).
 * Otherwise: STRIPE_BASE_URL, then https://SHARE_BASE_DOMAIN.
 */
function getStripeBaseUrl() {
    if (isStripeTestMode()) {
        $testBase = stripe_env('STRIPE_TEST_BASE_URL', '');
        if ($testBase !== '') {
            return rtrim($testBase, '/');
        }
    }
    $base = stripe_env('STRIPE_BASE_URL', '');
    if ($base !== '') {
        return rtrim($base, '/');
    }
    $domain = stripe_env('SHARE_BASE_DOMAIN', '');
    if ($domain !== '') {
        return 'https://' . $domain;
    }
    return '';
}

/**
 * Verify Stripe webhook signature
 * @param string $payload Raw request body
 * @param string $signature Stripe-Signature header
 * @return bool True if valid
 */
function verifyStripeWebhookSignature($payload, $signature) {
    if (empty(STRIPE_WEBHOOK_SECRET)) {
        return true;
    }
    try {
        $event = \Stripe\Webhook::constructEvent(
            $payload,
            $signature,
            STRIPE_WEBHOOK_SECRET
        );
        return $event !== null;
    } catch (\Exception $e) {
        return false;
    }
}

/**
 * Check if user has active Stripe subscription (pro) in database
 * @param string $email User's email
 * @return array { status, is_paid, source, subscription_id? }
 */
function checkStripeSubscription($email) {
    try {
        require_once __DIR__ . '/mysql-client.php';
        $db = getMySQLClient();
        $users = $db->select('users', '*', [
            'email' => strtolower(trim($email)),
            'pro_status_source' => 'stripe'
        ]);
        if (!empty($users) && !empty($users[0]['is_pro'])) {
            return [
                'status' => 'paid',
                'is_paid' => true,
                'source' => 'stripe',
                'subscription_id' => $users[0]['subscription_id'] ?? null
            ];
        }
        return [
            'status' => 'free',
            'is_paid' => false,
            'message' => 'No active Stripe subscription found'
        ];
    } catch (Exception $e) {
        error_log("Error checking Stripe subscription: " . $e->getMessage());
        return [
            'status' => 'error',
            'is_paid' => false,
            'message' => 'Error checking subscription status'
        ];
    }
}

/**
 * Update user's pro status from Stripe payment/subscription
 * @param string $email User email
 * @param bool $isPro Whether user should be pro
 * @param string|null $subscriptionId Stripe subscription or session ID
 * @param string|null $clerkUserId Clerk user ID if available
 */
function updateStripeUserProStatus($email, $isPro, $subscriptionId = null, $clerkUserId = null) {
    try {
        require_once __DIR__ . '/mysql-client.php';
        $db = getMySQLClient();

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
            error_log("Stripe: User not found for email: {$email}, clerk_user_id: " . ($clerkUserId ?? 'null'));
            return false;
        }

        $isProInt = ($isPro === true || $isPro === 1 || $isPro === '1') ? 1 : 0;
        $updateData = [
            'is_pro' => $isProInt,
            'pro_status_source' => $isProInt ? 'stripe' : null,
            'subscription_id' => $subscriptionId,
            'updated_at' => gmdate('Y-m-d H:i:s')
        ];
        $db->update('users', $updateData, ['id' => $user['id']]);
        error_log("Stripe: Updated user {$user['id']} pro status to " . ($isPro ? 'true' : 'false'));
        return true;
    } catch (Exception $e) {
        error_log("Error updating Stripe user pro status: " . $e->getMessage());
        return false;
    }
}
