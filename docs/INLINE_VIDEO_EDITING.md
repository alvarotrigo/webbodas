# Inline Video Editing

This document describes the inline video editing functionality for videos that appear directly in sections (not as background videos).

## Overview

The inline video editor allows users to change video sources for videos that are embedded directly in sections, similar to how inline images can be edited. This does NOT apply to videos inside `.fp-bg` elements (background videos), which are handled by the section background picker.

## Video Types Covered

1. **Standalone videos**: `<video>` elements that stand alone
2. **Videos with overlay divs**: `<video>` elements followed by a div with `data-video="prev"` attribute indicating it covers the previous video element

Example:
```html
<!-- Standalone video -->
<video class="w-full h-auto" autoplay loop muted playsinline>
  <source src="https://example.com/video.mp4" type="video/mp4">
</video>

<!-- Video with overlay div -->
<video class="w-full h-auto" autoplay loop muted playsinline>
  <source src="https://example.com/video.mp4" type="video/mp4">
</video>
<div class="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" data-video="prev"></div>
```

## User Interface

- An edit indicator icon (play button) appears on hover in the top-right corner of the video or its overlay
- Clicking the indicator opens a modal where users can:
  - Change existing video URLs
  - Add multiple video sources (for browser compatibility)
  - Remove video sources
- The modal is identical to the one used for background videos

## Implementation

### Files Created

1. **`public/js/inline-video-editor.js`**
   - Main editor class that handles video detection and editing
   - Similar pattern to `cloudinary-image-editor.js`
   - Creates hover indicators using a portal pattern (overlay container)
   - Manages video state for undo/redo

2. **`public/js/history/commands/inline-video-change-command.js`**
   - History command for undo/redo functionality
   - Tracks before/after states of video sources and attributes
   - Implements Command pattern

3. **`docs/INLINE_VIDEO_EDITING.md`**
   - This documentation file

### Files Modified

1. **`preview.html`**
   - Added script include for `inline-video-editor.js`
   - Added initialization calls in three places:
     - When adding new sections
     - When cloning sections
     - When restoring from history
   - Added `APPLY_INLINE_VIDEO_STATE` message handler (calls `inlineVideoEditor.applyState()`)
   - Added video editor initialization to `INIT_CLOUDINARY` handler

2. **`app.php`**
   - Added script include for `inline-video-change-command.js`
   - Added `COMMAND_INLINE_VIDEO_CHANGE` message handler to create history commands

## How It Works

### Initialization

1. When a section is added/loaded, `inlineVideoEditor.initForSection()` is called
2. The editor finds all `<video>` elements NOT inside `.fp-bg` containers
3. For each video, an edit indicator is added to the overlay container
4. The indicator is positioned over the video (or its overlay div if `data-video="prev"` exists)

### Editing Flow

1. User hovers over a video → indicator appears
2. User clicks indicator → video URL modal opens
3. User changes video URLs → saves
4. `applyVideoSources()` updates the video element:
   - Removes old `<source>` elements
   - Adds new `<source>` elements
   - Calls `video.load()` to reload
5. A unique UID is assigned/retrieved: `data-video-uid`
6. Before/after states are captured
7. A command is emitted: `COMMAND_INLINE_VIDEO_CHANGE`
8. The history manager receives the command and executes it
9. The command is added to the undo/redo stack

### Undo/Redo

1. User triggers undo/redo
2. Command's `undo()` or `redo()` method is called
3. Message is sent to iframe: `APPLY_INLINE_VIDEO_STATE`
4. `inlineVideoEditor.applyState()` finds the video by UID
5. Video sources and attributes are restored
6. Video is reloaded with `video.load()`
7. Section scrolls into view (if requested)

## Video State Structure

```javascript
{
  sources: [
    { src: "https://example.com/video.mp4", type: "video/mp4" },
    { src: "https://example.com/video.webm", type: "video/webm" }
  ],
  className: "w-full h-auto",
  attributes: {
    loop: true,
    muted: true,
    playsinline: true,
    autoplay: true
  }
}
```

## Integration Points

The inline video editor integrates with:

1. **Section initialization**: Videos are tracked when sections are added
2. **History system**: Video changes support undo/redo
3. **Portal pattern**: Edit indicators use a fixed overlay container (same as images)
4. **Autosave**: Changes trigger autosave like other edits

## Excluded Videos

Videos inside `.fp-bg` elements are explicitly excluded because they are already handled by the section background picker (`section-background-picker.js`), which has its own video editing functionality.

## Future Enhancements

Possible improvements:
- Video preview in the modal
- Support for video upload (not just URLs)
- Video thumbnail generation
- Advanced video controls (trim, filters, etc.)

