<?php
/**
 * LemonSqueezy Webhook Handler
 * Processes webhook events from LemonSqueezy for subscription updates
 */

// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/../debug/php_errors.log');

// Set content type
header('Content-Type: application/json');

// Include configuration
require_once '../config/lemonsqueezy.php';

/**
 * Write log entry to api/logs.txt
 */
function writeWebhookLog($message, $data = null) {
    $logFile = __DIR__ . '/logs.txt';
    $timestamp = date('Y-m-d H:i:s');
    $logEntry = "[{$timestamp}] {$message}";
    
    if ($data !== null) {
        $logEntry .= "\n" . json_encode($data, JSON_PRETTY_PRINT);
    }
    
    $logEntry .= "\n" . str_repeat('-', 80) . "\n";
    
    // Append to log file
    file_put_contents($logFile, $logEntry, FILE_APPEND | LOCK_EX);
}

try {
    // Log webhook received
    writeWebhookLog("=== WEBHOOK RECEIVED ===");
    writeWebhookLog("IP Address: " . ($_SERVER['REMOTE_ADDR'] ?? 'unknown'));
    writeWebhookLog("User Agent: " . ($_SERVER['HTTP_USER_AGENT'] ?? 'unknown'));
    writeWebhookLog("Request Method: " . ($_SERVER['REQUEST_METHOD'] ?? 'unknown'));
    
    // Get the raw POST data
    $payload = file_get_contents('php://input');
    $event = json_decode($payload, true);

    // Log the webhook event for debugging
    error_log("LemonSqueezy Webhook received: " . substr($payload, 0, 500));
    writeWebhookLog("Payload received (first 1000 chars):", substr($payload, 0, 1000));

    if (!$event) {
        writeWebhookLog("ERROR: Invalid JSON payload");
        throw new Exception('Invalid JSON payload');
    }

    // Verify webhook signature if webhook secret is configured
    if (!empty(LEMONSQUEEZY_WEBHOOK_SECRET)) {
        $signature = $_SERVER['HTTP_X_SIGNATURE'] ?? '';
        $expectedSignature = hash_hmac('sha256', $payload, LEMONSQUEEZY_WEBHOOK_SECRET);
        
        writeWebhookLog("Signature verification:", [
            'received' => substr($signature, 0, 20) . '...',
            'expected' => substr($expectedSignature, 0, 20) . '...',
            'match' => hash_equals($expectedSignature, $signature)
        ]);
        
        if (!hash_equals($expectedSignature, $signature)) {
            writeWebhookLog("ERROR: Webhook signature verification failed");
            error_log("Webhook signature verification failed");
            throw new Exception('Invalid webhook signature');
        }
        writeWebhookLog("✓ Signature verified successfully");
    } else {
        writeWebhookLog("WARNING: Webhook secret not configured, skipping signature verification");
    }

    // Get event type and data
    $eventName = $event['meta']['event_name'] ?? '';
    $eventData = $event['data'] ?? [];
    $attributes = $eventData['attributes'] ?? [];
    
    // Extract subscription_id: Use data.id directly (matches first_subscription_item.subscription_id)
    $subscriptionId = $eventData['id'] ?? null;
    
    // Ensure subscription_id is available in attributes for downstream handlers
    if (empty($attributes['id']) && !empty($subscriptionId)) {
        $attributes['id'] = $subscriptionId;
    }
    
    // IMPORTANT: Custom data comes from meta.custom_data, NOT attributes.custom_data
    // According to LemonSqueezy docs: https://docs.lemonsqueezy.com/guides/developer-guide/taking-payments
    $customData = $event['meta']['custom_data'] ?? [];
    
    // Extract customer_id from relationships (LemonSqueezy provides this)
    $lemonsqueezyCustomerId = null;
    if (isset($eventData['relationships']['customer']['data']['id'])) {
        $lemonsqueezyCustomerId = $eventData['relationships']['customer']['data']['id'];
    } elseif (isset($attributes['customer_id'])) {
        $lemonsqueezyCustomerId = $attributes['customer_id'];
    }

    error_log("Processing event: {$eventName}");
    writeWebhookLog("Event Type: {$eventName}");
    writeWebhookLog("Event Data:", [
        'subscription_id' => $subscriptionId ?? 'N/A',
        'subscription_id_source' => $subscriptionId ? 'data.id' : 'NOT FOUND',
        'lemonsqueezy_customer_id' => $lemonsqueezyCustomerId ?? 'N/A',
        'lemonsqueezy_customer_id_source' => isset($eventData['relationships']['customer']['data']['id']) ? 'relationships' : (isset($attributes['customer_id']) ? 'attributes' : 'NOT FOUND'),
        'customer_email' => $attributes['user_email'] ?? 'N/A',
        'status' => $attributes['status'] ?? 'N/A',
        'custom_data_from_meta' => $customData,
        'custom_data_from_attributes' => $attributes['custom_data'] ?? 'NOT FOUND (expected)',
        'clerk_user_id_in_custom_data' => $customData['clerk_user_id'] ?? 'NOT FOUND'
    ]);
    
    // Log warning if subscription_id is missing
    if (empty($subscriptionId)) {
        writeWebhookLog("ERROR: subscription_id is missing from webhook!");
        writeWebhookLog("Event data.id:", $eventData['id'] ?? 'NOT FOUND');
        writeWebhookLog("Full attributes:", $attributes);
    }

    // Process the webhook event based on type
    // 
    // NOTE: According to LemonSqueezy docs, subscription_updated fires at every event after the initial payment.
    // We only handle subscription_created and subscription_updated. All other events are ignored.
    // Both handlers use upsert logic (create or update) to avoid duplicates.
    // 
    // In LemonSqueezy dashboard, you only need to subscribe to:
    // - subscription_created (for initial creation)
    // - subscription_updated (for all subsequent changes: cancelled, expired, resumed, etc.)
    switch ($eventName) {
        case 'subscription_created':
            // Handle initial subscription creation (uses upsert to avoid duplicates)
            handleSubscriptionCreated($attributes, $customData, $lemonsqueezyCustomerId);
            break;

        case 'subscription_updated':
            // Primary handler for all subscription status changes
            // This fires for: cancelled, expired, resumed, paused, unpaused, payment success/failure, etc.
            // We check the 'status' field to determine the current state
            // Uses upsert logic to handle both creation and updates
            handleSubscriptionUpdated($attributes, $customData, $lemonsqueezyCustomerId);
            break;

        default:
            // Ignore all other event types (subscription_cancelled, subscription_expired, etc.)
            // subscription_updated will handle all status changes
            writeWebhookLog("INFO: Ignoring event type '{$eventName}' - subscription_updated will handle all status changes");
            break;
    }

    // Return success response
    writeWebhookLog("✓ Webhook processed successfully");
    writeWebhookLog("Response: 200 OK");
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'event' => $eventName
    ]);

} catch (Exception $e) {
    $errorMessage = "ERROR: " . $e->getMessage();
    writeWebhookLog($errorMessage);
    writeWebhookLog("Stack trace:", $e->getTraceAsString());
    error_log("Webhook error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

/**
 * Handle subscription created event
 * 
 * Common SaaS approaches to link subscriptions to users:
 * 1. Custom Data (Primary): Pass clerk_user_id in checkout custom_data (preferred)
 * 2. Email Matching (Fallback): Match by customer_email if clerk_user_id missing
 * 3. Customer ID (LemonSqueezy): Store customer_id for future API queries
 */
function handleSubscriptionCreated($attributes, $customData, $lemonsqueezyCustomerId = null) {
    $subscriptionData = [
        'subscription_id' => $attributes['id'] ?? '',
        'customer_id' => $lemonsqueezyCustomerId ?? ($attributes['customer_id'] ?? ''),
        'customer_email' => $attributes['user_email'] ?? '',
        'customer_name' => $attributes['user_name'] ?? '',
        'product_id' => $attributes['product_id'] ?? '',
        'product_name' => $attributes['product_name'] ?? '',
        'variant_id' => $attributes['variant_id'] ?? '',
        'variant_name' => $attributes['variant_name'] ?? '',
        'status' => $attributes['status'] ?? '',
        'status_formatted' => $attributes['status_formatted'] ?? '',
        'card_brand' => $attributes['card_brand'] ?? '',
        'card_last_four' => $attributes['card_last_four'] ?? '',
        'renews_at' => $attributes['renews_at'] ?? null,
        'ends_at' => $attributes['ends_at'] ?? null,
        'trial_ends_at' => $attributes['trial_ends_at'] ?? null,
        'created_at' => $attributes['created_at'] ?? gmdate('Y-m-d H:i:s'),
        'updated_at' => gmdate('Y-m-d H:i:s')
    ];

    if (empty($subscriptionData['customer_id'])) {
        unset($subscriptionData['customer_id']);
    }

    try {
        $clerkUserId = $customData['clerk_user_id'] ?? null;
        $candidateUserId = $customData['user_id'] ?? null; // legacy support if ever provided

        if (empty($clerkUserId) && empty($candidateUserId)) {
            writeWebhookLog("No clerk_user_id supplied in custom_data, attempting email lookup");
            writeWebhookLog("Email to match: " . $subscriptionData['customer_email']);
        }

        $linkResult = linkSubscriptionToUser(
            $subscriptionData,
            [
                'user_id' => $candidateUserId,
                'clerk_user_id' => $clerkUserId
            ],
            $subscriptionData['customer_email']
        );

        $resolvedUserId = $linkResult['user_id'] ?? null;

        writeWebhookLog("Subscription linkage result:", [
            'lemonsqueezy_customer_id' => $lemonsqueezyCustomerId,
            'resolved_user_id' => $resolvedUserId ?? 'NOT LINKED'
        ]);
        
        // Save subscription to Supabase (with user_id if found)
        saveLemonSqueezySubscription($subscriptionData);
        writeWebhookLog("✓ Subscription saved to database: " . $subscriptionData['subscription_id']);
        
        // Update user's pro status if user_id was resolved
        // Use shouldUserBePro() to determine pro status based on subscription status
        if ($resolvedUserId) {
            $status = $subscriptionData['status'] ?? '';
            $isPro = shouldUserBePro($status);
            
            writeWebhookLog("Pro status determination:", [
                'status' => $status,
                'is_pro' => $isPro ? 'true' : 'false'
            ]);
            
            updateUserProStatus(
                $resolvedUserId,
                $subscriptionData['customer_email'],
                $isPro,
                'lemonsqueezy',
                $subscriptionData['subscription_id']
            );
            writeWebhookLog("✓ User pro status updated: {$resolvedUserId} (is_pro: " . ($isPro ? 'true' : 'false') . ")");
        } else {
            writeWebhookLog("WARNING: Subscription saved but user record not updated (user_id not resolved)");
            writeWebhookLog("Subscription will be linked when user logs in.");
        }

        writeWebhookLog("✓ Subscription created successfully: " . $subscriptionData['subscription_id']);
        error_log("Subscription created successfully: " . $subscriptionData['subscription_id']);
    } catch (Exception $e) {
        writeWebhookLog("ERROR in handleSubscriptionCreated: " . $e->getMessage());
        error_log("Error saving subscription: " . $e->getMessage());
        throw $e;
    }
}

/**
 * Handle subscription updated event
 * 
 * This handler uses upsert logic (create or update) to handle both:
 * - New subscriptions (if subscription_created hasn't fired yet or was missed)
 * - Existing subscriptions (all status changes: cancelled, expired, resumed, etc.)
 * 
 * This prevents duplicates and ensures we handle all subscription changes.
 */
function handleSubscriptionUpdated($attributes, $customData, $lemonsqueezyCustomerId = null) {
    $subscriptionId = $attributes['id'] ?? '';
    
    if (empty($subscriptionId)) {
        writeWebhookLog("ERROR: subscription_id missing in subscription_updated event");
        return;
    }
    
    // Check if subscription already exists
    require_once __DIR__ . '/../config/mysql-client.php';
    $supabase = getMySQLClient(); // Same variable name for compatibility
    $existing = $supabase->select(
        'subscriptions',
        'id, subscription_id, user_id',
        ['subscription_id' => $subscriptionId]
    );
    
    $subscriptionExists = !empty($existing);
    
    writeWebhookLog("Subscription update check:", [
        'subscription_id' => $subscriptionId,
        'exists' => $subscriptionExists ? 'YES' : 'NO',
        'action' => $subscriptionExists ? 'UPDATE' : 'CREATE (upsert)'
    ]);
    
    $subscriptionData = [
        'subscription_id' => $subscriptionId,
        'customer_id' => $lemonsqueezyCustomerId ?? ($attributes['customer_id'] ?? ''),
        'customer_email' => $attributes['user_email'] ?? '',
        'customer_name' => $attributes['user_name'] ?? '',
        'product_id' => $attributes['product_id'] ?? '',
        'product_name' => $attributes['product_name'] ?? '',
        'variant_id' => $attributes['variant_id'] ?? '',
        'variant_name' => $attributes['variant_name'] ?? '',
        'status' => $attributes['status'] ?? '',
        'status_formatted' => $attributes['status_formatted'] ?? '',
        'card_brand' => $attributes['card_brand'] ?? '',
        'card_last_four' => $attributes['card_last_four'] ?? '',
        'renews_at' => $attributes['renews_at'] ?? null,
        'ends_at' => $attributes['ends_at'] ?? null,
        'trial_ends_at' => $attributes['trial_ends_at'] ?? null,
        'updated_at' => gmdate('Y-m-d H:i:s')
    ];
    
    // Only set created_at if this is a new subscription (for creation)
    if (!$subscriptionExists) {
        $subscriptionData['created_at'] = $attributes['created_at'] ?? gmdate('Y-m-d H:i:s');
    }

    if (empty($subscriptionData['customer_id'])) {
        unset($subscriptionData['customer_id']);
    }

    try {
        $clerkUserId = $customData['clerk_user_id'] ?? null;
        $providedUserId = $customData['user_id'] ?? null; // legacy support

        if (!$providedUserId) {
            $providedUserId = getUserIdFromSubscription($subscriptionId);
        }

        $linkResult = linkSubscriptionToUser(
            $subscriptionData,
            [
                'user_id' => $providedUserId,
                'clerk_user_id' => $clerkUserId
            ],
            $subscriptionData['customer_email']
        );

        $resolvedUserId = $linkResult['user_id'] ?? $providedUserId;

        writeWebhookLog("Subscription update linkage:", [
            'lemonsqueezy_customer_id' => $lemonsqueezyCustomerId,
            'resolved_user_id' => $resolvedUserId ?? 'NOT LINKED'
        ]);

        saveLemonSqueezySubscription($subscriptionData);
        
        // Update user's pro status if user_id was found
        // Use shouldUserBePro() to determine pro status based on subscription status
        // This ensures cancelled subscriptions keep pro access until they expire
        if ($resolvedUserId) {
            $status = $subscriptionData['status'] ?? '';
            $isPro = shouldUserBePro($status);
            
            writeWebhookLog("Pro status determination:", [
                'status' => $status,
                'is_pro' => $isPro ? 'true' : 'false',
                'reason' => $status === 'cancelled' ? 'cancelled but in grace period' : 
                           ($status === 'expired' ? 'subscription expired' : 
                           ($status === 'active' ? 'subscription active' : 'other status'))
            ]);
            
            updateUserProStatus(
                $resolvedUserId,
                $subscriptionData['customer_email'],
                $isPro,
                'lemonsqueezy',
                $subscriptionId
            );
            writeWebhookLog("✓ User pro status updated: " . $resolvedUserId . " (is_pro: " . ($isPro ? 'true' : 'false') . ")");
        }
        
        writeWebhookLog("✓ Subscription updated: " . $subscriptionId);
        error_log("Subscription updated: " . $subscriptionId);
    } catch (Exception $e) {
        writeWebhookLog("ERROR in handleSubscriptionUpdated: " . $e->getMessage());
        error_log("Error updating subscription: " . $e->getMessage());
        throw $e;
    }
}
?>

