<?php
/**
 * Create Polar.sh Checkout Session
 * Creates a checkout session with pre-filled customer information
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

// Include configuration
require_once '../config/polar.php';

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('Method not allowed');
    }

    // Get JSON input
    $input = json_decode(file_get_contents('php://input'), true);
    
    $email = $input['email'] ?? null;
    $name = $input['name'] ?? '';
    $clerkUserId = $input['clerk_user_id'] ?? null;
    $plan = $input['plan'] ?? 'annual'; // 'annual' or 'lifetime'
    $returnUrl = $input['return_url'] ?? null;
    
    // Store return URL in session for use after successful checkout
    if (!empty($returnUrl)) {
        session_start();
        $_SESSION['polar_return_url'] = $returnUrl;
        error_log("Stored return URL in session: {$returnUrl}");
    }
    
    if (!$email) {
        throw new Exception('Email is required');
    }
    
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        throw new Exception('Invalid email format');
    }

    if (empty($clerkUserId)) {
        throw new Exception('clerk_user_id is required');
    }

    // Log environment mode
    $testMode = isPolarTestMode();
    $environment = $testMode ? 'SANDBOX' : 'PRODUCTION';
    error_log("Polar Environment: {$environment} (test_mode=" . ($testMode ? 'true' : 'false') . ")");
    
    // Get the appropriate checkout URL based on plan
    $baseCheckoutUrl = getPolarCheckoutUrl($plan);
    
    if (empty($baseCheckoutUrl)) {
        throw new Exception("Checkout URL not configured for plan: {$plan}. Please set POLAR_CHECKOUT_" . strtoupper($plan) . ($testMode ? '_SANDBOX' : '') . " in .env");
    }
    
    // For Polar checkout links, use the correct parameter names:
    // - customer_email: Pre-fills the email field
    // - customer_name: Pre-fills the name field (if supported)
    // See: https://polar.sh/docs/features/checkout/links
    
    $queryParams = [
        'customer_email' => $email,  // Changed from 'email' to 'customer_email'
    ];
    
    // Add customer name if provided
    if (!empty($name)) {
        $queryParams['customer_name'] = $name;
    }
    
    // Build the checkout URL with query parameters
    $checkoutUrl = $baseCheckoutUrl . '?' . http_build_query($queryParams);
    
    // Log the checkout creation and URL for debugging
    error_log("Polar checkout URL: {$checkoutUrl}");
    error_log("Polar checkout created for {$email} (plan: {$plan}, clerk_user_id: {$clerkUserId}, environment: {$environment})");

    echo json_encode([
        'success' => true,
        'checkout_url' => $checkoutUrl,
        'plan' => $plan
    ]);

} catch (Exception $e) {
    error_log("Create Polar checkout error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?>

