# Script Integration - COMPLETED ✅

## Better Approach: Map in PHP

Instead of passing script data from JavaScript to PHP, **create the same mapping in PHP** so the backend can determine required scripts directly from section IDs.

## Benefits

✅ **No frontend changes needed** - Current data flow works as-is  
✅ **Simpler** - Backend extracts section IDs from sections data  
✅ **Single source** - PHP decides everything  
✅ **Cleaner** - Less data passing between frontend/backend  

## Implementation Summary

All steps have been completed successfully!

## Implementation Details

### 1. ✅ Created Script Mapping in PHP

**Created file:** `includes/section-script-map.php`

This file provides three functions:
- `getSectionScriptMap()` - Returns the complete mapping
- `getRequiredScripts($sectionIds)` - Returns deduplicated array of script files
- `extractSectionIds($sections)` - Extracts IDs from sections data

```php
<?php
/**
 * Section to Script File Mapping
 * Maps section IDs to their required JavaScript files
 * Synchronized with public/js/section-initializer.js
 */

function getSectionScriptMap() {
    return [
        // Gallery sections
        'fp-theme-gallery-thumbs' => 'fp-theme-gallery-thumbs.js',
        'fp-theme-gallery-thumbs-fade' => 'fp-theme-gallery-thumbs-fade.js',
        'fp-theme-gallery-slider' => 'fp-theme-gallery-slider.js',
        'fp-theme-gallery-slider-arrows' => 'fp-theme-gallery-slider-arrows.js',
        'fp-theme-gallery-scroll' => 'fp-theme-gallery-scroll.js',
        
        // Team sections
        'fp-theme-team-slider' => 'fp-theme-team-slider.js',
        'fp-theme-team-carousel' => 'fp-theme-team-carousel.js',
        'fp-theme-exceptional-team' => 'fp-theme-exceptional-team.js',
        
        // Testimonial sections
        'fp-theme-testimonial-carousel' => 'fp-theme-testimonial-carousel.js',
        'fp-theme-testimonials-interactive' => 'fp-theme-testimonials-interactive.js',
        
        // Product/slider sections
        'fp-theme-product-slider' => 'fp-theme-product-slider.js',
        'fp-theme-steps-slider' => 'fp-theme-steps-slider.js',
        
        // Pricing
        'fp-theme-pricing-toggle' => 'fp-theme-pricing-toggle.js',
        
        // Generic accordion sections (all share the same script)
        'fp-theme-faqs' => 'fp-theme-accordion.js',
        'fp-theme-faq-image' => 'fp-theme-accordion.js',
        'fp-theme-questions-answers' => 'fp-theme-accordion.js',
        'fp-theme-split-faq' => 'fp-theme-accordion.js',
        'fp-theme-features-accordion' => 'fp-theme-accordion.js',
        
        // Specialized accordion sections
        'fp-theme-process-accordion' => 'fp-theme-process-accordion.js',
        'fp-theme-popular-questions' => ['fp-theme-popular-questions.js', 'fp-theme-accordion.js'] // Hybrid
    ];
}

/**
 * Get required script files for given section IDs (with deduplication)
 * @param array $sectionIds Array of section IDs
 * @return array Array of unique script filenames (sorted)
 */
function getRequiredScripts($sectionIds) {
    $scriptMap = getSectionScriptMap();
    $scripts = [];
    
    foreach ($sectionIds as $sectionId) {
        if (isset($scriptMap[$sectionId])) {
            $scriptFile = $scriptMap[$sectionId];
            
            // Handle both single script and array of scripts
            if (is_array($scriptFile)) {
                foreach ($scriptFile as $file) {
                    $scripts[$file] = true; // Use key to auto-deduplicate
                }
            } else {
                $scripts[$scriptFile] = true;
            }
        }
    }
    
    $uniqueScripts = array_keys($scripts);
    sort($uniqueScripts);
    return $uniqueScripts;
}

/**
 * Extract section IDs from sections data
 * @param array $sections Array of section objects/arrays
 * @return array Array of section IDs
 */
function extractSectionIds($sections) {
    $sectionIds = [];
    
    foreach ($sections as $section) {
        // Handle both array and object format
        if (is_array($section) && isset($section['id'])) {
            $sectionIds[] = $section['id'];
        } elseif (is_object($section) && isset($section->id)) {
            $sectionIds[] = $section->id;
        }
    }
    
    return $sectionIds;
}
```

### 2. ✅ Updated download-page.php

**File:** `download-page.php`

**Changes made:**
1. Included the script mapping at the top
2. Extracted section IDs and calculated required scripts
3. Added script tags to HTML before `</body>`
4. Copied script files to export directory
5. Updated README to mention section scripts

**Implementation (added near top):**

```php
<?php
// Get POST data
$sections = json_decode($_POST['sections'] ?? '[]', true);
$theme = $_POST['theme'] ?? '';
$fullpageEnabled = $_POST['fullpageEnabled'] ?? 'false';
$animationsEnabled = $_POST['animationsEnabled'] ?? 'false';

// NEW: Include script mapping
require_once __DIR__ . '/includes/section-script-map.php';

// NEW: Get required scripts from sections
$sectionIds = extractSectionIds($sections);
$requiredScripts = getRequiredScripts($sectionIds);

// Log for debugging
error_log("Sections found: " . count($sections));
error_log("Section IDs: " . implode(', ', $sectionIds));
error_log("Required scripts: " . implode(', ', $requiredScripts));
```

**Script tags added before `</body>`:**

```php
// Add section scripts
if (!empty($requiredScripts)) {
    $html .= "\n    <!-- Section Scripts -->\n";
    foreach ($requiredScripts as $scriptFile) {
        $html .= '    <script src="./dist/sections/' . htmlspecialchars($scriptFile) . '"></script>' . "\n";
    }
    $html .= '    <script src="./dist/section-initializer.js"></script>' . "\n";
}

$html .= '</body>
</html>';
```

**Files copied to export:**

```php
// Create sections directory
if (!empty($requiredScripts)) {
    mkdir($tempDir . '/dist/sections');
    
    // Copy required section scripts
    foreach ($requiredScripts as $scriptFile) {
        $sourcePath = __DIR__ . '/public/js/sections/' . $scriptFile;
        $destPath = $tempDir . '/dist/sections/' . $scriptFile;
        
        if (file_exists($sourcePath)) {
            copy($sourcePath, $destPath);
        } else {
            error_log("Warning: Section script not found: $scriptFile");
        }
    }
    
    // Copy section-initializer.js
    copy(__DIR__ . '/public/js/section-initializer.js', $tempDir . '/dist/section-initializer.js');
}
```

### 3. ✅ Updated generate-html-project.php

**File:** `api/generate-html-project.php`

**Changes made:**
1. Included the script mapping after getting input
2. Extracted section IDs and calculated required scripts
3. Added script tags to HTML before `</body>`
4. Added script files to $files array
5. Updated README to mention section scripts

**Implementation (added after getting input):**

```php
$sections = $input['sections'];
$theme = $input['theme'] ?? 'theme-light-minimal';
$fullpageEnabled = $input['fullpageEnabled'] ?? 'false';
$animationsEnabled = $input['animationsEnabled'] ?? 'false';
$projectName = $input['projectName'] ?? 'fpstudio-website';

// NEW: Include script mapping
require_once __DIR__ . '/../includes/section-script-map.php';

// NEW: Get required scripts from sections
$sectionIds = extractSectionIds($sections);
$requiredScripts = getRequiredScripts($sectionIds);
```

**Script tags added before `</body>`:**

```php
// Add section scripts
if (!empty($requiredScripts)) {
    $html .= "\n    <!-- Section Scripts -->\n";
    foreach ($requiredScripts as $scriptFile) {
        $html .= '    <script src="./dist/sections/' . htmlspecialchars($scriptFile) . '"></script>' . "\n";
    }
    $html .= '    <script src="./dist/section-initializer.js"></script>' . "\n";
}

$html .= '</body>
</html>';
```

**Files added to $files array:**

```php
// Add section scripts to files array
if (!empty($requiredScripts)) {
    foreach ($requiredScripts as $scriptFile) {
        $sourcePath = __DIR__ . '/../public/js/sections/' . $scriptFile;
        if (file_exists($sourcePath)) {
            $files['dist/sections/' . $scriptFile] = file_get_contents($sourcePath);
        }
    }
    
    // Add section-initializer.js
    $files['dist/section-initializer.js'] = file_get_contents(__DIR__ . '/../public/js/section-initializer.js');
}
```

## Example Flow (PHP-Based)

### User has page with these sections:
```json
[
  {"id": "fp-theme-faqs", "html": "..."},
  {"id": "fp-theme-faq-image", "html": "..."},
  {"id": "fp-theme-team-slider", "html": "..."}
]
```

### Backend receives sections and extracts IDs:
```php
$sections = json_decode($_POST['sections'], true);
$sectionIds = extractSectionIds($sections);
// ['fp-theme-faqs', 'fp-theme-faq-image', 'fp-theme-team-slider']
```

### Backend calculates required scripts:
```php
$requiredScripts = getRequiredScripts($sectionIds);
// ['fp-theme-accordion.js', 'fp-theme-team-slider.js']
// Note: Only ONE accordion script for both FAQ sections!
```

### Backend generates HTML with:
```html
<body>
  <!-- sections here -->
  
  <!-- Section Scripts -->
  <script src="./dist/sections/fp-theme-accordion.js"></script>
  <script src="./dist/sections/fp-theme-team-slider.js"></script>
  <script src="./dist/section-initializer.js"></script>
</body>
```

### Backend copies to export:
```
dist/
  sections/
    fp-theme-accordion.js
    fp-theme-team-slider.js
  section-initializer.js
```

## Files That Have Been Created/Modified

1. ✅ `public/js/section-initializer.js` - DONE (array in scriptMap)
2. ✅ `includes/section-script-map.php` - CREATED with PHP version of script mapping
3. ✅ `download-page.php` - MODIFIED to use mapping and include scripts
4. ✅ `api/generate-html-project.php` - MODIFIED to use mapping and include scripts

## Result

✅ **COMPLETED** - Exported HTML pages now include only the necessary JavaScript files for interactive sections!

## How It Works

1. **User creates page** with various sections (e.g., FAQs, carousels, galleries)
2. **PHP receives sections data** via POST/JSON
3. **PHP extracts section IDs** from the sections array
4. **PHP looks up required scripts** using `section-script-map.php`
5. **PHP deduplicates scripts** (e.g., 5 FAQ sections = 1 accordion script)
6. **PHP adds `<script>` tags** to HTML before `</body>`
7. **PHP copies/includes files** in the export
8. **Result:** Minimal, optimized JavaScript bundle with only what's needed!

## Advantages of PHP Approach

✅ No frontend changes needed  
✅ Backend has full control  
✅ Simpler data flow  
✅ Easy to maintain (one file to update when adding sections)  
✅ Same deduplication logic as JavaScript version

