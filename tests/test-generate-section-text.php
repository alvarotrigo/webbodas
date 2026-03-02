<?php
declare(strict_types=1);

/**
 * Test page to call api/generate-section-text.php with the fp-theme-welcome section.
 *
 * When accessed via browser: Shows an HTML interface with input/output display
 * When run via CLI: Runs the test and outputs results to console
 *
 * Usage (CLI): php tests/test-generate-section-text.php
 * Usage (Browser): Open tests/test-generate-section-text.php in a browser
 *
 * This test includes allowed_selectors with text content to verify the new
 * functionality that provides AI with length/style reference for each element.
 */

// Check if running from CLI or browser
$isCli = php_sapi_name() === 'cli';

if (!$isCli) {
    // Output HTML interface
    header('Content-Type: text/html; charset=utf-8');
    ?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Section Text Generation Test</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
            margin: 0;
            padding: 24px;
            background: #f7f7f9;
            color: #1a1a1a;
        }
        h1, h2 {
            margin-top: 0;
        }
        textarea {
            width: 100%;
            min-height: 140px;
            padding: 12px;
            border-radius: 8px;
            border: 1px solid #d0d0d5;
            font-size: 15px;
            resize: vertical;
            font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
        }
        button {
            background: #1f5eff;
            color: #fff;
            border: none;
            border-radius: 8px;
            padding: 12px 20px;
            font-size: 16px;
            cursor: pointer;
        }
        button[disabled] {
            opacity: 0.6;
            cursor: progress;
        }
        .results {
            display: grid;
            gap: 16px;
            margin-top: 24px;
        }
        pre {
            background: #fff;
            border-radius: 8px;
            padding: 16px;
            border: 1px solid #e2e2e8;
            white-space: pre-wrap;
            word-break: break-word;
            font-size: 14px;
            line-height: 1.5;
            max-height: 500px;
            overflow-y: auto;
        }
        .error {
            color: #b00020;
        }
        .history {
            margin-top: 32px;
        }
        .history-item {
            background: #ffffff;
            border-radius: 8px;
            padding: 12px;
            border: 1px solid #e2e2e8;
            margin-bottom: 12px;
        }
        .history-item pre {
            margin-top: 8px;
            max-height: 300px;
        }
        .input-section {
            background: #fff;
            border-radius: 8px;
            padding: 16px;
            border: 1px solid #e2e2e8;
            margin-bottom: 16px;
        }
        .input-section h3 {
            margin-top: 0;
            margin-bottom: 12px;
        }
        .input-section label {
            display: block;
            margin-bottom: 8px;
            font-weight: 600;
        }
        .collapsible {
            cursor: pointer;
            user-select: none;
        }
        .collapsible::before {
            content: '▼ ';
            display: inline-block;
            transition: transform 0.2s;
        }
        .collapsible.collapsed::before {
            transform: rotate(-90deg);
        }
        .collapsible-content {
            max-height: 1000px;
            overflow: hidden;
            transition: max-height 0.3s ease-out;
        }
        .collapsible-content.collapsed {
            max-height: 0;
        }
        .info-text {
            color: #666;
            font-size: 14px;
            margin-top: 8px;
        }
    </style>
</head>
<body>
    <h1>Section Text Generation Test</h1>
    <p>Use this page to test the section text generation API call in <code>api/generate-section-text.php</code>. The test uses the <code>fp-theme-welcome</code> section by default.</p>

    <div class="input-section">
        <h3>Test Configuration</h3>
        <label for="section-id">Section ID:</label>
        <div style="display: flex; gap: 8px; margin-bottom: 8px;">
            <input type="text" id="section-id" value="fp-theme-welcome" style="flex: 1; padding: 8px; border-radius: 4px; border: 1px solid #d0d0d5;">
            <button id="load-section-btn" style="padding: 8px 16px; white-space: nowrap;">Load Section</button>
        </div>
        <p class="info-text">Changing the section ID will automatically load the section HTML and allowed selectors after 500ms, or click "Load Section" to load immediately.</p>
    </div>

    <div class="input-section">
        <h3>Creative Brief</h3>
        <textarea id="creative-brief" placeholder="Enter creative brief JSON..."></textarea>
    </div>

    <div class="input-section">
        <h3>Blueprint</h3>
        <textarea id="blueprint" placeholder="Enter blueprint text..."></textarea>
    </div>

    <div class="input-section">
        <h3 class="collapsible" onclick="toggleCollapse(this)">Section HTML (click to expand/collapse)</h3>
        <div class="collapsible-content">
            <pre id="section-html"></pre>
        </div>
    </div>

    <div class="input-section">
        <h3 class="collapsible collapsed" onclick="toggleCollapse(this)">Allowed Selectors (click to expand/collapse)</h3>
        <div class="collapsible-content collapsed">
            <pre id="allowed-selectors"></pre>
        </div>
    </div>

    <div style="margin-top: 12px;">
        <button id="run-test">Generate Section Text</button>
    </div>
    <p id="status" role="status"></p>

    <div class="results">
        <div>
            <h2>Input Payload (sent to API)</h2>
            <pre id="input-payload">Waiting for request...</pre>
        </div>
        <div>
            <h2>API Response (raw) <span id="api-response-time"></span></h2>
            <pre id="api-response">Waiting for request...</pre>
        </div>
        <div>
            <h2>Text Updates (parsed) <span id="text-updates-time"></span></h2>
            <pre id="text-updates">-</pre>
        </div>
    </div>

    <section class="history">
        <h2>History (latest first)</h2>
        <div id="history-list"></div>
    </section>

    <script>
        const runButton = document.getElementById('run-test');
        const sectionIdInput = document.getElementById('section-id');
        const loadSectionBtn = document.getElementById('load-section-btn');
        const creativeBriefInput = document.getElementById('creative-brief');
        const blueprintInput = document.getElementById('blueprint');
        const sectionHtmlEl = document.getElementById('section-html');
        const allowedSelectorsEl = document.getElementById('allowed-selectors');
        const inputPayloadEl = document.getElementById('input-payload');
        const apiResponseEl = document.getElementById('api-response');
        const apiResponseTimeEl = document.getElementById('api-response-time');
        const textUpdatesEl = document.getElementById('text-updates');
        const textUpdatesTimeEl = document.getElementById('text-updates-time');
        const statusEl = document.getElementById('status');
        const historyList = document.getElementById('history-list');

        // Default values
        const defaultCreativeBrief = <?php
$projectRoot = dirname(__DIR__);
$sectionPath = $projectRoot . '/sections/fp-theme-welcome.html';
$selectorsPath = $projectRoot . '/public/js/section-allowed-selectors.json';

$sectionHtml = file_exists($sectionPath) ? file_get_contents($sectionPath) : '';
$selectorsJson = file_exists($selectorsPath) ? file_get_contents($selectorsPath) : '{}';
$selectorsData = json_decode($selectorsJson, true);
$sectionId = 'fp-theme-welcome';
$allowedSelectors = $selectorsData[$sectionId] ?? [];

$defaultCreativeBrief = [
    'project' => [
        'title' => 'Front-End Developer Portfolio',
        'description' => 'A personal portfolio website showcasing the skills, projects, and expertise of a front-end developer seeking job opportunities.',
        'product_type' => 'personal brand',
    ],
    'audience' => [
        'primary' => [
            'potential employers',
            'recruiters',
            'tech companies',
        ],
        'pain_points' => [
            'finding qualified candidates',
            'understanding candidate skills',
            'evaluating project experience',
        ],
        'desired_outcomes' => [
            'impressed by skills',
            'invited for interviews',
            'understanding of my work style',
        ],
    ],
    'brand' => [
        'name' => 'John Doe',
        'voice' => 'confident-modern',
    ],
    'goals' => [
        'primary_goal' => 'contact',
        'secondary_goals' => [
            'trust-building',
            'awareness',
        ],
        'conversion_action' => 'Get in Touch',
    ],
    'value_proposition' => [
        'core' => 'I create responsive and engaging web experiences that enhance user interaction and satisfaction.',
        'key_features' => [
            'portfolio of projects',
            'skills showcase',
            'contact form for inquiries',
        ],
        'differentiators' => [
            'strong focus on user experience',
            'proficient in modern front-end technologies',
            'creative design approach',
        ],
    ],
    'content_preferences' => [
        'language' => 'en',
        'keywords' => [
            'front-end developer',
            'portfolio',
            'web development',
            'JavaScript',
            'CSS',
            'HTML',
        ],
    ],
    'cta' => [
        [
            'label_hint' => 'View My Work',
            'url' => '/portfolio',
            'priority' => 1,
        ],
        [
            'label_hint' => 'Contact Me',
            'url' => '/contact',
            'priority' => 2,
        ],
    ],
    'inference' => [
        'confidence' => 0.85,
        'assumptions' => [
            'Industry: technology',
            'Locale: global',
            'Job seeking: entry to mid-level positions',
        ],
    ],
];

echo json_encode($defaultCreativeBrief, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
?>;
        const defaultBlueprint = 'Hero section — introduce the brand or product with a clear value proposition and an action-driven headline.';
        const defaultSectionHtml = <?php echo json_encode($sectionHtml, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE); ?>;
        const defaultAllowedSelectors = <?php echo json_encode($allowedSelectors, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE); ?>;

        // Current section data (will be updated when section ID changes)
        let currentSectionHtml = defaultSectionHtml;
        let currentAllowedSelectors = defaultAllowedSelectors;
        let allowedSelectorsMap = {}; // Full map of all sections' selectors
        let loadedSectionId = 'fp-theme-welcome'; // Track which section is currently loaded

        // Initialize with default values
        creativeBriefInput.value = JSON.stringify(defaultCreativeBrief, null, 2);
        blueprintInput.value = defaultBlueprint;
        sectionHtmlEl.textContent = defaultSectionHtml;
        allowedSelectorsEl.textContent = JSON.stringify(defaultAllowedSelectors, null, 2);

        // Blueprint mapping function (matches api/generate-section-text.php)
        function getSectionBlueprint(category) {
            const blueprints = {
                "hero": "Hero section — introduce the brand or product with a clear value proposition and an action-driven headline.",
                "features": "Features section — list the main benefits or features clearly, emphasizing user value and simplicity.",
                "testimonials": "Testimonials section — add authentic-sounding quotes or stories that build trust and credibility.",
                "pricing": "Pricing section — explain available plans or options transparently and motivate conversion.",
                "team": "Team section — present key people with short bios that highlight expertise and human connection.",
                "gallery": "Gallery section — describe or caption images in a way that supports storytelling or visual appeal.",
                "portfolio": "Portfolio section — showcase selected work or projects, focusing on outcomes and quality.",
                "contact": "Contact section — invite users to reach out, book, or connect in a friendly, encouraging tone.",
                "forms": "Form section — introduce a form briefly, explaining what users get by submitting it.",
                "about": "About section — explain who the brand or person is, their mission, and what makes them unique.",
                "faqs": "FAQ section — answer frequent questions clearly and concisely to remove friction or hesitation.",
                "how it works": "How-it-works section — explain the process in simple, step-by-step terms.",
                "stats": "Stats section — present metrics or achievements that demonstrate credibility or success.",
                "media": "Media section — provide media coverage, press quotes, or content embeds showing authority.",
                "video": "Video section — introduce the video context and encourage viewers to watch or learn more.",
                "applications": "Applications section — describe use cases or industries where the product applies.",
                "logo clouds": "Logo cloud section — list partner or client logos to build trust and social proof.",
                "newsletter": "Newsletter section — invite users to subscribe with a clear benefit statement.",
                "cta": "CTA section — end with a strong, motivational call-to-action tied to the main goal.",
                "events": "Events section — highlight upcoming or past events, dates, and participation details.",
                "comparison": "Comparison section — contrast plans or features to guide users toward the best choice.",
                "content": "Content section — deliver informational or narrative text that supports brand storytelling.",
                "footer": "Footer section — include closing navigation, contact info, and reassurance about trust or brand identity.",
                "blog": "Blog section — preview recent articles or insights, written in a conversational and engaging tone.",
                "integrations": "Integrations section — describe key tools or services that connect with the product seamlessly."
            };
            const key = category.toLowerCase().trim();
            return blueprints[key] || blueprints["content"];
        }

        // Determine category from section ID/file name
        function getCategoryFromSectionId(sectionId) {
            const id = sectionId.toLowerCase();
            
            // Direct matches
            if (id.includes('hero')) return 'hero';
            if (id.includes('welcome')) return 'hero';
            if (id.includes('intro')) return 'hero';
            if (id.includes('feature')) return 'features';
            if (id.includes('testimonial')) return 'testimonials';
            if (id.includes('pricing')) return 'pricing';
            if (id.includes('team')) return 'team';
            if (id.includes('gallery')) return 'gallery';
            if (id.includes('portfolio')) return 'portfolio';
            if (id.includes('contact')) return 'contact';
            if (id.includes('form') || id.includes('signup') || id.includes('sign-up')) return 'forms';
            if (id.includes('about')) return 'about';
            if (id.includes('faq')) return 'faqs';
            if (id.includes('how-it-works') || id.includes('how_it_works') || id.includes('steps') || id.includes('process') || id.includes('guide') || id.includes('onboarding') || id.includes('understanding')) return 'how it works';
            if (id.includes('stats') || id.includes('stat')) return 'stats';
            if (id.includes('video')) return 'video';
            if (id.includes('application')) return 'applications';
            if (id.includes('logo') || id.includes('trusted')) return 'logo clouds';
            if (id.includes('newsletter')) return 'newsletter';
            if (id.includes('cta') || id.includes('call-to-action')) return 'cta';
            if (id.includes('event')) return 'events';
            if (id.includes('comparison') || id.includes('compare')) return 'comparison';
            if (id.includes('footer')) return 'footer';
            if (id.includes('blog')) return 'blog';
            if (id.includes('integration')) return 'integrations';
            
            // Default to content
            return 'content';
        }

        // Load sections metadata to get accurate category
        let sectionsMetadata = null;
        async function loadSectionsMetadata() {
            if (sectionsMetadata) return sectionsMetadata;
            
            try {
                const response = await fetch('../public/js/metadata.js');
                if (response.ok) {
                    const text = await response.text();
                    // Parse the JSON array from metadata.js
                    const jsonMatch = text.match(/\[[\s\S]*\]/);
                    if (jsonMatch) {
                        sectionsMetadata = JSON.parse(jsonMatch[0]);
                        return sectionsMetadata;
                    }
                }
            } catch (error) {
                console.warn('Could not load sections metadata:', error);
            }
            return null;
        }

        // Get category for a section by matching file name
        async function getCategoryForSection(sectionId) {
            // Try to load metadata first for accurate category
            const metadata = await loadSectionsMetadata();
            if (metadata) {
                // Find section by matching file name pattern
                // Section IDs in metadata are numeric, but we need to match by file name
                // We'll use the sectionId to infer, or check if there's a file field
                // For now, fall back to pattern matching
            }
            
            // Fall back to pattern matching from section ID
            return getCategoryFromSectionId(sectionId);
        }

        // Load allowed selectors map once
        async function loadAllowedSelectorsMap() {
            try {
                const response = await fetch('../public/js/section-allowed-selectors.json');
                if (response.ok) {
                    allowedSelectorsMap = await response.json();
                } else {
                    console.warn('Failed to load allowed selectors map');
                }
            } catch (error) {
                console.error('Error loading allowed selectors map:', error);
            }
        }

        // Load section data based on section ID
        async function loadSectionData(sectionId) {
            if (!sectionId || !sectionId.trim()) {
                statusEl.textContent = 'Please enter a section ID.';
                statusEl.className = 'error';
                return false;
            }

            statusEl.textContent = `Loading section data for "${sectionId}"...`;
            statusEl.className = '';

            try {
                // Load section HTML
                const htmlResponse = await fetch(`../sections/${sectionId}.html`);
                if (!htmlResponse.ok) {
                    throw new Error(`Section HTML not found: ${sectionId}.html (HTTP ${htmlResponse.status})`);
                }
                currentSectionHtml = await htmlResponse.text();
                sectionHtmlEl.textContent = currentSectionHtml;

                // Load allowed selectors for this section
                if (Object.keys(allowedSelectorsMap).length === 0) {
                    await loadAllowedSelectorsMap();
                }

                currentAllowedSelectors = allowedSelectorsMap[sectionId] || {};
                allowedSelectorsEl.textContent = JSON.stringify(currentAllowedSelectors, null, 2);

                // Determine category and update blueprint
                const category = await getCategoryForSection(sectionId);
                const blueprint = getSectionBlueprint(category);
                blueprintInput.value = blueprint;

                // Track that this section is now loaded
                loadedSectionId = sectionId;

                if (Object.keys(currentAllowedSelectors).length === 0) {
                    statusEl.textContent = `Warning: No allowed selectors found for "${sectionId}". The section HTML was loaded successfully. Blueprint updated for category: ${category}.`;
                    statusEl.className = '';
                } else {
                    statusEl.textContent = `Loaded section "${sectionId}" with ${Object.keys(currentAllowedSelectors).length} allowed selectors. Blueprint updated for category: ${category}.`;
                    statusEl.className = '';
                }

                return true;
            } catch (error) {
                statusEl.textContent = `Error loading section: ${error.message}`;
                statusEl.className = 'error';
                console.error('Error loading section data:', error);
                return false;
            }
        }

        // Load allowed selectors map on page load
        loadAllowedSelectorsMap();

        // Load section data when section ID changes
        let sectionIdTimeout;
        sectionIdInput.addEventListener('input', (event) => {
            clearTimeout(sectionIdTimeout);
            const sectionId = event.target.value.trim();
            
            // Debounce the loading
            sectionIdTimeout = setTimeout(() => {
                if (sectionId) {
                    loadSectionData(sectionId);
                } else {
                    // Reset to defaults if empty
                    currentSectionHtml = defaultSectionHtml;
                    currentAllowedSelectors = defaultAllowedSelectors;
                    loadedSectionId = 'fp-theme-welcome';
                    sectionHtmlEl.textContent = defaultSectionHtml;
                    allowedSelectorsEl.textContent = JSON.stringify(defaultAllowedSelectors, null, 2);
                    blueprintInput.value = defaultBlueprint;
                    statusEl.textContent = '';
                    statusEl.className = '';
                }
            }, 500); // Wait 500ms after user stops typing
        });

        // Manual load button
        loadSectionBtn.addEventListener('click', () => {
            const sectionId = sectionIdInput.value.trim();
            if (sectionId) {
                clearTimeout(sectionIdTimeout);
                loadSectionData(sectionId);
            } else {
                statusEl.textContent = 'Please enter a section ID.';
                statusEl.className = 'error';
            }
        });

        function toggleCollapse(element) {
            element.classList.toggle('collapsed');
            const content = element.nextElementSibling;
            content.classList.toggle('collapsed');
        }

        async function callApi() {
            const sectionId = sectionIdInput.value.trim();
            if (!sectionId) {
                statusEl.textContent = 'Please enter a section ID.';
                statusEl.className = 'error';
                return;
            }

            // Ensure section data is loaded for the current section ID
            if (loadedSectionId !== sectionId) {
                statusEl.textContent = 'Loading section data...';
                statusEl.className = '';
                const loaded = await loadSectionData(sectionId);
                if (!loaded) {
                    statusEl.textContent = 'Failed to load section data. Please check the section ID and try again.';
                    statusEl.className = 'error';
                    return;
                }
            }

            let creativeBrief;
            try {
                creativeBrief = JSON.parse(creativeBriefInput.value.trim());
            } catch (e) {
                statusEl.textContent = 'Invalid creative brief JSON: ' + e.message;
                statusEl.className = 'error';
                return;
            }

            const blueprint = blueprintInput.value.trim();
            if (!blueprint) {
                statusEl.textContent = 'Please enter a blueprint.';
                statusEl.className = 'error';
                return;
            }

            const payload = {
                creative_brief: creativeBrief,
                blueprint: blueprint,
                section_html: currentSectionHtml,
                section_id: sectionId,
                allowed_selectors: currentAllowedSelectors,
            };

            // Show input payload
            inputPayloadEl.textContent = JSON.stringify(payload, null, 2);

            runButton.disabled = true;
            statusEl.textContent = 'Calling /api/generate-section-text.php...';
            statusEl.className = '';
            apiResponseEl.textContent = 'Loading...';
            apiResponseTimeEl.textContent = '';
            textUpdatesEl.textContent = '-';
            textUpdatesTimeEl.textContent = '';

            try {
                const startTime = performance.now();
                const response = await fetch('../api/generate-section-text.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                const endTime = performance.now();
                const duration = ((endTime - startTime) / 1000).toFixed(2);

                const resultText = await response.text();
                apiResponseEl.textContent = resultText;
                apiResponseTimeEl.textContent = `(${duration}s)`;
                apiResponseTimeEl.style.color = '#666';
                apiResponseTimeEl.style.fontSize = '0.85em';
                apiResponseTimeEl.style.fontWeight = 'normal';

                if (!response.ok) {
                    statusEl.textContent = `Request failed (${duration}s). Check the API response above.`;
                    statusEl.className = 'error';
                    return;
                }

                const resultJson = JSON.parse(resultText);
                statusEl.textContent = `Success! (${duration}s)`;
                statusEl.className = '';

                if (resultJson.text_updates) {
                    textUpdatesEl.textContent = JSON.stringify(resultJson.text_updates, null, 2);
                } else {
                    textUpdatesEl.textContent = JSON.stringify(resultJson, null, 2);
                }
                textUpdatesTimeEl.textContent = `(${duration}s)`;
                textUpdatesTimeEl.style.color = '#666';
                textUpdatesTimeEl.style.fontSize = '0.85em';
                textUpdatesTimeEl.style.fontWeight = 'normal';

                // Add to history
                const historyItem = document.createElement('div');
                historyItem.className = 'history-item';
                historyItem.innerHTML = `
                    <strong>Section ID:</strong> ${sectionId}<br>
                    <strong>Duration:</strong> ${duration}s<br>
                    <strong>Blueprint:</strong>
                    <pre>${blueprint}</pre>
                    <strong>Text Updates:</strong>
                    <pre>${JSON.stringify(resultJson.text_updates || resultJson, null, 2)}</pre>
                `;
                historyList.prepend(historyItem);
            } catch (error) {
                statusEl.textContent = 'Error: ' + error.message;
                statusEl.className = 'error';
                console.error(error);
            } finally {
                runButton.disabled = false;
            }
        }

        runButton.addEventListener('click', callApi);
        
        // Allow Cmd+Enter to submit
        creativeBriefInput.addEventListener('keydown', (event) => {
            if (event.metaKey && event.key.toLowerCase() === 'enter') {
                callApi();
            }
        });
        blueprintInput.addEventListener('keydown', (event) => {
            if (event.metaKey && event.key.toLowerCase() === 'enter') {
                callApi();
            }
        });
    </script>
</body>
</html>
    <?php
    exit;
}

// CLI mode - original functionality preserved
$projectRoot = dirname(__DIR__);
$sectionPath = $projectRoot . '/sections/fp-theme-welcome.html';
$selectorsPath = $projectRoot . '/public/js/section-allowed-selectors.json';

if (!file_exists($sectionPath)) {
    fwrite(STDERR, "Section HTML not found at {$sectionPath}\n");
    exit(1);
}

if (!file_exists($selectorsPath)) {
    fwrite(STDERR, "Allowed selectors JSON not found at {$selectorsPath}\n");
    exit(1);
}

$sectionHtml = file_get_contents($sectionPath);

// Load allowed selectors from JSON file
$selectorsJson = file_get_contents($selectorsPath);
$selectorsData = json_decode($selectorsJson, true);

if ($selectorsData === null || json_last_error() !== JSON_ERROR_NONE) {
    fwrite(STDERR, "Failed to parse allowed selectors JSON: " . json_last_error_msg() . PHP_EOL);
    exit(1);
}

// Extract selectors for fp-theme-welcome section
$sectionId = 'fp-theme-welcome';
$allowedSelectors = $selectorsData[$sectionId] ?? [];

if (empty($allowedSelectors)) {
    fwrite(STDERR, "No allowed selectors found for section: {$sectionId}\n");
    exit(1);
}

echo "Found " . count($allowedSelectors) . " allowed selectors for section: {$sectionId}\n";
echo "Selectors: " . implode(', ', array_keys($allowedSelectors)) . "\n\n";

$payload = [
    'creative_brief' => [
        'project' => [
            'title' => 'Front-End Developer Portfolio',
            'description' => 'A personal portfolio website showcasing the skills, projects, and expertise of a front-end developer seeking job opportunities.',
            'product_type' => 'personal brand',
        ],
        'audience' => [
            'primary' => [
                'potential employers',
                'recruiters',
                'tech companies',
            ],
            'pain_points' => [
                'finding qualified candidates',
                'understanding candidate skills',
                'evaluating project experience',
            ],
            'desired_outcomes' => [
                'impressed by skills',
                'invited for interviews',
                'understanding of my work style',
            ],
        ],
        'brand' => [
            'name' => 'John Doe',
            'voice' => 'confident-modern',
        ],
        'goals' => [
            'primary_goal' => 'contact',
            'secondary_goals' => [
                'trust-building',
                'awareness',
            ],
            'conversion_action' => 'Get in Touch',
        ],
        'value_proposition' => [
            'core' => 'I create responsive and engaging web experiences that enhance user interaction and satisfaction.',
            'key_features' => [
                'portfolio of projects',
                'skills showcase',
                'contact form for inquiries',
            ],
            'differentiators' => [
                'strong focus on user experience',
                'proficient in modern front-end technologies',
                'creative design approach',
            ],
        ],
        'content_preferences' => [
            'language' => 'en',
            'keywords' => [
                'front-end developer',
                'portfolio',
                'web development',
                'JavaScript',
                'CSS',
                'HTML',
            ],
        ],
        'cta' => [
            [
                'label_hint' => 'View My Work',
                'url' => '/portfolio',
                'priority' => 1,
            ],
            [
                'label_hint' => 'Contact Me',
                'url' => '/contact',
                'priority' => 2,
            ],
        ],
        'inference' => [
            'confidence' => 0.85,
            'assumptions' => [
                'Industry: technology',
                'Locale: global',
                'Job seeking: entry to mid-level positions',
            ],
        ],
    ],
    'blueprint' => 'Hero section — introduce the brand or product with a clear value proposition and an action-driven headline.',
    'section_html' => $sectionHtml,
    'section_id' => 47,
    'allowed_selectors' => $allowedSelectors,
];

echo "\n=== INPUT PAYLOAD ===\n";
echo json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n\n";

$payloadJson = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

if ($payloadJson === false) {
    fwrite(STDERR, "Failed to encode payload JSON: " . json_last_error_msg() . PHP_EOL);
    exit(1);
}

echo "Payload size: " . strlen($payloadJson) . " bytes\n";

$host = '127.0.0.1';
$port = 8125;
$serverCmd = sprintf(
    'php -S %s:%d -t %s',
    $host,
    $port,
    escapeshellarg($projectRoot)
);

$descriptorSpec = [
    0 => ['pipe', 'r'],
    1 => ['pipe', 'w'],
    2 => ['pipe', 'w'],
];

echo "Starting PHP built-in server on {$host}:{$port}...\n";
$serverProcess = proc_open($serverCmd, $descriptorSpec, $pipes, $projectRoot);

if (!is_resource($serverProcess)) {
    fwrite(STDERR, "Failed to start PHP built-in server\n");
    exit(1);
}

// Close STDIN pipe; we don't need it.
fclose($pipes[0]);

// Wait for the server to boot.
$started = false;
$timeout = microtime(true) + 5;
while (!$started && microtime(true) < $timeout) {
    $connection = @fsockopen($host, $port);
    if ($connection) {
        fclose($connection);
        $started = true;
        break;
    }
    usleep(100000);
}

if (!$started) {
    // Read any error output from the server
    $serverOutput = '';
    $serverError = '';
    if (isset($pipes[1])) {
        stream_set_blocking($pipes[1], false);
        $serverOutput = stream_get_contents($pipes[1]);
    }
    if (isset($pipes[2])) {
        stream_set_blocking($pipes[2], false);
        $serverError = stream_get_contents($pipes[2]);
    }
    
    fwrite(STDERR, "Server did not start within 5 seconds.\n");
    if ($serverOutput) {
        fwrite(STDERR, "Server stdout: {$serverOutput}\n");
    }
    if ($serverError) {
        fwrite(STDERR, "Server stderr: {$serverError}\n");
    }
    terminateServer($serverProcess, $pipes);
    exit(1);
}

$url = sprintf('http://%s:%d/api/generate-section-text.php', $host, $port);
echo "Sending POST request to {$url}...\n";

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
    CURLOPT_POSTFIELDS => $payloadJson,
    CURLOPT_VERBOSE => false,
]);

$responseBody = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
$curlErrno = curl_errno($ch);

// Read any server output before terminating
$serverOutput = '';
$serverError = '';
if (isset($pipes[1])) {
    stream_set_blocking($pipes[1], false);
    $serverOutput = stream_get_contents($pipes[1]);
}
if (isset($pipes[2])) {
    stream_set_blocking($pipes[2], false);
    $serverError = stream_get_contents($pipes[2]);
}

terminateServer($serverProcess, $pipes);

if ($responseBody === false) {
    fwrite(STDERR, "cURL error ({$curlErrno}): {$curlError}\n");
    if ($serverOutput) {
        fwrite(STDERR, "\nServer stdout:\n{$serverOutput}\n");
    }
    if ($serverError) {
        fwrite(STDERR, "\nServer stderr:\n{$serverError}\n");
    }
    exit(1);
}

echo "\n=== API RESPONSE (HTTP {$httpCode}) ===\n";

if ($httpCode !== 200) {
    echo "ERROR: HTTP status code is {$httpCode}\n";
}

// Try to decode and beautify the JSON response
$responseData = json_decode($responseBody, true);
if ($responseData !== null && json_last_error() === JSON_ERROR_NONE) {
    echo json_encode($responseData, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n";
    
    if (isset($responseData['text_updates'])) {
        echo "\n=== TEXT UPDATES (parsed) ===\n";
        echo json_encode($responseData['text_updates'], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n";
    }
} else {
    // If it's not valid JSON, just output as-is
    echo "Raw response (not JSON):\n";
    echo $responseBody . "\n";
    if (json_last_error() !== JSON_ERROR_NONE) {
        echo "\nJSON decode error: " . json_last_error_msg() . "\n";
    }
}

if ($serverOutput) {
    echo "\n=== SERVER OUTPUT ===\n";
    echo $serverOutput . "\n";
}

if ($serverError) {
    echo "\n=== SERVER ERRORS ===\n";
    echo $serverError . "\n";
}

echo "\n=== END RESPONSE ===\n";

/**
 * Terminate the PHP built-in server process and close pipes.
 *
 * @param resource $process
 * @param array<int, resource> $pipes
 */
function terminateServer($process, array $pipes): void
{
    foreach ($pipes as $pipe) {
        if (is_resource($pipe)) {
            fclose($pipe);
        }
    }

    if (is_resource($process)) {
        proc_terminate($process);
        proc_close($process);
    }
}

