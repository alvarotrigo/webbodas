<?php
/**
 * Template Generator API
 * Generates complete landing page templates from description + Style Brief
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

// Section blueprints for content hints
function getSectionBlueprint($category) {
    static $BLUEPRINTS = [
        "hero" => "Hero section — introduce the brand or product with a clear value proposition and an action-driven headline.",
        "features" => "Features section — list the main benefits or features clearly, emphasizing user value and simplicity.",
        "testimonials" => "Testimonials section — add authentic-sounding quotes or stories that build trust and credibility.",
        "pricing" => "Pricing section — explain available plans or options transparently and motivate conversion.",
        "team" => "Team section — present key people with short bios that highlight expertise and human connection.",
        "gallery" => "Gallery section — describe or caption images in a way that supports storytelling or visual appeal.",
        "portfolio" => "Portfolio section — showcase selected work or projects, focusing on outcomes and quality.",
        "contact" => "Contact section — invite users to reach out, book, or connect in a friendly, encouraging tone.",
        "forms" => "Form section — introduce a form briefly, explaining what users get by submitting it.",
        "about" => "About section — explain who the brand or person is, their mission, and what makes them unique.",
        "faqs" => "FAQ section — answer frequent questions clearly and concisely to remove friction or hesitation.",
        "how it works" => "How-it-works section — explain the process in simple, step-by-step terms.",
        "stats" => "Stats section — present metrics or achievements that demonstrate credibility or success.",
        "cta" => "CTA section — end with a strong, motivational call-to-action tied to the main goal.",
        "footer" => "Footer section — include closing navigation, contact info, and reassurance about trust or brand identity."
    ];

    $key = strtolower(trim($category));
    return $BLUEPRINTS[$key] ?? null;
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
 * Execute an OpenAI Chat Completions request
 */
function callOpenAIChat(string $apiKey, array $payload, string $logContext = 'OpenAI API request'): array
{
    $ch = curl_init('https://api.openai.com/v1/chat/completions');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $apiKey
        ],
        CURLOPT_POSTFIELDS => json_encode($payload)
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
        'raw' => $decoded
    ];
}

/**
 * Convert hex to rgba
 */
function hexToRgba($hex, $alpha = 1) {
    $hex = ltrim($hex, '#');
    
    if (strlen($hex) === 3) {
        $hex = $hex[0] . $hex[0] . $hex[1] . $hex[1] . $hex[2] . $hex[2];
    }
    
    $r = hexdec(substr($hex, 0, 2));
    $g = hexdec(substr($hex, 2, 2));
    $b = hexdec(substr($hex, 4, 2));
    
    return "rgba($r, $g, $b, $alpha)";
}

/**
 * Build Google Fonts URL from fonts object
 */
function buildGoogleFontsUrl($fonts) {
    $families = [];
    
    if (!empty($fonts['heading']['family']) && !empty($fonts['heading']['weights'])) {
        $family = $fonts['heading']['family'];
        $weights = implode(';', $fonts['heading']['weights']);
        $families[] = urlencode($family) . ':wght@' . $weights;
    }
    
    if (!empty($fonts['body']['family']) && !empty($fonts['body']['weights'])) {
        $bodyFamily = $fonts['body']['family'];
        // Only add body font if it's different from heading font
        if (empty($fonts['heading']['family']) || $bodyFamily !== $fonts['heading']['family']) {
            $weights = implode(';', $fonts['body']['weights']);
            $families[] = urlencode($bodyFamily) . ':wght@' . $weights;
        }
    }
    
    if (empty($families)) {
        return '';
    }
    
    return 'https://fonts.googleapis.com/css2?family=' . implode('&family=', $families) . '&display=swap';
}

/**
 * Map Style Brief to complete CSS theme variables
 */
function mapStyleBriefToTheme($styleBrief, $themeName) {
    $colors = $styleBrief['colors'] ?? [];
    $shapes = $styleBrief['shapes'] ?? [];
    $shadows = $styleBrief['shadows'] ?? [];
    $gradients = $styleBrief['gradients'] ?? [];
    $spacing = $styleBrief['spacing'] ?? [];
    $typography = $styleBrief['typography'] ?? [];
    
    // Map shadow intensity to preset values
    $shadowIntensity = $shadows['intensity'] ?? 'subtle';
    $shadowPresets = [
        'none' => [
            'sm' => 'none',
            'md' => 'none',
            'lg' => 'none',
            'card' => 'none',
            'card-hover' => 'none'
        ],
        'subtle' => [
            'sm' => '0 1px 2px rgba(0, 0, 0, 0.05)',
            'md' => '0 4px 6px rgba(0, 0, 0, 0.07)',
            'lg' => '0 10px 15px rgba(0, 0, 0, 0.1)',
            'card' => '0 2px 8px rgba(0, 0, 0, 0.06)',
            'card-hover' => '0 8px 25px rgba(0, 0, 0, 0.12)'
        ],
        'moderate' => [
            'sm' => '0 2px 4px rgba(0, 0, 0, 0.08)',
            'md' => '0 6px 12px rgba(0, 0, 0, 0.12)',
            'lg' => '0 15px 25px rgba(0, 0, 0, 0.15)',
            'card' => '0 4px 12px rgba(0, 0, 0, 0.1)',
            'card-hover' => '0 12px 30px rgba(0, 0, 0, 0.15)'
        ],
        'prominent' => [
            'sm' => '0 4px 6px rgba(0, 0, 0, 0.1)',
            'md' => '0 10px 20px rgba(0, 0, 0, 0.15)',
            'lg' => '0 25px 50px rgba(0, 0, 0, 0.2)',
            'card' => '0 8px 24px rgba(0, 0, 0, 0.15)',
            'card-hover' => '0 16px 40px rgba(0, 0, 0, 0.2)'
        ]
    ];
    
    $currentShadows = $shadowPresets[$shadowIntensity] ?? $shadowPresets['subtle'];
    
    // Map border radius values (fallback when AI doesn't provide specific pixel values)
    $radiusMap = [
        'sharp' => ['general' => '4px', 'button' => '4px', 'card' => '8px'],
        'rounded' => ['general' => '16px', 'button' => '8px', 'card' => '16px'],
        'pill' => ['general' => '50px', 'button' => '50px', 'card' => '24px']
    ];

    $borderRadiusStyle = $shapes['border_radius'] ?? 'rounded';
    $radiusValues = $radiusMap[$borderRadiusStyle] ?? $radiusMap['rounded'];

    // Prefer AI-provided pixel values when available
    if (!empty($shapes['border_radius_value'])) {
        $radiusValues['general'] = $shapes['border_radius_value'];
    }
    if (!empty($shapes['button_radius_value'])) {
        $radiusValues['button'] = $shapes['button_radius_value'];
    }
    if (!empty($shapes['card_radius_value'])) {
        $radiusValues['card'] = $shapes['card_radius_value'];
    }
    
    // Build gradient values
    $primaryAccent = $colors['primary_accent'] ?? '#5046e6';
    $secondaryAccent = $colors['secondary_accent'] ?? '#3d31d9';
    $secondaryBg = $colors['secondary_bg'] ?? '#f4f4f7';
    $accentBg = $colors['accent_bg'] ?? '#fafafa';
    
    $gradientDirection = $gradients['direction'] ?? '135deg';
    
    // Font family - build from heading_font and body_font
    $headingFont = $typography['heading_font']['family'] ?? 'Inter';
    $bodyFont = $typography['body_font']['family'] ?? 'Inter';
    
    // Create font-family string with both fonts
    $fontFamily = "'" . $headingFont . "', '" . $bodyFont . "', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    $headingFontFamily = "'" . $headingFont . "', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    
    // Spacing unit
    $spacingUnit = $spacing['spacing_unit_hint'] ?? '1.4rem';
    
    // Border color
    $borderColorHint = $shapes['border_color_hint'] ?? 'transparent';
    $borderColor = 'transparent';
    if ($borderColorHint === 'subtle') {
        $borderColor = 'rgba(0, 0, 0, 0.1)';
    } elseif ($borderColorHint === 'visible') {
        $borderColor = 'rgba(0, 0, 0, 0.15)';
    }
    
    return [
        'name' => $themeName,
        'variables' => [
            // Backgrounds
            'primary-bg' => $colors['primary_bg'] ?? '#ffffff',
            'secondary-bg' => $secondaryBg,
            'accent-bg' => $accentBg,
            
            // Text
            'primary-text' => $colors['primary_text'] ?? '#222222',
            'secondary-text' => $colors['secondary_text'] ?? '#777777',
            'accent-text' => $colors['accent_text'] ?? '#111111',
            
            // Accents
            'primary-accent' => $primaryAccent,
            'primary-accent-soft' => hexToRgba($primaryAccent, 0.1),
            'secondary-accent' => $secondaryAccent,
            
            // Borders
            'border-color' => $borderColor,
            
            // Shadows
            'shadow-color' => 'rgba(0, 0, 0, 0.05)',
            'shadow-sm' => $currentShadows['sm'],
            'shadow-md' => $currentShadows['md'],
            'shadow-lg' => $currentShadows['lg'],
            'card-shadow' => $currentShadows['card'],
            'card-shadow-hover' => $currentShadows['card-hover'],
            
            // Gradients
            'gradient-1' => "linear-gradient($gradientDirection, $secondaryBg 0%, $accentBg 100%)",
            'gradient-2' => "linear-gradient($gradientDirection, $primaryAccent 0%, $secondaryAccent 100%)",
            'features2-bg' => "linear-gradient($gradientDirection, $primaryAccent 0%, $secondaryAccent 100%)",
            
            // Buttons on gradient
            'button-on-gradient' => '#ffffff',
            'button-on-gradient-border' => 'rgba(255, 255, 255, 0.8)',
            
            // Typography
            'font-family' => $fontFamily,
            'heading-font' => $headingFontFamily,
            
            // Border radius
            'border-radius' => $radiusValues['general'],
            'button-radius' => $radiusValues['button'],
            'card-radius' => $radiusValues['card'],
            
            // Spacing
            'spacing-unit' => $spacingUnit
        ]
    ];
}

/**
 * Extract image contexts from HTML - finds each img tag and its surrounding text
 * @param string $html - HTML content
 * @return array Array of image contexts with src, alt, and surrounding text
 */
function extractImageContexts($html) {
    $contexts = [];
    
    // Use DOMDocument to parse HTML
    $dom = new DOMDocument();
    @$dom->loadHTML('<?xml encoding="UTF-8">' . $html, LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
    
    $images = $dom->getElementsByTagName('img');
    
    foreach ($images as $img) {
        $src = $img->getAttribute('src');
        $alt = $img->getAttribute('alt');
        
        // Find parent container (div, card, etc.)
        $parent = $img->parentNode;
        $textContext = '';
        
        // Traverse up to find a semantic container
        $maxLevelsUp = 3;
        $currentLevel = 0;
        $contextNode = $parent;
        
        while ($contextNode && $currentLevel < $maxLevelsUp) {
            // Look for headings and paragraphs in this container
            if ($contextNode->nodeType === XML_ELEMENT_NODE) {
                $xpath = new DOMXPath($dom);
                $textNodes = $xpath->query('.//h1 | .//h2 | .//h3 | .//h4 | .//h5 | .//h6 | .//p', $contextNode);
                
                if ($textNodes->length > 0) {
                    $texts = [];
                    foreach ($textNodes as $textNode) {
                        $text = trim($textNode->textContent);
                        if (!empty($text) && strlen($text) > 3) {
                            $texts[] = $text;
                        }
                    }
                    if (!empty($texts)) {
                        $textContext = implode('. ', array_slice($texts, 0, 3)); // Max 3 text elements
                        break;
                    }
                }
            }
            
            $contextNode = $contextNode->parentNode;
            $currentLevel++;
        }
        
        $contexts[] = [
            'src' => $src,
            'alt' => $alt,
            'text_context' => $textContext
        ];
    }
    
    return $contexts;
}

/**
 * Generate inline image keywords using OpenAI
 * @param string $apiKey - OpenAI API key
 * @param int $sectionId - Section ID
 * @param string $category - Section category
 * @param array $sitePlan - Site plan data
 * @param string $description - Template description
 * @param array $imageContexts - Array of image contexts
 * @return array Array of keyword arrays
 */
function generateInlineImageKeywords($apiKey, $sectionId, $category, $sitePlan, $description, $imageContexts) {
    $imageCount = count($imageContexts);
    
    // Build context descriptions for each image
    $contextDescriptions = [];
    foreach ($imageContexts as $index => $context) {
        $contextText = $context['text_context'] ?? '';
        $alt = $context['alt'] ?? '';
        
        $desc = "Image " . ($index + 1) . ":";
        if (!empty($alt)) {
            $desc .= " Alt text: \"$alt\".";
        }
        if (!empty($contextText)) {
            $desc .= " Context: \"$contextText\".";
        }
        $contextDescriptions[] = $desc;
    }
    
    $contextList = implode("\n", $contextDescriptions);
    
    $businessType = $sitePlan['business_type'] ?? 'website';
    $audience = $sitePlan['audience'] ?? 'general audience';
    $tone = $sitePlan['content_tone'] ?? 'professional';
    
    $prompt = "You are an expert at generating Unsplash image search keywords.

Context:
- Website type: $businessType
- Target audience: $audience  
- Tone: $tone
- Description: $description
- Section type: $category
- Number of images: $imageCount

Image contexts with their surrounding text:
$contextList

For each image, generate 2-4 specific Unsplash search keywords that will find the perfect stock photo based on:
1. The text context around the image (what it's describing)
2. The section category and overall website purpose
3. The target audience and tone

Return ONLY a JSON array of arrays:
[
  [\"keyword1\", \"keyword2\", \"keyword3\"],
  [\"keyword4\", \"keyword5\"],
  ...
]

Make keywords specific and visual. For example:
- Team sections: \"professional portrait\", \"business headshot\", \"confident smile\"
- Features: match the specific feature being described
- Galleries: contextual to the content type

Output only the JSON array, no explanatory text.";

    try {
        $response = callOpenAIChat(
            $apiKey,
            [
                'model' => 'gpt-4o-mini',
                'messages' => [['role' => 'user', 'content' => $prompt]],
                'temperature' => 0.7,
                'max_tokens' => 400
            ],
            'Inline image keywords generation'
        );
        
        $content = $response['content'];
        $keywords = json_decode($content, true);
        
        if (!is_array($keywords) || empty($keywords)) {
            error_log("Failed to parse inline image keywords for section $sectionId: " . $content);
            return [];
        }
        
        return $keywords;
        
    } catch (Exception $e) {
        error_log("Error generating inline image keywords for section $sectionId: " . $e->getMessage());
        return [];
    }
}

if (empty($openaiApiKey)) {
    http_response_code(500);
    echo json_encode([
        'error' => 'OpenAI API key not configured. Please set OPENAI_API_KEY in .env file.'
    ]);
    exit();
}

// Load section metadata - using described version for better AI understanding
$metadataPath = __DIR__ . '/../public/js/metadata-described.min.js';
if (!file_exists($metadataPath)) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Section metadata file not found'
    ]);
    exit();
}

$metadataContent = file_get_contents($metadataPath);
$metadata = json_decode(trim($metadataContent), true);

if (!$metadata || !is_array($metadata)) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Invalid metadata format'
    ]);
    exit();
}

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
        exit();
    }
    
    $input = json_decode(file_get_contents('php://input'), true);

    // Initialize debug log
    $debugLogPath = __DIR__ . '/../templates-creation/ai-generation-debug.log';
    $timestamp = date('Y-m-d H:i:s');
    $debugLog = "\n========================================\n";
    $debugLog .= "Template Generation Debug - $timestamp\n";
    $debugLog .= "========================================\n\n";

    if (!isset($input['description']) || empty(trim($input['description']))) {
        http_response_code(400);
        echo json_encode(['error' => 'Description is required']);
        exit();
    }
    
    if (!isset($input['style_brief']) || !is_array($input['style_brief'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Style brief is required']);
        exit();
    }
    
    $description = trim($input['description']);
    $styleBrief = $input['style_brief'];
    $feedback = isset($input['feedback']) && !empty(trim($input['feedback'])) ? trim($input['feedback']) : null;
    $includeHiddenSections = isset($input['include_hidden_sections']) && $input['include_hidden_sections'] === true;

    $styleBriefJson = json_encode($styleBrief, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

    // Log user input
    $debugLog .= "USER INPUT:\n";
    $debugLog .= "Description: " . substr($description, 0, 200) . (strlen($description) > 200 ? "..." : "") . "\n";
    $debugLog .= "Include hidden sections: " . ($includeHiddenSections ? 'yes' : 'no') . "\n";
    if ($feedback) {
        $debugLog .= "Feedback: $feedback\n";
    }
    $debugLog .= "\n";

    // Filter out hidden sections unless explicitly included, and exclude section 75
    $filteredMetadata = [];
    $hiddenCount = 0;
    $excludedSection75 = false;
    foreach ($metadata as $item) {
        // Exclude section 75 from AI template generation
        if (isset($item['id']) && $item['id'] === 75) {
            $excludedSection75 = true;
            continue;
        }

        $isHidden = isset($item['hidden']) && $item['hidden'] === true;
        if ($isHidden && !$includeHiddenSections) {
            $hiddenCount++;
            continue;
        }
        $filteredMetadata[] = $item;
    }
    $metadata = $filteredMetadata;

    error_log("Sections filtering: " . count($metadata) . " sections available, " . $hiddenCount . " hidden sections excluded" . ($excludedSection75 ? ", section 75 excluded" : "") . " (include_hidden_sections=" . ($includeHiddenSections ? 'true' : 'false') . ")");

    // ========================================
    // STEP 0: Extract Site Plan
    // ========================================
    
    $sitePlanPrompt = "You are a website strategist. Analyze this description to extract a strategic site plan.

User description: " . $description . "

Style Brief (from reference images):
" . $styleBriefJson;

    if ($feedback) {
        $sitePlanPrompt .= "\n\nUser feedback for retry: " . $feedback;
    }

    $sitePlanPrompt .= "

Extract and return ONLY a JSON object with these fields:

{
  \"audience\": \"target audience description (2-6 words)\",
  \"primary_goal\": \"main conversion goal (e.g., 'sign up for trial', 'book consultation', 'purchase product')\",
  \"brand_vibe\": [\"3-5 keywords describing brand personality\"],
  \"content_tone\": \"writing style (e.g., 'professional and trustworthy', 'playful and energetic')\",
  \"key_differentiators\": [\"2-4 unique selling points or features\"],
  \"business_type\": \"category (e.g., 'saas', 'ecommerce', 'agency', 'restaurant', 'local_business', 'portfolio')\"
}

Return ONLY the JSON object, no explanatory text.";

    $sitePlanResponse = callOpenAIChat(
        $openaiApiKey,
        [
            'model' => 'gpt-4o-mini',
            'messages' => [['role' => 'user', 'content' => $sitePlanPrompt]],
            'temperature' => 0.5,
            'max_tokens' => 400
        ],
        'Site plan extraction'
    );

    $sitePlanJson = $sitePlanResponse['content'];
    $sitePlan = json_decode($sitePlanJson, true);

    if (!is_array($sitePlan)) {
        error_log("Failed to parse site plan, using defaults: " . $sitePlanJson);
        $sitePlan = [
            'audience' => 'general audience',
            'primary_goal' => 'learn more',
            'brand_vibe' => ['modern', 'clean'],
            'content_tone' => 'professional and approachable',
            'key_differentiators' => [],
            'business_type' => 'general'
        ];
    }

    error_log("Site Plan: " . json_encode($sitePlan));

    // Log site plan
    $debugLog .= "STEP 0 - SITE PLAN EXTRACTION:\n";
    $debugLog .= json_encode($sitePlan, JSON_PRETTY_PRINT) . "\n\n";
    
    // ========================================
    // STEP 1: Determine ideal page structure
    // ========================================
    
    // Extract detected_sections from style brief if available
    $detectedSections = $styleBrief['detected_sections'] ?? [];
    $detectedSectionsText = '';
    if (!empty($detectedSections)) {
        $detectedSectionsText = "\n\nDetected sections from reference images:\n- " . implode("\n- ", $detectedSections);
    }

    $structurePrompt = "You are a website structure architect. Your job is to determine the optimal landing page structure from the user's description and context.

CRITICAL RULE: If the user's description specifies a structure, section list, or page outline, you MUST include ALL of those sections. The user knows what they want — respect their intent fully. Map each user-requested section to the closest available category below.

User description: " . $description . "

Site Plan:
" . json_encode($sitePlan, JSON_PRETTY_PRINT) . "

Style Brief (from reference images):
" . $styleBriefJson . $detectedSectionsText;

    if ($feedback) {
        $structurePrompt .= "\n\nUser feedback for retry: " . $feedback;
    }

    $structurePrompt .= "

Available section tags (use EXACTLY these names):
- hero: introduce the brand/product with value proposition
- features: list main benefits or features (also use for \"services\")
- testimonial: customer quotes and social proof (singular, not \"testimonials\")
- pricing: pricing plans or options
- team: team members with bios
- gallery: image gallery or portfolio
- portfolio: showcase work or projects
- contact: contact information or form
- content: about section, brand story, mission, or general informational content (use for \"about\")
- faqs: frequently asked questions
- how_it_works: step-by-step process explanation (underscore, use for \"how it works\")
- stats: metrics and achievements (also tagged as \"numbers\")
- cta: call-to-action section
- footer: closing navigation and contact info
- blog: blog posts or articles preview
- logos: partner/client/trust logos
- newsletter: newsletter signup (also tagged as \"subscribe\")
- integrations: tool/service integrations
- comparison: feature or plan comparison
- events: upcoming or past events
- form: forms and signups
- video: video content
- media: media and images

Your task:
1. FIRST: Check if the user's description contains a structure, section list, or page outline. If yes, include ALL of those sections by mapping them to the available categories above.
2. Analyze the primary_goal and audience from the site plan
3. Consider the business_type when selecting sections
4. If detected_sections are provided from reference images, use them as additional guidance
5. Add any additional sections that would make the page more complete and professional
6. Define the logical flow and order

Rules:
- ALWAYS start with 'hero'
- Each category should appear ONLY ONCE (no duplicates)
- ALWAYS end with 'footer'
- You MUST include at least 7 sections. Real professional landing pages have 8-12 sections. More sections = more complete page. Only use fewer than 7 if the user explicitly asked for a minimal/short page.
- If the user listed specific sections in their description, you MUST include ALL of them — do not drop any
- Return ONLY a JSON array of category names in order

Example: For a SaaS product, a good structure would be:
[\"hero\", \"features\", \"how_it_works\", \"testimonial\", \"pricing\", \"stats\", \"faqs\", \"content\", \"cta\", \"footer\"]

Return the JSON array of section categories:";

    // Call OpenAI to determine structure
    $structureResponse = callOpenAIChat(
        $openaiApiKey,
        [
            'model' => 'gpt-4o',
            'messages' => [
                ['role' => 'user', 'content' => $structurePrompt]
            ],
            'temperature' => 0.7,
            'max_tokens' => 500
        ],
        'Structure determination'
    );
    
    $structureContent = $structureResponse['content'];
    $desiredCategories = json_decode($structureContent, true);

    // Log raw AI response for structure
    $debugLog .= "STEP 1 - STRUCTURE DETERMINATION:\n";
    $debugLog .= "AI Raw Response:\n" . $structureContent . "\n\n";

    if (!is_array($desiredCategories) || empty($desiredCategories)) {
        $debugLog .= "ERROR: Could not parse structure from AI response\n\n";
        file_put_contents($debugLogPath, $debugLog, FILE_APPEND);
        throw new RuntimeException('Could not parse structure from AI response: ' . $structureContent);
    }

    // Log the desired structure for debugging
    $debugLog .= "Parsed Categories (" . count($desiredCategories) . " sections):\n";
    $debugLog .= json_encode($desiredCategories, JSON_PRETTY_PRINT) . "\n\n";

    if (count($desiredCategories) < 7) {
        $debugLog .= "⚠️  WARNING: AI returned only " . count($desiredCategories) . " sections, expected at least 7\n";
        $debugLog .= "Prompt said: 'You MUST include at least 7 sections'\n\n";
    }

    error_log("Desired page structure (" . count($desiredCategories) . " sections): " . json_encode($desiredCategories));

    if (count($desiredCategories) < 5) {
        error_log("WARNING: AI returned only " . count($desiredCategories) . " sections, expected at least 5");
    }

    // ========================================
    // STEP 2: Match structure to specific section IDs
    // ========================================

    // Tag alias map: common AI-returned names → actual metadata tag names
    $tagAliases = [
        'about' => 'content',
        'services' => 'features',
        'testimonials' => 'testimonial',
        'how it works' => 'how_it_works',
        'how-it-works' => 'how_it_works',
        'logo clouds' => 'logos',
        'logo-clouds' => 'logos',
        'numbers' => 'stats',
        'subscribe' => 'newsletter',
        'sign-up' => 'form',
        'signup' => 'form',
    ];

    // Group metadata by tags (sections can have multiple tags)
    $metadataByTag = [];
    foreach ($metadata as $item) {
        $tags = $item['tags'] ?? [];
        foreach ($tags as $tag) {
            $tagKey = strtolower(trim($tag));
            $metadataByTag[$tagKey][] = $item;
        }
    }

    // Shuffle each tag group for diversity
    foreach ($metadataByTag as $tag => &$items) {
        shuffle($items);
    }
    unset($items);

    // Build per-tag candidate list showing only relevant sections
    $candidateBlocks = [];
    $usedSections = []; // Track which sections we've already used to avoid duplicates

    foreach ($desiredCategories as $desiredTag) {
        $tagKey = strtolower(trim($desiredTag));

        // Resolve aliases to actual metadata tag names
        if (isset($tagAliases[$tagKey])) {
            $resolvedTag = $tagAliases[$tagKey];
            error_log("Tag alias resolved: '$tagKey' → '$resolvedTag'");
            $tagKey = $resolvedTag;
        }

        $candidates = $metadataByTag[$tagKey] ?? [];

        // Filter out already-used sections
        $candidates = array_filter($candidates, function($item) use ($usedSections) {
            return !in_array($item['id'], $usedSections);
        });

        if (empty($candidates)) {
            error_log("WARNING: No sections found for tag '$tagKey' (from AI: '$desiredTag') — skipping");
            continue;
        }

        $lines = [];
        foreach ($candidates as $item) {
            // Use the description field from metadata-described.min.js
            $sectionDescription = $item['description'] ?? 'No description available';
            $name = $item['name'] ?? 'Section ' . $item['id'];
            $lines[] = '  - ID ' . $item['id'] . ' (' . $name . '): ' . substr($sectionDescription, 0, 120) . '...';
        }
        $candidateBlocks[] = strtoupper($desiredTag) . " (pick 1):\n" . implode("\n", $lines);

        // Mark these candidates as available for this tag (will track used ones after AI picks)
    }
    $candidatesText = implode("\n\n", $candidateBlocks);

    $matchingPrompt = "You are a section matcher. For each tag below, pick the ONE section ID that best matches the visual description and website context.

Website description: " . $description . "

Style Brief:
" . $styleBriefJson . "

Site Plan:
" . json_encode($sitePlan, JSON_PRETTY_PRINT) . "

For each tag, read the visual descriptions and pick the section that best fits the website's purpose, style, and content needs.

" . $candidatesText . "

DIVERSITY RULES (MUST follow):
1. Visual variety: Avoid picking similar layouts back-to-back (e.g., don't put two \"centered\" layouts in a row)
2. Element diversity: Vary the visual elements (cards, grids, split layouts, images, forms, etc.)
3. Density contrast: Alternate between minimal/spacious sections and content-rich sections

Rules:
1. Return ONLY a JSON array of section IDs in the same order as the tags above: [ID, ID, ...]
2. Pick exactly ONE section per tag
3. Base your decision on the visual description, not just the section name
4. NO explanatory text, ONLY the JSON array

Return the JSON array of section IDs:";

    // Call OpenAI to match section IDs
    $matchingResponse = callOpenAIChat(
        $openaiApiKey,
        [
            'model' => 'gpt-4o',
            'messages' => [
                ['role' => 'user', 'content' => $matchingPrompt]
            ],
            'temperature' => 0.85,
            'max_tokens' => 300
        ],
        'Section ID matching'
    );
    
    $matchingContent = $matchingResponse['content'];

    // Log raw AI response for matching
    $debugLog .= "STEP 2 - SECTION ID MATCHING:\n";
    $debugLog .= "AI Raw Response:\n" . $matchingContent . "\n\n";

    $sectionIds = json_decode($matchingContent, true);

    if (!is_array($sectionIds) || empty($sectionIds)) {
        $debugLog .= "JSON parse failed, trying to extract numbers...\n";
        // Try to extract numbers
        preg_match_all('/\d+/', $matchingContent, $matches);
        if (!empty($matches[0])) {
            $sectionIds = array_map('intval', $matches[0]);
            $debugLog .= "Extracted section IDs: " . json_encode($sectionIds) . "\n\n";
        } else {
            $debugLog .= "ERROR: Could not extract section IDs from response\n\n";
            file_put_contents($debugLogPath, $debugLog, FILE_APPEND);
            throw new RuntimeException('Could not parse section IDs from AI response: ' . $matchingContent);
        }
    } else {
        $debugLog .= "Parsed Section IDs (" . count($sectionIds) . " sections):\n";
        $debugLog .= json_encode($sectionIds, JSON_PRETTY_PRINT) . "\n\n";
    }
    
    // Validate section IDs
    $validSectionIds = [];
    $invalidSectionIds = [];
    $availableIds = array_column($metadata, 'id');

    $debugLog .= "VALIDATION:\n";
    $debugLog .= "Available section IDs in metadata: " . count($availableIds) . " sections\n";

    foreach ($sectionIds as $id) {
        $id = (int)$id;
        if (in_array($id, $availableIds)) {
            $validSectionIds[] = $id;
        } else {
            $invalidSectionIds[] = $id;
        }
    }

    if (!empty($invalidSectionIds)) {
        $debugLog .= "⚠️  Invalid section IDs (not in metadata): " . json_encode($invalidSectionIds) . "\n";
    }

    $debugLog .= "Valid section IDs: " . json_encode($validSectionIds) . "\n";
    $debugLog .= "Final count: " . count($validSectionIds) . " sections\n\n";

    if (empty($validSectionIds)) {
        $debugLog .= "ERROR: No valid section IDs found\n\n";
        file_put_contents($debugLogPath, $debugLog, FILE_APPEND);
        throw new RuntimeException('No valid section IDs found in AI response');
    }
    
    // Log selected sections with their tags
    $selectedSections = [];
    foreach ($validSectionIds as $id) {
        $sectionMeta = null;
        foreach ($metadata as $item) {
            if ($item['id'] === $id) {
                $sectionMeta = $item;
                break;
            }
        }
        if ($sectionMeta) {
            $tags = $sectionMeta['tags'] ?? [];
            $selectedSections[] = [
                'id' => $id,
                'name' => $sectionMeta['name'] ?? 'Section ' . $id,
                'tags' => $tags
            ];
        }
    }

    error_log("Selected section IDs: " . json_encode($validSectionIds));
    error_log("Selected sections: " . json_encode($selectedSections));

    // Log final section mapping
    $debugLog .= "FINAL SECTION MAPPING:\n";
    foreach ($validSectionIds as $id) {
        $sectionMeta = null;
        foreach ($metadata as $item) {
            if ($item['id'] === $id) {
                $sectionMeta = $item;
                break;
            }
        }
        if ($sectionMeta) {
            $tags = $sectionMeta['tags'] ?? [];
            $debugLog .= "  - ID $id: {$sectionMeta['name']} (tags: " . implode(", ", $tags) . ")\n";
        }
    }
    $debugLog .= "\n";

    // Compare with user's requested structure if present
    if (preg_match('/Structure:|section list:|page outline:/i', $description)) {
        $debugLog .= "NOTE: User description contains explicit structure/section list.\n";
        $debugLog .= "Check if AI respected the CRITICAL RULE to include ALL requested sections.\n\n";
    }

    // Write debug log
    file_put_contents($debugLogPath, $debugLog, FILE_APPEND);
    
    // Generate theme name and template ID
    $themeNamePrompt = "Based on this description: \"$description\", generate a short, descriptive theme name (max 4 words). Output only the name, no quotes or extra text.";
    
    $themeNameResponse = callOpenAIChat(
        $openaiApiKey,
        [
            'model' => 'gpt-4o-mini',
            'messages' => [['role' => 'user', 'content' => $themeNamePrompt]],
            'temperature' => 0.8,
            'max_tokens' => 20
        ],
        'Theme name generation'
    );
    
    $themeName = trim($themeNameResponse['content']);
    $themeName = trim($themeName, '"\'');
    
    // Limit to 4 words
    $themeWords = explode(' ', $themeName);
    if (count($themeWords) > 4) {
        $themeName = implode(' ', array_slice($themeWords, 0, 4));
    }
    
    // Generate template ID from theme name
    $templateId = strtolower(preg_replace('/[^a-z0-9]+/i', '-', $themeName));
    $templateId = trim($templateId, '-');
    
    // Map Style Brief to theme variables
    $theme = mapStyleBriefToTheme($styleBrief, $themeName);
    
    // Generate content hints for each section
    $contentHintsPrompt = "For a landing page about: \"$description\"

Generate content hints (headline, subheadline, CTA text) for these sections:
";
    
    foreach ($validSectionIds as $sectionId) {
        $sectionMeta = null;
        foreach ($metadata as $item) {
            if ($item['id'] === $sectionId) {
                $sectionMeta = $item;
                break;
            }
        }
        
        if ($sectionMeta) {
            // Use first tag as primary category for blueprint lookup
            $tags = $sectionMeta['tags'] ?? [];
            $primaryTag = !empty($tags) ? $tags[0] : 'content';
            $blueprint = getSectionBlueprint($primaryTag);
            $contentHintsPrompt .= "\nSection $sectionId ($primaryTag): $blueprint";
        }
    }
    
    $contentHintsPrompt .= "\n\nOutput JSON object with section IDs as keys:
{
  \"" . $validSectionIds[0] . "\": {
    \"headline\": \"...\",
    \"subheadline\": \"...\",
    \"cta_primary\": \"...\",
    \"cta_secondary\": \"...\"
  }
}

Include only relevant fields per section (e.g., hero needs all fields, testimonials may only need headline).";
    
    $contentHintsResponse = callOpenAIChat(
        $openaiApiKey,
        [
            'model' => 'gpt-4o-mini',
            'messages' => [['role' => 'user', 'content' => $contentHintsPrompt]],
            'temperature' => 0.7,
            'max_tokens' => 800
        ],
        'Content hints generation'
    );
    
    $contentHintsJson = $contentHintsResponse['content'];
    $contentHints = json_decode($contentHintsJson, true);
    
    if (!is_array($contentHints)) {
        $contentHints = [];
    }
    
    // Generate background decisions for each section
    $sectionCategories = [];
    foreach ($validSectionIds as $sectionId) {
        $sectionMeta = null;
        foreach ($metadata as $item) {
            if ($item['id'] === $sectionId) {
                $sectionMeta = $item;
                break;
            }
        }
        if ($sectionMeta) {
            $tags = $sectionMeta['tags'] ?? [];
            $primaryTag = !empty($tags) ? $tags[0] : 'content';
            $sectionCategories[$sectionId] = $primaryTag;
        }
    }

    $backgroundPrompt = "For a landing page about: \"$description\"

Selected sections with their primary tags:
" . json_encode($sectionCategories, JSON_PRETTY_PRINT) . "

Decide which sections should have:
- BACKGROUND IMAGE: for visual impact, storytelling, emotional connection
- BACKGROUND COLOR: for clean, minimal look, text-heavy sections

Guidelines:
- Hero sections often benefit from images
- Alternate between image/color for visual rhythm
- Features/pricing/FAQ typically use colors
- Testimonials/about can use subtle images
- Maximum 2-4 image backgrounds for performance
- Consider the mood: " . json_encode($styleBrief['mood'] ?? []) . "

For IMAGE backgrounds, provide a precise Unsplash search keyword (2-4 words) based on the section context and template description. Be specific and contextual.

Return ONLY JSON:
{
  \"SECTION_ID\": {\"type\": \"image\", \"keyword\": \"precise search term\"},
  \"SECTION_ID\": {\"type\": \"color\"},
  ...
}";

    $backgroundResponse = callOpenAIChat(
        $openaiApiKey,
        [
            'model' => 'gpt-4o-mini',
            'messages' => [['role' => 'user', 'content' => $backgroundPrompt]],
            'temperature' => 0.7,
            'max_tokens' => 500
        ],
        'Background decisions generation'
    );
    
    $backgroundJson = $backgroundResponse['content'];
    $backgroundDecisions = json_decode($backgroundJson, true);
    
    if (!is_array($backgroundDecisions)) {
        // Default to color for all sections if parsing fails
        $backgroundDecisions = [];
        foreach ($validSectionIds as $sectionId) {
            $backgroundDecisions[$sectionId] = ['type' => 'color'];
        }
    }
    
    // ========================================
    // STEP 3: Analyze inline images and generate keywords
    // ========================================
    
    // Load sections-map.json
    $sectionsMapPath = __DIR__ . '/../config/sections-map.json';
    if (!file_exists($sectionsMapPath)) {
        error_log('sections-map.json not found');
        $sectionsMap = [];
    } else {
        $sectionsMap = json_decode(file_get_contents($sectionsMapPath), true);
    }
    
    $inlineImageKeywords = [];
    
    foreach ($validSectionIds as $sectionId) {
        $sectionFile = $sectionsMap[$sectionId] ?? null;
        if (!$sectionFile) continue;
        
        $sectionHtmlPath = __DIR__ . '/../sections/' . $sectionFile;
        if (!file_exists($sectionHtmlPath)) continue;
        
        $sectionHtml = file_get_contents($sectionHtmlPath);
        
        // Find all <img> tags and extract them with context
        $imageContexts = extractImageContexts($sectionHtml);
        
        // Filter out badges, logos, icons, and SVGs
        $filteredContexts = array_filter($imageContexts, function($context) {
            $src = $context['src'] ?? '';
            $alt = $context['alt'] ?? '';
            $combined = strtolower($src . ' ' . $alt);
            return !preg_match('/badge|logo|icon|\.svg|store|wikipedia|upload\.wikimedia/i', $combined);
        });
        
        if (count($filteredContexts) > 0) {
            // Get category for this section
            $category = $sectionCategories[$sectionId] ?? 'content';
            
            // Generate keywords for these images
            $keywords = generateInlineImageKeywords(
                $openaiApiKey,
                $sectionId,
                $category,
                $sitePlan,
                $description,
                $filteredContexts
            );
            
            if (!empty($keywords)) {
                $inlineImageKeywords[$sectionId] = $keywords;
            }
        }
    }
    
    error_log("Inline image keywords generated for " . count($inlineImageKeywords) . " sections");
    
    // Build fonts object from style brief
    $typography = $styleBrief['typography'] ?? [];
    $fonts = [
        'heading' => $typography['heading_font'] ?? ['family' => 'Inter', 'weights' => [600, 700]],
        'body' => $typography['body_font'] ?? ['family' => 'Inter', 'weights' => [400, 500]]
    ];
    $fonts['google_fonts_url'] = buildGoogleFontsUrl($fonts);
    
    // Build template JSON
    $template = [
        'id' => $templateId,
        'name' => $themeName,
        'description' => $description,
        'category' => 'custom',
        'tags' => $styleBrief['mood'] ?? [],
        'sections' => $validSectionIds,
        'theme' => $theme,
        'fonts' => $fonts,
        'custom_css' => [
            'global' => '',
            'per_section' => []
        ],
        'content_hints' => $contentHints,
        'section_backgrounds' => $backgroundDecisions,
        'inline_image_keywords' => $inlineImageKeywords,
        'style_brief_source' => $styleBrief,
        'site_plan' => $sitePlan,
        'created_at' => date('c')
    ];
    
    // Return success response
    echo json_encode([
        'success' => true,
        'template' => $template
    ]);
    
} catch (Exception $e) {
    error_log("Error in generate-template.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'error' => 'Internal server error',
        'message' => $e->getMessage()
    ]);
}
