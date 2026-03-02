import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the index.html file
const filePath = path.join(__dirname, 'index.html');
let content = fs.readFileSync(filePath, 'utf8');

// Function to add @container class to main content divs
function addContainerClass(match) {
  // Check if @container is already present
  if (match.includes('@container')) {
    return match;
  }
  // Add @container class
  return match.replace('class="', 'class="@container ');
}

// Function to update responsive classes
function updateResponsiveClasses(match) {
  // Replace viewport-based responsive classes with container-based ones
  let updated = match
    .replace(/\bsm:/g, '@sm:')
    .replace(/\bmd:/g, '@md:')
    .replace(/\blg:/g, '@lg:')
    .replace(/\bxl:/g, '@xl:');
  
  return updated;
}

// Add @container to main content divs (those with max-w-* classes)
content = content.replace(
  /<div class="([^"]*max-w-[^"]*)"([^>]*)>/g,
  (match, classes, rest) => {
    if (classes.includes('@container')) {
      return match;
    }
    return `<div class="${classes} @container"${rest}>`;
  }
);

// Update responsive classes
content = content.replace(
  /class="([^"]*)"([^>]*)>/g,
  (match, classes, rest) => {
    if (classes.includes('@sm:') || classes.includes('@md:') || classes.includes('@lg:') || classes.includes('@xl:')) {
      // Already has container queries, skip
      return match;
    }
    
    const updatedClasses = updateResponsiveClasses(classes);
    return `class="${updatedClasses}"${rest}>`;
  }
);

// Write the updated content back to the file
fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ Successfully updated all responsive classes to container queries!');
console.log('📝 Changes made:');
console.log('   - Added @container class to main content divs');
console.log('   - Changed sm: to @sm:');
console.log('   - Changed md: to @md:');
console.log('   - Changed lg: to @lg:');
console.log('   - Changed xl: to @xl:'); 