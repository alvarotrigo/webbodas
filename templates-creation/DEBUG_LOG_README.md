# AI Generation Debug Log

## File Location
`templates-creation/ai-generation-debug.log`

## Purpose
This log tracks the AI template generation process to help debug why certain sections are or aren't being selected.

## What Gets Logged

### User Input
- Description provided
- Include hidden sections setting
- Any feedback for retries

### Step 0: Site Plan Extraction
- Audience, primary goal, brand vibe, content tone, key differentiators, business type
- This helps understand what the AI thinks the project is about

### Step 1: Structure Determination
- **Raw AI response** - the exact JSON returned by the AI
- **Parsed categories** - the list of section categories the AI decided on (e.g., ["hero", "features", "testimonials", "footer"])
- **Section count warning** - if AI returns fewer than 7 sections when prompt asks for 7+

### Step 2: Section ID Matching
- **Raw AI response** - the exact section IDs returned by the AI
- **Parsed section IDs** - the list of specific section IDs chosen

### Validation
- Available section IDs in metadata
- Invalid section IDs (if AI returns IDs that don't exist)
- Valid section IDs after filtering
- Final count

### Final Section Mapping
- Complete list showing: ID → Name (category, tags)
- Makes it easy to see what was actually selected

## How to Use This

1. **Run a template generation** through the UI
2. **Check the log file** to see what the AI returned at each step
3. **Compare** the AI's structure decision (Step 1) with the final section IDs (Step 2)
4. **Look for**:
   - Did the AI include all sections from the user's description?
   - Did the AI respect the "7+ sections" requirement?
   - Are sections being filtered out in validation?
   - Did the AI's structure match the user's explicit request?

## Example Issues You Can Spot

- **AI ignoring explicit structure**: User requests 7 sections but Step 1 only shows 5 categories
- **Validation filtering**: AI returns valid IDs but they get marked as invalid
- **Metadata mismatches**: AI tries to select section IDs that don't exist in metadata
- **Count mismatches**: Difference between categories (Step 1) and final IDs (Step 2)
