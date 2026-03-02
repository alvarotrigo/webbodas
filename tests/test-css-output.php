<?php
// Test script to capture the generated CSS content

// Read actual section content from the sections directory
$heroSection = file_get_contents('./sections/fp-theme-hero.html');
$featuresSection = file_get_contents('./sections/fp-theme-features.html');
$contactSection = file_get_contents('./sections/fp-theme-contact.html');

// Simulate POST data with real sections
$_POST['sections'] = json_encode([
    [
        'html' => $heroSection
    ],
    [
        'html' => $featuresSection
    ],
    [
        'html' => $contactSection
    ]
]);
$_POST['theme'] = 'theme-candy-shop';
$_POST['fullpageEnabled'] = 'true';
$_POST['animationsEnabled'] = 'true';

// Capture the output to prevent the download
ob_start();

// Include the download script but stop before the download part
include 'download-page.php';

// Get the captured output
$output = ob_get_clean();

// Find the generated CSS file
$tempDir = sys_get_temp_dir() . '/generated-page-*';
$tempDirs = glob($tempDir);

if (!empty($tempDirs)) {
    $latestDir = end($tempDirs);
    $cssFile = $latestDir . '/dist/styles.css';
    
    // Check for the new separate CSS files
    $tailwindFile = $latestDir . '/dist/tailwind.css';
    $sectionsFile = $latestDir . '/dist/sections.css';
    
    echo "=== GENERATED FILES ===\n";
    
    if (file_exists($tailwindFile)) {
        echo "✅ tailwind.css found\n";
        $tailwindContent = file_get_contents($tailwindFile);
        echo "Tailwind CSS size: " . strlen($tailwindContent) . " characters\n";
    } else {
        echo "❌ tailwind.css NOT found\n";
    }
    
    if (file_exists($sectionsFile)) {
        echo "✅ sections.css found\n";
        $sectionsContent = file_get_contents($sectionsFile);
        echo "Sections CSS size: " . strlen($sectionsContent) . " characters\n";
        
        // Check for theme classes in sections.css
        if (strpos($sectionsContent, 'theme-candy-shop') !== false) {
            echo "✅ theme-candy-shop found in sections.css\n";
        } else {
            echo "❌ theme-candy-shop NOT found in sections.css\n";
        }
        
        // Check for other theme classes
        $themeClasses = ['btn-themed', 'heading-themed', 'text-themed-accent', 'bg-themed-primary'];
        foreach ($themeClasses as $class) {
            if (strpos($sectionsContent, $class) !== false) {
                echo "✅ $class found in sections.css\n";
            } else {
                echo "❌ $class NOT found in sections.css\n";
            }
        }
    } else {
        echo "❌ sections.css NOT found\n";
    }
    
    echo "\n=== END ===\n";
} else {
    echo "No temp directories found\n";
}
?>
