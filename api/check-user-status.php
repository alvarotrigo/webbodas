<?php
/**
 * API Endpoint: Check User Paid Status
 * This endpoint verifies if a user has a valid paid subscription
 */

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

// Include database configuration
require_once '../config/database.php';

// Start session if not already started
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

try {
    // Get request method
    $method = $_SERVER['REQUEST_METHOD'];
    
    if ($method === 'POST') {
        // Get JSON input
        $input = json_decode(file_get_contents('php://input'), true);
        
        // Get email from request
        $email = $input['email'] ?? null;
        
        if (!$email) {
            throw new Exception('Email is required');
        }
        
        // Validate email format
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new Exception('Invalid email format');
        }
        
        // Check user paid status
        $result = checkUserPaidStatus($email);
        
        // Store result in session for future use
        $_SESSION['user_status'] = $result;
        $_SESSION['user_email'] = $email;
        $_SESSION['status_checked_at'] = time();
        
        // Return JSON response
        echo json_encode([
            'success' => true,
            'data' => $result
        ]);
        
    } elseif ($method === 'GET') {
        // Check if we have cached status in session
        if (isset($_SESSION['user_status']) && isset($_SESSION['status_checked_at'])) {
            $cacheAge = time() - $_SESSION['status_checked_at'];
            
            // Cache for 5 minutes
            if ($cacheAge < 300) {
                echo json_encode([
                    'success' => true,
                    'data' => $_SESSION['user_status'],
                    'cached' => true
                ]);
                exit();
            }
        }
        
        // Get email from query parameter
        $email = $_GET['email'] ?? null;
        
        if (!$email) {
            throw new Exception('Email parameter is required');
        }
        
        // Validate email format
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new Exception('Invalid email format');
        }
        
        // Check user paid status
        $result = checkUserPaidStatus($email);
        
        // Store result in session
        $_SESSION['user_status'] = $result;
        $_SESSION['user_email'] = $email;
        $_SESSION['status_checked_at'] = time();
        
        // Return JSON response
        echo json_encode([
            'success' => true,
            'data' => $result
        ]);
        
    } else {
        throw new Exception('Method not allowed');
    }
    
} catch (Exception $e) {
    // Return error response
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?> 