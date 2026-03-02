Integrate the Header/Nav UI into the editor using a simple 2-step flow, reusing the existing “Navigation Controls” panel settings.

Context
- I already have header layouts and controls working in a prototype located in ./all-headers.html

- In the editor today I already have a “Navigation Controls” panel with these fields:
  - Background: Solid / Transparent / Glass
  - Corners: Sharp / Rounded / Pill
  - Theme: Dark / Light / Accent + Theme Colors dropdown
  - Shadow: None / Subtle
  - Actions: 2 Buttons / 1 Button / Icons / None
  - CTA Style: Auto / Text Link / Outline / Solid
- Do NOT redesign the header styles. Just reorganize UI so it’s easier.
- Do NOT add tests.
- Do NOT handle export/download yet.

Goal
Create a “Header” modal (or drawer) with 2 steps:
1) Choose Layout
2) Customize (using the same existing controls, but organized + with show/hide rules)

Step 1 — Choose Layout
- Show the available header layouts as clickable preview cards (4 layouts).
- When user selects one:
  - store selected layout in state
  - close Step 1 and go to Step 2

Step 2 — Customize
- This step should basically show the same controls we already have, but grouped and with conditional visibility.

UI mapping (use this exact structure)

A) Essentials (always visible)
- Background (Solid / Transparent / Glass)  -> same state as current Background
- Corners (Sharp / Rounded / Pill)          -> same state as current Corners
- Theme (Dark / Light / Accent)             -> same state as current Theme
- Theme Colors dropdown                      -> keep exactly as it is today

B) Advanced (collapsed accordion by default)
- Shadow (None / Subtle)                    -> same state as current Shadow
- Actions (2 Buttons / 1 Button / Icons / None) -> same state as current Actions
- CTA Style (Auto / Text Link / Outline / Solid) -> same state as current CTA Style

Conditional visibility rules (important)
- If selected layout has NO actions area:
  - Hide Actions and CTA Style (don’t show them at all)
- If Actions = None:
  - Hide CTA Style
- If Actions = Icons:
  - Hide CTA Style
- Otherwise (Actions is 1 Button or 2 Buttons):
  - Show CTA Style

Behavior
- Changing any control updates the header live immediately (same behavior as current prototype/panel).
- This is purely UI/UX refactor: the underlying values and meanings stay the same.

Implementation notes
- Keep the existing panel component logic if possible; just render it inside Step 2 and reorganize into “Essentials” and “Advanced”.
- Step 1 is new: layout picker UI that sets layoutId in state.
- Add a “Back” button to go from Step 2 back to Step 1.

Deliverable
- Working 2-step header modal/drawer:
  - Step 1: layout picker
  - Step 2: same existing controls, reorganized, with the hide/show rules above