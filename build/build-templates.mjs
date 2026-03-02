/**
 * Build templates: extract sections, CSS, and JS from full HTML in templates/html/,
 * scope CSS with a theme class (:root → .theme-{templateName}), write self-contained
 * folders under templates/dist/{templateName}/. Template name = HTML filename without extension.
 */
import { JSDOM } from "jsdom";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MANIFEST_PATH = path.join(ROOT, "templates", "templates-manifest.json");
const HTML_DIR = path.join(ROOT, "templates", "html");
const DIST_DIR = path.join(ROOT, "templates", "dist");

function getSourcePath(template) {
  if (template.source) return template.source;
  if (template.file && template.file.includes("templates/html/")) return template.file;
  // Prefer folder form when present (full export: templates/html/<id>/index.html)
  const folderIndex = path.join(ROOT, "templates", "html", template.id, "index.html");
  if (fs.existsSync(folderIndex)) return path.join("templates", "html", template.id, "index.html");
  return `templates/html/${template.id}.html`;
}

function buildTemplate(template) {
  const sourcePath = getSourcePath(template);
  const absoluteSource = path.isAbsolute(sourcePath) ? sourcePath : path.join(ROOT, sourcePath);
  // When source is templates/html/<id>/index.html, use directory name as templateName
  const templateName = path.basename(absoluteSource) === "index.html"
    ? path.basename(path.dirname(absoluteSource))
    : path.basename(absoluteSource, ".html");

  if (!fs.existsSync(absoluteSource)) {
    console.warn(`[build-templates] Skip "${template.id}": source not found: ${absoluteSource}`);
    return null;
  }

  const htmlContent = fs.readFileSync(absoluteSource, "utf-8");
  const dom = new JSDOM(htmlContent);
  const doc = dom.window.document;

  // 1. Sections
  const sections = doc.querySelectorAll("section, footer");
  const sectionsHtml = Array.from(sections)
    .map((el) => el.outerHTML)
    .join("\n");
  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<body>
${sectionsHtml}
</body>
</html>
`;

  const outDir = path.join(DIST_DIR, templateName);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "index.html"), indexHtml.trim() + "\n", "utf-8");

  // 2. CSS: inline <style> + replace :root with .theme-{templateName}
  const styleEls = doc.head.querySelectorAll("style");
  let inlineCss = Array.from(styleEls)
    .map((el) => el.textContent || "")
    .join("\n");
  inlineCss = inlineCss.replace(/:root\s*\{/g, `.theme-${templateName} {`);
  const styleHrefs = Array.from(doc.head.querySelectorAll('link[rel="stylesheet"]'))
    .map((link) => link.getAttribute("href"))
    .filter(Boolean);

  fs.writeFileSync(path.join(outDir, "theme.css"), inlineCss || "/* no inline styles */\n", "utf-8");

  // 3. JS: inline scripts concatenated; external URLs collected
  const scriptEls = doc.querySelectorAll("script");
  const inlineScripts = [];
  const scriptSrcs = [];
  for (const script of scriptEls) {
    const src = script.getAttribute("src");
    if (src) {
      scriptSrcs.push(src);
    } else {
      const text = script.textContent || "";
      if (text.trim()) inlineScripts.push(text);
    }
  }
  const themeJs = inlineScripts.join("\n\n") || "// no inline scripts\n";
  fs.writeFileSync(path.join(outDir, "theme.js"), themeJs, "utf-8");

  const file = `templates/dist/${templateName}/index.html`;
  const css = `templates/dist/${templateName}/theme.css`;
  const js = `templates/dist/${templateName}/theme.js`;
  const themeClass = `theme-${templateName}`;

  return {
    ...template,
    file,
    css,
    js,
    themeClass,
    styleHrefs,
    scriptSrcs,
    section_count: sections.length,
  };
}

function main() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error("[build-templates] Manifest not found:", MANIFEST_PATH);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
  const templates = manifest.templates || [];
  if (templates.length === 0) {
    console.log("[build-templates] No templates in manifest.");
    return;
  }

  fs.mkdirSync(DIST_DIR, { recursive: true });

  const updated = [];
  for (const template of templates) {
    const result = buildTemplate(template);
    if (result) {
      updated.push(result);
      console.log(`[build-templates] Built: ${result.id} → templates/dist/${path.basename(path.dirname(result.file))}/`);
    }
  }

  manifest.templates = updated;
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n", "utf-8");
  console.log("[build-templates] Manifest updated.");
}

main();
