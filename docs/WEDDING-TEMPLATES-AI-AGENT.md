# Wedding Templates — AI Agent Brief

This document is for **AI agents** that generate or edit HTML wedding page templates. Use it together with **[TEMPLATE-RULES.md](./TEMPLATE-RULES.md)** (canonical rules for structure, countdown, map, forms, etc.). Here we focus on theme system, file layout, and what the editor expects so your output works in the Wedding Editor.

---

## 1. Purpose of this document

- **You (the AI)** may be asked to: create a new wedding template, adapt an existing one, or change content/structure while keeping editor compatibility.
- **Rules for structure, countdown, map, images, forms, etc.** are in **TEMPLATE-RULES.md**. Follow them exactly.
- **This document** adds: where files go, how themes work, which CSS variables to use, and how templates are registered.

---

## 2. Where templates live

| What | Location / format |
|------|--------------------|
| HTML templates | `templates/html/` |
| File names | `template1.html`, `template2.html`, … (no spaces; lowercase). New templates: next number, e.g. `template6.html`. |
| Previews (thumbnails) | `templates/previews/template1.jpg`, `template2.jpg`, … (same base name as HTML). |
| Registry (app) | `public/js/app.js` — array `templates` and list `templateCategories` (see below). |

Adding a new template implies:
1. Adding `templates/html/templateN.html`.
2. Adding a row in the `templates` array in `app.js`.
3. Adding a preview image in `templates/previews/templateN.jpg` (optional but recommended).

---

## 3. Theme system (important)

The **editor** applies a single theme class to the preview/page (e.g. `theme-wedding-blush-ivory`). Themes define **only colors, shadows, radii, and spacing** via CSS variables. **Text content is per template.**

- **Do not** hardcode a theme class in the template HTML (e.g. do not add `class="theme-wedding-rose-gold"` to `body`). The editor sets the theme on its container.
- **Do** use the **theme CSS variables** for all colors and shadows so that when the editor applies a theme, the template responds.

### Theme CSS variables (use these in your template CSS)

Use these in your `<style>` (and prefer them over fixed hex/rgb):

| Variable | Typical use |
|----------|-------------|
| `--primary-bg` | Page/section background |
| `--secondary-bg` | Cards, alternate sections |
| `--accent-bg` | Highlighted blocks |
| `--primary-text` | Body text |
| `--secondary-text` | Muted text |
| `--accent-text` | Headings, emphasis |
| `--primary-accent` | Buttons, links, accents |
| `--primary-accent-soft` | Soft accent backgrounds |
| `--secondary-accent` | Hover/secondary accent |
| `--border-color` | Borders, dividers |
| `--shadow-color` | Generic shadow tint |
| `--gradient-1`, `--gradient-2` | Background gradients |
| `--features2-bg` | Feature/CTA block background |
| `--shadow-sm`, `--shadow-md`, `--shadow-lg` | Box shadows |
| `--card-shadow`, `--card-shadow-hover` | Cards (if defined by theme) |
| `--section-shadow` | Section inset shadow (if defined) |
| `--font-family`, `--heading-font` | Body and headings |
| `--border-radius`, `--button-radius`, `--card-radius` | Radii |
| `--spacing-unit` | Padding/margin scale |

Example in template CSS:

```css
body {
  background-color: var(--primary-bg);
  color: var(--primary-text);
  font-family: var(--font-family);
}
.hero { background: var(--gradient-1); }
.btn {
  background: var(--primary-accent);
  border-radius: var(--button-radius);
  box-shadow: var(--shadow-sm);
}
```

### Optional `:root` in template

Templates can define a `:root { ... }` with the same variable names as **defaults** for standalone preview. The editor will override them when it applies a theme. Prefer using the variables above rather than introducing new names.

---

## 4. Available theme IDs (25 wedding themes)

The editor offers exactly these theme classes. Do **not** invent new theme class names; the editor only knows these.

| Theme class name | Display name |
|------------------|-------------|
| `theme-wedding-blush-ivory` | Blush & Ivory |
| `theme-wedding-rose-gold` | Rose Gold & Cream |
| `theme-wedding-dusty-rose` | Dusty Rose & Sage |
| `theme-wedding-white-pearl` | White & Pearl |
| `theme-wedding-sage-white` | Sage & White |
| `theme-wedding-ash-minimal` | Ash Grey Minimal |
| `theme-wedding-terracotta` | Terracotta & Sage |
| `theme-wedding-champagne-pampas` | Champagne & Pampas |
| `theme-wedding-cedar` | Cedar & Wildflower |
| `theme-wedding-black-gold` | Black & Gold |
| `theme-wedding-navy-gold` | Navy & Gold |
| `theme-wedding-ivory-champagne` | Ivory & Champagne |
| `theme-wedding-silver-pearl` | Silver & Pearl |
| `theme-wedding-aqua-sand` | Aqua & Sand |
| `theme-wedding-hibiscus` | Hibiscus & Coral |
| `theme-wedding-coastal` | Coastal Blue |
| `theme-wedding-frost` | Frost & Ice |
| `theme-wedding-berry-velvet` | Berry & Velvet |
| `theme-wedding-midnight-stars` | Midnight & Stars |
| `theme-wedding-moody-mauve` | Moody Mauve |
| `theme-wedding-lilac-gold` | Lilac & Gold |
| `theme-wedding-enchanted-forest` | Enchanted Forest |
| `theme-wedding-sepia-lace` | Sepia & Lace |
| `theme-wedding-art-deco` | Art Deco Noir |
| `theme-wedding-garden-party` | Garden Party |

---

## 5. Template categories (for registry)

When registering a new template in `app.js`, use one of these **category** values so it appears in the right filter:

| Category id | Name (for reference) |
|-------------|------------------------|
| `all` | All Templates |
| `minimal` | Minimalist & Modern |
| `classic` | Classic & Romantic |
| `rustic` | Rustic Boho & Chic |
| `funny` | Funny & Light |
| `luxe` | Luxe & Glamour |
| `alternative` | Edgy & Alternative |
| `fairytale` | Enchanted & Fairytale |
| `summer` | Summer & Beach |
| `winter` | Winter & Snow |
| `celestial` | Celestial & Moody |
| `vintage` | Retro & Vintage |

---

## 6. Registering a new template in `app.js`

In `public/js/app.js`, find the `templates` array and add an object like:

```js
{ id: 6, is_pro: 0, name: 'Your Template Name', file: 'template6.html', category: 'classic', tags: ['classic', 'elegant'] },
```

- `id`: next numeric id (unique).
- `is_pro`: `0` = free, `1` = pro.
- `name`: label shown in the template picker.
- `file`: filename in `templates/html/`.
- `category`: one of the category ids above.
- `tags`: optional array of keywords for search/filter.

---

## 7. Meta tags in template `<head>`

Include at least:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="description" content="Short description of the wedding page (used for SEO/preview)." />
<meta name="template-name" content="Display Name in Picker" />
<meta name="template-styles" content="category-id" />
```

- `template-styles` should match the template’s **category** (e.g. `minimal`, `classic`, `rustic`, `summer`).

---

## 8. Language and tone

- **Code and comments:** English.
- **Visible text in templates:** English (placeholder names, buttons, labels).
- **Tone:** Elegant, festive, and organized; suitable for a wedding platform.

---

## 9. Checklist for AI-generated templates

Before outputting a template, ensure:

| Check | Requirement |
|-------|-------------|
| Structure | All content in `<section>` or `<footer>`; no loose `<div>`s between sections (see TEMPLATE-RULES.md). |
| Section IDs | Each `<section>` / `<footer>` has a unique `id` (used by nav and editor). |
| Nav | `<nav>` is direct child of `<body>`; links use `href="#section-id"`. |
| Colors | Use theme variables (`var(--primary-bg)`, `var(--primary-accent)`, etc.); avoid hardcoded theme class on `body`. |
| Countdown | If present: `class="countdown-section"`, `data-wedding-date="YYYY-MM-DDTHH:MM:SS"`, and `#days`, `#hours`, `#minutes`, `#seconds` (see TEMPLATE-RULES.md). |
| Map | If present: `.map-container` with one `<iframe>` (see TEMPLATE-RULES.md). |
| Forms | Every `<input>`, `<select>`, `<textarea>` has a `name`; labels use `for="id"`. |
| Images | Section backgrounds: child with class `fp-bg` and inline `style="background-image: url(...)"`; overlays use `var(--overlay-opacity)`. |
| Script | Single `<script>` at end of `<body>`; countdown reads from `data-wedding-date`. |
| Meta | `template-name` and `template-styles` (category) present. |

---

## 10. Reference summary

- **Full structural and feature rules:** [TEMPLATE-RULES.md](./TEMPLATE-RULES.md).
- **Theme variable definitions:** in `public/css/sections.css` (classes `.theme-wedding-*`). Templates only need to use the variable names; the editor applies the theme.
- **Template list and categories:** `public/js/app.js` → `templates`, `templateCategories`.

Use this document when generating or editing wedding templates so they work correctly in the Wedding Editor.
