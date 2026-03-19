<?php
/**
 * Preview page with environment-aware asset loading
 */

// Load environment variables from .env file
$autoloadPath = __DIR__ . '/vendor/autoload.php';
if (file_exists($autoloadPath)) {
    require_once $autoloadPath;
    
    $dotenvPath = __DIR__;
    $envFilePath = $dotenvPath . '/.env';
    
    if (file_exists($envFilePath)) {
        try {
            // Use createUnsafeImmutable to also populate putenv() so getenv() works
            $dotenv = Dotenv\Dotenv::createUnsafeImmutable($dotenvPath);
            $dotenv->load();
        } catch (Exception $e) {
            error_log("Dotenv loading error in preview.php: " . $e->getMessage());
        }
    }
}

function editor_asset(string $path): string
{
    // Return external URLs as-is
    if (preg_match('#^(https?:)?//#', $path)) {
        return $path;
    }

    // Detect environment - production uses minified assets
    $isProduction = ($_ENV['APP_ENV'] ?? getenv('APP_ENV')) === 'production';
    
    static $manifest = null;
    
    // PRODUCTION: Use rev-manifest with minified/hashed files
    if ($isProduction) {
        if ($manifest === null) {
            $manifestPath = __DIR__ . '/public/dist/rev-manifest.json';
            if (file_exists($manifestPath)) {
                $manifestContent = file_get_contents($manifestPath);
                $manifest = json_decode($manifestContent, true) ?? [];
            } else {
                $manifest = [];
            }
        }
        
        // Normalize path for manifest lookup (remove leading ./ and public/)
        $lookupPath = $path;
        if (strncmp($lookupPath, './', 2) === 0) {
            $lookupPath = substr($lookupPath, 2);
        }
        $lookupPath = ltrim($lookupPath, '/');
        
        // Remove 'public/' prefix if present
        $lookupPath = preg_replace('#^public/#', '', $lookupPath);
        
        // Check manifest for hashed version
        if (isset($manifest[$lookupPath])) {
            return './public/dist/' . $manifest[$lookupPath];
        }
        
        // Fallback if not in manifest (shouldn't happen in production)
        error_log("Asset not found in manifest: $lookupPath");
    }
    
    // DEVELOPMENT: Use original files with filemtime for cache busting
    $relativePath = $path;
    
    if (strncmp($relativePath, './', 2) === 0) {
        $relativePath = substr($relativePath, 2);
    }
    
    $relativePath = ltrim($relativePath, '/');
    
    $fullPath = __DIR__ . '/' . $relativePath;
    
    if (!file_exists($fullPath)) {
        return $path;
    }
    
    $version = filemtime($fullPath);
    $separator = strpos($path, '?') === false ? '?v=' : '&v=';
    
    return $path . $separator . $version;
}

/**
 * Extract CSS class names that have background-image (or background with url()) from style content.
 * @return string[] Class names without the leading dot
 */
function template_css_classes_with_background_image(string $css): array {
    $classes = [];
    if (preg_match_all('/\.([a-zA-Z0-9_-]+)\s*\{[^}]*url\s*\(/s', $css, $m)) {
        $classes = array_unique($m[1]);
    }
    return $classes;
}

/**
 * Normalize a section/footer element to .fp-bg/data-bg so the editor detects background images.
 * - If the section has inline background image -> set data-bg="true".
 * - If a direct child has inline bg image or a class that has bg image in CSS -> add class "fp-bg" to that child and "has-bg-image" to the section.
 */
function normalize_section_background_structure(DOMElement $section, array $cssClassesWithBg): void {
    $sectionTag = strtolower($section->nodeName);
    if ($sectionTag !== 'section' && $sectionTag !== 'footer') {
        return;
    }
    if ($section->getAttribute('data-bg') === 'true') {
        return;
    }
    $sectionClass = $section->getAttribute('class') ?: '';
    foreach ($section->getElementsByTagName('*') as $desc) {
        $c = $desc->getAttribute('class') ?: '';
        if (preg_match('/\bfp-bg\b/', $c)) {
            return;
        }
    }

    $style = $section->getAttribute('style') ?: '';
    if (preg_match('/url\s*\(/i', $style)) {
        $section->setAttribute('data-bg', 'true');
        return;
    }

    foreach ($section->childNodes as $child) {
        if ($child->nodeType !== XML_ELEMENT_NODE) {
            continue;
        }
        $childStyle = $child->getAttribute('style') ?: '';
        if (preg_match('/url\s*\(/i', $childStyle)) {
            $childClassAttr = $child->getAttribute('class') ?: '';
            if (!preg_match('/\bfp-bg\b/', $childClassAttr)) {
                $child->setAttribute('class', trim($childClassAttr . ' fp-bg'));
            }
            if (!preg_match('/\bhas-bg-image\b/', $sectionClass)) {
                $section->setAttribute('class', trim($sectionClass . ' has-bg-image'));
            }
            return;
        }
        $childClassAttr = $child->getAttribute('class') ?: '';
        foreach (array_filter(explode(' ', $childClassAttr)) as $c) {
            if (in_array($c, $cssClassesWithBg, true)) {
                if (!preg_match('/\bfp-bg\b/', $childClassAttr)) {
                    $child->setAttribute('class', trim($childClassAttr . ' fp-bg'));
                }
                if (!preg_match('/\bhas-bg-image\b/', $sectionClass)) {
                    $section->setAttribute('class', trim($sectionClass . ' has-bg-image'));
                }
                return;
            }
        }
    }
}

/**
 * Load template HTML and extract head elements + body inner HTML for injection.
 * Template path must be under templates/html/ (e.g. templates/html/template1.html).
 * Normalizes section/footer structure to .fp-bg and data-bg so the editor detects background images.
 * Returns [ 'headHtml' => string, 'bodyInnerHtml' => string ] or null if invalid.
 */
function load_template_for_preview(string $templatePath): ?array {
    $templatePath = preg_replace('#^/+#', '', $templatePath);
    $templatePath = str_replace('\\', '/', $templatePath);
    if (strpos($templatePath, 'templates/html/') !== 0) {
        return null;
    }
    $absPath = __DIR__ . '/' . $templatePath;
    if (!is_file($absPath) || !preg_match('/\.html$/i', $templatePath)) {
        return null;
    }
    $baseHref = dirname($templatePath) . '/';
    $html = @file_get_contents($absPath);
    if ($html === false) {
        return null;
    }
    $dom = new DOMDocument();
    libxml_use_internal_errors(true);
    $loaded = @$dom->loadHTML(
        mb_convert_encoding($html, 'HTML-ENTITIES', 'UTF-8')
    );
    libxml_clear_errors();
    if (!$loaded) {
        return null;
    }
    $head = $dom->getElementsByTagName('head')->item(0);
    $body = $dom->getElementsByTagName('body')->item(0);
    if (!$head || !$body) {
        return null;
    }
    $resolveHref = function (string $href) use ($baseHref): string {
        if ($href === '' || preg_match('#^(https?:)?//#', $href) || strpos($href, 'data:') === 0 || strpos($href, '#') === 0) {
            return $href;
        }
        if (strpos($href, '/') === 0) {
            return $href;
        }
        return $baseHref . ltrim($href, '/');
    };
    $headHtml = '';
    foreach ($head->childNodes as $node) {
        if ($node->nodeType !== XML_ELEMENT_NODE) {
            continue;
        }
        $tag = strtolower($node->nodeName);
        if ($tag === 'link') {
            $href = $node->getAttribute('href');
            if ($href !== '') {
                $href = $resolveHref($href);
            }
            $attrs = [];
            foreach ($node->attributes as $a) {
                $attrs[$a->name] = $a->name === 'href' ? $href : $a->value;
            }
            $headHtml .= '<link';
            foreach ($attrs as $k => $v) {
                $headHtml .= ' ' . htmlspecialchars($k, ENT_QUOTES, 'UTF-8') . '="' . htmlspecialchars($v, ENT_QUOTES, 'UTF-8') . '"';
            }
            $headHtml .= ">\n";
        } elseif ($tag === 'script') {
            $src = $node->getAttribute('src');
            if ($src !== '') {
                $src = $resolveHref($src);
            }
            $attrs = [];
            foreach ($node->attributes as $a) {
                $attrs[$a->name] = $a->name === 'src' ? $src : $a->value;
            }
            $headHtml .= '<script';
            foreach ($attrs as $k => $v) {
                $headHtml .= ' ' . htmlspecialchars($k, ENT_QUOTES, 'UTF-8') . '="' . htmlspecialchars($v, ENT_QUOTES, 'UTF-8') . '"';
            }
            $headHtml .= '>';
            if ($node->textContent !== '') {
                $headHtml .= $node->textContent . '</script>';
            } else {
                $headHtml .= '</script>';
            }
            $headHtml .= "\n";
        } elseif ($tag === 'style') {
            // Keep :root as-is so template variables act as low-specificity defaults that themes can override
            $styleContent = $node->textContent;
            // Rewrite body {} to scope template layout/font styles to the preview container
            $styleContent = preg_replace('/\bbody\s*\{/i', '#preview-content.has-full-template {', $styleContent);
            $headHtml .= '<style data-template-style="1"';
            foreach ($node->attributes as $a) {
                $headHtml .= ' ' . htmlspecialchars($a->name, ENT_QUOTES, 'UTF-8') . '="' . htmlspecialchars($a->value, ENT_QUOTES, 'UTF-8') . '"';
            }
            $headHtml .= '>' . $styleContent . '</style>' . "\n";
        } else {
            $headHtml .= $dom->saveHTML($node) . "\n";
        }
    }

    // Collect CSS class names that have background-image (from <style> in head)
    $cssClassesWithBg = [];
    foreach ($head->childNodes as $node) {
        if ($node->nodeType === XML_ELEMENT_NODE && strtolower($node->nodeName) === 'style') {
            $cssClassesWithBg = array_merge(
                $cssClassesWithBg,
                template_css_classes_with_background_image($node->textContent)
            );
        }
    }
    $cssClassesWithBg = array_values(array_unique($cssClassesWithBg));

    // Normalize section/footer to .fp-bg and data-bg so the editor detects background images
    $elementsToNormalize = [];
    foreach ($dom->getElementsByTagName('section') as $el) {
        $elementsToNormalize[] = $el;
    }
    foreach ($dom->getElementsByTagName('footer') as $el) {
        $elementsToNormalize[] = $el;
    }
    foreach ($elementsToNormalize as $el) {
        normalize_section_background_structure($el, $cssClassesWithBg);
    }

    // Build body inner HTML from normalized DOM
    $bodyInnerHtml = '';
    foreach ($body->childNodes as $node) {
        $bodyInnerHtml .= $dom->saveHTML($node);
    }
    $bodyInnerHtml = trim($bodyInnerHtml);

    return [
        'headHtml' => $headHtml,
        'bodyInnerHtml' => $bodyInnerHtml,
    ];
}

$templatePreview = null;
if (!empty($_GET['template'])) {
    $templatePreview = load_template_for_preview($_GET['template']);
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Preview</title>
    
    <!-- Sentry Error Tracking - Full Browser Bundle -->
    <script
      src="https://browser.sentry-cdn.com/8.38.0/bundle.tracing.min.js"
      crossorigin="anonymous"
    ></script>
    <script src="<?= editor_asset('./public/js/sentry-init.js') ?>"></script>
    
    <link rel="stylesheet" href="./dist/output.css">
    <!-- Tailwind CDN: required for arbitrary-value classes used in wedding templates (e.g. bg-[var(--primary-bg)]) -->
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="<?= editor_asset('./public/css/viewport-animations.css') ?>">
    <link rel="stylesheet" href="<?= editor_asset('./public/css/sections.css') ?>">
    <link rel="stylesheet" href="<?= editor_asset('./public/css/header-nav.css') ?>">
    <link rel="stylesheet" href="<?= editor_asset('./public/css/simple-editor.css') ?>">
    <link rel="stylesheet" href="<?= editor_asset('./public/css/data-attributes-editor.css') ?>">
    <link rel="stylesheet" href="<?= editor_asset('./public/css/inline-svg-editor.css') ?>">
    <link rel="stylesheet" href="<?= editor_asset('./public/css/inline-emoji-editor.css') ?>">
    <link rel="stylesheet" href="<?= editor_asset('./public/css/inline-map-editor.css') ?>">
    <link rel="stylesheet" href="<?= editor_asset('./public/css/inline-countdown-editor.css') ?>">
    
    <!-- TinyMCE Library (loaded statically as it's always used) -->
    <link rel="stylesheet" href="./public/js/tinymce/skins/ui/oxide/skin.min.css">
    <link rel="stylesheet" href="./public/js/tinymce/skins/content/default/content.min.css">
    
    <link rel="stylesheet" href="<?= editor_asset('./public/css/preview.css') ?>">

    <script id="tinymce-lib" defer src="./public/js/tinymce/tinymce.min.js"></script>
    
    <script defer src="https://unpkg.com/@popperjs/core@2"></script>
    <script defer src="https://unpkg.com/tippy.js@6"></script>
    <script defer src="https://unpkg.com/lucide@latest"></script>
    <script defer src="<?= editor_asset('./public/js/tinymce-editor.js') ?>"></script>
    <script defer src="<?= editor_asset('./public/js/cloudinary-image-editor.js') ?>"></script>
    <script defer src="<?= editor_asset('./public/js/data-attributes-editor.js') ?>"></script>
    <script defer src="<?= editor_asset('./public/js/removable-elements-manager.js') ?>"></script>
    <script defer src="<?= editor_asset('./public/js/duplicable-elements-manager.js') ?>"></script>
    <script defer src="<?= editor_asset('./public/js/custom-theme-manager.js') ?>"></script>
    <script defer src="<?= editor_asset('./public/js/section-background-picker.js') ?>"></script>
    <script defer src="<?= editor_asset('./public/js/inline-video-editor.js') ?>"></script>
    <script defer src="https://code.iconify.design/3/3.1.1/iconify.min.js"></script>
    <script defer src="<?= editor_asset('./public/js/inline-svg-editor.js') ?>"></script>
    <script defer src="<?= editor_asset('./public/js/inline-emoji-editor.js') ?>"></script>
    <script defer src="<?= editor_asset('./public/js/tinymce/plugins/emoticons/js/emojis.min.js') ?>"></script>
    <script defer src="<?= editor_asset('./public/js/inline-map-editor.js') ?>"></script>
    <script defer src="<?= editor_asset('./public/js/inline-countdown-editor.js') ?>"></script>
    <script defer src="<?= editor_asset('./public/js/viewport-animations.js') ?>"></script>
    <script defer src="<?= editor_asset('./public/js/lazy-background-loader.js') ?>"></script>
    
    <!-- Load all section scripts (used by various section types; templates may use only a subset) -->
    <!-- Gallery scripts -->
    <script defer src="<?= editor_asset('./public/js/sections/fp-theme-gallery-thumbs.js') ?>"></script>
    <script defer src="<?= editor_asset('./public/js/sections/fp-theme-gallery-thumbs-fade.js') ?>"></script>
    <script defer src="<?= editor_asset('./public/js/sections/fp-theme-gallery-slider.js') ?>"></script>
    <script defer src="<?= editor_asset('./public/js/sections/fp-theme-gallery-slider-arrows.js') ?>"></script>
    <script defer src="<?= editor_asset('./public/js/sections/fp-theme-gallery-scroll.js') ?>"></script>
    
    <!-- Team scripts -->
    <script defer src="<?= editor_asset('./public/js/sections/fp-theme-team-slider.js') ?>"></script>
    <script defer src="<?= editor_asset('./public/js/sections/fp-theme-team-carousel.js') ?>"></script>
    
    <!-- Testimonial scripts -->
    <script defer src="<?= editor_asset('./public/js/sections/fp-theme-testimonial-carousel.js') ?>"></script>
    <script defer src="<?= editor_asset('./public/js/sections/fp-theme-testimonials-interactive.js') ?>"></script>
    
    <!-- Product/slider scripts -->
    <script defer src="<?= editor_asset('./public/js/sections/fp-theme-product-slider.js') ?>"></script>
    <script defer src="<?= editor_asset('./public/js/sections/fp-theme-steps-slider.js') ?>"></script>
    
    <!-- Pricing -->
    <script defer src="<?= editor_asset('./public/js/sections/fp-theme-pricing-toggle.js') ?>"></script>
    
    <!-- Interactive Features -->
    <script defer src="<?= editor_asset('./public/js/sections/fp-theme-interactive-features.js') ?>"></script>
    
    <!-- Generic Accordion script (used by multiple FAQ sections) -->
    <script defer src="<?= editor_asset('./public/js/sections/fp-theme-accordion.js') ?>"></script>
    
    <!-- Specialized accordion scripts -->
    <script defer src="<?= editor_asset('./public/js/sections/fp-theme-process-accordion.js') ?>"></script>
    <script defer src="<?= editor_asset('./public/js/sections/fp-theme-popular-questions.js') ?>"></script>
    
    <!-- Section script initializer - handles all interactive sections -->
    <script defer src="<?= editor_asset('./public/js/section-initializer.js') ?>"></script>
    
    <?php if ($templatePreview): ?>
    <!-- Template head (CSS, fonts, scripts from template HTML) -->
    <?= $templatePreview['headHtml'] ?>
    <?php endif; ?>
</head>
<body>
    <div id="preview-content" class="@container<?= $templatePreview ? ' has-full-template' : '' ?>"<?= $templatePreview ? ' data-initial-template="1"' : '' ?>>
        <?php if ($templatePreview): ?>
        <?= $templatePreview['bodyInnerHtml'] ?>
        <?php else: ?>
        <!-- Sections will be dynamically added here -->
        <?php endif; ?>
    </div>
    <!-- Nav bar: en preview/editor el scroll es #preview-content (no window). Siempre inyectado para que funcione también cuando el contenido se restaura por RESTORE_HISTORY (p. ej. al volver desde pages.php). -->
    <script>
    (function() {
      function initNavScroll() {
        var el = document.getElementById('preview-content');
        if (!el) return;
        var threshold = 80;
        function update() {
          var nav = el.querySelector('#nav, nav');
          if (nav) nav.classList.toggle('scrolled', el.scrollTop > threshold);
        }
        el.addEventListener('scroll', update, { passive: true });
        update();
        requestAnimationFrame(update);
        window.__previewNavScrollUpdate = update;
      }
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initNavScroll);
      } else {
        initNavScroll();
      }
    })();
    </script>
    <!-- Enviar CSS del template al parent para estilizar las miniaturas del outline (con template = CSS; sin template = null para limpiar) -->
    <script>
    (function() {
      if (window.parent === window) return;
      var wrap = document.getElementById('preview-content');
      var css = null;
      if (wrap && wrap.classList.contains('has-full-template')) {
        var styles = document.querySelectorAll('style[data-template-style="1"]');
        if (styles.length) css = Array.prototype.map.call(styles, function(s) { return s.textContent; }).join('\n');
      }
      try { window.parent.postMessage({ type: 'TEMPLATE_CSS_FOR_OUTLINE', css: css }, '*'); } catch (e) {}
    })();
    </script>

    <!-- Data Attributes Editor Modal -->
    <div id="data-attributes-modal" class="data-attributes-modal fp-ui-theme">
        <div class="data-attributes-modal-content">
            <div class="data-attributes-modal-header">
                <h3 class="data-attributes-modal-title">Edit Content Attributes</h3>
                <button id="data-attributes-modal-close" class="data-attributes-modal-close">
                    <i data-lucide="x"></i>
                </button>
            </div>
            <div class="data-attributes-tabs" id="data-attributes-tabs">
                <!-- Tabs will be dynamically generated here -->
            </div>
            <div class="data-attributes-modal-body" id="data-attributes-modal-body">
                <!-- Tab content will be dynamically generated here -->
            </div>
            <div class="data-attributes-modal-footer">
                <button class="data-attributes-btn" id="data-attributes-cancel">Cancel</button>
                <button class="data-attributes-btn data-attributes-btn-primary" id="data-attributes-save">
                    <i data-lucide="save"></i>
                    Save Changes
                </button>
            </div>
        </div>
    </div>

    <script defer src="<?= editor_asset('./public/js/navbar-section-sync.js') ?>"></script>
    <script src="<?= editor_asset('./public/js/preview.js') ?>"></script>
</body>
</html> 