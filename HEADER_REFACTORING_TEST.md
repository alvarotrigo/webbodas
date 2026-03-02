# Header System Refactoring - Testing Guide

## Manual Testing Steps

### 1. Visual Verification
Open `all-headers.html` in a browser.

**Expected Result:**
- All 30 navigation bars should be visible
- Default configuration: Solid background, Rounded corners, Light theme
- Control panel visible in top-right corner with 3 option groups

### 2. Background Option Testing

**Test: Solid (default)**
- Should show: Opaque backgrounds using theme colors
- All navs should have visible backgrounds

**Test: Transparent**
1. Click "Transparent" radio button
2. Expected: All nav backgrounds become transparent, content shows through
3. Note: Nav content (text, buttons) remains visible

**Test: Glass**
1. Click "Glass" radio button
2. Expected: All navs show semi-transparent background with blur effect
3. Best visible when body has background color/image
4. Should see subtle blur behind nav elements

### 3. Corners Option Testing

**Test: Rounded (default)**
- Should show: Navs with card-radius (20px) corners
- Full-width navs with rounded corners

**Test: Sharp**
1. Click "Sharp" radio button
2. Expected: All border-radius removed, square corners
3. Full-width appearance

**Test: Pill**
1. Click "Pill" radio button
2. Expected: High radius (50px) corners
3. Navs constrained to max-width 1200px
4. Centered on page
5. On mobile (<768px): Should have margins (1rem each side)

### 4. Theme Option Testing

**Test: Light (default)**
- Should show: White/light backgrounds, dark text
- High contrast, readable

**Test: Dark**
1. Click "Dark" radio button
2. Expected: Black/dark backgrounds, white text
3. All text and icons should be light colored
4. Buttons should have dark theme colors

**Test: Accent**
1. Click "Accent" radio button
2. Expected: Primary accent color backgrounds (purple/blue)
3. All text should be white
4. High contrast against accent background

### 5. Combination Testing

**Test: All 27 Combinations**
Try various combinations to ensure they work together:

Example combinations to test:
1. **Glass + Pill + Dark**: Floating dark glass navs
2. **Transparent + Sharp + Light**: Minimal full-width light navs
3. **Solid + Rounded + Accent**: Colorful rounded navs
4. **Glass + Rounded + Light**: Subtle glass effect with rounded corners
5. **Solid + Pill + Dark**: Floating dark pill-shaped navs

**Expected Result:**
- All combinations should work smoothly
- No visual glitches or layout breaks
- Settings should apply to all 30 navs consistently

### 6. Persistence Testing

**Test: Configuration Saves**
1. Change all 3 options to non-default values
   - Example: Glass + Pill + Dark
2. Refresh the page (Cmd+R / Ctrl+R)
3. Expected: Settings should be restored from localStorage
4. All 3 radio buttons should be in the correct state

**Test: Clear Storage**
1. Open browser console
2. Run: `localStorage.removeItem('navConfig')`
3. Refresh page
4. Expected: Should reset to defaults (Solid, Rounded, Light)

### 7. Mobile Menu Testing

**Test: Mobile Menus Work**
1. Resize browser window to mobile size (<768px)
2. Click hamburger menu icon on any nav
3. Expected: Mobile menu should expand/collapse
4. Functionality should be unchanged from before refactoring

### 8. Responsive Testing

**Test: Desktop (>768px)**
- Pill style: Max-width 1200px, centered
- All navs: Readable and well-spaced

**Test: Tablet (768px)**
- Pill style: Adjusts to smaller width
- Control panel: Full width with reduced padding

**Test: Mobile (<768px)**
- Pill style: Max-width calc(100% - 2rem), with 1rem margins
- Control panel: Full width layout
- Mobile menus functional

### 9. Browser Compatibility

**Test: Chrome/Edge**
- Glass effect: backdrop-filter should work
- All features functional

**Test: Safari**
- Glass effect: -webkit-backdrop-filter should work
- All features functional

**Test: Firefox**
- Glass effect: backdrop-filter should work (Firefox 103+)
- All features functional

### 10. Console Testing

**Test: No JavaScript Errors**
1. Open browser console (F12)
2. Refresh page
3. Change all options multiple times
4. Expected: No errors in console
5. Only expected messages: localStorage saves

## Automated Testing (Browser Console)

Run these commands in the browser console to verify functionality:

```javascript
// Test 1: Verify all navs have utility classes
const navs = document.querySelectorAll('nav');
const hasClasses = Array.from(navs).every(nav =>
  nav.className.includes('nav-bg-') &&
  nav.className.includes('nav-corners-') &&
  nav.className.includes('nav-theme-')
);
console.log('All navs have utility classes:', hasClasses);

// Test 2: Verify configuration object
console.log('Current config:', currentConfig);

// Test 3: Test applyOption function
applyOption('background', 'glass');
console.log('Applied glass background');

// Test 4: Verify localStorage
console.log('Saved config:', localStorage.getItem('navConfig'));

// Test 5: Count navs
console.log('Total navs:', document.querySelectorAll('nav').length);
```

## Visual Regression Checklist

Compare before/after refactoring:

- [ ] All 30 navs render in same positions
- [ ] No layout shifts or breaks
- [ ] Borders remain on navs that had them
- [ ] Spacing/padding unchanged
- [ ] Mobile menus still work
- [ ] No z-index issues
- [ ] Control panel looks clean and organized

## Known Behaviors

1. **Glass effect visibility**: Glass effect is most visible when there's content behind the nav (background color/image)
2. **Pill style width**: Pill style adds max-width constraint to the nav element itself, not just content
3. **Border preservation**: Navs with `border-bottom` keep those styles (they're structural, not configurable)
4. **Theme colors**: Accent theme uses CSS variables from body-level themes

## Troubleshooting

**Issue: Glass effect not visible**
- Solution: Add a background color or image to the body element

**Issue: Settings don't persist**
- Solution: Check browser allows localStorage, check for console errors

**Issue: Pill style too wide on mobile**
- Solution: Verify viewport meta tag is present, check responsive styles

**Issue: Text not visible**
- Solution: Verify theme classes are applying correct color variables

## Success Criteria

✅ All 30 navs render correctly with defaults
✅ All 3 option groups work independently
✅ All 27 combinations work correctly
✅ Glass effect shows backdrop blur
✅ Pill style constrains width appropriately
✅ Theme colors apply correctly
✅ Configuration persists across reloads
✅ Mobile menus still function
✅ No JavaScript errors
✅ Works in Chrome, Safari, Firefox
