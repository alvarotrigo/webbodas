<?php
/**
 * List template HTML files under templates/html/ with metadata from meta tags.
 * Returns JSON: { "templates": [ { "id", "name", "url", "styles": [] } ] }
 * Used by the app to build the style filter panels; no auth required (read-only, public templates).
 */

header('Content-Type: application/json; charset=utf-8');

$VALID_STYLES = ['minimal', 'classic', 'rustic', 'luxe'];
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
    $templates[] = parseTemplateMeta($absPath, $base, $relPath, $VALID_STYLES);
}

// Subdirs: */index.html
foreach (glob($htmlDir . '/*', GLOB_ONLYDIR) ?: [] as $subDir) {
    $indexPath = $subDir . '/index.html';
    if (!is_file($indexPath)) {
        continue;
    }
    $base = basename($subDir);
    $relPath = 'templates/html/' . $base . '/index.html';
    $templates[] = parseTemplateMeta($indexPath, $base, $relPath, $VALID_STYLES);
}

echo json_encode(['templates' => $templates]);

/**
 * @param string $absPath
 * @param string $id
 * @param string $url
 * @param string[] $validStyles
 * @return array{id: string, name: string, url: string, styles: string[]}
 */
function parseTemplateMeta($absPath, $id, $url, array $validStyles) {
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
        'id' => $id,
        'name' => $name,
        'url' => $url,
        'styles' => $styles
    ];
}
