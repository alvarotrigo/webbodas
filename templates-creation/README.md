# Template Creation Tools

This folder contains tools for generating and browsing landing page templates.

## Files

### index.html
The main template generator interface. Use this to:
- Create new templates from descriptions and reference images
- Analyze style references
- Generate section content and images
- Preview and save templates

**Access:** `templates-creation/index.html`

### browser.html
The template browser interface for viewing saved templates. Features:
- **Left Sidebar**: Scrollable list of saved templates (320px width, not too wide)
- **Right Preview Area**: Full-size template preview taking the remaining viewport
- **Toggle Button**: Hide/show the sidebar using `translateX` animation
- **Responsive Device Preview**: Switch between Desktop, Tablet, and Mobile viewports
- **Always-visible Preview**: No scrolling needed - the iframe is always on top

**Access:** `templates-creation/browser.html`

## Navigation

- From **Generator** → **Browser**: Click "View Saved Templates →" button
- From **Browser** → **Generator**: Click "← Back to Generator" button

## Sidebar Toggle Feature

The sidebar in `browser.html` can be collapsed to preview templates in full-width:
- Click the toggle button (◀) on the left edge
- Sidebar slides out to the left using `transform: translateX(-100%)`
- Toggle button follows the sidebar position
- Click again to restore the sidebar

This is similar to the sidebar implementation in `app.php` but uses `translateX` for smoother animation.

## Template Storage

Templates are saved as JSON files in the `/templates/` folder with the format:
- Filename: `{template-name}.json`
- Contains: sections, theme, text updates, inline images, background images, fonts, etc.
