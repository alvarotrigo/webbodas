<?php
declare(strict_types=1);

/**
 * Build script to generate metadata for section screenshots using OpenAI Vision API.
 *
 * When accessed via browser: Shows an HTML interface with batch processing controls
 * When run via CLI: Not supported (browser-only interface)
 *
 * Usage (Browser): Open build/generate-section-metadata.php in a browser
 *
 * Features:
 * - Select batch size (1-10 images per batch)
 * - Select number of batches to process
 * - Process single section by ID
 * - Parallel batch processing
 * - Scrollable JSON output
 */

// Check if running from CLI or browser
$isCli = php_sapi_name() === 'cli';

if ($isCli) {
    fwrite(STDERR, "This script is designed for browser use only.\n");
    fwrite(STDERR, "Please open build/generate-section-metadata.php in a browser.\n");
    exit(1);
}

// Output HTML interface
header('Content-Type: text/html; charset=utf-8');

$projectRoot = dirname(__DIR__);
$screenshotsPath = $projectRoot . '/screenshots';

// Load sections map
require_once $projectRoot . '/config/sections-map.php';

// Get list of screenshot files
$screenshotFiles = [];
if (is_dir($screenshotsPath)) {
    $files = scandir($screenshotsPath);
    foreach ($files as $file) {
        if (preg_match('/^(\d+)\.jpg$/i', $file, $matches)) {
            $sectionId = (int)$matches[1];
            $screenshotFiles[] = [
                'id' => $sectionId,
                'filename' => $file,
                'path' => $screenshotsPath . '/' . $file,
                'has_html' => getSectionHtml($sectionId) !== null
            ];
        }
    }
    // Sort by ID descending (newest first)
    usort($screenshotFiles, function($a, $b) {
        return $b['id'] - $a['id'];
    });
}

?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Section Screenshot Metadata Generator</title>
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
            min-height: 200px;
            padding: 12px;
            border-radius: 8px;
            border: 1px solid #d0d0d5;
            font-size: 14px;
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
            margin-right: 8px;
        }
        button:hover {
            background: #1a4fcc;
        }
        button[disabled] {
            opacity: 0.6;
            cursor: progress;
        }
        button.secondary {
            background: #666;
        }
        button.secondary:hover {
            background: #555;
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
        .input-group {
            display: flex;
            gap: 12px;
            align-items: center;
            margin-bottom: 12px;
        }
        .input-group label {
            margin-bottom: 0;
            min-width: 120px;
        }
        .input-group input[type="number"] {
            padding: 8px;
            border-radius: 4px;
            border: 1px solid #d0d0d5;
            width: 80px;
        }
        .input-group input[type="text"] {
            padding: 8px;
            border-radius: 4px;
            border: 1px solid #d0d0d5;
            flex: 1;
        }
        .info-text {
            color: #666;
            font-size: 14px;
            margin-top: 8px;
        }
        .status {
            padding: 12px;
            border-radius: 8px;
            margin: 16px 0;
            background: #fff;
            border: 1px solid #e2e2e8;
        }
        .status.error {
            background: #ffebee;
            border-color: #b00020;
            color: #b00020;
        }
        .status.success {
            background: #e8f5e9;
            border-color: #4caf50;
            color: #2e7d32;
        }
        .status.info {
            background: #e3f2fd;
            border-color: #2196f3;
            color: #1565c0;
        }
        .results {
            margin-top: 24px;
        }
        .results h2 {
            margin-bottom: 12px;
        }
        pre {
            background: #fff;
            border-radius: 8px;
            padding: 16px;
            border: 1px solid #e2e2e8;
            white-space: pre-wrap;
            word-break: break-word;
            font-size: 13px;
            line-height: 1.5;
            max-height: 600px;
            overflow-y: auto;
        }
        .progress {
            margin: 16px 0;
        }
        .progress-bar {
            width: 100%;
            height: 24px;
            background: #e2e2e8;
            border-radius: 12px;
            overflow: hidden;
            margin-bottom: 8px;
        }
        .progress-fill {
            height: 100%;
            background: #1f5eff;
            transition: width 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #fff;
            font-size: 12px;
            font-weight: 600;
        }
        .screenshot-list {
            max-height: 300px;
            overflow-y: auto;
            background: #f9f9f9;
            padding: 12px;
            border-radius: 8px;
            font-size: 13px;
            font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
        }
        .screenshot-item {
            padding: 4px 0;
        }
        .screenshot-item.has-html::after {
            content: ' ✓ HTML';
            color: #4caf50;
            font-size: 11px;
            margin-left: 8px;
        }
        .mode-toggle {
            display: flex;
            gap: 8px;
            margin-bottom: 16px;
        }
        .mode-toggle button {
            flex: 1;
        }
        .mode-toggle button.active {
            background: #1f5eff;
        }
        .mode-toggle button:not(.active) {
            background: #e2e2e8;
            color: #666;
        }
        .collapsible {
            cursor: pointer;
            user-select: none;
            margin-bottom: 8px;
            padding: 8px 0;
        }
        .collapsible::before {
            content: '▼ ';
            display: inline-block;
            transition: transform 0.2s;
            font-size: 0.8em;
            margin-right: 4px;
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
            overflow: hidden;
        }
    </style>
</head>
<body>
    <h1>Section Screenshot Metadata Generator</h1>
    <p>Generate metadata JSON for section screenshots using OpenAI Vision API. Process images in batches with parallel requests.</p>

    <div class="input-section">
        <h3>Processing Mode</h3>
        <div class="mode-toggle">
            <button id="mode-batch" class="active">Batch Processing</button>
            <button id="mode-continuous">Continuous Batch</button>
            <button id="mode-single">Single Section</button>
        </div>
    </div>

    <!-- Batch Processing Mode -->
    <div id="batch-mode" class="input-section">
        <h3>Batch Configuration</h3>
        <div class="input-group">
            <label for="start-section-id">Starting Section ID:</label>
            <input type="number" id="start-section-id" min="1" placeholder="Leave empty to start from newest">
            <span class="info-text">Optional: Start from this section ID (e.g., 100)</span>
        </div>
        <div class="input-group">
            <label for="batch-size">Batch Size:</label>
            <input type="number" id="batch-size" min="1" max="10" value="5">
            <span class="info-text">Images per batch (1-10)</span>
        </div>
        <div class="input-group">
            <label for="num-batches">Number of Batches:</label>
            <input type="number" id="num-batches" min="1" value="1">
            <span class="info-text">Total batches to process</span>
        </div>
        <p class="info-text">
            <strong>Total images:</strong> <span id="total-images">5</span> images will be processed.
            <br>
            <strong>Available screenshots:</strong> <?php echo count($screenshotFiles); ?> files found (IDs: <?php 
                if (count($screenshotFiles) > 0) {
                    $ids = array_column($screenshotFiles, 'id');
                    echo min($ids) . ' - ' . max($ids);
                } else {
                    echo 'none';
                }
            ?>)
        </p>
        <div class="screenshot-list" style="display: none;" id="screenshot-preview">
            <strong>Will process:</strong>
            <div id="screenshot-preview-list"></div>
        </div>
    </div>

    <!-- Continuous Batch Processing Mode -->
    <div id="continuous-mode" class="input-section" style="display: none;">
        <h3>Continuous Batch Configuration</h3>
        <p class="info-text" style="margin-bottom: 16px;">
            Processes all available screenshots in batches with a 3-second delay between batches. Results are continuously appended and sorted by section ID.
        </p>
        <div class="input-group">
            <label for="continuous-start-id">Starting Section ID:</label>
            <input type="number" id="continuous-start-id" min="1" placeholder="Leave empty to start from newest">
            <span class="info-text">Optional: Start from this section ID (e.g., 100)</span>
        </div>
        <div class="input-group">
            <label for="continuous-batch-size">Batch Size:</label>
            <input type="number" id="continuous-batch-size" min="1" max="10" value="5">
            <span class="info-text">Images per batch (1-10)</span>
        </div>
        <p class="info-text">
            <strong>Available screenshots:</strong> <?php echo count($screenshotFiles); ?> files found (IDs: <?php 
                if (count($screenshotFiles) > 0) {
                    $ids = array_column($screenshotFiles, 'id');
                    echo min($ids) . ' - ' . max($ids);
                } else {
                    echo 'none';
                }
            ?>)
        </p>
    </div>

    <!-- Single Section Mode -->
    <div id="single-mode" class="input-section" style="display: none;">
        <h3>Single Section Configuration</h3>
        <div class="input-group">
            <label for="single-id">Section ID:</label>
            <input type="text" id="single-id" placeholder="Enter screenshot ID (e.g., 173)">
            <span class="info-text">The number from the filename (e.g., 173.jpg → ID: 173)</span>
        </div>
    </div>

    <div class="input-section">
        <h3>Actions</h3>
        <button id="start-processing">Start Processing</button>
        <button id="clear-results" class="secondary">Clear Results</button>
    </div>

    <div id="status" class="status" style="display: none;" role="status"></div>

    <div class="progress" id="progress-container" style="display: none;">
        <div class="progress-bar">
            <div class="progress-fill" id="progress-fill" style="width: 0%;">0%</div>
        </div>
        <div id="progress-text" style="font-size: 14px; color: #666;"></div>
    </div>

    <div class="results" id="html-preview-section" style="display: none;">
        <h2>Section HTML (being analyzed)</h2>
        <div style="margin-bottom: 12px; font-size: 14px; color: #666;">
            <span id="html-preview-info"></span>
        </div>
        <pre id="html-preview" style="max-height: 400px; font-size: 12px;"></pre>
    </div>

    <div class="results" id="prompt-preview-section" style="display: none;">
        <h3 class="collapsible" onclick="toggleCollapse(this)">OpenAI Input Prompt (click to expand/collapse)</h3>
        <div class="collapsible-content collapsed">
            <div style="margin-bottom: 12px; font-size: 14px; color: #666;">
                <span id="prompt-preview-info"></span>
            </div>
            <pre id="prompt-preview" style="max-height: 500px; font-size: 12px; white-space: pre-wrap; word-break: break-word;"></pre>
        </div>
    </div>

    <div class="results">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h2 style="margin: 0;">Generated Metadata JSON</h2>
            <button id="copy-json" class="secondary" style="display: none;">Copy JSON</button>
        </div>
        <pre id="output-json">No results yet. Click "Start Processing" to begin.</pre>
    </div>

    <script>
        const startSectionIdInput = document.getElementById('start-section-id');
        const batchSizeInput = document.getElementById('batch-size');
        const numBatchesInput = document.getElementById('num-batches');
        const continuousStartIdInput = document.getElementById('continuous-start-id');
        const continuousBatchSizeInput = document.getElementById('continuous-batch-size');
        const singleIdInput = document.getElementById('single-id');
        const modeBatchBtn = document.getElementById('mode-batch');
        const modeContinuousBtn = document.getElementById('mode-continuous');
        const modeSingleBtn = document.getElementById('mode-single');
        const batchModeDiv = document.getElementById('batch-mode');
        const continuousModeDiv = document.getElementById('continuous-mode');
        const singleModeDiv = document.getElementById('single-mode');
        const startBtn = document.getElementById('start-processing');
        const clearBtn = document.getElementById('clear-results');
        const statusEl = document.getElementById('status');
        const progressContainer = document.getElementById('progress-container');
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');
        const outputJson = document.getElementById('output-json');
        const copyJsonBtn = document.getElementById('copy-json');
        const totalImagesSpan = document.getElementById('total-images');
        const screenshotPreview = document.getElementById('screenshot-preview');
        const screenshotPreviewList = document.getElementById('screenshot-preview-list');
        const htmlPreviewSection = document.getElementById('html-preview-section');
        const htmlPreview = document.getElementById('html-preview');
        const htmlPreviewInfo = document.getElementById('html-preview-info');
        const promptPreviewSection = document.getElementById('prompt-preview-section');
        const promptPreview = document.getElementById('prompt-preview');
        const promptPreviewInfo = document.getElementById('prompt-preview-info');

        const screenshotFiles = <?php echo json_encode($screenshotFiles); ?>;
        
        // Section HTML cache (will be loaded on demand)
        const sectionHtmlCache = {};
        
        // Load section HTML for a given ID
        async function loadSectionHtml(sectionId) {
            if (sectionHtmlCache[sectionId]) {
                return sectionHtmlCache[sectionId];
            }
            
            try {
                const response = await fetch(`../sections/${getSectionFilename(sectionId)}`);
                if (response.ok) {
                    const html = await response.text();
                    sectionHtmlCache[sectionId] = html;
                    return html;
                }
            } catch (error) {
                console.warn(`Failed to load HTML for section ${sectionId}:`, error);
            }
            return null;
        }
        
        // Get section filename helper (from PHP)
        function getSectionFilename(sectionId) {
            // This will be populated from PHP sections map
            const sectionMap = <?php 
                $map = [];
                foreach ($screenshotFiles as $file) {
                    $filename = getSectionFilename($file['id']);
                    if ($filename) {
                        $map[$file['id']] = $filename;
                    }
                }
                echo json_encode($map);
            ?>;
            return sectionMap[sectionId] || null;
        }

        // Mode switching
        let currentMode = 'batch';
        modeBatchBtn.addEventListener('click', () => {
            currentMode = 'batch';
            modeBatchBtn.classList.add('active');
            modeContinuousBtn.classList.remove('active');
            modeSingleBtn.classList.remove('active');
            batchModeDiv.style.display = 'block';
            continuousModeDiv.style.display = 'none';
            singleModeDiv.style.display = 'none';
        });
        modeContinuousBtn.addEventListener('click', () => {
            currentMode = 'continuous';
            modeContinuousBtn.classList.add('active');
            modeBatchBtn.classList.remove('active');
            modeSingleBtn.classList.remove('active');
            batchModeDiv.style.display = 'none';
            continuousModeDiv.style.display = 'block';
            singleModeDiv.style.display = 'none';
        });
        modeSingleBtn.addEventListener('click', () => {
            currentMode = 'single';
            modeSingleBtn.classList.add('active');
            modeBatchBtn.classList.remove('active');
            modeContinuousBtn.classList.remove('active');
            batchModeDiv.style.display = 'none';
            continuousModeDiv.style.display = 'none';
            singleModeDiv.style.display = 'block';
        });

        // Get filtered screenshots based on starting section ID
        function getFilteredScreenshots(startIdInput = null) {
            const input = startIdInput || startSectionIdInput;
            const startId = parseInt(input.value);
            
            if (!startId || startId <= 0) {
                // No starting ID specified, return all sorted by ID descending (newest first)
                return [...screenshotFiles].sort((a, b) => b.id - a.id);
            }
            
            // Filter screenshots starting from the specified ID, sorted by ID ascending
            const filtered = screenshotFiles
                .filter(f => f.id >= startId)
                .sort((a, b) => a.id - b.id);
            
            return filtered;
        }
        
        // Sleep/delay function
        function sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        // Update total images when batch config changes
        function updateTotalImages() {
            const batchSize = parseInt(batchSizeInput.value) || 1;
            const numBatches = parseInt(numBatchesInput.value) || 1;
            const total = batchSize * numBatches;
            totalImagesSpan.textContent = total;

            // Get filtered screenshots
            const filtered = getFilteredScreenshots();
            
            // Show preview of which images will be processed
            if (filtered.length > 0) {
                const toProcess = filtered.slice(0, total);
                if (toProcess.length > 0) {
                    const startId = toProcess[0].id;
                    const endId = toProcess[toProcess.length - 1].id;
                    const rangeText = toProcess.length === 1 
                        ? `Section ID: ${startId}`
                        : `Section IDs: ${startId} - ${endId}`;
                    
                    screenshotPreviewList.innerHTML = `
                        <div style="margin-bottom: 8px; font-weight: 600;">${rangeText} (${toProcess.length} sections)</div>
                        ${toProcess.map(f => 
                            `<div class="screenshot-item ${f.has_html ? 'has-html' : ''}">${f.id}.jpg (ID: ${f.id})</div>`
                        ).join('')}
                    `;
                    screenshotPreview.style.display = 'block';
                } else {
                    screenshotPreview.style.display = 'none';
                }
            } else {
                const startId = parseInt(startSectionIdInput.value);
                if (startId) {
                    screenshotPreviewList.innerHTML = `<div style="color: #b00020;">No screenshots found starting from ID ${startId}</div>`;
                    screenshotPreview.style.display = 'block';
                } else {
                    screenshotPreview.style.display = 'none';
                }
            }
        }

        startSectionIdInput.addEventListener('input', updateTotalImages);
        batchSizeInput.addEventListener('input', updateTotalImages);
        numBatchesInput.addEventListener('input', updateTotalImages);
        updateTotalImages();

        // Convert image file to base64
        async function imageToBase64(imageId) {
            try {
                // Try to get image via API endpoint first (more reliable)
                const response = await fetch(`../api/get-screenshot.php?id=${imageId}`);
                if (response.ok) {
                    const result = await response.json();
                    if (result.success) {
                        return result.image_base64;
                    }
                }
                
                // Fallback: try direct file access
                const imagePath = `../screenshots/${imageId}.jpg`;
                const fileResponse = await fetch(imagePath);
                if (!fileResponse.ok) {
                    throw new Error(`HTTP ${fileResponse.status}: ${fileResponse.statusText}`);
                }
                const blob = await fileResponse.blob();
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const base64 = reader.result.split(',')[1];
                        resolve(base64);
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
            } catch (error) {
                throw new Error(`Failed to load image: ${error.message}`);
            }
        }

        // Analyze a single screenshot
        async function analyzeScreenshot(imageId, sectionHtml = null) {
            try {
                const base64 = await imageToBase64(imageId);
                
                const payload = {
                    image_id: imageId,
                    image_base64: base64
                };
                
                // Include HTML if available
                if (sectionHtml) {
                    payload.section_html = sectionHtml;
                }
                
                const response = await fetch('../api/analyze-section-screenshot.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                    throw new Error(errorData.error || `HTTP ${response.status}`);
                }

                const result = await response.json();
                if (!result.success) {
                    throw new Error(result.error || 'Analysis failed');
                }

                return {
                    metadata: result.metadata,
                    prompt: result.prompt || ''
                };
            } catch (error) {
                return {
                    id: imageId,
                    error: error.message
                };
            }
        }
        
        // Show prompt preview
        function showPromptPreview(prompt, sectionId = null) {
            if (prompt) {
                const info = sectionId ? `Section ID: ${sectionId} - Prompt sent to OpenAI (${prompt.length} characters)` : `Prompt sent to OpenAI (${prompt.length} characters)`;
                promptPreviewInfo.textContent = info;
                promptPreview.textContent = prompt;
                promptPreviewSection.style.display = 'block';
            }
        }
        
        // Toggle collapse function
        function toggleCollapse(element) {
            element.classList.toggle('collapsed');
            const content = element.nextElementSibling;
            if (content) {
                content.classList.toggle('collapsed');
            }
        }
        
        // Make toggleCollapse available globally
        window.toggleCollapse = toggleCollapse;

        // Process batches
        async function processBatches() {
            const batchSize = parseInt(batchSizeInput.value) || 1;
            const numBatches = parseInt(numBatchesInput.value) || 1;
            const totalImages = batchSize * numBatches;

            // Get filtered screenshots based on starting section ID
            const filteredScreenshots = getFilteredScreenshots();

            if (filteredScreenshots.length === 0) {
                const startId = parseInt(startSectionIdInput.value);
                if (startId) {
                    showStatus(`No screenshots found starting from section ID ${startId}.`, 'error');
                } else {
                    showStatus('No screenshot files found in screenshots directory.', 'error');
                }
                return;
            }

            if (totalImages > filteredScreenshots.length) {
                showStatus(`Only ${filteredScreenshots.length} screenshots available from the starting point, but ${totalImages} requested.`, 'error');
                return;
            }

            const imagesToProcess = filteredScreenshots.slice(0, totalImages);
            const results = [];
            let processed = 0;
            let failed = 0;

            startBtn.disabled = true;
            progressContainer.style.display = 'block';
            showStatus(`Processing ${totalImages} images in ${numBatches} batches of ${batchSize}...`, 'info');

            // Process in batches
            for (let batchIndex = 0; batchIndex < numBatches; batchIndex++) {
                const batchStart = batchIndex * batchSize;
                const batchEnd = Math.min(batchStart + batchSize, imagesToProcess.length);
                const batch = imagesToProcess.slice(batchStart, batchEnd);

                showStatus(`Processing batch ${batchIndex + 1}/${numBatches} (${batch.length} images)...`, 'info');

                // Load HTML for all files in batch first
                const htmlPromises = batch.map(async (file) => {
                    const html = await loadSectionHtml(file.id);
                    return { file, html };
                });
                const filesWithHtml = await Promise.all(htmlPromises);
                
                // Show HTML preview for the first file in the batch (or all if single batch)
                if (batchIndex === 0 && filesWithHtml.length > 0) {
                    const firstFile = filesWithHtml[0];
                    showHtmlPreview(firstFile.file.id, firstFile.html);
                }
                
                // Process batch in parallel with HTML
                const batchPromises = filesWithHtml.map(({ file, html }) => 
                    analyzeScreenshot(file.id, html)
                );
                const batchResults = await Promise.allSettled(batchPromises);

                // Collect results and show prompt from first successful result
                let promptShown = false;
                batchResults.forEach((result, index) => {
                    if (result.status === 'fulfilled') {
                        const value = result.value;
                        // Show prompt from first successful result
                        if (!promptShown && value.prompt) {
                            showPromptPreview(value.prompt, value.metadata?.id || filesWithHtml[index].file.id);
                            promptShown = true;
                        }
                        results.push(value.metadata || value);
                        processed++;
                    } else {
                        const file = batch[index];
                        results.push({
                            id: file.id,
                            error: result.reason?.message || 'Unknown error'
                        });
                        failed++;
                    }
                });

                // Update progress
                const totalProcessed = processed + failed;
                const progress = (totalProcessed / totalImages) * 100;
                progressFill.style.width = progress + '%';
                progressFill.textContent = Math.round(progress) + '%';
                progressText.textContent = `Processed: ${totalProcessed}/${totalImages} (${processed} success, ${failed} failed)`;
            }

            // Sort results by ID
            results.sort((a, b) => (a.id || 0) - (b.id || 0));

            // Filter out errors for final JSON (or include them if you want)
            const validResults = results.filter(r => !r.error);
            const finalJson = validResults.length > 0 ? validResults : results;

            // Display results
            const jsonOutput = JSON.stringify(finalJson, null, 2);
            outputJson.textContent = jsonOutput;
            copyJsonBtn.style.display = 'block';

            // Show completion status
            if (failed === 0) {
                showStatus(`Successfully processed ${processed} images!`, 'success');
            } else {
                showStatus(`Completed: ${processed} successful, ${failed} failed.`, failed === totalImages ? 'error' : 'info');
            }

            startBtn.disabled = false;
        }

        // Show HTML preview
        function showHtmlPreview(sectionId, html) {
            if (html) {
                htmlPreviewInfo.textContent = `Section ID: ${sectionId} - HTML found (${html.length} characters)`;
                // Truncate for display if too long
                const displayHtml = html.length > 5000 ? html.substring(0, 5000) + '\n... (truncated for display)' : html;
                htmlPreview.textContent = displayHtml;
                htmlPreviewSection.style.display = 'block';
            } else {
                htmlPreviewInfo.textContent = `Section ID: ${sectionId} - No HTML found`;
                htmlPreview.textContent = 'No HTML content available for this section.';
                htmlPreviewSection.style.display = 'block';
            }
        }

        // Process single section
        async function processSingle() {
            const sectionId = parseInt(singleIdInput.value.trim());
            
            if (!sectionId || sectionId <= 0) {
                showStatus('Please enter a valid section ID (positive number).', 'error');
                return;
            }

            const file = screenshotFiles.find(f => f.id === sectionId);
            if (!file) {
                showStatus(`Screenshot with ID ${sectionId} not found. Available IDs: ${screenshotFiles.map(f => f.id).join(', ')}`, 'error');
                return;
            }

            startBtn.disabled = true;
            progressContainer.style.display = 'block';
            progressFill.style.width = '0%';
            progressFill.textContent = '0%';
            progressText.textContent = 'Loading HTML...';
            showStatus(`Loading HTML for section ${sectionId}...`, 'info');

            try {
                // Load HTML for this section
                const sectionHtml = await loadSectionHtml(file.id);
                
                // Show HTML preview
                showHtmlPreview(sectionId, sectionHtml);
                
                progressText.textContent = 'Processing...';
                showStatus(`Processing screenshot ${sectionId}...`, 'info');
                
                const result = await analyzeScreenshot(file.id, sectionHtml);
                
                if (result.error) {
                    showStatus(`Error processing ${sectionId}: ${result.error}`, 'error');
                    outputJson.textContent = JSON.stringify(result, null, 2);
                } else {
                    // Show prompt preview
                    if (result.prompt) {
                        showPromptPreview(result.prompt, sectionId);
                    }
                    
                    showStatus(`Successfully processed screenshot ${sectionId}!`, 'success');
                    const jsonOutput = JSON.stringify([result.metadata], null, 2);
                    outputJson.textContent = jsonOutput;
                    copyJsonBtn.style.display = 'block';
                }

                progressFill.style.width = '100%';
                progressFill.textContent = '100%';
                progressText.textContent = 'Complete';
            } catch (error) {
                showStatus(`Error: ${error.message}`, 'error');
                outputJson.textContent = JSON.stringify({ error: error.message }, null, 2);
            } finally {
                startBtn.disabled = false;
            }
        }

        // Process continuous batches
        async function processContinuousBatches() {
            const batchSize = parseInt(continuousBatchSizeInput.value) || 5;
            
            // Get filtered screenshots based on starting section ID
            const filteredScreenshots = getFilteredScreenshots(continuousStartIdInput);

            if (filteredScreenshots.length === 0) {
                const startId = parseInt(continuousStartIdInput.value);
                if (startId) {
                    showStatus(`No screenshots found starting from section ID ${startId}.`, 'error');
                } else {
                    showStatus('No screenshot files found in screenshots directory.', 'error');
                }
                return;
            }

            const totalImages = filteredScreenshots.length;
            const results = [];
            let processed = 0;
            let failed = 0;
            let batchIndex = 0;

            startBtn.disabled = true;
            progressContainer.style.display = 'block';
            showStatus(`Processing all ${totalImages} images in batches of ${batchSize} with 3-second delays...`, 'info');

            // Process all images in batches
            for (let i = 0; i < filteredScreenshots.length; i += batchSize) {
                batchIndex++;
                const batch = filteredScreenshots.slice(i, i + batchSize);
                const remainingImages = totalImages - processed - failed;

                showStatus(`Processing batch ${batchIndex} (${batch.length} images, ${remainingImages} remaining)...`, 'info');

                // Load HTML for all files in batch first
                const htmlPromises = batch.map(async (file) => {
                    const html = await loadSectionHtml(file.id);
                    return { file, html };
                });
                const filesWithHtml = await Promise.all(htmlPromises);
                
                // Show HTML preview for the first file in the first batch
                if (batchIndex === 1 && filesWithHtml.length > 0) {
                    const firstFile = filesWithHtml[0];
                    showHtmlPreview(firstFile.file.id, firstFile.html);
                }
                
                // Process batch in parallel with HTML
                const batchPromises = filesWithHtml.map(({ file, html }) => 
                    analyzeScreenshot(file.id, html)
                );
                const batchResults = await Promise.allSettled(batchPromises);

                // Collect results and show prompt from first successful result
                let promptShown = false;
                batchResults.forEach((result, index) => {
                    if (result.status === 'fulfilled') {
                        const value = result.value;
                        // Show prompt from first successful result
                        if (!promptShown && value.prompt) {
                            showPromptPreview(value.prompt, value.metadata?.id || filesWithHtml[index].file.id);
                            promptShown = true;
                        }
                        results.push(value.metadata || value);
                        processed++;
                    } else {
                        const file = batch[index];
                        results.push({
                            id: file.id,
                            error: result.reason?.message || 'Unknown error'
                        });
                        failed++;
                    }
                });

                // Sort results by ID after each batch
                results.sort((a, b) => (a.id || 0) - (b.id || 0));

                // Update progress
                const totalProcessed = processed + failed;
                const progress = (totalProcessed / totalImages) * 100;
                progressFill.style.width = progress + '%';
                progressFill.textContent = Math.round(progress) + '%';
                progressText.textContent = `Processed: ${totalProcessed}/${totalImages} (${processed} success, ${failed} failed)`;

                // Update JSON output continuously
                const validResults = results.filter(r => !r.error);
                const finalJson = validResults.length > 0 ? validResults : results;
                const jsonOutput = JSON.stringify(finalJson, null, 2);
                outputJson.textContent = jsonOutput;
                copyJsonBtn.style.display = 'block';

                // Wait 3 seconds before next batch (except for the last batch)
                if (i + batchSize < filteredScreenshots.length) {
                    showStatus(`Waiting 3 seconds before next batch...`, 'info');
                    await sleep(3000);
                }
            }

            // Final sort by ID
            results.sort((a, b) => (a.id || 0) - (b.id || 0));

            // Filter out errors for final JSON (or include them if you want)
            const validResults = results.filter(r => !r.error);
            const finalJson = validResults.length > 0 ? validResults : results;

            // Display final results
            const jsonOutput = JSON.stringify(finalJson, null, 2);
            outputJson.textContent = jsonOutput;
            copyJsonBtn.style.display = 'block';

            // Show completion status
            if (failed === 0) {
                showStatus(`Successfully processed all ${processed} images!`, 'success');
            } else {
                showStatus(`Completed: ${processed} successful, ${failed} failed.`, failed === totalImages ? 'error' : 'info');
            }

            startBtn.disabled = false;
        }

        // Start processing
        startBtn.addEventListener('click', () => {
            if (currentMode === 'batch') {
                processBatches();
            } else if (currentMode === 'continuous') {
                processContinuousBatches();
            } else {
                processSingle();
            }
        });

        // Clear results
        clearBtn.addEventListener('click', () => {
            outputJson.textContent = 'No results yet. Click "Start Processing" to begin.';
            copyJsonBtn.style.display = 'none';
            htmlPreviewSection.style.display = 'none';
            promptPreviewSection.style.display = 'none';
            statusEl.style.display = 'none';
            progressContainer.style.display = 'none';
        });

        // Copy JSON to clipboard
        copyJsonBtn.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(outputJson.textContent);
                const originalText = copyJsonBtn.textContent;
                copyJsonBtn.textContent = 'Copied!';
                setTimeout(() => {
                    copyJsonBtn.textContent = originalText;
                }, 2000);
            } catch (error) {
                showStatus('Failed to copy to clipboard: ' + error.message, 'error');
            }
        });

        // Show status message
        function showStatus(message, type = 'info') {
            statusEl.textContent = message;
            statusEl.className = 'status ' + type;
            statusEl.style.display = 'block';
        }

        // Allow Enter key to submit in single mode
        singleIdInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && currentMode === 'single') {
                processSingle();
            }
        });
    </script>
</body>
</html>

