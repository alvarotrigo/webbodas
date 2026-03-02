import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the index.html file
const filePath = path.join(__dirname, 'index.html');
let content = fs.readFileSync(filePath, 'utf8');

console.log('🔍 Starting conversion process...');

// Count occurrences before conversion
const beforeCount = {
  '@sm:': (content.match(/@sm:/g) || []).length,
  '@md:': (content.match(/@md:/g) || []).length,
  '@lg:': (content.match(/@lg:/g) || []).length,
  '@xl:': (content.match(/@xl:/g) || []).length,
  '@container': (content.match(/@container/g) || []).length
};

console.log('📊 Found before conversion:');
console.log(`   @sm: ${beforeCount['@sm:']} occurrences`);
console.log(`   @md: ${beforeCount['@md:']} occurrences`);
console.log(`   @lg: ${beforeCount['@lg:']} occurrences`);
console.log(`   @xl: ${beforeCount['@xl:']} occurrences`);
console.log(`   @container ${beforeCount['@container']} occurrences`);

// Simple string replacements - this should work without affecting formatting
content = content.replace(/@sm:/g, 'sm:');
content = content.replace(/@md:/g, 'md:');
content = content.replace(/@lg:/g, 'lg:');
content = content.replace(/@xl:/g, 'xl:');

// Remove @container class
content = content.replace(/@container/g, '');

// Write the updated content back to the file
fs.writeFileSync(filePath, content, 'utf8');

// Count occurrences after conversion
const afterCount = {
  'sm:': (content.match(/sm:/g) || []).length,
  'md:': (content.match(/md:/g) || []).length,
  'lg:': (content.match(/lg:/g) || []).length,
  'xl:': (content.match(/xl:/g) || []).length,
  '@container': (content.match(/@container/g) || []).length
};

console.log('\n✅ Successfully reverted all container queries back to viewport-based classes!');
console.log('📝 Changes made:');
console.log(`   - Removed ${beforeCount['@container']} @container classes`);
console.log(`   - Changed ${beforeCount['@sm:']} @sm: to sm:`);
console.log(`   - Changed ${beforeCount['@md:']} @md: to md:`);
console.log(`   - Changed ${beforeCount['@lg:']} @lg: to lg:`);
console.log(`   - Changed ${beforeCount['@xl:']} @xl: to xl:`);

console.log('\n📊 Verification:');
console.log(`   sm: ${afterCount['sm:']} occurrences`);
console.log(`   md: ${afterCount['md:']} occurrences`);
console.log(`   lg: ${afterCount['lg:']} occurrences`);
console.log(`   xl: ${afterCount['xl:']} occurrences`);
console.log(`   @container ${afterCount['@container']} occurrences (should be 0)`); 