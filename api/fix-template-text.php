<?php
/**
 * Fix Template Text Issues
 * This script fixes missing or incorrect text_updates in templates
 */

// Enable error reporting for debugging
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

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit();
}

try {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['template_file'])) {
        http_response_code(400);
        echo json_encode(['error' => 'template_file is required']);
        exit();
    }
    
    $templateFile = $input['template_file'];
    $templatePath = __DIR__ . '/../templates/' . $templateFile;
    
    if (!file_exists($templatePath)) {
        http_response_code(404);
        echo json_encode(['error' => 'Template file not found']);
        exit();
    }
    
    // Load template
    $templateJson = file_get_contents($templatePath);
    $template = json_decode($templateJson, true);
    
    if (!$template) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid template JSON']);
        exit();
    }
    
    $fixed = [];
    
    // Check for section 7 (How It Works) missing text
    if (in_array(7, $template['sections']) && !isset($template['text_updates']['7'])) {
        // Generate text updates for section 7 based on content_hints
        $hints = $template['content_hints']['7'] ?? null;
        
        if ($hints) {
            $headline = $hints['headline'] ?? 'How It Works';
            $steps = $hints['steps'] ?? [];
            
            $template['text_updates']['7'] = [
                'h2[0]' => $headline,
                'p[0]' => 'Follow these simple steps to get started with ' . ($template['name'] ?? 'our service') . '.'
            ];
            
            // Add steps as h3 elements
            foreach ($steps as $index => $step) {
                $template['text_updates']['7']['h3[' . $index . ']'] = $step;
            }
            
            $fixed[] = 'Added missing text_updates for section 7 (How It Works)';
        }
    }
    
    // Check for section 28 (Pricing) - verify selectors
    if (in_array(28, $template['sections']) && isset($template['text_updates']['28'])) {
        // The pricing section should have proper selectors for all 3 cards
        // We'll verify the structure is complete
        $pricing28 = $template['text_updates']['28'];
        
        // Check if second card (h3[1], p[3], etc.) exists
        if (!isset($pricing28['h3[1]'])) {
            $fixed[] = 'WARNING: Section 28 missing h3[1] (second pricing card title)';
        }
        if (!isset($pricing28['p[3]'])) {
            $fixed[] = 'WARNING: Section 28 missing p[3] (second pricing card description)';
        }
    }
    
    // Save updated template
    $updatedJson = json_encode($template, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    file_put_contents($templatePath, $updatedJson);
    
    echo json_encode([
        'success' => true,
        'message' => 'Template fixed successfully',
        'fixed' => $fixed,
        'template' => $template
    ]);
    
} catch (Exception $e) {
    error_log('Error in fix-template-text.php: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'error' => 'Internal server error',
        'message' => $e->getMessage()
    ]);
}
