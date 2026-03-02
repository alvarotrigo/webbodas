<?php
/**
 * API Endpoint: Get Current User Status
 * Returns the current user's authentication and paid status
 */

// Enable CORS for cross-origin requests
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Include session manager
require_once '../includes/session-manager.php';

try {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        // Validate session
        $isValidSession = validateSession();
        
        if (!$isValidSession) {
            // Return free user status
            echo json_encode([
                'success' => true,
                'data' => [
                    'mode' => 'free',
                    'is_authenticated' => false,
                    'is_paid' => false,
                    'email' => null,
                    'name' => null,
                    'subscription' => null
                ]
            ]);
            exit();
        }
        
        // Get user status summary
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
    // Return error response
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?> 