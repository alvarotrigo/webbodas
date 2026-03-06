<?php
/**
 * [DISABLED_FOR_WEDDING_VERSION]: This endpoint has been replaced by the static `templates` and
 * `templateCategories` arrays defined in public/js/app.js. Template metadata is no longer
 * discovered dynamically from the filesystem; it is declared explicitly in JS.
 *
 * The original implementation scanned templates/html/, parsed CATEGORY__NAME__TAGS.html
 * filenames, read templates/categorias.json for style categories, and detected color
 * categories via api/color-detector.php. All of that is now handled statically.
 */

/*
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/color-detector.php';
$colorAnchors = loadColorAnchors(dirname(__DIR__) . '/templates/colores.json');

$categoriasPath = dirname(__DIR__) . '/templates/categorias.json';
$categories = [];
$VALID_STYLES = ['minimal', 'classic', 'rustic', 'luxe']; // fallback si no existe categorias.json
if (is_file($categoriasPath)) {
    $raw = @file_get_contents($categoriasPath);
    if ($raw !== false) {
        $decoded = json_decode($raw, true);
        if (is_array($decoded)) {
            $categories = $decoded;
            $VALID_STYLES = array_values(array_filter(array_map(function ($c) {
                return isset($c['id']) ? $c['id'] : null;
            }, $categories)));
        }
    }
}

$htmlDir = dirname(__DIR__) . '/templates/html';

if (!is_dir($htmlDir)) {
    echo json_encode(['templates' => []]);
    exit;
}

$templates = [];

// Root: *.html
foreach (glob($htmlDir . '/*.html') ?: [] as $absPath) {
    $base = basename($absPath, '.html');
    $relPath = 'templates/html/' . basename($absPath);
    $templates[] = buildTemplateEntry($absPath, $base, $relPath, $VALID_STYLES);
}

// Subdirs: */index.html
foreach (glob($htmlDir . '/*', GLOB_ONLYDIR) ?: [] as $subDir) {
    $indexPath = $subDir . '/index.html';
    if (!is_file($indexPath)) {
        continue;
    }
    $base = basename($subDir);
    $relPath = 'templates/html/' . $base . '/index.html';
    $templates[] = buildTemplateEntry($indexPath, $base, $relPath, $VALID_STYLES);
}

echo json_encode(['categories' => $categories, 'colors' => $colorAnchors, 'templates' => $templates]);

/**
 * Build a template entry trying the filename convention first, then falling back to meta tags.
 */
function buildTemplateEntry(string $absPath, string $id, string $url, array $validStyles): array {
    global $colorAnchors;
    $colorCategory = detectTemplateColorCategory($absPath, $colorAnchors);

    $conv = parseFilenameConvention($id, $validStyles);
    if ($conv !== null) {
        return [
            'id'            => $id,
            'name'          => $conv['name'],
            'url'           => $url,
            'category'      => $conv['category'],
            'tags'          => $conv['tags'],
            'styles'        => $conv['styles'],
            'colorCategory' => $colorCategory,
        ];
    }
    $entry = parseTemplateMeta($absPath, $id, $url, $validStyles);
    $entry['colorCategory'] = $colorCategory;
    return $entry;
}

/**
 * Extract category, display name, tags and styles from a filename that follows
 * the convention CATEGORY__NAME__TAG1-TAG2-TAG3 (without extension).
 *
 * @return array{category: string, name: string, tags: string[], styles: string[]}|null
 */
function parseFilenameConvention(string $filename, array $validStyles): ?array {
    $parts = explode('__', $filename);
    if (count($parts) !== 3) {
        return null;
    }

    $category = $parts[0];
    $rawName  = $parts[1];
    $rawTags  = $parts[2];

    $name = ucwords(str_replace('-', ' ', $rawName));
    $tags = array_values(array_filter(explode('-', $rawTags)));

    $allCandidates = array_merge([$category], $tags);
    $styles = array_values(array_unique(array_intersect($allCandidates, $validStyles)));

    return compact('category', 'name', 'tags', 'styles');
}

/**
 * Fallback: read meta tags from the HTML file for templates that don't follow the naming convention.
 *
 * @return array{id: string, name: string, url: string, category: string, tags: string[], styles: string[]}
 */
function parseTemplateMeta(string $absPath, string $id, string $url, array $validStyles): array {
    $name = $id;
    $styles = [];

    $html = @file_get_contents($absPath);
    if ($html !== false) {
        if (preg_match('/<meta\s+name=["\']template-name["\']\s+content=["\']([^"\']*)["\']/i', $html, $m)) {
            $name = trim($m[1]);
        }
        if (preg_match('/<meta\s+name=["\']template-styles["\']\s+content=["\']([^"\']*)["\']/i', $html, $m)) {
            $parts = array_map('trim', explode(',', $m[1]));
            $styles = array_values(array_intersect($parts, $validStyles));
        }
    }

    return [
        'id'       => $id,
        'name'     => $name,
        'url'      => $url,
        'category' => '',
        'tags'     => [],
        'styles'   => $styles,
    ];
}
*/
