<?php
/**
 * Logout Handler
 * Clears server session and redirects to auth-wall.html
 */

function isLocalhost(){
    $whitelist = array(
        '127.0.0.1',
        '::1'
    );
    
    return in_array($_SERVER['REMOTE_ADDR'], $whitelist);
}



// Start session
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Clear all session variables
$_SESSION = array();

// Delete the session cookie
if (isset($_COOKIE[session_name()])) {
    setcookie(session_name(), '', time() - 3600, '/');
}

// Destroy the session
session_destroy();

// Clear any other auth cookies if they exist
if (isset($_COOKIE['clerk_session'])) {
    setcookie('clerk_session', '', time() - 3600, '/');
}

// Log the logout
error_log("User logged out - Session destroyed");

// Detect base path (only use subpath when app is under that folder)
$basePath = '';
$scriptName = $_SERVER['SCRIPT_NAME'] ?? '';
if (strpos($scriptName, '/nine-screen-canvas-flow/') !== false) {
    $basePath = '/nine-screen-canvas-flow';
}

// Redirect to auth-wall with logout flag
header('Location: ' . $basePath . '/auth-wall.html?logout=true');
exit;


