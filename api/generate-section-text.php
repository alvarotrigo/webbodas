<?php
/**
 * AI Section Text Generator API
 * Uses OpenAI to generate custom text content for website sections
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
    
    if (!isset($input['creative_brief']) || !isset($input['blueprint'])) {
        http_response_code(400);
        echo json_encode([
            'error' => 'Missing required fields',
            'required' => ['creative_brief', 'blueprint']
        ]);
        exit();
    }
    
    $creativeBrief = $input['creative_brief'];
    $blueprint = $input['blueprint'];
    $sectionHtml = $input['section_html'] ?? null; // Now optional
    $sectionId = $input['section_id'] ?? null;
    $outline = $input['outline'] ?? null; // Content outline for this section
    // Support both old "allowed_selectors" and new "target_selectors" for backward compatibility
    $targetSelectorsInput = $input['target_selectors'] ?? $input['allowed_selectors'] ?? [];

    // Handle both old format (array) and new format (object with text and role)
    $targetSelectors = [];
    $targetSelectorsWithText = [];
    $targetSelectorsWithRole = [];
    
    if (is_array($targetSelectorsInput)) {
        foreach ($targetSelectorsInput as $key => $value) {
            if (is_numeric($key)) {
                // Old format: array of selectors
                if (is_string($value)) {
                    $trimmed = trim($value);
                    if ($trimmed !== '') {
                        $targetSelectors[] = $trimmed;
                        $targetSelectorsWithText[$trimmed] = '';
                        $targetSelectorsWithRole[$trimmed] = null;
                    }
                }
            } else {
                // New format: object mapping selectors to text (string) or object with text and role
                if (is_string($key)) {
                    $trimmed = trim($key);
                    if ($trimmed !== '') {
                        $targetSelectors[] = $trimmed;
                        
                        if (is_array($value) && isset($value['text'])) {
                            // New format with role: {text: "...", role: "button"}
                            $targetSelectorsWithText[$trimmed] = is_string($value['text']) ? trim($value['text']) : '';
                            $targetSelectorsWithRole[$trimmed] = isset($value['role']) && is_string($value['role']) ? $value['role'] : null;
                        } else {
                            // Old format: just text string
                            $targetSelectorsWithText[$trimmed] = is_string($value) ? trim($value) : '';
                            $targetSelectorsWithRole[$trimmed] = null;
                        }
                    }
                }
            }
        }
    }
    
    
    // Build the prompt
    $prompt = <<<PROMPT
You are an expert web copywriter.

Write NEW text content for ALL elements in a website section. You must return text for EVERY selector provided below.

---

INPUTS

Creative Brief:

{{CREATIVE_BRIEF_JSON}}

Blueprint (section intent):

{{BLUEPRINT_TEXT}}

{{CONTENT_OUTLINE_SECTION}}

Target selectors with current text (for length reference ONLY - ignore content, generate new text from Creative Brief for ALL of these):

{{TARGET_SELECTORS}}

{{SECTION_HTML_SECTION}}

---

INSTRUCTIONS

- **CRITICAL - Generate ALL text content from the Creative Brief, NOT from the current text shown in target selectors.**
  * The current text in target selectors is likely placeholder/template text from a different context and should be IGNORED for content purposes.
  * Use the Creative Brief as the ONLY source for generating new, contextually appropriate text.
  * The current text is provided ONLY as a length/structure reference - match approximate length, but generate completely new content.
{{OUTLINE_INSTRUCTIONS}}
- Match tone, style, and goals from the Creative Brief.
- Follow the intent from the Blueprint.
- **CRITICAL - You MUST return text for EVERY selector listed above. Do not skip any.**
- **Length restrictions:**
  * For elements marked with role "counter": Keep the EXACT original text. These are step/bullet indicators (like "1", "2", "3" or "a", "b", "c") and MUST NOT be replaced with longer text.
  * For elements marked with role "button": Keep text SHORT (2-4 words maximum). Buttons must be concise and action-oriented. Generate contextually appropriate text by analyzing the Creative Brief:
    1. If CTA hints exist (creative_brief.cta[].label_hint), use those exact phrases or create natural variations that match the intent.
    2. If conversion_action exists in goals, use that phrase or create a natural variation that matches the intent.
    3. Consider the product_type from the Creative Brief - generate button text that makes sense for that specific context (e.g., portfolio sites should use "Contact Me", "View My Work", "Hire Me" - NOT generic SaaS terms like "Get Started").
    4. Consider the primary_goal, desired_outcomes, and audience pain_points to ensure the button text resonates.
  * For h1 elements: Try to MAINTAIN THE SAME CHARACTER LENGTH (or very close to it) as the original text. Main headlines should be impactful but concise - aim to match the original length within ±10 characters. If the original h1 is 25 characters, your replacement should ideally be 20-30 characters.
  * For elements where the original text is fewer than 4 words: Your replacement MUST also be fewer than 4 words. These are typically names, titles, labels, or short tags that must stay short to preserve the layout.
  * For other elements: Match the approximate length of the current text shown for each selector (for structure only - generate new content from Creative Brief).
- Return **only JSON**, no Markdown or explanations.

---

OUTPUT FORMAT

Return JSON with keys as element selectors and values as new text content.

**YOU MUST INCLUDE EVERY SELECTOR FROM THE TARGET SELECTORS LIST ABOVE.**

Selector format:
- For single elements: "tag" (e.g., "h2", "h1")
- For multiple elements of the same type: "tag[index]" where index is 0-based (e.g., "p[0]", "p[1]", "a[0]")

Example - if the target selectors list contains:
- h2[0]: "Old Title"
- p[0]: "Old paragraph"
- a[0] (role: button): "Old Button"

You MUST return ALL of them:
{
  "h2[0]": "New Title",
  "p[0]": "New paragraph text",
  "a[0]": "New Button"
}

**CRITICAL REQUIREMENTS**: 
- Return text for EVERY selector in the target selectors list above. Missing selectors are not acceptable.
- Only include selectors that exist in the target selectors list. Do not invent new selectors.

PROMPT;

    // Replace placeholders
    $prompt = str_replace('{{CREATIVE_BRIEF_JSON}}', json_encode($creativeBrief, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), $prompt);
    $prompt = str_replace('{{BLUEPRINT_TEXT}}', $blueprint, $prompt);
    
    // Add content outline section if provided
    if ($outline !== null && is_array($outline)) {
        $outlineSection = "Content Outline for THIS section (pre-planned to ensure uniqueness):\n\n";
        $outlineSection .= "Assigned Headline: " . ($outline['headline'] ?? 'Not specified') . "\n";
        $outlineSection .= "Subheadline Focus: " . ($outline['subheadline_focus'] ?? 'Not specified') . "\n";
        $outlineSection .= "Key Message: " . ($outline['key_message'] ?? 'Not specified') . "\n";
        
        if (isset($outline['avoid_phrases']) && is_array($outline['avoid_phrases']) && !empty($outline['avoid_phrases'])) {
            $outlineSection .= "Words/Phrases to AVOID (used in other sections): " . implode(', ', $outline['avoid_phrases']);
        } else {
            $outlineSection .= "Words/Phrases to AVOID: (none - this is the first section)";
        }
        
        $prompt = str_replace('{{CONTENT_OUTLINE_SECTION}}', $outlineSection, $prompt);
        
        $outlineInstructions = <<<OUTLINE_INST
- **CRITICAL - Use the assigned headline from the Content Outline:**
  * For the main heading element (h1, h2, etc.), you MUST use the exact "Assigned Headline" text provided in the Content Outline above.
  * For the subheadline/description, incorporate the themes from "Subheadline Focus" while maintaining the key message.
  * DO NOT use any words or phrases listed in "Words/Phrases to AVOID" - these were used in other sections.
OUTLINE_INST;
        $prompt = str_replace('{{OUTLINE_INSTRUCTIONS}}', $outlineInstructions, $prompt);
    } else {
        $prompt = str_replace('{{CONTENT_OUTLINE_SECTION}}', '', $prompt);
        $prompt = str_replace('{{OUTLINE_INSTRUCTIONS}}', '', $prompt);
    }
    
    // Format target selectors with text and role for the prompt
    $targetSelectorsFormatted = [];
    if (!empty($targetSelectorsWithText)) {
        foreach ($targetSelectorsWithText as $selector => $text) {
            $role = $targetSelectorsWithRole[$selector] ?? null;
            $formatted = $selector;
            
            if ($text !== '') {
                if ($role) {
                    // Include role information
                    $formatted = sprintf('%s (role: %s): "%s"', $selector, $role, $text);
                } else {
                    $formatted = sprintf('%s: "%s"', $selector, $text);
                }
            } else if ($role) {
                $formatted = sprintf('%s (role: %s)', $selector, $role);
            }
            
            $targetSelectorsFormatted[] = $formatted;
        }
    }
    $targetSelectorsText = !empty($targetSelectorsFormatted)
        ? implode("\n", $targetSelectorsFormatted)
        : "[]";
    $prompt = str_replace('{{TARGET_SELECTORS}}', $targetSelectorsText, $prompt);
    
    // Add section HTML only if provided (for backward compatibility)
    if ($sectionHtml !== null && $sectionHtml !== '') {
        $htmlSection = "Section HTML (for reference only - use target selectors above as the source of truth):\n\n" . $sectionHtml;
        $prompt = str_replace('{{SECTION_HTML_SECTION}}', $htmlSection, $prompt);
    } else {
        $prompt = str_replace('{{SECTION_HTML_SECTION}}', '', $prompt);
    }

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
            'max_tokens' => 2000
        ],
        'Section text generation'
    );
    
    $content = $response['content'];
    
    // Try to parse as JSON
    $textUpdates = json_decode($content, true);

    if (!is_array($textUpdates)) {
        error_log("Failed to parse text updates JSON: " . $content);
        http_response_code(500);
        echo json_encode([
            'error' => 'Failed to generate valid text updates',
            'raw_response' => $content
        ]);
        exit();
    }
    
    // Validate and filter response to only include target selectors
    if (!empty($targetSelectors)) {
        $targetSet = [];
        foreach ($targetSelectors as $selector) {
            $targetSet[$selector] = true;
            // Also allow non-indexed version for backward compatibility
            if (preg_match('/^[a-z0-9]+\[0\]$/i', $selector)) {
                $baseTag = preg_replace('/\[0\]$/', '', $selector);
                $targetSet[$baseTag] = true;
            } elseif (preg_match('/^[a-z0-9]+$/i', $selector)) {
                $targetSet[$selector . '[0]'] = true;
            }
        }

        $filtered = [];
        foreach ($textUpdates as $selector => $value) {
            if (!is_string($selector)) {
                continue;
            }
            if (!isset($targetSet[$selector])) {
                continue;
            }
            $filtered[$selector] = $value;
        }

        // Check for missing selectors - AI should have returned all of them
        $missing = array_diff($targetSelectors, array_keys($filtered));
        if (!empty($missing)) {
            error_log(
                sprintf(
                    'AI did not return text for all target selectors in section %s. Missing: %s',
                    $sectionId !== null ? (string)$sectionId : 'unknown',
                    implode(', ', $missing)
                )
            );
            // Fill in missing selectors with their original text as fallback
            foreach ($missing as $selector) {
                if (isset($targetSelectorsWithText[$selector]) && $targetSelectorsWithText[$selector] !== '') {
                    $filtered[$selector] = $targetSelectorsWithText[$selector];
                    error_log("Using original text as fallback for missing selector: {$selector}");
                }
            }
        }

        if (count($filtered) !== count($textUpdates)) {
            $removed = array_diff(array_keys($textUpdates), array_keys($filtered));
            if (!empty($removed)) {
                error_log(
                    sprintf(
                        'Filtered disallowed selectors for section %s: %s',
                        $sectionId !== null ? (string)$sectionId : 'unknown',
                        implode(', ', $removed)
                    )
                );
            }
        }

        $textUpdates = $filtered;
    }

    // Normalize values to strings for downstream consumers.
    // IMPORTANT: The AI returns plain strings (not objects), but we should handle edge cases
    $normalizedUpdates = [];
    foreach ($textUpdates as $selector => $value) {
        if (!is_string($selector)) {
            continue;
        }

        // Extract text from various formats
        if (is_array($value) && isset($value['text'])) {
            // Handle {text: "...", role: "..."} format - extract just the text
            $normalizedUpdates[$selector] = (string) $value['text'];
        } elseif (is_array($value) || is_object($value)) {
            // Fallback: convert to JSON string (shouldn't normally happen with AI responses)
            $normalizedUpdates[$selector] = json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        } elseif ($value === null) {
            $normalizedUpdates[$selector] = '';
        } else {
            $normalizedUpdates[$selector] = (string) $value;
        }
    }
    $textUpdates = $normalizedUpdates;

    // Post-validation safety net: prevent counters from being replaced with long text
    // If original text was 1-2 characters (especially for counter role), and AI returned something longer,
    // fall back to original text to preserve step indicators like "1", "2", "3"
    foreach ($textUpdates as $selector => $newText) {
        $originalText = $targetSelectorsWithText[$selector] ?? '';
        $role = $targetSelectorsWithRole[$selector] ?? null;

        // If this is a counter role, always preserve original
        if ($role === 'counter') {
            $textUpdates[$selector] = $originalText;
            continue;
        }

        // Additional safety: if original was very short (1-2 chars) and new text is much longer,
        // likely a counter that AI mistakenly replaced - revert to original
        $originalLen = mb_strlen($originalText);
        $newLen = mb_strlen($newText);

        if ($originalLen > 0 && $originalLen <= 2 && $newLen > 4) {
            error_log(
                sprintf(
                    'Counter protection: Reverting selector %s in section %s from "%s" (len=%d) back to "%s" (len=%d)',
                    $selector,
                    $sectionId !== null ? (string)$sectionId : 'unknown',
                    $newText,
                    $newLen,
                    $originalText,
                    $originalLen
                )
            );
            $textUpdates[$selector] = $originalText;
            continue;
        }

        // Word count protection: if original text was fewer than 4 words,
        // the replacement must also be fewer than 4 words (preserves names, titles, labels)
        if ($originalText !== '') {
            $originalWordCount = str_word_count($originalText);
            $newWordCount = str_word_count($newText);

            if ($originalWordCount < 4 && $newWordCount >= 4) {
                error_log(
                    sprintf(
                        'Word count protection: Reverting selector %s in section %s from "%s" (%d words) back to "%s" (%d words)',
                        $selector,
                        $sectionId !== null ? (string)$sectionId : 'unknown',
                        $newText,
                        $newWordCount,
                        $originalText,
                        $originalWordCount
                    )
                );
                $textUpdates[$selector] = $originalText;
            }
        }
    }
    
    // Return success response
    echo json_encode([
        'success' => true,
        'text_updates' => $textUpdates,
        'section_id' => $sectionId
    ]);
    
} catch (Exception $e) {
    error_log("Error in generate-section-text.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'error' => 'Internal server error',
        'message' => $e->getMessage()
    ]);
}
?>

