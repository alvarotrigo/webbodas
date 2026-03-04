<?php
/**
 * color-detector.php
 *
 * Detección automática del color predominante de un template HTML.
 * Estrategia: extrae el background-color del <body> resolviendo las
 * CSS variables declaradas en :root, y clasifica el color resultante
 * comparándolo con los 12 anclas de templates/colores.json usando
 * distancia euclidiana en espacio RGB.
 *
 * Sin dependencias externas.
 */

/**
 * Carga los anclas de color desde colores.json.
 *
 * @param  string $path  Ruta absoluta a templates/colores.json
 * @return array         [ ['id'=>..., 'name'=>..., 'hex'=>..., 'description'=>...], ... ]
 */
function loadColorAnchors(string $path): array
{
    if (!is_file($path)) {
        return [];
    }
    $raw = @file_get_contents($path);
    if ($raw === false) {
        return [];
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

/**
 * Convierte un color hex (#RGB o #RRGGBB) a array [r, g, b].
 *
 * @param  string     $hex  p.ej. "#FAFAF0" o "#FFF"
 * @return array|null       [r, g, b] o null si formato inválido
 */
function hexToRgb(string $hex): ?array
{
    $hex = ltrim($hex, '#');
    if (strlen($hex) === 3) {
        $hex = $hex[0] . $hex[0] . $hex[1] . $hex[1] . $hex[2] . $hex[2];
    }
    if (strlen($hex) !== 6 || !ctype_xdigit($hex)) {
        return null;
    }
    return [
        hexdec(substr($hex, 0, 2)),
        hexdec(substr($hex, 2, 2)),
        hexdec(substr($hex, 4, 2)),
    ];
}

/**
 * Calcula la distancia euclidiana entre dos colores RGB.
 * d = sqrt((R2-R1)^2 + (G2-G1)^2 + (B2-B1)^2)
 *
 * @param  array $rgb1  [r, g, b]
 * @param  array $rgb2  [r, g, b]
 * @return float
 */
function colorDistanceEuclidean(array $rgb1, array $rgb2): float
{
    return sqrt(
        ($rgb2[0] - $rgb1[0]) ** 2 +
        ($rgb2[1] - $rgb1[1]) ** 2 +
        ($rgb2[2] - $rgb1[2]) ** 2
    );
}

/**
 * Extrae el color de fondo del <body> de un template HTML.
 *
 * Pasos:
 *  1. Busca el bloque :root { ... } y extrae todas las custom properties (--var: #hex).
 *  2. Busca en el selector "body" la propiedad background o background-color.
 *  3. Si el valor es var(--name), lo resuelve con el mapa de :root.
 *  4. Devuelve el hex resultante, o null si no se puede determinar.
 *
 * @param  string      $htmlContent  Contenido HTML completo del template
 * @return string|null               Hex color (#RRGGBB) o null
 */
function extractBodyBackground(string $htmlContent): ?string
{
    // 1. Extraer bloque :root (puede haber múltiples <style>)
    $rootVars = [];
    // Captura bloques :root { ... } incluso con selectores anidados de media queries
    if (preg_match_all('/:root\s*\{([^}]+)\}/s', $htmlContent, $rootMatches)) {
        foreach ($rootMatches[1] as $rootBlock) {
            // Extraer custom properties con valor hex
            if (preg_match_all('/(--([\w-]+))\s*:\s*(#[0-9a-fA-F]{3,8})\b/', $rootBlock, $varMatches, PREG_SET_ORDER)) {
                foreach ($varMatches as $m) {
                    // $m[1] = --varname, $m[3] = #hex
                    $rootVars[$m[1]] = $m[3];
                }
            }
        }
    }

    // 2. Extraer regla body { ... }
    // Busca selectores que incluyan "body" como selector simple o como parte de "html body"
    $bodyBg = null;
    if (preg_match('/(?:^|[\s,;}])(?:html\s+)?body\s*\{([^}]*)\}/sm', $htmlContent, $bodyMatch)) {
        $bodyBlock = $bodyMatch[1];

        // Propiedad background-color primero (más específica)
        if (preg_match('/background-color\s*:\s*([^;]+);/i', $bodyBlock, $bgColorMatch)) {
            $bodyBg = trim($bgColorMatch[1]);
        } elseif (preg_match('/background\s*:\s*([^;]+);/i', $bodyBlock, $bgMatch)) {
            // background shorthand: tomar solo el primer token que sea color
            $value = trim($bgMatch[1]);
            // Si comienza por # es un hex directo
            if (preg_match('/(#[0-9a-fA-F]{3,8})/', $value, $hexInBg)) {
                $bodyBg = $hexInBg[1];
            } else {
                $bodyBg = $value;
            }
        }
    }

    if ($bodyBg === null) {
        return null;
    }

    // 3. Resolver var(--name)
    if (preg_match('/var\(\s*(--[\w-]+)\s*\)/', $bodyBg, $varRef)) {
        $varName = $varRef[1];
        if (isset($rootVars[$varName])) {
            $bodyBg = $rootVars[$varName];
        } else {
            return null;
        }
    }

    // 4. Validar que es un hex
    if (preg_match('/^#[0-9a-fA-F]{3,8}$/', $bodyBg)) {
        // Normalizar a 6 dígitos
        $hex = ltrim($bodyBg, '#');
        if (strlen($hex) === 3) {
            $hex = $hex[0].$hex[0].$hex[1].$hex[1].$hex[2].$hex[2];
        }
        return '#' . strtoupper(substr($hex, 0, 6));
    }

    return null;
}

/**
 * Clasifica un color hex en la categoría de ancla más cercana.
 *
 * @param  string $hex      Color a clasificar, p.ej. "#F8EDE3"
 * @param  array  $anchors  Array de anclas cargadas con loadColorAnchors()
 * @return string           Id del ancla más cercana, o "white" como fallback
 */
function classifyColor(string $hex, array $anchors): string
{
    $rgb = hexToRgb($hex);
    if ($rgb === null || empty($anchors)) {
        return 'white';
    }

    $minDistance = PHP_FLOAT_MAX;
    $bestId      = $anchors[0]['id'] ?? 'white';

    foreach ($anchors as $anchor) {
        if (empty($anchor['hex']) || empty($anchor['id'])) {
            continue;
        }
        $anchorRgb = hexToRgb($anchor['hex']);
        if ($anchorRgb === null) {
            continue;
        }
        $dist = colorDistanceEuclidean($rgb, $anchorRgb);
        if ($dist < $minDistance) {
            $minDistance = $dist;
            $bestId      = $anchor['id'];
        }
    }

    return $bestId;
}

/**
 * Entry point: detecta la categoría de color de un template HTML completo.
 *
 * @param  string $htmlPath  Ruta absoluta al archivo .html del template
 * @param  array  $anchors   Array de anclas cargadas con loadColorAnchors()
 * @return string|null       Id de la categoría de color, o null si no se puede detectar
 */
function detectTemplateColorCategory(string $htmlPath, array $anchors): ?string
{
    if (!is_file($htmlPath) || empty($anchors)) {
        return null;
    }
    $html = @file_get_contents($htmlPath);
    if ($html === false) {
        return null;
    }
    $hex = extractBodyBackground($html);
    if ($hex === null) {
        return null;
    }
    return classifyColor($hex, $anchors);
}
