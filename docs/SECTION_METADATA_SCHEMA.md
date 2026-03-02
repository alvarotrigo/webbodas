# Section Metadata Schema Documentation

This document describes the JSON schema used for structured metadata of section blocks in the website editor. Each section block is analyzed based on its structure, layout, and UI elements (not text content) and represented using this standardized schema.

## Schema Overview

The schema provides a comprehensive way to describe section blocks by capturing:
- **Category**: The type of section (hero, features, testimonials, etc.)
- **Layout**: How content is arranged (centered, split, grid, etc.)
- **Structure**: Column count, elements present, media type and position
- **Styling**: Visual style, density, spacing, alignment
- **Content**: Number of content units, presence of quotes, ratings, avatars
- **Purpose**: The role the section plays (intro, social-proof, etc.)

## JSON Item Schema

```json
{
  "id": 0,                                  // number or string id
  "category": "hero|features|testimonials|pricing|team|gallery|portfolio|contact|cta|faq|logos|stats|steps|content|nav|footer",
  "layout": "centered|split|stacked|grid|list|masonry|carousel|cards|media-left|media-right",
  "cols": 1,                                 // integer 1–6
  "elements": ["heading","subheading","paragraph","button","image","video","icon","avatar","rating","badge","logo","list","card","form","quote","author","role","illustration","logos"], 
  "media": "none|image|video|gallery|illustration",
  "media_position": "left|right|top|bottom|background|none",
  "cta": "none|one|two|multi",
  "align": "left|center|right|justified",
  "density": "minimal|regular|dense",
  "style": ["modern","clean","classic","elegant","playful","brutal","carded","flat","gradient","overlay","solid"], 
  "background": "color|image|video",
  "section_role": "intro|overview|highlight|social-proof|comparison|gallery|feature|contact|signup|login|trust|steps|showcase",
  "content_units": 0,                        // e.g., number of cards/testimonials/logos
  "has_quote": false,
  "has_rating": false,
  "has_avatars": false,
  "spacing": "tight|normal|roomy"
}
```

## Field Descriptions

### `id` (number or string)
Unique identifier for the section. Typically corresponds to the section number or filename.

### `category` (enum)
The primary category/type of the section:
- `hero` - Hero/intro sections
- `features` - Feature showcase sections
- `testimonials` - Customer testimonials/reviews
- `pricing` - Pricing plans/comparison
- `team` - Team member profiles
- `gallery` - Image galleries
- `portfolio` - Portfolio/showcase
- `contact` - Contact forms/information
- `cta` - Call-to-action sections
- `faq` - Frequently asked questions
- `logos` - Logo grids/brand showcases
- `stats` - Statistics/numbers
- `steps` - Step-by-step processes
- `content` - General content sections
- `nav` - Navigation sections
- `footer` - Footer sections

### `layout` (enum)
How the content is arranged:
- `centered` - Content centered in a single column
- `split` - Two-column split layout
- `stacked` - Vertical stacking of elements
- `grid` - Grid arrangement (multiple columns/rows)
- `list` - List/vertical arrangement
- `masonry` - Masonry/pinterest-style layout
- `carousel` - Carousel/slider layout
- `cards` - Card-based layout
- `media-left` - Media on left, content on right
- `media-right` - Media on right, content on left

### `cols` (integer, 1-6)
Number of columns in the layout. For grid layouts, this represents the number of columns. For split layouts, typically 2.

### `elements` (array of strings)
List of UI elements present in the section. Possible values:
- `heading` - Main heading/title
- `subheading` - Secondary heading
- `paragraph` - Body text/description
- `button` - Call-to-action button
- `image` - Image element
- `video` - Video element
- `icon` - Icon elements
- `avatar` - User/team member avatars
- `rating` - Star ratings
- `badge` - Badge/label elements
- `logo` - Logo elements
- `list` - List items
- `card` - Card containers
- `form` - Form inputs
- `quote` - Quotation text
- `author` - Author name
- `role` - Job title/role
- `illustration` - Illustration/graphic
- `logos` - Multiple logos

### `media` (enum)
Type of media present:
- `none` - No media
- `image` - Single image or images
- `video` - Video content
- `gallery` - Image gallery
- `illustration` - Illustration/graphic

### `media_position` (enum)
Position of media relative to content:
- `left` - Media on the left
- `right` - Media on the right
- `top` - Media at the top
- `bottom` - Media at the bottom
- `background` - Media as background
- `none` - No media or media integrated into content units

### `cta` (enum)
Number of call-to-action buttons:
- `none` - No buttons
- `one` - Single button
- `two` - Two buttons
- `multi` - Multiple buttons (3+)

### `align` (enum)
Text alignment:
- `left` - Left-aligned
- `center` - Center-aligned
- `right` - Right-aligned
- `justified` - Justified text

### `density` (enum)
Visual density/spacing:
- `minimal` - Minimal spacing, compact
- `regular` - Standard spacing
- `dense` - Tight spacing, more content

### `style` (array of strings)
Visual style descriptors (can have multiple):
- `modern` - Modern design aesthetic
- `clean` - Clean, minimalist design
- `classic` - Classic/traditional design
- `elegant` - Elegant, refined design
- `playful` - Playful, fun design
- `brutal` - Brutalist design
- `carded` - Card-based design with distinct cards
- `flat` - Flat design (no shadows/depth)
- `gradient` - Gradient colors
- `overlay` - Overlay effects
- `solid` - Solid colors

### `background` (enum)
Background type:
- `color` - Solid color background
- `image` - Image background
- `video` - Video background

### `section_role` (enum)
The purpose/role of the section:
- `intro` - Introduction/hero section
- `overview` - Overview/description
- `highlight` - Highlighting key information
- `social-proof` - Social proof (testimonials, reviews)
- `comparison` - Comparison (pricing, features)
- `gallery` - Image/media gallery
- `feature` - Feature showcase
- `contact` - Contact information/form
- `signup` - Signup/registration
- `login` - Login/authentication
- `trust` - Trust indicators (logos, badges)
- `steps` - Step-by-step process
- `showcase` - Showcase/portfolio

### `content_units` (integer)
Number of repeating content units (e.g., number of cards, testimonials, logos, team members). Use `0` if there are no repeating units.

### `has_quote` (boolean)
Whether the section contains quotation/quote text.

### `has_rating` (boolean)
Whether the section contains star ratings or rating elements.

### `has_avatars` (boolean)
Whether the section contains avatar/profile images.

### `spacing` (enum)
Spacing between elements:
- `tight` - Tight spacing
- `normal` - Standard spacing
- `roomy` - Generous spacing

## Examples

### Example A — Split Hero (Text Left, Video Right)

```json
{
  "id": 101,
  "category": "hero",
  "layout": "split",
  "cols": 2,
  "elements": ["heading", "paragraph", "button", "video"],
  "media": "video",
  "media_position": "right",
  "cta": "one",
  "align": "left",
  "density": "minimal",
  "style": ["modern", "clean"],
  "background": "color",
  "section_role": "intro",
  "content_units": 1,
  "has_quote": false,
  "has_rating": false,
  "has_avatars": false,
  "spacing": "roomy"
}
```

**Description**: A hero section with a split layout. Text content (heading, paragraph, button) is on the left, and a video is positioned on the right. The section serves as an introduction with minimal density and roomy spacing.

### Example B — Testimonials Grid (3 Cards with Avatars & Stars)

```json
{
  "id": 217,
  "category": "testimonials",
  "layout": "grid",
  "cols": 3,
  "elements": ["heading", "card", "avatar", "rating", "paragraph"],
  "media": "none",
  "media_position": "none",
  "cta": "none",
  "align": "center",
  "density": "regular",
  "style": ["modern", "carded"],
  "background": "color",
  "section_role": "social-proof",
  "content_units": 3,
  "has_quote": false,
  "has_rating": true,
  "has_avatars": true,
  "spacing": "normal"
}
```

**Description**: A testimonials section arranged in a 3-column grid. Each testimonial is presented as a card with an avatar, star rating, and paragraph text. The section serves as social proof with regular density and normal spacing.

## Usage Notes

1. **Analysis Focus**: The schema is based on **structure, layout, and UI elements only** - not on the actual text content or copy.

2. **Multiple Values**: Some fields like `elements` and `style` are arrays and can contain multiple values. Include all relevant values.

3. **Content Units**: Count repeating elements like cards, testimonials, team members, logos, etc. Use `0` if there are no repeating units.

4. **Media Position**: Use `none` when media is integrated into content units (like avatars in team cards) rather than being a standalone media block.

5. **Boolean Flags**: Use `has_quote`, `has_rating`, and `has_avatars` to quickly identify sections with these specific elements without parsing the `elements` array.

6. **Style Array**: Include all applicable style descriptors. A section can be both `modern` and `clean`, or `carded` and `gradient`.

## File Location

The structured metadata is stored in:
- `public/js/metadata.js` - Contains the complete dataset of all section metadata

## Related Documentation

- See the main application code in `app.php` for how this metadata is used in the editor
- Section files are located in the `sections/` directory
- Screenshots used for analysis are in the `screenshots/` directory


