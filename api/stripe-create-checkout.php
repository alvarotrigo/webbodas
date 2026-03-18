<?php
/**
 * Create Stripe Checkout Session
 * Single product: Pro (89€). Redirects to Stripe Hosted Checkout.
 */

error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/../debug/php_errors.log');

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$autoload = __DIR__ . '/../vendor/autoload.php';
if (!file_exists($autoload)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Stripe SDK not installed. Run: composer require stripe/stripe-php']);
    exit();
}
require_once $autoload;

require_once __DIR__ . '/../config/stripe.php';

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('Method not allowed');
    }

    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $email = $input['email'] ?? null;
    $name = $input['name'] ?? '';
    $clerkUserId = $input['clerk_user_id'] ?? null;
    $returnUrl = $input['return_url'] ?? null;

    if (!empty($returnUrl)) {
        session_start();
        $_SESSION['stripe_return_url'] = $returnUrl;
    }

    if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        throw new Exception('Valid email is required');
    }
    if (empty($clerkUserId)) {
        throw new Exception('clerk_user_id is required');
    }

    $priceId = getStripePriceIdPro();
    if (empty($priceId)) {
        throw new Exception('Stripe Pro price not configured (STRIPE_PRICE_ID_PRO)');
    }

    $baseUrl = getStripeBaseUrl();
    if (empty($baseUrl)) {
        throw new Exception('Stripe base URL not configured (STRIPE_BASE_URL or SHARE_BASE_DOMAIN in .env)');
    }

    \Stripe\Stripe::setApiKey(getStripeSecretKey());

    $successUrl = $baseUrl . '/api/stripe-success.php?session_id={CHECKOUT_SESSION_ID}';
    $cancelUrl = $returnUrl ?: ($baseUrl . '/app.php');

    $params = [
        'mode' => 'payment',
        'line_items' => [
            [
                'price' => $priceId,
                'quantity' => 1,
            ],
        ],
        'success_url' => $successUrl,
        'cancel_url' => $cancelUrl,
        'customer_email' => $email,
        'metadata' => [
            'clerk_user_id' => $clerkUserId,
        ],
    ];

    $session = \Stripe\Checkout\Session::create($params);

    error_log("Stripe checkout created for {$email} (session_id: {$session->id}, env: " . (isStripeTestMode() ? 'test' : 'live') . ")");

    echo json_encode([
        'success' => true,
        'checkout_url' => $session->url,
        'session_id' => $session->id,
    ]);
} catch (Exception $e) {
    error_log("Stripe create-checkout error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
    ]);
}
