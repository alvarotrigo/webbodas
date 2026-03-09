<?php
/**
 * RSVP Form Submission Endpoint
 * Receives form submissions from published wedding websites (no auth required).
 * Rate limited: max 5 submissions per IP per page within 1 hour.
 */

error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/../errors.txt');

require_once __DIR__ . '/../config/mysql-client.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit();
}

try {
    $body = file_get_contents('php://input');
    $data = json_decode($body, true);

    if (!$data || !isset($data['page_id']) || !isset($data['form_data'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing required fields: page_id and form_data']);
        exit();
    }

    $pageId   = trim($data['page_id']);
    $formData = $data['form_data'];

    if (empty($pageId) || !is_array($formData)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid page_id or form_data']);
        exit();
    }

    $db = getMySQLClient();

    // Verify the page exists and is public
    $pdo = getDatabaseConnection();
    $stmt = $pdo->prepare(
        "SELECT id, form_open, form_closed_message FROM user_pages WHERE id = ? AND is_public = 1 LIMIT 1"
    );
    $stmt->execute([$pageId]);
    $page = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$page) {
        http_response_code(404);
        echo json_encode(['error' => 'Page not found or not public']);
        exit();
    }

    // Check if the form is still accepting submissions
    // form_open column may not exist yet if migration hasn't run; default to open (1)
    $formOpen = isset($page['form_open']) ? (bool)$page['form_open'] : true;
    if (!$formOpen) {
        $closedMessage = $page['form_closed_message'] ?? 'This form is no longer accepting responses.';
        http_response_code(422);
        echo json_encode(['error' => 'form_closed', 'message' => $closedMessage]);
        exit();
    }

    // Rate limiting: max 5 submissions per IP per page in the last hour
    $ipAddress = getClientIp();
    $rateStmt = $pdo->prepare(
        "SELECT COUNT(*) as cnt FROM form_submissions
         WHERE page_id = ? AND ip_address = ?
           AND submitted_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)"
    );
    $rateStmt->execute([$pageId, $ipAddress]);
    $rate = $rateStmt->fetch(PDO::FETCH_ASSOC);

    if ($rate && (int)$rate['cnt'] >= 5) {
        http_response_code(429);
        echo json_encode(['error' => 'Too many submissions. Please try again later.']);
        exit();
    }

    // Sanitize form data values (strip tags, trim)
    $sanitized = [];
    foreach ($formData as $key => $value) {
        $cleanKey = htmlspecialchars(strip_tags(trim((string)$key)), ENT_QUOTES, 'UTF-8');
        if (is_string($value)) {
            $sanitized[$cleanKey] = htmlspecialchars(strip_tags(trim($value)), ENT_QUOTES, 'UTF-8');
        } elseif (is_numeric($value)) {
            $sanitized[$cleanKey] = $value;
        } else {
            $sanitized[$cleanKey] = htmlspecialchars(strip_tags(trim((string)$value)), ENT_QUOTES, 'UTF-8');
        }
    }

    // Insert submission
    $insertStmt = $pdo->prepare(
        "INSERT INTO form_submissions (page_id, form_data, ip_address, user_agent)
         VALUES (?, ?, ?, ?)"
    );
    $insertStmt->execute([
        $pageId,
        json_encode($sanitized, JSON_UNESCAPED_UNICODE),
        $ipAddress,
        substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 500)
    ]);

    echo json_encode(['success' => true, 'message' => 'RSVP received successfully']);

} catch (Exception $e) {
    error_log('form-submit.php error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Server error. Please try again.']);
}

/**
 * Get the real client IP address (handles proxies/load balancers)
 */
function getClientIp(): string {
    $headers = [
        'HTTP_CF_CONNECTING_IP',   // Cloudflare
        'HTTP_X_REAL_IP',
        'HTTP_X_FORWARDED_FOR',
        'REMOTE_ADDR'
    ];

    foreach ($headers as $header) {
        if (!empty($_SERVER[$header])) {
            $ip = trim(explode(',', $_SERVER[$header])[0]);
            if (filter_var($ip, FILTER_VALIDATE_IP)) {
                return $ip;
            }
        }
    }

    return '0.0.0.0';
}
