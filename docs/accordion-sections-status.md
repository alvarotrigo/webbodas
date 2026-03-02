# Accordion Sections Status

## Overview
This document tracks which accordion/FAQ sections use the generic accordion script vs custom implementations.

## Sections Using Generic Accordion

These sections have been updated to use `/public/js/sections/fp-theme-accordion.js`:

### 1. ✅ fp-theme-faqs
- **Location:** Line 2537 in all.html
- **Icon Type:** Rotate (chevron-down)
- **Auto-open:** true
- **Status:** ✅ Migrated to generic accordion
- **File:** `sections/fp-theme-faqs.html`

### 2. ✅ fp-theme-faq-image  
- **Location:** Line 7291 in all.html
- **Icon Type:** Plus-Minus
- **Auto-open:** false
- **Status:** ✅ Migrated to generic accordion
- **File:** `sections/fp-theme-faq-image.html`

### 3. ✅ fp-theme-questions-answers
- **Location:** Line 6869 in all.html
- **Icon Type:** Rotate (chevron-down)
- **Auto-open:** false
- **Layout:** 2-column grid
- **Status:** ✅ Migrated to generic accordion
- **File:** `sections/fp-theme-questions-answers.html`

### 4. ✅ fp-theme-split-faq
- **Location:** Line 7177 in all.html
- **Icon Type:** Rotate (chevron-down)
- **Auto-open:** false
- **Layout:** Split layout with CTA on left
- **Status:** ✅ Migrated to generic accordion
- **File:** `sections/fp-theme-split-faq.html`

## Sections Keeping Custom Scripts

These sections have specialized behavior that requires custom JavaScript:

### 5. ✅ fp-theme-features-accordion
- **Location:** Line 4326 in all.html
- **Icon Type:** Rotate-90 (chevron-right rotates 90°)
- **Auto-open:** true
- **Layout:** Two columns with accordion + image
- **Status:** ✅ Migrated to generic accordion
- **Note:** Generic accordion extended to support 90° rotation with `data-acc-icon="rotate-90"`

### 6. ✅ fp-theme-popular-questions
- **Location:** Line 6985 in all.html
- **Icon Type:** Rotate (chevron-down)
- **Auto-open:** false
- **Special Features:** Category-based system with dynamic FAQ generation
- **Custom Script:** Still uses `/public/js/sections/fp-theme-popular-questions.js` for category management
- **Status:** ✅ Hybrid - Uses generic accordion for animations + custom script for categories
- **Note:** Custom script generates FAQ items with generic accordion data attributes

## Summary

| Section | Status | Script | Notes |
|---------|--------|--------|-------|
| fp-theme-faqs | ✅ Generic | fp-theme-accordion.js | Standard FAQ |
| fp-theme-faq-image | ✅ Generic | fp-theme-accordion.js | Plus/minus icons |
| fp-theme-questions-answers | ✅ Generic | fp-theme-accordion.js | Grid layout |
| fp-theme-split-faq | ✅ Generic | fp-theme-accordion.js | Split layout with CTA |
| fp-theme-features-accordion | ✅ Generic | fp-theme-accordion.js | Uses rotate-90 for chevron-right |
| fp-theme-popular-questions | ✅ Hybrid | Both scripts | Generic accordion + custom categories |

## Generic Accordion Features

All sections using the generic accordion get:
- ✅ Smooth maxHeight animations
- ✅ Consistent behavior across sections
- ✅ Auto-initialization on page load
- ✅ Clean data-attribute selectors
- ✅ No inline onclick handlers
- ✅ Support for three icon types (rotate, rotate-90, plus-minus)
- ✅ Configurable auto-open behavior

## Icon Types Supported

The generic accordion now supports three icon animation types:

### 1. rotate (180°)
For chevron-down icons that point up when closed and down when open.
```html
<i data-lucide="chevron-down" data-acc-icon="rotate"></i>
```

### 2. rotate-90 (90°)
For chevron-right icons that point right when closed and down when open.
```html
<i data-lucide="chevron-right" data-acc-icon="rotate-90"></i>
```

### 3. plus-minus
For icons that toggle between plus and minus symbols.
```html
<div data-acc-icon="plus-minus">
  <i data-lucide="plus" data-icon-plus></i>
  <i data-lucide="minus" data-icon-minus class="hidden"></i>
</div>
```

## Hybrid Approach: fp-theme-popular-questions

This section uses a **hybrid approach**:
- **Generic Accordion Script** handles the smooth animations and toggle behavior
- **Custom Script** handles category switching and dynamic content generation

The custom script generates FAQ items with the correct data attributes (`data-acc-item`, `data-acc-content`, `data-acc-icon="rotate"`), then calls `window.accordionInit()` to enable smooth animations. This gives us the best of both worlds:
- ✅ Consistent smooth animations across all sections
- ✅ Category switching functionality intact
- ✅ Dynamic content generation preserved

## Implementation Highlights

### Extended Icon Support
Added `data-acc-icon="rotate-90"` support to handle chevron-right icons that need 90-degree rotation instead of 180-degree. This allows fp-theme-features-accordion to use the generic script while maintaining its unique visual style.

### Hybrid Pattern for Complex Sections
Established a pattern where complex sections can use custom scripts for business logic while delegating animation/interaction to the generic accordion. See fp-theme-popular-questions as the reference implementation.

## Scripts Loading Order

```html
<!-- Generic Accordion Script (used by 6 sections) -->
<script src="./public/js/sections/fp-theme-accordion.js"></script>

<!-- Process Accordion Script (specialized process flow accordion) -->
<script src="./public/js/sections/fp-theme-process-accordion.js"></script>

<!-- Popular Questions Script (category management + generic accordion animations) -->
<script src="./public/js/sections/fp-theme-popular-questions.js"></script>
```

Note: fp-theme-features-accordion.js is no longer needed as the section now uses the generic accordion with `rotate-90` icon type.

## Conversion Complete

✅ **ALL 6** accordion sections now use the generic accordion (4 fully, 1 hybrid, 1 specialized variant)
- **4 sections** use only generic accordion  
- **1 section** uses hybrid approach (generic + custom category management)
- **1 section** uses process-specific accordion (fp-theme-process-accordion)

All visual designs have been preserved. The migration introduces smooth maxHeight animations and cleaner code without changing any user-facing design.

