<?php
// Test script to see the actual API response format

// Function to purge CSS using external service (same as in download-page.php)
function purgeCSS($htmlContent, $cssFilePaths) {
    $purgeUrl = 'http://localhost:3000/purge/purge?combine=false';
    
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
    
    // Prepare the request data with safelist for theme classes
    $requestData = [
        'cssFiles' => $cssFiles,
        'contentFiles' => [
            [
                'content' => $htmlContent,
                'extension' => 'html'
            ]
        ],
        'htmlContent' => $htmlContent,
        'safelist' => [
            'theme-candy-shop',
            'theme-light-minimal',
            'theme-dark-modern',
            'theme-corporate-clean',
            'theme-playful-colorful',
            'theme-elegant-serif',
            'btn-themed',
            'btn-themed-outline',
            'heading-themed',
            'text-themed-primary',
            'text-themed-secondary',
            'text-themed-accent',
            'bg-themed-primary',
            'bg-themed-secondary',
            'bg-themed-accent',
            'card-themed',
            'gradient-themed-1',
            'gradient-themed-2',
            'feature-card',
            'feature-icon'
        ]
    ];
    
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
    
    echo "HTTP Code: $httpCode\n";
    echo "Response length: " . strlen($response) . " characters\n";
    echo "Response preview: " . substr($response, 0, 500) . "...\n\n";
    
    // Check if request was successful
    if ($httpCode === 200 && $response) {
        $purgedData = json_decode($response, true);
        if ($purgedData) {
            echo "=== PARSED RESPONSE ===\n";
            echo "Response type: " . gettype($purgedData) . "\n";
            if (is_array($purgedData)) {
                echo "Response keys: " . implode(', ', array_keys($purgedData)) . "\n";
                foreach ($purgedData as $key => $value) {
                    echo "Key '$key' type: " . gettype($value) . "\n";
                    if (is_array($value)) {
                        echo "  Array keys: " . implode(', ', array_keys($value)) . "\n";
                    } elseif (is_string($value)) {
                        echo "  String length: " . strlen($value) . " characters\n";
                        echo "  Preview: " . substr($value, 0, 200) . "...\n";
                    }
                }
            }
            return $purgedData;
        }
    }
    
    return false;
}

// Test with minimal HTML and CSS
$testHtml = '<div class="theme-candy-shop"><h1 class="heading-themed">Test</h1></div>';
$cssFilePaths = [
    'output.css' => './dist/output.css',
    'sections.css' => './public/css/sections.css'
];

echo "=== TESTING PURGE API RESPONSE ===\n";
$result = purgeCSS($testHtml, $cssFilePaths);

if ($result) {
    echo "\n=== SUCCESS ===\n";
} else {
    echo "\n=== FAILED ===\n";
}
?>
