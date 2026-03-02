# Script Management for Exports

## Overview

The `SectionInitializer` now includes intelligent script management that automatically deduplicates scripts when multiple sections share the same JavaScript file.

## Problem Solved

Previously, if you had 5 FAQ sections on a page, you might have tried to load 5 different FAQ scripts. Now, all FAQ sections share a single `fp-theme-accordion.js` file, loaded only once.

## Usage for Exports

### Get Required Scripts for Sections

Use the `getRequiredScripts()` method to get a deduplicated list of script files needed for specific sections:

```javascript
// Example: Get scripts needed for a page with multiple sections
const sectionIds = [
  'fp-theme-faqs',
  'fp-theme-faq-image',
  'fp-theme-questions-answers',
  'fp-theme-gallery-slider',
  'fp-theme-team-carousel'
];

const requiredScripts = window.SectionInitializer.getRequiredScripts(sectionIds);

console.log(requiredScripts);
// Output: [
//   'fp-theme-accordion.js',      // Shared by 3 FAQ sections
//   'fp-theme-gallery-slider.js',
//   'fp-theme-team-carousel.js'
// ]
```

### Script Deduplication

The method automatically handles:

1. **Shared Scripts**: Multiple sections using the same script file
   - 5 FAQ sections → 1 `fp-theme-accordion.js` file

2. **Hybrid Scripts**: Sections that need multiple scripts
   - `fp-theme-popular-questions` → Both `fp-theme-popular-questions.js` AND `fp-theme-accordion.js`

3. **Sorted Output**: Scripts returned in alphabetical order for consistency

## Script Mapping

### Sections Using Generic Accordion (Share Script)

All these sections use `fp-theme-accordion.js`:
- `fp-theme-faqs`
- `fp-theme-faq-image`
- `fp-theme-questions-answers`
- `fp-theme-split-faq`
- `fp-theme-features-accordion`

### Sections with Unique Scripts

Each of these has its own script:
- Gallery sections: `fp-theme-gallery-*.js`
- Team sections: `fp-theme-team-*.js`
- Testimonial sections: `fp-theme-testimonial-*.js`
- Process accordion: `fp-theme-process-accordion.js`
- Popular questions: `fp-theme-popular-questions.js` (+ generic accordion)

## Integration Example

### For HTML Export

```javascript
function generateHTMLExport(sections) {
  // Get section IDs
  const sectionIds = sections.map(s => s.id);
  
  // Get required scripts (deduplicated)
  const scriptFiles = window.SectionInitializer.getRequiredScripts(sectionIds);
  
  // Generate script tags
  const scriptTags = scriptFiles.map(file => 
    `<script src="./js/sections/${file}"></script>`
  ).join('\n    ');
  
  // Build HTML
  const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Exported Page</title>
    <link rel="stylesheet" href="./css/styles.css">
</head>
<body>
    ${sections.map(s => s.html).join('\n    ')}
    
    <!-- Required section scripts -->
    ${scriptTags}
    
    <!-- Section initializer -->
    <script src="./js/section-initializer.js"></script>
</body>
</html>
  `;
  
  return html;
}
```

### For React/Static Export

```javascript
function getScriptsForReactExport(sections) {
  const sectionIds = sections.map(s => s.id);
  const scriptFiles = window.SectionInitializer.getRequiredScripts(sectionIds);
  
  // Return list of files to copy
  return scriptFiles.map(file => ({
    source: `public/js/sections/${file}`,
    destination: `dist/js/sections/${file}`
  }));
}
```

## Benefits

### Before (Without Deduplication)
```javascript
// Page with 3 FAQ sections
const scripts = [
  'fp-theme-faqs.js',              // ❌ Doesn't exist
  'fp-theme-faq-image.js',         // ❌ Removed
  'fp-theme-questions-answers.js'  // ❌ Doesn't exist
];
// Result: 404 errors, broken functionality
```

### After (With Deduplication)
```javascript
// Page with 3 FAQ sections
const scripts = [
  'fp-theme-accordion.js'  // ✅ Loaded once, works for all 3 sections
];
// Result: Clean, efficient, working
```

## Script File Status

### ✅ Active Scripts (Keep These)
- `fp-theme-accordion.js` - **Generic accordion** (shared by 5 sections)
- `fp-theme-process-accordion.js` - Specialized process accordion
- `fp-theme-popular-questions.js` - Category-based FAQ (hybrid)
- All gallery, team, testimonial, product, pricing scripts

### ❌ Deprecated Scripts (Safe to Delete)
- ~~`fp-theme-features-accordion.js`~~ → Now uses generic accordion
- ~~`fp-theme-faq-image.js`~~ → Now uses generic accordion
- ~~`fp-theme-split-faq.js`~~ → Now uses generic accordion

## Preview.html Updates

The `preview.html` file has been updated to only load necessary scripts:

```html
<!-- Generic Accordion script (used by multiple FAQ sections) -->
<script src="./public/js/sections/fp-theme-accordion.js"></script>

<!-- Specialized accordion scripts -->
<script src="./public/js/sections/fp-theme-process-accordion.js"></script>
<script src="./public/js/sections/fp-theme-popular-questions.js"></script>
```

Instead of loading separate scripts for each FAQ section.

## API Reference

### `window.SectionInitializer.getRequiredScripts(sectionIds)`

**Parameters:**
- `sectionIds` (Array<string>): Array of section IDs

**Returns:**
- Array<string>: Sorted array of unique script filenames

**Example:**
```javascript
const scripts = window.SectionInitializer.getRequiredScripts([
  'fp-theme-faqs',
  'fp-theme-faq-image',
  'fp-theme-team-slider'
]);

console.log(scripts);
// ['fp-theme-accordion.js', 'fp-theme-team-slider.js']
```

### `window.SectionInitializer.scriptMap`

Object mapping section IDs to their required script files.

**Example:**
```javascript
console.log(window.SectionInitializer.scriptMap['fp-theme-faqs']);
// 'fp-theme-accordion.js'

console.log(window.SectionInitializer.scriptMap['fp-theme-popular-questions']);
// 'fp-theme-popular-questions.js'
```

## Notes

- The generic accordion script is automatically added for `fp-theme-popular-questions` even though it's listed as using its own script (because it's a hybrid)
- Scripts are sorted alphabetically for consistent output
- The `scriptMap` is the single source of truth for section → script relationships
- When adding new sections, update both `initFunctionMap` and `scriptMap` in `section-initializer.js`


