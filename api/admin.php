<?php
/**
 * Admin API
 * JSON API for user search, pagination, and user detail
 */

// Start session early
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

require_once __DIR__ . '/../includes/clerk-auth.php';
require_once __DIR__ . '/../config/database.php';

// Set JSON header
header('Content-Type: application/json');

// Admin auth check
$serverUserData = syncClerkSession();
if (!$serverUserData && isUserAuthenticated()) {
    $serverUserData = clerk_session_user_payload();
}

$isAuthenticated = $serverUserData['authenticated'] ?? false;
$userEmail       = $serverUserData['email'] ?? null;

$adminEmail = getenv('ADMIN_EMAIL') ?: '';
$isAdmin = $isAuthenticated && $userEmail && ($userEmail === $adminEmail);

if (!$isAdmin) {
    http_response_code(403);
    echo json_encode(['error' => 'Forbidden']);
    exit;
}

$action = $_GET['action'] ?? '';

try {
    $pdo = getDatabaseConnection();

    // ===================================
    // ACTION: users - Search and list users with pagination
    // ===================================
    if ($action === 'users') {
        $search = $_GET['search'] ?? '';
        $filter = $_GET['filter'] ?? 'all'; // all, free, pro
        $page = max(1, (int) ($_GET['page'] ?? 1));
        $perPage = 25;
        $offset = ($page - 1) * $perPage;

        error_log("Admin users API - search: '$search', filter: '$filter', page: $page");

        // Build WHERE clause
        $where = [];
        $params = [];

        if ($search !== '') {
            $where[] = "(u.email LIKE :search_email OR u.name LIKE :search_name)";
            $params['search_email'] = '%' . $search . '%';
            $params['search_name'] = '%' . $search . '%';
        }

        if ($filter === 'free') {
            $where[] = "u.is_pro = 0";
        } elseif ($filter === 'pro') {
            $where[] = "u.is_pro = 1";
        }

        $whereClause = !empty($where) ? 'WHERE ' . implode(' AND ', $where) : '';

        error_log("Admin users API - WHERE clause: $whereClause");
        error_log("Admin users API - params: " . json_encode($params));

        // Get total count
        $countSql = "SELECT COUNT(*) as count FROM users u $whereClause";
        error_log("Admin users API - count SQL: $countSql");
        $stmt = $pdo->prepare($countSql);
        $stmt->execute($params);
        $totalUsers = (int) $stmt->fetch()['count'];
        error_log("Admin users API - total users: $totalUsers");

        // Get users - use subquery instead of GROUP BY with all columns
        $sql = "
            SELECT
                u.id,
                u.email,
                u.name,
                u.is_pro,
                u.last_login,
                u.created_at,
                (SELECT COUNT(*) FROM user_pages WHERE user_id = u.id) as pages_count
            FROM users u
            $whereClause
            ORDER BY u.created_at DESC
            LIMIT $perPage OFFSET $offset
        ";

        error_log("Admin users API - main SQL: $sql");
        $stmt = $pdo->prepare($sql);

        // Execute with search params only (limit/offset already in SQL)
        error_log("Admin users API - executing with params: " . json_encode($params));
        $stmt->execute($params);

        $users = $stmt->fetchAll();
        error_log("Admin users API - found " . count($users) . " users");

        echo json_encode([
            'success' => true,
            'users' => $users,
            'pagination' => [
                'page' => $page,
                'per_page' => $perPage,
                'total' => $totalUsers,
                'total_pages' => (int) ceil($totalUsers / $perPage)
            ]
        ]);
        exit;
    }

    // ===================================
    // ACTION: user-detail - Get user info + their pages
    // ===================================
    if ($action === 'user-detail') {
        $userId = (int) ($_GET['user_id'] ?? 0);

        if ($userId <= 0) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid user_id']);
            exit;
        }

        // Get user info
        $stmt = $pdo->prepare("
            SELECT id, email, name, is_pro, last_login, created_at, clerk_user_id
            FROM users
            WHERE id = :userId
        ");
        $stmt->execute(['userId' => $userId]);
        $user = $stmt->fetch();

        if (!$user) {
            http_response_code(404);
            echo json_encode(['error' => 'User not found']);
            exit;
        }

        // Get user's pages
        $stmt = $pdo->prepare("
            SELECT id, title, thumbnail_url, is_public, created_at, last_accessed
            FROM user_pages
            WHERE user_id = :userId
            ORDER BY last_accessed DESC
        ");
        $stmt->execute(['userId' => $userId]);
        $pages = $stmt->fetchAll();

        echo json_encode([
            'success' => true,
            'user' => $user,
            'pages' => $pages
        ]);
        exit;
    }

    // Invalid action
    http_response_code(400);
    echo json_encode(['error' => 'Invalid action']);

} catch (Exception $e) {
    error_log("Admin API error: " . $e->getMessage());
    error_log("Admin API error trace: " . $e->getTraceAsString());
    http_response_code(500);
    echo json_encode([
        'error' => 'Internal server error',
        'message' => $e->getMessage(),
        'debug' => [
            'action' => $_GET['action'] ?? 'none',
            'search' => $_GET['search'] ?? '',
            'filter' => $_GET['filter'] ?? '',
            'page' => $_GET['page'] ?? ''
        ]
    ]);
}
