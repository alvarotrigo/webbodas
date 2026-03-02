<?php
/**
 * Test subscription_payment_success webhook
 */

// Read payload from file
$payloadFile = '/tmp/webhook_payment_success.json';
$payload = file_get_contents($payloadFile);

// Generate signature
$webhookSecret = 'supersecret123;';
$signature = hash_hmac('sha256', $payload, $webhookSecret);

echo "=== Testing subscription_payment_success Webhook ===\n";
echo "Signature: $signature\n\n";

// Include configuration
require_once __DIR__ . '/config/lemonsqueezy.php';

// Load webhook handler function
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

// Process the webhook
$event = json_decode($payload, true);
$eventName = $event['meta']['event_name'] ?? '';
$eventData = $event['data'] ?? [];
$attributes = $eventData['attributes'] ?? [];
$customData = $attributes['custom_data'] ?? [];

echo "Processing event: {$eventName}\n\n";

handleSubscriptionPaymentSuccess($attributes, $customData);

echo "\n=== Verifying update in Supabase ===\n";
$subscriptionId = $attributes['id'] ?? '';

if ($subscriptionId) {
    $supabase = getSupabaseClient();
    
    try {
        $subscriptions = $supabase->select(
            'subscriptions',
            '*',
            ['subscription_id' => $subscriptionId]
        );
        
        if (!empty($subscriptions)) {
            echo "✓ Updated subscription in Supabase:\n";
            $sub = $subscriptions[0];
            echo "  - Status: " . $sub['status'] . "\n";
            echo "  - Renews At: " . ($sub['renews_at'] ?? 'N/A') . "\n";
            echo "  - Updated At: " . $sub['updated_at'] . "\n";
        } else {
            echo "✗ Subscription NOT found in Supabase\n";
        }
    } catch (Exception $e) {
        echo "Error querying Supabase: " . $e->getMessage() . "\n";
    }
}
?>

