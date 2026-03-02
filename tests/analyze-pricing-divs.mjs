import { JSDOM } from "jsdom";
import fs from "fs";

const html = fs.readFileSync('sections/fp-theme-pricing-2.html', 'utf8');
const dom = new JSDOM(html);
const doc = dom.window.document;
const section = doc.querySelector('section');

const allDivs = section.querySelectorAll('div');

console.log('All divs in section:\n');
allDivs.forEach((div, index) => {
    // Get direct text nodes (not from children)
    const directText = Array.from(div.childNodes)
        .filter(node => node.nodeType === 3)
        .map(node => node.textContent.trim())
        .join(' ')
        .replace(/\u200B/g, '')
        .trim();
    
    const hasMeaningfulText = directText.length > 0 && /[a-zA-Z0-9]/.test(directText);
    const classes = div.className || '(no class)';
    
    console.log(`div[${index}]: meaningful=${hasMeaningfulText}, directText="${directText.substring(0, 30)}", classes="${classes.substring(0, 50)}"`);
});

console.log('\n\nDivs WITH meaningful text:');
let meaningfulIndex = 0;
allDivs.forEach((div, realIndex) => {
    const directText = Array.from(div.childNodes)
        .filter(node => node.nodeType === 3)
        .map(node => node.textContent.trim())
        .join(' ')
        .replace(/\u200B/g, '')
        .trim();
    
    const hasMeaningfulText = directText.length > 0 && /[a-zA-Z0-9]/.test(directText);
    
    if (hasMeaningfulText) {
        console.log(`meaningful div[${meaningfulIndex}] = real div[${realIndex}]: "${directText.substring(0, 30)}"`);
        meaningfulIndex++;
    }
});
