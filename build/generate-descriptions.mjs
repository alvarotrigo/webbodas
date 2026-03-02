#!/usr/bin/env node

/**
 * Generate visual descriptions for each section using GPT-4o-mini vision.
 *
 * Reads section definitions from public/js/app.js (source of truth for id, name,
 * tags, is_pro, hidden), sends each screenshot to the OpenAI API for a visual
 * description, and writes a lean metadata file: public/js/metadata-described.js
 *
 * Usage: node build/generate-descriptions.mjs
 * Requires: OPENAI_API_KEY in .env
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// ── Load .env ──────────────────────────────────────────────
function loadEnv() {
  const envPath = join(projectRoot, '.env');
  if (!existsSync(envPath)) return;
  const lines = readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [key, ...rest] = trimmed.split('=');
    const value = rest.join('=').trim();
    if (!process.env[key.trim()]) {
      process.env[key.trim()] = value;
    }
  }
}

loadEnv();

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) {
  console.error('❌ OPENAI_API_KEY not found in .env');
  process.exit(1);
}

// ── Config ─────────────────────────────────────────────────
const CONCURRENCY = 5;          // parallel requests
const MODEL = 'gpt-4o-mini';
const SCREENSHOTS_DIR = join(projectRoot, 'screenshots');
const APP_JS_PATH = join(projectRoot, 'public/js/app.js');
const METADATA_OUT = join(projectRoot, 'public/js/metadata-described.js');

const PROMPT = `Describe this website section screenshot in 1-2 short sentences.

Focus on:
- The visual layout (centered, split, grid, single column, etc.)
- What elements are visible (headings, paragraphs, images, cards, icons, buttons, forms, quotes, avatars, star ratings, logos, video, etc.)
- How many repeated items if applicable (e.g. "3 feature cards", "4 team members")
- The overall density (minimal/spacious vs content-rich)

Be factual and concise. Do NOT mention colors, fonts, or specific text content.
Example: "Split layout with a large heading and paragraph on the left, and a product image on the right. Two CTA buttons below the text."`;

// ── Parse sections array from app.js ─────────────────────
function parseSectionsFromAppJs() {
  const appJsContent = readFileSync(APP_JS_PATH, 'utf-8');

  // Find the sections array: "const sections = ["
  const startMatch = appJsContent.match(/const\s+sections\s*=\s*\[/);
  if (!startMatch) {
    throw new Error('Could not find "const sections = [" in app.js');
  }

  const startIndex = startMatch.index + startMatch[0].length - 1; // include the "["

  // Find matching closing bracket
  let depth = 0;
  let endIndex = -1;
  for (let i = startIndex; i < appJsContent.length; i++) {
    if (appJsContent[i] === '[') depth++;
    else if (appJsContent[i] === ']') {
      depth--;
      if (depth === 0) {
        endIndex = i + 1;
        break;
      }
    }
  }

  if (endIndex === -1) {
    throw new Error('Could not find closing bracket for sections array');
  }

  const arrayStr = appJsContent.substring(startIndex, endIndex);

  // Convert JS object syntax to valid JSON:
  // - Quote unquoted keys: { id: 1 } → { "id": 1 }
  // - Replace single quotes with double quotes: 'hero' → "hero"
  let jsonStr = arrayStr
    // Replace single-quoted strings with double-quoted
    .replace(/'([^']*?)'/g, '"$1"')
    // Quote unquoted object keys (word followed by colon)
    .replace(/(\{|,)\s*(\w+)\s*:/g, '$1 "$2":')
    // Remove trailing commas before } or ]
    .replace(/,\s*([\}\]])/g, '$1');

  try {
    return JSON.parse(jsonStr);
  } catch (err) {
    throw new Error(`Failed to parse sections array from app.js: ${err.message}`);
  }
}

// ── OpenAI API call ────────────────────────────────────────
async function describeImage(imagePath) {
  const imageBuffer = readFileSync(imagePath);
  const base64 = imageBuffer.toString('base64');
  const mimeType = 'image/jpeg';

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: PROMPT },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64}`,
                detail: 'low'   // cheapest tier, sufficient for layout description
              }
            }
          ]
        }
      ],
      max_tokens: 150,
      temperature: 0.3
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${err}`);
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

// ── Process sections in batches ────────────────────────────
async function processBatch(sections) {
  return Promise.all(
    sections.map(async (section) => {
      const screenshotPath = join(SCREENSHOTS_DIR, `${section.id}.jpg`);

      // Build lean output object
      const lean = {
        id: section.id,
        name: section.name,
        tags: section.tags
      };
      if (section.is_pro) lean.is_pro = section.is_pro;
      if (section.hidden) lean.hidden = true;

      if (!existsSync(screenshotPath)) {
        console.warn(`  ⚠ No screenshot for section ${section.id} (${section.name}), skipping`);
        lean.description = null;
        return lean;
      }

      try {
        const description = await describeImage(screenshotPath);
        console.log(`  ✓ ${section.id} ${section.name}: ${description.substring(0, 80)}...`);
        lean.description = description;
        return lean;
      } catch (err) {
        console.error(`  ✗ ${section.id} ${section.name}: ${err.message}`);
        lean.description = null;
        return lean;
      }
    })
  );
}

// ── Main ───────────────────────────────────────────────────
async function main() {
  console.log('🔍 Generating visual descriptions for sections...\n');

  // Parse sections from app.js
  const sections = parseSectionsFromAppJs();
  console.log(`📦 Parsed ${sections.length} sections from app.js`);
  console.log(`📸 Screenshots dir: ${SCREENSHOTS_DIR}`);
  console.log(`🤖 Model: ${MODEL}\n`);

  // Collect unique tags
  const allTags = new Set();
  for (const s of sections) {
    for (const t of s.tags) allTags.add(t);
  }
  console.log(`🏷  Unique tags: ${[...allTags].sort().join(', ')}\n`);

  const results = [];
  let described = 0;
  let skipped = 0;

  // Process in batches of CONCURRENCY
  for (let i = 0; i < sections.length; i += CONCURRENCY) {
    const batch = sections.slice(i, i + CONCURRENCY);
    const batchNum = Math.floor(i / CONCURRENCY) + 1;
    const totalBatches = Math.ceil(sections.length / CONCURRENCY);
    console.log(`Batch ${batchNum}/${totalBatches} (sections ${batch.map(s => s.id).join(', ')}):`);

    const batchResults = await processBatch(batch);
    for (const r of batchResults) {
      results.push(r);
      if (r.description) described++;
      else skipped++;
    }

    console.log('');
  }

  // Write output
  const output = JSON.stringify(results, null, 2);
  writeFileSync(METADATA_OUT, output, 'utf-8');

  const outSize = (output.length / 1024).toFixed(1);
  console.log(`✅ Done! Wrote ${METADATA_OUT}`);
  console.log(`   ${described} sections described, ${skipped} skipped`);
  console.log(`   Output size: ${outSize} KB`);
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
