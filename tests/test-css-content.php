<?php
// Test to check the actual CSS content in the generated zip

// Simulate POST data with theme-candy-shop
$_POST['sections'] = json_encode([
    [
        'html' => '<div class="bg-themed-primary"><h1 class="text-themed-primary">Test Section</h1></div>'
    ]
]);
$_POST['theme'] = 'theme-candy-shop';
$_POST['fullpageEnabled'] = 'false';
$_POST['animationsEnabled'] = 'false';

// Capture the output to get the CSS content
ob_start();

// Include the download script but modify it to not output the zip
// We'll extract the CSS content instead
include 'download-page.php';

// Get the captured output
$output = ob_get_clean();

// Extract the CSS content from the temp directory
$tempDir = sys_get_temp_dir() . '/generated-page-*';
$tempDirs = glob($tempDir);

if (!empty($tempDirs)) {
    $latestDir = end($tempDirs);
    $cssFile = $latestDir . '/dist/styles.css';
    
    if (file_exists($cssFile)) {
        $cssContent = file_get_contents($cssFile);
        
        echo "CSS file found: $cssFile\n";
        echo "CSS content length: " . strlen($cssContent) . " bytes\n\n";
        
        // Check for important CSS classes
        $importantClasses = [
            'theme-candy-shop',
            'btn-themed',
            'btn-themed-outline',
            'text-themed-secondary',
            'text-themed-primary',
            'heading-themed',
            'bg-themed-primary'
        ];
        
        echo "Checking for important CSS classes:\n";
        echo "==================================\n";
        
        foreach ($importantClasses as $class) {
            if (strpos($cssContent, $class) !== false) {
                echo "✅ Found: .$class\n";
            } else {
                echo "❌ Missing: .$class\n";
            }
        }
        
        echo "\nSample CSS content (first 500 characters):\n";
        echo "==========================================\n";
        echo substr($cssContent, 0, 500) . "...\n";
        
        // Clean up
        unlink($cssFile);
        rmdir($latestDir . '/dist');
        rmdir($latestDir);
        
    } else {
        echo "CSS file not found: $cssFile\n";
    }
} else {
    echo "No temp directories found\n";
}
?>






