<?php
/**
 * API endpoint to analyze website reference images using OpenAI Vision API
 * Returns a structured Style Brief for template generation
 */

// Enable error reporting for debugging (disable in production)
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/../debug/php_errors.log');

// Enable CORS for cross-origin requests
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Load environment variables from .env file
function loadEnv($path) {
    if (!file_exists($path)) {
        return false;
    }
    
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || strpos($line, '#') === 0 || strpos($line, '=') === false) {
            continue;
        }

        list($name, $value) = explode('=', $line, 2);
        $name = trim($name);
        $value = trim($value);
        
        if (!array_key_exists($name, $_SERVER) && !array_key_exists($name, $_ENV)) {
            putenv(sprintf('%s=%s', $name, $value));
            $_ENV[$name] = $value;
            $_SERVER[$name] = $value;
        }
    }
    return true;
}

// Try to load .env file from project root
$envPath = __DIR__ . '/../.env';
loadEnv($envPath);

// Get OpenAI API key from environment
$openaiApiKey = getenv('OPENAI_API_KEY') ?: $_ENV['OPENAI_API_KEY'] ?? '';

/**
 * Execute an OpenAI Chat API request to infer style from description only (no images).
 *
 * @param string $apiKey
 * @param string $description
 * @param string $logContext
 * @return array{content:string, raw:array}
 * @throws RuntimeException
 */
function callOpenAIForStyleFromDescription(string $apiKey, string $description, string $logContext = 'OpenAI style from description'): array
{
    // Load curated fonts list and shuffle it
    $curatedFontsPath = __DIR__ . '/../public/js/curated-fonts.json';
    $curatedFontsJson = '{}';
    if (file_exists($curatedFontsPath)) {
        $curatedFontsData = json_decode(file_get_contents($curatedFontsPath), true);

        // Shuffle the fonts to avoid position bias
        if (is_array($curatedFontsData)) {
            $fontNames = array_keys($curatedFontsData);
            shuffle($fontNames);
            $shuffledFonts = [];
            foreach ($fontNames as $fontName) {
                $shuffledFonts[$fontName] = $curatedFontsData[$fontName];
            }
            $curatedFontsJson = json_encode($shuffledFonts, JSON_PRETTY_PRINT);
        }
    }

    $prompt = <<<PROMPT
You are a design analysis expert. Based on the website description provided, infer an appropriate Style Brief.

Description: "$description"

Your task:
- Extract and use any SPECIFIC colors explicitly mentioned in the description (e.g., "orange accents", "blue theme", "dark backgrounds")
- If specific colors are mentioned, use them for the appropriate color variables (accents, backgrounds, text)
- If no specific colors are mentioned, infer appropriate colors that match the brand/product described
- Select appropriate fonts from the curated list that match the described style — use the "tags" on each font to find the best match for the brand personality
- Determine border radius, shadows, spacing patterns that fit the brand
- Determine overall mood and design aesthetic based on the description
- Suggest common section types that would fit this website

Available fonts (select ONLY from this list — each font has "weights" and "tags" to help you choose):
$curatedFontsJson

Output a JSON object following this exact schema:

{
  "colors": {
    "background_style": "light|dark|gradient",
    "primary_bg": "#ffffff",
    "secondary_bg": "#f4f4f7",
    "accent_bg": "#fafafa",
    "primary_text": "#222222",
    "secondary_text": "#777777",
    "accent_text": "#111111",
    "primary_accent": "#5046e6",
    "secondary_accent": "#3d31d9"
  },
  "typography": {
    "heading_style": "bold-sans|light-sans|serif|display|geometric|script|handwritten|condensed|slab",
    "body_style": "sans|serif|mono",
    "letter_spacing": "tight|normal|wide",
    "heading_font": {
      "family": "Poppins",
      "weights": [600, 700]
    },
    "body_font": {
      "family": "Inter",
      "weights": [400, 500]
    }
  },
  "shapes": {
    "border_radius": "sharp|rounded|pill",
    "border_radius_value": "0px|8px|16px|20px|999px",
    "button_radius": "sharp|rounded|pill",
    "button_radius_value": "0px|8px|30px|50px|999px",
    "card_radius": "sharp|rounded|pill",
    "card_radius_value": "0px|8px|12px|16px|20px|24px",
    "border_usage": "none|minimal|moderate|heavy",
    "border_color_hint": "transparent|subtle|visible"
  },
  "shadows": {
    "intensity": "none|subtle|moderate|prominent",
    "card_shadow": "none|subtle|moderate|heavy",
    "style": "flat|soft|elevated|layered"
  },
  "gradients": {
    "usage": "none|subtle|prominent",
    "style": "linear|radial|none",
    "direction": "135deg|180deg|90deg"
  },
  "spacing": {
    "density": "compact|regular|spacious",
    "spacing_unit_hint": "1rem|1.2rem|1.4rem|1.6rem"
  },
  "layout": {
    "alignment": "left|center|mixed",
    "hero_style": "centered|split|full-media"
  },
  "mood": ["modern", "minimal", "bold"],
  "detected_sections": ["hero centered", "features grid 3-col", "testimonials cards"]
}

Rules:
- Output ONLY valid JSON, no additional text
- All color values must be valid hex codes (#RRGGBB)
- Use exact enum values provided in the schema
- IMPORTANT: If the description mentions specific colors (e.g., "orange", "blue", "dark gray"), you MUST use those colors in your palette
  - Orange mentioned → use orange for primary-accent or secondary-accent
  - Blue mentioned → use blue for primary-accent or secondary-accent
  - Red mentioned → use red for primary-accent or secondary-accent
  - Dark backgrounds mentioned → use dark colors for primary-bg and secondary-bg
  - Light backgrounds mentioned → use light colors for primary-bg and secondary-bg
- Only infer/suggest colors when NO specific colors are mentioned in the description
- **CRITICAL CONTRAST RULES:**
  - **All text colors (primary_text, secondary_text, accent_text) MUST be readable on ALL background colors (primary_bg, secondary_bg, accent_bg)**
  - If backgrounds are LIGHT (white, light grey, pastels) → text colors MUST have LOW lightness values (be dark)
    - Can be dark grey, dark blue, dark purple, dark brown, navy, charcoal, etc.
    - ANY color is fine as long as it's dark enough to create contrast
  - If backgrounds are DARK (black, dark grey, dark blue) → text colors MUST have HIGH lightness values (be light)
    - Can be white, light grey, cream, light cyan, light yellow, etc.
    - ANY color is fine as long as it's light enough to create contrast
  - **Key principle: It's about LIGHTNESS/VALUE, not specific hex codes**
  - **NEVER use light text on light backgrounds or dark text on dark backgrounds**
  - Aim for ≥4.5:1 contrast ratio between all text and background combinations
  - secondary_text should be 40-60% lighter/darker than primary_text but still maintain ≥3:1 contrast
- For fonts: Select ONLY from the provided curated fonts list
  - Use each font's "tags" to match the brand personality
  - Choose DIFFERENT fonts for heading_font and body_font that complement each other (contrast in style, compatible in mood)
  - body_font must be readable (sans or serif only, NEVER script/handwritten)
  - Only select weights that exist in the font's "weights" array
  - Don't always default to Inter/Poppins — use the full range
- detected_sections should list 3-6 section types that would fit this website
- mood should be 2-4 descriptive words that match the brand/product

PROMPT;

    $ch = curl_init('https://api.openai.com/v1/chat/completions');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $apiKey
        ],
        CURLOPT_POSTFIELDS => json_encode([
            'model' => 'gpt-4o',
            'messages' => [
                [
                    'role' => 'user',
                    'content' => $prompt
                ]
            ],
            'max_tokens' => 1500,
            'temperature' => 0.5
        ])
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);

    if ($curlError) {
        error_log("$logContext cURL error: " . $curlError);
        throw new RuntimeException('Failed to connect to OpenAI API: ' . $curlError);
    }

    if ($httpCode !== 200) {
        error_log("$logContext HTTP error: " . $httpCode . " - " . $response);
        $details = json_decode($response, true);
        $encodedDetails = $details ? json_encode($details) : $response;
        throw new RuntimeException('OpenAI API returned an error: ' . $encodedDetails);
    }

    $decoded = json_decode($response, true);

    if (!isset($decoded['choices'][0]['message']['content'])) {
        error_log("$logContext invalid response: " . $response);
        throw new RuntimeException('Invalid response from OpenAI API');
    }

    $content = trim($decoded['choices'][0]['message']['content']);
    $content = preg_replace('/```json\s*/', '', $content);
    $content = preg_replace('/```\s*/', '', $content);
    $content = trim($content);

    return [
        'content' => $content,
        'raw' => $decoded,
        'prompt' => $prompt
    ];
}

/**
 * Execute an OpenAI Vision API request and return the content + decoded response.
 *
 * @param string $apiKey
 * @param array $images Array of base64 encoded images
 * @param string $logContext
 * @return array{content:string, raw:array}
 * @throws RuntimeException
 */
function callOpenAIVisionForStyle(string $apiKey, array $images, string $logContext = 'OpenAI Vision API request'): array
{
    // Load curated fonts list
    $curatedFontsPath = __DIR__ . '/../public/js/curated-fonts.json';
    $curatedFontsJson = '{}';
    if (file_exists($curatedFontsPath)) {
        $curatedFontsData = json_decode(file_get_contents($curatedFontsPath), true);

        // Shuffle the fonts to avoid position bias
        if (is_array($curatedFontsData)) {
            $fontNames = array_keys($curatedFontsData);
            shuffle($fontNames);
            $shuffledFonts = [];
            foreach ($fontNames as $fontName) {
                $shuffledFonts[$fontName] = $curatedFontsData[$fontName];
            }
            $curatedFontsJson = json_encode($shuffledFonts, JSON_PRETTY_PRINT);
        }
    }

    $prompt = <<<PROMPT
You are a design analysis expert. Analyze the provided website screenshot(s) and extract a comprehensive Style Brief.

Your task:
- Identify and extract the ACTUAL colors from the screenshot (backgrounds, text, accents)
- Detect typography style and select appropriate fonts from the curated list — use the "tags" on each font to find the closest match to what you see
- Analyze border radius, shadows, spacing patterns
- Determine overall mood and design aesthetic
- Identify common section types visible in the design

Available fonts (select ONLY from this list — each font has "weights" and "tags" to help you choose):
$curatedFontsJson

Output a JSON object following this exact schema:

{
  "colors": {
    "background_style": "light|dark|gradient",
    "primary_bg": "#ffffff",
    "secondary_bg": "#f4f4f7",
    "accent_bg": "#fafafa",
    "primary_text": "#222222",
    "secondary_text": "#777777",
    "accent_text": "#111111",
    "primary_accent": "#5046e6",
    "secondary_accent": "#3d31d9"
  },
  "typography": {
    "heading_style": "bold-sans|light-sans|serif|display|geometric|script|handwritten|condensed|slab",
    "body_style": "sans|serif|mono",
    "letter_spacing": "tight|normal|wide",
    "heading_font": {
      "family": "Poppins",
      "weights": [600, 700]
    },
    "body_font": {
      "family": "Inter",
      "weights": [400, 500]
    }
  },
  "shapes": {
    "border_radius": "sharp|rounded|pill",
    "border_radius_value": "0px|8px|16px|20px|999px",
    "button_radius": "sharp|rounded|pill",
    "button_radius_value": "0px|8px|30px|50px|999px",
    "card_radius": "sharp|rounded|pill",
    "card_radius_value": "0px|8px|12px|16px|20px|24px",
    "border_usage": "none|minimal|moderate|heavy",
    "border_color_hint": "transparent|subtle|visible"
  },
  "shadows": {
    "intensity": "none|subtle|moderate|prominent",
    "card_shadow": "none|subtle|moderate|heavy",
    "style": "flat|soft|elevated|layered"
  },
  "gradients": {
    "usage": "none|subtle|prominent",
    "style": "linear|radial|none",
    "direction": "135deg|180deg|90deg"
  },
  "spacing": {
    "density": "compact|regular|spacious",
    "spacing_unit_hint": "1rem|1.2rem|1.4rem|1.6rem"
  },
  "layout": {
    "alignment": "left|center|mixed",
    "hero_style": "centered|split|full-media"
  },
  "mood": ["modern", "minimal", "bold"],
  "detected_sections": ["hero centered", "features grid 3-col", "testimonials cards"]
}

Rules:
- Output ONLY valid JSON, no additional text
- All color values must be valid hex codes (#RRGGBB)
- Use exact enum values provided in the schema
- CRITICAL: Extract the ACTUAL colors visible in the screenshot
  - Do NOT infer or suggest generic colors
  - Use color picker/eyedropper logic - extract the exact hex colors you see
  - primary-accent should match the brand/CTA color in the screenshot
  - Backgrounds, text, and accent colors should all match what you observe
- **CRITICAL CONTRAST RULES:**
  - **All text colors (primary_text, secondary_text, accent_text) MUST be readable on ALL background colors (primary_bg, secondary_bg, accent_bg)**
  - If backgrounds are LIGHT (white, light grey, pastels) → text colors MUST have LOW lightness values (be dark)
    - Can be dark grey, dark blue, dark purple, dark brown, navy, charcoal, etc.
    - ANY color is fine as long as it's dark enough to create contrast
  - If backgrounds are DARK (black, dark grey, dark blue) → text colors MUST have HIGH lightness values (be light)
    - Can be white, light grey, cream, light cyan, light yellow, etc.
    - ANY color is fine as long as it's light enough to create contrast
  - **Key principle: It's about LIGHTNESS/VALUE, not specific hex codes**
  - **NEVER use light text on light backgrounds or dark text on dark backgrounds**
  - When extracting colors from the screenshot, verify that the text/background combinations are readable
  - Aim for ≥4.5:1 contrast ratio between all text and background combinations
- For fonts: Select ONLY from the provided curated fonts list
  - Use each font's "tags" to find the closest match to what you see in the screenshot
  - Choose DIFFERENT fonts for heading_font and body_font that complement each other (contrast in style, compatible in mood)
  - body_font must be readable (sans or serif only, NEVER script/handwritten)
  - Only select weights that exist in the font's "weights" array
- detected_sections should list 3-6 section types you can identify
- mood should be 2-4 descriptive words

PROMPT;

    // Build content array with text and image(s)
    $content = [
        [
            'type' => 'text',
            'text' => $prompt
        ]
    ];

    // Add all images
    foreach ($images as $imageBase64) {
        $content[] = [
            'type' => 'image_url',
            'image_url' => [
                'url' => 'data:image/jpeg;base64,' . $imageBase64,
                'detail' => 'high'
            ]
        ];
    }

    $ch = curl_init('https://api.openai.com/v1/chat/completions');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $apiKey
        ],
        CURLOPT_POSTFIELDS => json_encode([
            'model' => 'gpt-4o',
            'messages' => [
                [
                    'role' => 'user',
                    'content' => $content
                ]
            ],
            'max_tokens' => 1500,
            'temperature' => 0.3
        ])
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);

    if ($curlError) {
        error_log("$logContext cURL error: " . $curlError);
        throw new RuntimeException('Failed to connect to OpenAI API: ' . $curlError);
    }

    if ($httpCode !== 200) {
        error_log("$logContext HTTP error: " . $httpCode . " - " . $response);
        $details = json_decode($response, true);
        $encodedDetails = $details ? json_encode($details) : $response;
        throw new RuntimeException('OpenAI API returned an error: ' . $encodedDetails);
    }

    $decoded = json_decode($response, true);

    if (!isset($decoded['choices'][0]['message']['content'])) {
        error_log("$logContext invalid response: " . $response);
        throw new RuntimeException('Invalid response from OpenAI API');
    }

    $content = trim($decoded['choices'][0]['message']['content']);
    $content = preg_replace('/```json\s*/', '', $content);
    $content = preg_replace('/```\s*/', '', $content);
    $content = trim($content);

    return [
        'content' => $content,
        'raw' => $decoded,
        'prompt' => $prompt
    ];
}

if (empty($openaiApiKey)) {
    http_response_code(500);
    echo json_encode([
        'error' => 'OpenAI API key not configured. Please set OPENAI_API_KEY in .env file.'
    ]);
    exit();
}

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
        exit();
    }

    // Get JSON input
    $input = json_decode(file_get_contents('php://input'), true);

    // Check if we have images or just a description
    $hasImages = isset($input['images']) && is_array($input['images']) && !empty($input['images']);
    $hasDescription = isset($input['description']) && !empty(trim($input['description']));

    if (!$hasImages && !$hasDescription) {
        http_response_code(400);
        echo json_encode([
            'error' => 'Either images (array of base64 strings) or description (string) is required'
        ]);
        exit();
    }

    // Call appropriate API based on what we have
    if ($hasImages) {
        $images = $input['images'];

        // Validate image count (max 4 images)
        if (count($images) > 4) {
            http_response_code(400);
            echo json_encode([
                'error' => 'Maximum 4 images allowed'
            ]);
            exit();
        }

        // Call OpenAI Vision API
        $response = callOpenAIVisionForStyle(
            $openaiApiKey,
            $images,
            "Style reference analysis for " . count($images) . " image(s)"
        );
    } else {
        // No images - analyze from description only
        $description = trim($input['description']);

        $response = callOpenAIForStyleFromDescription(
            $openaiApiKey,
            $description,
            "Style inference from description"
        );
    }

    $content = $response['content'];
    $prompt = $response['prompt'] ?? '';
    
    // Try to parse as JSON
    $styleBrief = json_decode($content, true);

    if (!is_array($styleBrief)) {
        error_log("Failed to parse style brief JSON: " . $content);
        http_response_code(500);
        echo json_encode([
            'error' => 'Failed to generate valid style brief',
            'raw_response' => $content
        ]);
        exit();
    }

    // Validate required top-level keys
    $requiredKeys = ['colors', 'typography', 'shapes', 'shadows', 'gradients', 'spacing', 'layout', 'mood', 'detected_sections'];
    $missingKeys = [];
    foreach ($requiredKeys as $key) {
        if (!isset($styleBrief[$key])) {
            $missingKeys[] = $key;
        }
    }

    if (!empty($missingKeys)) {
        error_log("Style brief missing keys: " . implode(', ', $missingKeys));
        http_response_code(500);
        echo json_encode([
            'error' => 'Style brief missing required keys: ' . implode(', ', $missingKeys),
            'raw_response' => $content
        ]);
        exit();
    }

    // Return success response
    echo json_encode([
        'success' => true,
        'style_brief' => $styleBrief,
        'prompt' => $prompt
    ]);
    
} catch (Exception $e) {
    error_log("Error in analyze-style-reference.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'error' => $e->getMessage()
    ]);
}
