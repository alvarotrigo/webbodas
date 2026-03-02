import { JSDOM } from "jsdom";
import { glob } from "glob";
import fs from "fs";
import path from "path";

// Editable tags that should have selectors generated
const EDITABLE_TAGS = new Set([
  "h1", "h2", "h3", "h4", "h5", "h6",
  "p", "li", "a", "button", "span", "div",
  "blockquote", "figcaption"
]);

/**
 * Check if an element has meaningful text content
 * For divs, only count them if they have direct text content (not just children)
 * Only considers text meaningful if it contains at least one letter or number
 */
function hasMeaningfulText(element) {
  if (!element) return false;
  
  const tag = element.tagName.toLowerCase();
  
  // For divs, check if they have direct text content (not just child elements)
  if (tag === 'div') {
    // Get direct text nodes (not from children)
    const directText = Array.from(element.childNodes)
      .filter(node => node.nodeType === 3) // Text nodes
      .map(node => node.textContent.trim())
      .join(' ')
      .replace(/\u200B/g, '')
      .trim();
    // Check if text contains at least one letter or number
    return directText.length > 0 && /[a-zA-Z0-9]/.test(directText);
  }
  
  // For other elements, check if they or their descendants have text
  const text = (element.textContent || '').replace(/\u200B/g, '').trim();
  // Check if text contains at least one letter or number
  return text.length > 0 && /[a-zA-Z0-9]/.test(text);
}

/**
 * Check if an element should be excluded from selector generation
 */
function shouldExcludeElement(element) {
  // Exclude elements with fps-non-edit class or inside fps-non-edit elements
  if (element.classList.contains('fps-non-edit') || element.closest('.fps-non-edit')) {
    return true;
  }
  
  // Exclude SVG elements (they're decorative)
  if (element.tagName.toLowerCase() === 'svg' || element.closest('svg')) {
    return false; // Don't exclude if it's the element itself, but check children
  }
  
  // Exclude script and style tags
  if (['script', 'style', 'noscript'].includes(element.tagName.toLowerCase())) {
    return true;
  }
  
  return false;
}

/**
 * Check if an anchor or button should be treated as a button (has role="button" or button-like classes)
 */
function isButtonLike(element) {
  const tag = element.tagName.toLowerCase();
  if (tag === 'button') return true;
  if (tag === 'a') {
    // Check for role="button" or button-like classes
    if (element.getAttribute('role') === 'button') return true;
    if (element.classList.contains('btn') ||
        element.classList.contains('button') ||
        element.matches('[class*="btn-"]')) {
      return true;
    }
  }
  return false;
}

/**
 * Check if an element is a counter/step indicator (1-2 character text, not a paragraph/heading)
 * These are typically step numbers (1, 2, 3) or single letters (a, b, c)
 * Can appear in buttons, spans, divs, etc.
 */
function isCounterLike(element) {
  const tag = element.tagName.toLowerCase();
  // Don't treat headings or paragraphs or list items as counters (they contain real content)
  if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li'].includes(tag)) {
    return false;
  }

  // Check if the text is 1-2 characters (typically step numbers or single letters)
  const text = (element.textContent || '').replace(/\u200B/g, '').trim();
  return text.length > 0 && text.length <= 2;
}

/**
 * Extract allowed selectors from a section HTML file
 */
function extractAllowedSelectors(html, sectionId) {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  
  // Find the section element (should be the root of the HTML)
  const section = doc.querySelector('section') || doc.body;
  
  // Counters for each tag type (global within the section)
  const counters = {};
  
  // Result object
  const selectors = {};
  
  // Walk through all elements in the section
  const walker = doc.createTreeWalker(
    section,
    doc.defaultView.NodeFilter.SHOW_ELEMENT,
    {
      acceptNode: function(node) {
        // Skip excluded elements
        if (shouldExcludeElement(node)) {
          return doc.defaultView.NodeFilter.FILTER_REJECT;
        }
        return doc.defaultView.NodeFilter.FILTER_ACCEPT;
      }
    }
  );
  
  while (walker.nextNode()) {
    const element = walker.currentNode;
    const tag = element.tagName.toLowerCase();
    
    // Only process editable tags
    if (!EDITABLE_TAGS.has(tag)) continue;
    
    // Initialize counter for this tag if not exists
    if (!(tag in counters)) {
      counters[tag] = 0;
    }
    
    // Get the index for this tag (before incrementing)
    const index = counters[tag];
    
    // Increment counter for this tag (always, regardless of whether it has meaningful text)
    counters[tag]++;
    
    // Only create selectors for elements with meaningful text
    if (!hasMeaningfulText(element)) continue;
    
    // Create selector
    const selector = `${tag}[${index}]`;
    
    // Get text content
    const text = (element.textContent || '').replace(/\u200B/g, '').trim();

    // Priority 1: Counter detection (even if element is a button)
    // If an element contains only 1-2 characters, it's likely a step indicator
    if (isCounterLike(element)) {
      selectors[selector] = {
        text: text,
        role: "counter"
      };
    } else if (isButtonLike(element)) {
      // Priority 2: Button detection (for actual action buttons)
      selectors[selector] = {
        text: text,
        role: "button"
      };
    } else {
      // Default: Regular text content
      selectors[selector] = text;
    }
  }
  
  return selectors;
}

/**
 * Main function to build allowed selectors for all sections
 */
async function main() {
  const inputPattern = "sections/*.html";
  const outputFile = "public/js/section-allowed-selectors.json";
  
  // Ensure output directory exists
  const outputDir = path.dirname(outputFile);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Find all section HTML files
  const files = await glob(inputPattern);
  
  if (files.length === 0) {
    console.error("No section HTML files found matching pattern:", inputPattern);
    process.exit(1);
  }
  
  console.log(`Found ${files.length} section files`);
  
  // Result object: { sectionId: { selectors... } }
  const result = {};
  
  // Process each file
  for (const filePath of files) {
    const html = fs.readFileSync(filePath, "utf8");
    const sectionId = path.basename(filePath).replace(/\.html$/, "");
    
    console.log(`Processing ${sectionId}...`);
    
    try {
      const selectors = extractAllowedSelectors(html, sectionId);
      result[sectionId] = selectors;
      console.log(`  ✓ Generated ${Object.keys(selectors).length} selectors`);
    } catch (error) {
      console.error(`  ✗ Error processing ${sectionId}:`, error.message);
      // Continue with other files
    }
  }
  
  // Write result to JSON file
  fs.writeFileSync(
    outputFile,
    JSON.stringify(result, null, 2),
    "utf8"
  );
  
  console.log(`\n✓ Generated ${outputFile} with ${Object.keys(result).length} sections`);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
