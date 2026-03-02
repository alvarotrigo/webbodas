<?php
/**
 * AI Theme Generator API
 * Uses OpenAI to generate custom theme colors and name based on user description
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
    
    if (!isset($input['message']) || empty(trim($input['message']))) {
        http_response_code(400);
        echo json_encode(['error' => 'Message is required']);
        exit();
    }
    
    $userMessage = trim($input['message']);
    
    // OpenAI call: generate theme colors and name from user description
    $themePrompt = <<<PROMPT
You are a theme palette generator. Generate 9 color variables based on the user's description.
Return JSON only. Follow the patterns in the examples below.

## Variables
primary-bg, secondary-bg, accent-bg, primary-text, secondary-text, accent-text, primary-accent, secondary-accent, border-color

## Working Examples

Light theme with purple accent:
{
  "primary-bg": "#ffffff",
  "secondary-bg": "#f4f4f7",
  "accent-bg": "#fafafa",
  "primary-text": "#222222",
  "secondary-text": "#777777",
  "accent-text": "#111111",
  "primary-accent": "#5046e6",
  "secondary-accent": "#3d31d9",
  "border-color": "#e5e5e5"
}

Dark theme with purple accent:
{
  "primary-bg": "#0a0a0f",
  "secondary-bg": "#1a1f2e",
  "accent-bg": "#242b3d",
  "primary-text": "#e4e6ea",
  "secondary-text": "#b0b3b8",
  "accent-text": "#ffffff",
  "primary-accent": "#8b5cf6",
  "secondary-accent": "#7c3aed",
  "border-color": "#2a2f3e"
}

Light theme with orange accent:
{
  "primary-bg": "#fef7f0",
  "secondary-bg": "#fff4e6",
  "accent-bg": "#ffedd5",
  "primary-text": "#1f2937",
  "secondary-text": "#374151",
  "accent-text": "#111827",
  "primary-accent": "#f97316",
  "secondary-accent": "#ea580c",
  "border-color": "#fed7aa"
}

Corporate blue theme:
{
  "primary-bg": "#ffffff",
  "secondary-bg": "#f3f6fa",
  "accent-bg": "#e3eaf2",
  "primary-text": "#1b2a3a",
  "secondary-text": "#3b4a5a",
  "accent-text": "#102a43",
  "primary-accent": "#2563eb",
  "secondary-accent": "#1e4bb8",
  "border-color": "#c5d1df"
}

Wellness green theme:
{
  "primary-bg": "#f8fafc",
  "secondary-bg": "#f0fdf4",
  "accent-bg": "#dcfce7",
  "primary-text": "#1e293b",
  "secondary-text": "#475569",
  "accent-text": "#0f172a",
  "primary-accent": "#34d399",
  "secondary-accent": "#059669",
  "border-color": "#bbf7d0"
}

## Critical Rules

1. **Keep all backgrounds in same lightness range:**
   - Light themes: ALL backgrounds RGB > 200 (e.g., #ffffff, #f4f4f7, #e9e9ef)
   - Dark themes: ALL backgrounds RGB < 80 (e.g., #0a0a0f, #1a1f2e, #333333)
   - NEVER mix (e.g., #1a1a1a + #f5f5f5)
   - NEVER use medium grays (#808080, #999999, #666666)

2. **Text must contrast with ALL backgrounds:**
   - Light backgrounds → dark text (RGB < 80)
   - Dark backgrounds → light text (RGB > 200)
   - primary-text and accent-text need ≥4.5:1 contrast with all backgrounds
   - secondary-text needs ≥3:1 contrast with all backgrounds

3. **Primary accent gets the brand color:**
   - Use the color mentioned in user description
   - Should be vibrant and stand out
   - secondary-accent is darker/more saturated version

4. **Text hierarchy:**
   - accent-text is darker (light themes) or lighter (dark themes) than primary-text
   - secondary-text is muted version of primary-text

## Output Format
{
  "name": "Max 4 Words",
  "inferred_style": "2-4 descriptive words",
  "variables": { ... }
}

Generate for: {{USER_DESCRIPTION}}

PROMPT;

    $themeResponse = callOpenAIChat(
        $openaiApiKey,
        [
            'model' => 'gpt-4o',
            'messages' => [
                [
                    'role' => 'user',
                    'content' => str_replace('{{USER_DESCRIPTION}}', $userMessage, $themePrompt)
                ]
            ],
            'temperature' => 0.3,
            'max_tokens' => 400
        ],
        'Theme generation'
    );

    $themeContent = $themeResponse['content'];
    $themeData = json_decode($themeContent, true);

    if (!is_array($themeData) || !isset($themeData['name']) || !isset($themeData['variables'])) {
        error_log('Failed to parse theme JSON: ' . $themeContent);
        http_response_code(500);
        echo json_encode([
            'error' => 'Failed to generate a valid theme from OpenAI.',
            'raw_response' => $themeContent
        ]);
        exit();
    }
    
    // Validate all required variables are present
    $requiredVariables = [
        'primary-bg', 'secondary-bg', 'accent-bg',
        'primary-text', 'secondary-text', 'accent-text',
        'primary-accent', 'secondary-accent', 'border-color'
    ];
    
    $missingVariables = [];
    foreach ($requiredVariables as $var) {
        if (!isset($themeData['variables'][$var])) {
            $missingVariables[] = $var;
        }
    }
    
    if (!empty($missingVariables)) {
        error_log('Missing theme variables: ' . implode(', ', $missingVariables));
        http_response_code(500);
        echo json_encode([
            'error' => 'Theme is missing required variables: ' . implode(', ', $missingVariables)
        ]);
        exit();
    }
    
    // Validate hex color format
    $hexColorPattern = '/^#[0-9A-Fa-f]{6}$/';
    foreach ($themeData['variables'] as $key => $value) {
        if (!preg_match($hexColorPattern, $value)) {
            error_log("Invalid hex color for $key: $value");
            http_response_code(500);
            echo json_encode([
                'error' => "Invalid color format for $key: $value (must be #RRGGBB)"
            ]);
            exit();
        }
    }
    
    // Validate name length (max 4 words)
    $nameWords = explode(' ', trim($themeData['name']));
    if (count($nameWords) > 4) {
        // Truncate to 4 words
        $themeData['name'] = implode(' ', array_slice($nameWords, 0, 4));
    }
    
    // Return success response
    echo json_encode([
        'success' => true,
        'theme' => $themeData
    ]);
    
} catch (Exception $e) {
    error_log("Error in generate-theme.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'error' => 'Internal server error',
        'message' => $e->getMessage()
    ]);
}
?>

