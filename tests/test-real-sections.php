<?php
// Test script to simulate the download process with real section content

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

// Include the download script
include 'download-page.php';
?>






