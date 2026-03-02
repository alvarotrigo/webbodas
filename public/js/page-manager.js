// Page Manager - Handles page management for authenticated users
class PageManager {
    constructor(serverUserData = null, preloadedPageData = null) {
        // Page management state (using private fields with public getters/setters)
        this._currentPageId = null;
        this._currentPageTitle = 'Untitled Page';
        this._useDatabase = false;
        
        // Store server user data for API calls
        this.serverUserData = serverUserData;
        
        // Store preloaded page data if available
        this.preloadedPageData = preloadedPageData;
        
        // Request cancellation support
        this._pendingSaveAbortController = null;
        this._saveInProgress = false;
        this._pendingSaveData = null; // Queue for the next save
        
        // Initialize from URL parameters
        this.initializeFromUrl();
    }
    
    // Getters and setters for page management state
    get currentPageId() {
        return this._currentPageId;
    }
    
    set currentPageId(value) {
        this._currentPageId = value;
    }
    
    get currentPageTitle() {
        return this._currentPageTitle;
    }
    
    set currentPageTitle(value) {
        this._currentPageTitle = value;
    }
    
    get useDatabase() {
        return this._useDatabase;
    }
    
    set useDatabase(value) {
        this._useDatabase = value;
    }
    
    /**
     * Initialize page state from URL parameters
     */
    initializeFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        const pageIdFromUrl = urlParams.get('page');
        
        if (pageIdFromUrl) {
            this.currentPageId = pageIdFromUrl;
            this.useDatabase = true;
        } else if (this.serverUserData && this.serverUserData.authenticated) {
            // Authenticated user without page ID - will prompt for page name later
            this.useDatabase = true;
        }
    }
    
    /**
     * Save draft to database with request cancellation support
     * @param {Object} draft - The draft data to save
     * @param {AbortSignal} signal - Optional abort signal to cancel the request
     */
    async saveDraftToDatabase(draft, signal = null) {
        if (!this.currentPageId) {
            // Create new page first
            await this.createNewPageInDatabase(draft, signal);
            return;
        }
        
        try {
            const response = await fetch('./api/pages.php', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    id: this.currentPageId,
                    title: this.currentPageTitle,
                    data: draft,
                    clerk_user_id: this.serverUserData?.clerk_user_id,
                    _client_timestamp: new Date().toISOString() // Add timestamp for server-side deduplication
                }),
                signal: signal || undefined
            });
            
            // Check if request was aborted
            if (signal && signal.aborted) {
                return;
            }

            // Check HTTP response status
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            // Check if the save was skipped due to a newer version on server
            if (result.skipped) {
                console.log('Save skipped - newer version exists on server', {
                    client_timestamp: result.client_timestamp,
                    server_updated_at: result.server_updated_at
                });
                return;
            }

            if (!result.success) {
                console.error('Failed to save page to database:', result.error);
                throw new Error(result.error || 'Failed to save page');
            }
        } catch (error) {
            // Don't log abort errors as they're expected
            if (error.name === 'AbortError') {
                return;
            }
            console.error('Error saving page to database:', error);
            throw error;
        }
    }
    
    /**
     * Save draft with automatic cancellation of pending saves
     * This ensures only the latest save request is processed.
     * If a save is already in progress, the new save will be queued
     * and will automatically execute after the current save completes.
     * @param {Object} draft - The draft data to save
     * @returns {Promise} Promise that resolves when save completes
     */
    async saveDraftToDatabaseWithCancellation(draft) {
        // Cancel any pending save request (this will abort the fetch if it's still in flight)
        if (this._pendingSaveAbortController) {
            this._pendingSaveAbortController.abort();
            this._pendingSaveAbortController = null;
        }
        
        // If a save is in progress, queue this one (overwrites any previously queued save)
        // This ensures we only save the latest state, not every intermediate state
        if (this._saveInProgress) {
            this._pendingSaveData = draft;
            return Promise.resolve(); // Return immediately, save will be queued
        }
        
        // Create new abort controller for this save
        this._pendingSaveAbortController = new AbortController();
        const signal = this._pendingSaveAbortController.signal;
        
        this._saveInProgress = true;
        this._pendingSaveData = null;
        
        try {
            await this.saveDraftToDatabase(draft, signal);
        } catch (error) {
            // Don't throw abort errors - they're expected when cancelling
            if (error.name === 'AbortError') {
                return;
            }
            // Clear the in-progress flag before re-throwing
            this._saveInProgress = false;
            if (this._pendingSaveAbortController && !signal.aborted) {
                this._pendingSaveAbortController = null;
            }
            // Re-throw the error so saveDraft() can handle it
            throw error;
        } finally {
            // Clear the in-progress flag (only runs if no error was thrown)
            this._saveInProgress = false;
            if (this._pendingSaveAbortController && !signal.aborted) {
                this._pendingSaveAbortController = null;
            }
        }
        
        // After save completes (or fails), check if we have a pending save queued
        // (this happens if a new save was requested while we were saving)
        if (this._pendingSaveData) {
            const pendingData = this._pendingSaveData;
            this._pendingSaveData = null;
            // Recursively save the pending data
            await this.saveDraftToDatabaseWithCancellation(pendingData);
        }
    }
    
    /**
     * Create a new page in the database
     * @param {Object} draft - The draft data for the new page
     * @param {AbortSignal} signal - Optional abort signal to cancel the request
     */
    async createNewPageInDatabase(draft, signal = null) {
        try {
            const response = await fetch('./api/pages.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'create',
                    title: this.currentPageTitle,
                    data: draft,
                    clerk_user_id: this.serverUserData?.clerk_user_id
                }),
                signal: signal || undefined
            });
            
            // Check if request was aborted
            if (signal && signal.aborted) {
                return;
            }

            // Check HTTP response status
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (result.success) {
                this.currentPageId = result.page.id;
                // Update URL without reloading
                const newUrl = new URL(window.location.href);
                newUrl.searchParams.set('page', this.currentPageId);
                window.history.replaceState({}, '', newUrl);
                console.log('New page created with ID:', this.currentPageId);
            } else {
                console.error('Failed to create page in database:', result.error);
                throw new Error(result.error || 'Failed to create page');
            }
        } catch (error) {
            // Don't log abort errors as they're expected
            if (error.name === 'AbortError') {
                return;
            }
            console.error('Error creating page in database:', error);
            throw error;
        }
    }
    
    /**
     * Load draft from database
     * @returns {Promise<Object|null>} The loaded draft data or null if not found
     */
    async loadDraftFromDatabase() {
        if (!this.currentPageId) return null;
        
        // If we have preloaded page data, use it instead of making a fetch request
        if (this.preloadedPageData && this.preloadedPageData.success && this.preloadedPageData.page) {
            const page = this.preloadedPageData.page;
            
            // Check if this is the page we're looking for
            if (page.id === this.currentPageId) {
                this.currentPageTitle = page.title;
                // Parse data if it's a string
                let pageData = typeof page.data === 'string' 
                    ? JSON.parse(page.data) 
                    : page.data;
                
                // Validate and normalize data structure
                pageData = this.normalizeDraftData(pageData);
                
                // Clear preloaded data after first use
                this.preloadedPageData = null;
                
                return pageData;
            }
        }
        
        // Fallback to fetch if no preloaded data or wrong page
        try {
            const response = await fetch(`./api/pages.php?id=${this.currentPageId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            const result = await response.json();
            
            if (result.success && result.page) {
                this.currentPageTitle = result.page.title;
                // Parse data if it's a string
                let pageData = typeof result.page.data === 'string' 
                    ? JSON.parse(result.page.data) 
                    : result.page.data;
                
                // Validate and normalize data structure
                pageData = this.normalizeDraftData(pageData);
                
                return pageData;
            }
            
            return null;
        } catch (error) {
            console.error('Error loading page from database:', error);
            return null;
        }
    }
    
    /**
     * Prompt user for page name via modal
     * @returns {Promise<string>} The page name entered by the user
     */
    async promptForPageName() {
        return new Promise((resolve) => {
            const modal = document.getElementById('page-name-modal');
            const input = document.getElementById('page-name-input');
            const saveBtn = document.getElementById('save-page-name');
            const closeBtn = document.getElementById('close-page-name-modal');
            
            // Check if required elements exist
            if (!modal || !input || !saveBtn || !closeBtn) {
                console.error('Page name modal elements not found');
                resolve('Untitled Page');
                return;
            }
            
            // Clear previous value and focus input
            /** @type {HTMLInputElement} */ (input).value = '';
            modal.classList.add('show');
            setTimeout(() => /** @type {HTMLInputElement} */ (input).focus(), 100);
            
            // Handle save - create page in database immediately so it exists before any section is added
            const handleSave = async () => {
                const pageName = /** @type {HTMLInputElement} */ (input).value.trim();
                this.currentPageTitle = pageName || 'Untitled Page';
                saveBtn.disabled = true;
                try {
                    const emptyDraft = this.normalizeDraftData({});
                    await this.createNewPageInDatabase(emptyDraft, null);
                } catch (err) {
                    console.error('Failed to create page on name save:', err);
                    // Still resolve so user is not stuck; next autosave will retry create
                } finally {
                    saveBtn.disabled = false;
                }
                modal.classList.remove('show');
                cleanup();
                resolve(this.currentPageTitle);
            };
            
            // Handle cancel/close
            const handleClose = () => {
                this.currentPageTitle = 'Untitled Page';
                modal.classList.remove('show');
                cleanup();
                resolve(this.currentPageTitle);
            };
            
            // Handle Enter key
            const handleKeyPress = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSave();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    handleClose();
                }
            };
            
            // Cleanup function
            const cleanup = () => {
                saveBtn.removeEventListener('click', handleSave);
                closeBtn.removeEventListener('click', handleClose);
                input.removeEventListener('keypress', handleKeyPress);
            };
            
            // Add event listeners
            saveBtn.addEventListener('click', handleSave);
            closeBtn.addEventListener('click', handleClose);
            input.addEventListener('keypress', handleKeyPress);
            
            // Close on backdrop click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    handleClose();
                }
            });
        });
    }
    
    /**
     * Check if we should prompt for page name
     * @returns {boolean} True if we should prompt
     */
    shouldPromptForPageName() {
        return this.useDatabase && 
               !this.currentPageId && 
               this.serverUserData && 
               this.serverUserData.authenticated;
    }
    
    /**
     * Update server user data (useful if authentication state changes)
     * @param {Object} serverUserData - Updated server user data
     */
    updateServerUserData(serverUserData) {
        this.serverUserData = serverUserData;
        // Re-evaluate useDatabase flag
        if (!this.currentPageId && serverUserData && serverUserData.authenticated) {
            this.useDatabase = true;
        }
    }
    
    /**
     * Normalize draft data structure to ensure sections is an array and theme is a string
     * @param {Object} draft - The draft data to normalize
     * @returns {Object} Normalized draft data
     */
    normalizeDraftData(draft) {
        if (!draft || typeof draft !== 'object') {
            return {
                sections: [],
                theme: 'theme-light-minimal',
                fullpageEnabled: false,
                animationsEnabled: false,
                animateBackgroundsEnabled: false
            };
        }
        
        // Ensure sections is always an array
        if (!Array.isArray(draft.sections)) {
            console.warn('Invalid sections in draft, normalizing:', draft.sections);
            draft.sections = [];
        }
        
        // Ensure theme is always a string (not an array)
        if (draft.theme) {
            if (Array.isArray(draft.theme)) {
                console.warn('Theme is an array in draft, extracting first valid value:', draft.theme);
                draft.theme = draft.theme.find(t => typeof t === 'string' && t.trim() !== '') || 'theme-light-minimal';
            } else if (typeof draft.theme !== 'string' || draft.theme.trim() === '') {
                console.warn('Invalid theme in draft, using default:', draft.theme);
                draft.theme = 'theme-light-minimal';
            }
        } else {
            draft.theme = 'theme-light-minimal';
        }
        
        // Ensure boolean values are properly set
        if (typeof draft.fullpageEnabled !== 'boolean') {
            draft.fullpageEnabled = draft.fullpageEnabled === true || draft.fullpageEnabled === 'true';
        }
        if (typeof draft.animationsEnabled !== 'boolean') {
            draft.animationsEnabled = draft.animationsEnabled === true || draft.animationsEnabled === 'true';
        }
        if (typeof draft.animateBackgroundsEnabled !== 'boolean') {
            draft.animateBackgroundsEnabled = draft.animateBackgroundsEnabled === true || draft.animateBackgroundsEnabled === 'true';
        }
        
        return draft;
    }
}

// Export for use in modules or make available globally
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PageManager;
} else {
    // @ts-ignore - Adding to window for global access
    window.PageManager = PageManager;
}

