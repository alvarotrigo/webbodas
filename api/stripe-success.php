<?php
/**
 * Stripe Checkout Success Handler
 * Handles redirect after successful Stripe checkout; updates user pro status and redirects to app.
 */

error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/../debug/php_errors.log');

$autoload = __DIR__ . '/../vendor/autoload.php';
if (!file_exists($autoload)) {
    header('Location: /app.php?payment=error&message=' . urlencode('Stripe SDK not installed'));
    exit();
}
require_once $autoload;

require_once __DIR__ . '/../config/stripe.php';
require_once __DIR__ . '/../config/mysql-client.php';

function writeStripeSuccessLog($message, $data = null) {
    $logFile = __DIR__ . '/logs.txt';
    $timestamp = date('Y-m-d H:i:s');
    $entry = "[{$timestamp}] [STRIPE-SUCCESS] {$message}";
    if ($data !== null) {
        $entry .= "\n" . json_encode($data, JSON_PRETTY_PRINT);
    }
    $entry .= "\n" . str_repeat('-', 80) . "\n";
    file_put_contents($logFile, $entry, FILE_APPEND | LOCK_EX);
}

try {
    writeStripeSuccessLog("=== STRIPE SUCCESS REDIRECT ===");

    $sessionId = $_GET['session_id'] ?? null;
    if (empty($sessionId)) {
        writeStripeSuccessLog("ERROR: No session_id");
        throw new Exception('No session ID provided');
    }

    \Stripe\Stripe::setApiKey(getStripeSecretKey());
    $session = \Stripe\Checkout\Session::retrieve($sessionId);

    writeStripeSuccessLog("Session retrieved", [
        'id' => $session->id,
        'payment_status' => $session->payment_status ?? 'N/A',
        'customer_email' => $session->customer_email ?? 'N/A',
    ]);

    if (($session->payment_status ?? '') !== 'paid') {
        writeStripeSuccessLog("ERROR: Payment not completed. payment_status: " . ($session->payment_status ?? 'unknown'));
        throw new Exception('Payment was not completed');
    }

    $customerEmail = $session->customer_email ?? null;
    $metadata = $session->metadata ?? [];
    $clerkUserId = is_object($metadata) ? ($metadata->clerk_user_id ?? null) : ($metadata['clerk_user_id'] ?? null);
    $subscriptionId = $session->id; // use session id as reference (one-time payment)

    if (empty($customerEmail) && empty($clerkUserId)) {
        writeStripeSuccessLog("ERROR: No customer email or clerk_user_id");
        throw new Exception('Unable to identify customer');
    }

    $db = getMySQLClient();
    $user = null;
    if (!empty($clerkUserId)) {
        $users = $db->select('users', '*', ['clerk_user_id' => $clerkUserId]);
        if (!empty($users)) {
            $user = $users[0];
        }
    }
    if (!$user && !empty($customerEmail)) {
        $users = $db->select('users', '*', ['email' => strtolower(trim($customerEmail))]);
        if (!empty($users)) {
            $user = $users[0];
        }
    }

    if ($user) {
        $db->update('users', [
            'is_pro' => 1,
            'pro_status_source' => 'stripe',
            'subscription_id' => $subscriptionId,
            'updated_at' => gmdate('Y-m-d H:i:s'),
        ], ['id' => $user['id']]);
        writeStripeSuccessLog("User updated", ['user_id' => $user['id'], 'email' => $user['email']]);
    } else {
        writeStripeSuccessLog("WARNING: User not found; webhook may link later.", ['email' => $customerEmail]);
    }

    // Save subscription record for consistency
    $existing = $db->select('subscriptions', 'id', ['subscription_id' => $subscriptionId]);
    $subData = [
        'subscription_id' => $subscriptionId,
        'user_id' => $user ? (int)$user['id'] : null,
        'customer_email' => $customerEmail,
        'product_name' => 'Pro',
        'status' => 'active',
        'status_formatted' => 'Active',
        'updated_at' => gmdate('Y-m-d H:i:s'),
    ];
    if (empty($existing)) {
        $subData['created_at'] = gmdate('Y-m-d H:i:s');
        $db->insert('subscriptions', $subData);
    } else {
        $db->update('subscriptions', $subData, ['subscription_id' => $subscriptionId]);
    }

    session_start();
    $returnUrl = $_SESSION['stripe_return_url'] ?? '/app.php';
    unset($_SESSION['stripe_return_url']);
    $sep = strpos($returnUrl, '?') !== false ? '&' : '?';
    $redirectUrl = $returnUrl . $sep . 'payment=success';
    writeStripeSuccessLog("Redirecting to: " . $redirectUrl);
    header('Location: ' . $redirectUrl);
    exit();
} catch (Exception $e) {
    writeStripeSuccessLog("ERROR: " . $e->getMessage());
    error_log("Stripe success handler: " . $e->getMessage());
    session_start();
    $returnUrl = $_SESSION['stripe_return_url'] ?? '/app.php';
    unset($_SESSION['stripe_return_url']);
    $sep = strpos($returnUrl, '?') !== false ? '&' : '?';
    header('Location: ' . $returnUrl . $sep . 'payment=error&message=' . urlencode($e->getMessage()));
    exit();
}
