# THE REAL ROOT CAUSE - Indexing Mismatch

## The Fundamental Problem

**The build script and text replacement code use DIFFERENT indexing methods!**

### Build Script (`build-allowed-selectors.mjs`)

```javascript
// Increments counter for EVERY element, even without meaningful text
counters[tag]++;

// Only creates selectors for elements WITH meaningful text
if (!hasMeaningfulText(element)) continue;
```

**Example for pricing section:**
- div[0-9]: No meaningful text → counter increments but NO selector created
- div[10]: "Recommended" → counter is at 10 → creates `div[10]: "Recommended"` ✓

### Text Replacement (`browser.html` - OLD CODE)

```javascript
const elements = section.querySelectorAll(tag);  // Gets ALL elements!
elements[elemIndex].textContent = text;
```

**Example for pricing section:**
- Gets ALL divs (including empty ones)
- `div[9]` in selectors → replaces `querySelectorAll('div')[9]` → WRONG ELEMENT!

## Why This Causes The Bug

The selector `div[10]` in `allowed-selectors.json` means:
- "The 10th div that was encountered during tree walk"
- Which happens to be the ONLY div with meaningful text

But `querySelectorAll('div')[10]` means:
- "The 10th div in DOM order"  
- Which is the SAME element! ✓

**However, if someone puts `div[9]` in the template, it would refer to a DIFFERENT div!**

So the template having `div[9]` is simply WRONG DATA - it's pointing to the card wrapper instead of the badge.

## The Fix Applied

Changed `browser.html` text replacement to match the build script's logic:

```javascript
// Get all elements of this tag
const allElements = section.querySelectorAll(tag);

// Filter to only elements with meaningful text (matches build script)
const meaningfulElements = Array.from(allElements).filter(hasMeaningfulText);

// Use the filtered index
if (meaningfulElements[elemIndex]) {
    meaningfulElements[elemIndex].textContent = text;
}
```

Now:
- `div[0]` in selectors → first div with meaningful text → div[10] in real DOM ✓
- Indexes are consistent between generation and application!

## Why The Template Has div[9]

The template was generated when either:
1. The HTML had a different structure (one less div before the badge)
2. The build script had a bug that produced div[9]
3. GPT hallucinated and returned div[9] instead of div[10]

**But now with the fix, it doesn't matter!** Even if the template says `div[9]`, it will be interpreted as "the 9th div with meaningful text" which doesn't exist, so it will fail gracefully with a console warning instead of destroying content.

## Actually... Wait

Let me reconsider. If `allowed-selectors.json` currently has `div[10]`, and the template has `div[9]`, then:

**The template was generated from an OLDER version of allowed-selectors.json that had div[9]!**

This could happen if:
1. HTML was modified (a div was added before the badge)
2. Build script was fixed (was counting wrong before)
3. Selectors were regenerated with new logic

## The REAL Solution

With my fix, the text replacement now matches the build script's logic EXACTLY. This means:
- Build script creates `div[10]: "Recommended"` (the 10th div encountered, which is the only one with text)
- Text replacement filters to divs with text → finds the badge as meaningful div[0] → but we're looking for div[10]...

**WAIT, THIS IS STILL WRONG!**

Let me think about this more carefully. The build script counter includes ALL divs, so `div[10]` means "the 10th div in tree walk order." My filter would break this!

Let me revert that change and think about the correct fix...
