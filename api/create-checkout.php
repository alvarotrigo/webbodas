<?php
/**
 * Create LemonSqueezy Checkout Session
 * Creates a checkout URL for the user to complete their subscription
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
require_once '../config/lemonsqueezy.php';

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('Method not allowed');
    }

    // Get JSON input
    $input = json_decode(file_get_contents('php://input'), true);
    
    $email = $input['email'] ?? null;
    $name = $input['name'] ?? '';
    $clerkUserId = $input['clerk_user_id'] ?? null;
    
    if (!$email) {
        throw new Exception('Email is required');
    }
    
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        throw new Exception('Invalid email format');
    }

    // Get the appropriate API key and IDs based on test mode
    $apiKey = getLemonSqueezyApiKey();
    $storeId = getLemonSqueezyStoreId();
    $variantId = getLemonSqueezyVariantId();
    $isTestMode = isLemonSqueezyTestMode();
    
    // Log which mode is being used
    error_log("LemonSqueezy Checkout - Mode: " . ($isTestMode ? 'TEST' : 'PRODUCTION') . ", Store ID: {$storeId}, Variant ID: {$variantId}");
    
    // Check if LemonSqueezy is configured
    if (empty($apiKey)) {
        throw new Exception('LemonSqueezy API key not configured');
    }
    
    if (empty($storeId) || empty($variantId)) {
        throw new Exception('LemonSqueezy store or variant not configured');
    }

    if (empty($clerkUserId)) {
        throw new Exception('clerk_user_id is required');
    }

    // Create checkout session with LemonSqueezy API
    $checkoutData = [
        'data' => [
            'type' => 'checkouts',
            'attributes' => [
                'checkout_data' => [
                    'email' => $email,
                    'name' => $name,
                    'custom' => [
                        'clerk_user_id' => $clerkUserId
                    ]
                ],
                'product_options' => [
                    'enabled_variants' => [intval($variantId)]
                ],
                'checkout_options' => [
                    'button_color' => '#667eea'
                ]
            ],
            'relationships' => [
                'store' => [
                    'data' => [
                        'type' => 'stores',
                        'id' => $storeId
                    ]
                ],
                'variant' => [
                    'data' => [
                        'type' => 'variants',
                        'id' => $variantId
                    ]
                ]
            ]
        ]
    ];

    // Make API request to LemonSqueezy
    $ch = curl_init('https://api.lemonsqueezy.com/v1/checkouts');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($checkoutData));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Accept: application/vnd.api+json',
        'Content-Type: application/vnd.api+json',
        'Authorization: Bearer ' . $apiKey
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);

    if ($error) {
        throw new Exception("LemonSqueezy API error: {$error}");
    }

    if ($httpCode !== 201) {
        error_log("LemonSqueezy API response ({$httpCode}): {$response}");
        throw new Exception("Failed to create checkout (HTTP {$httpCode})");
    }

    $result = json_decode($response, true);
    
    if (!isset($result['data']['attributes']['url'])) {
        throw new Exception('No checkout URL returned from LemonSqueezy');
    }

    $checkoutUrl = $result['data']['attributes']['url'];

    // Log the checkout creation
    error_log("Checkout created for {$email} (clerk_user_id {$clerkUserId}): {$checkoutUrl}");

    echo json_encode([
        'success' => true,
        'checkout_url' => $checkoutUrl,
        'checkout_id' => $result['data']['id'] ?? null
    ]);

} catch (Exception $e) {
    error_log("Create checkout error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?>



