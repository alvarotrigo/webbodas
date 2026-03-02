# Developer Mode

## Enabling Developer Mode

To enable developer mode, add `?developer=1` to the URL when loading the editor:

```
http://localhost/app.php?developer=1
```

## Features

When developer mode is enabled, you'll see a "🔧 DEV MODE" badge in the bottom-right corner of the screen.

### Keyboard Shortcuts

#### Quick Section Insertion

Instead of clicking on sections in the sidebar, you can quickly add them using keyboard shortcuts:

1. Press **`i`** (for "insert")
2. Type the section number (e.g., `38`)
3. Press **`Enter`** to add the section

**Example:**
- Press `i` → type `3` → type `8` → press `Enter`
- This will add section #38 to your page

#### Cancel Section Insertion

- Press **`Escape`** while typing a number to cancel the insertion

## Notes

- The keyboard shortcuts won't work when you're typing in input fields or textareas
- Section numbers that are already added will be skipped with a warning
- Invalid section numbers will show an error in the console
- All developer actions are logged to the browser console with emojis for easy identification

## Technical Details

The developer utilities are loaded from `dev.js` which is only included when the `developer=1` URL parameter is present. This ensures the development code doesn't affect production usage.

