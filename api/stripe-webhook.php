<?php
/**
 * Stripe Webhook Handler
 * Processes checkout.session.completed (and subscription events if needed) to keep user pro status in sync.
 */

error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/../debug/php_errors.log');

header('Content-Type: application/json');

$autoload = __DIR__ . '/../vendor/autoload.php';
if (!file_exists($autoload)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Stripe SDK not installed']);
    exit();
}
require_once $autoload;

require_once __DIR__ . '/../config/stripe.php';
require_once __DIR__ . '/../config/mysql-client.php';

function writeStripeWebhookLog($message, $data = null) {
    $logFile = __DIR__ . '/logs.txt';
    $timestamp = date('Y-m-d H:i:s');
    $entry = "[{$timestamp}] [STRIPE-WEBHOOK] {$message}";
    if ($data !== null) {
        $entry .= "\n" . json_encode($data, JSON_PRETTY_PRINT);
    }
    $entry .= "\n" . str_repeat('-', 80) . "\n";
    file_put_contents($logFile, $entry, FILE_APPEND | LOCK_EX);
}

try {
    writeStripeWebhookLog("=== STRIPE WEBHOOK RECEIVED ===");

    $payload = file_get_contents('php://input');
    $signature = $_SERVER['HTTP_STRIPE_SIGNATURE'] ?? '';

    if (empty(STRIPE_WEBHOOK_SECRET)) {
        writeStripeWebhookLog("WARNING: Webhook secret not set, skipping verification");
    } else {
        try {
            $event = \Stripe\Webhook::constructEvent($payload, $signature, STRIPE_WEBHOOK_SECRET);
        } catch (\UnexpectedValueException $e) {
            writeStripeWebhookLog("ERROR: Invalid payload - " . $e->getMessage());
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Invalid payload']);
            exit();
        } catch (\Stripe\Exception\SignatureVerificationException $e) {
            writeStripeWebhookLog("ERROR: Invalid signature - " . $e->getMessage());
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Invalid signature']);
            exit();
        }
    }

    $event = json_decode($payload, true);
    $eventType = $event['type'] ?? '';
    $data = $event['data']['object'] ?? [];

    writeStripeWebhookLog("Event type: " . $eventType);

    switch ($eventType) {
        case 'checkout.session.completed':
            handleCheckoutSessionCompleted($data);
            break;
        case 'customer.subscription.deleted':
        case 'customer.subscription.updated':
            handleSubscriptionEvent($eventType, $data);
            break;
        default:
            writeStripeWebhookLog("INFO: Ignored event " . $eventType);
            break;
    }

    writeStripeWebhookLog("✓ Webhook processed");
    http_response_code(200);
    echo json_encode(['success' => true, 'event' => $eventType]);
} catch (Exception $e) {
    writeStripeWebhookLog("ERROR: " . $e->getMessage());
    error_log("Stripe webhook: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

/**
 * checkout.session.completed: one-time payment (Pro) completed
 */
function handleCheckoutSessionCompleted($session) {
    $paymentStatus = $session['payment_status'] ?? '';
    if ($paymentStatus !== 'paid') {
        writeStripeWebhookLog("INFO: Session not paid, status: " . $paymentStatus);
        return;
    }

    $customerEmail = $session['customer_email'] ?? $session['customer_details']['email'] ?? null;
    $metadata = $session['metadata'] ?? [];
    $clerkUserId = is_array($metadata) ? ($metadata['clerk_user_id'] ?? null) : ($metadata->clerk_user_id ?? null);
    $subscriptionId = $session['id'] ?? null;

    if (empty($customerEmail) && empty($clerkUserId)) {
        writeStripeWebhookLog("WARNING: No customer identifier in session");
        return;
    }

    updateStripeUserProStatus($customerEmail, true, $subscriptionId, $clerkUserId);

    $subData = [
        'subscription_id' => $subscriptionId,
        'customer_email' => $customerEmail,
        'customer_name' => $session['customer_details']['name'] ?? null,
        'product_name' => 'Pro',
        'status' => 'active',
        'status_formatted' => 'Active',
    ];
    saveOrUpdateStripeSubscription($subData);
    writeStripeWebhookLog("✓ Pro access granted from checkout.session.completed");
}

/**
 * customer.subscription.updated / deleted: keep pro status in sync if you use subscriptions later
 */
function handleSubscriptionEvent($eventType, $subscription) {
    $subscriptionId = $subscription['id'] ?? null;
    $status = $subscription['status'] ?? '';
    $customerId = $subscription['customer'] ?? null;

    $isPro = in_array(strtolower($status), ['active', 'trialing']);
    if ($eventType === 'customer.subscription.deleted') {
        $isPro = false;
    }

    $customerEmail = null;
    if (!empty($customerId)) {
        try {
            \Stripe\Stripe::setApiKey(getStripeSecretKey());
            $customer = \Stripe\Customer::retrieve($customerId);
            $customerEmail = is_object($customer) ? ($customer->email ?? null) : ($customer['email'] ?? null);
        } catch (Exception $e) {
            writeStripeWebhookLog("Could not retrieve customer: " . $e->getMessage());
        }
    }

    $metadata = $subscription['metadata'] ?? [];
    $clerkUserId = is_array($metadata) ? ($metadata['clerk_user_id'] ?? null) : ($metadata->clerk_user_id ?? null);

    if (empty($customerEmail) && empty($clerkUserId)) {
        writeStripeWebhookLog("WARNING: No customer identifier in subscription");
        return;
    }

    updateStripeUserProStatus($customerEmail, $isPro, $subscriptionId, $clerkUserId);
    $subData = [
        'subscription_id' => $subscriptionId,
        'customer_email' => $customerEmail,
        'product_name' => 'Pro',
        'status' => $isPro ? 'active' : 'canceled',
        'status_formatted' => $isPro ? 'Active' : 'Canceled',
    ];
    saveOrUpdateStripeSubscription($subData);
    writeStripeWebhookLog("✓ Subscription event handled, is_pro: " . ($isPro ? 'true' : 'false'));
}

function saveOrUpdateStripeSubscription($data) {
    try {
        $db = getMySQLClient();
        $subscriptionId = $data['subscription_id'] ?? null;
        if (empty($subscriptionId)) {
            return;
        }

        $customerEmail = $data['customer_email'] ?? null;
        $userId = null;
        if (!empty($customerEmail)) {
            $users = $db->select('users', 'id', ['email' => strtolower(trim($customerEmail))]);
            if (!empty($users)) {
                $userId = (int)$users[0]['id'];
            }
        }

        $row = [
            'subscription_id' => $subscriptionId,
            'user_id' => $userId,
            'customer_email' => $customerEmail,
            'customer_name' => $data['customer_name'] ?? null,
            'product_name' => $data['product_name'] ?? 'Pro',
            'status' => $data['status'] ?? 'active',
            'status_formatted' => $data['status_formatted'] ?? 'Active',
            'updated_at' => gmdate('Y-m-d H:i:s'),
        ];

        $existing = $db->select('subscriptions', 'id', ['subscription_id' => $subscriptionId]);
        if (!empty($existing)) {
            $db->update('subscriptions', $row, ['subscription_id' => $subscriptionId]);
        } else {
            $row['created_at'] = gmdate('Y-m-d H:i:s');
            $db->insert('subscriptions', $row);
        }
    } catch (Exception $e) {
        writeStripeWebhookLog("ERROR saving subscription: " . $e->getMessage());
    }
}
