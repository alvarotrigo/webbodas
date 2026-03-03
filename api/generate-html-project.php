<?php
/**
 * HTML Project Generator for GitHub Export
 * REUSES the exact same logic as download-page.php
 * Returns files as JSON instead of creating a ZIP
 */

header('Content-Type: application/json');

// Load environment variables
require_once __DIR__ . '/../config/env.php';

// Get POST data
$input = json_decode(file_get_contents('php://input'), true);

if (!$input || !isset($input['fullHtml'])) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'Invalid input data. fullHtml required.'
    ]);
    exit;
}

$fullHtml = $input['fullHtml'] ?? '';
$theme = $input['theme'] ?? 'theme-light-minimal';
$fullpageEnabled = $input['fullpageEnabled'] ?? 'false';
$fullpageSettings = $input['fullpageSettings'] ?? [];
$animationsEnabled = $input['animationsEnabled'] ?? 'false';
$animateBackgroundsEnabled = $input['animateBackgroundsEnabled'] ?? 'false';
$projectName = $input['projectName'] ?? 'fpstudio-website';
$isPaid = filter_var($input['isPaid'] ?? false, FILTER_VALIDATE_BOOLEAN);
$templateId = isset($input['templateId']) && $input['templateId'] !== '' && $input['templateId'] !== null
    ? preg_replace('/[^a-z0-9\-_]/i', '', (string) $input['templateId'])
    : '';

// Determine fullPage.js license key based on user's paid status
$fullpageLicenseKey = getenv('FULLPAGE_LICENSE_KEY') ?: 'YOUR_LICENSE_KEY';
if (!$isPaid) {
    // For non-paid users, use placeholder with comment
    $fullpageLicenseKey = 'YOUR_LICENSE_KEY';
}

// Include section script mapping
require_once __DIR__ . '/../includes/section-script-map.php';

// Extraer IDs de sección del fullHtml para determinar scripts necesarios
$sectionIds = extractSectionIdsFromFullHtml($fullHtml);
$requiredScripts = getRequiredScripts($sectionIds);

// Log for debugging
error_log("=== HTML PROJECT SECTION SCRIPTS ===");
error_log("fullHtml length: " . strlen($fullHtml));
error_log("Section IDs: " . implode(', ', $sectionIds));
error_log("Required scripts: " . implode(', ', $requiredScripts));

// ============================================================================
// REUSE EXACT FUNCTIONS FROM download-page.php
// ============================================================================

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
    
    $payload = json_encode([
        'html' => $htmlContent,
        'cssFiles' => $cssFiles
    ]);
    
    $ch = curl_init($purgeUrl);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Content-Length: ' . strlen($payload)
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    
    // Check if request was successful
    if ($httpCode === 200 && $response) {
        $purgedData = json_decode($response, true);
        if ($purgedData) {
            return $purgedData;
        }
    }
    
    // Return false if purging failed
    return false;
}

// Function to clean TinyMCE attributes and classes
function cleanTinyMCEContent($html) {
    // Remove TinyMCE-specific attributes
    $html = preg_replace('/\s*data-mce-[a-z-]+=["\'](.*?)["\']/i', '', $html);
    $html = preg_replace('/\s*contenteditable=["\'](.*?)["\']/i', '', $html);
    
    // Remove TinyMCE classes
    $html = preg_replace('/\bmce-content-body\b/', '', $html);
    
    // Clean up any double spaces that might have been created
    $html = preg_replace('/\s{2,}/', ' ', $html);
    
    // Clean up class attributes that might be empty now
    $html = preg_replace('/\s*class=["\']["\']/', '', $html);
    
    return $html;
}

// ============================================================================
// GENERATE HTML - EXACT SAME AS download-page.php
// ============================================================================

try {
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
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/fullPage.js/4.0.37/fullpage.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/fullPage.js/4.0.37/fullpage.min.js"></script>';
        
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
        ($templateId ? ' theme-' . $templateId : '') . 
        ($animationsEnabled === 'true' && $fullpageEnabled === 'true' ? ' animations-enabled' : '') . 
        ($animateBackgroundsEnabled === 'true' ? ' animate-backgrounds' : '') . '">';

    // Insertar el HTML completo del template
    $cleanedFullHtml = cleanTinyMCEContent($fullHtml);

    if ($fullpageEnabled === 'true' && !empty($cleanedFullHtml)) {
        // Separar nav de secciones+footer para el wrapper de fullPage.js
        $dom = new DOMDocument();
        libxml_use_internal_errors(true);
        $dom->loadHTML('<?xml encoding="UTF-8"><div id="_fp_wrap_">' . $cleanedFullHtml . '</div>', LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
        libxml_clear_errors();

        $xpath = new DOMXPath($dom);
        $wrapper = $xpath->query('//*[@id="_fp_wrap_"]')->item(0);

        $navHtml = '';
        $sectionsHtml = '';

        if ($wrapper) {
            foreach ($wrapper->childNodes as $node) {
                if ($node->nodeType !== XML_ELEMENT_NODE) continue;
                $tag = strtolower($node->nodeName);
                $nodeHtml = $dom->saveHTML($node);
                if ($tag === 'section' || $tag === 'footer') {
                    $sectionsHtml .= $nodeHtml;
                } else {
                    $navHtml .= $nodeHtml;
                }
            }
        }

        $html .= $navHtml;
        $html .= '<div id="fullpage">';
        $html .= $sectionsHtml;
        $html .= '</div>';
    } else {
        $html .= $cleanedFullHtml;
    }

    // Remove editor-only attributes and classes from exported HTML
    $html = preg_replace('/\s*\bin-viewport\b/', '', $html); // Remove viewport animation classes
    $html = preg_replace('/\s+data-accordion-initialized="[^"]*"/', '', $html); // Remove accordion init flag
    $html = preg_replace('/\s+data-popular-questions-initialized="[^"]*"/', '', $html); // Remove popular questions init flag

    // Add fullPage.js initialization if enabled
    if ($fullpageEnabled === 'true') {
        // Default settings (matching fullPage.js library defaults)
        $defaultSettings = [
            'scrollSpeedEnabled' => false,
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
            'autoScrolling' => true,
            'scrollHorizontally' => true,
            'navigationPosition' => 'right',
            'showActiveTooltip' => false,
            'slidesNavigation' => false,
            'controlArrows' => true,
            'licenseKey' => $fullpageLicenseKey
        ];
        
        // Apply scroll speed if enabled
        if (!empty($settings['scrollSpeedEnabled'])) {
            $config['scrollingSpeed'] = intval($settings['scrollSpeed'] ?? 700);
        } else {
            $config['scrollingSpeed'] = 700; // Default
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
        
        // Convert config to JavaScript object
        $configJson = json_encode($config, JSON_UNESCAPED_SLASHES);
        
        $html .= '
    <script>
        new fullpage("#fullpage", ' . $configJson . ');
    </script>';
    }

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
        // Initialize interactive sections on DOMContentLoaded
        document.addEventListener("DOMContentLoaded", function() {';
            
            foreach ($sectionsToInit as $sectionId => $initFunctionName) {
                $varName = 'section_' . str_replace('-', '_', $sectionId);
                $html .= '
            var ' . $varName . ' = document.getElementById("' . htmlspecialchars($sectionId) . '");
            if (' . $varName . ' && typeof window.' . $initFunctionName . ' === "function") {
                window.' . $initFunctionName . '(' . $varName . ');
            }';
            }
            
            $html .= '
        });
    </script>';
        }
    }

    $html .= '
</body>
</html>';

    // ============================================================================
    // PURGE CSS - EXACT SAME AS download-page.php
    // ============================================================================

    $files = [];
    $cssLinks = '';
    $purgedCSS = false;

    // HACK: Create a modified HTML with fp-completely and fp-overflow classes for purging
    // This ensures animation CSS rules are preserved, even though these classes are added dynamically
    $htmlForPurge = $html;
    if ($fullpageEnabled === 'true' && $animationsEnabled === 'true') {
        // Add fp-completely to all .section elements for the purge process
        $htmlForPurge = preg_replace(
            '/<div class="section">/',
            '<div class="section fp-completely">',
            $htmlForPurge
        );
        // Add fp-overflow class to any div elements (common wrapper for animated content)
        $htmlForPurge = preg_replace(
            '/<div>/',
            '<div class="fp-overflow">',
            $htmlForPurge,
            10  // Limit to first 10 occurrences to ensure the class is in the purge
        );
        error_log('Added fp-completely and fp-overflow classes to sections for purge (will use original HTML for output)');
    }

    // Try to purge CSS
    $cssFilePaths = [
        'tailwind.css' => __DIR__ . '/../dist/output.css',
        'sections.css' => __DIR__ . '/../public/css/sections.css'
    ];
    
    error_log('Looking for CSS files:');
    error_log('  tailwind: ' . $cssFilePaths['tailwind.css'] . ' (exists: ' . (file_exists($cssFilePaths['tailwind.css']) ? 'YES' : 'NO') . ')');
    error_log('  sections: ' . $cssFilePaths['sections.css'] . ' (exists: ' . (file_exists($cssFilePaths['sections.css']) ? 'YES' : 'NO') . ')');

    error_log('=== HTML PROJECT GENERATION DEBUG ===');
    error_log('About to purge CSS...');
    
    $purgedData = purgeCSS($htmlForPurge, $cssFilePaths);
    
    error_log('Purge result: ' . ($purgedData ? 'SUCCESS' : 'FAILED'));

    if ($purgedData && is_array($purgedData)) {
        $purgedCSS = true;
        
        // Handle separate files
        if (isset($purgedData['tailwind.css']) && isset($purgedData['sections.css'])) {
            $tailwindContent = $purgedData['tailwind.css'];
            $sectionsContent = $purgedData['sections.css'];
            
            // Clean CSS content
            $tailwindContent = cleanCSSContent($tailwindContent);
            $sectionsContent = cleanCSSContent($sectionsContent);
            
            // Add to files array
            $files['dist/tailwind.css'] = $tailwindContent;
            $files['dist/sections.css'] = $sectionsContent;
            
            error_log('Added dist/tailwind.css (' . strlen($tailwindContent) . ' bytes)');
            error_log('Added dist/sections.css (' . strlen($sectionsContent) . ' bytes)');
            
            // Update HTML to reference CSS files
            $cssLinks = '    <link rel="stylesheet" href="./dist/tailwind.css">' . "\n" .
                       '    <link rel="stylesheet" href="./dist/sections.css">';
        }
    } else {
        error_log('Purge failed or returned non-array, using fallback...');
        
        // Fallback: if purging failed, copy original files
        $tailwindPath = __DIR__ . '/../dist/output.css';
        $sectionsPath = __DIR__ . '/../public/css/sections.css';
        
        if (file_exists($tailwindPath)) {
            $cssContent = file_get_contents($tailwindPath);
            $cssContent = cleanCSSContent($cssContent);
            $files['dist/tailwind.css'] = $cssContent;
            $cssLinks .= '    <link rel="stylesheet" href="./dist/tailwind.css">' . "\n";
            error_log('Fallback: Added dist/tailwind.css (' . strlen($cssContent) . ' bytes)');
        } else {
            error_log('ERROR: ' . $tailwindPath . ' not found!');
        }
        
        if (file_exists($sectionsPath)) {
            $cssContent = file_get_contents($sectionsPath);
            $cssContent = cleanCSSContent($cssContent);
            $files['dist/sections.css'] = $cssContent;
            $cssLinks .= '    <link rel="stylesheet" href="./dist/sections.css">' . "\n";
            error_log('Fallback: Added dist/sections.css (' . strlen($cssContent) . ' bytes)');
        } else {
            error_log('ERROR: ' . $sectionsPath . ' not found!');
        }
    }

    // Update HTML with CSS links
    if (!empty($cssLinks)) {
        $html = str_replace(
            '<title>Generated Page</title>',
            '<title>Generated Page</title>
    
    <!-- CSS Files -->
' . $cssLinks,
            $html
        );
    }

    // Add template theme CSS/JS from templates/dist/<templateId>/ when canvas was loaded from a template
    if ($templateId !== '') {
        $themeCssPath = __DIR__ . '/../templates/dist/' . $templateId . '/theme.css';
        $themeJsPath = __DIR__ . '/../templates/dist/' . $templateId . '/theme.js';
        if (file_exists($themeCssPath) && file_exists($themeJsPath)) {
            $files['dist/theme.css'] = file_get_contents($themeCssPath);
            $files['dist/theme.js'] = file_get_contents($themeJsPath);
            if (!empty($cssLinks)) {
                $html = str_replace($cssLinks, $cssLinks . "\n    <link rel=\"stylesheet\" href=\"./dist/theme.css\">", $html);
            } else {
                $html = str_replace('</head>', "    <link rel=\"stylesheet\" href=\"./dist/theme.css\">\n</head>", $html);
            }
            $html = str_replace('</body>', "    <script src=\"./dist/theme.js\"></script>\n</body>", $html);
            error_log('Added template theme: dist/theme.css, dist/theme.js for template ' . $templateId);
        }
    }

    // Add viewport animation files if needed (animations ON + fullPage OFF)
    if ($animationsEnabled === 'true' && $fullpageEnabled !== 'true') {
        $viewportCSSPath = __DIR__ . '/../public/css/viewport-animations.css';
        $viewportJSPath = __DIR__ . '/../public/js/viewport-animations.js';
        
        if (file_exists($viewportCSSPath)) {
            $cssContent = file_get_contents($viewportCSSPath);
            // Remove .viewport-animations-only class from CSS for export (no scoping needed in standalone HTML)
            $cssContent = preg_replace('/\.viewport-animations-only\s+/', '', $cssContent);
            $files['dist/viewport-animations.css'] = $cssContent;
            error_log('Added dist/viewport-animations.css (' . strlen($files['dist/viewport-animations.css']) . ' bytes, removed scoping class)');
        } else {
            error_log('WARNING: viewport-animations.css not found at ' . $viewportCSSPath);
        }
        
        if (file_exists($viewportJSPath)) {
            $files['dist/viewport-animations.js'] = file_get_contents($viewportJSPath);
            error_log('Added dist/viewport-animations.js (' . strlen($files['dist/viewport-animations.js']) . ' bytes)');
        } else {
            error_log('WARNING: viewport-animations.js not found at ' . $viewportJSPath);
        }
    }

    // Add section scripts to files array
    if (!empty($requiredScripts)) {
        foreach ($requiredScripts as $scriptFile) {
            $sourcePath = __DIR__ . '/../public/js/sections/' . $scriptFile;
            if (file_exists($sourcePath)) {
                $files['dist/sections/' . $scriptFile] = file_get_contents($sourcePath);
                error_log("Added section script to files: $scriptFile (" . strlen($files['dist/sections/' . $scriptFile]) . " bytes)");
            } else {
                error_log("Warning: Section script not found: $scriptFile at $sourcePath");
            }
        }
    }

    // Add index.html to files
    $files['index.html'] = $html;

    // ============================================================================
    // CREATE README - EXACT SAME AS download-page.php
    // ============================================================================

    // Build files list for README
    $filesList = '- `index.html` - The main HTML file
- `dist/tailwind.css` - Purged Tailwind CSS utilities
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
2. Open index.html in your browser or deploy to any hosting service

## Deployment:

### GitHub Pages
1. This repository is ready for GitHub Pages
2. Go to Settings > Pages in your GitHub repository
3. Select the branch and save

### Netlify
1. Connect your GitHub repository to Netlify
2. Deploy automatically on push

### Vercel
1. Import your GitHub repository
2. Deploy with zero configuration

## Customization:
- Edit index.html to modify content
- Edit CSS files in dist/ folder to change styles
- Current theme: ' . htmlspecialchars($theme) . '

Created with ❤️ by FPStudio
';

    $files['README.md'] = $readme;

    // ============================================================================
    // RETURN FILES FOR GITHUB PUSH
    // ============================================================================

    error_log('Final files array has ' . count($files) . ' files:');
    foreach ($files as $path => $content) {
        error_log('  - ' . $path . ' (' . strlen($content) . ' bytes)');
    }

    echo json_encode([
        'success' => true,
        'files' => $files,
        'projectName' => $projectName,
        'message' => 'HTML project generated successfully'
    ]);

} catch (Exception $e) {
    error_log('HTML project generation error: ' . $e->getMessage());
    
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Failed to generate HTML project: ' . $e->getMessage()
    ]);
}
?>
