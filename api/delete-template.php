<?php
/**
 * Delete Template API
 * Deletes a template JSON file from /templates/ folder
 */

// Enable error reporting for debugging (disable in production)
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/../debug/php_errors.log');

// Enable CORS for cross-origin requests
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST' && $_SERVER['REQUEST_METHOD'] !== 'DELETE') {
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
        exit();
    }
    
    // Get JSON input
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['filename']) || empty($input['filename'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Filename is required']);
        exit();
    }
    
    $filename = $input['filename'];
    
    // Sanitize filename (only allow alphanumeric, hyphens, underscores, and .json extension)
    if (!preg_match('/^[a-z0-9\-_]+\.json$/i', $filename)) {
        http_response_code(400);
        echo json_encode([
            'error' => 'Invalid filename format. Only alphanumeric characters, hyphens, underscores, and .json extension are allowed.'
        ]);
        exit();
    }
    
    // Build file path
    $templatesDir = __DIR__ . '/../templates';
    $filepath = $templatesDir . '/' . $filename;
    
    // Check if file exists
    if (!file_exists($filepath)) {
        http_response_code(404);
        echo json_encode([
            'error' => 'Template not found',
            'filename' => $filename
        ]);
        exit();
    }
    
    // Delete the file
    if (!unlink($filepath)) {
        throw new RuntimeException('Failed to delete template file');
    }
    
    // Return success response
    echo json_encode([
        'success' => true,
        'filename' => $filename,
        'message' => 'Template deleted successfully'
    ]);
    
} catch (Exception $e) {
    error_log("Error in delete-template.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'error' => 'Internal server error',
        'message' => $e->getMessage()
    ]);
}
