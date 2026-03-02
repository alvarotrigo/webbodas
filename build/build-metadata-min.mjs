#!/usr/bin/env node

/**
 * Build script to minify metadata.js → metadata.min.js
 *
 * Usage: node build/build-metadata-min.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const sourceFile = join(projectRoot, 'public/js/metadata.js');
const targetFile = join(projectRoot, 'public/js/metadata.min.js');

console.log('📦 Building metadata.min.js...');
console.log(`   Source: ${sourceFile}`);
console.log(`   Target: ${targetFile}`);

try {
  // Read source file
  const source = readFileSync(sourceFile, 'utf-8');

  // Parse JSON to validate and minify
  const metadata = JSON.parse(source.trim());

  console.log(`   ✓ Parsed ${metadata.length} sections`);

  // Count hidden sections
  const hiddenCount = metadata.filter(s => s.hidden === true).length;
  console.log(`   ℹ ${hiddenCount} sections marked as hidden`);

  // Minify: compact JSON without whitespace
  const minified = JSON.stringify(metadata);

  // Write to target
  writeFileSync(targetFile, minified, 'utf-8');

  const originalSize = (source.length / 1024).toFixed(2);
  const minifiedSize = (minified.length / 1024).toFixed(2);
  const savings = ((1 - minified.length / source.length) * 100).toFixed(1);

  console.log(`   ✓ Minified: ${originalSize} KB → ${minifiedSize} KB (${savings}% smaller)`);
  console.log('✅ Done!');

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
