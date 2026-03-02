# Viewport Animations

This feature enables scroll-based animations that trigger when elements enter the viewport, providing a smooth animation experience even when fullPage.js is disabled.

## Overview

The viewport animations system uses the Intersection Observer API to detect when elements enter the viewport and applies CSS animations accordingly. This system is **completely separate** from fullPage.js animations to ensure they never interfere with each other.

## How It Works

The system uses different CSS classes depending on which animation mode is active:

1. **When fullPage.js is enabled**: Elements animate using `.animations-enabled` + `.fp-completely` classes (fullPage.js animations)
2. **When fullPage.js is disabled**: Elements animate using `.viewport-animations-only` + `.in-viewport` classes (viewport scroll animations)
3. **When animations are disabled**: No animations occur

The `.viewport-animations-only` class is **only applied** when animations are ON and fullPage.js is OFF, ensuring complete separation between the two animation systems.

## Files

- **JavaScript**: `/public/js/viewport-animations.js` - Handles viewport detection and element observation
- **CSS**: `/public/css/viewport-animations.css` - Defines animation styles for viewport-triggered elements

## Configuration

### Default Settings

By default, animations trigger when elements are **200px from the bottom** of the viewport.

### Changing the Offset

You can adjust the trigger offset in several ways:

#### 1. Browser Console

```javascript
// Set to 300px from bottom
setAnimationOffset(300);

// Set to 100px from bottom  
setAnimationOffset(100);

// Trigger immediately when entering viewport
setAnimationOffset(0);
```

#### 2. Programmatic Configuration

```javascript
// Access the viewport animations instance
window.viewportAnimations.setBottomOffset(250);
```

#### 3. Initialize with Custom Offset

Edit `/public/js/viewport-animations.js` and change the default:

```javascript
window.viewportAnimations = new ViewportAnimations({
    bottomOffset: 300 // Change from 200 to your desired value
});
```

## API Reference

### Global Functions

#### `setAnimationOffset(pixels)`
Changes the viewport offset for triggering animations.

```javascript
setAnimationOffset(200); // Trigger 200px from bottom
```

#### `resetViewportAnimations()`
Resets all animations, removing the `.in-viewport` class from all elements and restarting observation.

```javascript
resetViewportAnimations(); // Reset all animations
```

### ViewportAnimations Class

#### Constructor Options

```javascript
new ViewportAnimations({
    bottomOffset: 200,  // Distance from bottom to trigger (pixels)
    enabled: false,     // Initial enabled state
    fullPageActive: false // Initial fullPage.js state
});
```

#### Methods

##### `setBottomOffset(offset)`
Updates the trigger offset dynamically.

```javascript
window.viewportAnimations.setBottomOffset(300);
```

##### `setAnimationsEnabled(enabled)`
Manually enable/disable animations.

```javascript
window.viewportAnimations.setAnimationsEnabled(true);
```

##### `setFullPageActive(active)`
Manually set fullPage.js state.

```javascript
window.viewportAnimations.setFullPageActive(false);
```

##### `resetAnimations()`
Remove all `.in-viewport` classes and restart observation.

```javascript
window.viewportAnimations.resetAnimations();
```

##### `destroy()`
Clean up and destroy the viewport animations instance.

```javascript
window.viewportAnimations.destroy();
```

## Animated Elements

The following elements are automatically animated when entering the viewport:

- Headings: `h1`, `h2`, `h3`, `h4`, `h5`, `h6`
- Paragraphs: `p` (excluding those inside links)
- Links: `a` (excluding those with paragraph children)
- Images: `img`
- Forms: `form`, `label`, `input`, `textarea`, `button`
- Custom: `.animate-element` class

## Excluded Elements

TinyMCE editor elements are excluded from animations to prevent UI disruption:
- `.tox-tinymce` and all descendants
- All TinyMCE toolbar and menu elements

## Animation Timing

Elements animate with staggered delays for a cascading effect:

- `h1`: 0s
- `h2`: 0.1s
- `h3`: 0.2s
- `h4`: 0.25s
- `h5`: 0.3s
- `h6`: 0.35s
- `p`: 0.4s
- `a`: 0.45s
- `img`: 0.5s
- `button`: 0.6s

## CSS Classes

### Animation System Separation

The animation system uses **two completely separate class systems** to ensure fullPage.js and viewport animations never interfere with each other:

#### fullPage.js Animation Classes

- **`.animations-enabled`**: Applied to `<body>` when animations toggle is ON. Used for fullPage.js animations.
- **`.fp-completely`**: Applied by fullPage.js when a section is fully visible. Triggers animations for fullPage.js mode.

#### Viewport Animation Classes (Non-fullPage.js)

- **`.viewport-animations-only`**: Applied to `<body>` when animations toggle is ON AND fullPage.js toggle is OFF. Used exclusively for viewport scroll animations.
- **`.in-viewport`**: Applied to individual elements when they enter the viewport during scroll. Triggers animations for viewport mode.

### Class Application Logic

| Animations Toggle | fullPage.js Toggle | Body Classes Applied | Behavior |
|---|---|---|---|
| ON | ON | `.animations-enabled` | Elements animate with `.fp-completely` (fullPage.js) |
| ON | OFF | `.animations-enabled` + `.viewport-animations-only` | Elements animate with `.in-viewport` (viewport scroll) |
| OFF | ON | (none) | No animations, fullPage.js scrolling only |
| OFF | OFF | (none) | No animations, regular scrolling |

This separation ensures that fullPage.js animations and viewport animations are completely independent and never conflict.

## Browser Compatibility

The viewport animations use the Intersection Observer API, which is supported in:
- Chrome 51+
- Firefox 55+
- Safari 12.1+
- Edge 15+

For older browsers, a polyfill may be needed, or the feature will gracefully degrade (no animations).

## Debugging

The script includes console logging for debugging:

```javascript
console.log('[ViewportAnimations] Started observing X elements');
console.log('[ViewportAnimations] Bottom offset updated to Xpx');
console.log('[ViewportAnimations] Animations reset');
```

Check the browser console for these messages to verify the system is working correctly.

## Performance

- Uses Intersection Observer for efficient viewport detection
- Elements are unobserved after animation to reduce overhead
- Respects `will-change` CSS property for optimized rendering
- Minimal JavaScript execution after initial setup

## Examples

### Smooth Scroll Experience

When users disable fullPage.js for a smoother scroll experience, animations will still trigger as content enters the viewport:

1. Toggle off "Enable fullPage.js"
2. Toggle on "Animate elements"
3. Scroll through sections to see animations trigger

### Adjusting for Mobile

On mobile devices, you might want animations to trigger sooner:

```javascript
// Trigger animations 100px from bottom on mobile
if (window.innerWidth < 768) {
    setAnimationOffset(100);
}
```

### Custom Animation Classes

Add the `.animate-element` class to any custom element you want to animate:

```html
<div class="animate-element custom-component">
    This will animate when entering viewport
</div>
```

## Troubleshooting

### Animations Not Triggering

1. Check that animations toggle is enabled
2. Verify fullPage.js toggle is disabled
3. Check console for error messages
4. Verify `.viewport-animations-only` class is on `<body>` (for viewport animations)
5. Verify `.animations-enabled` class is also on `<body>` when animations are enabled

### Animations Triggering Too Early/Late

Adjust the bottom offset:

```javascript
// Trigger later (further from bottom)
setAnimationOffset(400);

// Trigger earlier (closer to bottom)
setAnimationOffset(50);
```

### Elements Already Visible Not Animating

This is expected behavior. Elements must enter the viewport after the page loads. To reset and re-animate:

```javascript
resetViewportAnimations();
```

