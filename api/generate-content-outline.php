<?php
/**
 * Content Outline Generator API
 * Generates unique content outlines for all sections to prevent repetition
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

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
        exit();
    }
    
    // Get JSON input
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['creative_brief']) || !isset($input['sections'])) {
        http_response_code(400);
        echo json_encode([
            'error' => 'Missing required fields',
            'required' => ['creative_brief', 'sections']
        ]);
        exit();
    }
    
    $creativeBrief = $input['creative_brief'];
    $sections = $input['sections'];
    
    if (!is_array($sections) || empty($sections)) {
        http_response_code(400);
        echo json_encode([
            'error' => 'Sections must be a non-empty array'
        ]);
        exit();
    }
    
    // Build section list for prompt
    $sectionsList = [];
    foreach ($sections as $section) {
        if (!isset($section['id']) || !isset($section['category'])) {
            continue;
        }
        
        $sectionId = $section['id'];
        $category = $section['category'];
        $blueprint = getSectionBlueprint($category);
        
        $sectionsList[] = [
            'id' => $sectionId,
            'category' => $category,
            'blueprint' => $blueprint
        ];
    }
    
    if (empty($sectionsList)) {
        http_response_code(400);
        echo json_encode([
            'error' => 'No valid sections provided (each section needs id and category)'
        ]);
        exit();
    }
    
    // Build the prompt
    $prompt = <<<PROMPT
You are an expert web copywriter creating a content outline for a website landing page.

Your task: Generate a unique content outline for EACH section listed below. Each section must have a DISTINCT headline - no repetition or similar phrasing allowed across sections.

---

INPUTS

Creative Brief:

{{CREATIVE_BRIEF_JSON}}

Sections to outline (in order):

{{SECTIONS_LIST}}

---

INSTRUCTIONS

For EACH section:
1. Create a UNIQUE headline that:
   - Matches the section's category intent (see blueprint)
   - Uses DIFFERENT wording/phrasing than all other sections
   - Aligns with the Creative Brief tone and goals
   - Is appropriate for the section type (e.g., hero = bold/aspirational, pricing = clear/practical, contact = inviting)

2. Define a subheadline focus (2-4 keywords/themes to emphasize in that section's subheadline)

3. Specify the key message (what this section should communicate)

4. Build a cumulative avoid_phrases list:
   - For the FIRST section: avoid_phrases is empty []
   - For subsequent sections: include key words/phrases from ALL previous section headlines to prevent repetition
   - Example: If section 1 uses "Transform Your Life", section 2's avoid_phrases should include ["transform", "life", "transform your life"]

---

CRITICAL REQUIREMENTS

- ALL section headlines MUST be completely unique - no duplicate words or similar phrasing
- Each section should feel distinct and serve its specific purpose
- Headlines should progress naturally through the page narrative (hero → value props → conversion)
- Use the Creative Brief as the source of truth for brand voice, product details, and goals

---

OUTPUT FORMAT

Return JSON with section IDs as keys:

{
  "SECTION_ID": {
    "headline": "Unique headline for this section",
    "subheadline_focus": "keywords, themes, tone elements to emphasize",
    "key_message": "what this section communicates",
    "avoid_phrases": ["words", "from", "previous", "headlines"]
  }
}

Example for a fitness gym with sections [hero, pricing, contact]:

{
  "1": {
    "headline": "Transform Your Fitness Journey",
    "subheadline_focus": "energy, community, youth empowerment",
    "key_message": "primary value proposition and emotional hook",
    "avoid_phrases": []
  },
  "27": {
    "headline": "Plans That Match Your Ambition",
    "subheadline_focus": "flexibility, affordability, choice",
    "key_message": "transparent pricing options that fit different needs",
    "avoid_phrases": ["transform", "fitness", "journey", "fitness journey"]
  },
  "46": {
    "headline": "Ready to Start?",
    "subheadline_focus": "approachability, support, guidance, next steps",
    "key_message": "invitation to connect and get started",
    "avoid_phrases": ["transform", "fitness", "journey", "plans", "match", "ambition"]
  }
}

**Return ONLY valid JSON, no additional text or explanations.**

PROMPT;

    // Replace placeholders
    $prompt = str_replace('{{CREATIVE_BRIEF_JSON}}', json_encode($creativeBrief, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), $prompt);
    
    // Format sections list
    $sectionsFormatted = [];
    foreach ($sectionsList as $idx => $section) {
        $num = $idx + 1;
        $sectionsFormatted[] = sprintf(
            "%d. Section ID %s (%s)\n   Blueprint: %s",
            $num,
            $section['id'],
            $section['category'],
            $section['blueprint'] ?? 'No blueprint available'
        );
    }
    $sectionsText = implode("\n\n", $sectionsFormatted);
    $prompt = str_replace('{{SECTIONS_LIST}}', $sectionsText, $prompt);

    // Call OpenAI API
    $response = callOpenAIChat(
        $openaiApiKey,
        [
            'model' => 'gpt-4o-mini',
            'messages' => [
                [
                    'role' => 'user',
                    'content' => $prompt
                ]
            ],
            'temperature' => 0.8,
            'max_tokens' => 2000
        ],
        'Content outline generation'
    );
    
    $content = $response['content'];
    
    // Try to parse as JSON
    $outline = json_decode($content, true);

    if (!is_array($outline)) {
        error_log("Failed to parse content outline JSON: " . $content);
        http_response_code(500);
        echo json_encode([
            'error' => 'Failed to generate valid content outline',
            'raw_response' => $content
        ]);
        exit();
    }
    
    // Validate that we have an outline for each section
    $missingSections = [];
    foreach ($sectionsList as $section) {
        $sectionId = (string)$section['id'];
        if (!isset($outline[$sectionId])) {
            $missingSections[] = $sectionId;
        }
    }
    
    if (!empty($missingSections)) {
        error_log("Content outline missing sections: " . implode(', ', $missingSections));
    }
    
    // Return success response
    echo json_encode([
        'success' => true,
        'outline' => $outline
    ]);
    
} catch (Exception $e) {
    error_log("Error in generate-content-outline.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'error' => 'Internal server error',
        'message' => $e->getMessage()
    ]);
}
?>
