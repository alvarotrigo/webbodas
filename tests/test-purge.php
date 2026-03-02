<?php
// Test script for external CSS purging functionality

// Function to purge CSS using external service
function purgeCSS($htmlContent, $cssFilePaths) {
    $purgeUrl = 'http://localhost:3000/purge/purge?combine=true';
    
    // Prepare CSS files with content for the API
    $cssFiles = [];
    foreach ($cssFilePaths as $fileName => $filePath) {
        if (file_exists($filePath)) {
            $cssFiles[] = [
                'content' => file_get_contents($filePath),
                'filename' => $fileName
            ];
        }
    }
    
    if (empty($cssFiles)) {
        return false;
    }
    
    // Prepare the request data
    $requestData = [
        'cssFiles' => $cssFiles,
        'contentFiles' => [
            [
                'content' => $htmlContent,
                'extension' => 'html'
            ]
        ]
    ];
    
    echo "Sending request to: $purgeUrl\n";
    echo "CSS files: " . implode(', ', array_column($cssFiles, 'filename')) . "\n";
    echo "HTML content length: " . strlen($htmlContent) . " characters\n";
    
    // Initialize cURL
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $purgeUrl);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($requestData));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Accept: application/json'
    ]);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    
    // Execute the request
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    
    echo "HTTP Code: $httpCode\n";
    if ($error) {
        echo "cURL Error: $error\n";
    }
    
    // Check if request was successful
    if ($httpCode === 200 && $response) {
        $purgedData = json_decode($response, true);
        if ($purgedData) {
            echo "Purge successful! Received combined CSS file.\n";
            
            // Debug: Show response type and sample content
            if (is_string($purgedData)) {
                echo "Response is a string, length: " . strlen($purgedData) . " characters\n";
                echo "Sample content: " . substr($purgedData, 0, 100) . "...\n";
            } elseif (is_array($purgedData)) {
                echo "Response is an array with keys: " . implode(', ', array_keys($purgedData)) . "\n";
                if (isset($purgedData['css'])) {
                    echo "CSS content length: " . strlen($purgedData['css']) . " characters\n";
                    echo "Sample content: " . substr($purgedData['css'], 0, 100) . "...\n";
                }
            }
            
            return $purgedData;
        }
    }
    
    echo "Purge failed. Response: " . substr($response, 0, 500) . "\n";
    return false;
}

// Test with a simple HTML content
$testHTML = '<!DOCTYPE html>
<html>
<head>
    <title>Test Page</title>
</head>
<body class="theme-light-minimal">
    <div class="bg-themed-primary">
        <h1 class="text-themed-primary">Hello World</h1>
        <p class="text-themed-secondary">This is a test paragraph.</p>
    </div>
    <div class="bg-themed-secondary">
        <button class="bg-themed-accent text-themed-primary">Click me</button>
    </div>
</body>
</html>';

// Prepare CSS files for testing
$cssFilePaths = [];

if (file_exists('./dist/output.css')) {
    $cssFilePaths['output.css'] = './dist/output.css';
    echo "Found output.css: " . filesize('./dist/output.css') . " bytes\n";
}

if (file_exists('./public/css/sections.css')) {
    $cssFilePaths['sections.css'] = './public/css/sections.css';
    echo "Found sections.css: " . filesize('./public/css/sections.css') . " bytes\n";
}

if (empty($cssFilePaths)) {
    echo "No CSS files found for testing!\n";
    exit(1);
}

echo "\nStarting external CSS purge test...\n";
echo "================================\n";

// Test the purge functionality
$purgedCSS = purgeCSS($testHTML, $cssFilePaths);

if ($purgedCSS) {
    echo "\nPurge Results:\n";
    echo "==============\n";
    
    $totalOriginalSize = 0;
    $totalPurgedSize = 0;
    
    // Calculate total original size
    foreach ($cssFilePaths as $fileName => $filePath) {
        $totalOriginalSize += filesize($filePath);
    }
    
    // Handle the combined response
    if (is_string($purgedCSS)) {
        $combinedCSS = $purgedCSS;
    } elseif (is_array($purgedCSS) && isset($purgedCSS['css'])) {
        $combinedCSS = $purgedCSS['css'];
    } else {
        $combinedCSS = json_encode($purgedCSS);
    }
    
    $totalPurgedSize = strlen($combinedCSS);
    $totalSavings = $totalOriginalSize - $totalPurgedSize;
    $totalSavingsPercent = round(($totalSavings / $totalOriginalSize) * 100, 2);
    
    echo "Combined Results:\n";
    echo "==============\n";
    echo "Original: " . number_format($totalOriginalSize) . " bytes\n";
    echo "Purged:   " . number_format($totalPurgedSize) . " bytes\n";
    echo "Savings:  " . number_format($totalSavings) . " bytes ($totalSavingsPercent%)\n";
    
    echo "\nCombined CSS file size: " . number_format(strlen($combinedCSS)) . " bytes\n";
    
} else {
    echo "CSS purging failed!\n";
}
?>
