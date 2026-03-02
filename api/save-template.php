<?php
/**
 * Save Template API
 * Writes template JSON to /templates/ folder
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
    
    if (!isset($input['template']) || !is_array($input['template'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Template object is required']);
        exit();
    }
    
    $template = $input['template'];
    
    // Validate template has required fields
    if (!isset($template['id']) || empty($template['id'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Template ID is required']);
        exit();
    }
    
    if (!isset($template['name']) || empty($template['name'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Template name is required']);
        exit();
    }
    
    $templateId = $template['id'];
    
    // Sanitize template ID (only allow alphanumeric, hyphens, underscores)
    $sanitizedId = preg_replace('/[^a-z0-9\-_]/i', '', $templateId);
    if ($sanitizedId !== $templateId) {
        http_response_code(400);
        echo json_encode([
            'error' => 'Invalid template ID. Only alphanumeric characters, hyphens, and underscores are allowed.'
        ]);
        exit();
    }
    
    // Ensure templates directory exists
    $templatesDir = __DIR__ . '/../templates';
    if (!is_dir($templatesDir)) {
        if (!mkdir($templatesDir, 0755, true)) {
            throw new RuntimeException('Failed to create templates directory');
        }
    }
    
    // Build file path
    $filename = $sanitizedId . '.json';
    $filepath = $templatesDir . '/' . $filename;
    
    // Check if file already exists
    if (file_exists($filepath)) {
        http_response_code(409);
        echo json_encode([
            'error' => 'Template already exists',
            'id' => $sanitizedId,
            'suggestion' => 'Use a different ID or delete the existing template first'
        ]);
        exit();
    }
    
    // Pretty print JSON for readability
    $jsonContent = json_encode($template, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    
    if ($jsonContent === false) {
        throw new RuntimeException('Failed to encode template as JSON: ' . json_last_error_msg());
    }
    
    // Write to file
    $bytesWritten = file_put_contents($filepath, $jsonContent);
    
    if ($bytesWritten === false) {
        throw new RuntimeException('Failed to write template file');
    }
    
    // Return success response
    echo json_encode([
        'success' => true,
        'template_id' => $sanitizedId,
        'filename' => $filename,
        'filepath' => $filepath,
        'size_bytes' => $bytesWritten
    ]);
    
} catch (Exception $e) {
    error_log("Error in save-template.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'error' => 'Internal server error',
        'message' => $e->getMessage()
    ]);
}
