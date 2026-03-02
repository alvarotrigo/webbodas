import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
let cheerio
async function loadCheerio() {
  if (!globalThis.File) {
    // Minimal polyfill to satisfy undici webidl checks in Node < 20
    globalThis.File = class {}
  }
  if (!cheerio) {
    cheerio = await import('cheerio')
  }
  return cheerio
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

const SOURCE_DIR = path.resolve(projectRoot, 'sections')
const TARGET_DIR = path.resolve(projectRoot, 'sections_thumbnails')

/**
 * Determine whether a URL is external and from Unsplash
 */
function isExternalUnsplashUrl(urlStr) {
  try {
    const u = new URL(urlStr)
    if (!u.protocol || (u.protocol !== 'http:' && u.protocol !== 'https:')) return false
    const host = (u.host || '').toLowerCase()
    return host.includes('unsplash.com') || host.includes('images.unsplash.com')
  } catch {
    return false
  }
}

function parseIntSafe(val) {
  const n = parseInt(String(val), 10)
  return Number.isFinite(n) ? n : undefined
}

/**
 * Resize query params while keeping original aspect ratio when both w/h exist.
 * If only one exists, cap that one. If none exist, set only w to the max width.
 */
function resizeParams(u, maxW, maxH) {
  const sp = u.searchParams
  const w = parseIntSafe(sp.get('w'))
  const h = parseIntSafe(sp.get('h'))

  if (w && h) {
    const scale = Math.min(maxW / w, maxH / h, 1)
    const newW = Math.max(1, Math.round(w * scale))
    const newH = Math.max(1, Math.round(h * scale))
    sp.set('w', String(newW))
    sp.set('h', String(newH))
    return
  }

  if (w && !h) {
    sp.set('w', String(Math.min(w, maxW)))
    return
  }

  if (!w && h) {
    sp.set('h', String(Math.min(h, maxH)))
    return
  }

  // Neither w nor h present: set only width to max to avoid distorting aspect.
  sp.set('w', String(maxW))
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true })
}

async function removeDirIfExists(dir) {
  try {
    await fs.rm(dir, { recursive: true, force: true })
  } catch {
    // ignore
  }
}

async function copyDir(src, dest) {
  await ensureDir(dest)
  const entries = await fs.readdir(src, { withFileTypes: true })
  await Promise.all(
    entries.map(async (entry) => {
      const srcPath = path.join(src, entry.name)
      const destPath = path.join(dest, entry.name)
      if (entry.isDirectory()) {
        await copyDir(srcPath, destPath)
      } else if (entry.isFile()) {
        if (entry.name.endsWith('.bak')) return
        await fs.copyFile(srcPath, destPath)
      }
    })
  )
}

function processImgSrc(srcValue, maxW, maxH) {
  if (!srcValue) return srcValue
  if (!isExternalUnsplashUrl(srcValue)) return srcValue
  try {
    const u = new URL(srcValue)
    resizeParams(u, maxW, maxH)
    return u.toString()
  } catch {
    return srcValue
  }
}

function processBackgroundStyle(styleValue, maxW, maxH) {
  if (!styleValue) return styleValue
  // Replace any url(...) occurrences, including within shorthand 'background' with multiple layers
  return styleValue.replace(/url\(([^)]+)\)/gi, (match, urlPart) => {
    const raw = urlPart.trim().replace(/^['\"]|['\"]$/g, '')
    const decoded = raw.replace(/&amp;/g, '&')
    if (!isExternalUnsplashUrl(decoded)) return match
    try {
      const u = new URL(decoded)
      resizeParams(u, maxW, maxH)
      const out = u.toString()
      return `url("${out}")`
    } catch {
      return match
    }
  })
}

async function processHtmlFile(filePath) {
  const html = await fs.readFile(filePath, 'utf8')
  const { load } = await loadCheerio()
  const $ = load(html, { decodeEntities: false }, false)

  // Process <img> elements
  $('img').each((_, el) => {
    const $el = $(el)
    const src = $el.attr('src')
    const newSrc = processImgSrc(src, 150, 150)
    if (newSrc && newSrc !== src) {
      $el.attr('src', newSrc)
    }

    // Sometimes data-src is used
    const dataSrc = $el.attr('data-src')
    const newDataSrc = processImgSrc(dataSrc, 150, 150)
    if (newDataSrc && newDataSrc !== dataSrc) {
      $el.attr('data-src', newDataSrc)
    }
  })

  // Process inline background styles on any element
  $('[style]').each((_, el) => {
    const $el = $(el)
    const style = $el.attr('style')
    const newStyle = processBackgroundStyle(style, 264, 146)
    if (newStyle && newStyle !== style) {
      $el.attr('style', newStyle)
    }
  })

  const fragment = $.root().children().toArray().map((el) => $.html(el)).join('')
  await fs.writeFile(filePath, fragment, 'utf8')
}

async function walkAndProcessHtml(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await walkAndProcessHtml(fullPath)
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) {
        await processHtmlFile(fullPath)
      }
    })
  )
}

async function main() {
  // Recreate target directory fresh each run
  await removeDirIfExists(TARGET_DIR)
  await ensureDir(TARGET_DIR)

  // Copy all from sections → sections_thumbnails
  await copyDir(SOURCE_DIR, TARGET_DIR)

  // Process HTML files in the cloned directory
  await walkAndProcessHtml(TARGET_DIR)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})


