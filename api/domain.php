<?php
/**
 * Domain Operations API
 * Exposes OpenSRS domain operations (suggest, lookup, register) to the frontend.
 * Only accessible to authenticated Pro users (except lookup, which is open to authenticated users).
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

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

require_once __DIR__ . '/../config/env.php';
require_once __DIR__ . '/../config/mysql-client.php';
require_once __DIR__ . '/../includes/clerk-auth.php';
require_once __DIR__ . '/../includes/OpenSrsClient.php';

// ── Auth check ───────────────────────────────────────────────────
$clerkUserId = $_SESSION['clerk_user_id'] ?? null;
if (!$clerkUserId) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'User not authenticated']);
    exit();
}

$supabase    = getMySQLClient();
// Respect session is_paid and pro simulation (?pro=1) from app
$isPaid      = !empty($_SESSION['is_paid']) || !empty($_SESSION['simulate_pro']);

// ── OpenSRS client factory ───────────────────────────────────────
function getOpenSrsClient(): OpenSrsClient
{
    $username = getenv('OPENSRS_USERNAME');
    $testMode = strtolower(getenv('OPENSRS_TEST_MODE') ?: 'true') === 'true';
    $apiKey   = $testMode ? getenv('OPENSRS_API_KEY_TEST') : getenv('OPENSRS_API_KEY');

    if (empty($username) || empty($apiKey)) {
        throw new RuntimeException('OpenSRS credentials are not configured.');
    }

    return new OpenSrsClient($username, $apiKey, $testMode);
}

// ── Request body ─────────────────────────────────────────────────
$input  = json_decode(file_get_contents('php://input'), true) ?: [];
$action = $input['action'] ?? '';

error_log("Domain API - action={$action}, clerk_user_id={$clerkUserId}");

try {
    switch ($action) {

        // ── suggest ──────────────────────────────────────────────
        case 'suggest':
            $query = trim((string) ($input['query'] ?? ''));
            if ($query === '') {
                throw new InvalidArgumentException('query is required');
            }

            // Allow multiple TLDs from the request; fall back to .com only
            $tlds = $input['tlds'] ?? ['.com'];
            if (!is_array($tlds) || empty($tlds)) {
                $tlds = ['.com'];
            }

            $client  = getOpenSrsClient();
            $result  = $client->suggestDomains($query, $tlds);
            $code    = $result['response_code'] ?? null;

            if ($code != 200) {
                throw new RuntimeException('OpenSRS suggest error: ' . ($result['response_text'] ?? 'unknown'));
            }

            // Extract suggestions from the nested response (same logic as test file)
            $raw = $result['attributes']['lookup']['items']
                ?? $result['attributes']['lookup']
                ?? $result['attributes']['suggestion']['items']
                ?? $result['attributes']['suggestion']
                ?? [];

            $suggestions = [];
            foreach ($raw as $key => $item) {
                $domain = is_array($item) ? ($item['domain'] ?? $key) : $item;
                $status = is_array($item) ? ($item['status'] ?? 'unknown') : 'unknown';
                $isPremium = is_array($item) && !empty($item['is_premium']);

                // Only return available, non-premium domains
                if ($status === 'available' && !$isPremium) {
                    $suggestions[] = (string) $domain;
                }
            }

            echo json_encode(['success' => true, 'suggestions' => $suggestions]);
            break;

        // ── lookup ───────────────────────────────────────────────
        case 'lookup':
            $domain = trim((string) ($input['domain'] ?? ''));
            if ($domain === '') {
                throw new InvalidArgumentException('domain is required');
            }

            $client = getOpenSrsClient();
            $result = $client->lookupDomain($domain);
            $code   = $result['response_code'] ?? null;

            // 210 = available, 211 = taken
            $testMode = strtolower(getenv('OPENSRS_TEST_MODE') ?: 'true') === 'true';
            if ($code == 210) {
                echo json_encode(['success' => true, 'available' => true, 'test_mode' => $testMode]);
            } elseif ($code == 211) {
                echo json_encode(['success' => true, 'available' => false, 'test_mode' => $testMode]);
            } else {
                // Unexpected code — treat as unavailable to be safe
                $text = $result['response_text'] ?? "code {$code}";
                error_log("Domain API lookup - unexpected code {$code} for {$domain}: {$text}");
                echo json_encode(['success' => true, 'available' => false, 'note' => $text, 'test_mode' => $testMode]);
            }
            break;

        // ── register ─────────────────────────────────────────────
        case 'register':
            if (!$isPaid) {
                http_response_code(403);
                echo json_encode(['success' => false, 'error' => 'Domain registration requires a Pro plan.']);
                exit();
            }

            $domain = trim((string) ($input['domain'] ?? ''));
            if ($domain === '') {
                throw new InvalidArgumentException('domain is required');
            }

            // Build contact info from session/env; use sensible defaults for required fields.
            // In production these values should come from the user's billing profile.
            $contact = [
                'first_name'  => $_SESSION['clerk_first_name'] ?? getenv('OPENSRS_CONTACT_FIRST') ?: 'Wedding',
                'last_name'   => $_SESSION['clerk_last_name']  ?? getenv('OPENSRS_CONTACT_LAST')  ?: 'Editor',
                'org_name'    => getenv('OPENSRS_CONTACT_ORG')   ?: 'YesLovey',
                'address1'    => getenv('OPENSRS_CONTACT_ADDR')  ?: '123 Wedding Lane',
                'city'        => getenv('OPENSRS_CONTACT_CITY')  ?: 'Toronto',
                'state'       => getenv('OPENSRS_CONTACT_STATE') ?: 'ON',
                'postal_code' => getenv('OPENSRS_CONTACT_ZIP')   ?: 'M5V 2H1',
                'country'     => getenv('OPENSRS_CONTACT_COUNTRY') ?: 'CA',
                'phone'       => getenv('OPENSRS_CONTACT_PHONE') ?: '+1.5555551234',
                'email'       => $_SESSION['clerk_email'] ?? getenv('OPENSRS_CONTACT_EMAIL') ?: 'admin@yeslovey.com',
            ];

            $client = getOpenSrsClient();

            // Verify still available before registering
            $lookup = $client->lookupDomain($domain);
            if (($lookup['response_code'] ?? null) != 210) {
                echo json_encode(['success' => false, 'error' => 'Domain is no longer available. Please choose another.']);
                exit();
            }

            $result = $client->registerDomain($domain, $contact, 1);
            $code   = $result['response_code'] ?? null;

            if ($code != 200) {
                $text = $result['response_text'] ?? "code {$code}";
                throw new RuntimeException("Domain registration failed: {$text}");
            }

            error_log("Domain API register - SUCCESS: {$domain} registered for user {$clerkUserId}");
            echo json_encode([
                'success' => true,
                'domain'  => $domain,
                'url'     => 'https://' . $domain,
            ]);
            break;

        default:
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => "Unknown action: {$action}"]);
    }
} catch (InvalidArgumentException $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
} catch (Exception $e) {
    error_log("Domain API - ERROR: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
