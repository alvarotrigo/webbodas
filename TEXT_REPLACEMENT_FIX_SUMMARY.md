# Text Replacement Issues - Analysis & Fix Summary

## Problem Statement

The latest template (`fit-youth-gym-hub2.json`) has two text replacement issues:

1. **Section 7 (How It Works)**: No text replacement happening at all
2. **Section 28 (Pricing - 2nd card)**: Some elements show no text

## Root Cause Analysis

### Issue 1: Section 7 - Missing `text_updates`

**Finding**: The template JSON has `content_hints` for section 7 but NO `text_updates` for section 7.

**Evidence**:
- Lines 90-98: `content_hints["7"]` exists with headline and steps
- Lines 310-410: `text_updates` object has NO key "7"
- The text generation phase (`generateAllSectionTexts`) likely returned `null` for section 7

**Why it happened**:
- The API call to `/api/generate-section-text.php` likely failed silently for section 7
- The error was not logged or reported during template generation
- The `Promise.all` in `generateAllSectionTexts` continues even if one section fails

**Fix Applied**:
Added complete `text_updates` for section 7:
```json
"7": {
    "h2[0]": "Getting Started is Easy",
    "p[0]": "Follow these simple steps to join the Fit Youth Gym Hub and begin your fitness transformation today!",
    "h3[0]": "1. Choose your plan.",
    "h3[1]": "2. Sign up online or in-person.",
    "h3[2]": "3. Attend an orientation session.",
    "h3[3]": "4. Start your fitness journey!"
}
```

### Issue 2: Section 28 - Selector Mismatch (Investigation Needed)

**Initial Analysis**: The `text_updates` for section 28 DOES include all selectors for the second pricing card:
- `h3[1]`: "Standard" ✓
- `p[3]`: "Our most popular choice!..." ✓  
- `span[3]`: "€79" ✓
- `span[4]`: "/month" ✓
- `p[4]`: "Charged annually (save €240)" ✓
- `li[3-5]`: Feature list items ✓
- `a[3]`: "Try it Free" ✓

**Hypothesis**: The selectors are correct, but there might be:
1. A timing issue (DOMContentLoaded race condition)
2. An issue with how `querySelectorAll` counts elements within the section
3. Hidden elements or SVG elements affecting the count

**Testing Required**: Need to open the actual preview to verify if:
- The second card text is truly missing, or
- It's a display/CSS issue
- The selectors are matching the wrong elements

## Next Steps

1. ✅ Fixed section 7 by adding missing `text_updates`
2. ⏳ Test the fixed template in browser to verify section 7 works
3. ⏳ Investigate section 28 behavior in live preview
4. If section 28 still has issues, debug the selector matching

## Files Modified

- `/templates/fit-youth-gym-hub2.json` - Added section 7 text_updates

## Preventive Measures (Recommendations)

1. Add error logging in `generateAllSectionTexts` to catch failed sections
2. Show warning UI if any section returns null text_updates
3. Add validation to ensure all sections in template.sections have corresponding text_updates
4. Consider adding retry logic for failed section text generation
