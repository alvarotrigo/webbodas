<?php
/**
 * AI Image Keywords Generator API
 * Uses OpenAI to generate relevant image search keywords for sections
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
    
    if (!isset($input['section_text']) || !isset($input['creative_brief'])) {
        http_response_code(400);
        echo json_encode([
            'error' => 'Missing required fields',
            'required' => ['section_text', 'creative_brief']
        ]);
        exit();
    }

    $sectionText = $input['section_text'];
    $creativeBrief = $input['creative_brief'];
    $sectionCategory = $input['section_category'] ?? 'content';
    $imageCount = isset($input['image_count']) ? (int)$input['image_count'] : 1;
    $sectionHtml = $input['section_html'] ?? '';

    // Count actual images in HTML if provided
    if ($sectionHtml) {
        preg_match_all('/<img[^>]+>/i', $sectionHtml, $matches);
        $actualImageCount = count($matches[0]);
        if ($actualImageCount > 0) {
            $imageCount = $actualImageCount;
        }
    }

    // Build prompt for OpenAI
    $prompt = "You are an expert at generating image search keywords for website sections.

Given the following information:
- Section category: {$sectionCategory}
- Creative brief: {$creativeBrief}
- Generated text content: {$sectionText}

Analyze the section and generate {$imageCount} set(s) of image search keywords. Each set should contain 2-4 keywords that would help find the perfect stock photo for that image position.

Consider:
1. The main theme and purpose of the section
2. The visual style that would match the text content
3. The emotional tone and mood
4. The context of where the image appears (hero, feature, testimonial, etc.)
5. The specific content of the text (what is being described or shown)

Return a JSON object with this structure:
{
  \"keywords\": [
    [\"keyword1\", \"keyword2\", \"keyword3\"],
    [\"keyword4\", \"keyword5\"]
  ]
}

If there are multiple images, provide keywords for each one. Make keywords specific enough to find relevant images but general enough to have good search results. Focus on visual concepts, emotions, and themes rather than exact text matches.";

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
            'temperature' => 0.7,
            'max_tokens' => 500
        ],
        'Image keywords generation'
    );
    
    $content = $response['content'];
    
    // Try to parse as JSON
    $keywordsData = json_decode($content, true);

    if (!is_array($keywordsData) || !isset($keywordsData['keywords'])) {
        error_log("Failed to parse keywords JSON: " . $content);
        http_response_code(500);
        echo json_encode([
            'error' => 'Failed to generate valid keywords',
            'raw_response' => $content
        ]);
        exit();
    }

    // Validate keywords structure
    if (!is_array($keywordsData['keywords'])) {
        error_log("Invalid keywords format: " . json_encode($keywordsData));
        http_response_code(500);
        echo json_encode([
            'error' => 'Invalid keywords format from AI'
        ]);
        exit();
    }

    // Ensure we have at least one keyword set
    if (empty($keywordsData['keywords'])) {
        error_log("No keywords generated");
        http_response_code(500);
        echo json_encode([
            'error' => 'No keywords generated'
        ]);
        exit();
    }

    // Return success response
    echo json_encode([
        'success' => true,
        'keywords' => $keywordsData['keywords']
    ]);
    
} catch (Exception $e) {
    error_log("Error in generate-image-keywords.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'error' => 'Internal server error',
        'message' => $e->getMessage()
    ]);
}
?>


