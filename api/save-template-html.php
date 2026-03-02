<?php
/**
 * Save Template as HTML API
 * Writes fully rendered template HTML to /templates/html/ folder
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
    
    if (!isset($input['html']) || empty($input['html'])) {
        http_response_code(400);
        echo json_encode(['error' => 'HTML content is required']);
        exit();
    }
    
    if (!isset($input['filename']) || empty($input['filename'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Filename is required']);
        exit();
    }
    
    $html = $input['html'];
    $filename = $input['filename'];
    
    // Sanitize filename (only allow alphanumeric, hyphens, underscores)
    $sanitizedFilename = preg_replace('/[^a-z0-9\-_]/i', '', $filename);
    if ($sanitizedFilename !== $filename) {
        http_response_code(400);
        echo json_encode([
            'error' => 'Invalid filename. Only alphanumeric characters, hyphens, and underscores are allowed.'
        ]);
        exit();
    }
    
    // Ensure templates/html directory exists
    $htmlDir = __DIR__ . '/../templates/html';
    if (!is_dir($htmlDir)) {
        if (!mkdir($htmlDir, 0755, true)) {
            throw new RuntimeException('Failed to create templates/html directory');
        }
    }
    
    // Write to templates/html/<id>/index.html (folder per template for full export)
    $templateDir = $htmlDir . '/' . $sanitizedFilename;
    $indexPath = $templateDir . '/index.html';
    
    // Create template folder
    if (!is_dir($templateDir)) {
        if (!mkdir($templateDir, 0755, true)) {
            throw new RuntimeException('Failed to create template directory');
        }
    }
    
    // Write HTML to index.html (overwrite if exists so re-export updates content)
    $bytesWritten = file_put_contents($indexPath, $html);
    
    if ($bytesWritten === false) {
        throw new RuntimeException('Failed to write HTML file');
    }
    
    // Copy theme.css and theme.js from templates/dist/<id>/ when they exist
    $distDir = __DIR__ . '/../templates/dist/' . $sanitizedFilename;
    $themeCssSrc = $distDir . '/theme.css';
    $themeJsSrc = $distDir . '/theme.js';
    $themeFilesIncluded = [];
    
    if (file_exists($themeCssSrc)) {
        $themeCssDest = $templateDir . '/theme.css';
        if (copy($themeCssSrc, $themeCssDest)) {
            $themeFilesIncluded[] = 'theme.css';
        }
    }
    if (file_exists($themeJsSrc)) {
        $themeJsDest = $templateDir . '/theme.js';
        if (copy($themeJsSrc, $themeJsDest)) {
            $themeFilesIncluded[] = 'theme.js';
        }
    }
    
    // Return success response
    echo json_encode([
        'success' => true,
        'filename' => $sanitizedFilename . '/index.html',
        'filepath' => $indexPath,
        'size_bytes' => $bytesWritten,
        'theme_files' => $themeFilesIncluded
    ]);
    
} catch (Exception $e) {
    error_log("Error in save-template-html.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'error' => 'Internal server error',
        'message' => $e->getMessage()
    ]);
}
