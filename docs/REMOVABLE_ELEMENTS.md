# Removable Elements Feature

## Overview

The Removable Elements feature allows users to remove optional/dynamic elements from sections during the editing process. This is particularly useful for customizing sections by removing features, cards, or components that aren't needed.

## How It Works

### Marking Elements as Removable

Any HTML element with the `data-fp-dynamic` attribute will be treated as a removable element:

```html
<div class="feature-card" data-fp-dynamic>
    <!-- This element can be removed by users -->
</div>
```

### User Experience

When users hover over a removable element:

1. **Blue Outline**: A rounded blue border (2px solid #3b82f6) appears around the element
2. **Remove Button**: A red "Remove" button appears at the top-right corner of the element
3. **Hover Effect**: The button animates upward slightly and shows a shadow effect
4. **Click to Remove**: Clicking the button removes the element with a smooth fade-out animation
5. **History Integration**: The removal triggers a history save, allowing users to undo the action

### Visual Design

- **Outline Color**: Blue (#3b82f6) - matches the editable text outline
- **Button Color**: Red (#ef4444) - indicates a destructive action
- **Button Icon**: Trash can icon (SVG)
- **Button Text**: "Remove"
- **Position**: Fixed position overlay using Portal pattern (doesn't affect DOM flow)

## Technical Implementation

### Architecture

The feature follows the same architecture as the Cloudinary Image Editor:

1. **Portal Pattern**: Indicators are rendered in a fixed-position overlay container, separate from the document flow
2. **Event Listeners**: Uses mouseenter/mouseleave for hover detection
3. **Position Updates**: Automatically updates positions on scroll/resize
4. **Cleanup**: Proper cleanup of event listeners when elements are removed

### Integration Points

The RemovableElementsManager is initialized:

1. **On Section Add**: When a new section is added to the canvas
2. **On Section Duplicate**: When a section is duplicated
3. **On History Restore**: When undo/redo operations restore sections
4. **On Page Load**: When existing sections are loaded from localStorage

### History Integration

When an element is removed:
1. The element fades out and is removed from the DOM
2. A `SECTION_EDITED` message is sent to the parent window
3. The History Manager automatically saves a new state
4. Users can undo the removal using Ctrl+Z (Cmd+Z on Mac)

## Example Usage

### Adding Removable Feature Cards

```html
<section class="features">
    <div class="grid">
        <!-- Optional feature card - can be removed -->
        <div class="feature-card" data-fp-dynamic>
            <h3>Feature Title</h3>
            <p>Feature description...</p>
        </div>
        
        <!-- Another optional feature card -->
        <div class="feature-card" data-fp-dynamic>
            <h3>Another Feature</h3>
            <p>Another description...</p>
        </div>
        
        <!-- Core feature - cannot be removed (no data-fp-dynamic) -->
        <div class="feature-card">
            <h3>Core Feature</h3>
            <p>This one cannot be removed</p>
        </div>
    </div>
</section>
```

### Adding Removable Team Members

```html
<section class="team">
    <div class="team-grid">
        <div class="team-member" data-fp-dynamic>
            <img src="member1.jpg" alt="Team Member 1">
            <h3>John Doe</h3>
            <p>CEO</p>
        </div>
        
        <div class="team-member" data-fp-dynamic>
            <img src="member2.jpg" alt="Team Member 2">
            <h3>Jane Smith</h3>
            <p>CTO</p>
        </div>
    </div>
</section>
```

## Best Practices

### When to Use `data-fp-dynamic`

Use `data-fp-dynamic` for elements that are:
- **Optional**: Not essential to the section's core purpose
- **Repeatable**: Multiple similar items (features, team members, testimonials)
- **Customizable**: Users might want to adjust the quantity
- **Self-contained**: Removing them doesn't break the layout

### When NOT to Use `data-fp-dynamic`

Avoid using `data-fp-dynamic` for:
- **Core Structure**: Essential containers or layout elements
- **Unique Content**: One-of-a-kind elements that define the section
- **Headers/Titles**: Main headings or section titles
- **Layout Wrappers**: Grid containers or flex layouts

### Layout Considerations

When marking elements as removable:
- Ensure the layout remains functional when elements are removed
- Use CSS Grid or Flexbox that adapts to fewer items
- Test removing different combinations of elements
- Consider minimum required items for the section to look good

## Files

- **Manager**: `/public/js/removable-elements-manager.js`
- **Integration**: `/preview.html` (script loading and initialization)
- **Example**: `/sections/fp-theme-features.html` (feature cards with data-fp-dynamic)

## Browser Compatibility

The feature uses modern JavaScript and CSS:
- ES6 Classes
- Map data structure
- Template literals
- Fixed positioning
- CSS transitions

Compatible with all modern browsers (Chrome, Firefox, Safari, Edge).


