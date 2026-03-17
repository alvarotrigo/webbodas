# Section to add to your AI agent prompt — Wedding themes reference

Use the content below **in place of** the "## 2. CSS Variables (:root) — Required" section in your agent instructions, and add the "REFERENCE FILE" block near the top.

---

## 1. Add this near the top (after GENERAL RULES)

```markdown
REFERENCE FILE — MANDATORY:
- Always use as reference: **templates/css/wedding-themes-reference.css**
- That file defines all theme classes (e.g. theme-wedding-sage-white, theme-wedding-terracotta, theme-wedding-midnight-stars) and the exact CSS variable names. Do not invent your own variable names or theme classes.
- Use only the variable names and theme class names listed in that file. For typography use --font-family and --heading-font (not --font-display, --font-body, --font-hand).
```

---

## 2. Replace "## 2. CSS Variables (:root) — Required" with this

```markdown
## 2. Theme system and CSS variables (required)

**Source of truth:** `templates/css/wedding-themes-reference.css`. Use it as the only reference for theme classes and variable names.

**In the template HTML:**
1. Include the reference CSS so variables are available. For a single self-contained HTML file, add in <head>:
   <link rel="stylesheet" href="templates/css/wedding-themes-reference.css" />
   (If the template is always loaded from your app, use the path that resolves correctly from the page URL; e.g. relative path from site root.)
2. On <body>, set exactly ONE theme class from the reference, e.g.:
   <body class="theme-wedding-sage-white">
   This makes the template work when viewed standalone. The editor may apply the theme on its container; the body class still provides a valid default.
3. Do NOT define :root { --primary-bg: ... } (or similar) in the template. The theme class from the reference file provides all color and typography variables.

**CSS variables to use (only these, from the reference file):**
- Backgrounds: --primary-bg, --secondary-bg, --accent-bg
- Text: --primary-text, --secondary-text, --accent-text
- Accents: --primary-accent, --primary-accent-soft, --secondary-accent
- Borders/shadows: --border-color, --shadow-color
- Gradients: --gradient-1, --gradient-2, --features2-bg
- Typography: --font-family, --heading-font
- Radii: --border-radius, --button-radius, --card-radius
- Spacing: --spacing-unit
- Shadows: --shadow-sm, --shadow-md, --shadow-lg, --card-shadow, --card-shadow-hover, --section-shadow

Use them in your CSS as var(--primary-bg), var(--primary-text), etc. Do not hardcode colors in the body.

**Overlay (for hero/section backgrounds):** Set the value only with `data-overlay-opacity="0.4"` on the section. In CSS use `var(--overlay-opacity, 0.5)` (generic fallback; do not duplicate the value in CSS — the editor reads the data attribute and sets the variable). Example:
.hero-bg::after {
    background: rgba(0, 0, 0, var(--overlay-opacity, 0.5));
}
```

---

## 3. Summary of what was wrong and what to change

| Current in your instructions | Problem | Change |
|-----------------------------|--------|--------|
| "All must be defined in :root" | wedding-themes-reference.css says do NOT define :root; the theme class provides variables. | Remove :root requirement; use one theme class on body and link to reference CSS. |
| --font-display, --font-body, --font-hand | Reference file uses --font-family and --heading-font only. | Use --font-family and --heading-font. |
| No mention of reference file | Agent has no obligation to use wedding-themes-reference.css. | Add explicit "always use as reference templates/css/wedding-themes-reference.css". |
| Long :root block with empty variables | Encourages defining variables in the template. | Replace with "include reference CSS + one theme class on body; do not define :root". |

---

## 4. Note on path to reference CSS

When the single HTML file is opened from disk or from your app, the link `href="templates/css/wedding-themes-reference.css"` must resolve. If your app serves templates from a route like `/preview?template=template1`, the path might need to be absolute or relative to the app root (e.g. `/templates/css/wedding-themes-reference.css`). Adjust the href in the instructions to match how you serve the template and the reference file.
