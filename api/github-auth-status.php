<?php
/**
 * GitHub Authentication Status Checker
 * Returns the current GitHub authentication status
 * PROTECTED: Requires pro/paid subscription
 */

session_start();
header('Content-Type: application/json');

// Include required files for subscription check
require_once '../config/database.php';
require_once '../config/lemonsqueezy.php';
require_once '../includes/clerk-auth.php';

// Sync Clerk session
clerk_handle_handshake();
$serverUserData = syncClerkSession();

// Check if user has pro/paid subscription
$userEmail = $_SESSION['user_email'] ?? null;

if (!$userEmail) {
    echo json_encode([
        'authenticated' => false,
        'error' => 'User not authenticated',
        'requiresUpgrade' => true,
        'username' => '',
        'userId' => ''
    ]);
    exit;
}

// Check subscription status
$subscriptionStatus = checkUserPaidStatusAllSources($userEmail);

if (!$subscriptionStatus['is_paid']) {
    echo json_encode([
        'authenticated' => false,
        'error' => 'GitHub Export is a Pro feature. Please upgrade to continue.',
        'requiresUpgrade' => true,
        'feature' => 'github_export',
        'username' => '',
        'userId' => ''
    ]);
    exit;
}

$authenticated = isset($_SESSION['github_access_token']) && !empty($_SESSION['github_access_token']);

echo json_encode([
    'authenticated' => $authenticated,
    'username' => $_SESSION['github_username'] ?? '',
    'userId' => $_SESSION['github_user_id'] ?? '',
    'isPro' => true
]);
?>

