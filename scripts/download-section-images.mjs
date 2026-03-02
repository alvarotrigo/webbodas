import fs from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import sharp from 'sharp';

// Lazy import cheerio only if available; otherwise, instruct user to install.
// No external HTML parser to avoid environment issues; use targeted regex scanning.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const INDEX_HTML_PATH = path.resolve(projectRoot, 'index.html');
const OUTPUT_ORIGINAL_DIR = path.resolve(projectRoot, 'public', 'images', 'sections');
const OUTPUT_THUMBS_DIR = path.resolve(projectRoot, 'public', 'images', 'sections_thumbnails');
const MANIFEST_PATH = path.resolve(OUTPUT_ORIGINAL_DIR, '_manifest.json');
const SECTIONS_DIR = path.resolve(projectRoot, 'sections');

const NORMAL_THUMB_MAX = { width: 150, height: 150 };
const BG_THUMB_MAX = { width: 263, height: 146 };

const isHttpUrl = (u) => /^https?:\/\//i.test(u);
const isDataUrl = (u) => /^data:/i.test(u);

function sanitizeFilename(input, fallbackExt = '') {
  try {
    const urlObj = new URL(input, 'http://local.test');
    const base = path.basename(urlObj.pathname);
    if (base && base !== '/') return base;
  } catch (_) {
    // not a valid URL; fall through
  }
  const fromPath = path.basename(input || '');
  if (fromPath) return fromPath;
  const hash = crypto.createHash('sha1').update(String(input)).digest('hex').slice(0, 10);
  return `file-${hash}${fallbackExt}`;
}

function resolveLocalPath(src) {
  // Root-relative to project root (strip leading slash)
  if (src.startsWith('/')) {
    return path.resolve(projectRoot, src.replace(/^\/+/, ''));
  }
  // Relative to index.html location
  const indexDir = path.dirname(INDEX_HTML_PATH);
  return path.resolve(indexDir, src);
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function readIndexHtml() {
  try {
    const content = await fs.readFile(INDEX_HTML_PATH, 'utf8');
    return content;
  } catch (err) {
    console.error(`Failed to read ${INDEX_HTML_PATH}:`, err);
    process.exit(1);
  }
}

async function fetchBuffer(url) {
  const maxAttempts = 3;
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arrayBuffer = await res.arrayBuffer();
      const contentType = res.headers?.get?.('content-type') || '';
      return { buffer: Buffer.from(arrayBuffer), contentType };
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 250 * attempt));
    }
  }
  throw lastErr;
}

async function copyOrReadLocal(localPath) {
  try {
    return await fs.readFile(localPath);
  } catch (err) {
    throw new Error(`Local file not found: ${localPath}`);
  }
}

async function writeIfNotExists(filePath, data) {
  if (!fssync.existsSync(filePath)) {
    await fs.writeFile(filePath, data);
  }
}

async function saveOriginal(buffer, filename) {
  const destPath = path.resolve(OUTPUT_ORIGINAL_DIR, filename);
  await writeIfNotExists(destPath, buffer);
  return destPath;
}

async function saveThumbnail(buffer, filename, maxSize) {
  const destPath = path.resolve(OUTPUT_THUMBS_DIR, filename);
  // Keep extension/format if possible; sharp will infer
  const thumb = await sharp(buffer).resize({
    width: maxSize.width,
    height: maxSize.height,
    fit: 'inside',
    withoutEnlargement: true,
  }).toBuffer();
  await writeIfNotExists(destPath, thumb);
  return destPath;
}

function looksLikeSvg(buffer) {
  const str = buffer.slice(0, 300).toString('utf8');
  return /<svg[\s\S]*?>/i.test(str);
}

function contentTypeToExt(contentType) {
  if (!contentType) return '';
  const ct = contentType.split(';')[0].trim().toLowerCase();
  if (ct === 'image/jpeg' || ct === 'image/jpg') return '.jpg';
  if (ct === 'image/png') return '.png';
  if (ct === 'image/webp') return '.webp';
  if (ct === 'image/gif') return '.gif';
  if (ct === 'image/avif') return '.avif';
  if (ct === 'image/tiff') return '.tif';
  if (ct === 'image/svg+xml') return '.svg';
  return '';
}

async function detectExtension(buffer, contentType, rawUrl) {
  // 1) from URL path
  try {
    const pext = path.extname(new URL(rawUrl, 'http://local.test').pathname || '') || path.extname(rawUrl) || '';
    if (pext) return pext;
  } catch (_) {
    const pext = path.extname(rawUrl) || '';
    if (pext) return pext;
  }
  // 2) content-type header
  const fromCt = contentTypeToExt(contentType);
  if (fromCt) return fromCt;
  // 3) SVG signature
  if (looksLikeSvg(buffer)) return '.svg';
  // 4) sharp metadata
  try {
    const meta = await sharp(buffer).metadata();
    const fmt = (meta.format || '').toLowerCase();
    if (!fmt) return '.jpg';
    if (fmt === 'jpeg') return '.jpg';
    return `.${fmt}`;
  } catch (_) {
    return '.jpg';
  }
}

async function getFilenameWithExtension(originalNameCandidate, buffer, contentType, usedSet) {
  const baseCandidate = sanitizeFilename(originalNameCandidate, '');
  const baseNoExt = baseCandidate.replace(/\.[^.]+$/, '');
  const ext = await detectExtension(buffer, contentType, originalNameCandidate);
  let filename = `${baseNoExt}${ext}`;
  if (!usedSet.has(filename)) return filename;
  let i = 2;
  let candidate = `${baseNoExt}-${i}${ext}`;
  while (usedSet.has(candidate)) {
    i += 1;
    candidate = `${baseNoExt}-${i}${ext}`;
  }
  return candidate;
}

function extractUrlsFromSrcset(value) {
  if (!value) return [];
  return value
    .split(',')
    .map((part) => part.trim().split(' ')[0])
    .filter(Boolean);
}

function extractUrlsFromStyleValue(styleValue) {
  if (!styleValue) return [];
  const results = [];
  const regex = /url\(\s*(["']?)(.*?)\1\s*\)/gi;
  let match;
  while ((match = regex.exec(styleValue)) !== null) {
    const url = match[2];
    if (url && !isDataUrl(url)) results.push(url);
  }
  return results;
}

async function collectImageUrls(html) {
  const normalImages = new Set();
  const bgImages = new Set();

  function collectAttr(tag, attr) {
    const re = new RegExp(`<${tag}[^>]*\\s${attr}=["']([^"']+)["']`, 'gi');
    let m;
    while ((m = re.exec(html)) !== null) {
      const val = m[1];
      if (val && !isDataUrl(val)) normalImages.add(val);
    }
  }

  // img/src and common lazy attrs
  collectAttr('img', 'src');
  collectAttr('img', 'data-src');
  collectAttr('img', 'data-original');
  collectAttr('img', 'data-lazy');
  // source/src
  collectAttr('source', 'src');

  // srcset on img and source
  const srcsetRe = /<(img|source)[^>]*\ssrcset=["']([^"']+)["']/gi;
  let mSS;
  while ((mSS = srcsetRe.exec(html)) !== null) {
    extractUrlsFromSrcset(mSS[2]).forEach((u) => {
      if (u && !isDataUrl(u)) normalImages.add(u);
    });
  }

  // Inline style attributes
  const styleAttrRe = /style=["']([^"']+)["']/gi;
  let mStyle;
  while ((mStyle = styleAttrRe.exec(html)) !== null) {
    extractUrlsFromStyleValue(mStyle[1]).forEach((u) => bgImages.add(u));
  }

  // <style> blocks
  const styleBlockRe = /<style[\s\S]*?>[\s\S]*?<\/style>/gi;
  let mBlock;
  while ((mBlock = styleBlockRe.exec(html)) !== null) {
    const block = mBlock[0] || '';
    const inner = block.replace(/^<style[^>]*>/i, '').replace(/<\/style>$/i, '');
    extractUrlsFromStyleValue(inner).forEach((u) => bgImages.add(u));
  }

  return { normalImages: Array.from(normalImages), bgImages: Array.from(bgImages) };
}

function deriveUniqueFilename(urlOrPath, usedSet) {
  const parsedExt = path.extname(new URL(urlOrPath, 'http://local.test').pathname || '') || path.extname(urlOrPath) || '';
  const base = sanitizeFilename(urlOrPath, parsedExt);
  if (!usedSet.has(base)) return base;
  const name = base.replace(new RegExp(`${parsedExt.replace('.', '\\.')}$`), '');
  let i = 2;
  let candidate = `${name}-${i}${parsedExt}`;
  while (usedSet.has(candidate)) {
    i += 1;
    candidate = `${name}-${i}${parsedExt}`;
  }
  return candidate;
}

async function main() {
  const replaceSectionsOnly = process.argv.includes('--replace-sections');
  const downloadOnly = process.argv.includes('--download') || !replaceSectionsOnly;
  await ensureDir(OUTPUT_ORIGINAL_DIR);
  await ensureDir(OUTPUT_THUMBS_DIR);

  if (!downloadOnly) {
    await replaceSectionsFromManifest();
    return;
  }

  const html = await readIndexHtml();
  const { normalImages, bgImages } = await collectImageUrls(html);

  const all = [
    ...normalImages.map((u) => ({ url: u, kind: 'normal' })),
    ...bgImages.map((u) => ({ url: u, kind: 'bg' })),
  ];

  const usedFilenames = new Set();
  let downloaded = 0;
  let errors = 0;

  // Keep mapping to allow optional rewriting of index.html
  const mapping = [];

  for (const entry of all) {
    const { url: rawUrl, kind } = entry;
    if (!rawUrl || isDataUrl(rawUrl) || !isHttpUrl(rawUrl)) continue; // external images only

    try {
      let buffer;
      let contentType = '';
      let originalNameCandidate = rawUrl;

      if (isHttpUrl(rawUrl)) {
        const res = await fetchBuffer(rawUrl);
        buffer = res.buffer;
        contentType = res.contentType;
      } else {
        const localPath = resolveLocalPath(rawUrl);
        buffer = await copyOrReadLocal(localPath);
        originalNameCandidate = localPath;
      }

      const filename = await getFilenameWithExtension(originalNameCandidate, buffer, contentType, usedFilenames);
      usedFilenames.add(filename);

      await saveOriginal(buffer, filename);
      const thumbSize = kind === 'bg' ? BG_THUMB_MAX : NORMAL_THUMB_MAX;
      await saveThumbnail(buffer, filename, thumbSize);
      downloaded += 1;
      console.log(`[saved] ${filename} (${kind})`);

      mapping.push({ original: rawUrl, kind, filename });
    } catch (err) {
      errors += 1;
      console.warn(`[skip] ${rawUrl} -> ${err.message}`);
    }
  }

  console.log(`Done. Saved ${downloaded} files. ${errors ? `Errors: ${errors}` : ''}`);

  await writeManifest(mapping);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

async function writeManifest(newMappings) {
  // Load existing manifest (if any)
  let current = {};
  try {
    const raw = await fs.readFile(MANIFEST_PATH, 'utf8');
    current = JSON.parse(raw);
  } catch (_) {
    // ignore
  }
  for (const m of newMappings) {
    current[m.original] = m.filename;
  }
  await ensureDir(OUTPUT_ORIGINAL_DIR);
  await fs.writeFile(MANIFEST_PATH, JSON.stringify(current, null, 2), 'utf8');
  console.log(`[manifest] Updated ${path.relative(projectRoot, MANIFEST_PATH)}`);
}

async function replaceSectionsFromManifest() {
  // Load manifest
  let manifest = {};
  try {
    const raw = await fs.readFile(MANIFEST_PATH, 'utf8');
    manifest = JSON.parse(raw);
  } catch (err) {
    console.error(`Manifest not found. Run download first to create ${path.relative(projectRoot, MANIFEST_PATH)}.`);
    process.exit(1);
  }

  const entries = await fs.readdir(SECTIONS_DIR, { withFileTypes: true });
  const files = entries.filter((e) => e.isFile() && e.name.endsWith('.html')).map((e) => path.join(SECTIONS_DIR, e.name));

  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function baseFromUrl(u) {
    try {
      const urlObj = new URL(u);
      return `${urlObj.origin}${urlObj.pathname}`;
    } catch (_) {
      return u;
    }
  }

  // Build replacement descriptors using base URL (origin+pathname), so query differences still match
  const replacementDescs = Object.entries(manifest).map(([orig, fname]) => {
    const base = baseFromUrl(orig);
    const to = `/images/sections/${fname}`;
    return { base, to };
  });

  for (const file of files) {
    let html;
    try {
      html = await fs.readFile(file, 'utf8');
    } catch (err) {
      console.warn(`[read-skip] ${file} -> ${err.message}`);
      continue;
    }

    let updated = html;

    for (const { base, to } of replacementDescs) {
      // Match base plus any query/fragment until a delimiter ('"\s) or end)
      const pattern = new RegExp(`${escapeRegex(base)}[^"'\\s)<>]*`, 'g');
      updated = updated.replace(pattern, to);

      // Also match HTML-escaped ampersands in the tail (e.g., &amp;)
      const baseEsc = base.replace(/&/g, '&amp;');
      if (baseEsc !== base) {
        const patternEsc = new RegExp(`${escapeRegex(baseEsc)}[^"'\\s)<>]*`, 'g');
        updated = updated.replace(patternEsc, to);
      }
    }

    if (updated !== html) {
      const backupPath = `${file}.bak`;
      await fs.writeFile(backupPath, html, 'utf8');
      await fs.writeFile(file, updated, 'utf8');
      console.log(`[rewrite] ${path.basename(file)} updated. Backup saved.`);
    } else {
      console.log(`[no-change] ${path.basename(file)}`);
    }
  }
}

async function rewriteIndexHtml(originalHtml, mapping) {
  if (!Array.isArray(mapping) || mapping.length === 0) return;

  // Only rewrite external http(s) references
  const httpMappings = mapping.filter((m) => isHttpUrl(m.original));
  if (httpMappings.length === 0) return;

  // Build replacements map to local public paths
  const replacements = new Map();
  for (const m of httpMappings) {
    const localPath = `/images/sections/${m.filename}`; // always use original (not thumbnail)
    // If multiple originals map to same filename, later ones will overwrite; acceptable
    replacements.set(m.original, localPath);
  }

  let updated = originalHtml;

  // Replace inside attributes like src, data-src, data-original, data-lazy
  for (const [from, to] of replacements.entries()) {
    const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const attrRe = new RegExp(`(src|data-src|data-original|data-lazy)=("|')${escaped}(\\2)`, 'g');
    updated = updated.replace(attrRe, (_m, attr, q) => `${attr}=${q}${to}${q}`);
  }

  // Replace inside srcset lists
  for (const [from, to] of replacements.entries()) {
    const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const srcsetRe = new RegExp(`(\s|,)${escaped}(?=\s|,|$)`, 'g');
    updated = updated.replace(srcsetRe, (m0) => m0.replace(from, to));
  }

  // Replace inside CSS url(...) in style attributes and <style> blocks
  for (const [from, to] of replacements.entries()) {
    const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const cssUrlRe = new RegExp(`url\\(\\s*(["'])?${escaped}\\1?\\s*\\)`, 'g');
    updated = updated.replace(cssUrlRe, (m0) => m0.replace(from, to));
  }

  // Write backup and updated index.html
  const backupPath = `${INDEX_HTML_PATH}.bak`;
  await fs.writeFile(backupPath, originalHtml, 'utf8');
  await fs.writeFile(INDEX_HTML_PATH, updated, 'utf8');
  console.log(`[rewrite] index.html updated. Backup saved to ${path.basename(backupPath)}`);
}


