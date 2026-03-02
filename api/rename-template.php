<?php
/**
 * Rename Template API
 * Renames a template JSON file in /templates/ folder
 */

// Enable error reporting for debugging (disable in production)
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/../debug/php_errors.log');

// Enable CORS for cross-origin requests
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
        exit();
    }
    
    // Get JSON input
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['old_filename']) || empty($input['old_filename'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Old filename is required']);
        exit();
    }
    
    if (!isset($input['new_id']) || empty($input['new_id'])) {
        http_response_code(400);
        echo json_encode(['error' => 'New ID is required']);
        exit();
    }
    
    if (!isset($input['new_name']) || empty($input['new_name'])) {
        http_response_code(400);
        echo json_encode(['error' => 'New name is required']);
        exit();
    }
    
    $oldFilename = $input['old_filename'];
    $newId = $input['new_id'];
    $newName = $input['new_name'];
    
    // Sanitize old filename
    if (!preg_match('/^[a-z0-9\-_]+\.json$/i', $oldFilename)) {
        http_response_code(400);
        echo json_encode([
            'error' => 'Invalid old filename format'
        ]);
        exit();
    }
    
    // Sanitize new ID
    $sanitizedNewId = preg_replace('/[^a-z0-9\-_]/i', '', $newId);
    if ($sanitizedNewId !== $newId) {
        http_response_code(400);
        echo json_encode([
            'error' => 'Invalid new ID. Only alphanumeric characters, hyphens, and underscores are allowed.'
        ]);
        exit();
    }
    
    // Build file paths
    $templatesDir = __DIR__ . '/../templates';
    $oldFilepath = $templatesDir . '/' . $oldFilename;
    $newFilename = $sanitizedNewId . '.json';
    $newFilepath = $templatesDir . '/' . $newFilename;
    
    // Check if old file exists
    if (!file_exists($oldFilepath)) {
        http_response_code(404);
        echo json_encode([
            'error' => 'Template not found',
            'filename' => $oldFilename
        ]);
        exit();
    }
    
    // Check if new filename already exists
    if (file_exists($newFilepath) && $oldFilepath !== $newFilepath) {
        http_response_code(409);
        echo json_encode([
            'error' => 'A template with that ID already exists',
            'new_id' => $sanitizedNewId
        ]);
        exit();
    }
    
    // Read the template data
    $templateJson = file_get_contents($oldFilepath);
    if ($templateJson === false) {
        throw new RuntimeException('Failed to read template file');
    }
    
    $template = json_decode($templateJson, true);
    if ($template === null) {
        throw new RuntimeException('Failed to decode template JSON');
    }
    
    // Update the ID and name in the template data
    $template['id'] = $sanitizedNewId;
    $template['name'] = $newName;
    
    // Write updated template to new file
    $jsonContent = json_encode($template, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if ($jsonContent === false) {
        throw new RuntimeException('Failed to encode template as JSON');
    }
    
    $bytesWritten = file_put_contents($newFilepath, $jsonContent);
    if ($bytesWritten === false) {
        throw new RuntimeException('Failed to write new template file');
    }
    
    // Delete old file if filenames are different
    if ($oldFilepath !== $newFilepath) {
        if (!unlink($oldFilepath)) {
            // Try to clean up the new file
            @unlink($newFilepath);
            throw new RuntimeException('Failed to delete old template file');
        }
    }
    
    // Return success response
    echo json_encode([
        'success' => true,
        'old_filename' => $oldFilename,
        'new_filename' => $newFilename,
        'new_id' => $sanitizedNewId,
        'new_name' => $newName,
        'message' => 'Template renamed successfully'
    ]);
    
} catch (Exception $e) {
    error_log("Error in rename-template.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'error' => 'Internal server error',
        'message' => $e->getMessage()
    ]);
}
