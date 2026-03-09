<?php
/**
 * RSVP Submissions API
 * Private API for managing form submissions. Requires Clerk authentication.
 *
 * GET    ?page_id=X[&limit=50&offset=0]  — list submissions for a page
 * GET    action=export&page_id=X         — export submissions as CSV
 * GET    action=list-groups&page_id=X    — list guest groups for a page
 * PUT                                    — update a submission (notes / form_data / table_number / group_id)
 * PUT    action=update-group             — update a guest group (name / color)
 * DELETE ?id=X                           — delete a submission
 * DELETE action=delete-group&id=X        — delete a guest group
 * POST   action=toggle-form              — open / close the RSVP form
 * POST   action=create-access-link       — create a shareable dashboard link
 * POST   action=create-group             — create a guest group
 */

error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/../errors.txt');

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

require_once __DIR__ . '/../includes/clerk-auth.php';
require_once __DIR__ . '/../config/mysql-client.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . ($_SERVER['HTTP_ORIGIN'] ?? '*'));
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// -----------------------------------------------------------------------
// Authentication: require a valid Clerk session
// -----------------------------------------------------------------------
$serverUserData = syncClerkSession();
if (!$serverUserData && isUserAuthenticated()) {
    $serverUserData = clerk_session_user_payload();
}

$isAuthenticated = $serverUserData['authenticated'] ?? false;
$clerkUserId     = $serverUserData['clerk_user_id'] ?? ($_SESSION['clerk_user_id'] ?? null);

if (!$isAuthenticated || !$clerkUserId) {
    // Check dashboard access token (for shared access links)
    $accessToken = $_GET['access_token'] ?? (getRequestBody()['access_token'] ?? null);
    if (!$accessToken || !validateAccessToken($accessToken)) {
        http_response_code(401);
        echo json_encode(['error' => 'Authentication required']);
        exit();
    }
}

// -----------------------------------------------------------------------
// Resolve internal user ID
// -----------------------------------------------------------------------
$pdo    = getDatabaseConnection();
$userId = null;

if ($clerkUserId) {
    $stmt = $pdo->prepare("SELECT id FROM users WHERE clerk_user_id = ? LIMIT 1");
    $stmt->execute([$clerkUserId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    $userId = $row['id'] ?? null;
}

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? (getRequestBody()['action'] ?? '');

// -----------------------------------------------------------------------
// Route requests
// -----------------------------------------------------------------------
try {
    switch ($method) {
        case 'GET':
            if ($action === 'export') {
                handleExport();
            } elseif ($action === 'list-groups') {
                handleListGroups();
            } else {
                handleList();
            }
            break;
        case 'POST':
            if ($action === 'toggle-form') {
                handleToggleForm();
            } elseif ($action === 'create-access-link') {
                handleCreateAccessLink();
            } elseif ($action === 'create-group') {
                handleCreateGroup();
            } else {
                http_response_code(400);
                echo json_encode(['error' => 'Unknown action']);
            }
            break;
        case 'PUT':
            if ($action === 'update-group') {
                handleUpdateGroup();
            } else {
                handleUpdate();
            }
            break;
        case 'DELETE':
            if ($action === 'delete-group') {
                handleDeleteGroup();
            } else {
                handleDelete();
            }
            break;
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
} catch (Exception $e) {
    error_log('submissions.php error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Server error: ' . $e->getMessage()]);
}

// -----------------------------------------------------------------------
// Handlers
// -----------------------------------------------------------------------

/**
 * GET ?page_id=X[&limit=50&offset=0]
 * Returns submissions + summary stats for a page the user owns.
 */
function handleList(): void {
    global $pdo, $userId;

    $pageId = trim($_GET['page_id'] ?? '');
    if (!$pageId) {
        http_response_code(400);
        echo json_encode(['error' => 'page_id is required']);
        exit();
    }

    verifyPageOwnership($pageId);

    $limit  = max(1, min(500, (int)($_GET['limit']  ?? 100)));
    $offset = max(0, (int)($_GET['offset'] ?? 0));

    $stmt = $pdo->prepare(
        "SELECT id, form_data, notes, table_number, group_id, ip_address, submitted_at, updated_at
         FROM form_submissions
         WHERE page_id = ?
         ORDER BY submitted_at DESC
         LIMIT ? OFFSET ?"
    );
    $stmt->execute([$pageId, $limit, $offset]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Count total
    $cntStmt = $pdo->prepare("SELECT COUNT(*) as total FROM form_submissions WHERE page_id = ?");
    $cntStmt->execute([$pageId]);
    $total = (int)($cntStmt->fetch(PDO::FETCH_ASSOC)['total'] ?? 0);

    // Get page form_open state
    $pageStmt = $pdo->prepare("SELECT form_open, form_closed_message, title FROM user_pages WHERE id = ? LIMIT 1");
    $pageStmt->execute([$pageId]);
    $page = $pageStmt->fetch(PDO::FETCH_ASSOC);

    // Decode form_data JSON strings; cast group_id to int or null
    foreach ($rows as &$row) {
        if (is_string($row['form_data'])) {
            $row['form_data'] = json_decode($row['form_data'], true) ?? [];
        }
        $row['group_id'] = $row['group_id'] !== null ? (int)$row['group_id'] : null;
    }
    unset($row);

    // Fetch guest groups for this page
    $grpStmt = $pdo->prepare("SELECT id, name, color FROM guest_groups WHERE page_id = ? ORDER BY name ASC");
    $grpStmt->execute([$pageId]);
    $groups = $grpStmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($groups as &$g) { $g['id'] = (int)$g['id']; }
    unset($g);

    echo json_encode([
        'success'     => true,
        'submissions' => $rows,
        'total'       => $total,
        'form_open'   => isset($page['form_open']) ? (bool)$page['form_open'] : true,
        'form_closed_message' => $page['form_closed_message'] ?? null,
        'page_title'  => $page['title'] ?? '',
        'groups'      => $groups,
    ]);
}

/**
 * PUT body: { id, notes?, form_data? }
 * Update notes or form_data of a submission owned by the user.
 */
function handleUpdate(): void {
    global $pdo;

    $body = getRequestBody();
    $id   = (int)($body['id'] ?? 0);

    if (!$id) {
        http_response_code(400);
        echo json_encode(['error' => 'id is required']);
        exit();
    }

    // Verify ownership via page_id → user ownership
    $ownerStmt = $pdo->prepare(
        "SELECT fs.id, fs.page_id FROM form_submissions fs
         JOIN user_pages up ON up.id = fs.page_id
         JOIN users u ON u.id = up.user_id
         WHERE fs.id = ? LIMIT 1"
    );
    $ownerStmt->execute([$id]);
    $submission = $ownerStmt->fetch(PDO::FETCH_ASSOC);

    if (!$submission) {
        http_response_code(404);
        echo json_encode(['error' => 'Submission not found']);
        exit();
    }

    verifyPageOwnership($submission['page_id']);

    $sets  = [];
    $params = [];

    if (array_key_exists('notes', $body)) {
        $sets[]          = 'notes = :notes';
        $params[':notes'] = $body['notes'] !== null ? trim($body['notes']) : null;
    }

    if (array_key_exists('form_data', $body) && is_array($body['form_data'])) {
        $sets[]             = 'form_data = :form_data';
        $params[':form_data'] = json_encode($body['form_data'], JSON_UNESCAPED_UNICODE);
    }

    if (array_key_exists('table_number', $body)) {
        $tn = $body['table_number'] !== null ? trim((string)$body['table_number']) : null;
        $sets[]                = 'table_number = :table_number';
        $params[':table_number'] = ($tn !== '') ? $tn : null;
    }

    if (array_key_exists('group_id', $body)) {
        $gid = $body['group_id'] !== null ? (int)$body['group_id'] : null;
        if ($gid !== null) {
            // Verify the group belongs to the same page
            $gStmt = $pdo->prepare("SELECT id FROM guest_groups WHERE id = ? AND page_id = ? LIMIT 1");
            $gStmt->execute([$gid, $submission['page_id']]);
            if (!$gStmt->fetch()) {
                http_response_code(400);
                echo json_encode(['error' => 'Invalid group for this page']);
                exit();
            }
        }
        $sets[]           = 'group_id = :group_id';
        $params[':group_id'] = $gid;
    }

    if (empty($sets)) {
        http_response_code(400);
        echo json_encode(['error' => 'Nothing to update']);
        exit();
    }

    $params[':id'] = $id;
    $stmt = $pdo->prepare("UPDATE form_submissions SET " . implode(', ', $sets) . " WHERE id = :id");
    $stmt->execute($params);

    echo json_encode(['success' => true]);
}

/**
 * DELETE ?id=X
 */
function handleDelete(): void {
    global $pdo;

    $id = (int)($_GET['id'] ?? 0);
    if (!$id) {
        http_response_code(400);
        echo json_encode(['error' => 'id is required']);
        exit();
    }

    $ownerStmt = $pdo->prepare(
        "SELECT fs.page_id FROM form_submissions fs WHERE fs.id = ? LIMIT 1"
    );
    $ownerStmt->execute([$id]);
    $submission = $ownerStmt->fetch(PDO::FETCH_ASSOC);

    if (!$submission) {
        http_response_code(404);
        echo json_encode(['error' => 'Submission not found']);
        exit();
    }

    verifyPageOwnership($submission['page_id']);

    $stmt = $pdo->prepare("DELETE FROM form_submissions WHERE id = ?");
    $stmt->execute([$id]);

    echo json_encode(['success' => true]);
}

/**
 * POST action=toggle-form  body: { page_id, form_open, form_closed_message? }
 */
function handleToggleForm(): void {
    global $pdo;

    $body       = getRequestBody();
    $pageId     = trim($body['page_id'] ?? '');
    $formOpen   = isset($body['form_open']) ? (bool)$body['form_open'] : true;
    $closedMsg  = isset($body['form_closed_message']) ? trim($body['form_closed_message']) : null;

    if (!$pageId) {
        http_response_code(400);
        echo json_encode(['error' => 'page_id is required']);
        exit();
    }

    verifyPageOwnership($pageId);

    $stmt = $pdo->prepare(
        "UPDATE user_pages SET form_open = ?, form_closed_message = ? WHERE id = ?"
    );
    $stmt->execute([(int)$formOpen, $closedMsg, $pageId]);

    echo json_encode(['success' => true, 'form_open' => $formOpen]);
}

/**
 * POST action=create-access-link  body: { page_id, email? }
 * Creates a private dashboard access link for a collaborator (e.g. the partner).
 */
function handleCreateAccessLink(): void {
    global $pdo, $userId;

    $body   = getRequestBody();
    $pageId = trim($body['page_id'] ?? '');
    $email  = isset($body['email']) ? trim($body['email']) : null;

    if (!$pageId) {
        http_response_code(400);
        echo json_encode(['error' => 'page_id is required']);
        exit();
    }

    verifyPageOwnership($pageId);

    $token = generateUUID();

    $stmt = $pdo->prepare(
        "INSERT INTO dashboard_access_links (page_id, access_token, email, created_by)
         VALUES (?, ?, ?, ?)"
    );
    $stmt->execute([$pageId, $token, $email, $userId]);

    $baseDomain = getenv('APP_URL') ?: getenv('SHARE_BASE_DOMAIN') ?: '';
    if ($baseDomain && !str_starts_with($baseDomain, 'http')) {
        $baseDomain = 'https://' . $baseDomain;
    }
    $dashboardUrl = $baseDomain . '/rsvp?page=' . urlencode($pageId) . '&access_token=' . urlencode($token);

    echo json_encode([
        'success'  => true,
        'token'    => $token,
        'url'      => $dashboardUrl,
    ]);
}

/**
 * GET action=export&page_id=X
 * Streams a CSV file with all submissions.
 */
function handleExport(): void {
    global $pdo;

    $pageId = trim($_GET['page_id'] ?? '');
    if (!$pageId) {
        http_response_code(400);
        echo json_encode(['error' => 'page_id is required']);
        exit();
    }

    verifyPageOwnership($pageId);

    $stmt = $pdo->prepare(
        "SELECT fs.form_data, fs.notes, fs.table_number, gg.name AS group_name, fs.submitted_at
         FROM form_submissions fs
         LEFT JOIN guest_groups gg ON gg.id = fs.group_id
         WHERE fs.page_id = ?
         ORDER BY fs.submitted_at ASC"
    );
    $stmt->execute([$pageId]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Collect all field keys across all submissions for consistent columns
    $allKeys = [];
    $decoded = [];
    foreach ($rows as $row) {
        $fd = is_string($row['form_data']) ? (json_decode($row['form_data'], true) ?? []) : ($row['form_data'] ?? []);
        $decoded[] = [
            'form_data'    => $fd,
            'notes'        => $row['notes'],
            'table_number' => $row['table_number'],
            'group_name'   => $row['group_name'],
            'submitted_at' => $row['submitted_at'],
        ];
        foreach (array_keys($fd) as $k) {
            if (!in_array($k, $allKeys)) $allKeys[] = $k;
        }
    }

    $pageStmt = $pdo->prepare("SELECT title FROM user_pages WHERE id = ? LIMIT 1");
    $pageStmt->execute([$pageId]);
    $pageTitle = $pageStmt->fetchColumn() ?: 'rsvp';
    $filename  = 'rsvp_' . preg_replace('/[^a-zA-Z0-9_-]/', '_', $pageTitle) . '_' . date('Ymd') . '.csv';

    // Output CSV
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Cache-Control: no-cache');

    $out = fopen('php://output', 'w');
    fprintf($out, chr(0xEF) . chr(0xBB) . chr(0xBF)); // UTF-8 BOM for Excel

    // Header row — Table Number and Group first for seating-plan use
    $headers = array_merge($allKeys, ['Table Number', 'Group', 'Notes', 'Submitted At']);
    fputcsv($out, $headers);

    // Data rows
    foreach ($decoded as $item) {
        $csvRow = [];
        foreach ($allKeys as $k) {
            $csvRow[] = $item['form_data'][$k] ?? '';
        }
        $csvRow[] = $item['table_number'] ?? '';
        $csvRow[] = $item['group_name']   ?? '';
        $csvRow[] = $item['notes']        ?? '';
        $csvRow[] = $item['submitted_at'] ?? '';
        fputcsv($out, $csvRow);
    }

    fclose($out);
    exit();
}

// -----------------------------------------------------------------------
// Guest group handlers
// -----------------------------------------------------------------------

/**
 * GET action=list-groups&page_id=X
 */
function handleListGroups(): void {
    global $pdo;

    $pageId = trim($_GET['page_id'] ?? '');
    if (!$pageId) {
        http_response_code(400);
        echo json_encode(['error' => 'page_id is required']);
        exit();
    }

    verifyPageOwnership($pageId);

    $stmt = $pdo->prepare("SELECT id, name, color FROM guest_groups WHERE page_id = ? ORDER BY name ASC");
    $stmt->execute([$pageId]);
    $groups = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($groups as &$g) { $g['id'] = (int)$g['id']; }
    unset($g);

    echo json_encode(['success' => true, 'groups' => $groups]);
}

/**
 * POST action=create-group  body: { page_id, name, color? }
 */
function handleCreateGroup(): void {
    global $pdo;

    $body   = getRequestBody();
    $pageId = trim($body['page_id'] ?? '');
    $name   = trim($body['name'] ?? '');
    $color  = trim($body['color'] ?? '#9333ea');

    if (!$pageId || !$name) {
        http_response_code(400);
        echo json_encode(['error' => 'page_id and name are required']);
        exit();
    }

    verifyPageOwnership($pageId);

    if (!preg_match('/^#[0-9a-fA-F]{6}$/', $color)) $color = '#9333ea';

    $stmt = $pdo->prepare("INSERT INTO guest_groups (page_id, name, color) VALUES (?, ?, ?)");
    $stmt->execute([$pageId, $name, $color]);
    $id = (int)$pdo->lastInsertId();

    echo json_encode(['success' => true, 'group' => ['id' => $id, 'name' => $name, 'color' => $color]]);
}

/**
 * PUT action=update-group  body: { id, name?, color? }
 */
function handleUpdateGroup(): void {
    global $pdo;

    $body = getRequestBody();
    $id   = (int)($body['id'] ?? 0);

    if (!$id) {
        http_response_code(400);
        echo json_encode(['error' => 'id is required']);
        exit();
    }

    $stmt = $pdo->prepare("SELECT page_id FROM guest_groups WHERE id = ? LIMIT 1");
    $stmt->execute([$id]);
    $grp = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$grp) {
        http_response_code(404);
        echo json_encode(['error' => 'Group not found']);
        exit();
    }

    verifyPageOwnership($grp['page_id']);

    $sets = []; $params = [];

    if (array_key_exists('name', $body) && trim($body['name']) !== '') {
        $sets[] = 'name = :name';
        $params[':name'] = trim($body['name']);
    }
    if (array_key_exists('color', $body)) {
        $color = trim($body['color']);
        if (preg_match('/^#[0-9a-fA-F]{6}$/', $color)) {
            $sets[] = 'color = :color';
            $params[':color'] = $color;
        }
    }

    if (empty($sets)) {
        http_response_code(400);
        echo json_encode(['error' => 'Nothing to update']);
        exit();
    }

    $params[':id'] = $id;
    $pdo->prepare("UPDATE guest_groups SET " . implode(', ', $sets) . " WHERE id = :id")->execute($params);

    echo json_encode(['success' => true]);
}

/**
 * DELETE action=delete-group&id=X
 * Unassigns all submissions from the group, then deletes it.
 */
function handleDeleteGroup(): void {
    global $pdo;

    $id = (int)($_GET['id'] ?? 0);
    if (!$id) {
        http_response_code(400);
        echo json_encode(['error' => 'id is required']);
        exit();
    }

    $stmt = $pdo->prepare("SELECT page_id FROM guest_groups WHERE id = ? LIMIT 1");
    $stmt->execute([$id]);
    $grp = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$grp) {
        http_response_code(404);
        echo json_encode(['error' => 'Group not found']);
        exit();
    }

    verifyPageOwnership($grp['page_id']);

    // Unassign all submissions before deletion
    $pdo->prepare("UPDATE form_submissions SET group_id = NULL WHERE group_id = ?")->execute([$id]);
    $pdo->prepare("DELETE FROM guest_groups WHERE id = ?")->execute([$id]);

    echo json_encode(['success' => true]);
}

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

function verifyPageOwnership(string $pageId): void {
    global $pdo, $userId, $clerkUserId;

    // If authenticated via access token, skip ownership check
    if (!$clerkUserId) return;

    if (!$userId) {
        http_response_code(403);
        echo json_encode(['error' => 'Access denied']);
        exit();
    }

    $stmt = $pdo->prepare(
        "SELECT id FROM user_pages WHERE id = ? AND user_id = ? LIMIT 1"
    );
    $stmt->execute([$pageId, $userId]);
    if (!$stmt->fetch()) {
        http_response_code(403);
        echo json_encode(['error' => 'Access denied: page not found or not owned by you']);
        exit();
    }
}

function validateAccessToken(string $token): bool {
    global $pdo;

    $stmt = $pdo->prepare(
        "SELECT id FROM dashboard_access_links
         WHERE access_token = ? AND is_active = 1
           AND (expires_at IS NULL OR expires_at > NOW())
         LIMIT 1"
    );
    $stmt->execute([$token]);
    return (bool)$stmt->fetch();
}

function getRequestBody(): array {
    static $cache = null;
    if ($cache !== null) return $cache;
    $raw = file_get_contents('php://input');
    $cache = json_decode($raw, true) ?? [];
    return $cache;
}

function generateUUID(): string {
    try {
        $pdo2 = getDatabaseConnection();
        $r    = $pdo2->query("SELECT UUID() as u")->fetch(PDO::FETCH_ASSOC);
        if (!empty($r['u'])) return $r['u'];
    } catch (Exception $e) {}
    $d = random_bytes(16);
    $d[6] = chr(ord($d[6]) & 0x0f | 0x40);
    $d[8] = chr(ord($d[8]) & 0x3f | 0x80);
    return sprintf('%08s-%04s-%04s-%04s-%012s',
        bin2hex(substr($d, 0, 4)), bin2hex(substr($d, 4, 2)),
        bin2hex(substr($d, 6, 2)), bin2hex(substr($d, 8, 2)),
        bin2hex(substr($d, 10, 6)));
}

if (!function_exists('str_starts_with')) {
    function str_starts_with(string $h, string $n): bool {
        return $n === '' || strncmp($h, $n, strlen($n)) === 0;
    }
}
