<?php
/**
 * Session Manager
 * Handles user authentication and paid status across the application
 */

// Start session if not already started
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

/**
 * Initialize user session
 * @param string $email User email
 * @param string $name User name (optional)
 * @param bool $isPaid Whether user has paid status
 * @param array $subscriptionDetails Subscription details (optional)
 */
function initializeUserSession($email, $name = null, $isPaid = false, $subscriptionDetails = null, $avatarUrl = null, $clerkUserId = null) {
    $_SESSION['user_email'] = $email;
    $_SESSION['user_name'] = $name;
    $_SESSION['is_authenticated'] = true;
    $_SESSION['is_paid'] = $isPaid;
    $_SESSION['subscription_details'] = $subscriptionDetails;
    $_SESSION['session_started'] = time();
    $_SESSION['last_activity'] = time();
    if ($avatarUrl !== null) {
        $_SESSION['user_avatar'] = $avatarUrl;
    }
    if ($clerkUserId !== null) {
        $_SESSION['clerk_user_id'] = $clerkUserId;
    }
}

/**
 * Check if user is authenticated
 * @return bool
 */
function isUserAuthenticated() {
    return isset($_SESSION['is_authenticated']) && $_SESSION['is_authenticated'] === true;
}

/**
 * Check if user has paid status
 * @return bool
 */
function isUserPaid() {
    return isset($_SESSION['is_paid']) && $_SESSION['is_paid'] === true;
}

/**
 * Get current user email
 * @return string|null
 */
function getCurrentUserEmail() {
    return $_SESSION['user_email'] ?? null;
}

/**
 * Get current user name
 * @return string|null
 */
function getCurrentUserName() {
    return $_SESSION['user_name'] ?? null;
}

/**
 * Get user subscription details
 * @return array|null
 */
function getUserSubscriptionDetails() {
    return $_SESSION['subscription_details'] ?? null;
}

/**
 * Update user paid status
 * @param bool $isPaid
 * @param array $subscriptionDetails
 */
function updateUserPaidStatus($isPaid, $subscriptionDetails = null) {
    $_SESSION['is_paid'] = $isPaid;
    $_SESSION['subscription_details'] = $subscriptionDetails;
    $_SESSION['last_activity'] = time();
}

/**
 * Clear user session
 */
function clearUserSession() {
    session_unset();
    session_destroy();
}

/**
 * Update last activity timestamp
 */
function updateLastActivity() {
    $_SESSION['last_activity'] = time();
}

/**
 * Check if session has expired (30 minutes)
 * @return bool
 */
function isSessionExpired() {
    if (!isset($_SESSION['last_activity'])) {
        return true;
    }
    
    $timeout = 30 * 60; // 30 minutes
    return (time() - $_SESSION['last_activity']) > $timeout;
}

/**
 * Get user status summary
 * @return array
 */
function getUserStatusSummary() {
    return [
        'is_authenticated' => isUserAuthenticated(),
        'is_paid' => isUserPaid(),
        'email' => getCurrentUserEmail(),
        'name' => getCurrentUserName(),
        'avatar_url' => $_SESSION['user_avatar'] ?? null,
        'subscription' => getUserSubscriptionDetails(),
        'session_started' => $_SESSION['session_started'] ?? null,
        'last_activity' => $_SESSION['last_activity'] ?? null
    ];
}

/**
 * Validate and refresh session
 * @return bool
 */
function validateSession() {
    if (!isUserAuthenticated()) {
        return false;
    }
    
    if (isSessionExpired()) {
        clearUserSession();
        return false;
    }
    
    updateLastActivity();
    return true;
}

/**
 * Get user mode (free, authenticated, or paid)
 * @return string
 */
function getUserMode() {
    if (!isUserAuthenticated()) {
        return 'free';
    }
    
    if (isUserPaid()) {
        return 'paid';
    }
    
    return 'authenticated';
}
?> 