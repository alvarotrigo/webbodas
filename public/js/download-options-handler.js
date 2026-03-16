/**
 * Download Options Handler
 * Manages different export formats (HTML, React, etc.)
 */

class DownloadOptionsHandler {
    constructor() {
        // React project generation now handled by PHP backend
        this.currentTab = 'subdomain'; // Track current tab (subdomain | domain)
        this.successShown = false; // Track if success message was shown
        /** When set (e.g. from sidebar "Publish" on another page), publish this page instead of current */
        this.publishPageIdOverride = null;
        /** Previous share_slug preserved after unpublish so user can reactivate it */
        this.previousSlug = null;
        /** Whether the current slug+.com is confirmed available (Pro only) */
        this.domainAvailable = false;
        /** Debounce timer id for availability checks */
        this._availabilityTimer = null;
        // [DISABLED_FOR_WEDDING_VERSION]: Domain recommendations removed — Pro users can only purchase .com; no suggestions.
        // this.domainSuggestions = [];
        // this.suggestionIndex = 0;
        // this.cachedDomainSuggestions = null;
        // this.cachedDomainSuggestionsForTitle = null;
        // this.chosenSuggestionDomain = null;
        // this.suggestTlds = ['.com', '.es', '.online', '.net', '.org'];
        // if (title && title !== 'Untitled Page') this.prefetchDomainSuggestion(title);
    }

    /**
     * Comprueba si el template actual en el iframe contiene al menos un <form>
     */
    templateHasForm() {
        try {
            const iframe = document.getElementById('preview-iframe');
            if (!iframe || !iframe.contentDocument) return false;
            return !!iframe.contentDocument.querySelector('form');
        } catch (e) {
            return false;
        }
    }

    /**
     * [DISABLED_FOR_WEDDING_VERSION]: showUpgradeModal removed from download handler — upgrade modal
     * only appears during onboarding (when user has no pages). All internal calls to this method
     * are also disabled below.
     */
    async showUpgradeModal() {
        // [DISABLED_FOR_WEDDING_VERSION]: Upgrade modal disabled outside of onboarding.
        // if (typeof window.upgradeModal !== 'undefined' && window.upgradeModal) {
        //     await window.upgradeModal.show();
        // } else {
        //     alert('GitHub Export is a Pro feature. Please upgrade to continue.');
        // }
    }

    /**
     * Show publish modal — simplified design based on user plan.
     * If the page had a previous slug (after unpublish), shows reactivation options.
     * Otherwise shows the standard "choose name" input.
     * @param {string|null} [pageId] - If provided (e.g. from sidebar), publish this page instead of current.
     * @param {string|null} [previousSlugOverride] - Previous slug passed from sidebar page list.
     */
    showDownloadOptions(pageId, previousSlugOverride) {
        this.publishPageIdOverride = pageId || null;
        const isPro = !!(typeof window.serverUserData !== 'undefined' && window.serverUserData && window.serverUserData.is_paid);
        const domainSuffix = isPro ? '.com' : '.yeslovey.com';

        const savedSlug = previousSlugOverride || this.previousSlug || null;

        let modalHTML;

        if (savedSlug) {
            // If savedSlug is already a full domain (Pro custom domain, e.g. "mi-boda.com"),
            // don't append domainSuffix again
            const fullDomain = savedSlug.includes('.') ? savedSlug : (savedSlug + domainSuffix);
            modalHTML = `
            <div id="download-options-modal" class="modal-overlay fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-[10000]" style="display: flex;">
                <div class="download-options-modal-content rounded-2xl shadow-2xl max-w-lg w-full mx-4 github-export-content" style="background-color: var(--primary-bg, #ffffff);" onclick="event.stopPropagation()">
                    <div class="p-8 relative">

                        <button onclick="window.downloadOptionsHandler.closeModal()" aria-label="Close" class="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full transition-all hover:bg-[var(--accent-bg)] text-[var(--secondary-text)] hover:text-[var(--primary-text)]">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                        </button>

                        <h2 class="text-2xl font-bold text-[var(--primary-text)] mb-2 pr-8">Republish your website</h2>
                        <p class="text-[var(--secondary-text)] text-sm mb-6">Your previous domain is still available.</p>

                        <!-- Option 1: Reactivate previous domain -->
                        <button onclick="window.downloadOptionsHandler.reactivatePage()" class="republish-option-btn republish-option-reactivate w-full py-4 px-5 rounded-xl border-2 border-blue-500 bg-blue-50 hover:bg-blue-100 transition-all mb-3 text-left" style="background: color-mix(in srgb, var(--primary-bg) 92%, #3b82f6 8%); border-color: #3b82f6;">
                            <div class="flex items-center gap-3">
                                <div class="shrink-0 w-10 h-10 rounded-full flex items-center justify-center" style="background: #3b82f6;">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
                                </div>
                                <div>
                                    <span class="block font-semibold text-[var(--primary-text)]">Reactivate previous domain</span>
                                    <span class="block text-sm mt-0.5" style="color: #3b82f6; font-weight: 500;">${fullDomain}</span>
                                </div>
                            </div>
                        </button>

                        <!-- Option 2: Choose a new domain -->
                        <button onclick="window.downloadOptionsHandler.showNewDomainInput()" class="republish-option-btn w-full py-4 px-5 rounded-xl border border-[var(--border-color)] hover:border-[var(--secondary-text)] transition-all text-left" style="background: var(--primary-bg);">
                            <div class="flex items-center gap-3">
                                <div class="shrink-0 w-10 h-10 rounded-full flex items-center justify-center" style="background: var(--accent-bg);">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-[var(--secondary-text)]"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                </div>
                                <div>
                                    <span class="block font-semibold text-[var(--primary-text)]">Choose a new domain</span>
                                    <span class="block text-sm text-[var(--secondary-text)] mt-0.5">Remove the old name and pick a different one</span>
                                </div>
                            </div>
                        </button>

                    </div>
                </div>
            </div>
            `;
        } else if (isPro) {
            modalHTML = this._buildProDomainModalHTML();
        } else {
            modalHTML = this._buildNewDomainModalHTML(domainSuffix);
        }

        const existingModal = document.getElementById('download-options-modal');
        if (existingModal) existingModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.successShown = false;
        this._attachModalCloseHandlers();

        // For Pro users opening the new-domain form directly, initialize domain features
        if (!savedSlug && isPro) {
            this._initProDomainModal();
        }
        // For free users: initialize subdomain slug availability check (DB lookup)
        if (!savedSlug && !isPro) {
            this._initFreeSubdomainModal();
        }
    }

    /**
     * Build the standard "choose a new name" modal HTML (extracted for reuse).
     */
    _buildNewDomainModalHTML(domainSuffix) {
        return `
            <div id="download-options-modal" class="modal-overlay fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-[10000]" style="display: flex;">
                <div class="download-options-modal-content rounded-2xl shadow-2xl max-w-lg w-full mx-4 github-export-content" style="background-color: var(--primary-bg, #ffffff);" onclick="event.stopPropagation()">
                    <div class="p-8 relative">

                        <button onclick="window.downloadOptionsHandler.closeModal()" aria-label="Close" class="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full transition-all hover:bg-[var(--accent-bg)] text-[var(--secondary-text)] hover:text-[var(--primary-text)]">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                        </button>

                        <h2 class="text-2xl font-bold text-[var(--primary-text)] mb-6 pr-8">Choose your website name</h2>

                        <div class="flex items-center border border-[var(--border-color)] rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
                            <input type="text" id="publish-web-name" placeholder="my-wedding"
                                class="flex-1 px-4 py-3 border-0 focus:outline-none focus:ring-0 bg-[var(--primary-bg)] text-[var(--primary-text)]"
                                maxlength="64" autocomplete="off">
                            <span class="px-4 py-3 bg-[var(--secondary-bg)] text-[var(--secondary-text)] border-l border-[var(--border-color)] whitespace-nowrap font-medium">${domainSuffix}</span>
                        </div>

                        <!-- Availability status indicator (same as Pro: "Checking availability..." / Available / Not available) -->
                        <div id="domain-status-indicator" class="domain-status-indicator mt-3 min-h-[1.75rem] flex items-center gap-2">
                            <!-- Populated dynamically by _setDomainStatus() -->
                        </div>

                        <div class="mt-5">
                            <button id="free-publish-btn" onclick="window.downloadOptionsHandler.publishPage()" disabled
                                class="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all font-medium text-base flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600">
                                Publish
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
                                    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
                                    <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
                                    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
                                    <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
                                </svg>
                            </button>
                        </div>

                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Build the Pro "choose a new domain" modal: slug input + fixed .com suffix,
     * real-time availability indicator, and conditional Publish button.
     * Pro users can only purchase .com domains (no recommendations).
     */
    _buildProDomainModalHTML() {
        return `
            <div id="download-options-modal" class="modal-overlay fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-[10000]" style="display: flex;">
                <div class="download-options-modal-content rounded-2xl shadow-2xl max-w-lg w-full mx-4 github-export-content" style="background-color: var(--primary-bg, #ffffff);" onclick="event.stopPropagation()">
                    <div class="p-8 relative">

                        <button onclick="window.downloadOptionsHandler.closeModal()" aria-label="Close" class="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full transition-all hover:bg-[var(--accent-bg)] text-[var(--secondary-text)] hover:text-[var(--primary-text)]">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                        </button>

                        <h2 class="text-2xl font-bold text-[var(--primary-text)] mb-2 pr-8">Choose your domain</h2>

                        <!-- Domain input: slug only, with fixed .com suffix (Pro: .com only) -->
                        <div class="domain-input-group flex items-center border border-[var(--border-color)] rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
                            <input type="text" id="publish-web-name" placeholder="my-wedding"
                                class="flex-1 px-4 py-3 border-0 focus:outline-none focus:ring-0 bg-[var(--primary-bg)] text-[var(--primary-text)] min-w-0"
                                maxlength="64" autocomplete="off" spellcheck="false">
                            <span class="px-4 py-3 bg-[var(--secondary-bg)] text-[var(--secondary-text)] border-l border-[var(--border-color)] whitespace-nowrap font-medium">.com</span>
                        </div>

                        <!-- Availability status indicator (mb-4 adds space above Continue when e.g. "Not available") -->
                        <div id="domain-status-indicator" class="domain-status-indicator mt-3 min-h-0 flex items-center gap-1">
                            <!-- Populated dynamically by _setDomainStatus() -->
                        </div>
                        <!-- Pro only: 1 year free message, shown when domain is Available -->
                        <div id="pro-domain-free-year" class="hidden -mt-2.5 mb-3 text-lm text-[var(--secondary-text)] leading-none">🎉 1 year free with your website!</div>

                        <div class="mt-5">
                            <button id="pro-publish-btn" onclick="window.downloadOptionsHandler.publishPage()"
                                disabled
                                class="pro-publish-btn w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all font-medium text-base flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600">
                                Continue
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
                                    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
                                    <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
                                    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
                                    <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
                                </svg>
                            </button>
                        </div>

                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Build the "Change Domain" modal HTML: shows Current Domain and New Domain input.
     * @param {string} currentDomain - Full current domain (e.g. slug.yeslovey.com or slug.com)
     * @param {string} domainSuffix - Suffix for new domain (e.g. .yeslovey.com or .com)
     * @param {string} currentSlug - Current slug only (for pre-filling the new domain input)
     */
    _buildChangeDomainModalHTML(currentDomain, domainSuffix, currentSlug) {
        const safeCurrent = (currentDomain || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        // For .com (Pro), input is slug-only so placeholder should be slug without TLD
        let placeholderSlug = (currentSlug || 'my-wedding').trim();
        if (domainSuffix === '.com' && placeholderSlug.endsWith('.com')) placeholderSlug = placeholderSlug.slice(0, -4).trim() || 'my-wedding';
        const safePlaceholder = placeholderSlug.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `
            <div id="download-options-modal" class="modal-overlay fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-[10000]" style="display: flex;">
                <div class="download-options-modal-content rounded-2xl shadow-2xl max-w-lg w-full mx-4 github-export-content" style="background-color: var(--primary-bg, #ffffff);" onclick="event.stopPropagation()">
                    <div class="p-8 relative">

                        <button onclick="window.downloadOptionsHandler.closeModal()" aria-label="Close" class="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full transition-all hover:bg-[var(--accent-bg)] text-[var(--secondary-text)] hover:text-[var(--primary-text)]">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                        </button>

                        <h2 class="text-2xl font-bold text-[var(--primary-text)] mb-6 pr-8">Change Domain</h2>

                        <div class="mb-4">
                            <label class="block text-sm font-medium text-[var(--secondary-text)] mb-2">Current Domain</label>
                            <div class="px-4 py-3 rounded-lg border border-[var(--border-color)] bg-[var(--secondary-bg)] text-[var(--primary-text)] font-medium">${safeCurrent}</div>
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-[var(--secondary-text)] mb-2">New Domain</label>
                            <div class="flex items-center border border-[var(--border-color)] rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
                                <input type="text" id="publish-web-name" placeholder="${safePlaceholder}" value=""
                                    class="flex-1 px-4 py-3 border-0 focus:outline-none focus:ring-0 bg-[var(--primary-bg)] text-[var(--primary-text)]"
                                    maxlength="64" autocomplete="off" spellcheck="false">
                                <span class="px-4 py-3 bg-[var(--secondary-bg)] text-[var(--secondary-text)] border-l border-[var(--border-color)] whitespace-nowrap font-medium">${domainSuffix}</span>
                            </div>
                            <div id="domain-status-indicator" class="domain-status-indicator mt-3 min-h-[1.75rem] flex items-center gap-2"></div>
                        </div>

                        <div class="mt-6">
                            <button id="pro-publish-btn" onclick="window.downloadOptionsHandler.publishPage()" ${domainSuffix === '.com' ? 'disabled' : ''}
                                class="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all font-medium text-base flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600">
                                Update Domain
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
                                    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/>
                                </svg>
                            </button>
                        </div>

                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Show the Change Domain modal (Current Domain + New Domain input).
     * Called when user clicks "Change Domain" in the publish dropdown. Uses current slug from the wrap.
     * If no current slug is available, falls back to the standard new-domain modal.
     */
    showChangeDomainModal() {
        const wrap = document.getElementById('publish-dropdown-wrap');
        const currentSlug = (wrap && wrap.dataset.viewWebsiteSlug) ? wrap.dataset.viewWebsiteSlug.trim() : '';
        const isPro = !!(typeof window.serverUserData !== 'undefined' && window.serverUserData && window.serverUserData.is_paid);
        const domainSuffix = isPro ? '.com' : '.yeslovey.com';

        if (!currentSlug) {
            this.showNewDomainInput();
            return;
        }

        // For Pro, share_slug already contains the full domain (e.g. "mi-boda.com"); for free, append base domain
        const currentDomain = currentSlug.includes('.') ? currentSlug : (currentSlug + domainSuffix);
        const existingModal = document.getElementById('download-options-modal');
        if (existingModal) existingModal.remove();

        document.body.insertAdjacentHTML('beforeend', this._buildChangeDomainModalHTML(currentDomain, domainSuffix, currentSlug));
        this._attachModalCloseHandlers();

        const input = document.getElementById('publish-web-name');
        if (input) {
            if (domainSuffix === '.com' && currentSlug.endsWith('.com')) {
                input.placeholder = currentSlug.slice(0, -4).trim() || 'my-wedding';
            } else {
                input.placeholder = currentSlug || 'my-wedding';
            }
            input.focus();
        }
        if (isPro) this._initProDomainModal();
    }

    /**
     * Switch the republish modal to show the new-domain input form.
     */
    showNewDomainInput() {
        const isPro = !!(typeof window.serverUserData !== 'undefined' && window.serverUserData && window.serverUserData.is_paid);
        const domainSuffix = isPro ? '.com' : '.yeslovey.com';

        const existingModal = document.getElementById('download-options-modal');
        if (existingModal) existingModal.remove();

        if (isPro) {
            document.body.insertAdjacentHTML('beforeend', this._buildProDomainModalHTML());
            this._attachModalCloseHandlers();
            this._initProDomainModal();
        } else {
            document.body.insertAdjacentHTML('beforeend', this._buildNewDomainModalHTML(domainSuffix));
            this._attachModalCloseHandlers();
            const input = document.getElementById('publish-web-name');
            if (input) input.focus();
        }
    }

    /**
     * Attach close-on-click and close-on-Escape handlers to the modal.
     * Only close on overlay click when both mousedown and mouseup happened on the overlay,
     * so that selecting text in the domain field (mousedown inside, drag outside, mouseup on overlay) does not close the modal.
     */
    _attachModalCloseHandlers() {
        const modal = document.getElementById('download-options-modal');
        if (!modal) return;

        let mousedownOnOverlay = false;
        modal.addEventListener('mousedown', (e) => {
            mousedownOnOverlay = (e.target === modal);
        });
        modal.addEventListener('click', (e) => {
            if (e.target === modal && mousedownOnOverlay) this.closeModal();
        });

        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }

    /**
     * Setup privacy toggle handler
     */
    setupPrivacyToggle() {
        const toggle = document.getElementById('github-private-toggle');
        const label = document.getElementById('github-privacy-label');
        const description = document.getElementById('github-privacy-description');
        
        if (!toggle) return;
        
        toggle.addEventListener('change', function() {
            if (this.checked) {
                // Private
                label.textContent = 'Private Repository';
                description.textContent = 'Only you can see this repository';
            } else {
                // Public
                label.textContent = 'Public Repository';
                description.textContent = 'Anyone can see this repository';
            }
        });
    }

    /**
     * Setup export format selection styling
     */
    setupFormatSelectionStyling() {
        const formatOptions = document.querySelectorAll('.export-format-option');
        
        // Function to update styling
        const updateSelection = () => {
            formatOptions.forEach(option => {
                const radio = option.querySelector('input[type="radio"]');
                if (radio && radio.checked) {
                    option.classList.add('border-blue-600', 'bg-[var(--accent-bg)]');
                    option.classList.remove('border-gray-200');
                } else {
                    option.classList.remove('border-blue-600', 'bg-[var(--accent-bg)]');
                    option.classList.add('border-gray-200');
                }
            });
        };
        
        // Initial styling
        updateSelection();
        
        // Add change listeners
        formatOptions.forEach(option => {
            const radio = option.querySelector('input[type="radio"]');
            if (radio) {
                radio.addEventListener('change', updateSelection);
            }
        });
    }

    /**
     * Disable GitHub tab (for non-pro users or errors)
     */
    disableGitHubTab() {
        const tabGithub = document.getElementById('tab-github');
        const contentGithub = document.getElementById('content-github');
        
        if (tabGithub) {
            // Disable the tab button
            tabGithub.disabled = true;
            tabGithub.style.opacity = '0.5';
            tabGithub.style.cursor = 'not-allowed';
            
            // [DISABLED_FOR_WEDDING_VERSION]: Upgrade modal on GitHub tab click removed — modal only
            // appears during onboarding (when user has no pages).
            tabGithub.onclick = (e) => {
                e.preventDefault();
                // this.showUpgradeModal();
            };
            
            // Add a Pro badge to the tab
            if (!tabGithub.querySelector('.pro-badge')) {
                const badge = document.createElement('span');
                badge.className = 'pro-badge ml-2 bg-purple-600 text-white text-xs px-2 py-0.5 rounded-full font-semibold';
                badge.textContent = 'PRO';
                tabGithub.appendChild(badge);
            }
        }
    }

    /**
     * Switch between tabs (subdomain | domain)
     */
    switchTab(tabName) {
        const tabDomain = document.getElementById('tab-domain');
        if (tabName === 'domain' && tabDomain && tabDomain.disabled) {
            // [DISABLED_FOR_WEDDING_VERSION]: Upgrade modal on domain tab click removed — modal only
            // appears during onboarding (when user has no pages).
            // this.showUpgradeModal();
            return;
        }
        this.currentTab = tabName;
        const tabSubdomain = document.getElementById('tab-subdomain');
        const contentSubdomain = document.getElementById('content-subdomain');
        const contentDomain = document.getElementById('content-domain');
        if (!tabSubdomain || !contentSubdomain || !contentDomain) return;
        if (tabName === 'subdomain') {
            tabSubdomain.className = 'flex-1 py-3 px-6 rounded-lg font-semibold transition-all bg-[var(--primary-bg)] text-[var(--primary-text)] shadow-sm';
            tabDomain.className = 'flex-1 py-3 px-6 rounded-lg font-semibold transition-all text-[var(--secondary-text)] hover:text-[var(--primary-text)] flex items-center justify-center gap-2';
            contentSubdomain.classList.remove('hidden');
            contentDomain.classList.add('hidden');
        } else {
            tabDomain.className = 'flex-1 py-3 px-6 rounded-lg font-semibold transition-all bg-[var(--primary-bg)] text-[var(--primary-text)] shadow-sm flex items-center justify-center gap-2';
            tabSubdomain.className = 'flex-1 py-3 px-6 rounded-lg font-semibold transition-all text-[var(--secondary-text)] hover:text-[var(--primary-text)]';
            contentDomain.classList.remove('hidden');
            contentSubdomain.classList.add('hidden');
        }
    }

    /**
     * Deshabilita la pestaña Domain (Pro) para usuarios no Pro; switchTab('domain') muestra upgrade modal.
     */
    applyDomainProRestriction() {
        const isPro = !!(typeof window.serverUserData !== 'undefined' && window.serverUserData && window.serverUserData.is_paid);
        const tabDomain = document.getElementById('tab-domain');
        if (!tabDomain) return;
        if (isPro) return;
        tabDomain.disabled = true;
        tabDomain.style.opacity = '0.6';
        tabDomain.style.cursor = 'not-allowed';
    }

    // ─── Pro Domain Logic ────────────────────────────────────────────

    /**
     * Called after inserting the Pro domain modal HTML.
     * Resets availability state and attaches input listener for real-time .com availability check.
     */
    _initProDomainModal() {
        this.domainAvailable = false;
        this._setDomainStatus('idle');

        const input = document.getElementById('publish-web-name');
        if (input) input.focus();

        this._attachDomainCheckListeners();

        if (typeof lucide !== 'undefined' && lucide.createIcons) {
            lucide.createIcons();
        }
    }

    // [DISABLED_FOR_WEDDING_VERSION]: Domain recommendations removed — Pro only .com; no suggest API or prefetch.
    // prefetchDomainSuggestion(pageTitle) { ... }
    // _fetchSuggestions(pageTitleOrSlug, onDone) { ... }

    /**
     * Check domain availability with a 600ms debounce.
     * Pro: input is slug only; we append .com and check slug.com.
     * @param {string} [slugOrFull] - If provided, use as slug (we append .com) or skip and read from input.
     */
    _checkAvailability(slugOrFull) {
        const input = document.getElementById('publish-web-name');
        let slug = (slugOrFull != null ? slugOrFull : (input && input.value) || '').trim().toLowerCase();
        // Strip .com if user typed it (Pro is .com only)
        if (slug.endsWith('.com')) slug = slug.slice(0, -4).trim();

        this.domainAvailable = false;
        this._updatePublishBtnState(false);

        if (!slug) {
            this._setDomainStatus('idle');
            return;
        }

        // Slug: letters, numbers, hyphens only (no dots)
        if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i.test(slug)) {
            this._setDomainStatus('invalid');
            return;
        }

        const fullDomain = slug + '.com';
        this._setDomainStatus('loading');

        if (this._availabilityTimer) clearTimeout(this._availabilityTimer);
        this._availabilityTimer = setTimeout(() => {
            fetch('./api/domain.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'lookup', domain: fullDomain })
            })
            .then(function(res) { return res.json(); })
            .then((data) => {
                if (!data.success) {
                    this._setDomainStatus('error');
                    return;
                }
                this.domainAvailable = !!data.available;
                this._setDomainStatus(this.domainAvailable ? 'available' : 'unavailable');
                this._updatePublishBtnState(this.domainAvailable);
            })
            .catch(() => {
                this._setDomainStatus('error');
            });
        }, 600);
    }

    /**
     * Enable or disable the Publish button based on availability.
     * Works for both Pro (pro-publish-btn) and Free (free-publish-btn) modals.
     * @param {boolean} enabled
     */
    _updatePublishBtnState(enabled) {
        const btn = document.getElementById('pro-publish-btn') || document.getElementById('free-publish-btn');
        if (!btn) return;
        btn.disabled = !enabled;
    }

    /**
     * Update the domain availability status indicator.
     * @param {'idle'|'loading'|'available'|'unavailable'|'invalid'|'error'} state
     */
    _setDomainStatus(state) {
        const el = document.getElementById('domain-status-indicator');
        if (!el) return;

        const states = {
            idle: '',
            loading: `
                <span class="domain-status-spinner inline-block w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin shrink-0"></span>
                <span class="text-[var(--secondary-text)]">Checking availability...</span>`,
            available: `
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 domain-status-available" style="color:#16a34a"><polyline points="20 6 9 17 4 12"/></svg>
                <span class="domain-status-available font-medium" style="color:#16a34a">Available</span>`,
            unavailable: `
                <div class="flex items-center gap-2 mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 domain-status-unavailable" style="color:#dc2626"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    <span class="domain-status-unavailable" style="color:#dc2626">Not available.</span>
                </div>`,
            invalid: `
                <div class="flex items-center gap-2 mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="shrink-0" style="color:#d97706"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <span style="color:#d97706">Use only letters, numbers and hyphens (e.g. my-wedding)</span>
                </div>`,
            error: `
                <div class="flex items-center gap-2 mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="shrink-0" style="color:#9ca3af"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <span style="color:#9ca3af">Could not check availability. Try again.</span>
                </div>`,
        };

        el.innerHTML = states[state] || '';
        // Pro modal only: show/hide "1 year Free" message when domain is available
        const benefitEl = document.getElementById('pro-domain-free-year');
        if (benefitEl) benefitEl.style.display = (state === 'available') ? 'block' : 'none';
    }

    // [DISABLED_FOR_WEDDING_VERSION]: Domain recommendations removed — no suggestions list or Choose flow.
    // _renderUnavailableSuggestions(lookedUpDomain) { ... }
    // _chooseSuggestion(domain) { ... }

    /**
     * Attach input listener to the Pro modal for real-time availability checks.
     */
    _attachDomainCheckListeners() {
        const input = document.getElementById('publish-web-name');
        if (!input) return;

        input.addEventListener('input', () => this._checkAvailability());
    }

    // ─── Free user: subdomain slug availability (DB check) ─────────────

    /**
     * Check subdomain slug availability against the database (no other page has this share_slug).
     * Shows "Checking availability..." then Available / Not available, same as Pro.
     * @param {string} [slugOrFull] - If provided, use as slug; otherwise read from publish-web-name input.
     */
    _checkSubdomainAvailability(slugOrFull) {
        const input = document.getElementById('publish-web-name');
        let slug = (slugOrFull != null ? slugOrFull : (input && input.value) || '').trim();
        slug = slug.replace(/\s+/g, '-').toLowerCase();

        this.domainAvailable = false;
        this._updatePublishBtnState(false);

        if (!slug) {
            this._setDomainStatus('idle');
            return;
        }

        if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i.test(slug)) {
            this._setDomainStatus('invalid');
            return;
        }

        this._setDomainStatus('loading');

        if (this._availabilityTimer) clearTimeout(this._availabilityTimer);
        this._availabilityTimer = setTimeout(() => {
            const pageId = this.publishPageIdOverride || (window.pageManagerInstance && window.pageManagerInstance.currentPageId);
            const clerkUserId = window.serverUserData && window.serverUserData.clerk_user_id;
            if (!clerkUserId) {
                this._setDomainStatus('error');
                return;
            }
            fetch('./api/pages.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'check-subdomain',
                    share_slug: slug,
                    id: pageId || undefined,
                    clerk_user_id: clerkUserId
                })
            })
                .then(function (res) { return res.json(); })
                .then((data) => {
                    if (!data.success) {
                        this._setDomainStatus('error');
                        return;
                    }
                    this.domainAvailable = !!data.available;
                    this._setDomainStatus(this.domainAvailable ? 'available' : 'unavailable');
                    this._updatePublishBtnState(this.domainAvailable);
                })
                .catch(() => {
                    this._setDomainStatus('error');
                });
        }, 600);
    }

    /**
     * Attach input listener to the free-user modal for real-time slug availability checks.
     */
    _initFreeSubdomainModal() {
        const input = document.getElementById('publish-web-name');
        if (!input) return;
        input.addEventListener('input', () => this._checkSubdomainAvailability());
        this._checkSubdomainAvailability();
    }

    // ─── End Pro Domain Logic ────────────────────────────────────────

    /**
     * Close the download options modal
     */
    closeModal() {
        const modal = document.getElementById('download-options-modal');
        if (modal) {
            modal.remove();
        }
    }

    /**
     * Publish page.
     * Non-PRO: subdomain (slug.yeslovey.com) via publish-subdomain action.
     * PRO: custom domain (slug.com) — Step 1 validates domain, then transitions to Step 2a (owner form).
     */
    publishPage() {
        console.log('publishPage() called');
        console.log('  pageManagerInstance:', window.pageManagerInstance);
        console.log('  currentPageId:', window.pageManagerInstance && window.pageManagerInstance.currentPageId);
        console.log('  serverUserData:', window.serverUserData);

        const pageId = this.publishPageIdOverride || (window.pageManagerInstance && window.pageManagerInstance.currentPageId);
        const clerkUserId = window.serverUserData && window.serverUserData.clerk_user_id;
        const isPro = !!(typeof window.serverUserData !== 'undefined' && window.serverUserData && window.serverUserData.is_paid);

        if (!pageId || !clerkUserId) {
            this.closeModal();
            if (typeof showToast === 'function') {
                showToast('Publish Failed', 'Please save your page first.', {});
            } else {
                alert('Please save your page first.');
            }
            return;
        }

        const input = document.getElementById('publish-web-name');
        const webName = (input && input.value.trim()) || '';
        if (!webName) {
            alert('Please enter a name for your website.');
            if (input) input.focus();
            return;
        }

        if (isPro) {
            // Step 1 → Step 2a: store pending domain, show owner details form
            let slug = webName.toLowerCase().trim();
            if (slug.endsWith('.com')) slug = slug.slice(0, -4).trim();
            if (!slug) {
                alert('Please enter a name for your domain.');
                if (input) input.focus();
                return;
            }
            if (!this.domainAvailable) {
                alert('Please wait for the domain availability check to complete, or choose an available name.');
                return;
            }
            this._pendingDomain = slug + '.com';
            this._pendingSlug   = slug;
            this._showOwnerForm();
            return;
        }

        // Free user: publish directly with subdomain
        if (!this.domainAvailable) {
            alert('Please wait for the availability check to complete, or choose an available name.');
            return;
        }
        const slug = webName.replace(/\s+/g, '-').toLowerCase().trim();
        const payload = {
            action: 'publish-subdomain',
            id: pageId,
            clerk_user_id: clerkUserId,
            share_slug: slug
        };

        console.log('Publish: sending POST to api/pages.php', payload);

        const apiPromise = fetch('./api/pages.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
            .then(function (res) { return res.json(); })
            .then(function (result) {
                if (!result.success || !result.share_url) {
                    throw new Error(result.error || 'Failed to publish page');
                }
                return { shareUrl: result.share_url, shareSlug: result.share_slug || '' };
            });

        this._showPublishProgress(apiPromise);
    }

    /**
     * Step 2a: Replace modal content with the domain owner details form.
     * Called after the user confirms domain availability in Step 1 (Pro flow).
     */
    _showOwnerForm() {
        const modal = document.getElementById('download-options-modal');
        const contentEl = modal ? modal.querySelector('.download-options-modal-content') : null;
        if (!contentEl) return;
        contentEl.innerHTML = this._buildOwnerFormHTML();
        // Widen modal for Step 2a so the form fits better on screen
        contentEl.classList.remove('max-w-lg');
        contentEl.classList.add('max-w-2xl');
        // Enable/disable CTA based on checkbox state
        const form = contentEl.querySelector('#publish-owner-form');
        if (form) {
            form.addEventListener('change', () => {
                const chk1 = form.querySelector('#pub-owner-confirm');
                const chk2 = form.querySelector('#pub-owner-terms');
                const btn  = form.querySelector('#pub-owner-submit-btn');
                if (btn) btn.disabled = !(chk1 && chk1.checked && chk2 && chk2.checked);
            });
        }
    }

    /**
     * Build the Step 2a HTML: domain owner details form.
     */
    _buildOwnerFormHTML() {
        const domain = (this._pendingDomain || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `
            <div class="p-8 relative publish-owner-form-view">
                <!-- Back button -->
                <button onclick="window.downloadOptionsHandler._goBackToStep1()" aria-label="Back" class="absolute top-4 left-4 w-8 h-8 flex items-center justify-center rounded-full transition-all hover:bg-[var(--accent-bg)] text-[var(--secondary-text)] hover:text-[var(--primary-text)]">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <!-- Close button -->
                <button onclick="window.downloadOptionsHandler.closeModal()" aria-label="Close" class="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full transition-all hover:bg-[var(--accent-bg)] text-[var(--secondary-text)] hover:text-[var(--primary-text)]">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>

                <form id="publish-owner-form" onsubmit="event.preventDefault(); window.downloadOptionsHandler._submitOwnerForm();" autocomplete="on">
                    <!-- Free badge (centered) -->
                    <div class="flex justify-center mb-2">
                        <div class="pub-owner-badge">🎉 Free custom domain included!</div>
                    </div>

                    <h2 class="text-2xl font-bold text-[var(--primary-text)] mb-2 pr-8">Domain Owner Details</h2>
                    <p class="pub-owner-subtitle mb-5">This information will be used to register <strong>${domain}</strong>.</p>

                    <div class="pub-owner-row">
                        <div class="pub-owner-group">
                            <label for="pub-owner-first">First name</label>
                            <input type="text" id="pub-owner-first" name="first_name" placeholder="John" required autocomplete="given-name">
                        </div>
                        <div class="pub-owner-group">
                            <label for="pub-owner-last">Last name</label>
                            <input type="text" id="pub-owner-last" name="last_name" placeholder="Doe" required autocomplete="family-name">
                        </div>
                    </div>

                    <div class="pub-owner-row">
                        <div class="pub-owner-group">
                            <label for="pub-owner-email">Email</label>
                            <input type="email" id="pub-owner-email" name="email" placeholder="john@example.com" required autocomplete="email">
                        </div>
                        <div class="pub-owner-group">
                            <label for="pub-owner-phone">Phone</label>
                            <input type="tel" id="pub-owner-phone" name="phone" placeholder="+1 555 000 0000" required autocomplete="tel">
                        </div>
                    </div>

                    <div class="pub-owner-row">
                        <div class="pub-owner-group">
                            <label for="pub-owner-address">Address</label>
                            <input type="text" id="pub-owner-address" name="address" placeholder="123 Main St, City, Country" required autocomplete="street-address">
                        </div>
                    </div>

                    <div class="pub-owner-row">
                        <div class="pub-owner-group">
                            <label for="pub-owner-org">Organization <span class="pub-owner-optional">(optional)</span></label>
                            <input type="text" id="pub-owner-org" name="organization" placeholder="Company name" autocomplete="organization">
                        </div>
                    </div>

                    <div class="pub-owner-checkboxes">
                        <div class="pub-owner-checkbox-row">
                            <input type="checkbox" id="pub-owner-confirm">
                            <label for="pub-owner-confirm">I confirm these details are accurate and belong to the domain owner.</label>
                        </div>
                        <div class="pub-owner-checkbox-row">
                            <input type="checkbox" id="pub-owner-terms">
                            <label for="pub-owner-terms">I agree to the <a href="./domain-registration-terms-yeslovey.html" target="_blank" rel="noopener">Domain Registration Terms</a></label>
                        </div>
                    </div>

                    <div id="pub-owner-error" class="pub-owner-error hidden" role="alert"></div>

                    <button type="submit" id="pub-owner-submit-btn" class="pub-owner-submit-btn" disabled>
                        Register domain and publish
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                    </button>
                </form>
            </div>
        `;
    }

    /**
     * Go back from Step 2a to Step 1 (rebuild Pro domain modal).
     */
    _goBackToStep1() {
        // Rebuild Step 1 modal and pre-fill the domain slug
        this.closeModal();
        document.body.insertAdjacentHTML('beforeend', this._buildProDomainModalHTML());
        this._initProDomainModal();
        const input = document.getElementById('publish-web-name');
        if (input && this._pendingSlug) {
            input.value = this._pendingSlug;
            this._checkAvailability();
        }
    }

    /**
     * Step 2a → Step 2b: collect form data, validate, fire API, show progress bar.
     */
    _submitOwnerForm() {
        const pageId      = this.publishPageIdOverride || (window.pageManagerInstance && window.pageManagerInstance.currentPageId);
        const clerkUserId = window.serverUserData && window.serverUserData.clerk_user_id;

        if (!pageId || !clerkUserId) {
            alert('Session error. Please reload and try again.');
            return;
        }

        const get = (id) => {
            const el = document.getElementById(id);
            return el ? el.value.trim() : '';
        };

        const firstName = get('pub-owner-first');
        const lastName  = get('pub-owner-last');
        const email     = get('pub-owner-email');
        const phone     = get('pub-owner-phone');
        const address   = get('pub-owner-address');
        const org       = get('pub-owner-org');

        if (!firstName || !lastName || !email || !phone || !address) {
            alert('Please fill in all required fields.');
            return;
        }

        const payload = {
            action:       'publish-domain',
            id:           pageId,
            clerk_user_id: clerkUserId,
            domain:       this._pendingDomain,
            share_slug:   this._pendingSlug,
            contact: {
                first_name:   firstName,
                last_name:    lastName,
                email:        email,
                phone:        phone,
                address:      address,
                organization: org
            }
        };

        console.log('Pro publish: sending POST to api/pages.php', payload);

        // Build the real API promise — progress bar starts immediately and reacts when this resolves
        const apiPromise = fetch('./api/pages.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
            .then(function (res) { return res.json(); })
            .then(function (result) {
                if (!result.success || !result.share_url) {
                    throw new Error(result.error || 'Registration failed. Please check your details and try again.');
                }
                return { shareUrl: result.share_url, shareSlug: result.share_slug || '', isPro: true };
            });

        // Show progress bar straight away; it will react live when the promise settles
        this._showPublishProgress(apiPromise, 'pro');
    }

    /**
     * Show error badge above the Register button (Step 2a) when domain registration fails.
     * @param {string} message - Error text to display
     */
    _showOwnerFormError(message) {
        const el = document.getElementById('pub-owner-error');
        if (!el) return;
        el.textContent = message || 'Please review your data and try again.';
        el.classList.remove('hidden');
    }

    /**
     * Hide the registration error badge on the owner form.
     */
    _hideOwnerFormError() {
        const el = document.getElementById('pub-owner-error');
        if (!el) return;
        el.textContent = '';
        el.classList.add('hidden');
    }

    /**
     * Reactivate a previously published page using its stored share_slug.
     * Sets is_public back to true without changing the slug.
     */
    reactivatePage() {
        const pageId = this.publishPageIdOverride || (window.pageManagerInstance && window.pageManagerInstance.currentPageId);
        const clerkUserId = window.serverUserData && window.serverUserData.clerk_user_id;
        const slug = this.previousSlug;

        if (!pageId || !clerkUserId || !slug) {
            this.closeModal();
            if (typeof showToast === 'function') {
                showToast('Error', 'Could not reactivate. Please try publishing again.', {});
            }
            return;
        }

        const isPro = !!(typeof window.serverUserData !== 'undefined' && window.serverUserData && window.serverUserData.is_paid);

        const isCustomDomainSlug = isPro && slug.includes('.');
        const publishAction = isCustomDomainSlug ? 'publish-domain' : 'publish-subdomain';
        const reactivatePayload = {
            action: publishAction,
            id: pageId,
            clerk_user_id: clerkUserId,
            share_slug: slug
        };
        if (isCustomDomainSlug) {
            reactivatePayload.domain = slug;
            reactivatePayload.reactivate_only = true;
        }

        const apiPromise = fetch('./api/pages.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reactivatePayload)
        })
            .then(function (res) { return res.json(); })
            .then(function (result) {
                if (!result.success || !result.share_url) {
                    throw new Error(result.error || 'Failed to reactivate page');
                }
                return { shareUrl: result.share_url, shareSlug: result.share_slug || slug };
            });

        this._showPublishProgress(apiPromise);
    }

    /**
     * Show loading overlay while publish request is in progress
     */
    showLoadingIndicator(message) {
        const id = 'publish-loading-indicator';
        if (document.getElementById(id)) return;
        const html = '<div id="' + id + '" class="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-[10001]">' +
            '<div class="rounded-2xl shadow-2xl max-w-xs w-full mx-4 p-6 text-center" style="background-color: var(--primary-bg, #ffffff);">' +
            '<div class="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>' +
            '<p class="text-[var(--primary-text)] mt-3">' + (message || 'Loading...') + '</p>' +
            '</div></div>';
        document.body.insertAdjacentHTML('beforeend', html);
    }

    /**
     * Remove loading overlay
     */
    hideLoadingIndicator() {
        const el = document.getElementById('publish-loading-indicator');
        if (el) el.remove();
    }

    /**
     * Animated publish progress flow inside the modal.
     * For the Pro domain flow (context='pro'): bar advances through real stages and reacts
     * immediately when the API promise settles (success → finish, error → inline error state).
     * For the free flow: keeps the original fake 9-second animation.
     * @param {Promise} apiPromise  - Resolves with {shareUrl, shareSlug, isPro?} or rejects with Error
     * @param {string}  [context]   - 'pro' for the custom domain Pro flow; omit for free subdomain
     */
    _showPublishProgress(apiPromise, context) {
        const isPro = context === 'pro';
        const modal = document.getElementById('download-options-modal');
        const contentEl = modal ? modal.querySelector('.download-options-modal-content') : null;

        if (!contentEl) {
            this.closeModal();
            this.showLoadingIndicator('Publishing your page...');
            apiPromise
                .then(data => { this.hideLoadingIndicator(); this.showSuccessMessage(data.shareUrl); this.setViewWebsiteMode(data.shareSlug); })
                .catch(err => { this.hideLoadingIndicator(); this._handlePublishError(err); });
            return;
        }

        const firstTitle = isPro ? 'Checking domain availability...' : 'Preparing your design...';
        contentEl.innerHTML = `
            <div class="p-8 relative publish-progress-view">
                <h2 id="publish-progress-title" class="text-xl font-bold text-[var(--primary-text)] mb-1 text-center">${firstTitle}</h2>
                <div class="publish-progress-bar-track">
                    <div id="publish-progress-bar-fill" class="publish-progress-bar-fill" style="width:0%"></div>
                </div>
                <p id="publish-progress-quote" class="text-sm text-[var(--secondary-text)] text-center mt-4" style="font-style:italic;">
                    ${isPro ? 'This may take a few seconds&hellip;' : '\u201CA good design is a good business\u201D. <strong>Thomas Watson Jr.</strong>'}
                </p>
            </div>
        `;

        const titleEl = document.getElementById('publish-progress-title');
        const barFill = document.getElementById('publish-progress-bar-fill');

        // ── Pro: stages tied to real operations, bar stops at ~82% and waits for the API
        const proStages = [
            { at: 0,    pct: 5,  dur: 500,  title: 'Checking domain availability...' },
            { at: 1800, pct: 35, dur: 1500, title: 'Processing your purchase...' },
            { at: 5000, pct: 65, dur: 2000, title: 'Registering your domain...' },
            { at: 9000, pct: 82, dur: 3000, title: 'Setting up your website...' },
        ];

        // ── Free: original fake 9-second fill (unchanged behaviour)
        const freeStages = [
            { at: 0,    pct: 10, dur: 800,  title: 'Verifying...' },
            { at: 2500, pct: 60, dur: 1500, title: 'Activating...' },
            { at: 5500, pct: 88, dur: 1500, title: 'Almost there...' },
            { at: 8000, pct: 95, dur: 800,  title: 'Completed!' },
        ];

        const stages = isPro ? proStages : freeStages;

        const stageTimers = stages.map(s => setTimeout(() => {
            if (titleEl) titleEl.textContent = s.title;
            barFill.style.transition = `width ${s.dur}ms ease-out`;
            barFill.style.width = s.pct + '%';
        }, s.at));

        const cleanup = () => stageTimers.forEach(clearTimeout);

        if (isPro) {
            // React immediately when the real API promise settles
            apiPromise
                .then(data => {
                    cleanup();
                    barFill.style.transition = 'width 0.4s ease-in-out';
                    barFill.style.width = '100%';
                    if (titleEl) titleEl.textContent = 'Done!';
                    setTimeout(() => this._finishPublish(data, contentEl), 500);
                })
                .catch(err => {
                    cleanup();
                    this._showProgressError(contentEl, err && err.message);
                });
        } else {
            // Free flow: keep old behaviour (wait for 9-second animation, then react)
            const TOTAL_DURATION = 9000;
            let apiResult = null;
            let apiError = null;
            let progressDone = false;

            apiPromise
                .then(data => { apiResult = data; if (progressDone) this._finishPublish(apiResult, contentEl); })
                .catch(err => { apiError = err; if (progressDone) this._handlePublishError(apiError); });

            setTimeout(() => {
                progressDone = true;
                if (apiError) {
                    this._handlePublishError(apiError);
                } else if (apiResult) {
                    this._finishPublish(apiResult, contentEl);
                } else {
                    apiPromise
                        .then(data => { this._finishPublish(data, contentEl); })
                        .catch(err => { this._handlePublishError(err); });
                }
            }, TOTAL_DURATION);
        }
    }

    /**
     * Show an inline error state inside the progress view (Pro flow only).
     * Displays a red X, the error message, and a button to return to the owner form (Step 2a).
     * @param {HTMLElement} contentEl
     * @param {string}      [message]
     */
    _showProgressError(contentEl, message) {
        const safeMsg = (message || 'The registration could not be completed.').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        contentEl.innerHTML = `
            <div class="p-8 relative publish-progress-error-view text-center">
                <div class="pub-progress-error-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </div>
                <h2 class="text-xl font-bold text-[var(--primary-text)] mt-4 mb-2">Something went wrong</h2>
                <p class="text-sm text-[var(--secondary-text)] mb-1">${safeMsg}</p>
                <p class="text-sm font-medium text-[var(--secondary-text)] mb-6">Check your data and try again.</p>
                <button id="pub-progress-retry-btn" class="pub-owner-submit-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                    Review your details
                </button>
            </div>
        `;
        const btn = contentEl.querySelector('#pub-progress-retry-btn');
        if (btn) btn.addEventListener('click', () => {
            // Shrink back to narrow modal before showing Step 2a form
            contentEl.classList.remove('max-w-lg');
            contentEl.classList.add('max-w-2xl');
            this._showOwnerForm();
        });
    }

    /**
     * Final success transition after progress bar completes.
     */
    _finishPublish(data, contentEl) {
        this.previousSlug = null;
        const fromSidebar = !!this.publishPageIdOverride;
        if (!fromSidebar) {
            this.setViewWebsiteMode(data.shareSlug);
        }
        if (fromSidebar && typeof fetchAndRenderPagesList === 'function') {
            fetchAndRenderPagesList();
        }
        this.publishPageIdOverride = null;
        this._showPublishSuccess(data.shareUrl, contentEl, !!data.isPro);
    }

    /**
     * Handle publish/reactivation error from inside the progress flow.
     */
    _handlePublishError(error) {
        this.closeModal();
        console.error('Publish failed:', error);
        const msg = error.message || 'Unable to publish. Please try again.';
        if (typeof showToast === 'function') {
            showToast('Publish Failed', msg, {});
        } else {
            alert('Publish Failed: ' + msg);
        }
    }

    /**
     * Show the success view inside the modal with confetti, domain field & View Site button.
     * Pro flow shows a "domain being registered" message with email verification note.
     * @param {string} publishedUrl
     * @param {HTMLElement} contentEl
     * @param {boolean} [isPro] - Whether this is the Pro custom domain flow
     */
    _showPublishSuccess(publishedUrl, contentEl, isPro) {
        // Ensure we copy the published URL (subdomain or custom domain), never the token link
        const urlToCopy = publishedUrl && publishedUrl.startsWith('http') ? publishedUrl : ('https://' + (publishedUrl || '').replace(/^https?:\/\//, ''));
        const safeUrl = urlToCopy.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        const displayDomain = urlToCopy.replace(/^https?:\/\//, '');

        const headingHTML = isPro
            ? `<h2 class="text-2xl font-bold text-[var(--primary-text)]">Your domain is being registered! 🎉</h2>
               <p class="publish-success-email-verify text-base mt-2">Please check your email to verify the domain owner.</p>
               <p class="text-sm text-[var(--secondary-text)] mt-1 italic">Note: this verification is required to keep the domain active.</p>`
            : `<h2 class="text-2xl font-bold text-[var(--primary-text)]">Your website has been published \ud83c\udf89</h2>`;

        const domainFieldClass = isPro ? 'publish-success-domain-field publish-success-domain-field--half' : 'publish-success-domain-field';
        const hoursNoteHTML = isPro
            ? `<p class="publish-success-hours-note flex items-center justify-center gap-2 text-sm text-[var(--secondary-text)] mt-4">
                 <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                 It can take between 1-24 hours for your website to be active
               </p>`
            : '';

        contentEl.innerHTML = `
            <div class="p-8 relative publish-success-view">
                <button onclick="window.downloadOptionsHandler.closeModal()" aria-label="Close" class="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full transition-all hover:bg-[var(--accent-bg)] text-[var(--secondary-text)] hover:text-[var(--primary-text)]">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>

                <div class="text-center mb-6">
                    ${headingHTML}
                </div>

                <div class="w-full flex flex-col items-center">
                    <div class="${domainFieldClass}" data-publish-success-url="${safeUrl}">
                        <span class="publish-success-domain-text">${displayDomain}</span>
                        <button type="button" id="publish-success-copy-btn" class="publish-success-copy-btn" aria-label="Copy link" data-tippy-content="Copy link" data-copy-url="${safeUrl}">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        </button>
                    </div>
                </div>

                <a href="${safeUrl}" target="_blank" rel="noopener" id="publish-success-view-btn" class="publish-success-view-btn">
                    View Website
                </a>
                ${hoursNoteHTML}
            </div>
        `;

        // Success view: use narrow modal (do not use max-w-2xl)
        contentEl.classList.remove('max-w-2xl');
        contentEl.classList.add('max-w-lg');

        const copyBtn = contentEl.querySelector('#publish-success-copy-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', function () {
                const textToCopy = urlToCopy || ('https://' + (contentEl.querySelector('.publish-success-domain-text') && contentEl.querySelector('.publish-success-domain-text').textContent || '').trim());
                if (!textToCopy || textToCopy === 'https://') return;

                function showCopiedTooltip() {
                    const parent = copyBtn.parentElement;
                    if (!parent) return;
                    const existing = parent.querySelector('.publish-copy-tooltip');
                    if (existing) existing.remove();
                    const tip = document.createElement('span');
                    tip.className = 'publish-copy-tooltip';
                    tip.textContent = 'Copied!';
                    parent.appendChild(tip);
                    setTimeout(function () { tip.remove(); }, 2000);
                }

                function fallbackCopy() {
                    const ta = document.createElement('textarea');
                    ta.value = textToCopy;
                    ta.setAttribute('readonly', '');
                    ta.style.position = 'fixed';
                    ta.style.left = '-9999px';
                    ta.style.top = '0';
                    document.body.appendChild(ta);
                    ta.focus();
                    ta.select();
                    try {
                        if (document.execCommand('copy')) showCopiedTooltip();
                    } catch (e) { /* ignore */ }
                    document.body.removeChild(ta);
                }

                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(textToCopy).then(showCopiedTooltip).catch(fallbackCopy);
                } else {
                    fallbackCopy();
                }
            });
        }

        this._firePublishConfetti();
    }

    /**
     * Fire confetti bursts from both sides of the screen, matching template-insert celebration.
     */
    _firePublishConfetti() {
        if (typeof confetti === 'undefined') return;
        const colors = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#f43f5e'];
        confetti({ particleCount: 80, spread: 60, origin: { x: 0.15, y: 0.5 }, colors: colors, ticks: 250, angle: 60 });
        confetti({ particleCount: 80, spread: 60, origin: { x: 0.85, y: 0.5 }, colors: colors, ticks: 250, angle: 120 });
        setTimeout(() => {
            confetti({ particleCount: 50, spread: 80, origin: { x: 0.25, y: 0.4 }, colors: colors, ticks: 200, angle: 55 });
            confetti({ particleCount: 50, spread: 80, origin: { x: 0.75, y: 0.4 }, colors: colors, ticks: 200, angle: 125 });
        }, 300);
    }

    /**
     * Show success modal with published URL and copy button (legacy fallback)
     */
    showSuccessMessage(publishedUrl) {
        const id = 'publish-success-modal';
        if (document.getElementById(id)) return;
        // Ensure we show and copy the published URL (subdomain/custom domain), not a token link
        const urlToCopy = publishedUrl && publishedUrl.startsWith('http') ? publishedUrl : ('https://' + (publishedUrl || '').replace(/^https?:\/\//, ''));
        const displayDomain = urlToCopy.replace(/^https?:\/\//, '');
        const safeUrl = urlToCopy.replace(/"/g, '&quot;').replace(/'/g, '&#39;');

        const html = `<div id="${id}" class="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-[10001]" style="display: flex;">
            <div class="rounded-2xl shadow-2xl max-w-lg w-full mx-4 p-8 github-export-content" style="background-color: var(--primary-bg, #ffffff);" onclick="event.stopPropagation()">
                <div class="text-center mb-6">
                    <h2 class="text-2xl font-bold text-[var(--primary-text)]">Your website has been published \ud83c\udf89</h2>
                </div>
                <div class="publish-success-domain-field">
                    <span class="publish-success-domain-text">${displayDomain}</span>
                    <button type="button" id="copy-published-url-btn" class="publish-success-copy-btn" aria-label="Copy link" data-copy-url="${safeUrl}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    </button>
                </div>
                <a href="${safeUrl}" target="_blank" rel="noopener" class="publish-success-view-btn">View Site</a>
                <button type="button" onclick="window.downloadOptionsHandler.closeSuccessModal()" class="w-full py-3 px-4 bg-[var(--accent-bg)] hover:opacity-80 text-[var(--primary-text)] rounded-xl font-medium mt-3 text-center">Close</button>
            </div></div>`;
        document.body.insertAdjacentHTML('beforeend', html);

        const copyBtnEl = document.getElementById('copy-published-url-btn');
        if (copyBtnEl) {
            copyBtnEl.addEventListener('click', function () {
                const textToCopy = urlToCopy || 'https://' + (document.querySelector('#' + id + ' .publish-success-domain-text') && document.querySelector('#' + id + ' .publish-success-domain-text').textContent || '').trim();
                if (!textToCopy || textToCopy === 'https://') return;

                function showCopiedTooltip() {
                    const parent = copyBtnEl.parentElement;
                    if (!parent) return;
                    const existing = parent.querySelector('.publish-copy-tooltip');
                    if (existing) existing.remove();
                    const tip = document.createElement('span');
                    tip.className = 'publish-copy-tooltip';
                    tip.textContent = 'Copied!';
                    parent.appendChild(tip);
                    setTimeout(function () { tip.remove(); }, 2000);
                }
                function fallbackCopy() {
                    const ta = document.createElement('textarea');
                    ta.value = textToCopy;
                    ta.setAttribute('readonly', '');
                    ta.style.position = 'fixed';
                    ta.style.left = '-9999px';
                    ta.style.top = '0';
                    document.body.appendChild(ta);
                    ta.focus();
                    ta.select();
                    try {
                        if (document.execCommand('copy')) showCopiedTooltip();
                    } catch (e) { /* ignore */ }
                    document.body.removeChild(ta);
                }
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(textToCopy).then(showCopiedTooltip).catch(fallbackCopy);
                } else {
                    fallbackCopy();
                }
            });
        }

        const overlay = document.getElementById(id);
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) window.downloadOptionsHandler.closeSuccessModal();
        });

        this._firePublishConfetti();
    }

    /**
     * Close publish success modal
     */
    closeSuccessModal() {
        const el = document.getElementById('publish-success-modal');
        if (el) el.remove();
    }

    /**
     * When page is published: show View Website icon and switch Publish to "Published!" (green) with options dropdown.
     * Stores the slug on the wrap so dropdown actions (Unpublish, Copy Link, Change Domain) can use it.
     * Opens the real published URL (subdomain or custom domain), never shared.html — shared.html?slug= is only for unpublished/share preview.
     */
    setViewWebsiteMode(shareSlug) {
        const btn = document.getElementById('download-page');
        const viewWebsiteLink = document.getElementById('topbar-view-website-link');
        const wrap = document.getElementById('publish-dropdown-wrap');
        const trigger = document.getElementById('publish-options-trigger');
        const menu = document.getElementById('publish-options-menu');
        if (!btn || !shareSlug) return;

        // Published page: always open real URL — custom domain (Pro) or subdomain (free)
        const isCustomDomain = shareSlug.includes('.');
        const viewHref = isCustomDomain
            ? 'https://' + shareSlug
            : 'https://' + shareSlug + '.yeslovey.com';

        // Show and set the View Website icon link (right of Share)
        if (viewWebsiteLink) {
            viewWebsiteLink.href = viewHref;
            viewWebsiteLink.style.display = '';
            if (viewWebsiteLink._tippy) {
                viewWebsiteLink._tippy.setContent('View your published website');
            } else {
                viewWebsiteLink.setAttribute('data-tippy-content', 'View your published website');
            }
        }

        if (wrap) {
            wrap.classList.add('is-published');
            wrap.dataset.viewWebsiteSlug = shareSlug;
        }
        btn.classList.remove('publish-btn', 'unpublish-btn');
        btn.classList.add('published-btn');
        btn.dataset.viewWebsiteSlug = shareSlug;
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="check"></i> <span class="publish-btn-label text-sm pl-2">Published!</span>';

        if (btn._tippy) {
            btn._tippy.setContent('View your published website');
        } else {
            btn.setAttribute('data-tippy-content', 'View your published website');
        }
        if (trigger) {
            trigger.style.display = '';
            trigger.setAttribute('aria-expanded', 'false');
        }
        if (menu) {
            menu.classList.remove('open');
            menu.setAttribute('aria-hidden', 'true');
        }
        // Hide Share Link button when published (link is available from Published dropdown)
        const shareBtn = document.getElementById('share-page');
        if (shareBtn) shareBtn.style.display = 'none';
        if (typeof lucide !== 'undefined' && lucide.createIcons) {
            lucide.createIcons();
        }
    }

    /**
     * When page is not published: hide View Website icon and show Publish button (blue) without dropdown.
     * @param {string|null} [previousSlug] - The slug the page had before unpublish, preserved for reactivation.
     */
    setPublishMode(previousSlug) {
        this.previousSlug = previousSlug || null;
        this.publishPageIdOverride = null;
        this.domainAvailable = false;
        const btn = document.getElementById('download-page');
        const viewWebsiteLink = document.getElementById('topbar-view-website-link');
        const wrap = document.getElementById('publish-dropdown-wrap');
        const trigger = document.getElementById('publish-options-trigger');
        const menu = document.getElementById('publish-options-menu');
        if (viewWebsiteLink) {
            viewWebsiteLink.href = '#';
            viewWebsiteLink.style.display = 'none';
        }
        if (wrap) {
            wrap.classList.remove('is-published');
            delete wrap.dataset.viewWebsiteSlug;
        }
        if (trigger) {
            trigger.style.display = 'none';
            trigger.setAttribute('aria-expanded', 'false');
        }
        if (menu) {
            menu.classList.remove('open');
            menu.setAttribute('aria-hidden', 'true');
        }
        if (btn) {
            delete btn.dataset.viewWebsiteSlug;
            btn.classList.remove('unpublish-btn', 'view-website-btn', 'published-btn');
            btn.classList.add('publish-btn');
            btn.innerHTML = '<i data-lucide="upload-cloud"></i> <span class="publish-btn-label text-sm pl-2">Publish</span>';
            if (btn._tippy) {
                btn._tippy.setContent('Publish page');
            } else {
                btn.setAttribute('data-tippy-content', 'Publish page');
            }
            if (typeof lucide !== 'undefined' && lucide.createIcons) {
                lucide.createIcons();
            }
        }
        // Show Share Link button again when unpublished
        const shareBtn = document.getElementById('share-page');
        if (shareBtn) shareBtn.style.display = '';
    }

    /**
     * Export as HTML (existing functionality)
     */
    exportHTML() {
        this.closeModal();
        
        // Call the existing download function
        if (typeof downloadPage === 'function') {
            downloadPage();
        } else {
            console.error('downloadPage function not found');
        }
    }

    /**
     * Export as React project
     */
    exportReact() {
        this.closeModal();
        
        // Show loading indicator
        this.showLoadingIndicator('Generating React project...');
        
        // Get sections data from iframe
        const iframe = document.getElementById('preview-iframe');
        
        if (!iframe) {
            this.hideLoadingIndicator();
            alert('Preview iframe not found. Please try again.');
            return;
        }
        
        // Get toggle states from global scope (same way as HTML export does)
        // These variables are defined in app.php script
        const fullpageEnabledValue = typeof fullpageEnabled !== 'undefined' ? fullpageEnabled : false;
        const animationsEnabledValue = typeof animationsEnabled !== 'undefined' ? animationsEnabled : false;
        
        console.log('[exportReact] Toggle states:', {
            fullpageEnabled: fullpageEnabledValue,
            animationsEnabled: animationsEnabledValue
        });
        
        // Solicitar datos completos del template al iframe para export a React
        iframe.contentWindow.postMessage({
            type: 'GET_TEMPLATE_DATA',
            data: {
                requestId: 'react_export_' + Date.now(),
                forReactExport: true,
                fullpageEnabled: fullpageEnabledValue,
                animationsEnabled: animationsEnabledValue
            }
        }, '*');
    }

    /**
     * Check GitHub authentication status
     */
    async checkGitHubAuth() {
        try {
            const response = await fetch('api/github-auth-status.php');
            const data = await response.json();
            
            // Check if user needs to upgrade
            if (data.requiresUpgrade) {
                // Disable GitHub tab - user needs to upgrade
                this.disableGitHubTab();
                return;
            }
            
            if (data.authenticated) {
                this.updateGitHubAuthUI(true, data.username);
            }
        } catch (error) {
            console.error('Failed to check GitHub auth status:', error);
            // Disable GitHub tab on error
            this.disableGitHubTab();
        }
    }

    /**
     * Update GitHub auth UI
     */
    updateGitHubAuthUI(authenticated, username = '') {
        const statusText = document.getElementById('github-status-text');
        const authButton = document.getElementById('github-auth-button');
        const disconnectButton = document.getElementById('github-disconnect-button');
        const repoSection = document.getElementById('github-repo-section');
        const pushButton = document.getElementById('github-push-button');
        const repoInput = document.getElementById('github-repo-name');
        const usernamePrefix = document.getElementById('github-username-prefix');

        if (authenticated) {
            // Store the username for later use
            this.githubUsername = username;
            
            statusText.textContent = `Connected as ${username}`;
            statusText.classList.add('text-green-600', 'font-medium');
            authButton.classList.add('hidden');
            disconnectButton.classList.remove('hidden');
            repoSection.classList.remove('hidden');
            pushButton.disabled = false;
            // Enable button styling
            pushButton.style.cursor = 'pointer';
            pushButton.style.opacity = '1';
            
            // Set the username prefix
            if (usernamePrefix) {
                usernamePrefix.textContent = `${username}/`;
            }
        } else {
            this.githubUsername = '';
            statusText.textContent = 'Not connected';
            statusText.classList.remove('text-green-600', 'font-medium');
            authButton.classList.remove('hidden');
            disconnectButton.classList.add('hidden');
            repoSection.classList.add('hidden');
            pushButton.disabled = true;
            // Disable button styling
            pushButton.style.cursor = 'not-allowed';
            pushButton.style.opacity = '0.5';
            
            // Reset prefix and input
            if (usernamePrefix) {
                usernamePrefix.textContent = 'username/';
            }
            if (repoInput) {
                repoInput.value = '';
            }
        }
    }

    /**
     * Authenticate with GitHub
     */
    authenticateGitHub() {
        // Open GitHub OAuth popup
        const width = 600;
        const height = 700;
        const left = (window.innerWidth - width) / 2;
        const top = (window.innerHeight - height) / 2;
        
        const popup = window.open(
            'api/github-oauth.php',
            'github-auth',
            `width=${width},height=${height},left=${left},top=${top}`
        );

        // Listen for authentication success
        const checkAuth = setInterval(() => {
            if (popup.closed) {
                clearInterval(checkAuth);
                this.checkGitHubAuth();
            }
        }, 500);
    }

    /**
     * Disconnect from GitHub
     */
    async disconnectGitHub() {
        try {
            await fetch('api/github-disconnect.php', { method: 'POST' });
            this.updateGitHubAuthUI(false);
        } catch (error) {
            console.error('Failed to disconnect GitHub:', error);
        }
    }

    /**
     * Push project to GitHub
     */
    async pushToGitHub() {
        const format = document.querySelector('input[name="github-format"]:checked').value;
        const repoNameOnly = document.getElementById('github-repo-name').value.trim();
        const branch = document.getElementById('github-branch').value;
        const isPrivate = document.getElementById('github-private-toggle').checked;

        if (!repoNameOnly) {
            alert('Please enter a repository name');
            return;
        }

        // Combine username with repository name
        const repoName = `${this.githubUsername}/${repoNameOnly}`;

        this.closeModal();
        this.showLoadingIndicator('Preparing files for GitHub...');

        try {
            // Get sections data from iframe
            const iframe = document.getElementById('preview-iframe');
            
            if (!iframe) {
                throw new Error('Preview iframe not found');
            }

            // Store the export configuration for later use
            this.githubExportConfig = { format, repoName, branch, isPrivate };

            // Get toggle states and settings from global scope (defined in app.php)
            const fullpageEnabledValue = typeof fullpageEnabled !== 'undefined' ? fullpageEnabled : false;
            const animationsEnabledValue = typeof animationsEnabled !== 'undefined' ? animationsEnabled : false;
            const animateBackgroundsEnabledValue = typeof animateBackgroundsEnabled !== 'undefined' ? animateBackgroundsEnabled : false;
            const fullpageSettingsValue = typeof fullpageSettings !== 'undefined' ? fullpageSettings : {};

            // Solicitar datos completos del template al iframe para export a GitHub
            iframe.contentWindow.postMessage({
                type: 'GET_TEMPLATE_DATA',
                data: {
                    requestId: 'github_export_' + Date.now(),
                    forGitHubExport: true,
                    format: format,
                    fullpageEnabled: fullpageEnabledValue,
                    animationsEnabled: animationsEnabledValue,
                    animateBackgroundsEnabled: animateBackgroundsEnabledValue,
                    fullpageSettings: fullpageSettingsValue
                }
            }, '*');

        } catch (error) {
            this.hideLoadingIndicator();
            console.error('GitHub push failed:', error);
            alert('Failed to push to GitHub: ' + error.message);
        }
    }

    /**
     * Push generated project to GitHub repository
     */
    async pushProjectToGitHub(data) {
        try {
            const { format, repoName, branch, isPrivate } = this.githubExportConfig || {};
            
            if (!format || !repoName || !branch) {
                throw new Error('GitHub export configuration missing');
            }

            this.updateLoadingMessage('Generating project files...');

            let files;
            
            if (format === 'html') {
                // Generate HTML project using same logic as download
                const response = await fetch('api/generate-html-project.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fullHtml: data.fullHtml || '',
                        theme: data.theme,
                        templateId: data.templateId || null,
                        fullpageEnabled: data.fullpageEnabled || 'false',
                        fullpageSettings: data.fullpageSettings || {},
                        animationsEnabled: data.animationsEnabled || 'false',
                        animateBackgroundsEnabled: data.animateBackgroundsEnabled || 'false',
                        projectName: repoName.split('/')[1] || 'fpstudio-website',
                        isPaid: window.serverUserData?.is_paid || false
                    })
                });
                
                const result = await response.json();
                if (!result.success) {
                    throw new Error(result.error || 'Failed to generate HTML project');
                }
                
                files = result.files;
            } else {
                // Generate React project
                const response = await fetch('api/generate-react-project.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fullHtml: data.fullHtml || '',
                        theme: data.theme,
                        fullpageEnabled: data.fullpageEnabled === 'true' || data.fullpageEnabled === true ? 'true' : 'false',
                        fullpageSettings: data.fullpageSettings || {},
                        animationsEnabled: data.animationsEnabled === 'true' || data.animationsEnabled === true ? 'true' : 'false',
                        projectName: repoName.split('/')[1] || 'fpstudio-app'
                    })
                });
                
                const result = await response.json();
                if (!result.success) {
                    throw new Error(result.error || 'Failed to generate React project');
                }
                
                files = result.files;
            }

            this.updateLoadingMessage('Pushing to GitHub...');

            // Push to GitHub
            const pushResponse = await fetch('api/github-push.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    repoName,
                    branch,
                    files,
                    isPrivate: isPrivate || false,
                    commitMessage: `Deploy ${format.toUpperCase()} project from FPStudio`
                })
            });

            const pushResult = await pushResponse.json();
            
            if (!pushResult.success) {
                // Check if this is a subscription/upgrade error
                if (pushResult.requiresUpgrade) {
                    this.hideLoadingIndicator();
                    // [DISABLED_FOR_WEDDING_VERSION]: Upgrade modal on GitHub push error removed — modal
                    // only appears during onboarding (when user has no pages).
                    // await this.showUpgradeModal();
                    return;
                }
                throw new Error(pushResult.error || 'Failed to push to GitHub');
            }

            this.hideLoadingIndicator();
            this.showGitHubSuccessMessage(pushResult.repoUrl);

        } catch (error) {
            this.hideLoadingIndicator();
            console.error('GitHub push failed:', error);
            
            // Check if error response has requiresUpgrade flag
            if (error.requiresUpgrade) {
                // [DISABLED_FOR_WEDDING_VERSION]: Upgrade modal on GitHub error removed — modal only
                // appears during onboarding (when user has no pages).
                // await this.showUpgradeModal();
            } else {
                alert('Failed to push to GitHub: ' + error.message);
            }
        }
    }

    /**
     * Update loading message
     */
    updateLoadingMessage(message) {
        const loader = document.getElementById('download-loading');
        if (loader) {
            const messageEl = loader.querySelector('p.text-gray-700');
            if (messageEl) {
                messageEl.textContent = message;
            }
        }
    }

    /**
     * Show GitHub success message by replacing modal content
     */
    showGitHubSuccessMessage(repoUrl) {
        // Only show success content if not already shown
        if (this.successShown) {
            return;
        }
        
        this.successShown = true;
        
        const modal = document.getElementById('download-options-modal');
        if (!modal) return;
        
        // Find the modal content container
        const modalContent = modal.querySelector('.download-options-modal-content');
        if (!modalContent) return;
        
        // Replace content with success message
        modalContent.innerHTML = `
            <div class="p-8 text-center">
                <!-- Success Icon -->
                <div class="mb-6">
                    <div class="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                        <svg class="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                        </svg>
                    </div>
                </div>
                
                <!-- Success Message -->
                <h2 class="text-3xl font-bold text-gray-900 mb-3">Successfully Published!</h2>
                <p class="text-gray-600 mb-6">Your project has been pushed to GitHub</p>
                
                <!-- Repository Link -->
                <a href="${repoUrl}" target="_blank" class="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all font-medium mb-4">
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
                        <path fill-rule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                    </svg>
                    View Repository
                </a>
                
                <!-- Close Button -->
                <button onclick="window.downloadOptionsHandler.closeModal()" class="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-all font-medium">
                    Close
                </button>
            </div>
        `;
    }

    /**
     * Generate and download React project
     */
    generateReactProject(data) {
        try {
            const { fullHtml, theme } = data;
            
            // Use toggle states from app.php context (same as HTML export does)
            const fullpageEnabledValue = typeof fullpageEnabled !== 'undefined' ? fullpageEnabled : false;
            const animationsEnabledValue = typeof animationsEnabled !== 'undefined' ? animationsEnabled : false;
            
            console.log('=== REACT EXPORT DATA ===');
            console.log('fullpageEnabled (from app.php):', fullpageEnabledValue);
            console.log('animationsEnabled (from app.php):', animationsEnabledValue);
            console.log('fullHtml length:', fullHtml?.length);
            
            const requestPayload = {
                fullHtml: fullHtml || '',
                theme: theme,
                fullpageEnabled: fullpageEnabledValue,
                animationsEnabled: animationsEnabledValue,
                projectName: 'fpstudio-react-app'
            };
            
            console.log('Request payload:', requestPayload);
            
            // Step 1: Generate React project with HTML to JSX conversion
            fetch('api/generate-react-project.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestPayload)
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Server responded with ' + response.status);
                }
                return response.json();
            })
            .then(result => {
                if (!result.success) {
                    throw new Error(result.error || 'Failed to generate project');
                }
                
                // Log any conversion errors (non-fatal)
                if (result.conversionErrors && result.conversionErrors.length > 0) {
                    console.warn('Some sections had conversion issues:', result.conversionErrors);
                }
                
                // Step 2: Send generated files to ZIP creation endpoint
                return fetch('api/download-react-project.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        files: result.files,
                        projectName: result.projectName
                    })
                });
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to create ZIP file');
                }
                return response.blob();
            })
            .then(blob => {
                this.hideLoadingIndicator();
                
                // Create download link
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'fpstudio-react-app.zip';
                
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                
                // Show success message
                this.showExportSuccessMessage();
            })
            .catch(error => {
                this.hideLoadingIndicator();
                console.error('React export failed:', error);
                alert('React export failed. Please try again.\n\nError: ' + error.message);
            });
            
        } catch (error) {
            this.hideLoadingIndicator();
            console.error('React project generation failed:', error);
            alert('Failed to generate React project. Please try again.');
        }
    }

    /**
     * Show loading indicator (matches modal style)
     */
    showLoadingIndicator(message = 'Processing...') {
        const loader = `
            <style>
                @keyframes github-spinner-spin {
                    to { transform: rotate(360deg); }
                }
                .github-spinner {
                    width: 60px;
                    height: 60px;
                    border: 4px solid rgba(59, 130, 246, 0.1);
                    border-top-color: #3b82f6;
                    border-radius: 50%;
                    animation: github-spinner-spin 0.8s linear infinite;
                    margin: 0 auto;
                }
            </style>
            <div id="download-loading" class="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-[10000]" style="display: flex;">
                <div class="rounded-2xl shadow-2xl max-w-md w-full mx-4" style="background-color: var(--primary-bg, #ffffff);" onclick="event.stopPropagation()">
                    <div class="p-8 text-center">
                        <div class="mb-6">
                            <div class="github-spinner"></div>
                        </div>
                        <h3 class="text-2xl font-bold text-gray-900 mb-2">${message}</h3>
                        <p class="text-gray-500">This may take a moment...</p>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', loader);
    }

    /**
     * Hide loading indicator
     */
    hideLoadingIndicator() {
        const loader = document.getElementById('download-loading');
        if (loader) {
            loader.remove();
        }
    }

    /**
     * Show success message (toast notification) for React export
     */
    showExportSuccessMessage() {
        const message = `
            <div id="download-success" class="fixed top-4 right-4 bg-green-500 text-white px-6 py-4 rounded-lg shadow-lg z-[10000] flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
                <div>
                    <p class="font-semibold">React project exported successfully!</p>
                    <p class="text-sm opacity-90">Run 'npm install' to get started</p>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', message);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            const successMsg = document.getElementById('download-success');
            if (successMsg) {
                successMsg.style.transition = 'opacity 0.3s';
                successMsg.style.opacity = '0';
                setTimeout(() => successMsg.remove(), 300);
            }
        }, 5000);
    }
}

// Create global instance
if (typeof window !== 'undefined') {
    window.DownloadOptionsHandler = DownloadOptionsHandler;
    window.downloadOptionsHandler = new DownloadOptionsHandler();
}

