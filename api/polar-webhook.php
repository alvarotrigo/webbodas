<?php
/**
 * Polar.sh Webhook Handler
 * Processes webhook events from Polar for subscription updates
 * 
 * Webhook Events handled:
 * - checkout.created - Checkout session created
 * - checkout.updated - Checkout completed/status changed
 * - subscription.created - New subscription created
 * - subscription.updated - Subscription status changed
 * - subscription.active - Subscription became active
 * - subscription.canceled - Subscription was canceled
 * - subscription.revoked - Subscription was revoked
 * - order.created - One-time order created (for lifetime deals)
 */

// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/../debug/php_errors.log');

// Set content type
header('Content-Type: application/json');

// Include configuration
require_once __DIR__ . '/../config/polar.php';
require_once __DIR__ . '/../config/mysql-client.php';

/**
 * Write log entry to api/logs.txt
 */
function writePolarWebhookLog($message, $data = null) {
    $logFile = __DIR__ . '/logs.txt';
    $timestamp = date('Y-m-d H:i:s');
    $logEntry = "[{$timestamp}] [POLAR-WEBHOOK] {$message}";
    
    if ($data !== null) {
        $logEntry .= "\n" . json_encode($data, JSON_PRETTY_PRINT);
    }
    
    $logEntry .= "\n" . str_repeat('-', 80) . "\n";
    
    file_put_contents($logFile, $logEntry, FILE_APPEND | LOCK_EX);
}

try {
    writePolarWebhookLog("=== POLAR WEBHOOK RECEIVED ===");
    
    // Log environment mode
    $testMode = isPolarTestMode();
    $environment = $testMode ? 'SANDBOX' : 'PRODUCTION';
    writePolarWebhookLog("Environment: {$environment} (test_mode=" . ($testMode ? 'true' : 'false') . ")");
    writePolarWebhookLog("API URL: " . POLAR_API_URL);
    
    writePolarWebhookLog("IP Address: " . ($_SERVER['REMOTE_ADDR'] ?? 'unknown'));
    writePolarWebhookLog("Request Method: " . ($_SERVER['REQUEST_METHOD'] ?? 'unknown'));
    
    // Get the raw POST data
    $payload = file_get_contents('php://input');
    $event = json_decode($payload, true);
    
    writePolarWebhookLog("Payload received (first 1000 chars):", substr($payload, 0, 1000));
    
    if (!$event) {
        writePolarWebhookLog("ERROR: Invalid JSON payload");
        throw new Exception('Invalid JSON payload');
    }
    
    // Verify webhook signature
    $signature = $_SERVER['HTTP_X_POLAR_SIGNATURE'] ?? $_SERVER['HTTP_WEBHOOK_SIGNATURE'] ?? '';
    
    if (!empty(POLAR_WEBHOOK_SECRET)) {
        if (!verifyPolarWebhookSignature($payload, $signature)) {
            writePolarWebhookLog("ERROR: Webhook signature verification failed");
            throw new Exception('Invalid webhook signature');
        }
        writePolarWebhookLog("✓ Signature verified successfully");
    } else {
        writePolarWebhookLog("WARNING: Webhook secret not configured, skipping signature verification");
    }
    
    // Get event type and data
    $eventType = $event['type'] ?? $event['event'] ?? '';
    $eventData = $event['data'] ?? $event;
    
    writePolarWebhookLog("Event Type: {$eventType}");
    writePolarWebhookLog("Event Data:", $eventData);
    
    // Process webhook event based on type
    switch ($eventType) {
        case 'checkout.created':
            // Checkout session created - no action needed
            writePolarWebhookLog("INFO: Checkout created - waiting for completion");
            break;
            
        case 'checkout.updated':
            // Checkout status changed - check if completed
            handlePolarCheckoutUpdated($eventData);
            break;
            
        case 'subscription.created':
        case 'subscription.active':
            // New subscription or subscription activated
            handlePolarSubscriptionActive($eventData);
            break;
            
        case 'subscription.updated':
            // Subscription updated - check status
            handlePolarSubscriptionUpdated($eventData);
            break;
            
        case 'subscription.canceled':
        case 'subscription.revoked':
            // Subscription ended
            handlePolarSubscriptionEnded($eventData);
            break;
            
        case 'order.created':
            // One-time order (lifetime deal)
            handlePolarOrderCreated($eventData);
            break;
            
        default:
            writePolarWebhookLog("INFO: Ignoring event type '{$eventType}'");
            break;
    }
    
    writePolarWebhookLog("✓ Webhook processed successfully");
    
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'event' => $eventType
    ]);

} catch (Exception $e) {
    writePolarWebhookLog("ERROR: " . $e->getMessage());
    writePolarWebhookLog("Stack trace:", $e->getTraceAsString());
    error_log("Polar webhook error: " . $e->getMessage());
    
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

/**
 * Handle checkout.updated event
 */
function handlePolarCheckoutUpdated($data) {
    $status = $data['status'] ?? '';
    
    writePolarWebhookLog("Checkout updated - Status: {$status}");
    
    if (!in_array($status, ['succeeded', 'confirmed', 'completed'])) {
        writePolarWebhookLog("INFO: Checkout not yet completed");
        return;
    }
    
    $customerEmail = $data['customer_email'] ?? $data['email'] ?? null;
    $subscriptionId = $data['subscription_id'] ?? $data['id'] ?? null;
    $metadata = $data['metadata'] ?? [];
    $clerkUserId = $metadata['clerk_user_id'] ?? null;
    
    if (empty($customerEmail) && empty($clerkUserId)) {
        writePolarWebhookLog("WARNING: No customer identifier found in checkout");
        return;
    }
    
    updatePolarUserProStatus($customerEmail, true, $subscriptionId, $clerkUserId);
    saveOrUpdatePolarSubscription($data, 'active');
    
    writePolarWebhookLog("✓ User pro status updated from checkout completion");
}

/**
 * Handle subscription.created or subscription.active events
 */
function handlePolarSubscriptionActive($data) {
    $customerEmail = $data['customer_email'] ?? $data['user']['email'] ?? null;
    $subscriptionId = $data['id'] ?? $data['subscription_id'] ?? null;
    $metadata = $data['metadata'] ?? [];
    $clerkUserId = $metadata['clerk_user_id'] ?? null;
    
    writePolarWebhookLog("Subscription activated:", [
        'email' => $customerEmail,
        'subscription_id' => $subscriptionId,
        'clerk_user_id' => $clerkUserId ?? 'N/A'
    ]);
    
    if (empty($customerEmail) && empty($clerkUserId)) {
        writePolarWebhookLog("WARNING: No customer identifier found");
        return;
    }
    
    updatePolarUserProStatus($customerEmail, true, $subscriptionId, $clerkUserId);
    saveOrUpdatePolarSubscription($data, 'active');
    
    writePolarWebhookLog("✓ Subscription activated successfully");
}

/**
 * Handle subscription.updated event
 */
function handlePolarSubscriptionUpdated($data) {
    $status = $data['status'] ?? '';
    $customerEmail = $data['customer_email'] ?? $data['user']['email'] ?? null;
    $subscriptionId = $data['id'] ?? $data['subscription_id'] ?? null;
    $metadata = $data['metadata'] ?? [];
    $clerkUserId = $metadata['clerk_user_id'] ?? null;
    
    writePolarWebhookLog("Subscription updated:", [
        'status' => $status,
        'email' => $customerEmail,
        'subscription_id' => $subscriptionId
    ]);
    
    // Determine if user should still be pro
    $isPro = shouldPolarUserBePro($status);
    
    updatePolarUserProStatus($customerEmail, $isPro, $subscriptionId, $clerkUserId);
    saveOrUpdatePolarSubscription($data, $status);
    
    writePolarWebhookLog("✓ Subscription updated - is_pro: " . ($isPro ? 'true' : 'false'));
}

/**
 * Handle subscription.canceled or subscription.revoked events
 */
function handlePolarSubscriptionEnded($data) {
    $customerEmail = $data['customer_email'] ?? $data['user']['email'] ?? null;
    $subscriptionId = $data['id'] ?? $data['subscription_id'] ?? null;
    $metadata = $data['metadata'] ?? [];
    $clerkUserId = $metadata['clerk_user_id'] ?? null;
    
    writePolarWebhookLog("Subscription ended:", [
        'email' => $customerEmail,
        'subscription_id' => $subscriptionId
    ]);
    
    // Note: For canceled subscriptions, user might still have access until end of billing period
    // We set isPro to false here, but you might want to check ends_at date
    $status = $data['status'] ?? 'canceled';
    $isPro = shouldPolarUserBePro($status);
    
    updatePolarUserProStatus($customerEmail, $isPro, $subscriptionId, $clerkUserId);
    saveOrUpdatePolarSubscription($data, $status);
    
    writePolarWebhookLog("✓ Subscription ended - is_pro: " . ($isPro ? 'true' : 'false'));
}

/**
 * Handle order.created event (for lifetime deals)
 */
function handlePolarOrderCreated($data) {
    $customerEmail = $data['customer_email'] ?? $data['user']['email'] ?? $data['billing_email'] ?? null;
    $orderId = $data['id'] ?? null;
    $metadata = $data['metadata'] ?? [];
    $clerkUserId = $metadata['clerk_user_id'] ?? null;
    
    writePolarWebhookLog("Order created (lifetime deal):", [
        'email' => $customerEmail,
        'order_id' => $orderId,
        'clerk_user_id' => $clerkUserId ?? 'N/A'
    ]);
    
    if (empty($customerEmail) && empty($clerkUserId)) {
        writePolarWebhookLog("WARNING: No customer identifier found in order");
        return;
    }
    
    // Lifetime deals grant permanent pro access
    updatePolarUserProStatus($customerEmail, true, $orderId, $clerkUserId);
    
    // Save as subscription with 'lifetime' status
    $data['status'] = 'lifetime';
    saveOrUpdatePolarSubscription($data, 'lifetime');
    
    writePolarWebhookLog("✓ Lifetime order processed successfully");
}

/**
 * Save or update subscription in database
 */
function saveOrUpdatePolarSubscription($data, $status) {
    try {
        $db = getMySQLClient();
        
        $subscriptionId = $data['id'] ?? $data['subscription_id'] ?? null;
        if (empty($subscriptionId)) {
            writePolarWebhookLog("WARNING: No subscription ID to save");
            return;
        }
        
        // Extract customer email from various possible locations
        $customerEmail = $data['customer_email'] 
            ?? $data['user']['email'] 
            ?? $data['billing_email'] 
            ?? $data['email'] 
            ?? null;
        
        // Get user_id if we can find the user
        $userId = null;
        if (!empty($customerEmail)) {
            $users = $db->select('users', 'id', ['email' => strtolower(trim($customerEmail))]);
            if (!empty($users)) {
                $userId = $users[0]['id'];
            }
        }
        
        $subscriptionData = [
            'subscription_id' => $subscriptionId,
            'user_id' => $userId ? (int)$userId : null, // Ensure integer or null (never empty string)
            'customer_id' => $data['customer_id'] ?? null,
            'customer_email' => $customerEmail,
            'customer_name' => $data['customer_name'] ?? $data['user']['name'] ?? null,
            'product_id' => $data['product_id'] ?? $data['product']['id'] ?? null,
            'product_name' => $data['product_name'] ?? $data['product']['name'] ?? 'Polar Product',
            'status' => $status,
            'status_formatted' => ucfirst($status),
            'updated_at' => gmdate('Y-m-d H:i:s')
        ];
        
        // Add test mode flag if we're in test environment
        if (isPolarTestMode()) {
            $subscriptionData['customer_name'] = '[TEST] ' . ($subscriptionData['customer_name'] ?? 'Test User');
            writePolarWebhookLog("Marking subscription as TEST subscription");
        }
        
        // Check if subscription exists
        $existing = $db->select('subscriptions', 'id', ['subscription_id' => $subscriptionId]);
        
        if (!empty($existing)) {
            $db->update('subscriptions', $subscriptionData, ['subscription_id' => $subscriptionId]);
            writePolarWebhookLog("✓ Subscription updated in database");
        } else {
            $subscriptionData['created_at'] = gmdate('Y-m-d H:i:s');
            $db->insert('subscriptions', $subscriptionData);
            writePolarWebhookLog("✓ Subscription saved to database");
        }
        
    } catch (Exception $e) {
        writePolarWebhookLog("ERROR saving subscription: " . $e->getMessage());
    }
}
?>

