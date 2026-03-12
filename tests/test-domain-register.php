<?php
/**
 * OpenSRS Domain Registration Test (Sandbox only)
 * Registers a test domain in the Horizon sandbox environment
 */

error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once __DIR__ . '/../config/env.php';
require_once __DIR__ . '/../src/OpenSrsClient.php';

$username = getenv('OPENSRS_USERNAME');
$testMode = strtolower(getenv('OPENSRS_TEST_MODE') ?: 'true') === 'true';
$apiKey   = $testMode ? getenv('OPENSRS_API_KEY_TEST') : getenv('OPENSRS_API_KEY');

echo "<h1>OpenSRS Domain Registration Test</h1>\n";

// ── Safety check ────────────────────────────────────────────────
if (!$testMode) {
    echo "<div style='background: #f8d7da; border: 2px solid #dc3545; padding: 16px; margin: 16px 0;'>";
    echo "<strong>REFUSED:</strong> This test only runs in sandbox mode. Set OPENSRS_TEST_MODE=true in .env";
    echo "</div>\n";
    exit;
}

echo "<div style='background: #fff3cd; border: 2px solid #ffc107; padding: 16px; margin: 16px 0; font-size: 1.2em;'>";
echo "<strong>⚠ SANDBOX MODE</strong> — Using Horizon test environment. No real charges.";
echo "</div>\n";

if (empty($username) || empty($apiKey)) {
    echo "<p style='color: red;'>✗ OPENSRS_USERNAME and OPENSRS_API_KEY must be set in .env</p>\n";
    exit;
}

$client = new OpenSrsClient($username, $apiKey, true);

// Dummy contact data (OpenSRS requires phone in +1.5555551234 format)
$contact = [
    'first_name'   => 'Test',
    'last_name'    => 'User',
    'org_name'     => 'WebBodas Test',
    'address1'     => '123 Test Street',
    'city'         => 'Toronto',
    'state'        => 'ON',
    'postal_code'  => 'M5V 2H1',
    'country'      => 'CA',
    'phone'        => '+1.5555551234',
    'email'        => 'test@webbodas.test',
];

// ── Test 1: Generate and verify available domain ────────────────
echo "<h2>Test 1: Find an available test domain</h2>\n";
$domain = null;
$maxRetries = 3;

for ($i = 0; $i < $maxRetries; $i++) {
    $candidate = 'wbtest' . substr(md5((string)time() . $i), 0, 8) . '.com';
    echo "<p>Checking: {$candidate}...</p>\n";

    try {
        $result = $client->lookupDomain($candidate);
        $code = $result['response_code'] ?? 'N/A';

        if ($code == 210) {
            echo "<p style='color: green;'>✓ {$candidate} is available</p>\n";
            $domain = $candidate;
            break;
        }
        echo "<p style='color: orange;'>⚠ {$candidate} is taken, retrying...</p>\n";
    } catch (Exception $e) {
        echo "<p style='color: red;'>✗ Lookup error: " . htmlspecialchars($e->getMessage()) . "</p>\n";
    }
}

if (!$domain) {
    echo "<p style='color: red;'>✗ Could not find an available domain after {$maxRetries} attempts</p>\n";
    exit;
}

// ── Test 2: Register the domain ─────────────────────────────────
echo "<h2>Test 2: Register {$domain}</h2>\n";
try {
    $result = $client->registerDomain($domain, $contact, 1);
    $code = $result['response_code'] ?? 'N/A';
    $text = $result['response_text'] ?? '';

    if ($code == 200) {
        echo "<p style='color: green;'>✓ Registration successful! (response_code {$code})</p>\n";
    } else {
        echo "<p style='color: orange;'>⚠ response_code: {$code} — {$text}</p>\n";
    }

    echo "<details><summary>Raw response</summary><pre>" . htmlspecialchars(print_r($result, true)) . "</pre></details>\n";
} catch (Exception $e) {
    echo "<p style='color: red;'>✗ Registration error: " . htmlspecialchars($e->getMessage()) . "</p>\n";
    echo "<hr>\n<p><small>Test completed at: " . date('Y-m-d H:i:s') . "</small></p>\n";
    exit;
}

// ── Test 3: Verify domain is now taken ──────────────────────────
echo "<h2>Test 3: Verify {$domain} is now taken</h2>\n";
try {
    $result = $client->lookupDomain($domain);
    $code = $result['response_code'] ?? 'N/A';

    if ($code == 211) {
        echo "<p style='color: green;'>✓ {$domain} now shows as taken (response_code {$code})</p>\n";
    } else {
        echo "<p style='color: orange;'>⚠ response_code: {$code} — domain may take time to propagate</p>\n";
    }

    echo "<details><summary>Raw response</summary><pre>" . htmlspecialchars(print_r($result, true)) . "</pre></details>\n";
} catch (Exception $e) {
    echo "<p style='color: red;'>✗ Verification error: " . htmlspecialchars($e->getMessage()) . "</p>\n";
}

echo "<hr>\n";
echo "<p><small>Test completed at: " . date('Y-m-d H:i:s') . "</small></p>\n";
