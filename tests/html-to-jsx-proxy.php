<?php
/**
 * HTML to JSX Proxy
 * Proxies requests to Node.js service to avoid CORS issues
 */

header('Content-Type: application/json');

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed. Use POST.']);
    exit;
}

// Get POST data
$input = json_decode(file_get_contents('php://input'), true);

if (!$input || !isset($input['html'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid input. HTML required.']);
    exit;
}

$html = $input['html'];
$nodeServiceUrl = 'http://localhost:3000/html-to-jsx';

// Prepare payload
$payload = json_encode([
    'html' => $html
]);

// Initialize cURL
$ch = curl_init($nodeServiceUrl);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'Content-Length: ' . strlen($payload)
]);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);

// Execute request
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);

// Check for errors
if ($curlError) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Failed to connect to Node.js service',
        'details' => $curlError,
        'service_url' => $nodeServiceUrl
    ]);
    exit;
}

if ($httpCode !== 200) {
    http_response_code($httpCode);
    echo json_encode([
        'error' => 'Node.js service returned error',
        'http_code' => $httpCode,
        'response' => $response
    ]);
    exit;
}

// Return the response
echo $response;
?>


