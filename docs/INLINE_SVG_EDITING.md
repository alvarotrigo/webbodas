# Inline SVG Icon Editing

## Overview

Users can now replace SVG icons directly in the editor by pasting SVG code from icon libraries like Lucide, Heroicons, Tabler, Phosphor, and Feather.

## Features

### Simple Click-to-Edit Interface
- **Hover Effect**: All SVG icons show a blue outline on hover to indicate they're editable
- **Direct Click**: Simply click any SVG icon to open the edit modal
- **No DOM Clutter**: Uses pure CSS for hover effects instead of appending indicator elements

### Smart Icon Replacement
- **Live Preview**: See the new icon in real-time as you paste the SVG code
- **Style Preservation**: Automatically transfers classes, inline styles, width, and height from the original icon
- **Theme Compatibility**: Ensures icons use `currentColor` for proper theming
- **ViewBox Normalization**: Handles different viewBox dimensions automatically

### Undo/Redo Support
- Full undo/redo support integrated with the history manager
- Each icon change is tracked as a separate command
- Scrolls to the section on undo/redo for better visibility

## User Flow

1. **Hover** over any SVG icon → blue outline appears
2. **Click** the icon → edit modal opens
3. **Paste** SVG code from any icon library
4. **Preview** updates in real-time
5. **Click Apply** → icon is replaced with styling preserved

## Technical Implementation

### Files Created
- `public/css/inline-svg-editor.css` - Hover effects and modal styling
- `public/js/inline-svg-editor.js` - Core editor logic
- `public/js/history/commands/inline-svg-change-command.js` - Undo/redo support

### Integration Points
- Loaded in `preview.html` for the preview iframe
- Command handler registered in `app.php` for history management
- Message listeners for undo/redo operations

### How It Works

1. **Detection**: Event delegation on document listens for clicks on SVG elements inside sections
2. **Modal**: Opens with current icon preview and textarea for new SVG code
3. **Validation**: Parses pasted SVG code and validates it's proper SVG markup
4. **Style Transfer**:
   - Preserves `class` attributes (e.g., `w-6 h-6 flex-shrink-0`)
   - Preserves inline `style` attributes (e.g., `color: var(--secondary-text)`)
   - Preserves `width` and `height` attributes
   - Ensures `stroke="currentColor"` or `fill="currentColor"` for theme compatibility
5. **Replacement**: Swaps the SVG in the DOM with the new one
6. **History**: Emits command to history manager for undo/redo

### Unique Identifiers
Each edited SVG gets a `data-svg-uid` attribute for tracking across undo/redo operations.

## Popular Icon Libraries

Users can copy SVG code from these popular icon libraries:

- **[Lucide](https://lucide.dev/)** - Modern, clean icons
- **[Heroicons](https://heroicons.com/)** - Tailwind CSS icons
- **[Tabler Icons](https://tabler-icons.io/)** - 4000+ open source icons
- **[Phosphor Icons](https://phosphoricons.com/)** - Flexible icon family
- **[Feather Icons](https://feathericons.com/)** - Simply beautiful icons

## Browser Compatibility

Works in all modern browsers that support:
- CSS pseudo-elements for hover effects
- SVG DOM manipulation
- ES6 classes and arrow functions

## Performance

- **Zero DOM overhead**: No indicator elements appended
- **Event delegation**: Single click listener for all SVGs
- **Lazy rendering**: Modal only created when needed
- **Efficient validation**: Minimal DOM parsing for preview

## Future Enhancements

Potential improvements:
- Icon library browser (built-in icon picker)
- Search functionality for popular icons
- Recent icons history
- Batch icon replacement across sections
