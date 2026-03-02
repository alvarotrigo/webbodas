<?php
/**
 * Polar.sh Checkout Success Handler
 * Handles the redirect after a successful Polar checkout
 * 
 * This endpoint receives the checkout_id from Polar's success redirect,
 * verifies the payment, and updates the user's pro status.
 */

// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/../debug/php_errors.log');

// Include configuration
require_once __DIR__ . '/../config/polar.php';
require_once __DIR__ . '/../config/mysql-client.php';

/**
 * Write log entry to api/logs.txt
 */
function writePolarSuccessLog($message, $data = null) {
    $logFile = __DIR__ . '/logs.txt';
    $timestamp = date('Y-m-d H:i:s');
    $logEntry = "[{$timestamp}] [POLAR-SUCCESS] {$message}";
    
    if ($data !== null) {
        $logEntry .= "\n" . json_encode($data, JSON_PRETTY_PRINT);
    }
    
    $logEntry .= "\n" . str_repeat('-', 80) . "\n";
    
    file_put_contents($logFile, $logEntry, FILE_APPEND | LOCK_EX);
}

try {
    writePolarSuccessLog("=== POLAR SUCCESS REDIRECT RECEIVED ===");
    
    // Log environment mode
    $testMode = isPolarTestMode();
    $environment = $testMode ? 'SANDBOX' : 'PRODUCTION';
    writePolarSuccessLog("Environment: {$environment} (test_mode=" . ($testMode ? 'true' : 'false') . ")");
    writePolarSuccessLog("API URL: " . POLAR_API_URL);
    
    // Get checkout_id from query parameters
    $checkoutId = $_GET['checkout_id'] ?? null;
    
    if (empty($checkoutId)) {
        writePolarSuccessLog("ERROR: No checkout_id provided");
        throw new Exception('No checkout ID provided');
    }
    
    writePolarSuccessLog("Checkout ID: {$checkoutId}");
    
    // Verify checkout with Polar API
    writePolarSuccessLog("Fetching checkout details from Polar API...");
    
    $checkout = getPolarCheckout($checkoutId);
    
    writePolarSuccessLog("Checkout data received:", [
        'id' => $checkout['id'] ?? 'N/A',
        'status' => $checkout['status'] ?? 'N/A',
        'customer_email' => $checkout['customer_email'] ?? 'N/A',
        'product_id' => $checkout['product_id'] ?? 'N/A',
        'amount' => $checkout['amount'] ?? 'N/A'
    ]);
    
    // Check if checkout is completed/succeeded
    $status = $checkout['status'] ?? '';
    if (!in_array($status, ['succeeded', 'confirmed', 'completed'])) {
        writePolarSuccessLog("ERROR: Checkout not completed. Status: {$status}");
        throw new Exception("Checkout not completed. Status: {$status}");
    }
    
    // Extract customer information
    $customerEmail = $checkout['customer_email'] ?? null;
    $customerId = $checkout['customer_id'] ?? null;
    $productId = $checkout['product_id'] ?? null;
    $subscriptionId = $checkout['subscription_id'] ?? $checkout['id'] ?? null;
    
    // Try to get clerk_user_id from checkout metadata
    $metadata = $checkout['metadata'] ?? [];
    $clerkUserId = $metadata['clerk_user_id'] ?? null;
    
    // Also check custom_field_data for clerk_user_id
    $customFieldData = $checkout['custom_field_data'] ?? [];
    if (empty($clerkUserId) && !empty($customFieldData['clerk_user_id'])) {
        $clerkUserId = $customFieldData['clerk_user_id'];
    }
    
    writePolarSuccessLog("Customer info extracted:", [
        'email' => $customerEmail,
        'customer_id' => $customerId,
        'product_id' => $productId,
        'subscription_id' => $subscriptionId,
        'clerk_user_id' => $clerkUserId ?? 'NOT FOUND'
    ]);
    
    if (empty($customerEmail) && empty($clerkUserId)) {
        writePolarSuccessLog("ERROR: No customer email or clerk_user_id found");
        throw new Exception('Unable to identify customer from checkout');
    }
    
    // Update user's pro status
    $db = getMySQLClient();
    
    // Try to find user
    $user = null;
    
    if (!empty($clerkUserId)) {
        $users = $db->select('users', '*', ['clerk_user_id' => $clerkUserId]);
        if (!empty($users)) {
            $user = $users[0];
            writePolarSuccessLog("User found by clerk_user_id: {$clerkUserId}");
        }
    }
    
    if (!$user && !empty($customerEmail)) {
        $users = $db->select('users', '*', ['email' => strtolower(trim($customerEmail))]);
        if (!empty($users)) {
            $user = $users[0];
            writePolarSuccessLog("User found by email: {$customerEmail}");
        }
    }
    
    if ($user) {
        // Update existing user
        $updateData = [
            'is_pro' => true,
            'pro_status_source' => 'polar',
            'subscription_id' => $subscriptionId,
            'updated_at' => gmdate('Y-m-d H:i:s')
        ];
        
        $db->update('users', $updateData, ['id' => $user['id']]);
        writePolarSuccessLog("✓ User updated successfully:", [
            'user_id' => $user['id'],
            'email' => $user['email'],
            'is_pro' => true,
            'subscription_id' => $subscriptionId
        ]);
    } else {
        // User not found - they might not be logged in yet
        // Store the subscription info for later linking
        writePolarSuccessLog("WARNING: User not found in database. Email: {$customerEmail}");
        writePolarSuccessLog("Subscription will be linked when user logs in.");
        
        // Optionally save to a pending subscriptions table or store in session
        // For now, we'll just log it and the user can be updated via webhook
    }
    
    // Save subscription record
    try {
        $subscriptionData = [
            'subscription_id' => $subscriptionId,
            'customer_id' => $customerId,
            'customer_email' => $customerEmail,
            'customer_name' => $checkout['customer_name'] ?? '',
            'product_id' => $productId,
            'product_name' => $checkout['product']['name'] ?? 'Polar Product',
            'status' => 'active',
            'status_formatted' => 'Active',
            'created_at' => gmdate('Y-m-d H:i:s'),
            'updated_at' => gmdate('Y-m-d H:i:s')
        ];
        
        if ($user) {
            $subscriptionData['user_id'] = (int)$user['id']; // Ensure integer (never empty string)
        }
        
        // Add test mode flag if we're in test environment
        if (isPolarTestMode()) {
            $subscriptionData['customer_name'] = '[TEST] ' . ($subscriptionData['customer_name'] ?: 'Test User');
            writePolarSuccessLog("Marking subscription as TEST subscription");
        }
        
        // Check if subscription already exists
        $existing = $db->select('subscriptions', '*', ['subscription_id' => $subscriptionId]);
        
        if (!empty($existing)) {
            $db->update('subscriptions', $subscriptionData, ['subscription_id' => $subscriptionId]);
            writePolarSuccessLog("✓ Subscription updated in database");
        } else {
            $db->insert('subscriptions', $subscriptionData);
            writePolarSuccessLog("✓ Subscription saved to database");
        }
    } catch (Exception $e) {
        // Don't fail the whole request if subscription save fails
        writePolarSuccessLog("WARNING: Failed to save subscription: " . $e->getMessage());
    }
    
    writePolarSuccessLog("=== POLAR SUCCESS HANDLER COMPLETE ===");
    
    // Retrieve the original URL from session if available
    session_start();
    $returnUrl = $_SESSION['polar_return_url'] ?? '/app.php';
    unset($_SESSION['polar_return_url']); // Clean up session
    
    // Append payment success parameter
    $separator = strpos($returnUrl, '?') !== false ? '&' : '?';
    $redirectUrl = $returnUrl . $separator . 'payment=success';
    
    writePolarSuccessLog("Redirecting to: {$redirectUrl}");
    
    header('Location: ' . $redirectUrl);
    exit();

} catch (Exception $e) {
    writePolarSuccessLog("ERROR: " . $e->getMessage());
    writePolarSuccessLog("Stack trace:", $e->getTraceAsString());
    error_log("Polar success handler error: " . $e->getMessage());
    
    // Retrieve the original URL from session if available for error redirect too
    session_start();
    $returnUrl = $_SESSION['polar_return_url'] ?? '/app.php';
    unset($_SESSION['polar_return_url']); // Clean up session
    
    // Append error parameters
    $separator = strpos($returnUrl, '?') !== false ? '&' : '?';
    $redirectUrl = $returnUrl . $separator . 'payment=error&message=' . urlencode($e->getMessage());
    
    header('Location: ' . $redirectUrl);
    exit();
}
?>

