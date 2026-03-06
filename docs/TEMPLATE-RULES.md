# Wedding Editor — Template Rules

Rules that every HTML template must follow so all editor features work correctly. Use this document when designing or generating new templates.

---

## 1. Document Structure

**All visible content must be inside `<section>` or `<footer>`.** The editor only treats these two elements as editable sections. Any loose `<div>` at body level is ignored unless it has the class `parallax-quote` (the only special case that gets auto-promoted to a section).

- Do not place loose `<div>`s between sections. If you need a quote/parallax strip, make it a `<section>`.
- Each `<section>` and `<footer>` must have a unique `id` (these match the navbar `href="#id"`).
- The `<nav>` must be a direct child of `<body>`, outside any section.
- Preloaders, toasts, and modals go outside sections (before nav or after footer).

---

## 2. CSS Variables (:root) — Required

The editor uses these variables for the color picker, theme manager, and section backgrounds. **All must be defined in `:root`:**

```css
:root {
    --primary-bg: #F8EDE3;
    --secondary-bg: #FFF9F4;
    --accent-bg: #F0DAC8;
    --primary-text: #2C2C2C;
    --secondary-text: #3A3A3A;
    --accent-text: #2D5A3D;
    --primary-accent: #C47D5A;
    --primary-accent-soft: #B8D4B8;
    --secondary-accent: #E8937A;
    --border-color: #8DB48E;
    --font-display: 'Playfair Display', Georgia, serif;
    --font-body: 'DM Sans', 'Helvetica Neue', sans-serif;
    --font-hand: 'Caveat', cursive;
}
```

- Use `var(--primary-bg)`, `var(--primary-text)`, etc. throughout. Do not hardcode colors the user should be able to change.
- For overlays, use `var(--overlay-opacity, 0.6)` so the editor's opacity slider works:
  ```css
  .hero-bg::after {
      background: rgba(0, 0, 0, var(--overlay-opacity, 0.6));
  }
  ```

---

## 3. Navbar

- The editor looks for `<nav>` as a direct child of body (or `#preview-content` in editor mode).
- Each `<a>` must have `href="#section-id"` matching the section's `id`.
- If you use `<ul><li><a>`, the editor hides the whole `<li>` when the target section is removed.
- If there is a logo link, give it `class="logo"` so the editor excludes it from sync.
- Define CSS for `nav.scrolled`; the editor toggles this class on scroll.

---

## 4. Countdown — Required Structure

The editor detects countdown sections by the class `countdown-section` and the IDs `#days`, `#hours`, `#minutes`, `#seconds`.

**Required:**
1. The `<section>` must have `class="countdown-section"`.
2. It must have `data-wedding-date="YYYY-MM-DDTHH:MM:SS"` (ISO format). If missing, the editor tries to extract the date from inline scripts matching `new Date('YYYY-MM-DDTHH:MM:SS')`.
3. At least one `.countdown-item` inside the section.
4. Number display elements must have ids: `#days`, `#hours`, `#minutes`, `#seconds`.

**Example:**

```html
<section class="countdown-section" id="countdown" data-wedding-date="2026-09-12T17:00:00">
    <div class="countdown-wrapper">
        <div class="countdown-item">
            <span class="number" id="days">000</span>
            <span class="label">Days</span>
        </div>
        <div class="countdown-item">
            <span class="number" id="hours">00</span>
            <span class="label">Hours</span>
        </div>
        <div class="countdown-item">
            <span class="number" id="minutes">00</span>
            <span class="label">Minutes</span>
        </div>
        <div class="countdown-item">
            <span class="number" id="seconds">00</span>
            <span class="label">Seconds</span>
        </div>
    </div>
</section>
```

**Script:** The countdown script must read the date from `data-wedding-date` on the section element, not from a hardcoded variable, so the editor's date change updates the display.

---

## 5. Map — Required Structure

The editor looks for `.map-container` with an `<iframe>` inside.

**Required:**
1. Container with `class="map-container"`.
2. One `<iframe>` inside with a Google Maps embed URL.
3. The container must be inside a `<section>`.

**Example:**

```html
<section id="location">
    <div class="map-container">
        <iframe
            src="https://maps.google.com/maps?q=Central+Park+New+York&output=embed"
            loading="lazy"
            allowfullscreen
        ></iframe>
    </div>
</section>
```

---

## 6. Images — Cloudinary Detection

**Standard images:** Use `<img>` inside a section. Always include `alt` and `loading="lazy"`. Do not put images inside elements with `data-bg-image="true"`.

**Section background images:** Use a direct child of the section with class `fp-bg` and the image in inline style:

```html
<section class="hero" id="hero">
    <div class="fp-bg" style="background-image: url('https://...');"></div>
    <div class="hero-content">...</div>
</section>
```

- The image URL must be in inline style (or in a CSS class that the loader will move to inline). Prefer inline for reliability.
- If you use a class like `.hero-bg` with `background-image` in CSS, the loader will promote it to `.fp-bg`; using `.fp-bg` directly is preferred.

**Overlay:** Use `var(--overlay-opacity)` in the overlay pseudo-element so the editor's opacity slider works.

---

## 7. Forms (e.g. RSVP)

- The editor detects a `<form>` to show optional email fields when publishing.
- **Every `<input>`, `<select>`, and `<textarea>` must have a `name` attribute** so submitted data can be processed.
- Each input should have a unique `id` and a `<label for="id">`. The form must be inside a `<section>`.

---

## 8. Animations — Reveal Classes

The template can use reveal classes; the editor adds `.in-viewport` or `.visible` when elements enter the viewport.

Use classes such as `.reveal`, `.reveal-left`, `.reveal-right`, `.reveal-scale` with CSS that defines initial state (e.g. `opacity: 0; transform: ...`) and final state when `.visible` or `.in-viewport` is added (e.g. `opacity: 1; transform: none`).

The editor automatically animates: `.section h1`–`h6`, `p`, `a`, `img`, `form`, `label`, `input`, `textarea`, `button`, and `.section .animate-element`.

---

## 9. SVGs (Icons)

Use inline SVGs with `xmlns="http://www.w3.org/2000/svg"`. Prefer `stroke="currentColor"` or `fill="currentColor"` so they inherit text color, or use variables like `fill="var(--primary-accent)"`. SVGs inside sections are clickable in the editor to replace the icon.

---

## 10. Removable Elements (Optional)

To allow single elements (e.g. cards) to be removed by the user, add `data-fp-dynamic` to the element. To make all direct children of a container removable, add `data-fp-dynamic-items="true"` to the container.

---

## 11. Background Videos

For video backgrounds, use a `.fp-bg` child containing a `<video>` element. The section will get `has-bg-video` and the editor will allow swapping between video and image.

---

## 12. Text Editing (TinyMCE)

The editor makes these elements editable automatically: `h1`–`h6`, `p`, `a`, `span`, `blockquote`, `cite`, `label`, `li`, `button` inside sections; `a` inside `nav`; and text-only `div`s. Do not add your own `contenteditable` or script that blocks clicks on text.

---

## 13. CSS Best Practices

- Use the `:root` variables for colors and typography.
- For overlays that should be adjustable, use `var(--overlay-opacity)`.
- Use `min-height` (e.g. `min-height: 100vh`) for hero sections instead of fixed `height` so editable content does not overflow.
- The editor rewrites `body` and `html` selectors in template CSS to `#preview-content` when loading; design your CSS with that in mind.

---

## 14. Template Script

- Put all JavaScript in a single `<script>` at the end of `<body>`.
- Countdown must read from `data-wedding-date` on the section.
- Smooth scroll and reveal logic can stay for standalone preview; the editor has its own scroll and animation handling.

---

## 15. Checklist

| Requirement | Check |
|-------------|--------|
| All content in `<section>` or `<footer>` | No loose divs between sections |
| Full `:root` variables | All 10+ variables defined |
| `<nav>` as direct child of body | Links use `href="#section-id"` |
| Countdown: `countdown-section`, `data-wedding-date`, `#days` / `#hours` / `#minutes` / `#seconds`, `.countdown-item` | Present |
| Map: `.map-container` with `<iframe>` | Google Maps embed URL |
| Background images: `.fp-bg` or inline style on section | Not only in CSS if you want editor control |
| Form: every input has `name` | Labels with correct `for` |
| Reveal animations: `.reveal` / `.visible` (or `.in-viewport`) | CSS defines initial and final state |
| Inline SVGs with `currentColor` or variables | No icon fonts for main icons |
| No script blocking clicks on text | TinyMCE needs access to headings, paragraphs, links |
| Countdown script reads `data-wedding-date` | No hardcoded date in JS |
| Overlays use `--overlay-opacity` | Editor opacity slider works |
| No fixed elements covering sections | Except nav |
| `loading="lazy"` on images and iframes | Performance |

---

End of template rules.
