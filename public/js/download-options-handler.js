/**
 * Download Options Handler
 * Manages different export formats (HTML, React, etc.)
 */

class DownloadOptionsHandler {
    constructor() {
        // React project generation now handled by PHP backend
        this.currentTab = 'subdomain'; // Track current tab (subdomain | domain)
        this.successShown = false; // Track if success message was shown
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
     * Show upgrade modal for non-pro users
     */
    async showUpgradeModal() {
        // Check if upgrade modal is available
        if (typeof window.upgradeModal !== 'undefined' && window.upgradeModal) {
            await window.upgradeModal.show();
        } else {
            // Fallback: show alert
            alert('GitHub Export is a Pro feature. Please upgrade to continue.');
        }
    }

    /**
     * Show publish modal — simplified design based on user plan.
     * Non-PRO: subdomain (.wedsite.online) + upgrade prompt.
     * PRO: custom domain (.com).
     */
    showDownloadOptions() {
        const isPro = !!(typeof window.serverUserData !== 'undefined' && window.serverUserData && window.serverUserData.is_paid);
        const domainSuffix = isPro ? '.com' : '.wedsite.online';

        const upgradePrompt = !isPro ? `
            <p class="text-sm text-center mt-4" style="color: var(--secondary-text);">
                Do you want a custom <strong>.com</strong> domain?
                <a href="javascript:void(0)" onclick="window.downloadOptionsHandler.closeModal(); window.downloadOptionsHandler.showUpgradeModal();" class="text-blue-600 hover:underline font-semibold">Upgrade to pro</a>
            </p>
        ` : '';

        const modalHTML = `
            <div id="download-options-modal" class="modal-overlay fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-[10000]" style="display: flex;">
                <div class="download-options-modal-content rounded-2xl shadow-2xl max-w-lg w-full mx-4 github-export-content" style="background-color: var(--primary-bg, #ffffff);" onclick="event.stopPropagation()">
                    <div class="p-8 relative">

                        <!-- Close (X) button -->
                        <button onclick="window.downloadOptionsHandler.closeModal()" aria-label="Close" class="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full transition-all hover:bg-[var(--accent-bg)] text-[var(--secondary-text)] hover:text-[var(--primary-text)]">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                        </button>

                        <!-- Title -->
                        <h2 class="text-2xl font-bold text-[var(--primary-text)] mb-6 pr-8">Choose your website name</h2>

                        <!-- Name input + domain suffix -->
                        <div class="flex items-center border border-[var(--border-color)] rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
                            <input type="text" id="publish-web-name" placeholder="my-wedding"
                                class="flex-1 px-4 py-3 border-0 focus:outline-none focus:ring-0 bg-[var(--primary-bg)] text-[var(--primary-text)]"
                                maxlength="64" autocomplete="off">
                            <span class="px-4 py-3 bg-[var(--secondary-bg)] text-[var(--secondary-text)] border-l border-[var(--border-color)] whitespace-nowrap font-medium">${domainSuffix}</span>
                        </div>

                        ${upgradePrompt}

                        <!-- [DISABLED_FOR_WEDDING_VERSION]: Tabs (Subdomain / Domain) removed — plan is detected automatically -->
                        <!-- [DISABLED_FOR_WEDDING_VERSION]: Email fields for form responses removed — not needed in simplified flow -->
                        <!-- [DISABLED_FOR_WEDDING_VERSION]: Cancel button removed — replaced by X close button -->

                        <!-- Single centered Publish button -->
                        <div class="mt-6">
                            <button onclick="window.downloadOptionsHandler.publishPage()" class="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all font-medium text-base">
                                Publish
                            </button>
                        </div>

                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if any
        const existingModal = document.getElementById('download-options-modal');
        if (existingModal) {
            existingModal.remove();
        }

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.successShown = false;

        // Close on background click
        const modal = document.getElementById('download-options-modal');
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal();
            }
        });

        // Close on Escape key
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
            
            // Update the onclick to show upgrade modal instead
            tabGithub.onclick = (e) => {
                e.preventDefault();
                this.showUpgradeModal();
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
            this.showUpgradeModal();
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
     * Non-PRO: subdomain (slug.wedsite.online) via publish-subdomain action.
     * PRO: custom domain (slug.com) via publish-domain action.
     */
    publishPage() {
        const pageId = window.pageManagerInstance && window.pageManagerInstance.currentPageId;
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

        const publishAction = isPro ? 'publish-domain' : 'publish-subdomain';

        this.closeModal();
        this.showLoadingIndicator('Publishing your page...');

        fetch('api/pages.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: publishAction,
                id: pageId,
                clerk_user_id: clerkUserId,
                share_slug: webName
            })
        })
            .then(function (res) { return res.json(); })
            .then(function (result) {
                if (!result.success || !result.share_url) {
                    throw new Error(result.error || 'Failed to publish page');
                }
                return result.share_url;
            })
            .then(function (shareUrl) {
                window.downloadOptionsHandler.hideLoadingIndicator();
                window.downloadOptionsHandler.showSuccessMessage(shareUrl);
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(shareUrl).then(function () {
                        if (typeof showToast === 'function') {
                            showToast('Link Copied!', 'Your page link has been copied to the clipboard.', {});
                        }
                    });
                }
            })
            .catch(function (error) {
                window.downloadOptionsHandler.hideLoadingIndicator();
                console.error('Publish failed:', error);
                const msg = error.message || 'Unable to publish. Please try again.';
                if (typeof showToast === 'function') {
                    showToast('Publish Failed', msg, {});
                } else {
                    alert('Publish Failed: ' + msg);
                }
            });
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
     * Show success modal with published URL and copy button
     */
    showSuccessMessage(publishedUrl) {
        const id = 'publish-success-modal';
        if (document.getElementById(id)) return;
        const html = '<div id="' + id + '" class="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-[10001]" style="display: flex;">' +
            '<div class="rounded-2xl shadow-2xl max-w-lg w-full mx-4 p-8 text-center github-export-content" style="background-color: var(--primary-bg, #ffffff);" onclick="event.stopPropagation()">' +
            '<h2 class="text-2xl font-bold text-[var(--primary-text)] mb-4">Successfully Published!</h2>' +
            '<p class="text-[var(--secondary-text)] mb-4">Your page is live at:</p>' +
            '<a href="' + publishedUrl + '" target="_blank" rel="noopener" class="block text-blue-600 hover:underline text-lg font-medium break-all mb-6">' + publishedUrl + '</a>' +
            '<button type="button" id="copy-published-url-btn" class="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium mb-4">Copy link</button>' +
            '<button type="button" onclick="window.downloadOptionsHandler.closeSuccessModal()" class="w-full py-3 px-4 bg-[var(--accent-bg)] hover:bg-gray-700 text-[var(--primary-text)] rounded-xl font-medium">Close</button>' +
            '</div></div>';
        document.body.insertAdjacentHTML('beforeend', html);

        document.getElementById('copy-published-url-btn').addEventListener('click', function () {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(publishedUrl).then(function () {
                    if (typeof showToast === 'function') showToast('Copied!', 'Link copied to clipboard.', {});
                });
            }
        });

        const overlay = document.getElementById(id);
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) window.downloadOptionsHandler.closeSuccessModal();
        });
    }

    /**
     * Close publish success modal
     */
    closeSuccessModal() {
        const el = document.getElementById('publish-success-modal');
        if (el) el.remove();
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
                    await this.showUpgradeModal();
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
                await this.showUpgradeModal();
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
                this.showSuccessMessage();
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
     * Show success message (toast notification)
     */
    showSuccessMessage() {
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

