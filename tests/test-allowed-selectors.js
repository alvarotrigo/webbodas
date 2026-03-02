// Test script to verify allowed selectors lookup
import fs from 'fs';

const ALLOWED_SELECTORS_MAP = JSON.parse(
    fs.readFileSync('./public/js/section-allowed-selectors.json', 'utf8')
);

function resolveAllowedSelectors(map, sectionFile) {
    if (!sectionFile) return {};
    const key = sectionFile.replace(/\.html$/i, '');
    console.log(`Looking up key: "${key}" for file: "${sectionFile}"`);
    const selectors = map[key];
    console.log(`Found ${selectors ? Object.keys(selectors).length : 0} selectors`);
    
    if (typeof selectors === 'object' && selectors !== null) {
        if (Array.isArray(selectors)) {
            const obj = {};
            selectors.forEach(sel => {
                obj[sel] = '';
            });
            return obj;
        }
        return selectors;
    }
    return {};
}

// Test with fp-theme-how-it-works.html
const result = resolveAllowedSelectors(ALLOWED_SELECTORS_MAP, 'fp-theme-how-it-works.html');
console.log('\nResult:', JSON.stringify(result, null, 2));

// Check all available keys
console.log('\nAll keys containing "how":', Object.keys(ALLOWED_SELECTORS_MAP).filter(k => k.includes('how')));
