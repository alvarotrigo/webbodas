/**
 * AI Chat Component
 * Handles the AI chat form that appears when the preview is empty
 */

(function() {
    'use strict';

    // Configuration
    const MAX_TEXTAREA_HEIGHT = 260; // Maximum height in pixels
    const MIN_TEXTAREA_HEIGHT = 60; // Minimum height in pixels

    // State
    let chatForm = null;
    let chatFormInner = null;
    let textarea = null;
    let submitButton = null;
    let stopButton = null;
    let isVisible = false;
    let allowedSelectorsPromise = null;
    let isGenerating = false;
    let abortController = null;
    let currentStage = null;
    let stageIndicator = null;
    let subscriptionCheckPromise = null;
    let isProUser = null; // null = not checked, true = pro, false = not pro

    async function getAllowedSelectorsMap() {
        if (!allowedSelectorsPromise) {
            allowedSelectorsPromise = fetch('public/js/section-allowed-selectors.json')
                .then(response => {
                    if (!response.ok) {
                        console.warn('Failed to load allowed selectors JSON, status:', response.status);
                        return {};
                    }
                    return response.json();
                })
                .catch(error => {
                    console.error('Error loading allowed selectors JSON:', error);
                    return {};
                });
        }
        return allowedSelectorsPromise;
    }

    function resolveAllowedSelectors(map, sectionFile) {
        if (!sectionFile) return {};
        const key = sectionFile.replace(/\.html$/i, '');
        const selectors = map[key];
        // New format: object mapping selectors to text content
        // Old format: array of selectors (for backward compatibility)
        if (typeof selectors === 'object' && selectors !== null) {
            if (Array.isArray(selectors)) {
                // Convert old array format to new object format (empty text)
                const obj = {};
                selectors.forEach(sel => {
                    obj[sel] = '';
                });
                return obj;
            }
            return selectors;
        }
        return {};
    }

    /**
     * Initialize the AI chat component
     */
    function init() {
        chatForm = document.getElementById('ai-chat-form');
        if (!chatForm) {
            console.warn('AI chat form not found in DOM');
            return;
        }

        textarea = chatForm.querySelector('#ai-chat-input');
        submitButton = chatForm.querySelector('#ai-chat-submit');
        stopButton = chatForm.querySelector('#ai-chat-stop');
        
        // Get the inner form element for stage indicator placement
        chatFormInner = chatForm.querySelector('.ai-chat-form-inner');
        if (!chatFormInner) {
            console.warn('AI chat inner form not found');
        }

        if (!textarea || !submitButton || !stopButton) {
            console.warn('AI chat form elements not found');
            return;
        }
        
        console.log('AI Chat initialized:', {
            chatForm,
            chatFormInner,
            textarea,
            submitButton,
            stopButton
        });

        // Setup auto-resize for textarea
        setupTextareaAutoResize();

        // Setup event listeners
        setupEventListeners();

        // Check initial visibility state
        checkVisibility();
    }

    /**
     * Setup auto-resize functionality for textarea
     */
    function setupTextareaAutoResize() {
        if (!textarea) return;

        // Set initial height
        textarea.style.height = 'auto';
        textarea.style.overflowY = 'hidden';
        textarea.style.resize = 'none';
        textarea.style.minHeight = MIN_TEXTAREA_HEIGHT + 'px';
        textarea.style.maxHeight = MAX_TEXTAREA_HEIGHT + 'px';

        // Auto-resize on input
        textarea.addEventListener('input', function() {
            autoResizeTextarea();
        });

        // Auto-resize on paste
        textarea.addEventListener('paste', function() {
            // Use setTimeout to wait for paste content to be inserted
            setTimeout(() => {
                autoResizeTextarea();
            }, 0);
        });

        // Initial resize
        autoResizeTextarea();
    }

    /**
     * Auto-resize textarea based on content
     */
    function autoResizeTextarea() {
        if (!textarea) return;

        // Reset height to auto to get the correct scrollHeight
        textarea.style.height = 'auto';

        // Calculate new height - ensure it never exceeds MAX_TEXTAREA_HEIGHT
        const scrollHeight = textarea.scrollHeight;
        const newHeight = Math.min(
            Math.max(scrollHeight, MIN_TEXTAREA_HEIGHT),
            MAX_TEXTAREA_HEIGHT
        );

        // Apply new height - enforce max height with clamp
        textarea.style.height = Math.min(newHeight, MAX_TEXTAREA_HEIGHT) + 'px';
        textarea.style.maxHeight = MAX_TEXTAREA_HEIGHT + 'px';

        // Show scrollbar if content exceeds max height
        if (scrollHeight > MAX_TEXTAREA_HEIGHT) {
            textarea.style.overflowY = 'auto';
        } else {
            textarea.style.overflowY = 'hidden';
        }
    }

    /**
     * Check if user has pro/paid subscription
     * @returns {Promise<boolean>}
     */
    async function checkUserSubscription() {
        // Return cached result if available
        if (isProUser !== null) {
            return isProUser;
        }

        // If check is already in progress, wait for it
        if (subscriptionCheckPromise) {
            return subscriptionCheckPromise;
        }

        // Start new check
        subscriptionCheckPromise = (async () => {
            try {
                // Get user email from various sources
                let userEmail = null;
                
                if (window.currentUser && window.currentUser.email) {
                    userEmail = window.currentUser.email;
                } else if (window.serverUserData && window.serverUserData.email) {
                    userEmail = window.serverUserData.email;
                } else {
                    // Try localStorage as fallback
                    userEmail = localStorage.getItem('userEmail');
                }

                // If no user email, user is not authenticated, so not pro
                if (!userEmail) {
                    isProUser = false;
                    return false;
                }

                // Check subscription status with server
                const response = await fetch('api/check-subscription.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email: userEmail })
                });

                if (!response.ok) {
                    console.warn('Failed to check subscription status');
                    isProUser = false;
                    return false;
                }

                const result = await response.json();
                isProUser = result.success && result.is_paid === true;
                return isProUser;
            } catch (error) {
                console.error('Error checking subscription:', error);
                isProUser = false;
                return false;
            } finally {
                subscriptionCheckPromise = null;
            }
        })();

        return subscriptionCheckPromise;
    }

    /**
     * Show upgrade modal for non-pro users
     */
    async function showUpgradeModal() {
        // Check if upgrade modal is available
        if (typeof window.upgradeModal !== 'undefined' && window.upgradeModal) {
            await window.upgradeModal.show();
        } else {
            // Fallback: try to load upgrade modal
            console.warn('Upgrade modal not available');
        }
    }

    /**
     * Setup event listeners
     */
    function setupEventListeners() {
        if (!chatForm || !textarea || !submitButton || !stopButton) return;

        // Submit on button click
        submitButton.addEventListener('click', handleSubmit);

        // Stop on stop button click
        stopButton.addEventListener('click', handleStop);

        // Submit on Enter (but allow Shift+Enter for new line)
        textarea.addEventListener('keydown', async function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                
                // Check subscription before submitting
                const isPro = await checkUserSubscription();
                if (!isPro) {
                    // Show upgrade modal instead of submitting
                    await showUpgradeModal();
                    return;
                }
                
                // User is pro, proceed with submission
                handleSubmit();
            }
        });

        // Prevent form submission on Enter
        chatForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handleSubmit();
        });
    }

    /**
     * Create or update the stage indicator (centered on screen during generation)
     */
    function updateStageIndicator(stage) {
        currentStage = stage;
        console.log('Stage updated to:', stage);
        
        if (!stageIndicator) {
            console.log('Creating stage indicator element');
            stageIndicator = document.createElement('div');
            stageIndicator.className = 'ai-stage-indicator';
            stageIndicator.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                z-index: 10000;
                min-width: 300px;
                padding: 20px 28px;
                background: linear-gradient(135deg, rgba(59, 130, 246, 0.98) 0%, rgba(37, 99, 235, 0.98) 100%);
                border: 2px solid rgba(255, 255, 255, 0.3);
                border-radius: 16px;
                font-size: 16px;
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 12px;
                animation: slideIn 0.3s ease-out;
                pointer-events: none;
                font-weight: 500;
                box-shadow: 0 8px 32px rgba(59, 130, 246, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1) inset;
                backdrop-filter: blur(10px);
            `;
            
            // Add to body so it overlays everything (since it's fixed positioned)
            document.body.appendChild(stageIndicator);
            console.log('Stage indicator added to body');
            console.log('Stage indicator element:', stageIndicator);
            console.log('Stage indicator display:', window.getComputedStyle(stageIndicator).display);
            console.log('Stage indicator visibility:', window.getComputedStyle(stageIndicator).visibility);
        }
        
        // Force visibility check
        if (stageIndicator) {
            stageIndicator.style.display = 'flex';
        }
        
        const stages = {
            'analyzing': 'Analyzing your request...',
            'sections': 'Generating sections...',
            'theme': 'Creating theme colors...',
            'content': 'Writing content...',
            'images': 'Finding images...',
            'finalizing': 'Finalizing your website...'
        };
        
        stageIndicator.innerHTML = `
            <svg class="ai-stage-spinner" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
            </svg>
            <span>${stages[stage] || 'Processing...'}</span>
        `;
        
        console.log('Stage indicator HTML updated:', stages[stage]);
        
        // Add spinner animation
        const style = document.createElement('style');
        if (!document.querySelector('#ai-stage-spinner-style')) {
            style.id = 'ai-stage-spinner-style';
            style.textContent = `
                @keyframes slideIn {
                    from {
                        opacity: 0;
                        transform: translate(-50%, -50%) scale(0.9);
                    }
                    to {
                        opacity: 1;
                        transform: translate(-50%, -50%) scale(1);
                    }
                }
                @keyframes slideOut {
                    from {
                        opacity: 1;
                        transform: translate(-50%, -50%) scale(1);
                    }
                    to {
                        opacity: 0;
                        transform: translate(-50%, -50%) scale(0.9);
                    }
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                @keyframes pulse {
                    0%, 100% {
                        box-shadow: 0 8px 32px rgba(59, 130, 246, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1) inset;
                    }
                    50% {
                        box-shadow: 0 8px 40px rgba(59, 130, 246, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.2) inset;
                    }
                }
                .ai-stage-spinner {
                    animation: spin 1s linear infinite;
                }
                .ai-stage-indicator {
                    animation: slideIn 0.3s ease-out, pulse 2s ease-in-out infinite !important;
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    /**
     * Remove the stage indicator with fade out animation
     */
    function removeStageIndicator() {
        if (stageIndicator) {
            stageIndicator.style.animation = 'slideOut 0.4s ease-out';
            setTimeout(() => {
                if (stageIndicator && stageIndicator.parentNode) {
                    stageIndicator.parentNode.removeChild(stageIndicator);
                }
                stageIndicator = null;
                console.log('Stage indicator removed');
            }, 400);
        }
    }
    
    /**
     * Handle stop button click
     */
    function handleStop() {
        if (!isGenerating) {
            return;
        }
        
        if (abortController) {
            try {
                abortController.abort();
            } catch (error) {
                console.error('Error aborting controller:', error);
            }
            // Don't set to null immediately to avoid race conditions
        }
        isGenerating = false;
        // Don't remove stage indicator or reset button here
        // Let the finally block handle cleanup after abort completes
        
        if (typeof showToast === 'function') {
            showToast('Stopping Generation...', 'Cancelling the current generation process.', {
                duration: 2000
            });
        }
    }
    
    /**
     * Show send button and hide stop button
     */
    function showSendButton() {
        if (submitButton) {
            submitButton.classList.remove('hidden');
        }
        if (stopButton) {
            stopButton.classList.add('hidden');
        }
    }

    /**
     * Hide send button and show stop button
     */
    function showStopButton() {
        if (submitButton) {
            submitButton.classList.add('hidden');
        }
        if (stopButton) {
            stopButton.classList.remove('hidden');
        }
    }

    /**
     * Reset submit button and form to original state
     */
    function resetSubmitButton() {
        if (!submitButton || !textarea || !stopButton) return;
        
        // Show send button, hide stop button
        showSendButton();
        
        submitButton.disabled = false;
        stopButton.disabled = false;
        textarea.disabled = false;
        textarea.placeholder = 'Describe the website you want to create...';
        
        // Reset visual styles
        textarea.style.opacity = '1';
        textarea.style.cursor = 'text';
        textarea.style.backgroundColor = '';
        
        const inputWrapper = chatForm ? chatForm.querySelector('.ai-chat-input-wrapper') : null;
        if (inputWrapper) {
            inputWrapper.style.opacity = '1';
        }
        
        // Reset chat form background and container position
        if (chatForm) {
            chatForm.style.background = 'rgba(255, 255, 255, 0.95)';
            chatForm.style.backdropFilter = 'blur(8px)';
            
            const chatTitle = chatForm.querySelector('.ai-chat-title');
            if (chatTitle) {
                chatTitle.style.opacity = '1';
                chatTitle.style.height = '';
                chatTitle.style.margin = '';
                chatTitle.style.overflow = '';
            }
            
            const chatContainer = chatForm.querySelector('.ai-chat-container');
            if (chatContainer) {
                chatContainer.style.alignSelf = '';
                chatContainer.style.maxWidth = '800px';
                chatContainer.style.marginBottom = '';
                chatContainer.style.gap = '2rem';
            }
        }
        
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }
    
    /**
     * Handle form submission
     */
    async function handleSubmit() {
        if (!textarea || !submitButton) return;
        
        // Don't allow submission if already generating
        if (isGenerating) {
            return;
        }

        // Check subscription status before allowing submission
        const isPro = await checkUserSubscription();
        if (!isPro) {
            // Show upgrade modal instead of submitting
            await showUpgradeModal();
            return;
        }

        const message = textarea.value.trim();

        if (!message) {
            return;
        }
        
        // Validate word count (minimum 3 words)
        const wordCount = message.split(/\s+/).filter(word => word.length > 0).length;
        if (wordCount <= 2) {
            if (typeof showToast === 'function') {
                showToast('Prompt Too Short', 'Please provide a more detailed description (at least 3 words) to generate your website.', {
                    duration: 4000
                });
            } else {
                alert('Please provide a more detailed description (at least 3 words) to generate your website.');
            }
            textarea.focus();
            return;
        }

        // Set generating state
        isGenerating = true;
        abortController = new AbortController();
        
        // Ensure form is visible during generation
        if (!isVisible) {
            show();
        }
        
        // Transform chat form for generation mode
        const chatContainer = chatForm.querySelector('.ai-chat-container');
        const chatTitle = chatForm.querySelector('.ai-chat-title');
        
        // Make background semi-transparent and move container to bottom
        chatForm.style.background = 'rgba(255, 255, 255, 0.15)';
        chatForm.style.backdropFilter = 'blur(4px)';
        
        // Hide title during generation
        if (chatTitle) {
            chatTitle.style.transition = 'opacity 0.3s ease';
            chatTitle.style.opacity = '0';
            chatTitle.style.height = '0';
            chatTitle.style.margin = '0';
            chatTitle.style.overflow = 'hidden';
        }
        
        if (chatContainer) {
            chatContainer.style.transition = 'all 0.5s ease';
            chatContainer.style.alignSelf = 'flex-end';
            chatContainer.style.maxWidth = '600px';
            chatContainer.style.marginBottom = '2rem';
            chatContainer.style.gap = '1rem';
        }
        
        // Disable textarea and switch to stop button
        textarea.disabled = true;
        textarea.placeholder = 'Generating your website...';
        
        // Add visual feedback for disabled state
        const inputWrapper = chatForm.querySelector('.ai-chat-input-wrapper');
        textarea.style.opacity = '0.6';
        textarea.style.cursor = 'not-allowed';
        textarea.style.backgroundColor = 'rgba(0, 0, 0, 0.03)';
        if (inputWrapper) {
            inputWrapper.style.opacity = '0.7';
        }
        
        // Hide send button and show stop button
        showStopButton();
        
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
        
        // Store original message for potential retry
        const originalMessage = message;
        
        // Clear input immediately for better UX
        textarea.value = '';
        autoResizeTextarea();
        
        // Show initial stage
        console.log('==== STARTING WEBSITE GENERATION ====');
        console.log('Chat form element:', chatForm);
        console.log('Chat form is visible:', isVisible);
        updateStageIndicator('analyzing');
        console.log('Stage indicator after creation:', stageIndicator);
        
        // Small delay to ensure stage indicator renders
        await new Promise(resolve => setTimeout(resolve, 100));

        try {
            // Update stage to sections
            updateStageIndicator('sections');
            
            console.log('Starting website generation...');
            console.log('abortController:', abortController);
            debugger;
            // Call the API to generate website
            const response = await fetch('api/generate-website.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: originalMessage
                }),
                signal: abortController ? abortController.signal : undefined
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to generate website');
            }

            // Get section IDs, creative brief, and theme from response
            const sectionIds = data.sections || [];
            const creativeBrief = data.creative_brief || null;
            const themeData = data.theme || null;

            if (sectionIds.length === 0) {
                throw new Error('No sections were recommended');
            }

            // Create custom theme if theme data is available
            if (themeData && typeof getCustomThemes !== 'undefined' && typeof saveCustomThemes !== 'undefined' && typeof injectCustomThemeCSS !== 'undefined') {
                try {
                    updateStageIndicator('theme');
                    createAIGeneratedTheme(themeData);
                } catch (error) {
                    console.error('Error creating AI-generated theme:', error);
                    // Continue without theme - don't fail the whole operation
                }
            }

            // Add sections to preview
            await addSectionsToPreview(sectionIds, creativeBrief);

            // Show success message
            console.log(`Successfully added ${sectionIds.length} sections:`, sectionIds);
            
            // Update stage to finalizing
            updateStageIndicator('finalizing');
            
            // Small delay before showing success
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Show success toast if available
            if (typeof showToast === 'function') {
                showToast('Website Generated!', `Successfully added ${sectionIds.length} sections to your website.`, {
                    duration: 3000
                });
            }

        } catch (error) {
            // Check if it was aborted
            if (error.name === 'AbortError') {
                console.log('Generation was cancelled by user');
                return; // Don't show error, stopGeneration already handled it
            }
            
            console.error('Error generating website:', error);
            
            // Show error using toast notification if available, otherwise use alert
            if (typeof showToast === 'function') {
                showToast('Error Generating Website', error.message + '\n\nPlease try again with a different description.', {
                    duration: 5000
                });
            } else {
                alert('Error: ' + error.message + '\n\nPlease try again with a different description.');
            }
            
            // Restore the message so user can try again
            textarea.value = originalMessage;
            autoResizeTextarea();
        } finally {
            // Reset state
            isGenerating = false;
            // Don't set abortController to null here - let it be garbage collected
            // This avoids race conditions with async operations that might still be using it
            removeStageIndicator();
            resetSubmitButton();
            
            // Update visibility now that generation is complete
            updateVisibility();
            
            // Focus back on textarea only if chat is still visible
            if (isVisible) {
                textarea.focus();
            }
        }
    }

    /**
     * Create a custom theme from AI-generated theme data
     * @param {Object} themeData - Theme data with name and variables
     */
    function createAIGeneratedTheme(themeData) {
        if (!themeData || !themeData.name || !themeData.variables) {
            console.warn('Invalid theme data provided');
            return;
        }

        // Use the addCustomTheme function from custom-theme-manager.js if available
        if (typeof addCustomTheme !== 'undefined') {
            try {
                const themeId = addCustomTheme(
                    themeData,
                    typeof selectTheme !== 'undefined' ? selectTheme : null,
                    typeof populateThemeGrid !== 'undefined' ? populateThemeGrid : null
                );
                
                // Show success message
                if (typeof showToast !== 'undefined') {
                    showToast('AI Theme Created!', `Custom theme "${themeData.name}" has been created and applied.`, {
                        duration: 3000
                    });
                }
                
                console.log('AI-generated theme created:', themeId, themeData.name);
            } catch (error) {
                console.error('Error adding custom theme:', error);
                if (typeof showToast !== 'undefined') {
                    showToast('Theme Creation Failed', 'Could not create AI-generated theme. Please try again.', {
                        duration: 3000
                    });
                }
            }
        } else {
            console.warn('addCustomTheme function not available');
        }
    }

    /**
     * Add sections to preview in order
     */
    async function addSectionsToPreview(sectionIds, creativeBrief = null) {
        // Wait for editor functions to be available (they might not be ready yet)
        let retries = 0;
        const maxRetries = 10;
        
        while ((typeof window.addSectionToPreview === 'undefined' || 
                typeof window.selectedSections === 'undefined' ||
                typeof window.sections === 'undefined') && retries < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 100));
            retries++;
        }

        // Check if required functions are available
        if (typeof window.addSectionToPreview === 'undefined' || 
            typeof window.selectedSections === 'undefined' ||
            typeof window.sections === 'undefined') {
            throw new Error('Editor functions not available. Please refresh the page.');
        }

        // Clear existing sections first (optional - you might want to ask user)
        // For now, we'll add to existing sections
        
        // Add each section in order (skip TinyMCE initialization to preserve DOM structure for text updates)
        for (const sectionId of sectionIds) {
            // Check if section exists
            const section = window.sections.find(s => s.id === sectionId);
            if (!section) {
                console.warn(`Section ${sectionId} not found, skipping...`);
                continue;
            }

            // Check if already selected
            if (window.selectedSections.has(sectionId)) {
                console.log(`Section ${sectionId} already added, skipping...`);
                continue;
            }

            // Add to selected sections
            window.selectedSections.add(sectionId);

            // Mark section item as selected in UI
            const sectionItem = document.querySelector(
                `.section-item[data-section="${sectionId}"], .category-section-item[data-section="${sectionId}"]`
            );
            if (sectionItem) {
                sectionItem.classList.add('selected');
            }

            // Add to preview without initializing TinyMCE (to preserve DOM structure for text updates)
            await window.addSectionToPreview(sectionId, true); // skipTinyMCE = true

            // Small delay between sections for better UX
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Don't update visibility yet - let the caller handle it after generation completes

        // Generate text for all sections if creative brief is available
        if (creativeBrief) {
            await generateTextForSections(sectionIds, creativeBrief);
        } else {
            // If no creative brief, initialize TinyMCE for all sections now
            for (const sectionId of sectionIds) {
                if (typeof window.initTinyMCEForSection === 'function') {
                    window.initTinyMCEForSection(sectionId);
                    // Small delay between initializations
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            }
        }
    }

    /**
     * Generate custom text for sections using OpenAI
     */
    async function generateTextForSections(sectionIds, creativeBrief) {
        if (!sectionIds || sectionIds.length === 0 || !creativeBrief) {
            return;
        }

        console.log('Generating text for sections...');
        
        // Update stage to content generation
        updateStageIndicator('content');

        // Get blueprint function from generate-website.php (we'll need to replicate it)
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
            const key = category ? category.toLowerCase().trim() : '';
            return blueprints[key] || null;
        }

        const allowedSelectorsMap = await getAllowedSelectorsMap();

        // Get preview iframe reference once
        const iframe = document.getElementById('preview-iframe');
        if (!iframe || !iframe.contentWindow) {
            console.error('Preview iframe not found');
            return;
        }

        // Track completed sections for logging
        let completedCount = 0;
        const totalSections = sectionIds.length;

        // Process each section independently and apply updates immediately
        const sectionPromises = sectionIds.map(async (sectionId) => {
            // Check if generation was aborted
            if (abortController && abortController.signal.aborted) {
                return null;
            }
            
            const section = window.sections.find(s => s.id === sectionId);
            if (!section) {
                console.warn(`Section ${sectionId} not found for text generation`);
                return null;
            }

            // Get section category - derive from tags if category not available
            let category = section.category;
            if (!category && section.tags && section.tags.length > 0) {
                // Map common tags to categories
                const tagToCategory = {
                    'hero': 'hero',
                    'intro': 'hero',
                    'features': 'features',
                    'testimonial': 'testimonials',
                    'testimonials': 'testimonials',
                    'pricing': 'pricing',
                    'team': 'team',
                    'gallery': 'gallery',
                    'portfolio': 'portfolio',
                    'contact': 'contact',
                    'form': 'forms',
                    'forms': 'forms',
                    'about': 'about',
                    'faq': 'faqs',
                    'faqs': 'faqs',
                    'how-it-works': 'how it works',
                    'stats': 'stats',
                    'media': 'media',
                    'video': 'video',
                    'applications': 'applications',
                    'logo': 'logo clouds',
                    'newsletter': 'newsletter',
                    'cta': 'cta',
                    'events': 'events',
                    'comparison': 'comparison',
                    'content': 'content',
                    'footer': 'footer',
                    'blog': 'blog',
                    'integrations': 'integrations'
                };
                // Find first matching tag
                for (const tag of section.tags) {
                    if (tagToCategory[tag]) {
                        category = tagToCategory[tag];
                        break;
                    }
                }
            }
            category = category || 'content';
            const blueprint = getSectionBlueprint(category);
            
            if (!blueprint) {
                console.warn(`No blueprint found for category: ${category}`);
                return null;
            }

            // Load section HTML
            let sectionHtml = '';
            try {
                const response = await fetch(`sections/${section.file}`);
                sectionHtml = await response.text();
            } catch (error) {
                console.error(`Error loading section HTML for ${sectionId}:`, error);
                return null;
            }

            const allowedSelectors = resolveAllowedSelectors(allowedSelectorsMap, section.file);

            if (Object.keys(allowedSelectors).length === 0) {
                console.warn(`No allowed selectors found for ${section.file}, AI response may include unsupported selectors.`);
            }

            // Call the text generation API
            try {
                const response = await fetch('api/generate-section-text.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        creative_brief: creativeBrief,
                        blueprint: blueprint,
                        section_html: sectionHtml,
                        section_id: sectionId,
                        allowed_selectors: allowedSelectors
                    }),
                    signal: abortController ? abortController.signal : undefined
                });

                const data = await response.json();

                if (!response.ok || !data.success) {
                    console.error(`Error generating text for section ${sectionId}:`, data.error);
                    return null;
                }

                const responseSectionId = data.section_id !== undefined && data.section_id !== null
                    ? data.section_id
                    : sectionId;

                // Apply text updates immediately when this section's request completes
                if (data.text_updates && iframe && iframe.contentWindow) {
                    iframe.contentWindow.postMessage({
                        type: 'APPLY_TEXT_UPDATES',
                        data: {
                            sectionNumber: responseSectionId,
                            textUpdates: data.text_updates
                        }
                    }, '*');
                    
                    completedCount++;
                    console.log(`Text generated and applied for section ${responseSectionId} (${completedCount}/${totalSections})`);
                }

                return {
                    sectionId: responseSectionId,
                    textUpdates: data.text_updates
                };
            } catch (error) {
                console.error(`Error calling text generation API for section ${sectionId}:`, error);
                return null;
            }
        });

        // Wait for all API calls to complete (but updates are applied immediately as each completes)
        await Promise.allSettled(sectionPromises);

        console.log('Text generation completed for', completedCount, 'sections');

        // Initialize TinyMCE for all sections after text updates are complete
        // This ensures the DOM structure is preserved for selector matching
        for (const sectionId of sectionIds) {
            if (typeof window.initTinyMCEForSection === 'function') {
                window.initTinyMCEForSection(sectionId);
                // Small delay between initializations to avoid overwhelming the browser
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }

        // Replace images with Unsplash after text generation
        updateStageIndicator('images');
        
        if (typeof window.AIImageReplacer !== 'undefined' && window.AIImageReplacer.replaceImagesWithUnsplash) {
            await window.AIImageReplacer.replaceImagesWithUnsplash(sectionIds, creativeBrief);
        } else {
            console.warn('AIImageReplacer not available, skipping image replacement');
        }
    }

    /**
     * Show the chat form
     */
    function show() {
        if (!chatForm) return;

        chatForm.classList.add('show');
        isVisible = true;

        // Reinitialize Lucide icons for the chat form
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }

        // Focus on textarea after a short delay to ensure it's visible
        setTimeout(() => {
            if (textarea) {
                textarea.focus();
            }
        }, 100);
    }

    /**
     * Hide the chat form
     */
    function hide() {
        if (!chatForm) return;

        chatForm.classList.remove('show');
        isVisible = false;
    }

    /**
     * Check if preview is empty and show/hide chat form accordingly
     */
    function checkVisibility() {
        // Don't auto-hide while generation is in progress
        if (isGenerating) {
            return;
        }

        // Check if onboarding should take priority (template-first: empty = no template)
        if (window.Onboarding && typeof window.Onboarding.checkVisibility === 'function') {
            const noTemplate = (typeof window.currentTemplateUrl === 'undefined' || !window.currentTemplateUrl);
            if (noTemplate) {
                // Hide AI chat, let onboarding handle visibility
                if (isVisible) hide();
                return;
            }
        }

        // Check if selectedSections is available (from app.php)
        if (typeof selectedSections !== 'undefined') {
            const isEmpty = selectedSections.size === 0;

            if (isEmpty && !isVisible) {
                show();
            } else if (!isEmpty && isVisible) {
                hide();
            }
        } else {
            // Fallback: check if preview content is empty
            const iframe = document.getElementById('preview-iframe');
            if (iframe && iframe.contentWindow) {
                try {
                    const previewContent = iframe.contentWindow.document.getElementById('preview-content');
                    if (previewContent) {
                        const sections = previewContent.querySelectorAll('.section');
                        const isEmpty = sections.length === 0;

                        if (isEmpty && !isVisible) {
                            show();
                        } else if (!isEmpty && isVisible) {
                            hide();
                        }
                    }
                } catch (e) {
                    // Cross-origin or iframe not ready
                    console.warn('Could not check preview content:', e);
                }
            }
        }
    }

    /**
     * Update visibility based on section count
     * This will be called from app.php when sections are added/removed
     */
    function updateVisibility() {
        checkVisibility();
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Expose API for external use
    window.AIChat = {
        show: show,
        hide: hide,
        updateVisibility: updateVisibility,
        checkVisibility: checkVisibility
    };

})();

