<?php
/**
 * Save Page Data to MySQL
 * Saves JSON data (sections + theme) to MySQL and returns the document ID
 */

// Enable error reporting for debugging (disable in production)
error_reporting(E_ALL);
ini_set('display_errors', 0); // Don't display errors, but log them
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/../debug/php_errors.log');

// Load MySQL client
require_once __DIR__ . '/../config/mysql-client.php';

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

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit();
}

try {
    // Get POST data
    $jsonData = file_get_contents('php://input');
    $data = json_decode($jsonData, true);

    // Check for JSON decode errors
    if (json_last_error() !== JSON_ERROR_NONE) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON: ' . json_last_error_msg()]);
        exit();
    }

    // Validate input
    if (!isset($data['data']) || empty($data['data'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing or invalid data']);
        exit();
    }
    
    // Validate and normalize data structure
    // Ensure sections is always an array
    if (!isset($data['data']['sections']) || !is_array($data['data']['sections'])) {
        $data['data']['sections'] = [];
    }
    
    // Ensure theme is always a string (not an array)
    if (isset($data['data']['theme'])) {
        if (is_array($data['data']['theme'])) {
            // If theme is an array, extract first valid string value
            $data['data']['theme'] = array_filter($data['data']['theme'], function($t) {
                return is_string($t) && trim($t) !== '';
            });
            $data['data']['theme'] = !empty($data['data']['theme']) ? reset($data['data']['theme']) : 'theme-light-minimal';
        } elseif (!is_string($data['data']['theme']) || trim($data['data']['theme']) === '') {
            $data['data']['theme'] = 'theme-light-minimal';
        }
    } else {
        $data['data']['theme'] = 'theme-light-minimal';
    }
    
    // Clean up editor-only attributes from sections before saving
    foreach ($data['data']['sections'] as &$section) {
        if (isset($section['html']) && is_string($section['html'])) {
            // Remove editor-only initialization attributes
            $section['html'] = preg_replace('/\s+data-accordion-initialized="[^"]*"/', '', $section['html']);
            $section['html'] = preg_replace('/\s+data-process-accordion-initialized="[^"]*"/', '', $section['html']);
            $section['html'] = preg_replace('/\s+data-popular-questions-initialized="[^"]*"/', '', $section['html']);
            $section['html'] = preg_replace('/\s+data-pricing-initialized="[^"]*"/', '', $section['html']);
            $section['html'] = preg_replace('/\s+data-gallery-initialized="[^"]*"/', '', $section['html']);
            $section['html'] = preg_replace('/\s+data-removable-initialized="[^"]*"/', '', $section['html']);
            $section['html'] = preg_replace('/\s+data-cloudinary-initialized="[^"]*"/', '', $section['html']);
        }
    }
    unset($section); // Break reference

    // Save to MySQL using MySQLClient
    $mysqlClient = getMySQLClient();

    // Insert into editor_pages table
    $result = $mysqlClient->insert('editor_pages', [
        'data' => $data['data']
    ]);

    if (empty($result) || !isset($result[0]['id'])) {
        throw new Exception('Failed to save data to database - no ID returned');
    }

    // Return the document ID
    echo json_encode(['id' => $result[0]['id']]);

} catch (Exception $e) {
    error_log('Error in save.php: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
    http_response_code(500);
    echo json_encode([
        'error' => $e->getMessage()
    ]);
}

