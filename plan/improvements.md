# Template Generator Improvements

## Implementation Status

### Completed ✓
- [x] Site Plan extraction step (STEP 0)
- [x] Diversity constraints in section matching

### In Progress 🔄
- None

### Planned 📋
- [ ] Consistency Pass (Medium Impact, Low Effort)
- [ ] Suitability Tags for Section Metadata (High Impact, Medium Effort)
- [ ] Automatic Critique Loop (Medium Impact, Medium Effort)
- [ ] Pre-filter Before LLM Selection (Optional, Architectural)

---

## Analysis: What You Already Have vs. What's Suggested

### Already Implemented Well

1. **Design system generation** (Point 4 in notes) - Your `mapStyleBriefToTheme()` already converts the style brief into CSS variables (colors, shadows, border radius, typography, spacing). This is solid.

2. **Two-phase section selection** - You already do structure → matching (categories first, then specific IDs). This is good.

3. **Content outline for consistency** - Your `generate-content-outline.php` with `avoid_phrases` is a smart way to prevent repetitive headlines across sections.

4. **Separate content fill** (Point 5 partial) - You generate layout first, then content separately.

---

## What Makes Sense to Implement (Prioritized)

### 1. Add a "Site Plan" Step (High Impact, Low-Medium Effort)

**The problem:** You go directly from description → section categories without explicitly capturing:
- Target audience
- Primary goal/CTA
- Brand vibe keywords  
- Content tone

**Why it matters:** Without this, the model picks "reasonable" sections but lacks strategic coherence. A SaaS landing page for enterprise vs. startups should have different section choices and tone.

**Implementation:**
Add a first API call that extracts a "site plan" from the description:

```json
{
  "audience": "fitness enthusiasts aged 18-35",
  "primary_goal": "sign up for free trial",
  "brand_vibe": ["energetic", "bold", "youth-focused"],
  "content_tone": "motivational, direct",
  "key_differentiators": ["24/7 access", "personal trainers", "community"]
}
```

Then pass this to the structure determination and content generation steps.

---

### 2. Add Suitability Tags to Section Metadata (High Impact, Medium Effort)

**The problem:** Your metadata has `category`, `layout`, `elements`, but doesn't indicate what types of businesses/use cases each section works best for.

**Current metadata looks like:**
```json
{
  "id": 27,
  "category": "pricing",
  "layout": "grid",
  "elements": ["cards", "buttons"],
  "mediaType": "none"
}
```

**Enhanced metadata would add:**
```json
{
  "id": 27,
  "category": "pricing",
  "layout": "grid",
  "elements": ["cards", "buttons"],
  "mediaType": "none",
  "suitability": ["saas", "subscription", "digital_product"],
  "layoutTraits": ["clean", "comparison-friendly"],
  "constraints": {
    "min_items": 2,
    "max_items": 4,
    "works_best_with": "short headlines"
  }
}
```

**How to generate:** You could use AI to analyze each of your ~200 sections once and generate these tags, then review and store them. This would dramatically improve section matching.

---

### 3. Add Diversity Constraints (High Impact, Low Effort)

**The problem:** Your section matching prompt doesn't explicitly enforce:
- Don't pick sections with the same layout skeleton
- Enforce narrative order (problem → solution → proof → CTA)
- Limit "busy" sections

**Implementation:** Update your matching prompt in `generate-template.php`:

```php
$matchingPrompt .= "
Diversity rules (MUST follow):
1. Don't pick multiple sections with the same layout type
2. Ensure visual variety: if section N has cards, section N+1 should use a different element
3. Narrative flow: hero → value proposition → social proof → conversion
4. Maximum 2 'dense' or 'busy' sections per page
5. If two sections could fit, prefer the one with different visual weight from adjacent sections
";
```

---

### 4. Add a Consistency Pass (Medium Impact, Low Effort)

**The problem:** After content generation, there's no verification that:
- The primary CTA is consistent across sections
- Product/brand name is spelled consistently
- Copy length fits the section (no overflow)

**Implementation:** Add a quick verification call after `generateAllSectionTexts()`:

```javascript
async function runConsistencyPass(template, sitePlan) {
    const response = await fetch('../api/verify-consistency.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            template: template,
            primary_cta: sitePlan.primary_goal,
            product_name: sitePlan.product_name
        })
    });
    
    const data = await response.json();
    if (data.issues && data.issues.length > 0) {
        // Show warnings or auto-fix
    }
    return data.fixed_template || template;
}
```

The API would check for mismatched CTAs, inconsistent terminology, etc.

---

### 5. Add Automatic Critique Loop (Medium Impact, Medium Effort)

**The problem:** You only have manual "Retry with Feedback". An automatic critique could catch issues before the user sees them.

**Implementation:** After template generation, run a quality check:

```javascript
async function critiqueTemplate(template) {
    // Score: visual rhythm, section redundancy, missing trust/proof, CTA clarity
    const response = await fetch('../api/critique-template.php', {
        method: 'POST',
        body: JSON.stringify({ template })
    });
    
    const critique = await response.json();
    
    // If score is low, auto-regenerate weak section(s)
    if (critique.weakest_section && critique.score < 7) {
        template = await regenerateSingleSection(template, critique.weakest_section, critique.feedback);
    }
    
    return { template, critique };
}
```

This is how you get "nice websites" without needing a miracle model - iterative refinement.

---

### 6. Pre-filter Before LLM Selection (Optional, Architectural)

**The problem:** You send ALL metadata to GPT-4o for section matching. This is expensive and the model sometimes picks poorly.

**Better approach:**
1. **Hard filter:** Only show sections matching the desired category
2. **Score by suitability:** If you have suitability tags, filter to those matching the use case
3. **Send top 3-5 per category** to LLM for final selection

This reduces token usage and improves quality.

---

## Recommended Implementation Roadmap

**V1.5 (Quick wins):**
- Add Site Plan extraction step
- Add diversity constraints to matching prompt
- Add consistency pass after content generation

**V2 (Quality jump):**
- Generate suitability tags for all sections (one-time AI + manual review)
- Add automatic critique loop
- Per-section regeneration for weak sections

**V3 (Advanced):**
- Embedding-based retrieval instead of full metadata in prompt
- "Make it more X" style controls (minimal, playful, corporate)
- Multi-page support

---

## What Probably Doesn't Make Sense (for your case)

1. **Full embedding-based retrieval** - You have ~200 sections. The current approach of sending metadata to GPT-4o works fine at this scale. Embeddings add complexity without huge benefit until you have 1000+ sections.

2. **Complex semantic matching** - Your categories are already well-defined. Hard filters + LLM judgment is sufficient.

---

Would you like me to elaborate on any of these suggestions or help you think through the implementation of a specific one?