<?php
// Test script for realistic CSS purging functionality

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

// Test with realistic HTML content that includes theme classes
$testHTML = '<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Generated Page</title>
    <link rel="stylesheet" href="./dist/styles.css">
</head>
<body class="theme-candy-shop fullpage-enabled fp-viewing-0">
    <div id="fullpage">
        <section id="fp-theme-hero" class="min-h-screen flex justify-center items-center relative">
            <div class="relative z-10 text-center px-4 w-full">
                <h1 class="text-5xl md:text-7xl lg:text-8xl font-bold mb-8 animate-fade-in-up heading-themed mce-content-body">Welcome to Our Site</h1>
                <p class="text-xl md:text-2xl lg:text-3xl mb-12 text-themed-secondary max-w-4xl mx-auto leading-relaxed">This is a test paragraph with themed styling.</p>
                <div class="flex flex-col sm:flex-row gap-6 justify-center items-center">
                    <a href="#" class="btn-themed text-lg px-8 py-4 mce-content-body">Get Started</a>
                    <a href="#" class="btn-themed-outline text-lg px-8 py-4 mce-content-body">Learn More</a>
                </div>
            </div>
            <div class="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
                <svg class="w-6 h-6 text-themed-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
                </svg>
            </div>
        </section>
    </div>
    <script>
        document.addEventListener("DOMContentLoaded", function() {
            new fullpage("#fullpage", {
                // Get your license at: https://alvarotrigo.com/fullPage/pricing
                licenseKey: "YOUR_LICENSE_KEY",
                scrollingSpeed: 700,
                navigation: true,
                showActiveTooltip: false,
                anchors: [],
                sectionsColor: []
            });
        });
    </script>
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

echo "\nStarting realistic CSS purge test...\n";
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
    
    // Check for important CSS classes that should be preserved
    $importantClasses = [
        'theme-candy-shop',
        'btn-themed',
        'btn-themed-outline',
        'text-themed-secondary',
        'text-themed-primary',
        'heading-themed'
    ];
    
    echo "\nChecking for important CSS classes:\n";
    echo "==================================\n";
    
    foreach ($importantClasses as $class) {
        if (strpos($combinedCSS, $class) !== false) {
            echo "✅ Found: .$class\n";
        } else {
            echo "❌ Missing: .$class\n";
        }
    }
    
} else {
    echo "CSS purging failed!\n";
}
?>






