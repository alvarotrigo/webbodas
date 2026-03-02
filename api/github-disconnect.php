<?php
/**
 * GitHub Disconnect Handler
 * Removes GitHub authentication from session
 */

session_start();
header('Content-Type: application/json');

// Remove GitHub session variables
unset($_SESSION['github_access_token']);
unset($_SESSION['github_username']);
unset($_SESSION['github_user_id']);
unset($_SESSION['github_oauth_state']);

echo json_encode([
    'success' => true,
    'message' => 'Successfully disconnected from GitHub'
]);
?>


