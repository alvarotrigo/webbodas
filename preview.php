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
 * Load template HTML and extract head elements + body inner HTML for injection.
 * Template path must be under templates/html/ (e.g. templates/html/template1.html).
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
            // Scope :root variables to #preview-content.has-full-template so template vars (e.g. --blush) win over editor theme
            $styleContent = preg_replace('/:root\s*\{/i', '#preview-content.has-full-template {', $node->textContent);
            // Apply template body styles to the container so var(--blush) etc. resolve (body is outside the container, so body { } would not see those vars)
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
    // Extract body inner HTML from raw file to preserve comments and Unicode (e.g. ═ in section comments)
    $bodyInnerHtml = '';
    $bodyStart = stripos($html, '<body');
    if ($bodyStart !== false) {
        $bodyStart = strpos($html, '>', $bodyStart) + 1;
        $bodyEnd = stripos($html, '</body>', $bodyStart);
        if ($bodyEnd !== false) {
            $bodyInnerHtml = substr($html, $bodyStart, $bodyEnd - $bodyStart);
            $bodyInnerHtml = trim($bodyInnerHtml);
        }
    }
    if ($bodyInnerHtml === '' && $body->childNodes->length > 0) {
        foreach ($body->childNodes as $node) {
            $bodyInnerHtml .= $dom->saveHTML($node);
        }
    }
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
    <link rel="stylesheet" href="<?= editor_asset('./public/css/viewport-animations.css') ?>">
    <link rel="stylesheet" href="<?= editor_asset('./public/css/sections.css') ?>">
    <link rel="stylesheet" href="<?= editor_asset('./public/css/header-nav.css') ?>">
    <link rel="stylesheet" href="<?= editor_asset('./public/css/simple-editor.css') ?>">
    <link rel="stylesheet" href="<?= editor_asset('./public/css/data-attributes-editor.css') ?>">
    <link rel="stylesheet" href="<?= editor_asset('./public/css/inline-svg-editor.css') ?>">
    
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
    <script defer src="<?= editor_asset('./public/js/custom-theme-manager.js') ?>"></script>
    <script defer src="<?= editor_asset('./public/js/section-background-picker.js') ?>"></script>
    <script defer src="<?= editor_asset('./public/js/inline-video-editor.js') ?>"></script>
    <script defer src="<?= editor_asset('./public/js/inline-svg-editor.js') ?>"></script>
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
    <?php if ($templatePreview): ?>
    <!-- Nav bar: en preview el scroll es #preview-content, no window; sincronizar .scrolled con scrollTop -->
    <script>
    (function() {
      var el = document.getElementById('preview-content');
      var nav = el && el.querySelector('nav');
      if (!el || !nav) return;
      var threshold = 80;
      function update() { nav.classList.toggle('scrolled', el.scrollTop > threshold); }
      el.addEventListener('scroll', update);
      update();
    })();
    </script>
    <?php endif; ?>
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

    <script src="<?= editor_asset('./public/js/preview.js') ?>"></script>
</body>
</html> 