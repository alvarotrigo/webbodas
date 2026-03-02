<?php
// Test script to show the cleaned HTML content

// Function to clean TinyMCE attributes and classes (same as in download-page.php)
function cleanTinyMCEContent($html) {
    // Remove TinyMCE-specific attributes
    $html = preg_replace('/\s+id="mce_\d+"/', '', $html);
    $html = preg_replace('/\s+contenteditable="[^"]*"/', '', $html);
    $html = preg_replace('/\s+spellcheck="[^"]*"/', '', $html);
    $html = preg_replace('/\s+data-mce-style="[^"]*"/', '', $html);
    $html = preg_replace('/\s+style="position: relative;"/', '', $html);
    $html = preg_replace('/\s+style="position: relative; [^"]*"/', '', $html);
    
    // Remove TinyMCE-specific classes using a more robust approach
    $html = preg_replace_callback('/class="([^"]*)"/', function($matches) {
        $classes = explode(' ', $matches[1]);
        $cleanClasses = array_filter($classes, function($class) {
            return $class !== 'mce-content-body' && !empty(trim($class));
        });
        return empty($cleanClasses) ? '' : 'class="' . implode(' ', $cleanClasses) . '"';
    }, $html);
    
    // Clean up any double spaces that might have been created
    $html = preg_replace('/\s+/', ' ', $html);
    
    return $html;
}

// Sample HTML with TinyMCE attributes (simulating what would come from the editor)
$sampleHtml = '<h1 class="text-5xl md:text-7xl lg:text-8xl font-bold mb-8 animate-fade-in-up heading-themed mce-content-body" id="mce_20" contenteditable="true" style="position: relative;" spellcheck="false">Welcome to the <span class="block text-themed-accent mce-content-body" id="mce_21" contenteditable="true" style="position: relative;" spellcheck="false" data-mce-style="position: relative;"> Future </span></h1>
<p class="text-xl md:text-2xl lg:text-3xl mb-12 text-themed-secondary max-w-4xl mx-auto leading-relaxed mce-content-body" id="mce_22" contenteditable="true" style="position: relative;" spellcheck="false">Experience innovation like never before with our cutting-edge solutions that transform the way you work</p>';

echo "=== ORIGINAL HTML WITH TINYMCE ATTRIBUTES ===\n";
echo $sampleHtml;
echo "\n\n=== CLEANED HTML ===\n";
echo cleanTinyMCEContent($sampleHtml);
echo "\n\n=== END ===\n";

// Test with actual section content
$heroSection = file_get_contents('./sections/fp-theme-hero.html');
echo "\n=== ACTUAL SECTION CONTENT (should be clean) ===\n";
echo $heroSection;
echo "\n=== END ACTUAL SECTION ===\n";
?>
