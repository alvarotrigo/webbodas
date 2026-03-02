# Section 28 Text Replacement Bug - Root Cause

## The Bug

**Symptom:** The Business pricing card (2nd card) in section 28 shows only "Popular Choice" text, losing all other content (title, description, price, features).

**Cause:** The selector `div[9]: "Popular Choice"` in the template JSON points to the WRONG element.

## Analysis

### What div[9] Actually Is

```html
<!-- Line 53 in fp-theme-pricing-2.html -->
<div class="relative card-themed border-2 ...">  <!-- THIS IS div[9]! -->
  <div class="absolute -top-4 ...">Recommended</div>  <!-- This is div[10] -->
  <div class="text-center">
    <h3>Business</h3>
    <p>The most popular features...</p>
    <!-- ALL THE CARD CONTENT -->
  </div>
</div>
```

- `div[9]` = The entire Business card **wrapper** (contains all card HTML)
- `div[10]` = The "Recommended" badge div (what we actually want)

### Why This Destroys Content

When the text replacement code runs:
```javascript
elements[9].textContent = "Popular Choice";
```

This:
1. Selects the card wrapper div
2. Sets its `textContent` property
3. **Destroys ALL child HTML elements** (h3, p, spans, list items, etc.)
4. Replaces everything with just the string "Popular Choice"

## Root Cause

The template JSON was generated with `"div[9]: "Popular Choice"` but the correct selector from `allowed-selectors.json` is `"div[10]: "Recommended"`.

### How Did This Happen?

Two possibilities:

**Option 1: Allowed-selectors.json was wrong at generation time**
- The template was created when the selectors file had `div[9]` listed
- The file was regenerated later, which changed it to `div[10]`
- Now the template has outdated selector references

**Option 2: OpenAI GPT hallucinated the selector**
- The API sent correct selectors (`div[10]`) to GPT
- GPT returned text for `div[9]` instead (counting error)
- The filtering code didn't catch it because...?

Let me check the filtering logic:

```php
// Line 410-418 in generate-section-text.php
foreach ($textUpdates as $selector => $value) {
    if (!isset($targetSet[$selector])) {
        continue;  // ← This should skip div[9] if it's not in targetSet!
    }
    $filtered[$selector] = $value;
}
```

The filtering SHOULD remove `div[9]` if it wasn't in the allowed selectors. But it didn't... which means **div[9] WAS in the allowed selectors at template generation time**.

## The Fix

### Immediate Fix ✅
Changed `"div[9]"` to `"div[10]"` in `/templates/fit-youth-gym-hub2.json`

### Long-term Prevention

The real issue is that **allowed-selectors.json can become stale** and templates can be generated with outdated selectors.

**Solution:** Add validation after text generation to ensure selectors still match current allowed-selectors.json

## Recommended Code Changes

### 1. Add Selector Validation in templates-creation/index.html

```javascript
async function validateTextUpdatesSelectors(template) {
    const allowedSelectorsMap = await loadAllowedSelectorsMap();
    const sectionMapping = await loadSectionMapping();
    const invalidSelectors = [];
    
    for (const [sectionId, textUpdates] of Object.entries(template.text_updates || {})) {
        const sectionFile = sectionMapping[sectionId];
        if (!sectionFile) continue;
        
        const allowedSelectors = resolveAllowedSelectors(allowedSelectorsMap, sectionFile);
        const allowedKeys = Object.keys(allowedSelectors);
        
        for (const selector of Object.keys(textUpdates)) {
            if (!allowedKeys.includes(selector)) {
                invalidSelectors.push({
                    section: sectionId,
                    selector: selector,
                    file: sectionFile
                });
            }
        }
    }
    
    if (invalidSelectors.length > 0) {
        console.error('Invalid selectors found:', invalidSelectors);
        showStatus(`⚠️ Warning: ${invalidSelectors.length} invalid selector(s) detected. Text replacement may fail.`, 'warning');
    }
    
    return invalidSelectors;
}

// Call this after generateAllSectionTexts:
template = await generateAllSectionTexts(template);
const invalidSelectors = await validateTextUpdatesSelectors(template);
```

### 2. Add Timestamp Check

Store the selectors file modification time in the template:

```javascript
const selectorsStats = await fetch('../public/js/section-allowed-selectors.json').then(r => r.headers.get('last-modified'));
template.selectors_version = selectorsStats;
```

Then warn if trying to preview a template with old selectors.

## Testing

Test file created: `/tests/debug-section-28-replacement.html`

This file:
1. Shows all div elements and their indices
2. Identifies which div is div[9] and div[10]
3. Demonstrates what happens when textContent is set on div[9]
4. Verifies other selectors work correctly

## Conclusion

- ✅ **Immediate fix applied** - Template corrected
- ⚠️ **Root cause identified** - Stale selectors in template
- 📋 **Prevention needed** - Add validation step to detect mismatched selectors
