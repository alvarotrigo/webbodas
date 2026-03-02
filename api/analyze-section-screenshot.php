<?php
/**
 * API endpoint to analyze a section screenshot using OpenAI Vision API
 * Returns metadata JSON object based on the screenshot structure
 */

// Enable error reporting for debugging (disable in production)
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/../debug/php_errors.log');

// Load sections map
require_once __DIR__ . '/../config/sections-map.php';

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
 * Execute an OpenAI Vision API request and return the content + decoded response.
 *
 * @param string $apiKey
 * @param string $imageBase64 Base64 encoded image
 * @param int $imageId The ID from the filename
 * @param string|null $sectionHtml Optional HTML content for context
 * @param string $logContext
 * @return array{content:string, raw:array}
 * @throws RuntimeException
 */
function callOpenAIVision(string $apiKey, string $imageBase64, int $imageId, ?string $sectionHtml = null, string $logContext = 'OpenAI Vision API request'): array
{
    // Prepare HTML context if available
    $htmlContext = '';
    $htmlPreview = '';
    if ($sectionHtml) {
        // Truncate HTML if too long (keep first 5000 chars for context)
        $htmlPreview = mb_substr($sectionHtml, 0, 5000);
        $isTruncated = mb_strlen($sectionHtml) > 5000;
        if ($isTruncated) {
            $htmlPreview .= "\n... (truncated)";
        }
        // Escape the HTML for inclusion in the prompt
        $htmlEscaped = $htmlPreview;
    }
    
    $prompt = <<<PROMPT
You are given a screenshot of a section block from a website as well as its HTML content.

Your task: 
- Inspect the image and the HTML and output a single JSON object
- The object data have to be based on structure/layout, UI elements and the text copy of the given block.
- Pay special attention to buttons and CTAs, to know the purpose/aim of the block and its type (for the properties "section_role" and "category").
- “tags” should be short descriptive slugs used for filtering and semantic grouping. It must contain between **6 and 10** short slugs (kebab-case). Describing section type, layout, purpose,funnel position, style/tone, audience, visuals, media elements, etc
- “keywords” should be natural-language search phrases used for Fuse.js search. They must describe the purpose, visual structure, and typical use cases of the section. It must contain **3 to 6** natural-language phrases (5–10 words each)

Output rules:

- Output only JSON (no comments or prose).
- Use the schema below exactly (field names and allowed values).
- Use short, normalized enums; infer booleans and counts.
- Do not invent fields or include text content.
- The object items ID should be the numbers of the filename of each section.
- “tags” should be 1–3 word slugs in kebab-case.
- “keywords” should be short natural phrases (5–12 words each), 3–7 items max.

JSON item schema (per section)

{
  "id": {$imageId},                                  // number of the screenshot filename
  "category": "hero|features|testimonials|pricing|team|gallery|portfolio|contact|cta|faq|logos|stats|steps|content|nav|footer",
  "layout": "centered|split|stacked|grid|list|masonry|carousel|cards|media-left|media-right",
  "cols": 1,                                 // integer 1–6
  "elements": ["heading","subheading","paragraph","button","image","video","icon","avatar","rating","badge","logo","list","card","form","quote","author","role","illustration","logos"], 
  "media": "none|image|video|gallery|illustration",
  "media_position": "left|right|top|bottom|background|none",
  "cta": "none|one|two|multi",
  "align": "left|center|right|justified",
  "density": "minimal|regular|dense",
  "style": ["modern","clean","classic","elegant","playful","brutal","carded","flat","gradient","overlay","solid"], 
  "background": "color|image|video",
  "section_role": "intro|overview|highlight|social-proof|comparison|gallery|feature|features|contact|signup|newsletter|wait-list|login|trust|steps|showcase",
  "content_units": 0,                        // e.g., number of cards/testimonials/logos/faqs/features/pricing plans
  "has_quote": false,
  "has_rating": false,
  "has_avatars": false,
  "tags": [],
  "keywords": []
}
PROMPT;

    // Add HTML content if available
    if ($sectionHtml && !empty($htmlPreview)) {
        $prompt .= "\n\nHTML Content of the section to inspect:\n\n```html\n" . $htmlPreview . "\n```";
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
                    'content' => [
                        [
                            'type' => 'text',
                            'text' => $prompt
                        ],
                        [
                            'type' => 'image_url',
                            'image_url' => [
                                'url' => 'data:image/jpeg;base64,' . $imageBase64
                            ]
                        ]
                    ]
                ]
            ],
            'max_tokens' => 1000,
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
    
    if (!isset($input['image_id']) || !isset($input['image_base64'])) {
        http_response_code(400);
        echo json_encode([
            'error' => 'Missing required fields',
            'required' => ['image_id', 'image_base64']
        ]);
        exit();
    }

    $imageId = (int)$input['image_id'];
    $imageBase64 = $input['image_base64'];
    $sectionHtml = $input['section_html'] ?? null;
    
    // If section HTML not provided, try to load it from sections map
    if ($sectionHtml === null) {
        $sectionHtml = getSectionHtml($imageId);
    }

    // Validate image ID
    if ($imageId <= 0) {
        http_response_code(400);
        echo json_encode([
            'error' => 'Invalid image_id. Must be a positive integer.'
        ]);
        exit();
    }

    // Call OpenAI Vision API
    $response = callOpenAIVision(
        $openaiApiKey,
        $imageBase64,
        $imageId,
        $sectionHtml,
        "Section screenshot analysis for image {$imageId}"
    );
    
    $content = $response['content'];
    $prompt = $response['prompt'] ?? '';
    
    // Try to parse as JSON
    $metadata = json_decode($content, true);

    if (!is_array($metadata)) {
        error_log("Failed to parse metadata JSON: " . $content);
        http_response_code(500);
        echo json_encode([
            'error' => 'Failed to generate valid metadata',
            'raw_response' => $content
        ]);
        exit();
    }

    // Ensure ID matches
    $metadata['id'] = $imageId;

    // Return success response
    echo json_encode([
        'success' => true,
        'metadata' => $metadata,
        'prompt' => $prompt
    ]);
    
} catch (Exception $e) {
    error_log("Error in analyze-section-screenshot.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'error' => $e->getMessage()
    ]);
}

