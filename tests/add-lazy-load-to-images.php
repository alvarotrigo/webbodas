<?php
/**
 * Add lazy loading attribute to all images in a stored page
 * 
 * This script fetches a page from the database and adds loading="lazy"
 * to all <img> elements in the page's sections.
 * 
 * Usage: Run this file in a browser or via CLI
 * Page ID: 14c80993-6884-4f25-aaf7-b74320f56393
 */

// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/../debug/php_errors.log');

// Page ID to fix
$pageId = '14c80993-6884-4f25-aaf7-b74320f56393';

// Supabase configuration (same as in api/get.php and api/save.php)
$supabaseUrl = 'https://bkvumiysdvjyuuvhqvnc.supabase.co';
$supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrdnVtaXlzZHZqeXV1dmhxdm5jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5MjA1NzAsImV4cCI6MjA3NzQ5NjU3MH0.7WMMwi7eFf8uNxwSIzUh30o7GU6x4R2dyoCKSjX4YF0';

echo "<h1>Add Lazy Loading to Images</h1>\n";
echo "<p>Page ID: <strong>$pageId</strong></p>\n";
echo "<hr>\n";

try {
    // Step 1: Fetch the page from database (check both editor_pages and user_pages)
    echo "<h2>Step 1: Fetching page from database...</h2>\n";
    
    $docIdEncoded = urlencode($pageId);
    $tableName = null;
    $document = null;
    
    // Try editor_pages first
    echo "<p>Checking editor_pages table...</p>\n";
    $ch = curl_init($supabaseUrl . '/rest/v1/editor_pages?id=eq.' . $docIdEncoded);
    
    if ($ch === false) {
        throw new Exception('Failed to initialize cURL');
    }
    
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'apikey: ' . $supabaseKey,
            'Authorization: Bearer ' . $supabaseKey
        ]
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    
    if ($curlError) {
        throw new Exception('Failed to connect to Supabase: ' . $curlError);
    }
    
    if ($httpCode === 200) {
        $result = json_decode($response, true);
        if (json_last_error() === JSON_ERROR_NONE && is_array($result) && !empty($result)) {
            $document = $result[0];
            $tableName = 'editor_pages';
            echo "<p style='color: green;'>✓ Page found in editor_pages table!</p>\n";
        }
    }
    
    // If not found in editor_pages, try user_pages
    if (!$document) {
        echo "<p>Checking user_pages table...</p>\n";
        $ch = curl_init($supabaseUrl . '/rest/v1/user_pages?id=eq.' . $docIdEncoded);
        
        if ($ch === false) {
            throw new Exception('Failed to initialize cURL');
        }
        
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'apikey: ' . $supabaseKey,
                'Authorization: Bearer ' . $supabaseKey
            ]
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        
        if ($curlError) {
            throw new Exception('Failed to connect to Supabase: ' . $curlError);
        }
        
        if ($httpCode === 200) {
            $result = json_decode($response, true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($result) && !empty($result)) {
                $document = $result[0];
                $tableName = 'user_pages';
                echo "<p style='color: green;'>✓ Page found in user_pages table!</p>\n";
            }
        }
    }
    
    if (!$document || !$tableName) {
        throw new Exception('Page not found in either editor_pages or user_pages table');
    }
    
    // Get the data
    if (!isset($document['data'])) {
        throw new Exception('Document missing data field');
    }
    
    $data = $document['data'];
    if (is_string($data)) {
        $data = json_decode($data, true);
        if ($data === null) {
            throw new Exception('Invalid data format - failed to decode JSON');
        }
    }
    
    // Step 2: Process sections to add loading="lazy" to all images
    echo "<h2>Step 2: Processing sections...</h2>\n";
    
    $imagesUpdated = 0;
    $sectionsProcessed = 0;
    
    if (isset($data['sections']) && is_array($data['sections'])) {
        foreach ($data['sections'] as &$section) {
            if (isset($section['html']) && !empty($section['html'])) {
                $originalHtml = $section['html'];
                
                // Count images before processing
                preg_match_all('/<img\b[^>]*>/i', $originalHtml, $matches);
                $imageCount = count($matches[0]);
                
                if ($imageCount > 0) {
                    // Add or update loading="lazy" to all img tags
                    // Pattern matches <img> tags and ensures loading="lazy" is set
                    $updatedHtml = preg_replace_callback(
                        '/<img\b([^>]*)>/i',
                        function($matches) {
                            $attributes = $matches[1];
                            
                            // Check if loading attribute already exists
                            if (preg_match('/\bloading\s*=\s*["\']([^"\']*)["\']/i', $attributes, $loadingMatch)) {
                                // Replace existing loading attribute with lazy
                                $attributes = preg_replace('/\s+loading\s*=\s*["\'][^"\']*["\']/i', '', $attributes);
                                return '<img' . $attributes . ' loading="lazy">';
                            }
                            
                            // Add loading="lazy" attribute
                            return '<img' . $attributes . ' loading="lazy">';
                        },
                        $originalHtml
                    );
                    
                    $section['html'] = $updatedHtml;
                    $imagesUpdated += $imageCount;
                    $sectionsProcessed++;
                    
                    echo "<p>✓ Section processed: Found $imageCount image(s)</p>\n";
                }
            }
        }
        unset($section); // Break reference
    } else {
        echo "<p style='color: orange;'>⚠ No sections found in page data</p>\n";
    }
    
    echo "<p style='color: green;'>✓ Processed $sectionsProcessed section(s) with $imagesUpdated total image(s)</p>\n";
    
    // Step 3: Update the page back to the database
    echo "<h2>Step 3: Updating page in database...</h2>\n";
    
    $payload = [
        'data' => $data
    ];
    
    $payloadJson = json_encode($payload);
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception('Failed to encode payload: ' . json_last_error_msg());
    }
    
    // Use PATCH to update the existing record
    $ch = curl_init($supabaseUrl . '/rest/v1/' . $tableName . '?id=eq.' . $docIdEncoded);
    
    if ($ch === false) {
        throw new Exception('Failed to initialize cURL for update');
    }
    
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => 'PATCH',
        CURLOPT_POSTFIELDS => $payloadJson,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'apikey: ' . $supabaseKey,
            'Authorization: Bearer ' . $supabaseKey,
            'Prefer: return=representation'
        ]
    ]);
    
    $updateResponse = curl_exec($ch);
    $updateHttpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $updateCurlError = curl_error($ch);
    
    if ($updateCurlError) {
        throw new Exception('Failed to update page: ' . $updateCurlError);
    }
    
    if ($updateHttpCode !== 200 && $updateHttpCode !== 204) {
        $errorDetails = json_decode($updateResponse, true);
        $errorMessage = 'Failed to update page. HTTP Code: ' . $updateHttpCode;
        if ($errorDetails && isset($errorDetails['message'])) {
            $errorMessage .= ': ' . $errorDetails['message'];
        }
        throw new Exception($errorMessage . '. Response: ' . $updateResponse);
    }
    
    echo "<p style='color: green;'>✓ Page updated successfully!</p>\n";
    
    // Summary
    echo "<hr>\n";
    echo "<h2>Summary</h2>\n";
    echo "<ul>\n";
    echo "<li><strong>Page ID:</strong> $pageId</li>\n";
    echo "<li><strong>Table:</strong> $tableName</li>\n";
    echo "<li><strong>Sections processed:</strong> $sectionsProcessed</li>\n";
    echo "<li><strong>Images updated:</strong> $imagesUpdated</li>\n";
    echo "<li><strong>Status:</strong> <span style='color: green;'>Success</span></li>\n";
    echo "</ul>\n";
    
    echo "<p style='color: green; font-weight: bold;'>✓ All images now have loading=\"lazy\" attribute!</p>\n";
    
} catch (Exception $e) {
    echo "<h2 style='color: red;'>Error</h2>\n";
    echo "<p style='color: red;'>" . htmlspecialchars($e->getMessage()) . "</p>\n";
    echo "<p><small>Error occurred at: " . date('Y-m-d H:i:s') . "</small></p>\n";
}

echo "<hr>\n";
echo "<p><small>Script completed at: " . date('Y-m-d H:i:s') . "</small></p>\n";
?>

