<?php
/**
 * TEMPORARY DEBUG SCRIPT — DELETE AFTER DIAGNOSING
 * Checks whether the share_slug column exists and shows the current state
 * of a given page in user_pages.
 *
 * Usage: GET /api/debug-share-slug.php?page_id=cf8c15a3-1975-11f1-8b8f-d85ed359730c
 */

// Simple access guard — only accessible from localhost
$remoteAddr = $_SERVER['REMOTE_ADDR'] ?? '';
$serverName = $_SERVER['SERVER_NAME'] ?? '';
$isLocal = in_array($remoteAddr, ['127.0.0.1', '::1']) || preg_match('/^(localhost|127\.0\.0\.1)/', $serverName);
if (!$isLocal) {
    http_response_code(403);
    die(json_encode(['error' => 'Forbidden: debug endpoint only available on localhost']));
}

require_once __DIR__ . '/../config/database.php';

header('Content-Type: application/json; charset=utf-8');

$pageId = $_GET['page_id'] ?? null;

try {
    $pdo = getDatabaseConnection();

    // 1. Check if share_slug column exists in user_pages
    $stmt = $pdo->query("SHOW COLUMNS FROM `user_pages` LIKE 'share_slug'");
    $columnInfo = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $columnExists = !empty($columnInfo);

    // 2. Check if share_token column exists
    $stmt2 = $pdo->query("SHOW COLUMNS FROM `user_pages` LIKE 'share_token'");
    $tokenColInfo = $stmt2->fetchAll(PDO::FETCH_ASSOC);

    // 3. List all columns in user_pages
    $stmt3 = $pdo->query("SHOW COLUMNS FROM `user_pages`");
    $allColumns = array_column($stmt3->fetchAll(PDO::FETCH_ASSOC), 'Field');

    // 4. If a page_id is given, show its current sharing state
    $pageData = null;
    if ($pageId) {
        $cols = $columnExists
            ? 'id, is_public, share_token, share_slug'
            : 'id, is_public, share_token';
        $stmt4 = $pdo->prepare("SELECT {$cols} FROM `user_pages` WHERE `id` = ?");
        $stmt4->execute([$pageId]);
        $pageData = $stmt4->fetch(PDO::FETCH_ASSOC);
    }

    echo json_encode([
        'share_slug_column_exists' => $columnExists,
        'share_slug_column_definition' => $columnInfo[0] ?? null,
        'share_token_column_exists' => !empty($tokenColInfo),
        'all_user_pages_columns' => $allColumns,
        'page_data' => $pageData,
        'diagnosis' => $columnExists
            ? 'Column exists. If slug is null for the page, the UPDATE may have failed or targeted the wrong row.'
            : 'MIGRATION NOT APPLIED. Run: migrations/add_share_slug_to_user_pages.sql',
    ], JSON_PRETTY_PRINT);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()], JSON_PRETTY_PRINT);
}
