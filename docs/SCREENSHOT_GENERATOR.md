# Screenshot Generator

## Overview

The screenshot generator (`screenshot-generator.cjs`) is an automated tool that captures screenshots of all sections in the application. It generates **two versions** of each screenshot:

1. **Regular version** (`1.jpg`, `2.jpg`, etc.) - Sections without background images
2. **Background version** (`1-bg.jpg`, `2-bg.jpg`, etc.) - Sections with background images applied

## Purpose

These screenshots are used for:
- Section thumbnails in the editor's section picker
- Preview images for different sections
- Visual documentation of available sections
- Quick reference for designers and developers

## How It Works

### 1. Page Loading & Setup
```
1. Launches headless Chromium browser via Puppeteer
2. Loads all.html from localhost
3. Applies the first theme (theme-light-grey-minimal)
4. Hides theme selector UI
5. Adds custom section styles for consistent rendering
```

### 2. Background Image Injection & Preloading

The script dynamically handles background images without modifying `all.html`:

```javascript
// Reads public/css/thumbnails-bgs.css
// Injects it via <style> tag into the page
// Extracts all background image URLs using regex
// Preloads all images to ensure they're loaded before capture
```

**Why preload?**
- Background images need time to download and render
- Without preloading, screenshots would capture empty backgrounds
- Similar to the approach used in `app.php` for ensuring images are ready

**Why thumbnails-bgs.css?**
- Contains lower resolution background images (q=70, w=437)
- Optimized for thumbnails and faster loading
- Overrides the high-resolution backgrounds in `sections.css` (q=80, w=2670)
- Reduces screenshot generation time significantly

### 3. Dual Screenshot Capture

For each viewport position, the script:

```
1. Scroll to position
2. Wait for animations (1000ms)
3. Capture screenshot WITHOUT .has-bg-image class → saves as N.jpg
4. Add .has-bg-image class to all sections
5. Wait for backgrounds to render (800ms)
6. Capture screenshot WITH backgrounds → saves as N-bg.jpg
7. Remove .has-bg-image class
8. Move to next viewport
```

### 4. Image Compression

All screenshots are:
- Captured as PNG (lossless quality)
- Resized to max 700px width
- Converted to JPEG with 85% quality
- Original PNG files are deleted to save space

## File Structure

### Input Files
- `all.html` - The page containing all sections
- `public/css/sections.css` - Main section styles with high-res backgrounds
- `public/css/thumbnails-bgs.css` - Lower resolution backgrounds for thumbnails

### Output Files
Generated in `screenshots/` directory:
- `1.jpg`, `2.jpg`, `3.jpg`, ... - Regular versions (no backgrounds)
- `1-bg.jpg`, `2-bg.jpg`, `3-bg.jpg`, ... - With background images
- `full-page.jpg` - Full page screenshot (no backgrounds)
- `full-page-bg.jpg` - Full page screenshot (with backgrounds)

## Running the Script

### Prerequisites
```bash
# Ensure dependencies are installed
npm install puppeteer sharp
```

### Execute
```bash
# Make sure local server is running on http://localhost
node screenshot-generator.cjs
```

### Expected Output
```
🎨 ModernCo Viewport Screenshot Generator
==========================================

🚀 Starting viewport screenshot generation...

📸 Processing theme: theme-light-grey-minimal
📥 Injecting thumbnails-bgs.css and preloading background images...
✓ Background images preloaded

  ✓ Screenshot 1 (no bg)
  ✓ Compressed: 1.jpg
  ✓ Screenshot 1-bg (with bg)
  ✓ Compressed: 1-bg.jpg
  ✓ Screenshot 2 (no bg)
  ✓ Compressed: 2.jpg
  ...

🎉 Viewport screenshot generation complete!
📊 Total screenshots generated: 344
📁 Screenshots saved in: /path/to/screenshots
📏 All images compressed to max 700px width
```

## Technical Details

### CSS Injection Strategy

Instead of creating a duplicate `all.html` file, the script dynamically injects CSS:

```javascript
// Read CSS file from filesystem
const cssContent = fs.readFileSync('public/css/thumbnails-bgs.css', 'utf8');

// Inject into page via page.evaluate()
await page.evaluate((css) => {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
}, cssContent);
```

**Benefits:**
- No need to maintain duplicate HTML files
- Changes to `all.html` automatically reflected
- Clean separation of concerns
- Easy to modify without affecting production files

### Class Toggle Pattern

The `has-bg-image` class is the trigger for background images:

```css
/* From thumbnails-bgs.css */
.category-hover-panel .has-bg-image#fp-theme-hero .fp-bg {
    background-image: url('...');
}
```

The script toggles this class programmatically:

```javascript
// Add background images
await page.evaluate(() => {
  document.querySelectorAll('section').forEach(section => {
    section.classList.add('has-bg-image');
  });
});

// Remove background images
await page.evaluate(() => {
  document.querySelectorAll('section').forEach(section => {
    section.classList.remove('has-bg-image');
  });
});
```

### Timing & Wait Periods

Critical wait times for reliable screenshots:

- **2000ms** - Initial page load (fonts, images)
- **500ms** - Theme transition
- **1000ms** - After scroll (animations, layout shifts)
- **800ms** - After adding backgrounds (image rendering)
- **10000ms** - Timeout per background image during preload

These timings ensure:
- Fonts are fully loaded
- Images are rendered
- Animations have completed
- Layout is stable

## Troubleshooting

### Screenshots are blank
- Ensure local server is running
- Check that `all.html` is accessible at the specified URL
- Verify Puppeteer can access the network

### Background images not showing
- Verify `public/css/thumbnails-bgs.css` exists and contains valid URLs
- Check browser console for failed image loads
- Increase wait time after adding `has-bg-image` class

### Script hangs or times out
- Check network connectivity for external image URLs
- Verify all Unsplash image URLs are accessible
- Increase timeout values if needed

### Wrong image count
- Verify the page height calculation
- Check that all sections are within viewport bounds
- Ensure no sections are hidden by CSS

## Future Enhancements

Potential improvements:
- Multi-theme support (currently only processes first theme)
- Parallel screenshot capture for faster generation
- Individual section targeting (capture specific sections only)
- Configurable quality and compression settings
- Progress bar or more detailed logging
- Automatic retry on failed captures

## Related Files

- `screenshot-generator.cjs` - The main script
- `public/css/thumbnails-bgs.css` - Thumbnail background images
- `public/css/sections.css` - Main section styles
- `config/sections-bgs.php` - PHP configuration for backgrounds
- `app.php` - Uses similar preload pattern for background images

