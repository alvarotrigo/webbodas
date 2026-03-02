<?php
/**
 * Check if user has any pages
 * Returns page count and redirects user accordingly
 */

// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/../debug/php_errors.log');

// Enable CORS
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Start session
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Include required files
require_once __DIR__ . '/../config/mysql-client.php';

try {
    // Get clerk_user_id from session or POST data
    $clerkUserId = $_SESSION['clerk_user_id'] ?? null;
    
    if (!$clerkUserId && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $clerkUserId = $input['clerk_user_id'] ?? null;
    }
    
    if (!$clerkUserId) {
        echo json_encode([
            'success' => false,
            'error' => 'User not authenticated'
        ]);
        exit();
    }
    
    // Initialize MySQL client (replaces Supabase)
    $supabase = getMySQLClient(); // Same variable name for compatibility
    
    // Get user ID from clerk_user_id
    $userResult = $supabase->select('users', 'id', ['clerk_user_id' => $clerkUserId]);
    
    if (empty($userResult)) {
        echo json_encode([
            'success' => false,
            'error' => 'User not found in database'
        ]);
        exit();
    }
    
    $userId = $userResult[0]['id'];
    
    // Count user's pages
    $pages = $supabase->select(
        'user_pages',
        'id',
        ['user_id' => $userId]
    );
    
    $pageCount = count($pages);
    $hasPages = $pageCount > 0;
    
    // Determine redirect URL
    $redirectUrl = $hasPages ? '/pages.php' : '/app.php';
    
    echo json_encode([
        'success' => true,
        'has_pages' => $hasPages,
        'page_count' => $pageCount,
        'redirect_url' => $redirectUrl
    ]);
    
} catch (Exception $e) {
    error_log("Check user pages error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

