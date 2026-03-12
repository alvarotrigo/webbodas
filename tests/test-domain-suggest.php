<?php
/**
 * OpenSRS Domain Suggestions Test
 * Tests the NAME_SUGGEST API via the Horizon sandbox
 */

error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once __DIR__ . '/../config/env.php';
require_once __DIR__ . '/../src/OpenSrsClient.php';

$username = getenv('OPENSRS_USERNAME');
$testMode = strtolower(getenv('OPENSRS_TEST_MODE') ?: 'true') === 'true';
$apiKey   = $testMode ? getenv('OPENSRS_API_KEY_TEST') : getenv('OPENSRS_API_KEY');

echo "<h1>OpenSRS Domain Suggestions Test</h1>\n";

if (empty($username) || empty($apiKey)) {
    echo "<p style='color: red;'>✗ OPENSRS_USERNAME and OPENSRS_API_KEY must be set in .env</p>\n";
    exit;
}

if ($testMode) {
    echo "<p style='background: #fff3cd; padding: 8px; border: 1px solid #ffc107; display: inline-block;'>SANDBOX MODE (Horizon)</p>\n";
}

$client = new OpenSrsClient($username, $apiKey, $testMode);

/**
 * Run a suggestion test and display results
 */
function runSuggestTest(OpenSrsClient $client, string $query, int $testNum): void
{
    echo "<h2>Test {$testNum}: Suggestions for \"{$query}\"</h2>\n";

    try {
        $result = $client->suggestDomains($query, ['.com']);
        $code = $result['response_code'] ?? 'N/A';

        if ($code != 200) {
            echo "<p style='color: red;'>✗ Unexpected response_code: {$code}</p>\n";
            echo "<pre>" . htmlspecialchars(print_r($result, true)) . "</pre>\n";
            return;
        }

        // Extract suggestions from the nested response
        $suggestions = $result['attributes']['lookup']['items'] ?? $result['attributes']['lookup'] ?? [];

        if (empty($suggestions)) {
            // Try alternate response structures
            $suggestions = $result['attributes']['suggestion']['items'] ?? $result['attributes']['suggestion'] ?? [];
        }

        $available = 0;
        $taken = 0;
        $premium = 0;

        echo "<table border='1' style='border-collapse: collapse; width: 100%; max-width: 600px;'>\n";
        echo "<tr><th style='padding: 4px 8px;'>Domain</th><th style='padding: 4px 8px;'>Status</th></tr>\n";

        foreach ($suggestions as $key => $item) {
            $domain = is_array($item) ? ($item['domain'] ?? $key) : $item;
            $status = is_array($item) ? ($item['status'] ?? 'unknown') : 'unknown';

            // Skip premium domains
            if (is_array($item) && !empty($item['is_premium'])) {
                $premium++;
                continue;
            }

            $color = ($status === 'available') ? 'green' : 'gray';
            if ($status === 'available') {
                $available++;
            } else {
                $taken++;
            }

            echo "<tr>";
            echo "<td style='padding: 4px 8px;'>" . htmlspecialchars((string)$domain) . "</td>";
            echo "<td style='padding: 4px 8px; color: {$color};'>" . htmlspecialchars($status) . "</td>";
            echo "</tr>\n";
        }

        echo "</table>\n";
        echo "<p>Available: {$available} | Taken: {$taken} | Premium (filtered): {$premium}</p>\n";

        echo "<details><summary>Raw response</summary><pre>" . htmlspecialchars(print_r($result, true)) . "</pre></details>\n";

    } catch (Exception $e) {
        echo "<p style='color: red;'>✗ Error: " . htmlspecialchars($e->getMessage()) . "</p>\n";
    }
}

// ── Test 1 ──────────────────────────────────────────────────────
runSuggestTest($client, 'alexandjamie', 1);

// ── Test 2 ──────────────────────────────────────────────────────
runSuggestTest($client, 'wedding', 2);

// ── Test 3: Multi-word query ────────────────────────────────────
runSuggestTest($client, 'alex and jamie wedding', 3);

echo "<hr>\n";
echo "<p><small>Test completed at: " . date('Y-m-d H:i:s') . "</small></p>\n";
