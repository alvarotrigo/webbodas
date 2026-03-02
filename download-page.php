<?php
// Load environment variables
require_once __DIR__ . '/config/env.php';

// Get POST data
$sections = json_decode($_POST['sections'] ?? '[]', true);
$theme = $_POST['theme'] ?? '';
$fullpageEnabled = $_POST['fullpageEnabled'] ?? 'false';
$fullpageSettings = json_decode($_POST['fullpageSettings'] ?? '{}', true);
$animationsEnabled = $_POST['animationsEnabled'] ?? 'false';
$animateBackgroundsEnabled = $_POST['animateBackgroundsEnabled'] ?? 'false';
$isPaid = filter_var($_POST['isPaid'] ?? false, FILTER_VALIDATE_BOOLEAN);
// Full-page template only: when canvas was loaded from a template, include its theme; section-block leaves this empty and is unchanged
$templateId = isset($_POST['templateId']) && $_POST['templateId'] !== '' ? preg_replace('/[^a-z0-9\-_]/i', '', (string) $_POST['templateId']) : '';

// Determine fullPage.js license key based on user's paid status
$fullpageLicenseKey = getenv('FULLPAGE_LICENSE_KEY') ?: 'YOUR_LICENSE_KEY';
if (!$isPaid) {
    // For non-paid users, use placeholder with comment
    $fullpageLicenseKey = 'YOUR_LICENSE_KEY';
}

// Include section script mapping
require_once __DIR__ . '/includes/section-script-map.php';

// Get required scripts from sections
$sectionIds = extractSectionIds($sections);
$requiredScripts = getRequiredScripts($sectionIds);

// Log for debugging
error_log("=== SECTION SCRIPTS ===");
error_log("Sections found: " . count($sections));
error_log("Section IDs: " . (empty($sectionIds) ? '(none extracted)' : implode(', ', $sectionIds)));
error_log("Required scripts: " . (empty($requiredScripts) ? '(none required)' : implode(', ', $requiredScripts)));
if (!empty($sectionIds)) {
    $scriptMap = getSectionScriptMap(); // Get the map for debugging
    foreach ($sectionIds as $sectionId) {
        $scriptFile = isset($scriptMap[$sectionId]) ? 
            (is_array($scriptMap[$sectionId]) ? implode(', ', $scriptMap[$sectionId]) : $scriptMap[$sectionId]) : 
            '(no script needed)';
        error_log("  - $sectionId => $scriptFile");
    }
}

// Function to recursively delete a directory and its contents
function deleteDirectory($dir) {
    if (!file_exists($dir)) {
        return true;
    }
    
    if (!is_dir($dir)) {
        return unlink($dir);
    }
    
    foreach (scandir($dir) as $item) {
        if ($item == '.' || $item == '..') {
            continue;
        }
        
        if (!deleteDirectory($dir . DIRECTORY_SEPARATOR . $item)) {
            return false;
        }
    }
    
    return rmdir($dir);
}

// Function to clean CSS content by removing comments and excessive empty lines
function cleanCSSContent($cssContent) {
    // Remove CSS comments
    $cssContent = preg_replace('/\/\*[\s\S]*?\*\//', '', $cssContent);
    
    // Replace multiple consecutive empty lines with a single empty line
    $cssContent = preg_replace('/\n\s*\n\s*\n+/', "\n\n", $cssContent);
    
    return $cssContent;
}

// Function to purge CSS using external service
function purgeCSS($htmlContent, $cssFilePaths) {
    $purgeUrl = 'http://localhost:3000/purge/purge-with-tailwind?combine=false';
    
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
    
    // Debug: Log what's being sent to the purge service
    error_log("=== PURGE SERVICE REQUEST DATA ===");
    error_log("CSS files count: " . count($cssFiles));
    error_log("HTML content length: " . strlen($htmlContent) . " characters");
    error_log("HTML content preview: " . substr($htmlContent, 0, 200) . "...");
    
    // Debug: Show the exact request data being sent
    error_log("Request data structure:");
    error_log("cssFiles: " . json_encode(array_map(function($file) {
        return [
            'filename' => $file['filename'],
            'content_length' => strlen($file['content'])
        ];
    }, $cssFiles)));
    
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

    // Check if request was successful
    if ($httpCode === 200 && $response) {
        $purgedData = json_decode($response, true);
        if ($purgedData) {
            // Debug: Log the response format
            error_log("Purge response type: " . gettype($purgedData));
            if (is_array($purgedData)) {
                error_log("Purge response keys: " . implode(', ', array_keys($purgedData)));
                // Debug: Log the structure of each key
                foreach ($purgedData as $key => $value) {
                    error_log("Key '$key' type: " . gettype($value));
                    if (is_array($value)) {
                        error_log("Key '$key' array keys: " . implode(', ', array_keys($value)));
                    }
                }
            }
            return $purgedData;
        }
    }
    
    // Return false if purging failed
    return false;
}

// Create a temporary directory for the files
$tempDir = sys_get_temp_dir() . '/generated-page-' . uniqid();
mkdir($tempDir);

// Create subdirectories
mkdir($tempDir . '/dist');

// Generate the HTML content first (without CSS links)
$html = '<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Generated Page</title>';

// Add fullPage.js if enabled
if ($fullpageEnabled === 'true') {
    $html .= '
    <!-- fullPage.js -->
    <link rel="stylesheet" href="https://unpkg.com/fullpage.js/dist/fullpage.min.css">
    <script src="https://unpkg.com/fullpage.js/dist/fullpage.min.js"></script>';
    
    // Add custom navigation color CSS if not default
    if (!empty($fullpageSettings['navigationColor']) && $fullpageSettings['navigationColor'] !== '#333333') {
        $navColor = htmlspecialchars($fullpageSettings['navigationColor']);
        $html .= '
    <style>
        /* Custom navigation bullet color */
        #fp-nav ul li a span {
            background-color: ' . $navColor . ';
        }
    </style>';
    }
}

// Add viewport animations if enabled (animations ON + fullPage OFF)
if ($animationsEnabled === 'true' && $fullpageEnabled !== 'true') {
    $html .= '
    <!-- Viewport Animations (scroll-based) -->
    <link rel="stylesheet" href="./dist/viewport-animations.css">
    <script>
        // Configure viewport animations before script loads
        window.VIEWPORT_ANIMATIONS_CONFIG = {
            enabled: true,
            fullPageActive: false
        };
    </script>
    <script src="./dist/viewport-animations.js"></script>';
}

$html .= '
</head>
<body class="' . htmlspecialchars($theme) . ' fullpage-enabled fp-viewing-0' .
        ($templateId !== '' ? ' theme-' . $templateId : '') .
        ($animationsEnabled === 'true' && $fullpageEnabled === 'true' ? ' animations-enabled' : '') . 
        ($animateBackgroundsEnabled === 'true' ? ' animate-backgrounds' : '') . '">';

// Add fullPage.js container if enabled
if ($fullpageEnabled === 'true') {
    $html .= '
    <div id="fullpage">';
}

// Function to clean TinyMCE attributes and classes
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

// Add sections
foreach ($sections as $section) {
    // Use DOMDocument to properly remove section-menu elements (including nested children)
    $cleanHtml = $section['html'];
    
    // Only process if section-menu exists in the HTML
    if (strpos($cleanHtml, 'section-menu') !== false) {
        // Create a new DOMDocument instance
        $dom = new DOMDocument();
        
        // Suppress errors for HTML5 tags and load the HTML
        libxml_use_internal_errors(true);
        $dom->loadHTML('<?xml encoding="UTF-8">' . $cleanHtml, LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
        libxml_clear_errors();
        
        // Find all elements with class containing "section-menu"
        $xpath = new DOMXPath($dom);
        $menuElements = $xpath->query("//*[contains(concat(' ', normalize-space(@class), ' '), ' section-menu ')]");
        
        // Remove each menu element (this removes all nested children too)
        foreach ($menuElements as $menuElement) {
            if ($menuElement->parentNode) {
                $menuElement->parentNode->removeChild($menuElement);
            }
        }
        
        // Save the cleaned HTML
        $cleanHtml = $dom->saveHTML();
        
        // Remove the XML encoding declaration that we added
        $cleanHtml = str_replace('<?xml encoding="UTF-8">', '', $cleanHtml);
    }
    
    // Clean TinyMCE attributes and classes
    $cleanHtml = cleanTinyMCEContent($cleanHtml);
    
    // Add the cleaned HTML directly
    $html .= $cleanHtml;
}

// Close fullPage.js container if enabled
if ($fullpageEnabled === 'true') {
    $html .= '
    </div>';
}

// Remove editor-only attributes and classes from exported HTML
$html = preg_replace('/\s*\bin-viewport\b/', '', $html); // Remove viewport animation classes
$html = preg_replace('/\s+data-accordion-initialized="[^"]*"/', '', $html); // Remove accordion init flag
$html = preg_replace('/\s+data-popular-questions-initialized="[^"]*"/', '', $html); // Remove popular questions init flag

// Add JavaScript
$html .= '
    <script>';

// Add fullPage.js initialization if enabled
if ($fullpageEnabled === 'true') {
    // Default settings (matching fullPage.js library defaults)
    $defaultSettings = [
        'scrollSpeed' => 700,
        'navigation' => false,
        'disableOnMobile' => false,
        'scrollBar' => false,
        'motionFeel' => 'smooth'
    ];
    
    // Merge with provided settings
    $settings = array_merge($defaultSettings, $fullpageSettings);
    
    // Build fullPage.js config
    // Get your license at: https://alvarotrigo.com/fullPage/pricing
    $config = [
        'licenseKey' => $fullpageLicenseKey,
        'navigationPosition' => 'right',
        'showActiveTooltip' => false,
        'slidesNavigation' => false,
    ];
    
    // Apply scroll speed if enabled
    if ($config['scrollingSpeed'] != 700) {
        $config['scrollingSpeed'] = intval($settings['scrollSpeed'] ?? 700);
    }
    
    // Apply navigation bullets (explicit boolean check)
    $config['navigation'] = ($settings['navigation'] === true || $settings['navigation'] === 'true');
    
    // Apply disable on mobile
    if (!empty($settings['disableOnMobile'])) {
        $config['responsiveWidth'] = 768;
        $config['responsiveHeight'] = 0;
    }
    
    // Apply scroll bar
    $config['scrollBar'] = !empty($settings['scrollBar']);
    
    // Apply motion feel (easingCss3)
    if (!empty($settings['motionFeel']) && $settings['motionFeel'] !== 'smooth') {
        $easingMap = [
            'snappy' => 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            'relaxed' => 'cubic-bezier(0.42, 0, 0.58, 1)'
        ];
        if (isset($easingMap[$settings['motionFeel']])) {
            $config['easingcss3'] = $easingMap[$settings['motionFeel']];
        }
    }
    
    // Convert config to JavaScript object with pretty printing
    $configJson = json_encode($config, JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    
    // Remove quotes from property names for cleaner JavaScript
    $configJson = preg_replace('/"([^"]+)":/', '$1:', $configJson);
    
    // Indent the JSON to match the code indentation
    $configJson = str_replace("\n", "\n            ", $configJson);
    
    $html .= '
        // Initialize fullPage.js
        new fullpage("#fullpage", ' . $configJson . ');';
}

$html .= '
    </script>';

// Add section scripts if any sections require them
if (!empty($requiredScripts)) {
    $html .= '
    
    <!-- Section Scripts -->';
    foreach ($requiredScripts as $scriptFile) {
        $html .= '
    <script src="./dist/sections/' . htmlspecialchars($scriptFile) . '"></script>';
    }
    
    // Generate inline initialization script
    $initMap = getSectionInitMap();
    $sectionsToInit = [];
    
    foreach ($sectionIds as $sectionId) {
        if (isset($initMap[$sectionId])) {
            $sectionsToInit[$sectionId] = $initMap[$sectionId];
        }
    }
    
    if (!empty($sectionsToInit)) {
        $html .= '
    <script>
        // Initialize interactive sections';
        
        foreach ($sectionsToInit as $sectionId => $initFunctionName) {
            $varName = 'section_' . str_replace('-', '_', $sectionId);
            $html .= '
        var ' . $varName . ' = document.getElementById("' . htmlspecialchars($sectionId) . '");
        if (' . $varName . ' && typeof window.' . $initFunctionName . ' === "function") {
            window.' . $initFunctionName . '(' . $varName . ');
        }';
        }
        
        $html .= '
    </script>';
    }
}

$html .= '
</body>
</html>';

// Prepare CSS files for purging
$cssFilePaths = [];

if (file_exists('./dist/output.css')) {
    $cssFilePaths['output.css'] = './dist/output.css';
}

if (file_exists('./public/css/sections.css')) {
    $cssFilePaths['sections.css'] = './public/css/sections.css';
}

// HACK: Create a modified HTML with fp-completely, fp-overflow, and animate-backgrounds classes for purging
// This ensures animation CSS rules are preserved, even though these classes are added dynamically
$htmlForPurge = $html;
if ($fullpageEnabled === 'true' && $animationsEnabled === 'true') {
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
    // Add animate-backgrounds class to body for the purge process
    $htmlForPurge = preg_replace(
        '/<body class="([^"]*)"/',
        '<body class="$1 animate-backgrounds"',
        $htmlForPurge
    );
    error_log('Added fp-completely, fp-overflow, and animate-backgrounds classes for purge (will use original HTML for output)');
}

// Debug: Log the HTML content being sent to purge service
error_log("=== HTML CONTENT BEING SENT TO PURGE SERVICE ===");
error_log($htmlForPurge);
error_log("=== END HTML CONTENT ===");
error_log("HTML content length: " . strlen($htmlForPurge) . " characters");

// Attempt to purge CSS
$purgedCSS = true;
if (!empty($cssFilePaths)) {
    $purgedCSS = purgeCSS($htmlForPurge, $cssFilePaths);
}

if ($purgedCSS) {
    // The API returns separate CSS files when combine=false
    $cssLinks = '';
    
    if (is_array($purgedCSS)) {
        foreach ($purgedCSS as $fileName => $value) {
            $cssContent = '';
            
            // Extract CSS content from the response - handle the API format
            if (is_array($value) && isset($value['css'])) {
                $cssContent = $value['css'];
            } elseif (is_string($value)) {
                $cssContent = $value;
            }
            
            if (!empty($cssContent)) {
                // Determine the new filename
                $newFileName = '';
                if ($fileName === 'output.css') {
                    $newFileName = 'tailwind.css';
                } else {
                    $newFileName = $fileName;
                }
                
                // Debug: Log what we're writing
                error_log("Writing purged CSS for '$fileName' as '$newFileName', content length: " . strlen($cssContent));
                
                // Clean CSS content (remove comments and excessive empty lines)
                $cssContent = cleanCSSContent($cssContent);
                
                // Write the purged CSS file
                file_put_contents($tempDir . '/dist/' . $newFileName, $cssContent);
                
                // Add CSS link to HTML
                $cssLinks .= '    <link rel="stylesheet" href="./dist/' . $newFileName . '">' . "\n";
            } else {
                error_log("No CSS content found for file: $fileName");
            }
        }
    }
    
    // Update HTML to use the separate CSS files
    if (!empty($cssLinks)) {
        $html = str_replace(
            '<title>Generated Page</title>',
            '<title>Generated Page</title>
    
    <!-- Purged CSS Files -->
' . $cssLinks,
            $html
        );
    }
    
    // Add viewport animation files if needed (animations ON + fullPage OFF)
    if ($animationsEnabled === 'true' && $fullpageEnabled !== 'true') {
        if (file_exists('./public/css/viewport-animations.css')) {
            $cssContent = file_get_contents('./public/css/viewport-animations.css');
            // Remove .viewport-animations-only class from CSS for export (no scoping needed in standalone HTML)
            $cssContent = preg_replace('/\.viewport-animations-only\s+/', '', $cssContent);
            file_put_contents($tempDir . '/dist/viewport-animations.css', $cssContent);
            error_log('Added viewport-animations.css to purged export (removed scoping class)');
        }
        
        if (file_exists('./public/js/viewport-animations.js')) {
            $jsContent = file_get_contents('./public/js/viewport-animations.js');
            file_put_contents($tempDir . '/dist/viewport-animations.js', $jsContent);
            error_log('Added viewport-animations.js to purged export');
        }
    }
    
    $cssFileName = 'separate purged files';
} else {
    // Fallback: if purging failed, copy original files
    $cssLinks = '';
    
    if (file_exists('./dist/output.css')) {
        $cssContent = file_get_contents('./dist/output.css');
        // Clean CSS content (remove comments and excessive empty lines)
        $cssContent = cleanCSSContent($cssContent);
        file_put_contents($tempDir . '/dist/tailwind.css', $cssContent);
        $cssLinks .= '    <link rel="stylesheet" href="./dist/tailwind.css">' . "\n";
    }
    
    if (file_exists('./public/css/sections.css')) {
        $cssContent = file_get_contents('./public/css/sections.css');
        // Clean CSS content (remove comments and excessive empty lines)
        $cssContent = cleanCSSContent($cssContent);
        file_put_contents($tempDir . '/dist/sections.css', $cssContent);
        $cssLinks .= '    <link rel="stylesheet" href="./dist/sections.css">' . "\n";
    }
    
    // Add viewport animation files if needed (animations ON + fullPage OFF)
    if ($animationsEnabled === 'true' && $fullpageEnabled !== 'true') {
        if (file_exists('./public/css/viewport-animations.css')) {
            $cssContent = file_get_contents('./public/css/viewport-animations.css');
            // Remove .viewport-animations-only class from CSS for export (no scoping needed in standalone HTML)
            $cssContent = preg_replace('/\.viewport-animations-only\s+/', '', $cssContent);
            file_put_contents($tempDir . '/dist/viewport-animations.css', $cssContent);
            error_log('Added viewport-animations.css to export (removed scoping class)');
        }
        
        if (file_exists('./public/js/viewport-animations.js')) {
            $jsContent = file_get_contents('./public/js/viewport-animations.js');
            file_put_contents($tempDir . '/dist/viewport-animations.js', $jsContent);
            error_log('Added viewport-animations.js to export');
        }
    }
    
    // Update HTML to use the original CSS files
    if (!empty($cssLinks)) {
        $html = str_replace(
            '<title>Generated Page</title>',
            '<title>Generated Page</title>
    
    <!-- Original CSS Files -->
' . $cssLinks,
            $html
        );
    }
    
    $cssFileName = 'original files (unpurged)';
}

// Copy section scripts if needed
if (!empty($requiredScripts)) {
    // Create sections directory
    mkdir($tempDir . '/dist/sections');
    
    // Copy required section scripts
    foreach ($requiredScripts as $scriptFile) {
        $sourcePath = __DIR__ . '/public/js/sections/' . $scriptFile;
        $destPath = $tempDir . '/dist/sections/' . $scriptFile;
        
        if (file_exists($sourcePath)) {
            copy($sourcePath, $destPath);
            error_log("Copied section script: $scriptFile");
        } else {
            error_log("Warning: Section script not found: $scriptFile at $sourcePath");
        }
    }
}

// Add template theme CSS/JS only for full-page templates (templateId set); section-block pages skip this block
$templateThemeAdded = false;
if ($templateId !== '') {
    $themeCssPath = __DIR__ . '/templates/dist/' . $templateId . '/theme.css';
    $themeJsPath = __DIR__ . '/templates/dist/' . $templateId . '/theme.js';
    if (file_exists($themeCssPath) && file_exists($themeJsPath)) {
        copy($themeCssPath, $tempDir . '/dist/theme.css');
        copy($themeJsPath, $tempDir . '/dist/theme.js');
        $templateThemeAdded = true;
        $html = str_replace('</head>', "    <link rel=\"stylesheet\" href=\"./dist/theme.css\">\n</head>", $html);
        $html = str_replace('</body>', "    <script src=\"./dist/theme.js\"></script>\n</body>", $html);
        error_log('Added template theme to download ZIP: dist/theme.css, dist/theme.js for template ' . $templateId);
    }
}

// Write the HTML file to the temporary directory
file_put_contents($tempDir . '/index.html', $html);

// Create a README file
// Build files list
$filesList = '- `index.html` - The main HTML file
- `dist/tailwind.css` - Purged Tailwind CSS utilities (you can replace this with your own compiled Tailwind CSS)
- `dist/sections.css` - Theme and component styles';

if ($animationsEnabled === 'true' && $fullpageEnabled !== 'true') {
    $filesList .= '
- `dist/viewport-animations.css` - Scroll-based animation styles
- `dist/viewport-animations.js` - Intersection Observer for viewport animations';
}

if (!empty($requiredScripts)) {
    $filesList .= '
- `dist/sections/*.js` - Interactive section scripts (' . count($requiredScripts) . ' file' . (count($requiredScripts) !== 1 ? 's' : '') . ')
- Inline initialization script (embedded in HTML)';
}
if ($templateThemeAdded) {
    $filesList .= '
- `dist/theme.css` - Template theme styles
- `dist/theme.js` - Template theme scripts';
}

// Build features list
$featuresList = '';
if ($fullpageEnabled === 'true') {
    $featuresList .= '- FullPage.js integration for smooth full-page scrolling
';
}
if ($animationsEnabled === 'true' && $fullpageEnabled !== 'true') {
    $featuresList .= '- Viewport scroll animations (elements animate as they enter view)
';
}
$featuresList .= '- Responsive design with Tailwind CSS
- Theme: ' . htmlspecialchars($theme) . '
';
if ($purgedCSS) {
    $featuresList .= '- CSS purged for optimal file size
';
}

$readme = '# Generated Page

This is a complete web page generated by the Nine Screen Canvas Flow editor.

## Files included:
' . $filesList . '

## Features:
' . $featuresList . '

## Usage:
1. Extract all files to a web server directory
2. Open `index.html` in a web browser
3. The page should display correctly with all styles and functionality

## Customization:
- **Tailwind CSS**: You can replace `dist/tailwind.css` with your own compiled Tailwind CSS file
- **Theme Styles**: Modify `dist/sections.css` to customize theme colors and component styles
- **FullPage.js**: Uses CDN links, so an internet connection is required if enabled

## Notes:
- All CSS files are included locally for offline use
- The Tailwind CSS file contains only the utilities used in your page (purged for optimal size)
';

file_put_contents($tempDir . '/README.md', $readme);

// Create ZIP file using PHP's ZipArchive (works on all platforms)
$zipFile = $tempDir . '.zip';
$zipCreated = false;

// Try using PHP's ZipArchive class first (most portable)
if (class_exists('ZipArchive')) {
    $zip = new ZipArchive();

    if ($zip->open($zipFile, ZipArchive::CREATE | ZipArchive::OVERWRITE) === true) {
        // Recursively add all files from temp directory
        $files = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($tempDir),
            RecursiveIteratorIterator::LEAVES_ONLY
        );

        foreach ($files as $file) {
            // Skip directories (they will be created automatically)
            if (!$file->isDir()) {
                $filePath = $file->getRealPath();
                $relativePath = 'generated-page/' . substr($filePath, strlen($tempDir) + 1);

                $zip->addFile($filePath, $relativePath);
            }
        }

        $zip->close();
        $zipCreated = file_exists($zipFile);

        if ($zipCreated) {
            error_log("ZIP created successfully using ZipArchive: " . filesize($zipFile) . " bytes");
        } else {
            error_log("ZIP creation failed with ZipArchive");
        }
    } else {
        error_log("Failed to create ZIP file with ZipArchive");
    }
} else {
    error_log("ZipArchive class not available");
}

// Fallback: Try ditto command on Mac if ZipArchive failed
if (!$zipCreated && strpos(PHP_OS, 'Darwin') !== false) {
    exec('which ditto', $output, $returnCode);
    if ($returnCode === 0) {
        $dittoCommand = "ditto -c -k --sequesterRsrc --keepParent " . escapeshellarg($tempDir) . " " . escapeshellarg($zipFile);
        exec($dittoCommand . " 2>&1", $output, $returnCode);

        if ($returnCode === 0 && file_exists($zipFile)) {
            $zipCreated = true;
            error_log("ZIP created successfully using ditto: " . filesize($zipFile) . " bytes");
        } else {
            error_log("Ditto command failed. Return code: $returnCode");
        }
    }
}

// Send ZIP file if created successfully
if ($zipCreated && file_exists($zipFile)) {
    $fileSize = filesize($zipFile);

    // Set proper headers for zip download
    header('Content-Type: application/zip');
    header('Content-Disposition: attachment; filename="generated-page.zip"');
    header('Content-Length: ' . $fileSize);
    header('Cache-Control: no-cache, must-revalidate');
    header('Pragma: no-cache');
    header('Expires: 0');

    // Clear any output buffers
    while (ob_get_level()) {
        ob_end_clean();
    }

    // Output the zip file
    readfile($zipFile);

    // Clean up
    unlink($zipFile);
    deleteDirectory($tempDir);
} else {
    // Fallback: Send single HTML file if ZIP creation failed
    error_log("ZIP creation failed, falling back to single HTML file");

    header('Content-Type: text/html');
    header('Content-Disposition: attachment; filename="generated-page.html"');
    echo $html;

    // Clean up temp directory
    deleteDirectory($tempDir);
}
?> 