# Header Mobile Menu Fix

## Problem
When adding a header via `header-modal.js`, the mobile menu (burger menu) was not visible on smaller viewports, unlike the working version in `all-headers.html`.

## Root Cause
The header layout templates in `header-modal.js` were missing:
1. Mobile menu toggle button (burger icon)
2. Mobile menu container with class `mobile-menu`
3. JavaScript function to toggle the menu visibility

## Solution

### 1. Updated Header Layouts in `header-modal.js`
Added to **all 4 layouts** (1, 2, 4, 5):

**Mobile Menu Button:**
```html
<button class="md:hidden p-2" onclick="window.toggleHeaderMenu && window.toggleHeaderMenu('header-menu-X')" style="color: var(--primary-text);">
  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
  </svg>
</button>
```

**Mobile Menu Container:**
```html
<div id="header-menu-X" class="mobile-menu md:hidden">
  <div class="pt-4 pb-2 flex flex-col gap-3">
    <!-- Menu items here -->
  </div>
</div>
```

Each layout has a unique menu ID (`header-menu-1`, `header-menu-2`, `header-menu-4`, `header-menu-5`).

### 2. Added Toggle Function to `preview.js`
Added after the `removeHeader()` function:

```javascript
/**
 * Toggle mobile menu in header nav
 */
function toggleHeaderMenu(menuId) {
    const menu = document.getElementById(menuId);
    if (menu) {
        menu.classList.toggle('open');
    }
}

// Expose toggleHeaderMenu to global scope for inline onclick handlers
window.toggleHeaderMenu = toggleHeaderMenu;
```

### 3. Existing CSS Support
The CSS in `public/css/header-nav.css` already had the necessary styles:

```css
.mobile-menu {
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.3s ease-out;
}
.mobile-menu.open {
    max-height: 500px;
}
```

## Files Modified
- ✅ `public/js/header-modal.js` - Updated all 4 layout templates with mobile menu HTML
- ✅ `public/js/preview.js` - Added `toggleHeaderMenu()` function and exposed to `window`
- ✅ No CSS changes needed (already present in `header-nav.css`)

## Testing
To test:
1. Open the editor and add a header using any of the 4 layouts
2. Resize the browser window to mobile width (< 768px)
3. The burger menu icon should appear
4. Click the burger icon - the mobile menu should slide open
5. Click again - the mobile menu should slide closed

## Notes
- No Lucide icon library is used (inline SVG instead)
- The icons used are the same as in `all-headers.html`
- The mobile menu uses Tailwind's responsive utility classes (`hidden md:flex`)
