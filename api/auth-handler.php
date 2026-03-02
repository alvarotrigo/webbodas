<?php
/**
 * Authentication Handler
 * Processes Clerk authentication and checks user paid status
 */

// Enable error reporting for debugging (disable in production)
error_reporting(E_ALL);
ini_set('display_errors', 1);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/../debug/php_errors.log');

// Enable CORS for cross-origin requests
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Include required files
require_once '../includes/session-manager.php';
require_once '../config/database.php';
require_once '../config/lemonsqueezy.php';

try {
    // Check if required files exist
    if (!file_exists('../includes/session-manager.php')) {
        throw new Exception('Session manager not found');
    }
    if (!file_exists('../config/database.php')) {
        throw new Exception('Database configuration not found');
    }
    
    $method = $_SERVER['REQUEST_METHOD'];
    
    if ($method === 'POST') {
        // Get JSON input
        $input = json_decode(file_get_contents('php://input'), true);
        
        $action = $input['action'] ?? '';
        
        switch ($action) {
            case 'authenticate':
                handleAuthentication($input);
                break;
                
            case 'check_paid_status':
                handlePaidStatusCheck($input);
                break;
                
            case 'logout':
                handleLogout();
                break;
                
            default:
                throw new Exception('Invalid action');
        }
        
    } elseif ($method === 'GET') {
        // Return current user status
        $userStatus = getUserStatusSummary();
        $userStatus['mode'] = getUserMode();
        
        echo json_encode([
            'success' => true,
            'data' => $userStatus
        ]);
        
    } else {
        throw new Exception('Method not allowed');
    }
    
} catch (Exception $e) {
    // Return error response with detailed information
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine(),
        'trace' => $e->getTraceAsString()
    ]);
}

/**
 * Handle user authentication
 * @param array $input Request input
 */
function handleAuthentication($input) {
    error_log("=== AUTH HANDLER CALLED ===");
    error_log("Input received: " . json_encode($input));
    
    $email = $input['email'] ?? null;
    $name = $input['name'] ?? null;
    $clerkUserId = $input['clerk_user_id'] ?? null;
    $avatarUrl = $input['avatar_url'] ?? null;
    
    error_log("Parsed values - email: " . ($email ?? 'NULL') . ", name: " . ($name ?? 'NULL') . ", clerk_user_id: " . ($clerkUserId ?? 'NULL'));
    
    if (!$email) {
        error_log("ERROR: Email is required but was NULL");
        throw new Exception('Email is required');
    }
    
    // Validate email format
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        error_log("ERROR: Invalid email format: {$email}");
        throw new Exception('Invalid email format');
    }
    
    // Check if user has paid status from any source (legacy or LemonSqueezy)
    try {
        $paidStatus = checkUserPaidStatusAllSources($email);

        if($paidStatus['status'] === 'error'){
            error_log("WARNING: Database connection failed when checking paid status");
            throw new Exception('Database connection failed, defaulting to free user');
        }
    } catch (Exception $e) {
        error_log("WARNING: Exception checking paid status: " . $e->getMessage());
        throw new Exception('Database connection failed, defaulting to free user');
    }
    
    // Create or update user in users table (tracks all logged-in users)
    error_log("Auth handler - About to create/update user. clerk_user_id: " . ($clerkUserId ?? 'NULL') . ", email: " . $email);
    
    if ($clerkUserId && !empty(trim($clerkUserId))) {
        try {
            $proStatusSource = null;
            $subscriptionId = null;
            
            if ($paidStatus['is_paid']) {
                $proStatusSource = $paidStatus['source'] ?? 'lemonsqueezy';
                $subscriptionId = $paidStatus['subscription_id'] ?? null;
            }
            
            error_log("Calling createOrUpdateUser with: clerk_user_id={$clerkUserId}, email={$email}, is_pro=" . ($paidStatus['is_paid'] ? 'true' : 'false'));
            
            createOrUpdateUser(
                $clerkUserId,
                $email,
                $name,
                $paidStatus['is_paid'],
                $proStatusSource,
                $subscriptionId
            );
            
            error_log("createOrUpdateUser completed successfully");
        } catch (Exception $e) {
            // Log error but don't fail authentication
            error_log("ERROR creating/updating user record: " . $e->getMessage());
            error_log("Stack trace: " . $e->getTraceAsString());
        }
    } else {
        error_log("WARNING: clerk_user_id is NULL or empty - user record will NOT be created!");
        error_log("clerk_user_id value: '" . ($clerkUserId ?? 'NULL') . "' (type: " . gettype($clerkUserId) . ")");
    }
    
    // Initialize user session
    $sanitizedAvatar = null;
    if ($avatarUrl) {
        $sanitizedAvatar = filter_var($avatarUrl, FILTER_VALIDATE_URL) ? $avatarUrl : null;
    }

    initializeUserSession(
        $email,
        $name,
        $paidStatus['is_paid'],
        $paidStatus['status'] === 'paid' ? $paidStatus : null,
        $sanitizedAvatar,
        $clerkUserId
    );

    if ($sanitizedAvatar) {
        $_SESSION['clerk_avatar'] = $sanitizedAvatar;
    }
    
    // Also ensure clerk_user_id is set in session for backward compatibility
    if ($clerkUserId) {
        $_SESSION['clerk_user_id'] = $clerkUserId;
    }
    

    // Return authentication result
    echo json_encode([
        'success' => true,
        'data' => [
            'email' => $email,
            'name' => $name,
            'is_authenticated' => true,
            'is_paid' => $paidStatus['is_paid'],
            'mode' => $paidStatus['is_paid'] ? 'paid' : 'authenticated',
            'subscription' => $paidStatus['status'] === 'paid' ? $paidStatus : null,
            'clerk_user_id' => $clerkUserId,
            'avatar_url' => $sanitizedAvatar
        ]
    ]);
}

/**
 * Handle paid status check
 * @param array $input Request input
 */
function handlePaidStatusCheck($input) {
    $email = $input['email'] ?? null;
    
    if (!$email) {
        throw new Exception('Email is required');
    }
    
    // Validate email format
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        throw new Exception('Invalid email format');
    }

    // Check user paid status from all sources
    $paidStatus = checkUserPaidStatusAllSources($email);
   
    // Update session if user is authenticated
    if (isUserAuthenticated() && getCurrentUserEmail() === $email) {
        updateUserPaidStatus($paidStatus['is_paid'], $paidStatus['status'] === 'paid' ? $paidStatus : null);
    }
    
    echo json_encode([
        'success' => true,
        'data' => $paidStatus
    ]);
}

/**
 * Handle user logout
 */
function handleLogout() {
    clearUserSession();
    
    echo json_encode([
        'success' => true,
        'data' => [
            'message' => 'User logged out successfully',
            'mode' => 'free'
        ]
    ]);
}
?> 