# CSS Production Mode Fix

## Problem
CSS styles were not applying correctly in production mode, specifically:
1. The `section.has-bg-image` rule for white text on headings was not working
2. The `.mce-content-body` class was appearing only in production

## Root Cause
The `gulp-clean-css` minifier was incorrectly removing spaces in CSS selectors like `:not(svg *)`, changing them to `:not(svg*)`, which completely changed the selector meaning:
- `svg *` = all descendant elements of SVG (correct)
- `svg*` = elements whose tag name starts with "svg" (incorrect)

This is a known bug in `clean-css` at optimization levels 1 and 2.

## Solution

### 1. Rewritten CSS Selectors
Instead of using descendant combinators inside `:not()`, the rules were split:

**Before:**
```css
section.has-bg-image :where(*:not(svg):not(svg *):not(.fp-keep-color):not(.fp-keep-color *):not(.section-menu *):not(.btn-themed)) {
  color: white !important;
}
```

**After:**
```css
section.has-bg-image :where(*:not(svg):not(.fp-keep-color):not(.section-menu):not(.btn-themed)) {
  color: white !important;
}

section.has-bg-image svg * {
  color: revert !important;
}

section.has-bg-image .fp-keep-color * {
  color: revert !important;
}

section.has-bg-image .section-menu * {
  color: revert !important;
}
```

### 2. Updated Gulp Configuration
Changed `gulpfile.js` to use `level: 0` for clean-css to avoid aggressive optimizations:

```javascript
.pipe(cleanCSS({
  level: 0, // No optimizations - preserves spaces in :not() selectors
  compatibility: 'ie11'
}))
```

## About .mce-content-body
The `.mce-content-body` class is added dynamically by TinyMCE editor when text is being edited. This is expected behavior and not an issue. You're seeing it in production because:
- TinyMCE adds this class to editable elements
- It's not defined in your CSS files (it comes from TinyMCE's own CSS)
- The class is only visible in DevTools when the editor is active

## Testing
After running `npm run build:assets`, the production CSS should now correctly apply white text to headings in sections with background images, matching the development behavior.

## Files Modified
- `public/css/sections.css` - Rewritten selectors
- `gulpfile.js` - Updated clean-css configuration
- `public/dist/` - Rebuilt minified assets
