<?php
declare(strict_types=1);

/**
 * Test page for AI Image Replacement functionality
 * Tests both generate-image-keywords.php and get-unsplash-image.php endpoints
 *
 * When accessed via browser: Shows an HTML interface with input/output display
 * When run via CLI: Runs the test and outputs results to console
 *
 * Usage (CLI): php tests/test-image-replacement.php
 * Usage (Browser): Open tests/test-image-replacement.php in a browser
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
    <title>Image Replacement Test</title>
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
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        .test-section {
            background: #fff;
            border-radius: 8px;
            padding: 24px;
            margin-bottom: 24px;
            border: 1px solid #e2e2e8;
        }
        textarea {
            width: 100%;
            min-height: 120px;
            padding: 12px;
            border-radius: 8px;
            border: 1px solid #d0d0d5;
            font-size: 14px;
            resize: vertical;
            font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
        }
        input[type="text"], input[type="number"] {
            width: 100%;
            padding: 10px;
            border-radius: 6px;
            border: 1px solid #d0d0d5;
            font-size: 14px;
            margin-bottom: 12px;
        }
        label {
            display: block;
            margin-bottom: 6px;
            font-weight: 500;
            font-size: 14px;
        }
        button {
            background: #1f5eff;
            color: #fff;
            border: none;
            border-radius: 8px;
            padding: 12px 20px;
            font-size: 16px;
            cursor: pointer;
            margin-right: 8px;
        }
        button:hover {
            background: #1a4fd9;
        }
        button[disabled] {
            opacity: 0.6;
            cursor: progress;
        }
        button.secondary {
            background: #6b7280;
        }
        button.secondary:hover {
            background: #4b5563;
        }
        pre {
            background: #f9fafb;
            border-radius: 8px;
            padding: 16px;
            border: 1px solid #e2e2e8;
            white-space: pre-wrap;
            word-break: break-word;
            font-size: 13px;
            line-height: 1.5;
            max-height: 600px;
            overflow-y: auto;
            margin: 0;
        }
        .error {
            color: #b00020;
            background: #fee;
            border-color: #fcc;
        }
        .success {
            color: #0a5d00;
            background: #efe;
            border-color: #cfc;
        }
        .info {
            background: #e3f2fd;
            border: 1px solid #90caf9;
            padding: 12px;
            border-radius: 6px;
            margin-bottom: 16px;
            font-size: 14px;
        }
        .grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
        }
        @media (max-width: 768px) {
            .grid {
                grid-template-columns: 1fr;
            }
        }
        .result-box {
            margin-top: 16px;
        }
        .result-box h3 {
            margin-top: 0;
            margin-bottom: 12px;
            font-size: 16px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🖼️ AI Image Replacement Test</h1>
        <p>Test the image replacement functionality: keyword generation and Unsplash image retrieval</p>

        <div class="info">
            <strong>Note:</strong> This test requires:
            <ul style="margin: 8px 0 0 0; padding-left: 20px;">
                <li><code>OPENAI_API_KEY</code> in .env file</li>
                <li><code>UNSPLASH_ACCESS_KEY</code> or <code>UNSPLASH_API_KEY</code> in .env file</li>
            </ul>
        </div>

        <!-- Test 1: Generate Image Keywords -->
        <div class="test-section">
            <h2>Test 1: Generate Image Keywords</h2>
            <p>Test the AI keyword generation endpoint</p>
            
            <form id="keywords-form">
                <label>Section Text (generated content):</label>
                <textarea id="section-text" placeholder="Enter the generated text content from a section...">Build stunning websites with PrebuiltUI Components. Explore a growing library of over 320+ beautifully crafted, customizable components. Get started today and create amazing websites in minutes.</textarea>
                
                <label>Creative Brief:</label>
                <textarea id="creative-brief" placeholder="Enter the creative brief...">A modern SaaS platform for building websites with pre-built components. Focus on productivity, ease of use, and professional design.</textarea>
                
                <label>Section Category:</label>
                <input type="text" id="section-category" value="hero" placeholder="hero, features, testimonials, etc.">
                
                <label>Image Count:</label>
                <input type="number" id="image-count" value="2" min="1" max="10">
                
                <button type="submit">Generate Keywords</button>
                <button type="button" class="secondary" onclick="loadExampleKeywords()">Load Example</button>
            </form>

            <div class="result-box" id="keywords-result" style="display: none;">
                <h3>Result:</h3>
                <pre id="keywords-output"></pre>
            </div>
        </div>

        <!-- Test 2: Get Unsplash Image -->
        <div class="test-section">
            <h2>Test 2: Get Unsplash Image</h2>
            <p>Test the Unsplash image retrieval endpoint</p>
            
            <form id="unsplash-form">
                <label>Search Query (keywords):</label>
                <input type="text" id="search-query" value="modern workspace technology" placeholder="e.g., modern workspace technology">
                
                <div class="grid">
                    <div>
                        <label>Width (px):</label>
                        <input type="number" id="image-width" value="800" min="100" max="4000">
                    </div>
                    <div>
                        <label>Height (px):</label>
                        <input type="number" id="image-height" value="600" min="100" max="4000">
                    </div>
                </div>
                
                <label>Aspect Ratio (optional):</label>
                <input type="number" id="aspect-ratio" value="1.33" step="0.01" placeholder="width/height">
                
                <button type="submit">Get Unsplash Image</button>
                <button type="button" class="secondary" onclick="loadExampleUnsplash()">Load Example</button>
            </form>

            <div class="result-box" id="unsplash-result" style="display: none;">
                <h3>Result:</h3>
                <pre id="unsplash-output"></pre>
                <div id="image-preview" style="margin-top: 16px;"></div>
            </div>
        </div>

        <!-- Test 3: Full Flow Test -->
        <div class="test-section">
            <h2>Test 3: Full Flow (Keywords → Image)</h2>
            <p>Test the complete flow: generate keywords then fetch image</p>
            
            <button type="button" onclick="runFullFlowTest()">Run Full Flow Test</button>
            
            <div class="result-box" id="fullflow-result" style="display: none;">
                <h3>Result:</h3>
                <pre id="fullflow-output"></pre>
                <div id="fullflow-image-preview" style="margin-top: 16px;"></div>
            </div>
        </div>
    </div>

    <script>
        // Test 1: Generate Keywords
        document.getElementById('keywords-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const sectionText = document.getElementById('section-text').value;
            const creativeBrief = document.getElementById('creative-brief').value;
            const sectionCategory = document.getElementById('section-category').value;
            const imageCount = parseInt(document.getElementById('image-count').value);

            const resultBox = document.getElementById('keywords-result');
            const output = document.getElementById('keywords-output');
            
            resultBox.style.display = 'block';
            output.textContent = 'Loading...';
            output.className = '';

            try {
                const response = await fetch('../api/generate-image-keywords.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        section_text: sectionText,
                        creative_brief: creativeBrief,
                        section_category: sectionCategory,
                        image_count: imageCount
                    })
                });

                const responseText = await response.text();
                let data;
                
                try {
                    data = JSON.parse(responseText);
                } catch (e) {
                    // Response is not JSON (likely HTML error page)
                    output.textContent = 'Error: Response is not valid JSON. Server returned:\n\n' + responseText.substring(0, 1000);
                    output.className = 'error';
                    return;
                }
                
                if (response.ok && data.success) {
                    output.textContent = JSON.stringify(data, null, 2);
                    output.className = 'success';
                } else {
                    output.textContent = JSON.stringify(data, null, 2);
                    output.className = 'error';
                }
            } catch (error) {
                output.textContent = 'Error: ' + error.message;
                output.className = 'error';
            }
        });

        // Test 2: Get Unsplash Image
        document.getElementById('unsplash-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const query = document.getElementById('search-query').value;
            const width = parseInt(document.getElementById('image-width').value);
            const height = parseInt(document.getElementById('image-height').value);
            const aspectRatio = parseFloat(document.getElementById('aspect-ratio').value) || null;

            const resultBox = document.getElementById('unsplash-result');
            const output = document.getElementById('unsplash-output');
            const preview = document.getElementById('image-preview');
            
            resultBox.style.display = 'block';
            output.textContent = 'Loading...';
            output.className = '';
            preview.innerHTML = '';

            try {
                const response = await fetch('../api/get-unsplash-image.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        query: query,
                        width: width,
                        height: height,
                        aspectRatio: aspectRatio
                    })
                });

                const responseText = await response.text();
                let data;
                
                try {
                    data = JSON.parse(responseText);
                } catch (e) {
                    // Response is not JSON (likely HTML error page)
                    output.textContent = 'Error: Response is not valid JSON. Server returned:\n\n' + responseText.substring(0, 1000);
                    output.className = 'error';
                    return;
                }
                
                if (response.ok && data.success) {
                    output.textContent = JSON.stringify(data, null, 2);
                    output.className = 'success';
                    
                    // Show image preview
                    if (data.imageUrl) {
                        preview.innerHTML = `
                            <strong>Image Preview:</strong><br>
                            <img src="${data.imageUrl}" alt="Unsplash preview" style="max-width: 100%; border-radius: 8px; margin-top: 8px; border: 1px solid #e2e2e8;">
                            <p style="margin-top: 8px; font-size: 12px; color: #6b7280;">
                                Photo by ${data.photographer || 'Unknown'}${data.photographerUrl ? ` (<a href="${data.photographerUrl}" target="_blank">view</a>)` : ''}
                            </p>
                        `;
                    }
                } else {
                    output.textContent = JSON.stringify(data, null, 2);
                    output.className = 'error';
                }
            } catch (error) {
                output.textContent = 'Error: ' + error.message;
                output.className = 'error';
            }
        });

        // Test 3: Full Flow
        async function runFullFlowTest() {
            const resultBox = document.getElementById('fullflow-result');
            const output = document.getElementById('fullflow-output');
            const preview = document.getElementById('fullflow-image-preview');
            
            resultBox.style.display = 'block';
            output.textContent = 'Running full flow test...\n\n';
            output.className = '';
            preview.innerHTML = '';

            const sectionText = "Build stunning websites with PrebuiltUI Components. Explore a growing library of over 320+ beautifully crafted, customizable components.";
            const creativeBrief = "A modern SaaS platform for building websites with pre-built components.";
            const sectionCategory = "hero";

            try {
                // Step 1: Generate keywords
                output.textContent += 'Step 1: Generating keywords...\n';
                const keywordsResponse = await fetch('../api/generate-image-keywords.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        section_text: sectionText,
                        creative_brief: creativeBrief,
                        section_category: sectionCategory,
                        image_count: 1
                    })
                });

                const keywordsResponseText = await keywordsResponse.text();
                let keywordsData;
                
                try {
                    keywordsData = JSON.parse(keywordsResponseText);
                } catch (e) {
                    output.textContent += 'ERROR: Response is not valid JSON. Server returned:\n\n' + keywordsResponseText.substring(0, 1000) + '\n';
                    output.className = 'error';
                    return;
                }
                
                if (!keywordsResponse.ok || !keywordsData.success) {
                    output.textContent += 'ERROR: ' + JSON.stringify(keywordsData, null, 2) + '\n';
                    output.className = 'error';
                    return;
                }

                output.textContent += 'Keywords generated: ' + JSON.stringify(keywordsData.keywords, null, 2) + '\n\n';

                // Step 2: Get image using first keyword set
                if (keywordsData.keywords && keywordsData.keywords.length > 0) {
                    const keywordSet = keywordsData.keywords[0];
                    const searchQuery = keywordSet.join(' ');
                    
                    output.textContent += 'Step 2: Fetching image for: "' + searchQuery + '"\n';
                    
                    const imageResponse = await fetch('../api/get-unsplash-image.php', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            query: searchQuery,
                            width: 800,
                            height: 600,
                            aspectRatio: 1.33
                        })
                    });

                    const imageResponseText = await imageResponse.text();
                    let imageData;
                    
                    try {
                        imageData = JSON.parse(imageResponseText);
                    } catch (e) {
                        output.textContent += 'ERROR: Response is not valid JSON. Server returned:\n\n' + imageResponseText.substring(0, 1000) + '\n';
                        output.className = 'error';
                        return;
                    }
                    
                    if (imageResponse.ok && imageData.success) {
                        output.textContent += 'Image URL: ' + imageData.imageUrl + '\n';
                        output.textContent += 'Photographer: ' + (imageData.photographer || 'Unknown') + '\n';
                        output.className = 'success';
                        
                        // Show image preview
                        if (imageData.imageUrl) {
                            preview.innerHTML = `
                                <strong>Generated Image:</strong><br>
                                <img src="${imageData.imageUrl}" alt="Unsplash preview" style="max-width: 100%; border-radius: 8px; margin-top: 8px; border: 1px solid #e2e2e8;">
                                <p style="margin-top: 8px; font-size: 12px; color: #6b7280;">
                                    Photo by ${imageData.photographer || 'Unknown'}${imageData.photographerUrl ? ` (<a href="${imageData.photographerUrl}" target="_blank">view</a>)` : ''}
                                </p>
                            `;
                        }
                    } else {
                        output.textContent += 'ERROR: ' + JSON.stringify(imageData, null, 2) + '\n';
                        output.className = 'error';
                    }
                } else {
                    output.textContent += 'ERROR: No keywords generated\n';
                    output.className = 'error';
                }
            } catch (error) {
                output.textContent += 'ERROR: ' + error.message + '\n';
                output.className = 'error';
            }
        }

        // Helper functions
        function loadExampleKeywords() {
            document.getElementById('section-text').value = `Build stunning websites with PrebuiltUI Components.

Explore a growing library of over 320+ beautifully crafted, customizable components. Get started today and create amazing websites in minutes.

Trusted by leading brands worldwide.`;
            document.getElementById('creative-brief').value = 'A modern SaaS platform for building websites with pre-built components. Focus on productivity, ease of use, and professional design. Target audience: web developers and designers.';
            document.getElementById('section-category').value = 'hero';
            document.getElementById('image-count').value = '2';
        }

        function loadExampleUnsplash() {
            document.getElementById('search-query').value = 'modern workspace technology laptop';
            document.getElementById('image-width').value = '1200';
            document.getElementById('image-height').value = '800';
            document.getElementById('aspect-ratio').value = '1.5';
        }
    </script>
</body>
</html>
    <?php
    exit;
}

// CLI Mode
echo "=== AI Image Replacement Test (CLI) ===\n\n";
echo "NOTE: For CLI testing, you need to run a local server first:\n";
echo "  php -S localhost:8000\n\n";
echo "Or open this file in a browser for interactive testing.\n\n";

// Try to detect if server is running
$testUrl = 'http://localhost:8000';
$ch = @curl_init($testUrl);
if ($ch) {
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 2);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 2);
    @curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    
    if ($httpCode > 0) {
        // Server seems to be running, proceed with tests
        runCliTests();
    } else {
        echo "❌ Could not connect to local server at $testUrl\n";
        echo "Please start a server first: php -S localhost:8000\n";
    }
} else {
    echo "❌ cURL not available. Please use browser mode for testing.\n";
}

function runCliTests() {
    // Test data
    $sectionText = "Build stunning websites with PrebuiltUI Components. Explore a growing library of over 320+ beautifully crafted, customizable components. Get started today and create amazing websites in minutes.";
    $creativeBrief = "A modern SaaS platform for building websites with pre-built components. Focus on productivity, ease of use, and professional design.";
    $sectionCategory = "hero";
    $imageCount = 2;

    echo "=== Test 1: Generate Image Keywords ===\n";
    echo "INPUT:\n";
    echo "  Section Text: " . substr($sectionText, 0, 80) . "...\n";
    echo "  Creative Brief: " . substr($creativeBrief, 0, 80) . "...\n";
    echo "  Category: $sectionCategory\n";
    echo "  Image Count: $imageCount\n\n";

    // Test generate-image-keywords.php
    $keywordsUrl = 'http://localhost:8000/api/generate-image-keywords.php';
    $keywordsData = [
        'section_text' => $sectionText,
        'creative_brief' => $creativeBrief,
        'section_category' => $sectionCategory,
        'image_count' => $imageCount
    ];

    $ch = curl_init($keywordsUrl);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode($keywordsData)
    ]);

    $keywordsResponse = curl_exec($ch);
    $keywordsHttpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

    echo "OUTPUT:\n";
    echo "  HTTP Status: $keywordsHttpCode\n";
    $keywordsResult = json_decode($keywordsResponse, true);

    if ($keywordsResult && isset($keywordsResult['success']) && $keywordsResult['success']) {
        echo "  ✅ SUCCESS\n";
        echo "  Keywords generated:\n";
        echo json_encode($keywordsResult['keywords'], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n\n";
        
        // Test 2: Get Unsplash Image
        if (isset($keywordsResult['keywords'][0]) && count($keywordsResult['keywords'][0]) > 0) {
            $searchQuery = implode(' ', $keywordsResult['keywords'][0]);
            
            echo "=== Test 2: Get Unsplash Image ===\n";
            echo "INPUT:\n";
            echo "  Search Query: $searchQuery\n";
            echo "  Dimensions: 800x600\n";
            echo "  Aspect Ratio: 1.33\n\n";
            
            $unsplashUrl = 'http://localhost:8000/api/get-unsplash-image.php';
            $unsplashData = [
                'query' => $searchQuery,
                'width' => 800,
                'height' => 600,
                'aspectRatio' => 1.33
            ];
            
            $ch = curl_init($unsplashUrl);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_POST => true,
                CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
                CURLOPT_POSTFIELDS => json_encode($unsplashData)
            ]);
            
            $unsplashResponse = curl_exec($ch);
            $unsplashHttpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            
            echo "OUTPUT:\n";
            echo "  HTTP Status: $unsplashHttpCode\n";
            $unsplashResult = json_decode($unsplashResponse, true);
            
            if ($unsplashResult && isset($unsplashResult['success']) && $unsplashResult['success']) {
                echo "  ✅ SUCCESS\n";
                echo "  Image URL: " . $unsplashResult['imageUrl'] . "\n";
                echo "  Photographer: " . ($unsplashResult['photographer'] ?? 'Unknown') . "\n";
                if (isset($unsplashResult['unsplashId'])) {
                    echo "  Unsplash ID: " . $unsplashResult['unsplashId'] . "\n";
                }
                if (isset($unsplashResult['description'])) {
                    echo "  Description: " . substr($unsplashResult['description'], 0, 100) . "...\n";
                }
            } else {
                echo "  ❌ FAILED\n";
                echo "  Response: " . $unsplashResponse . "\n";
            }
        }
    } else {
        echo "  ❌ FAILED\n";
        echo "  Response: " . $keywordsResponse . "\n";
    }

    echo "\n=== Test Complete ===\n";
}
?>

