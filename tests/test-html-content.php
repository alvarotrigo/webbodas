<?php
// Test to show the exact HTML content being sent to the purge service

// Simulate POST data with theme-candy-shop
$_POST['sections'] = json_encode([
    [
        'html' => '<div class="bg-themed-primary"><h1 class="text-themed-primary">Test Section</h1></div>'
    ]
]);
$_POST['theme'] = 'theme-candy-shop';
$_POST['fullpageEnabled'] = 'false';
$_POST['animationsEnabled'] = 'false';

// Generate the HTML content exactly as done in download-page.php
$html = '<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Generated Page</title>';

// Add fullPage.js if enabled
if ($_POST['fullpageEnabled'] === 'true') {
    $html .= '
    <!-- fullPage.js -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/fullPage.js/4.0.37/fullpage.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/fullPage.js/4.0.37/fullpage.min.js"></script>';
}

$html .= '
</head>
<body class="' . htmlspecialchars($_POST['theme']) . ' fullpage-enabled fp-viewing-0' . 
        ($_POST['animationsEnabled'] === 'true' && $_POST['fullpageEnabled'] === 'true' ? ' animations-enabled' : '') . '">';

// Add fullPage.js container if enabled
if ($_POST['fullpageEnabled'] === 'true') {
    $html .= '
    <div id="fullpage">';
}

// Add sections
$sections = json_decode($_POST['sections'] ?? '[]', true);
foreach ($sections as $section) {
    // Remove section-menu elements from the HTML
    $cleanHtml = preg_replace('/<div[^>]*class="[^"]*section-menu[^"]*"[^>]*>.*?<\/div>/s', '', $section['html']);
    
    // Add the cleaned HTML directly
    $html .= $cleanHtml;
}

// Close fullPage.js container if enabled
if ($_POST['fullpageEnabled'] === 'true') {
    $html .= '
    </div>';
}

// Add JavaScript
$html .= '
    <script>';

// Add fullPage.js initialization if enabled
if ($_POST['fullpageEnabled'] === 'true') {
    $html .= '
        // Initialize fullPage.js
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
        });';
}

$html .= '
    </script>
</body>
</html>';

// HACK: Create a modified HTML with fp-completely and fp-overflow classes for purging
// This ensures animation CSS rules are preserved, even though these classes are added dynamically
$htmlForPurge = $html;
if ($_POST['fullpageEnabled'] === 'true' && $_POST['animationsEnabled'] === 'true') {
    // Add fp-completely to all elements with class="section" for the purge process
    $htmlForPurge = preg_replace(
        '/class="([^"]*\bsection\b[^"]*)"/',
        'class="$1 fp-completely"',
        $htmlForPurge
    );
    // Add fp-overflow class to any div elements (common wrapper for animated content)
    $htmlForPurge = preg_replace(
        '/<div>/',
        '<div class="fp-overflow">',
        $htmlForPurge,
        10  // Limit to first 10 occurrences to ensure the class is in the purge
    );
    echo "NOTE: Added fp-completely and fp-overflow classes for purge (would use original HTML for output)\n\n";
}

echo "HTML content being sent to purge service:\n";
echo "=========================================\n";
echo $htmlForPurge;
echo "\n\nHTML content length: " . strlen($html) . " characters\n";

// Check for important classes in the HTML
$importantClasses = [
    'theme-candy-shop',
    'btn-themed',
    'btn-themed-outline',
    'text-themed-secondary',
    'text-themed-primary',
    'heading-themed',
    'bg-themed-primary',
    'fp-completely',  // Should be in htmlForPurge if animations + fullPage are enabled
    'fp-overflow'     // Should be in htmlForPurge if animations + fullPage are enabled
];

echo "\nChecking for important classes in HTML:\n";
echo "========================================\n";

foreach ($importantClasses as $class) {
    if (strpos($htmlForPurge, $class) !== false) {
        echo "✅ Found: $class\n";
    } else {
        echo "❌ Missing: $class\n";
    }
}
?>






