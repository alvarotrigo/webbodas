<?php
/**
 * OpenSRS Domain Lookup Test
 * Tests domain availability checking via the Horizon sandbox
 */

error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once __DIR__ . '/../config/env.php';
require_once __DIR__ . '/../src/OpenSrsClient.php';

$username = getenv('OPENSRS_USERNAME');
$testMode = strtolower(getenv('OPENSRS_TEST_MODE') ?: 'true') === 'true';
$apiKey   = $testMode ? getenv('OPENSRS_API_KEY_TEST') : getenv('OPENSRS_API_KEY');

echo "<h1>OpenSRS Domain Lookup Test</h1>\n";

if (empty($username) || empty($apiKey)) {
    echo "<p style='color: red;'>✗ OPENSRS_USERNAME and OPENSRS_API_KEY must be set in .env</p>\n";
    exit;
}

if ($testMode) {
    echo "<p style='background: #fff3cd; padding: 8px; border: 1px solid #ffc107; display: inline-block;'>SANDBOX MODE (Horizon)</p>\n";
}

$client = new OpenSrsClient($username, $apiKey, $testMode);

// ── Test 1: Known taken domain ──────────────────────────────────
echo "<h2>Test 1: Lookup google.com (should be taken)</h2>\n";
try {
    $result = $client->lookupDomain('google.com');
    $code = $result['response_code'] ?? 'N/A';
    $text = $result['response_text'] ?? '';

    if ($code == 211) {
        echo "<p style='color: green;'>✓ google.com is taken (response_code {$code})</p>\n";
    } else {
        echo "<p style='color: red;'>✗ Unexpected response_code: {$code} — {$text}</p>\n";
    }
    echo "<details><summary>Raw response</summary><pre>" . htmlspecialchars(print_r($result, true)) . "</pre></details>\n";
} catch (Exception $e) {
    echo "<p style='color: red;'>✗ Error: " . htmlspecialchars($e->getMessage()) . "</p>\n";
}

// ── Test 2: Random domain (should be available) ─────────────────
$randomDomain = 'wbtest' . substr(md5((string)mt_rand()), 0, 12) . '.com';
echo "<h2>Test 2: Lookup {$randomDomain} (should be available)</h2>\n";
try {
    $result = $client->lookupDomain($randomDomain);
    $code = $result['response_code'] ?? 'N/A';
    $text = $result['response_text'] ?? '';

    if ($code == 210) {
        echo "<p style='color: green;'>✓ {$randomDomain} is available (response_code {$code})</p>\n";
    } else {
        echo "<p style='color: orange;'>⚠ Unexpected response_code: {$code} — {$text}</p>\n";
    }
    echo "<details><summary>Raw response</summary><pre>" . htmlspecialchars(print_r($result, true)) . "</pre></details>\n";
} catch (Exception $e) {
    echo "<p style='color: red;'>✗ Error: " . htmlspecialchars($e->getMessage()) . "</p>\n";
}

// ── Test 3: Invalid domain ──────────────────────────────────────
echo "<h2>Test 3: Lookup invalid domain (error handling)</h2>\n";
try {
    $result = $client->lookupDomain('---invalid---');
    $code = $result['response_code'] ?? 'N/A';
    $text = $result['response_text'] ?? '';

    if ($code >= 400 || $code == 'N/A') {
        echo "<p style='color: green;'>✓ Server rejected invalid domain (response_code {$code})</p>\n";
    } else {
        echo "<p style='color: orange;'>⚠ Server returned response_code: {$code} — {$text}</p>\n";
    }
    echo "<details><summary>Raw response</summary><pre>" . htmlspecialchars(print_r($result, true)) . "</pre></details>\n";
} catch (Exception $e) {
    echo "<p style='color: green;'>✓ Exception caught: " . htmlspecialchars($e->getMessage()) . "</p>\n";
}

echo "<hr>\n";
echo "<p><small>Test completed at: " . date('Y-m-d H:i:s') . "</small></p>\n";
