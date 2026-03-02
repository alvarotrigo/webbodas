<?php
/**
 * AI Website Generator API
 * Uses OpenAI to generate website structure based on user description
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
        "media" => "Media section — provide media coverage, press quotes, or content embeds showing authority.",
        "video" => "Video section — introduce the video context and encourage viewers to watch or learn more.",
        "applications" => "Applications section — describe use cases or industries where the product applies.",
        "logo clouds" => "Logo cloud section — list partner or client logos to build trust and social proof.",
        "newsletter" => "Newsletter section — invite users to subscribe with a clear benefit statement.",
        "cta" => "CTA section — end with a strong, motivational call-to-action tied to the main goal.",
        "events" => "Events section — highlight upcoming or past events, dates, and participation details.",
        "comparison" => "Comparison section — contrast plans or features to guide users toward the best choice.",
        "content" => "Content section — deliver informational or narrative text that supports brand storytelling.",
        "footer" => "Footer section — include closing navigation, contact info, and reassurance about trust or brand identity.",
        "blog" => "Blog section — preview recent articles or insights, written in a conversational and engaging tone.",
        "integrations" => "Integrations section — describe key tools or services that connect with the product seamlessly."
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
 * Execute an OpenAI Chat Completions request and return the content + decoded response.
 *
 * @param string $apiKey
 * @param array $payload
 * @param string $logContext
 * @return array{content:string, raw:array}
 * @throws RuntimeException
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

if (empty($openaiApiKey)) {
    http_response_code(500);
    echo json_encode([
        'error' => 'OpenAI API key not configured. Please set OPENAI_API_KEY in .env file.'
    ]);
    exit();
}

// Load section metadata
$metadataPath = __DIR__ . '/../public/js/metadata.min.js';
if (!file_exists($metadataPath)) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Section metadata file not found'
    ]);
    exit();
}

// Read and parse metadata (it's a JSON array)
$metadataContent = file_get_contents($metadataPath);
// Remove any leading/trailing whitespace and comments
$metadataContent = trim($metadataContent);
// The file should be a JSON array starting with [
$metadata = json_decode($metadataContent, true);

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
    
    // Get JSON input
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['message']) || empty(trim($input['message']))) {
        http_response_code(400);
        echo json_encode(['error' => 'Message is required']);
        exit();
    }
    
    $userMessage = trim($input['message']);
    
    // Parallel OpenAI calls: generate creative brief and theme in parallel
    $parallelStartTime = microtime(true);
    
    // Prepare creative brief prompt
    $creativeBriefPrompt = <<<PROMPT
Transform this input into a Creative Brief JSON for website copy generation. Fill all fields; guess missing info from context.

Input: {{USER_DESCRIPTION}}

Output JSON structure:
{
  "project": {
    "title": "Short project title",
    "description": "What the website/product is about",
    "product_type": "SaaS | service | ecommerce | personal brand | app | landing page"
  },
  "audience": {
    "primary": ["target groups"],
    "pain_points": ["key problems"],
    "desired_outcomes": ["what they want"]
  },
  "brand": {
    "name": "brand/professional name (guess if missing)",
    "voice": "empathetic-professional | confident-modern | friendly-approachable | luxury-refined | bold-playful | minimal-serious | authoritative-expert"
  },
  "goals": {
    "primary_goal": "signups | demo | contact | learn_more | purchase | booking",
    "secondary_goals": ["trust-building", "awareness"],
    "conversion_action": "CTA phrase like 'Book a Session' or 'Get Started'"
  },
  "value_proposition": {
    "core": "1-2 sentence main value",
    "key_features": ["main features/services"],
    "differentiators": ["unique strengths"]
  },
  "content_preferences": {
    "language": "ISO code (e.g., 'es' for Spain, 'en' for global)",
    "keywords": ["SEO/thematic keywords"],
  },
  "cta": [
    { "label_hint": "Primary CTA", "url": "", "priority": 1 },
    { "label_hint": "Secondary CTA", "url": "", "priority": 2 }
  ],
  "inference": {
    "confidence": 0.0-1.0,
    "assumptions": ["inferred details (e.g., 'Industry: psychologist', 'Locale: Spain')"]
  }
}

Rules: Output only valid JSON. Be concise. Guess confidently (e.g., "psychologist in Spain" → Spanish language, service type, booking goal, empathetic tone, "Reservar cita" CTA).

PROMPT;

    // Prepare theme generation prompt
    $themePrompt = <<<PROMPT
Based on this user description, create a custom website theme with appropriate colors and a distinctive, descriptive name (maximum 4 words).

User description: {{USER_DESCRIPTION}}

Generate a theme that matches the mood, industry, and purpose described. Consider:
- Color psychology and brand appropriateness
- Readability and contrast
- Modern design trends
- The target audience and industry

Output JSON structure:
{
  "name": "Theme Name Max 4 Words",
  "variables": {
    "primary-bg": "#ffffff",
    "secondary-bg": "#f8f9fa",
    "accent-bg": "#fafafa",
    "primary-text": "#222222",
    "secondary-text": "#777777",
    "accent-text": "#111111",
    "primary-accent": "#4285f4",
    "secondary-accent": "#3367d6",
    "border-color": "#e9ecef"
  }
}

How colors are used in the design system:
- primary-bg: Main body background (body { background-color: var(--primary-bg); })
- secondary-bg: Used for cards, sections, and secondary backgrounds (.card-themed, .bg-themed-secondary { background-color: var(--secondary-bg); })
- accent-bg: Used for accent sections and subtle backgrounds (.bg-themed-accent { background-color: var(--accent-bg); })
- primary-text: Main text color for body and content (body { color: var(--primary-text); })
- secondary-text: Muted text for less important content (.text-themed-secondary { color: var(--secondary-text); })
- accent-text: Emphasized text for headings (.heading-themed { color: var(--accent-text); })
- primary-accent: Main brand color used for buttons, links, and interactive elements (.btn-themed { background: var(--primary-accent); })
- secondary-accent: Hover states and complementary accents (.btn-themed:hover { background: var(--secondary-accent); })
- border-color: Subtle borders for cards and sections (.card-themed { border: 1px solid var(--border-color); })

Rules:
- All colors must be valid hex codes (e.g., #ffffff, #000000)
- Ensure good contrast between text and background colors for accessibility
- primary-bg should be the main background (usually light for light themes, dark for dark themes)
- secondary-bg should complement primary-bg and work well for cards/sections that sit on primary-bg
- accent-bg should be a subtle variation, often slightly different from secondary-bg
- primary-text should be dark for light backgrounds, light for dark backgrounds
- secondary-text should be a muted version of primary-text (about 40-60% opacity equivalent)
- accent-text should be the darkest/lightest for emphasis (used in headings)
- primary-accent should be the main brand/accent color (vibrant, distinctive, good for CTAs)
- secondary-accent should complement primary-accent (slightly darker/lighter, used for hover states)
- border-color should be subtle, often transparent or very light/dark (barely visible but provides structure)
- The name should be distinctive, descriptive, and maximum 4 words
- Output only valid JSON, no additional text

PROMPT;

    // Make parallel API calls using curl_multi
    $mh = curl_multi_init();
    $handles = [];
    
    // Creative brief request
    $ch1 = curl_init('https://api.openai.com/v1/chat/completions');
    curl_setopt_array($ch1, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $openaiApiKey
        ],
        CURLOPT_POSTFIELDS => json_encode([
            'model' => 'gpt-4o-mini',
            'messages' => [
                [
                    'role' => 'user',
                    'content' => str_replace('{{USER_DESCRIPTION}}', $userMessage, $creativeBriefPrompt)
                ]
            ],
            'temperature' => 0.5,
            'max_tokens' => 600
        ])
    ]);
    curl_multi_add_handle($mh, $ch1);
    $handles['brief'] = $ch1;
    
    // Theme generation request
    $ch2 = curl_init('https://api.openai.com/v1/chat/completions');
    curl_setopt_array($ch2, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $openaiApiKey
        ],
        CURLOPT_POSTFIELDS => json_encode([
            'model' => 'gpt-4o-mini',
            'messages' => [
                [
                    'role' => 'user',
                    'content' => str_replace('{{USER_DESCRIPTION}}', $userMessage, $themePrompt)
                ]
            ],
            'temperature' => 0.8,
            'max_tokens' => 400
        ])
    ]);
    curl_multi_add_handle($mh, $ch2);
    $handles['theme'] = $ch2;
    
    // Execute parallel requests
    $running = null;
    do {
        curl_multi_exec($mh, $running);
        curl_multi_select($mh);
    } while ($running > 0);
    
    // Get responses
    $creativeBriefResponse = null;
    $themeResponse = null;
    
    foreach ($handles as $key => $handle) {
        $httpCode = curl_getinfo($handle, CURLINFO_HTTP_CODE);
        $response = curl_multi_getcontent($handle);
        $curlError = curl_error($handle);
        
        curl_multi_remove_handle($mh, $handle);
        
        if ($curlError) {
            error_log("Parallel request ($key) cURL error: " . $curlError);
            continue;
        }
        
        if ($httpCode !== 200) {
            error_log("Parallel request ($key) HTTP error: " . $httpCode . " - " . $response);
            continue;
        }
        
        $decoded = json_decode($response, true);
        if (!isset($decoded['choices'][0]['message']['content'])) {
            error_log("Parallel request ($key) invalid response");
            continue;
        }
        
        $content = trim($decoded['choices'][0]['message']['content']);
        $content = preg_replace('/```json\s*/', '', $content);
        $content = preg_replace('/```\s*/', '', $content);
        $content = trim($content);
        
        if ($key === 'brief') {
            $creativeBriefResponse = ['content' => $content, 'raw' => $decoded];
        } else if ($key === 'theme') {
            $themeResponse = ['content' => $content, 'raw' => $decoded];
        }
    }
    
    curl_multi_close($mh);
    
    $parallelEndTime = microtime(true);
    $parallelDuration = round($parallelEndTime - $parallelStartTime, 2);
    
    // Process creative brief response
    if (!$creativeBriefResponse) {
        error_log('Failed to get creative brief response');
        http_response_code(500);
        echo json_encode([
            'error' => 'Failed to generate creative brief from OpenAI.'
        ]);
        exit();
    }
    
    $creativeBriefContent = $creativeBriefResponse['content'];
    $creativeBrief = json_decode($creativeBriefContent, true);

    if (!is_array($creativeBrief)) {
        error_log('Failed to parse creative brief JSON: ' . $creativeBriefContent);
        http_response_code(500);
        echo json_encode([
            'error' => 'Failed to generate a valid creative brief from OpenAI.'
        ]);
        exit();
    }
    
    // Process theme response (optional - don't fail if theme generation fails)
    $themeData = null;
    if ($themeResponse) {
        $themeContent = $themeResponse['content'];
        $parsedTheme = json_decode($themeContent, true);
        
        if (is_array($parsedTheme) && isset($parsedTheme['name']) && isset($parsedTheme['variables'])) {
            // Validate required variables
            $requiredVariables = [
                'primary-bg', 'secondary-bg', 'accent-bg',
                'primary-text', 'secondary-text', 'accent-text',
                'primary-accent', 'secondary-accent', 'border-color'
            ];
            
            $hasAllVariables = true;
            foreach ($requiredVariables as $var) {
                if (!isset($parsedTheme['variables'][$var])) {
                    $hasAllVariables = false;
                    break;
                }
            }
            
            // Validate hex color format
            if ($hasAllVariables) {
                $hexColorPattern = '/^#[0-9A-Fa-f]{6}$/';
                $allValid = true;
                foreach ($parsedTheme['variables'] as $key => $value) {
                    if (!preg_match($hexColorPattern, $value)) {
                        $allValid = false;
                        break;
                    }
                }
                
                if ($allValid) {
                    // Validate name length (max 4 words)
                    $nameWords = explode(' ', trim($parsedTheme['name']));
                    if (count($nameWords) > 4) {
                        $parsedTheme['name'] = implode(' ', array_slice($nameWords, 0, 4));
                    }
                    $themeData = $parsedTheme;
                }
            }
        }
        
        if (!$themeData) {
            error_log('Theme generation failed or returned invalid data, continuing without theme');
        }
    }
    
    // Format metadata as JSON for the prompt
    $metadataJson = json_encode($metadata, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    
    $systemPrompt = "You are a website builder assistant. Your task is to analyze user descriptions and select the optimal sections for a landing page.

Available sections metadata (full details for each section):
" . $metadataJson . "

Each section has properties including:
- id: unique section identifier
- category: section type (hero, features, testimonials, pricing, contact, etc.)
- section_role: purpose (intro, feature, social-proof, comparison, etc.)
- layout: visual layout (centered, split, grid, stacked)
- elements: available UI elements
- media: media type (none, image, video, illustration, etc.)

Your process should be:
STEP 1: Analyze the user description and creative brief to determine the optimal landing page structure
- Consider the project type, goals, audience, and value proposition
- Decide what types of sections are needed (e.g., hero, features, testimonials, pricing, contact)
- Determine the logical flow and order that best serves the user's requirements
- Think about what information the audience needs to see and in what sequence

STEP 2: Select specific sections that match your structure
- Choose 4-8 sections from the available metadata
- Match sections based on category, section_role, layout, and elements
- Ensure the selected sections align with the structure you determined in Step 1
- Prioritize sections that best fulfill the user's specific requirements

Rules:
1. Return ONLY JSON array: [1, 2, 3]
2. Always start with a hero section (category: hero)
3. Include sections that match the user's requirements and goals
4. End with CTA/contact if appropriate for the conversion goal
5. Consider section_role, layout, elements, and media when selecting
6. The structure should create a logical flow that guides users toward the primary goal
7. NO text, ONLY the JSON array

Examples:
'SaaS landing page' → [1, 15, 5, 27, 39]
'Photographer portfolio' → [47, 10, 11, 33, 6]";

    $userPrompt = "User request: " . $userMessage . "\n\nCreative brief JSON:\n" . json_encode($creativeBrief, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n\nBased on the user description and creative brief above:\n1. First, determine the optimal landing page structure that best serves the user's requirements\n2. Then, select specific section IDs that match that structure\n\nReturn the JSON array of section IDs:";
    // Call OpenAI API for section selection
    $sectionSelectionStartTime = microtime(true);
    $sectionSelectionResponse = callOpenAIChat(
        $openaiApiKey,
        [
            'model' => 'gpt-4o-mini',
            'messages' => [
                [
                    'role' => 'system',
                    'content' => $systemPrompt
                ],
                [
                    'role' => 'user',
                    'content' => $userPrompt
                ]
            ],
            'temperature' => 0.7,
            'max_tokens' => 500
        ],
        'Section selection generation'
    );

    $sectionSelectionEndTime = microtime(true);
    $sectionSelectionDuration = round($sectionSelectionEndTime - $sectionSelectionStartTime, 2);

    $content = $sectionSelectionResponse['content'];
    
    // Try to parse as JSON
    $sectionIds = json_decode($content, true);
    
    if (!is_array($sectionIds) || empty($sectionIds)) {
        // Try to extract numbers from the response
        preg_match_all('/\d+/', $content, $matches);
        if (!empty($matches[0])) {
            $sectionIds = array_map('intval', $matches[0]);
        } else {
            error_log("Could not parse section IDs from OpenAI response: " . $content);
            http_response_code(500);
            echo json_encode([
                'error' => 'Could not parse section recommendations from AI response',
                'raw_response' => $content
            ]);
            exit();
        }
    }
    
    // Validate section IDs exist in metadata
    $validSectionIds = [];
    $availableIds = array_column($metadata, 'id');
    
    foreach ($sectionIds as $id) {
        $id = (int)$id;
        if (in_array($id, $availableIds)) {
            $validSectionIds[] = $id;
        }
    }
    
    if (empty($validSectionIds)) {
        error_log("No valid section IDs found in response: " . json_encode($sectionIds));
        http_response_code(500);
        echo json_encode([
            'error' => 'No valid sections found in AI response',
            'raw_response' => $content
        ]);
        exit();
    }
    
    // Return success response
    $response = [
        'success' => true,
        'sections' => $validSectionIds,
        'count' => count($validSectionIds),
        'creative_brief' => $creativeBrief,
        'timing' => [
            'parallel_calls_seconds' => $parallelDuration,
            'section_selection_seconds' => $sectionSelectionDuration
        ]
    ];
    
    // Include theme data if available
    if ($themeData) {
        $response['theme'] = $themeData;
    }
    
    echo json_encode($response);
    
} catch (Exception $e) {
    error_log("Error in generate-website.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'error' => 'Internal server error',
        'message' => $e->getMessage()
    ]);
}
?>

