<?php
/**
 * Returns a minimal HTML document with nav + first section for the page preview in pages.php.
 *
 * GET  ?template=id[&theme=class]  — nav + first section from template file (unedited page).
 * POST template, nav, section[, theme] — nav + section from user's edited fullHtml.
 *
 * Always loads the template file for CSS + fonts; content comes from POST when available.
 */

$templateId = '';
$userNavHtml = null;
$userSectionHtml = null;
$themeOverride = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $templateId = isset($_POST['template']) ? trim($_POST['template']) : '';
    $raw = isset($_POST['nav']) ? trim($_POST['nav']) : '';
    $userNavHtml = $raw !== '' ? $raw : null;
    $raw = isset($_POST['section']) ? trim($_POST['section']) : '';
    $userSectionHtml = $raw !== '' ? $raw : null;
    $themeOverride = isset($_POST['theme']) ? trim($_POST['theme']) : '';
} else {
    $templateId = isset($_GET['template']) ? trim($_GET['template']) : '';
    $themeOverride = isset($_GET['theme']) ? trim($_GET['theme']) : '';
}

if ($templateId === '' || preg_match('/[^a-zA-Z0-9_-]/', $templateId)) {
    http_response_code(400);
    echo '<!DOCTYPE html><html><body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;color:#888;font-family:sans-serif;font-size:13px">Invalid template</body></html>';
    exit;
}

$baseDir = dirname(__DIR__);
$candidates = [
    $baseDir . '/templates/html/' . $templateId . '.html',
    $baseDir . '/templates/html/' . $templateId . '/index.html',
];

$templatePath = null;
foreach ($candidates as $path) {
    if (is_file($path)) {
        $templatePath = $path;
        break;
    }
}

if (!$templatePath || !is_readable($templatePath)) {
    http_response_code(404);
    echo '<!DOCTYPE html><html><body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;color:#888;font-family:sans-serif;font-size:13px">Template not found</body></html>';
    exit;
}

$html = file_get_contents($templatePath);
if ($html === false) {
    http_response_code(500);
    echo '<!DOCTYPE html><html><body>Error</body></html>';
    exit;
}

libxml_use_internal_errors(true);
$doc = new DOMDocument();
$doc->loadHTML($html, LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
libxml_clear_errors();
$xpath = new DOMXPath($doc);

// --- Collect head assets: font links and preconnect ---
$fontLinks = '';
$headLinks = $xpath->query('//head/link[@rel="stylesheet" or @rel="preconnect"]');
foreach ($headLinks as $link) {
    $href = $link->getAttribute('href');
    $rel = $link->getAttribute('rel');
    $crossorigin = $link->getAttribute('crossorigin');
    if ($href === '') continue;
    $attr = $crossorigin ? ' crossorigin="' . htmlspecialchars($crossorigin) . '"' : '';
    $fontLinks .= '<link rel="' . htmlspecialchars($rel) . '" href="' . htmlspecialchars($href) . '"' . $attr . ">\n";
}

// --- Collect all <style> blocks from head ---
$templateStyles = '';
$styleNodes = $xpath->query('//head/style');
foreach ($styleNodes as $style) {
    $templateStyles .= $style->textContent . "\n";
}

// --- Determine theme class ---
$themeClass = '';
if ($themeOverride !== '' && preg_match('/^theme-[a-zA-Z0-9_-]+$/', $themeOverride)) {
    $themeClass = $themeOverride;
}
if ($themeClass === '') {
    $bodyNode = $xpath->query('//body')->item(0);
    if ($bodyNode && $bodyNode->hasAttribute('class')) {
        $classes = preg_split('/\s+/', trim($bodyNode->getAttribute('class')), -1, PREG_SPLIT_NO_EMPTY);
        foreach ($classes as $c) {
            if (strpos($c, 'theme-') === 0) {
                $themeClass = $c;
                break;
            }
        }
    }
}

// --- Nav HTML ---
if ($userNavHtml !== null) {
    $navHtml = $userNavHtml;
} else {
    $navNode = $doc->getElementById('nav');
    if (!$navNode) {
        $navs = $xpath->query('//nav');
        $navNode = $navs->length > 0 ? $navs->item(0) : null;
    }
    $navHtml = $navNode ? $doc->saveHTML($navNode) : '';
}

// --- Section HTML ---
if ($userSectionHtml !== null) {
    $sectionHtml = $userSectionHtml;
} else {
    $sectionNode = $doc->getElementById('hero');
    if (!$sectionNode) {
        $sections = $xpath->query('//section');
        $sectionNode = $sections->length > 0 ? $sections->item(0) : null;
    }
    $sectionHtml = $sectionNode ? $doc->saveHTML($sectionNode) : '';
}

$assetBase = '../';
$sectionsCssUrl = $assetBase . 'public/css/sections.css';

header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=1440">
    <title>Preview</title>
    <?php echo $fontLinks; ?>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="<?php echo htmlspecialchars($sectionsCssUrl); ?>">
    <style><?php echo $templateStyles; ?></style>
    <style>
        html, body {
            margin: 0; padding: 0;
            width: 1440px; height: 900px;
            overflow: hidden;
            background: #111;
        }
        body { position: relative; }
        /* Force reveal animations visible (no JS observer in this context) */
        .reveal, .reveal-left, .reveal-right, .reveal-scale {
            opacity: 1 !important;
            transform: none !important;
        }
        nav { position: absolute; top: 0; left: 0; right: 0; z-index: 10; }
        body > section, body > section#hero {
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            min-height: 900px !important;
        }
        .scroll-indicator { display: none !important; }
        .theme-switcher { display: none !important; }
    </style>
</head>
<body class="<?php echo htmlspecialchars($themeClass); ?>">
    <?php echo $navHtml; ?>
    <?php echo $sectionHtml; ?>
    <script>
    // Scale 1440x900 content to fit the iframe (top-left origin so nav + hero fill the card)
    (function() {
        function applyScale() {
            var vw = 1440, vh = 900;
            var iw = window.innerWidth || document.documentElement.clientWidth;
            var ih = window.innerHeight || document.documentElement.clientHeight;
            if (iw < 10 || ih < 10) return;
            var scale = Math.min(iw / vw, ih / vh);
            document.body.style.transform = 'scale(' + scale + ')';
            document.body.style.transformOrigin = 'top left';
        }
        applyScale();
        window.addEventListener('resize', applyScale);
    })();
    </script>
</body>
</html>
