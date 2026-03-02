<?php
/**
 * Test LemonSqueezy Webhook Handler via CLI
 */

// Simulate webhook environment
$_SERVER['HTTP_X_SIGNATURE'] = '';
$_SERVER['REQUEST_METHOD'] = 'POST';

// Read payload from file
$payloadFile = '/tmp/webhook_payload.json';
if (!file_exists($payloadFile)) {
    die("Payload file not found: $payloadFile\n");
}

$payload = file_get_contents($payloadFile);

// Generate signature
$webhookSecret = 'supersecret123;';
$signature = hash_hmac('sha256', $payload, $webhookSecret);
$_SERVER['HTTP_X_SIGNATURE'] = $signature;

echo "=== Testing LemonSqueezy Webhook ===\n";
echo "Signature: $signature\n\n";

// Include configuration
require_once __DIR__ . '/config/lemonsqueezy.php';

// Load webhook handler functions (we'll define them here to avoid conflicts)
function handleSubscriptionCreated($attributes, $customData) {
    $subscriptionData = [
        'subscription_id' => $attributes['id'] ?? '',
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
        'created_at' => $attributes['created_at'] ?? date('Y-m-d H:i:s'),
        'updated_at' => date('Y-m-d H:i:s')
    ];

    try {
        saveLemonSqueezySubscription($subscriptionData);
        if (!empty($customData['clerk_user_id'])) {
            $isPro = ($subscriptionData['status'] === 'active');
            updateUserProStatus(
                $customData['clerk_user_id'],
                $subscriptionData['customer_email'],
                $isPro,
                'lemonsqueezy',
                $subscriptionData['subscription_id']
            );
        }
        echo "✓ Subscription created successfully: " . $subscriptionData['subscription_id'] . "\n";
    } catch (Exception $e) {
        echo "✗ Error saving subscription: " . $e->getMessage() . "\n";
        throw $e;
    }
}

function handleSubscriptionPaymentSuccess($attributes, $customData) {
    $subscriptionData = [
        'subscription_id' => $attributes['id'] ?? '',
        'status' => 'active',
        'renews_at' => $attributes['renews_at'] ?? null,
        'updated_at' => date('Y-m-d H:i:s')
    ];

    try {
        saveLemonSqueezySubscription($subscriptionData);
        echo "✓ Payment successful for subscription: " . $subscriptionData['subscription_id'] . "\n";
    } catch (Exception $e) {
        echo "✗ Error updating subscription after payment: " . $e->getMessage() . "\n";
    }
}

// Manually process the webhook
$event = json_decode($payload, true);

if (!$event) {
    die("Invalid JSON payload\n");
}

// Verify webhook signature
if (!empty($webhookSecret)) {
    $expectedSignature = hash_hmac('sha256', $payload, $webhookSecret);
    
    if (!hash_equals($expectedSignature, $signature)) {
        die("Invalid webhook signature\n");
    }
}

// Get event type and data
$eventName = $event['meta']['event_name'] ?? '';
$eventData = $event['data'] ?? [];
$attributes = $eventData['attributes'] ?? [];
$customData = $attributes['custom_data'] ?? [];

echo "Processing event: {$eventName}\n\n";

// Process the webhook event based on type
switch ($eventName) {
    case 'subscription_created':
        handleSubscriptionCreated($attributes, $customData);
        break;

    case 'subscription_payment_success':
        handleSubscriptionPaymentSuccess($attributes, $customData);
        break;

    default:
        echo "Unhandled event type: {$eventName}\n";
}

echo "\n=== Webhook processed successfully ===\n";

// Now verify in Supabase
echo "\n=== Verifying in Supabase ===\n";
$subscriptionId = $attributes['id'] ?? '';
$customerEmail = $attributes['user_email'] ?? '';

if ($subscriptionId && $customerEmail) {
    $supabase = getSupabaseClient();
    
    try {
        $subscriptions = $supabase->select(
            'subscriptions',
            '*',
            ['subscription_id' => $subscriptionId]
        );
        
        if (!empty($subscriptions)) {
            echo "✓ Subscription found in Supabase:\n";
            print_r($subscriptions[0]);
        } else {
            echo "✗ Subscription NOT found in Supabase\n";
        }
        
        // Check for user record if custom_data has clerk_user_id
        if (!empty($customData['clerk_user_id'])) {
            $users = $supabase->select(
                'users',
                '*',
                ['subscription_id' => $subscriptionId]
            );
            
            if (!empty($users)) {
                echo "\n✓ User record found:\n";
                print_r($users[0]);
            } else {
                echo "\n✗ User record NOT found\n";
            }
        }
    } catch (Exception $e) {
        echo "Error querying Supabase: " . $e->getMessage() . "\n";
    }
}
?>

