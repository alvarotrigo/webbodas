<?php
/**
 * Test endpoint for slot derivation
 * 
 * Usage:
 *   GET /api/test-slots.php?section_id=101
 *   or
 *   POST /api/test-slots.php with JSON body: {"section_id": 101}
 */

// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/../debug/php_errors.log');

// Enable CORS
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Load slot deriver functions
require_once __DIR__ . '/../includes/slot-deriver.php';

// Load section metadata
$metadataPath = __DIR__ . '/../public/js/metadata.min.js';
if (!file_exists($metadataPath)) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Section metadata file not found'
    ]);
    exit();
}

// Read and parse metadata
$metadataContent = file_get_contents($metadataPath);
$metadataContent = trim($metadataContent);
$metadata = json_decode($metadataContent, true);

if (!$metadata || !is_array($metadata)) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Invalid metadata format'
    ]);
    exit();
}

try {
    // Get section ID from query parameter or POST body
    $sectionId = null;
    
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $sectionId = $input['section_id'] ?? null;
    } else {
        $sectionId = $_GET['section_id'] ?? null;
    }
    
    if ($sectionId === null) {
        http_response_code(400);
        echo json_encode([
            'error' => 'section_id is required',
            'usage' => 'GET /api/test-slots.php?section_id=101 or POST with {"section_id": 101}'
        ]);
        exit();
    }
    
    $sectionId = (int)$sectionId;
    
    // Find the section in metadata
    $section = null;
    foreach ($metadata as $meta) {
        if (isset($meta['id']) && (int)$meta['id'] === $sectionId) {
            $section = $meta;
            break;
        }
    }
    
    if (!$section) {
        http_response_code(404);
        echo json_encode([
            'error' => "Section with ID {$sectionId} not found",
            'available_ids' => array_slice(array_column($metadata, 'id'), 0, 20) // Show first 20 IDs
        ]);
        exit();
    }
    
    // Derive slots
    $schema = derive_slots($section);
    $minimal = minimal_section_for_llm($section);
    
    // Return results
    echo json_encode([
        'success' => true,
        'section_id' => $sectionId,
        'original_metadata' => $section,
        'minimal_metadata' => $minimal,
        'derived_schema' => $schema,
        'slots_count' => count($schema['slots']),
        'slots_keys' => array_keys($schema['slots'])
    ], JSON_PRETTY_PRINT);
    
} catch (Exception $e) {
    error_log("Error in test-slots.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'error' => 'Internal server error',
        'message' => $e->getMessage()
    ]);
}
?>


