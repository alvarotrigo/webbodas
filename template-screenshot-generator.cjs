/**
 * Template screenshot generator – misma lógica que screenshot-generator.cjs (secciones),
 * pero para templates HTML completos. Genera una imagen en scroll del template entero:
 * captura viewport a viewport, une en una sola imagen vertical y comprime a JPG.
 *
 * Uso: tener el servidor local corriendo y ejecutar:
 *   node template-screenshot-generator.cjs
 *   npm run templates:screenshots
 *
 * Opcional: solo un template
 *   node template-screenshot-generator.cjs template1
 */

const puppeteer = require('puppeteer');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.BASE_URL || 'http://localhost/nine-screen-canvas-flow/';
const PREVIEWS_DIR = path.join(__dirname, 'templates', 'previews');
const HERO_PREVIEWS_DIR = path.join(__dirname, 'templates', 'previews', 'hero_previews');
const TEMP_DIR = path.join(PREVIEWS_DIR, '.temp');
const HTML_DIR = path.join(__dirname, 'templates', 'html');

// Descubre templates: archivos .html en la raíz de templates/html y index.html en subcarpetas.
function discoverTemplates() {
  const list = [];
  if (!fs.existsSync(HTML_DIR)) return list;

  // Raíz: *.html
  const rootFiles = fs.readdirSync(HTML_DIR, { withFileTypes: true });
  for (const ent of rootFiles) {
    if (!ent.isFile() || !ent.name.endsWith('.html')) continue;
    const id = ent.name.slice(0, -5);
    const url = 'templates/html/' + ent.name;
    list.push({ id, url, ...readMeta(path.join(HTML_DIR, ent.name), id) });
  }

  // Subcarpetas: */index.html
  for (const ent of rootFiles) {
    if (!ent.isDirectory()) continue;
    const indexPath = path.join(HTML_DIR, ent.name, 'index.html');
    if (!fs.existsSync(indexPath)) continue;
    const id = ent.name;
    const url = 'templates/html/' + ent.name + '/index.html';
    list.push({ id, url, ...readMeta(indexPath, id) });
  }

  return list;
}

/**
 * Parse filename convention: CATEGORY__NAME__TAG1-TAG2-TAG3
 * Returns { name, category, tags } or null if the filename doesn't match.
 */
function parseFilenameConvention(filename) {
  const parts = filename.split('__');
  if (parts.length !== 3) return null;

  const category = parts[0];
  const name = parts[1].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const tags = parts[2].split('-').filter(Boolean);

  return { name, category, tags };
}

/**
 * Extract display name from a template file. Tries the filename convention first,
 * then falls back to the <meta name="template-name"> tag inside the HTML.
 */
function readMeta(absPath, id) {
  const conv = parseFilenameConvention(id);
  if (conv) return conv;

  try {
    const html = fs.readFileSync(absPath, 'utf8');
    const m = html.match(/<meta\s+name=["']template-name["']\s+content=["']([^"']*)["']/i);
    return { name: m ? m[1].trim() : id };
  } catch (e) {
    return { name: id };
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function compressImage(inputPath, outputPath, maxWidth = 700) {
  try {
    await sharp(inputPath)
      .resize(maxWidth, null, { withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toFile(outputPath);
    console.log(`  ✓ Compressed: ${path.basename(outputPath)}`);
  } catch (error) {
    console.error(`Error compressing ${inputPath}:`, error);
  }
}

/**
 * Une varias imágenes PNG en una sola imagen vertical (misma lógica conceptual que
 * tener N capturas de viewport y unirlas en una tira).
 */
async function stitchImagesVertical(pngPaths, outputPath) {
  if (pngPaths.length === 0) throw new Error('No images to stitch');
  const metadataList = await Promise.all(pngPaths.map(p => sharp(p).metadata()));
  const width = metadataList[0].width;
  const totalHeight = metadataList.reduce((sum, m) => sum + m.height, 0);
  const composites = pngPaths.map((p, i) => {
    const top = metadataList.slice(0, i).reduce((s, m) => s + m.height, 0);
    return { input: p, top, left: 0 };
  });
  await sharp({
    create: { width, height: totalHeight, channels: 3, background: { r: 255, g: 255, b: 255 } }
  })
    .composite(composites)
    .png()
    .toFile(outputPath);
}

async function captureTemplateScreenshot(template) {
  const { id, url } = template;
  const fullUrl = BASE_URL.replace(/\/?$/, '/') + url.replace(/^\//, '');
  const tempPrefix = path.join(TEMP_DIR, `${id}_`);
  const stitchedPng = path.join(TEMP_DIR, `${id}_full.png`);
  const outputJpg = path.join(PREVIEWS_DIR, `${id}.jpg`);
  const heroOutputJpg = path.join(HERO_PREVIEWS_DIR, `${id}.jpg`);

  if (!fs.existsSync(PREVIEWS_DIR)) {
    fs.mkdirSync(PREVIEWS_DIR, { recursive: true });
  }
  if (!fs.existsSync(HERO_PREVIEWS_DIR)) {
    fs.mkdirSync(HERO_PREVIEWS_DIR, { recursive: true });
  }
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }

  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: { width: 1920, height: 1080 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );

  await page.goto(fullUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });

  // Esperar fuentes e imágenes (igual que generador de secciones)
  await sleep(2000);

  // Quitar position:fixed/sticky durante la captura para que el menú no se repita en cada slice
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.id = 'screenshot-capture-override';
    style.textContent = '.screenshot-capture-no-fixed { position: static !important; }';
    document.head.appendChild(style);
    document.querySelectorAll('*').forEach((el) => {
      const pos = window.getComputedStyle(el).position;
      if (pos === 'fixed' || pos === 'sticky') el.classList.add('screenshot-capture-no-fixed');
    });
  });

  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(1000);

  // Hero preview: solo el viewport (primera sección) para pages.php
  const heroTempPng = path.join(TEMP_DIR, `${id}_hero.png`);
  await page.screenshot({ path: heroTempPng, omitBackground: false });
  await compressImage(heroTempPng, heroOutputJpg, 700);
  try { fs.unlinkSync(heroTempPng); } catch (e) {}
  console.log(`  ✓ hero_previews/${id}.jpg (viewport)`);

  const { viewportHeight, totalHeight } = await page.evaluate(() => ({
    viewportHeight: window.innerHeight,
    totalHeight: document.body.scrollHeight
  }));

  let scrollPosition = 0;
  let screenshotIndex = 1;
  const pngPaths = [];

  while (scrollPosition < totalHeight) {
    await page.evaluate(y => window.scrollTo(0, y), scrollPosition);
    await sleep(1000);

    const screenshotPath = `${tempPrefix}${screenshotIndex}.png`;
    await page.screenshot({ path: screenshotPath, omitBackground: false });
    pngPaths.push(screenshotPath);
    screenshotIndex++;
    scrollPosition += viewportHeight;
  }

  await browser.close();

  if (pngPaths.length === 0) {
    console.warn(`  ⚠ No screenshots for ${id}, skipping.`);
    return;
  }

  await stitchImagesVertical(pngPaths, stitchedPng);
  await compressImage(stitchedPng, outputJpg, 700);

  pngPaths.forEach(p => {
    try { fs.unlinkSync(p); } catch (e) {}
  });
  try { fs.unlinkSync(stitchedPng); } catch (e) {}

  console.log(`  ✓ ${id}.jpg (${pngPaths.length} viewports)`);
}

async function main() {
  const TEMPLATES = discoverTemplates();
  const filterId = process.argv[2];
  const list = filterId
    ? TEMPLATES.filter(t => t.id === filterId)
    : TEMPLATES;

  if (list.length === 0) {
    console.log(filterId ? `No template with id "${filterId}".` : 'No templates found in templates/html/.');
    return;
  }

  console.log('📸 Template screenshot generator');
  console.log('================================\n');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Output: ${PREVIEWS_DIR}\n`);

  for (const template of list) {
    console.log(`Processing: ${template.id} (${template.name || template.id}) — ${template.url}`);
    try {
      await captureTemplateScreenshot(template);
    } catch (error) {
      console.error(`  ❌ ${template.id}:`, error.message);
    }
  }

  console.log('\n✅ Done.');
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { captureTemplateScreenshot, discoverTemplates };
