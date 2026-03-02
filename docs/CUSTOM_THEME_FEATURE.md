# Custom Theme Feature

## Overview
Added a custom theme creator feature that allows users to create, save, and manage their own custom themes with personalized colors.

## Features Implemented

### 1. Custom Theme Modal
- **Location**: Added modal HTML after the upgrade modal in `app.php`
- **Features**:
  - Theme name input (max 30 characters)
  - 9 color pickers for theme variables:
    - Primary Background
    - Secondary Background
    - Accent Background
    - Primary Text
    - Secondary Text
    - Accent Text
    - Primary Accent
    - Secondary Accent
    - Border Color
  - Each color has both a visual color picker and a hex input field
  - Colors sync between picker and hex input
  - Auto-adds "#" to hex codes if missing
  - Validates hex color format

### 2. Theme Grid Integration
- **"Create Custom" Card**: Added at the end of the theme grid with a dashed border and plus icon
- **Custom Theme Cards**: Display with:
  - 5-color preview palette
  - Custom theme name
  - Palette icon indicator
  - 3-dot menu button (top-right) with dropdown options:
    - **Edit**: Modify theme colors and name
    - **Clone**: Duplicate theme with " (Copy)" suffix
    - **Delete**: Remove theme with confirmation
  
### 3. LocalStorage Persistence
- Custom themes are automatically saved to `localStorage` when created
- Themes are loaded on page initialization
- Themes persist across browser sessions
- Data structure:
  ```json
  {
    "id": "custom-theme-[timestamp]",
    "name": "User's Theme Name",
    "variables": {
      "primary-bg": "#ffffff",
      ...
    },
    "isCustom": true
  }
  ```

### 4. Dynamic CSS Injection
- Custom themes dynamically generate CSS classes
- CSS is injected into the document head
- Automatically calculates derived colors (like `primary-accent-soft` with opacity)
- Generates gradient styles and shadows based on theme colors

### 5. Theme Management
- **Create**: Click "Create Custom" card → fill form → save
- **Apply**: Click on any custom theme card to apply it
- **Edit**: Click 3-dot menu → Edit → modify colors/name → save
- **Clone**: Click 3-dot menu → Clone → creates instant duplicate
- **Delete**: Click 3-dot menu → Delete → confirm deletion
- **Auto-apply**: New and cloned themes are automatically applied after creation
- **Live Updates**: Editing an active theme updates the preview in real-time

## Files Modified

### app.php
1. **CSS Styles** (lines ~1088-1375):
   - `.custom-theme-modal` and related classes
   - Color picker styles
   - Custom theme card styles
   - 3-dot menu button styles (`.custom-theme-menu-btn`)
   - Dropdown menu styles (`.custom-theme-menu`, `.custom-theme-menu-item`)
   - Danger state for delete option

2. **HTML Modal** (lines ~1976-2012):
   - Modal structure
   - Form inputs
   - Action buttons

3. **Script Include**:
   - Added `<script src="public/js/custom-theme-manager.js"></script>`

4. **JavaScript Integration**:
   - Updated `populateThemeGrid()` to call `populateCustomThemes()` from the module
   - Loads custom themes on page initialization

### public/js/custom-theme-manager.js (NEW FILE)
Complete JavaScript module handling all custom theme functionality:

1. **Core Functions**:
   - `loadCustomThemes()`: Load from localStorage and inject CSS
   - `saveCustomThemes()`: Save to localStorage
   - `injectCustomThemeCSS()`: Generate and inject CSS dynamically
   - `hexToRGBA()`: Color conversion helper
   - `getCustomThemes()`: Get all custom themes

2. **UI Functions**:
   - `populateCustomThemes()`: Add custom themes to grid with 3-dot menus
   - `openCustomThemeModal()`: Open modal and initialize (create or edit mode)
   - `closeCustomThemeModal()`: Close modal
   - `generateColorPickers()`: Create color picker inputs with optional values

3. **CRUD Operations**:
   - `saveCustomTheme()`: Validate and save new or edited theme
   - `editCustomTheme()`: Open modal with existing theme data
   - `cloneCustomTheme()`: Duplicate theme with new ID
   - `deleteCustomTheme()`: Remove custom theme

4. **Auto-initialization**:
   - `initializeCustomThemeModal()`: Set up event listeners (only in editor)
   - Automatically runs on DOM ready
   - Safely skips modal initialization in preview iframe

### preview.html
1. **Script Include**: Added `custom-theme-manager.js` to load custom themes in preview
2. **Auto-load**: Custom themes are loaded on page initialization
3. **Theme Application**: Updated `setTheme()` function to:
   - Properly remove old theme classes
   - Apply new custom theme class
   - Reload custom themes if CSS not yet injected
4. **Sync**: Reads from localStorage to stay in sync with editor

## Usage Instructions

### Creating a Custom Theme
1. Open the editor (app.php)
2. In the Theme section (left sidebar), scroll to the bottom
3. Click the "Create Custom" card (with dashed border and plus icon)
4. Enter a theme name
5. Use color pickers or paste hex codes to customize colors
6. Click "Save Theme"
7. The theme is automatically applied and saved

### Applying a Custom Theme
1. Custom themes appear in the theme grid with a palette icon
2. Click any custom theme card to apply it

### Editing a Custom Theme
1. Click the 3-dot menu button (top-right of custom theme card)
2. Select "Edit" from the dropdown
3. Modify colors using the color pickers or hex inputs
4. Update the theme name if desired
5. Click "Save Theme"
6. If the theme is currently active, changes apply immediately

### Cloning a Custom Theme
1. Click the 3-dot menu button (top-right of custom theme card)
2. Select "Clone" from the dropdown
3. A duplicate theme is created with " (Copy)" appended to the name
4. The cloned theme is automatically applied
5. You can then edit the clone to create variations

### Deleting a Custom Theme
1. Click the 3-dot menu button (top-right of custom theme card)
2. Select "Delete" from the dropdown
3. Confirm deletion in the dialog
4. If the deleted theme was active, it switches to the default theme

## How It Works

### Editor → Preview Synchronization
1. **Custom theme created in editor**:
   - User fills out modal form with colors
   - Theme saved to `localStorage`
   - CSS dynamically injected into editor DOM
   - Theme appears in theme grid

2. **Theme applied in editor**:
   - User clicks custom theme card
   - `selectTheme()` called with custom theme ID
   - Message sent to preview iframe: `{ type: 'SET_THEME', data: { theme: themeId } }`

3. **Preview receives theme**:
   - `setTheme()` function called in preview
   - Function checks if theme is custom (starts with `custom-theme-`)
   - Calls `loadCustomThemes()` to read from localStorage
   - CSS dynamically injected into preview DOM
   - Theme class applied to `<body>` element

4. **Result**: Both editor and preview show the same custom theme!

### localStorage Schema
```json
{
  "customThemes": [
    {
      "id": "custom-theme-1234567890",
      "name": "My Brand Theme",
      "isCustom": true,
      "variables": {
        "primary-bg": "#ffffff",
        "secondary-bg": "#f8f9fa",
        "accent-bg": "#f1f3f4",
        "primary-text": "#2c3e50",
        "secondary-text": "#6c757d",
        "accent-text": "#1a252f",
        "primary-accent": "#4285f4",
        "secondary-accent": "#3367d6",
        "border-color": "#e9ecef"
      }
    }
  ]
}
```

## Technical Details

### Color Variables Supported
- `primary-bg`: Main background color
- `secondary-bg`: Secondary background (cards, sections)
- `accent-bg`: Accent background areas
- `primary-text`: Main text color
- `secondary-text`: Secondary/muted text
- `accent-text`: Headlines and emphasis text
- `primary-accent`: Primary brand color (buttons, links)
- `secondary-accent`: Hover/active states
- `border-color`: Border colors

### Auto-Generated Variables
The system automatically generates:
- `primary-accent-soft`: Primary accent with 10% opacity
- `shadow-color`: Primary accent with 12% opacity
- `gradient-1`: Background gradient
- `gradient-2`: Accent gradient
- Various shadow styles with appropriate opacity

## Browser Compatibility
- Uses HTML5 color input (supported in all modern browsers)
- localStorage for persistence
- CSS custom properties (CSS variables)
- Works in Chrome, Firefox, Safari, Edge

## Future Enhancements (Optional)
- Export/import themes
- Share themes via URL
- Preset color palettes
- Advanced customization (fonts, border radius, etc.)
- Theme preview before saving
- Duplicate existing themes

