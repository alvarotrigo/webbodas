# Inline Script Generation Update ✅

**Date:** December 17, 2025  
**Status:** ✅ Completed

## Summary

Replaced the separate `section-initializer.js` file in exported HTML with a **minimal inline initialization script** that only includes the necessary code for the specific sections on each page.

## Benefits

✅ **Smaller file size** - No extra file to download  
✅ **Faster loading** - One less HTTP request  
✅ **Optimized** - Only includes initialization for sections actually on the page  
✅ **Cleaner exports** - Fewer files in the export directory  

## Changes Made

### 1. Added Init Function Mapping to PHP

**File:** `includes/section-script-map.php`

Added `getSectionInitMap()` function that maps section IDs to their JavaScript init function names:

```php
function getSectionInitMap() {
    return [
        'fp-theme-faqs' => 'accordionInit',
        'fp-theme-faq-image' => 'accordionInit',
        'fp-theme-popular-questions' => 'popularQuestionsInit',
        // ... etc
    ];
}
```

### 2. Updated Download Page Export

**File:** `download-page.php`

- ✅ Generates inline `<script>` tag with initialization code
- ✅ Only includes init calls for sections actually on the page
- ✅ Removed copying of `section-initializer.js` file
- ✅ Updated README to mention inline script

**Generated inline script example:**

```javascript
<script>
    // Initialize interactive sections on DOMContentLoaded
    document.addEventListener("DOMContentLoaded", function() {
        var section_fp_theme_faqs = document.getElementById("fp-theme-faqs");
        if (section_fp_theme_faqs && typeof window.accordionInit === "function") {
            window.accordionInit(section_fp_theme_faqs);
        }
        var section_fp_theme_popular_questions = document.getElementById("fp-theme-popular-questions");
        if (section_fp_theme_popular_questions && typeof window.popularQuestionsInit === "function") {
            window.popularQuestionsInit(section_fp_theme_popular_questions);
        }
    });
</script>
```

### 3. Updated GitHub Project Export

**File:** `api/generate-html-project.php`

- ✅ Same inline script generation as download page
- ✅ Removed `section-initializer.js` from files array
- ✅ Updated README to mention inline script

### 4. Cleaned Up JavaScript Initializer

**File:** `public/js/section-initializer.js`

- ✅ Removed `scriptMap` (now handled by PHP)
- ✅ Removed `getRequiredScripts()` function (now handled by PHP)
- ✅ Kept `initFunctionMap` for editor use (dynamic section addition)
- ✅ Kept `initSection()` for editor use

**Before:**
- 141 lines
- Included script mapping and deduplication logic
- Used in both editor AND exports

**After:**
- ~100 lines
- Only includes init function mapping
- Used ONLY in editor for dynamic sections

## Example Export Structure

### Before
```
generated-page/
├── index.html
├── README.md
└── dist/
    ├── tailwind.css
    ├── sections.css
    ├── section-initializer.js  ❌ Extra file
    └── sections/
        ├── fp-theme-accordion.js
        └── fp-theme-popular-questions.js
```

### After
```
generated-page/
├── index.html  (with inline init script) ✅
├── README.md
└── dist/
    ├── tailwind.css
    ├── sections.css
    └── sections/
        ├── fp-theme-accordion.js
        └── fp-theme-popular-questions.js
```

## How It Works

1. **User exports page** with FAQ and gallery sections
2. **PHP extracts section IDs** from HTML
3. **PHP looks up init functions** using `getSectionInitMap()`
4. **PHP generates minimal inline script** with only necessary init calls
5. **PHP includes script** directly in HTML
6. **Result:** Optimized export with no extra files

## Test Cases

### ✅ Test 1: Single Section Type
- **Sections:** 3 FAQ sections
- **Scripts included:** `fp-theme-accordion.js`
- **Inline init:** 3 init calls (one per section)
- **Result:** PASS

### ✅ Test 2: Mixed Sections
- **Sections:** FAQ + Gallery + Team Slider
- **Scripts included:** `fp-theme-accordion.js`, `fp-theme-gallery-slider.js`, `fp-theme-team-slider.js`
- **Inline init:** 3 init calls (one per section type)
- **Result:** PASS

### ✅ Test 3: Hybrid Section
- **Sections:** Popular Questions
- **Scripts included:** `fp-theme-popular-questions.js`, `fp-theme-accordion.js`
- **Inline init:** 1 init call for popular questions
- **Result:** PASS

### ✅ Test 4: No Interactive Sections
- **Sections:** Only static sections
- **Scripts included:** None
- **Inline init:** Not generated
- **Result:** PASS

## File Size Comparison

### Before
- `section-initializer.js`: ~4.5 KB
- Total overhead: ~4.5 KB per export

### After
- Inline script (3 sections): ~350 bytes
- Inline script (8 sections): ~700 bytes
- **Savings:** ~3.8-4.1 KB per export ✅

## Backward Compatibility

✅ **Editor:** Still works with `section-initializer.js` for dynamic sections  
✅ **Preview:** Still works with `section-initializer.js` loaded separately  
✅ **Exports:** Now use inline scripts, no breaking changes  

## Synchronization

The init function mapping exists in two places and must be kept in sync:

1. **PHP:** `includes/section-script-map.php` → `getSectionInitMap()`
2. **JavaScript:** `public/js/section-initializer.js` → `initFunctionMap`

**When adding a new interactive section:**
1. Add script file to `public/js/sections/`
2. Add mapping to `getSectionInitMap()` in PHP
3. Add mapping to `getSectionScriptMap()` in PHP
4. Add mapping to `initFunctionMap` in JavaScript
5. Done!

## Conclusion

✅ **Mission Accomplished!**

Exports are now more optimized with:
- Fewer files to download
- Smaller bundle sizes
- Faster page loads
- Cleaner directory structure

The inline script approach ensures that only the necessary initialization code is included, making each export as lean as possible while maintaining full functionality.


