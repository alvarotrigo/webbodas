<?php
/**
 * Check User Subscription Status
 * Checks if user has an active subscription (legacy or LemonSqueezy)
 */

// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/../debug/php_errors.log');

// Enable CORS
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Include required files
require_once '../config/database.php';
require_once '../config/lemonsqueezy.php';

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('Method not allowed');
    }

    // Get JSON input
    $input = json_decode(file_get_contents('php://input'), true);
    
    $email = $input['email'] ?? null;
    
    if (!$email) {
        throw new Exception('Email is required');
    }
    
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        throw new Exception('Invalid email format');
    }

    // Check both legacy purchases and LemonSqueezy subscriptions
    $legacyStatus = checkUserPaidStatus($email);
    $lemonSqueezyStatus = checkLemonSqueezySubscription($email);

    $hasPaidAccess = false;
    $subscriptionDetails = null;

    // User has paid access if either source shows paid status
    if ($legacyStatus['is_paid']) {
        $hasPaidAccess = true;
        $subscriptionDetails = [
            'source' => 'legacy',
            'details' => $legacyStatus
        ];
    } elseif ($lemonSqueezyStatus['is_paid']) {
        $hasPaidAccess = true;
        $subscriptionDetails = [
            'source' => 'lemonsqueezy',
            'details' => $lemonSqueezyStatus
        ];
    }

    echo json_encode([
        'success' => true,
        'has_subscription' => $hasPaidAccess,
        'is_paid' => $hasPaidAccess,
        'subscription' => $subscriptionDetails,
        'legacy_check' => $legacyStatus,
        'lemonsqueezy_check' => $lemonSqueezyStatus
    ]);

} catch (Exception $e) {
    error_log("Check subscription error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'has_subscription' => false,
        'is_paid' => false,
        'error' => $e->getMessage()
    ]);
}
?>



