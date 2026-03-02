# Generic Accordion Script Usage Guide

## Overview

The generic accordion script (`fp-theme-accordion.js`) provides a unified way to implement accordion functionality across all FAQ and collapsible sections. It features smooth animations using `maxHeight` transitions and supports multiple icon types.

## Features

- ✅ Smooth expand/collapse animations
- ✅ Multiple icon types (rotate, plus-minus)
- ✅ Auto-open first item (configurable)
- ✅ Auto-initialization on page load
- ✅ Support for dynamic content
- ✅ No reliance on Tailwind utility classes for selectors
- ✅ Prevents duplicate initialization

## HTML Structure

### Basic Setup

Add the following data attributes to your section:

```html
<section id="your-section-id" data-acc data-acc-auto-open="true">
  <!-- Your content here -->
</section>
```

### Accordion Items

Each accordion item requires three key elements:

1. **Item Container**: `data-acc-item`
2. **Content Container**: `data-acc-content`
3. **Icon Element**: `data-acc-icon="type"`

## Icon Types

### 1. Rotate Icon (Chevron Down - 180°)

Best for chevron-down icons that rotate 180° when opened (pointing up when closed, down when open).

```html
<div data-acc-item>
  <div class="cursor-pointer flex justify-between items-center p-6">
    <h3>Question title</h3>
    <i data-lucide="chevron-down" 
       class="w-6 h-6 transition-transform duration-300" 
       data-acc-icon="rotate"></i>
  </div>
  <div data-acc-content class="overflow-hidden transition-all duration-300 ease-in-out" style="max-height: 0;">
    <div class="p-6">
      <p>Answer content</p>
    </div>
  </div>
</div>
```

### 2. Rotate Icon (Chevron Right - 90°)

Best for chevron-right icons that rotate 90° when opened (pointing right when closed, down when open).

```html
<div data-acc-item>
  <div class="cursor-pointer flex justify-between items-center p-6">
    <h3>Question title</h3>
    <i data-lucide="chevron-right" 
       class="w-6 h-6 transition-transform duration-300" 
       data-acc-icon="rotate-90"></i>
  </div>
  <div data-acc-content class="overflow-hidden transition-all duration-300 ease-in-out" style="max-height: 0;">
    <div class="p-6">
      <p>Answer content</p>
    </div>
  </div>
</div>
```

### 3. Plus/Minus Icon

Best for icons that toggle between plus and minus.

```html
<div data-acc-item>
  <div class="cursor-pointer flex justify-between items-center p-6">
    <h3>Question title</h3>
    <div data-acc-icon="plus-minus">
      <i data-lucide="plus" data-icon-plus></i>
      <i data-lucide="minus" data-icon-minus class="hidden"></i>
    </div>
  </div>
  <div data-acc-content class="overflow-hidden transition-all duration-300 ease-in-out" style="max-height: 0;">
    <div class="p-6">
      <p>Answer content</p>
    </div>
  </div>
</div>
```

## Data Attributes Reference

### Section Level

| Attribute | Values | Description |
|-----------|--------|-------------|
| `data-acc` | - | Marks the section as an accordion container |
| `data-acc-auto-open` | `"true"` / `"false"` | Auto-open first item on load (default: `true`) |
| `data-accordion-initialized` | `"true"` | Auto-set for dynamic sections to prevent re-init |

### Item Level

| Attribute | Values | Description |
|-----------|--------|-------------|
| `data-acc-item` | - | Marks an accordion item (clickable) |
| `data-acc-content` | - | Marks the collapsible content area |
| `data-acc-icon` | `"rotate"` / `"rotate-90"` / `"plus-minus"` | Defines icon animation type |
| `data-icon-plus` | - | Marks the plus icon (for plus-minus type) |
| `data-icon-minus` | - | Marks the minus icon (for plus-minus type) |

## Required CSS Classes/Styles

### Content Container

The content container MUST have:

```html
<div data-acc-content 
     class="overflow-hidden transition-all duration-300 ease-in-out" 
     style="max-height: 0;">
  <!-- Your content wrapped in another div for padding -->
  <div class="p-6">
    Content here
  </div>
</div>
```

**Important**: The content should be wrapped in an inner div to handle padding correctly during animation.

### Icon Container

For rotate icons (180°):
```html
<i data-lucide="chevron-down" 
   class="transition-transform duration-300" 
   data-acc-icon="rotate"></i>
```

For rotate icons (90°):
```html
<i data-lucide="chevron-right" 
   class="transition-transform duration-300" 
   data-acc-icon="rotate-90"></i>
```

For plus-minus icons:
```html
<div data-acc-icon="plus-minus">
  <i data-lucide="plus" data-icon-plus></i>
  <i data-lucide="minus" data-icon-minus class="hidden"></i>
</div>
```

## JavaScript API

### Automatic Initialization

The script automatically initializes all sections with `data-acc` on page load:

```javascript
// Runs automatically on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  const sections = document.querySelectorAll('[data-acc]');
  sections.forEach(section => {
    initAccordion(section, false);
  });
});
```

### Manual Initialization

For dynamically added sections:

```javascript
// Get reference to your section
const section = document.querySelector('#my-dynamic-section');

// Initialize with options
window.accordionInit(section, { dynamic: true });
```

## Complete Example

```html
<section id="fp-theme-faqs" 
         class="min-h-screen flex items-center bg-themed-secondary" 
         data-acc 
         data-acc-auto-open="true">
  <div class="max-w-4xl mx-auto px-4 py-20">
    <h2 class="text-4xl font-bold mb-8">Frequently Asked Questions</h2>
    
    <div class="space-y-6">
      <!-- FAQ Item 1 -->
      <div class="card-themed" data-acc-item>
        <div class="w-full flex justify-between items-center p-6 cursor-pointer">
          <h3 class="text-xl font-semibold">How does it work?</h3>
          <i data-lucide="chevron-down" 
             class="w-6 h-6 transition-transform duration-300" 
             data-acc-icon="rotate"></i>
        </div>
        <div data-acc-content 
             class="overflow-hidden transition-all duration-300 ease-in-out" 
             style="max-height: 0;">
          <div class="px-6 pb-6">
            <p>Our platform integrates seamlessly...</p>
          </div>
        </div>
      </div>
      
      <!-- FAQ Item 2 -->
      <div class="card-themed" data-acc-item>
        <div class="w-full flex justify-between items-center p-6 cursor-pointer">
          <h3 class="text-xl font-semibold">What integrations are available?</h3>
          <i data-lucide="chevron-down" 
             class="w-6 h-6 transition-transform duration-300" 
             data-acc-icon="rotate"></i>
        </div>
        <div data-acc-content 
             class="overflow-hidden transition-all duration-300 ease-in-out" 
             style="max-height: 0;">
          <div class="px-6 pb-6">
            <p>We support over 50+ integrations...</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- Include the script -->
<script src="./public/js/sections/fp-theme-accordion.js"></script>
```

## Sections Using This Script

Currently implemented in:

1. `fp-theme-faqs` - Simple FAQ with chevron rotation (180°)
2. `fp-theme-faq-image` - FAQ with image and plus/minus icons
3. `fp-theme-questions-answers` - Questions & Answers grid layout (180°)
4. `fp-theme-split-faq` - Split layout FAQ with CTA (180°)
5. `fp-theme-features-accordion` - Features accordion with chevron-right (90°)
6. `fp-theme-popular-questions` - Category-based FAQ (hybrid: custom categories + generic animations)

## Migration Notes

### Old vs New

**Before (inline onclick):**
```html
<div onclick="toggleFAQ(this)">
  <h3>Question</h3>
  <i data-lucide="chevron-down"></i>
  <div class="faq-content hidden">Answer</div>
</div>
```

**After (data attributes):**
```html
<div data-acc-item>
  <h3>Question</h3>
  <i data-lucide="chevron-down" data-acc-icon="rotate"></i>
  <div data-acc-content style="max-height: 0;">
    <div>Answer</div>
  </div>
</div>
```

## Troubleshooting

### Accordion doesn't work

1. ✅ Check that `data-acc` is on the section element
2. ✅ Check that `data-acc-item` is on each accordion item
3. ✅ Check that `data-acc-content` is on the content container
4. ✅ Ensure the script is loaded in your HTML
5. ✅ Check browser console for errors

### Content doesn't animate smoothly

1. ✅ Ensure `overflow-hidden` class is on the content container
2. ✅ Ensure `transition-all duration-300 ease-in-out` classes are present
3. ✅ Ensure initial `style="max-height: 0;"` is set
4. ✅ Wrap actual content in an inner div for proper padding

### Icons don't rotate/toggle

1. ✅ Check that `data-acc-icon` attribute is present with correct value
2. ✅ For rotate: ensure icon has `transition-transform` class
3. ✅ For plus-minus: ensure both icons have `data-icon-plus` and `data-icon-minus`
4. ✅ Ensure Lucide icons are initialized after accordion

## Browser Support

- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Mobile browsers

## Performance

- Uses WeakSet for efficient initialization tracking
- Minimal DOM manipulation
- CSS-based animations (hardware accelerated)
- No jQuery or external dependencies (except Lucide for icons)

