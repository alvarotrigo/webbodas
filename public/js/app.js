

 // Load dev.js if developer=1 is in URL (with flag-based protection)
 (function() {
     const urlParams = new URLSearchParams(window.location.search);
     if (urlParams.get('developer') === '1') {
         isDeveloperMode = true;
         
         // Use flag to prevent multiple loads
         if (window.__devJsLoaded || window.__devJsLoading) {
             console.log('✅ Developer utilities already loaded/loading');
             return;
         }
         
         window.__devJsLoading = true;
         
         const script = document.createElement('script');
         script.src = 'dev.js?v=2';
         script.onload = function() {
             window.__devJsLoaded = true;
             window.__devJsLoading = false;
             console.log('✅ Developer utilities loaded');
         };
         script.onerror = function() {
             window.__devJsLoading = false;
             console.error('❌ Failed to load developer utilities');
         };
         document.head.appendChild(script);
     }
 })();
 
     // Initialize Lucide icons
     lucide.createIcons();
     
     // Initialize AI chat after icons are created
     // The AI chat will initialize itself on DOMContentLoaded, but we ensure icons are ready
     setTimeout(() => {
         if (typeof lucide !== 'undefined') {
             lucide.createIcons();
         }
         if (typeof window.AIChat !== 'undefined') {
             window.AIChat.checkVisibility();
         }
         // Don't check onboarding visibility here - it will be checked after sections are loaded
         // This prevents showing onboarding before sections are restored
     }, 100);

 // More global variables
let currentTheme = null;
let initialTheme = null; // First theme applied to the template — used by Reset button
let suppressThemeHistory = false;
 let addedSections = [];
 let selectedSections = new Set();
 let sectionCache = new Map();
 let loadedSections = new Set();
 let observer;
 let sidebarCollapsed = false;
 let currentViewport = 'desktop';

 // These variables are on window so history commands can modify them
 // Simplified editor: animations ON by default, animate backgrounds OFF (panels hidden)
 window.animationsEnabled = true;
 window.animateBackgroundsEnabled = false;
 window.fullpageEnabled = false;
 window.fullscreenMode = false;
 
 // Category hover delay (in milliseconds)
 const CATEGORY_HOVER_DELAY_MS = 350;
 
 // Track current category and scroll position
 let currentCategoryKey = null;
 let categoryScrollPositions = {};
 
 // FullPage.js advanced settings
 let fullpageSettings = {
     scrollSpeed: 700,
     navigation: true,
     navigationColor: '#333333',
     disableOnMobile: false,
     scrollBar: false,
     motionFeel: 'smooth' // 'smooth', 'snappy', 'relaxed'
 };
 
 function applySelectionState(sectionNumber, isSelected) {
     if (isSelected === undefined || isSelected === null) {
         return;
     }
     
     const numericSection = Number(sectionNumber);
     if (isSelected) {
         if (!Number.isNaN(numericSection)) {
             selectedSections.add(numericSection);
         }
     } else {
         if (!Number.isNaN(numericSection)) {
             selectedSections.delete(numericSection);
         }
     }
     
     const selectionItems = document.querySelectorAll(
         `.section-item[data-section="${sectionNumber}"], ` +
         `.category-section-item[data-section="${sectionNumber}"]`
     );
     
     selectionItems.forEach(item => {
         if (isSelected) {
             item.classList.add('selected');
         } else {
             item.classList.remove('selected');
         }
     });
     
     updateSectionCounter();
 }
 
 const sectionCommandHelpers = {
     applySelectionState,
     addSection({ sectionNumber, html, insertIndex = null, skipTinyMCE = false, skipScroll = false }) {
         const iframe = document.getElementById('preview-iframe');
         if (iframe && iframe.contentWindow) {
             iframe.contentWindow.postMessage({
                 type: 'ADD_SECTION',
                 data: {
                     sectionNumber,
                     html,
                     animationsEnabled,
                     insertIndex,
                     skipTinyMCE,
                     skipScroll
                 }
             }, '*');
         }

         // Add to selectedSections Set
         const numericSection = Number(sectionNumber);
         if (!Number.isNaN(numericSection)) {
             selectedSections.add(numericSection);
         }

         // Add selected class to section item in sidebar
         const sectionItem = document.querySelector(
             `.section-item[data-section="${sectionNumber}"], ` +
             `.category-section-item[data-section="${sectionNumber}"]`
         );
         if (sectionItem) {
             sectionItem.classList.add('selected');
         }

         updateSectionCount();
         
         if (typeof window.AIChat !== 'undefined') {
             window.AIChat.updateVisibility();
         }
         if (typeof window.Onboarding !== 'undefined') {
             window.Onboarding.checkVisibility();
         }
     },
     removeSection({ sectionNumber }) {
         const iframe = document.getElementById('preview-iframe');
         if (iframe && iframe.contentWindow) {
             iframe.contentWindow.postMessage({
                 type: 'REMOVE_SECTION',
                 data: { sectionNumber }
             }, '*');
         }

         // Remove from selectedSections Set
         const numericSection = Number(sectionNumber);
         if (!Number.isNaN(numericSection)) {
             selectedSections.delete(numericSection);
         }

         // Remove selected class from section item in sidebar
         const sectionItem = document.querySelector(
             `.section-item[data-section="${sectionNumber}"], ` +
             `.category-section-item[data-section="${sectionNumber}"]`
         );
         if (sectionItem) {
             sectionItem.classList.remove('selected');
         }

         updateSectionCount();
         
         if (typeof window.AIChat !== 'undefined') {
             window.AIChat.updateVisibility();
         }
         if (typeof window.Onboarding !== 'undefined') {
             window.Onboarding.checkVisibility();
         }
     },
     addClonedSection({ newSectionNumber, html, insertIndex }) {
         const iframe = document.getElementById('preview-iframe');
         if (iframe && iframe.contentWindow) {
             iframe.contentWindow.postMessage({
                 type: 'ADD_CLONED_SECTION',
                 data: {
                     newSectionNumber,
                     html,
                     insertIndex
                 }
             }, '*');
         }

         // Add to selectedSections Set
         const numericSection = Number(newSectionNumber);
         if (!Number.isNaN(numericSection)) {
             selectedSections.add(numericSection);
         }

         // Add selected class to section item in sidebar
         const sectionItem = document.querySelector(
             `.section-item[data-section="${newSectionNumber}"], ` +
             `.category-section-item[data-section="${newSectionNumber}"]`
         );
         if (sectionItem) {
             sectionItem.classList.add('selected');
         }

         updateSectionCount();
         
         if (typeof window.AIChat !== 'undefined') {
             window.AIChat.updateVisibility();
         }
         if (typeof window.Onboarding !== 'undefined') {
             window.Onboarding.checkVisibility();
         }
     },
     moveSection({ sectionNumber, direction }) {
         const iframe = document.getElementById('preview-iframe');
         if (iframe && iframe.contentWindow) {
             iframe.contentWindow.postMessage({
                 type: 'MOVE_SECTION',
                 data: {
                     sectionNumber,
                     direction,
                     skipNotify: true // Command-driven, don't notify parent again
                 }
             }, '*');
         }
     },
     reorderSection({ fromIndex, toIndex }) {
         const iframe = document.getElementById('preview-iframe');
         if (iframe && iframe.contentWindow) {
             iframe.contentWindow.postMessage({
                 type: 'REORDER_SECTION',
                 data: {
                     fromIndex,
                     toIndex,
                     skipNotify: true // Command-driven, don't notify parent again
                 }
             }, '*');
         }
     }
 };
 
 // Make it globally accessible for commands
 window.sectionCommandHelpers = sectionCommandHelpers;
 
 // Autosave variables
 let saveTimeout;
 let saveInProgress = false;
 let draftData = null;
 let isRestoring = false; // Flag to prevent autosave during restoration
 let autosaveRequestId = null; // Unique ID to distinguish autosave requests from download requests
 let isClearingDraft = false; // Flag to prevent autosave when clearing draft
 let isInitializing = true; // Flag to prevent autosave during initial page load
 let currentTemplateUrl = null; // When user picks a template, so we save it and reload iframe with it
 let preloadedDraft = null; // Draft loaded before iframe src so we can load preview.php?template= when needed
 
 // Page Manager instance - handles all page management logic
 const pageManagerInstance = new PageManager(serverUserData, preloadedPageData);
 
 // Convenience variables for backward compatibility
 // These are kept in sync with pageManager properties
 let currentPageId = pageManagerInstance.currentPageId;
 let currentPageTitle = pageManagerInstance.currentPageTitle;
 let useDatabase = pageManagerInstance.useDatabase;
 
 // Override setters to sync convenience variables
 function updateDeletePageButtonVisibility() {
     const btn = document.getElementById('delete-page-btn');
     if (!btn) return;
     btn.style.display = currentPageId ? 'flex' : 'none';
 }

 Object.defineProperty(pageManagerInstance, 'currentPageId', {
     get: function() { return this._currentPageId; },
     set: function(value) { 
         this._currentPageId = value;
         currentPageId = value;
         updateDeletePageButtonVisibility();
     },
     configurable: true,
     enumerable: true
 });
 // Function to update page name display
 function updatePageNameDisplay(title) {
     const pageNameDisplay = document.getElementById('page-name-display');
     if (pageNameDisplay) {
         pageNameDisplay.textContent = title || 'Untitled Page';
         pageNameDisplay.setAttribute('title', title || 'Untitled Page');
     }
 }

 // Inline editing for page name
 function setupPageNameEditing() {
     const pageNameDisplay = document.getElementById('page-name-display');
     if (!pageNameDisplay) return;

     let originalValue = '';
     let isEditing = false;

     // Make editable on click (allow even when no page ID yet, e.g. new page)
     pageNameDisplay.addEventListener('click', (e) => {
         if (!isEditing) {
             e.stopPropagation();
             originalValue = pageNameDisplay.textContent.trim();
             pageNameDisplay.contentEditable = 'true';
             pageNameDisplay.focus();
             
             // Select all text
             const range = document.createRange();
             range.selectNodeContents(pageNameDisplay);
             const selection = window.getSelection();
             selection.removeAllRanges();
             selection.addRange(range);
             
             isEditing = true;
         }
     });

     // Save on blur
     pageNameDisplay.addEventListener('blur', async () => {
         if (!isEditing) return;
         
         const newValue = pageNameDisplay.textContent.trim() || 'Untitled Page';
         pageNameDisplay.contentEditable = 'false';
         isEditing = false;

         // If value changed, save it (API if we have a page ID, otherwise just update local state)
         if (newValue !== originalValue) {
             if (currentPageId) {
                 try {
                     const response = await fetch('./api/pages.php', {
                         method: 'PUT',
                         headers: {
                             'Content-Type': 'application/json',
                         },
                         body: JSON.stringify({
                             id: currentPageId,
                             title: newValue, // Only sending title, not full page payload
                             clerk_user_id: serverUserData?.clerk_user_id || null
                         })
                     });

                     const result = await response.json();

                     if (result.success) {
                         pageManager.currentPageTitle = newValue;
                         updatePageNameDisplay(newValue);
                     } else {
                         updatePageNameDisplay(originalValue);
                         console.error('Failed to update page title:', result.error);
                     }
                 } catch (error) {
                     updatePageNameDisplay(originalValue);
                     console.error('Error updating page title:', error);
                 }
             } else {
                 // New/unsaved page: only update local title (used when page is first saved)
                 pageManager.currentPageTitle = newValue;
                 updatePageNameDisplay(newValue);
             }
         } else {
             updatePageNameDisplay(originalValue);
         }
     });

     // Handle Enter key to save
     pageNameDisplay.addEventListener('keydown', (e) => {
         if (!isEditing) return;

         if (e.key === 'Enter') {
             e.preventDefault();
             pageNameDisplay.blur(); // This will trigger the blur handler to save
         } else if (e.key === 'Escape') {
             e.preventDefault();
             // Cancel editing and revert
             pageNameDisplay.contentEditable = 'false';
             updatePageNameDisplay(originalValue);
             isEditing = false;
         }
     });

     // Allow editing the page name whenever the display is shown (including new/unsaved pages)
     function updateEditingState() {
         pageNameDisplay.style.cursor = 'pointer';
         pageNameDisplay.style.pointerEvents = 'auto';
     }

     // Initial state
     updateEditingState();
 }
 
 Object.defineProperty(pageManagerInstance, 'currentPageTitle', {
     get: function() { return this._currentPageTitle; },
     set: function(value) {
         this._currentPageTitle = value;
         currentPageTitle = value;
         updatePageNameDisplay(value);
         // Pre-fetch first domain suggestion so publish modal opens with it already in the field (Pro only)
         if (value && value !== 'Untitled Page' && typeof window.downloadOptionsHandler !== 'undefined' && window.downloadOptionsHandler.prefetchDomainSuggestion) {
             window.downloadOptionsHandler.prefetchDomainSuggestion(value);
         }
     },
     configurable: true,
     enumerable: true
 });
 Object.defineProperty(pageManagerInstance, 'useDatabase', {
     get: function() { return this._useDatabase; },
     set: function(value) { 
         this._useDatabase = value;
         useDatabase = value;
     },
     configurable: true,
     enumerable: true
 });
 
// Use pageManagerInstance as pageManager
const pageManager = pageManagerInstance;
window.pageManagerInstance = pageManagerInstance;
 
 // Initialize convenience variables
 currentPageId = pageManager.currentPageId;
 currentPageTitle = pageManager.currentPageTitle;
 useDatabase = pageManager.useDatabase;
 
 // Update page name display initially
 if (currentPageTitle) {
     updatePageNameDisplay(currentPageTitle);
 }

 // Setup inline editing for page name
 setupPageNameEditing();

 // Delete page button and confirmation modal
 function setupDeletePageButton() {
     const deleteBtn = document.getElementById('delete-page-btn');
     const modal = document.getElementById('delete-page-modal');
     const cancelBtn = document.getElementById('delete-page-modal-cancel');
     const confirmBtn = document.getElementById('delete-page-modal-confirm');
     if (!deleteBtn || !modal || !cancelBtn || !confirmBtn) return;

     updateDeletePageButtonVisibility();

     deleteBtn.addEventListener('click', (e) => {
         e.stopPropagation();
         if (!currentPageId) return;
         modal.classList.add('show');
     });

     function closeDeleteModal() {
         modal.classList.remove('show');
     }

     cancelBtn.addEventListener('click', closeDeleteModal);
     modal.addEventListener('click', (e) => {
         if (e.target === modal) closeDeleteModal();
     });

     confirmBtn.addEventListener('click', async () => {
         if (!currentPageId) return;
         confirmBtn.disabled = true;
         try {
             const response = await fetch('./api/pages.php', {
                 method: 'DELETE',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({
                     id: currentPageId,
                     clerk_user_id: serverUserData?.clerk_user_id || null
                 })
             });
             const result = await response.json();
             if (result.success) {
                 closeDeleteModal();
                 window.location.href = './app.php';
             } else {
                 console.error('Failed to delete page:', result.error);
                 confirmBtn.disabled = false;
             }
         } catch (err) {
             console.error('Error deleting page:', err);
             confirmBtn.disabled = false;
         }
     });
 }
setupDeletePageButton();

// ============================================================
// PAGES SIDEBAR — list, preview, delete, switch, new page
// ============================================================

// State for the pages sidebar
let _pagesSidebarList = []; // Last fetched list of pages
let _deleteModalPageId = null; // Page ID pending deletion from sidebar

// --- Delete modal (reused for sidebar; wires cancel/confirm once) ---
(function setupDeletePageModalForSidebar() {
    const modal     = document.getElementById('delete-page-modal');
    const cancelBtn = document.getElementById('delete-page-modal-cancel');
    const confirmBtn = document.getElementById('delete-page-modal-confirm');
    if (!modal || !cancelBtn || !confirmBtn) return;

    function closeModal() {
        modal.classList.remove('show');
        _deleteModalPageId = null;
        if (confirmBtn) confirmBtn.disabled = false;
    }

    cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    confirmBtn.addEventListener('click', async () => {
        const pageIdToDelete = _deleteModalPageId;
        if (!pageIdToDelete) return;
        confirmBtn.disabled = true;
        try {
            const res = await fetch('./api/pages.php', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: pageIdToDelete,
                    clerk_user_id: serverUserData?.clerk_user_id || null
                })
            });
            const result = await res.json();
            if (result.success) {
                closeModal();
                // Find next page to load (or go to onboarding)
                const remaining = _pagesSidebarList.filter(p => String(p.id) !== String(pageIdToDelete));
                if (remaining.length > 0) {
                    // If we deleted the current page, load the first remaining page
                    if (String(pageIdToDelete) === String(currentPageId)) {
                        window.location.href = './app.php?page=' + remaining[0].id;
                    } else {
                        // Just refresh the list
                        fetchAndRenderPagesList();
                    }
                } else {
                    // No more pages — go to onboarding
                    window.location.href = './app.php';
                }
            } else {
                console.error('Failed to delete page:', result.error);
                confirmBtn.disabled = false;
            }
        } catch (err) {
            console.error('Error deleting page:', err);
            confirmBtn.disabled = false;
        }
    });
})();

// Open the delete confirmation modal for a page from the sidebar
function openDeletePageModal(pageId) {
    const modal = document.getElementById('delete-page-modal');
    if (!modal) return;
    _deleteModalPageId = pageId;
    const confirmBtn = document.getElementById('delete-page-modal-confirm');
    if (confirmBtn) confirmBtn.disabled = false;
    modal.classList.add('show');
}

// --- Unpublish Website confirmation modal ---
let _unpublishModalPageId = null;
let _unpublishModalSlug = null;

(function setupUnpublishWebsiteModal() {
    const modal = document.getElementById('unpublish-website-modal');
    const messageEl = document.getElementById('unpublish-website-modal-message');
    const cancelBtn = document.getElementById('unpublish-website-modal-cancel');
    const confirmBtn = document.getElementById('unpublish-website-modal-confirm');
    if (!modal || !messageEl || !cancelBtn || !confirmBtn) return;

    function closeModal() {
        modal.classList.remove('show');
        _unpublishModalPageId = null;
        _unpublishModalSlug = null;
        if (confirmBtn) confirmBtn.disabled = false;
    }

    cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });

    confirmBtn.addEventListener('click', async function () {
        const pageId = _unpublishModalPageId;
        const previousSlug = _unpublishModalSlug;
        if (!pageId) return;
        confirmBtn.disabled = true;
        try {
            const result = await unpublishPage(pageId);
            if (result.success) {
                closeModal();
                if (window.downloadOptionsHandler && typeof window.downloadOptionsHandler.setPublishMode === 'function') {
                    window.downloadOptionsHandler.setPublishMode(previousSlug);
                }
                const topbarLink = document.getElementById('topbar-published-link');
                if (topbarLink) {
                    topbarLink.style.display = 'none';
                    topbarLink.removeAttribute('href');
                }
                fetchAndRenderPagesList();
            } else {
                confirmBtn.disabled = false;
            }
        } catch (err) {
            console.error('Unpublish failed', err);
            confirmBtn.disabled = false;
        }
    });
})();

function openUnpublishWebsiteModal(pageId, slug) {
    const modal = document.getElementById('unpublish-website-modal');
    const messageEl = document.getElementById('unpublish-website-modal-message');
    const confirmBtn = document.getElementById('unpublish-website-modal-confirm');
    if (!modal || !messageEl) return;
    _unpublishModalPageId = pageId;
    _unpublishModalSlug = slug || null;
    const isPro = !!(typeof window.serverUserData !== 'undefined' && window.serverUserData && window.serverUserData.is_paid);
    const domainSuffix = isPro ? '.com' : '.yeslovey.com';
    const displayDomain = slug ? (slug + domainSuffix) : 'Your website';
    messageEl.textContent = displayDomain + ' won\'t be available anymore. Are you sure?';
    if (confirmBtn) confirmBtn.disabled = false;
    modal.classList.add('show');
}

// --- Unsaved changes modal ---
function showUnsavedChangesModal(onSave, onDiscard) {
    const existing = document.getElementById('unsaved-changes-modal');
    if (existing) existing.remove();

    const modalHTML = `
        <div id="unsaved-changes-modal" class="modal-overlay fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-[10001]" style="display:flex;">
            <div class="download-options-modal-content rounded-2xl shadow-2xl max-w-md w-full mx-4" style="background-color: var(--primary-bg, #ffffff); max-height: unset; overflow: visible;" onclick="event.stopPropagation()">
                <div class="p-8 relative">
                    <div class="flex items-center gap-3 mb-4">
                        <div class="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        </div>
                        <h2 class="text-xl font-bold" style="color: var(--primary-text);">Unsaved Changes</h2>
                    </div>
                    <p style="color: var(--secondary-text);" class="text-sm leading-relaxed mb-6">
                        Your current page has unsaved changes. What would you like to do before switching pages?
                    </p>
                    <div class="flex gap-3 justify-end">
                        <button id="unsaved-discard-btn" class="unsaved-modal-discard-btn px-4 py-2.5 text-sm font-medium rounded-xl transition-all">Discard & Switch</button>
                        <button id="unsaved-save-btn" class="unsaved-modal-save-btn px-4 py-2.5 text-sm font-medium rounded-xl transition-all">Save & Switch</button>
                    </div>
                </div>
            </div>
        </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modal = document.getElementById('unsaved-changes-modal');

    document.getElementById('unsaved-save-btn').addEventListener('click', async () => {
        modal.remove();
        await saveDraft();
        if (typeof onSave === 'function') onSave();
    });

    document.getElementById('unsaved-discard-btn').addEventListener('click', () => {
        modal.remove();
        if (typeof onDiscard === 'function') onDiscard();
    });
}

// Check if there are unsaved changes based on save indicator state
function hasUnsavedChanges() {
    if (saveInProgress) return true;
    const indicator = document.getElementById('save-indicator');
    if (!indicator) return false;
    return indicator.classList.contains('failed') || indicator.classList.contains('saving');
}

// Navigate to another page, with unsaved-changes check
function switchToPage(pageId) {
    if (String(pageId) === String(currentPageId)) return;

    function doSwitch() {
        window.location.href = './app.php?page=' + pageId;
    }

    if (hasUnsavedChanges()) {
        showUnsavedChangesModal(doSwitch, doSwitch);
    } else {
        doSwitch();
    }
}

// --- Page preview: second sidebar panel (hover panel, like category-hover-panel) ---
// Always loads shared.html?token=... — never uses srcdoc to avoid src/srcdoc conflicts.
// If the page doesn't have a share_token yet, requests one first via the share API.
let _pagePreviewCurrentPageId = null;

async function openPagePreview(pageId, pageTitle, shareToken) {
    const panel   = document.getElementById('page-preview-hover-panel');
    const iframe  = document.getElementById('page-preview-hover-iframe');
    const titleEl = document.getElementById('page-preview-hover-title');
    if (!panel || !iframe) return;

    _pagePreviewCurrentPageId = String(pageId);
    if (titleEl) titleEl.textContent = pageTitle || 'Preview';

    // Reset iframe: remove srcdoc completely so src can load without conflicts.
    // IMPORTANT: never assign iframe.srcdoc after this point when using src-based loading.
    iframe.removeAttribute('srcdoc');
    iframe.src = 'about:blank';
    panel.classList.add('show');

    let token = shareToken;

    // If no token yet, request one from the share API (generates/returns token for this page)
    if (!token) {
        try {
            const res = await fetch('./api/pages.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({
                    action: 'share',
                    id: pageId,
                    clerk_user_id: serverUserData?.clerk_user_id || null
                })
            });
            const result = await res.json();
            if (result.success && result.share_token) {
                token = result.share_token;
                // Update cached list so next hover won't need to refetch
                const cached = _pagesSidebarList.find(p => String(p.id) === String(pageId));
                if (cached) cached.share_token = token;
            }
        } catch (err) {
            console.error('Error getting share token for preview:', err);
        }
    }

    if (token) {
        // Load via src — srcdoc attribute must NOT be present at this point
        iframe.src = './shared.html?token=' + encodeURIComponent(token);
    } else {
        // Only fallback: use srcdoc for error message (no URL available)
        iframe.removeAttribute('src');
        iframe.srcdoc = '<html><body style="display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif;color:#c00;font-size:14px;">Could not load preview.</body></html>';
    }
}

function closePagePreview() {
    _pagePreviewCurrentPageId = null;
    const panel  = document.getElementById('page-preview-hover-panel');
    const iframe = document.getElementById('page-preview-hover-iframe');
    if (panel) panel.classList.remove('show');
    if (iframe) {
        // Remove srcdoc completely before setting src, to avoid any attribute conflict
        iframe.removeAttribute('srcdoc');
        iframe.src = 'about:blank';
    }
}

// --- Unpublish a page (returns { success } or throws on network error) ---
async function unpublishPage(pageId) {
    const res = await fetch('./api/pages.php', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            id: pageId,
            is_public: false,
            clerk_user_id: serverUserData?.clerk_user_id || null
        })
    });
    const result = await res.json();
    if (result.success) {
        fetchAndRenderPagesList();
    } else {
        console.error('Failed to unpublish page:', result.error);
    }
    return result;
}

// [DISABLED_FOR_WEDDING_VERSION]: Date display removed from page list items per design spec
// function formatPageDate(dateStr) {
//     if (!dateStr) return '';
//     try {
//         const date = new Date(dateStr);
//         const now = new Date();
//         const diffMs = now - date;
//         const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
//         if (diffDays === 0) return 'Today';
//         if (diffDays === 1) return 'Yesterday';
//         if (diffDays < 7) return diffDays + ' days ago';
//         return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
//     } catch (e) {
//         return '';
//     }
// }

// --- Fetch pages and render in sidebar ---
async function fetchAndRenderPagesList() {
    const container = document.getElementById('pages-list');
    if (!container) return;

    // Only fetch if authenticated and have a clerk user id
    if (!serverUserData || !serverUserData.clerk_user_id) return;

    try {
        const res = await fetch('./api/pages.php', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin'
        });
        const result = await res.json();
        if (!result.success) return;

        const pages = result.pages || [];
        _pagesSidebarList = pages;

        container.innerHTML = '';

        // Track whether user has pages; actual button visibility depends on onboarding state
        window._userHasPages = pages.length > 0;
        updateViewPagesBtnVisibility();

        if (pages.length === 0) {
            container.innerHTML = '<p class="pages-list-empty">No pages yet.</p>';
        } else {
            pages.forEach(page => {
                const isActive = String(page.id) === String(currentPageId);
                const isPublished = !!(page.is_public && page.share_url);

                const item = document.createElement('div');
                item.className = 'page-list-item' + (isActive ? ' active' : '');
                item.dataset.pageId = page.id;
                // [DISABLED_FOR_WEDDING_VERSION]: Publish and unpublish buttons removed for wedding version. URL/domain hidden per redesign.
                item.innerHTML = `
                    <div class="page-list-item-info">
                        ${isPublished ? '<span class="page-published-dot" data-tippy-content="Published" aria-label="Published"></span>' : ''}
                        <span class="page-list-item-name">${escapeHtml(page.title || 'Untitled Page')}</span>
                    </div>
                    <div class="page-list-item-actions">
                        <button type="button" class="page-action-btn page-preview-btn" data-tippy-content="Preview page" aria-label="Preview page">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                        </button>
                        ${!isPublished ? `
                        <button type="button" class="page-action-btn page-delete-btn" data-tippy-content="Delete page" aria-label="Delete page">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                        </button>` : ''}
                    </div>`;

                // Click on item (not on action buttons) → switch page
                item.addEventListener('click', (e) => {
                    if (e.target.closest('.page-action-btn')) return;
                    switchToPage(page.id);
                });

                // [DISABLED_FOR_WEDDING_VERSION]: Publish button handler removed for wedding version.
                // const publishBtn = item.querySelector('.page-publish-btn');
                // if (publishBtn) {
                //     publishBtn.addEventListener('click', (e) => {
                //         e.stopPropagation();
                //         if (window.downloadOptionsHandler && typeof window.downloadOptionsHandler.showDownloadOptions === 'function') {
                //             window.downloadOptionsHandler.showDownloadOptions(page.id, page.share_slug || null);
                //         }
                //     });
                // }

                // Preview button: open preview, or close it if this page's preview is already open
                item.querySelector('.page-preview-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    const panel = document.getElementById('page-preview-hover-panel');
                    const isThisPagePreviewOpen = panel && panel.classList.contains('show') && _pagePreviewCurrentPageId === String(page.id);
                    if (isThisPagePreviewOpen) {
                        closePagePreview();
                    } else {
                        openPagePreview(page.id, page.title, page.share_token || null);
                    }
                });

                // [DISABLED_FOR_WEDDING_VERSION]: Unpublish button handler removed for wedding version.
                // const unpublishBtn = item.querySelector('.page-unpublish-btn');
                // if (unpublishBtn) {
                //     unpublishBtn.addEventListener('click', async (e) => {
                //         e.stopPropagation();
                //         await unpublishPage(page.id);
                //         if (isActive && window.downloadOptionsHandler && typeof window.downloadOptionsHandler.setPublishMode === 'function') {
                //             window.downloadOptionsHandler.setPublishMode(page.share_slug || null);
                //             const topbarLink = document.getElementById('topbar-published-link');
                //             if (topbarLink) {
                //                 topbarLink.style.display = 'none';
                //                 topbarLink.removeAttribute('href');
                //             }
                //         }
                //     });
                // }

                // Delete button (only present for unpublished pages; published pages cannot be deleted)
                const deleteBtn = item.querySelector('.page-delete-btn');
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        openDeletePageModal(page.id);
                    });
                }

                container.appendChild(item);
            });
        }

        // New Page button appended right after the last page item
        const newPageBtn = document.createElement('button');
        newPageBtn.type = 'button';
        newPageBtn.id = 'new-page-btn';
        newPageBtn.className = 'new-page-btn';
        newPageBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg><span>New Page</span>`;
        newPageBtn.addEventListener('click', async () => {
            if (!sidebarCollapsed) toggleSidebar();

            async function startNewPage() {
                if (window.pageManagerInstance) {
                    window.pageManagerInstance.currentPageId = null;
                    window.pageManagerInstance.currentPageTitle = 'Untitled Page';
                }
                // Reset topbar page name display so it doesn't show stale data when onboarding closes
                const pageNameDisplay = document.getElementById('page-name-display');
                if (pageNameDisplay) pageNameDisplay.textContent = 'Untitled Page';
                // Hide published dot (new page is not published yet)
                const publishedLink = document.getElementById('topbar-published-link');
                if (publishedLink) publishedLink.style.display = 'none';
                const viewWebsiteLink = document.getElementById('topbar-view-website-link');
                if (viewWebsiteLink) viewWebsiteLink.style.display = 'none';
                const rsvpBtn = document.getElementById('rsvp-dashboard-btn');
                if (rsvpBtn) rsvpBtn.style.display = 'none';
                const newUrl = new URL(window.location.href);
                newUrl.searchParams.delete('page');
                window.history.replaceState({}, '', newUrl);
                clearDraft();
            }

            if (hasUnsavedChanges()) {
                showUnsavedChangesModal(
                    async () => { await saveDraft(); startNewPage(); },
                    () => { startNewPage(); }
                );
            } else {
                startNewPage();
            }
        });
        container.appendChild(newPageBtn);

        // Initialize Tippy tooltips for page list items (Preview, Delete, Published dot)
        if (typeof tippy !== 'undefined') {
            const pageListTooltips = container.querySelectorAll('[data-tippy-content]');
            pageListTooltips.forEach(el => {
                if (!el._tippy) {
                    tippy(el, {
                        placement: 'top',
                        arrow: true,
                        theme: 'custom',
                        animation: 'scale',
                        duration: [200, 150],
                        delay: [300, 0]
                    });
                }
            });
        }
    } catch (err) {
        console.error('Error fetching pages list:', err);
    }
}

// Simple HTML escape helper
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// --- Page preview hover panel close button ---
// [NOTE]: New Page button is now created dynamically inside fetchAndRenderPagesList()
// [NOTE]: page-preview-back-btn is no longer used (panel replaced by hover panel)
function setupPagesSidebarButtons() {
    const closeBtn = document.getElementById('page-preview-hover-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            closePagePreview();
        });
    }
}

// Initialize pages sidebar buttons on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupPagesSidebarButtons);
} else {
    setupPagesSidebarButtons();
}

// ============================================================
// END PAGES SIDEBAR
// ============================================================

// History manager instance (will be initialized after context is ready)
let historyManager = null;
 
 // Authentication variables - Initialize from server data immediately
 let isAuthenticated = serverUserData ? serverUserData.authenticated : false;
 let currentUser = serverUserData && serverUserData.authenticated ? {
     email: serverUserData.email || null,
     name: serverUserData.name || null,
     id: serverUserData.clerk_user_id || null,
     imageUrl: serverUserData.avatar_url || serverUserData.avatar || serverUserData.image_url || serverUserData.profile_image_url || null,
 } : null;
 window.currentUser = currentUser;
 
 let editorMode = serverUserData ? serverUserData.mode : 'free'; // 'free' or 'authenticated' or 'paid'
 let authenticationInProgress = false; // Prevent duplicate auth calls
 let clerkListenerAdded = false; // Prevent duplicate listeners
 let upgradeModalShownThisSession = false; // Prevent showing upgrade modal multiple times per session

// Returns true only while the onboarding overlay is visible (user has no pages yet).
// The upgrade modal must only appear in this scenario — never after.
function isUserInOnboarding() {
    const onboardingOverlay = document.getElementById('onboarding-overlay');
    return !!(onboardingOverlay && onboardingOverlay.classList.contains('show'));
}
 let userMenuVisible = false;
 let userMenuDocumentListenerAttached = false;
 
 // If server provided user data, update UI immediately (before Clerk.js loads)
 if (serverUserData && serverUserData.authenticated) {
     console.log('User authenticated via server:', serverUserData);
     // UI is already updated server-side, but we can update JavaScript state
     // The avatar and name are already visible from PHP rendering
     
     // Update localStorage with fresh server data to ensure consistency
     localStorage.setItem('isAuthenticated', 'true');
     localStorage.setItem('editorMode', serverUserData.mode || 'authenticated');
     localStorage.setItem('isPaid', serverUserData.is_paid ? 'true' : 'false');
     localStorage.setItem('userEmail', serverUserData.email || '');
     if (serverUserData.name) {
         localStorage.setItem('userName', serverUserData.name);
     }
     if (serverUserData.avatar_url) {
         localStorage.setItem('userAvatar', serverUserData.avatar_url);
     }
     
     console.log('Updated localStorage with server data - isPaid:', serverUserData.is_paid, 'mode:', serverUserData.mode);
     
     // Update UI (including PRO badge and section visibility) after DOM is ready
     if (document.readyState === 'loading') {
         document.addEventListener('DOMContentLoaded', () => {
             if (typeof updateUserInterface === 'function') {
                 console.log('Calling updateUserInterface on DOMContentLoaded with mode:', editorMode);
                 updateUserInterface();
             }
         });
     } else {
         // DOM already ready, update immediately
         setTimeout(() => {
             if (typeof updateUserInterface === 'function') {
                 console.log('Calling updateUserInterface immediately with mode:', editorMode);
                 updateUserInterface();
             }
         }, 100);
     }
     
    // Check if user is authenticated but not paid — show upgrade modal ONLY during onboarding (no pages yet)
    if (editorMode === 'authenticated' && !serverUserData.is_paid && !upgradeModalShownThisSession) {
        // Wait for DOM and upgrade modal component to be ready
        const checkAndShowUpgradeModal = () => {
            if (typeof upgradeModal !== 'undefined') {
                upgradeModalShownThisSession = true;
                // Poll until _userHasPages is explicitly set by fetchAndRenderPagesList(),
                // then only show the modal if the user genuinely has zero pages.
                // Retries every 200ms for up to 5s to handle slow connections.
                const checkForUpgradeModal = (attempt = 0) => {
                    if (window._userHasPages === undefined && attempt < 25) {
                        setTimeout(() => checkForUpgradeModal(attempt + 1), 200);
                        return;
                    }
                    // Use strict false check: if undefined (e.g. network error) do not show
                    if (isUserInOnboarding() && window._userHasPages === false) {
                        showUpgradeModal();
                    }
                };
                setTimeout(checkForUpgradeModal, 1000);
            } else {
                // Retry after a short delay if upgrade modal not loaded yet
                setTimeout(checkAndShowUpgradeModal, 100);
            }
        };
        
        // Start checking after DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', checkAndShowUpgradeModal);
        } else {
            checkAndShowUpgradeModal();
        }
    }
 }

 // Wedding theme data with color palettes — 25 palettes for the wedding editor
 const themes = [
     {
         id: 'theme-wedding-blush-ivory',
         name: 'Blush & Ivory',
         colors: ['#fdf8f5', '#faf0eb', '#d4967a', '#b8785e', '#f0d8cc']
     },
     {
         id: 'theme-wedding-rose-gold',
         name: 'Rose Gold & Cream',
         colors: ['#fdfaf6', '#faf5ef', '#c9956c', '#b07d58', '#e8d5c4']
     },
     {
         id: 'theme-wedding-dusty-rose',
         name: 'Dusty Rose & Sage',
         colors: ['#fdf8f6', '#f7ede8', '#c0847a', '#7a9e7e', '#e8d5d0']
     },
     {
         id: 'theme-wedding-white-pearl',
         name: 'White & Pearl',
         colors: ['#ffffff', '#fafaf8', '#b8a898', '#9e8e7e', '#e8e4de']
     },
     {
         id: 'theme-wedding-sage-white',
         name: 'Sage & White',
         colors: ['#f9faf8', '#f2f5f0', '#7a9e7e', '#5e8462', '#d8e4d5']
     },
     {
         id: 'theme-wedding-ash-minimal',
         name: 'Ash Grey Minimal',
         colors: ['#f8f8f8', '#f0f0f0', '#888888', '#444444', '#d5d5d5']
     },
     {
         id: 'theme-wedding-terracotta',
         name: 'Terracotta & Sage',
         colors: ['#faf6f2', '#f4ede4', '#c4714a', '#7a9e7e', '#e4d5c5']
     },
     {
         id: 'theme-wedding-champagne-pampas',
         name: 'Champagne & Pampas',
         colors: ['#fdf9f4', '#f8f2e8', '#d4b896', '#a89070', '#e8dcc8']
     },
     {
         id: 'theme-wedding-cedar',
         name: 'Cedar & Wildflower',
         colors: ['#f9f6f0', '#f2ebe0', '#8b5e3c', '#d4956a', '#dfd0bc']
     },
     {
         id: 'theme-wedding-black-gold',
         name: 'Black & Gold',
         colors: ['#0d0d0d', '#1a1814', '#d4af37', '#b8902e', '#2e2820']
     },
     {
         id: 'theme-wedding-navy-gold',
         name: 'Navy & Gold',
         colors: ['#0c1428', '#14213d', '#d4af37', '#e8c84a', '#1e3050']
     },
     {
         id: 'theme-wedding-ivory-champagne',
         name: 'Ivory & Champagne',
         colors: ['#fefcf7', '#faf6ec', '#c8a96e', '#b08c50', '#ebe0c8']
     },
     {
         id: 'theme-wedding-silver-pearl',
         name: 'Silver & Pearl',
         colors: ['#fafafa', '#f2f4f6', '#a8b4c0', '#8096a8', '#dce4ec']
     },
     {
         id: 'theme-wedding-aqua-sand',
         name: 'Aqua & Sand',
         colors: ['#fdfcfa', '#f5f0e8', '#5bbcb8', '#e8b48a', '#d8e8e8']
     },
     {
         id: 'theme-wedding-hibiscus',
         name: 'Hibiscus & Coral',
         colors: ['#fff8f5', '#ffeee8', '#e8654a', '#ff9a80', '#ffd0c0']
     },
     {
         id: 'theme-wedding-coastal',
         name: 'Coastal Blue',
         colors: ['#f5f9fe', '#e8f2fc', '#4a8ec0', '#2e6a9c', '#c8dce8']
     },
     {
         id: 'theme-wedding-frost',
         name: 'Frost & Ice',
         colors: ['#f8f9ff', '#f0f4fc', '#90b4d4', '#c8d8e8', '#d8e4f0']
     },
     {
         id: 'theme-wedding-berry-velvet',
         name: 'Berry & Velvet',
         colors: ['#1a0d1a', '#231222', '#9b4dca', '#c86e9c', '#2e1830']
     },
     {
         id: 'theme-wedding-midnight-stars',
         name: 'Midnight & Stars',
         colors: ['#080c18', '#0f1428', '#8080d4', '#d4c8a8', '#141c38']
     },
     {
         id: 'theme-wedding-moody-mauve',
         name: 'Moody Mauve',
         colors: ['#f5f0f5', '#ede4f0', '#9060a8', '#c4a0c8', '#d8c8e4']
     },
     {
         id: 'theme-wedding-lilac-gold',
         name: 'Lilac & Gold',
         colors: ['#fdf8ff', '#f5eefa', '#b07cd8', '#d4af37', '#e4d0f4']
     },
     {
         id: 'theme-wedding-enchanted-forest',
         name: 'Enchanted Forest',
         colors: ['#f0f8f0', '#e8f4e8', '#4a8c5c', '#d4af37', '#c8e4cc']
     },
     {
         id: 'theme-wedding-sepia-lace',
         name: 'Sepia & Lace',
         colors: ['#fdf8f0', '#f5ede0', '#8c6840', '#b8906c', '#dcc8a8']
     },
     {
         id: 'theme-wedding-art-deco',
         name: 'Art Deco Noir',
         colors: ['#0a0a08', '#141410', '#d4af37', '#f0d060', '#302c1e']
     },
     {
         id: 'theme-wedding-garden-party',
         name: 'Garden Party',
         colors: ['#f8fdf5', '#f0f9e8', '#6daa4a', '#f0a840', '#d4e8c0']
     }
 ];

 // Expose themes globally so onboarding popup can access them
 window.themes = themes;
 Object.defineProperty(window, 'currentTheme', {
     get() { return currentTheme; },
     set(v) { currentTheme = v; },
     configurable: true
 });

 // Section data - mapping to individual files
 const sections = [
     { id: 1, is_pro: 0, name: 'Hero', file: 'fp-theme-hero.html', tags: ['hero', 'intro', 'cta'] },
     { id: 2, is_pro: 1, name: 'Hero 2', file: 'fp-theme-hero2.html', tags: ['hero', 'content', 'cta'] },
     { id: 3, is_pro: 0, name: 'Inspiration', file: 'fp-theme-inspiration.html', tags: ['content', 'media'] },
     { id: 4, is_pro: 0, name: 'Discussion', file: 'fp-theme-discussion.html', tags: ['content', 'media'] },
     { id: 5, is_pro: 1, name: 'Single Testimonial', file: 'fp-theme-single-testimonial.html', tags: ['testimonial'] },
     { id: 6, is_pro: 0, name: 'Customer Testimonial', file: 'fp-theme-customer-testimonial.html', tags: ['testimonial'] },
     { id: 7, is_pro: 0, name: 'How It Works', file: 'fp-theme-how-it-works.html', tags: ['how_it_works', 'content'] },
     { id: 8, is_pro: 1, name: 'Signup', file: 'fp-theme-signup.html', tags: ['form', 'sign-up', 'cta'] },
     { id: 9, is_pro: 1, name: 'Trusted By', file: 'fp-theme-trusted-by.html', tags: ['logos', 'integrations'] },
     { id: 10, is_pro: 1, name: 'Collections', file: 'fp-theme-collections.html', tags: ['gallery', 'media', 'portfolio'] },
     { id: 11, is_pro: 1, name: 'Photography Skills', file: 'fp-theme-photography-skills.html', tags: ['media', 'portfolio', 'blog'] },
     { id: 12, is_pro: 0, name: 'Success Stories', file: 'fp-theme-success-stories.html', tags: ['team', 'cta'] },
     { id: 13, is_pro: 0, name: 'Business Growth', file: 'fp-theme-business-growth.html', tags: ['content', 'media'] },
     { id: 14, is_pro: 1, name: 'About', file: 'fp-theme-about.html', tags: ['about', 'content', 'features'] },
     { id: 15, is_pro: 1, name: 'Features', file: 'fp-theme-features.html', tags: ['features', 'grid'] },
     { id: 16, is_pro: 1, name: 'Features 2', file: 'fp-theme-features2.html', tags: ['features', 'content'] },
     { id: 17, is_pro: 1, name: 'Testimonials', file: 'fp-theme-testimonials.html', tags: ['testimonial'] },
     { id: 18, is_pro: 1, name: 'Testimonials Interactive', file: 'fp-theme-testimonials-interactive.html', tags: ['testimonial'] },
     { id: 19, is_pro: 1, name: 'Testimonial Cards', file: 'fp-theme-testimonial-cards.html', tags: ['testimonial'] },
     { id: 20, is_pro: 1, name: 'Testimonial Split', file: 'fp-theme-testimonial-split.html', tags: ['testimonial'] },
     { id: 21, is_pro: 1, name: 'Testimonial Carousel', file: 'fp-theme-testimonial-carousel.html', tags: ['testimonial'] },
     { id: 22, is_pro: 1, name: 'Testimonial Grid', file: 'fp-theme-testimonial-grid.html', tags: ['testimonial'] },
     { id: 23, is_pro: 1, name: 'Client Feedback', file: 'fp-theme-client-feedback.html', tags: ['testimonial'] },
     { id: 24, is_pro: 1, name: 'Customer Experience', file: 'fp-theme-customer-experience.html', tags: ['testimonial'] },
     { id: 25, is_pro: 1, name: 'Customer Story', file: 'fp-theme-customer-story.html', tags: ['testimonial'] },
     { id: 26, is_pro: 1, name: 'Happy Users', file: 'fp-theme-happy-users.html', tags: ['testimonial', 'logos'] },
     { id: 27, is_pro: 1, name: 'Pricing', file: 'fp-theme-pricing.html', tags: ['pricing'] },
     { id: 28, is_pro: 1, name: 'Pricing 2', file: 'fp-theme-pricing-2.html', tags: ['pricing'] },
     { id: 29, is_pro: 1, name: 'Pricing 3', file: 'fp-theme-pricing-3.html', tags: ['pricing'] },
     { id: 30, is_pro: 0, name: 'Pricing 4', file: 'fp-theme-pricing-4.html', tags: ['pricing'] },
     { id: 31, is_pro: 1, name: 'Pricing 5', file: 'fp-theme-pricing-5.html', tags: ['pricing'] },
     { id: 32, is_pro: 1, name: 'Pricing 6', file: 'fp-theme-pricing-6.html', tags: ['pricing'] },
     { id: 33, is_pro: 1, name: 'Bio', file: 'fp-theme-bio.html', tags: ['content', 'media', 'portfolio'] },
     { id: 34, is_pro: 0, name: 'Team', file: 'fp-theme-team.html', tags: ['team'] },
     { id: 35, is_pro: 1, name: 'Team 2', file: 'fp-theme-team2.html', tags: ['team'] },
     { id: 36, is_pro: 1, name: 'FAQs', file: 'fp-theme-faqs.html', tags: ['faqs'] },
     { id: 37, is_pro: 1, name: 'Numbers', file: 'fp-theme-numbers.html', tags: ['numbers', 'stats'] },
     { id: 38, is_pro: 1, name: 'Screenshot', file: 'fp-theme-screenshot.html', tags: ['media', 'apps', 'cta'] },
     { id: 39, is_pro: 1, name: 'CTA', file: 'fp-theme-cta.html', tags: ['cta'] },
     { id: 40, is_pro: 0, name: 'Team Layout 1', file: 'fp-theme-team-layout-1.html', tags: ['team'] },
     { id: 41, is_pro: 1, name: 'Web App', file: 'fp-theme-web-app.html', tags: ['content', 'media', 'apps'] },
     { id: 42, is_pro: 1, name: 'Team Layout 2', file: 'fp-theme-team-layout-2.html', tags: ['hero', 'team', 'media', 'cta'] },
     { id: 43, is_pro: 1, name: 'Features Showcase', file: 'fp-theme-features-showcase.html', tags: ['features', 'apps', 'integrations'] },
     { id: 44, is_pro: 1, name: 'Team Circles', file: 'fp-theme-team-circles.html', tags: ['team', 'media'] },
     { id: 45, is_pro: 1, name: 'Card Section', file: 'fp-theme-card-section.html', tags: ['features', 'content', 'how_it_works'] },
     { id: 46, is_pro: 1, name: 'Contact', file: 'fp-theme-contact.html', tags: ['contact', 'form'] },
     { id: 47, is_pro: 0, name: 'Welcome', file: 'fp-theme-welcome.html', tags: ['hero', 'intro', 'media', 'cta'] },
     { id: 48, is_pro: 1, name: 'Hero 3', file: 'fp-theme-hero-2.html', tags: ['hero', 'intro', 'cta'] },
     { id: 49, is_pro: 1, name: 'Email', file: 'fp-theme-email.html', tags: ['form', 'subscribe', 'cta'] },
     { id: 50, is_pro: 1, name: 'Simple Form', file: 'fp-theme-simple-form.html', tags: ['form', 'contact'] },
     { id: 51, is_pro: 1, name: 'Gallery', file: 'fp-theme-gallery.html', tags: ['gallery', 'media', 'portfolio'] },
     { id: 52, is_pro: 1, name: 'Gallery 2', file: 'fp-theme-gallery-2.html', tags: ['gallery', 'media', 'portfolio'] },
     { id: 53, is_pro: 0, name: 'Form Split', file: 'fp-theme-form-split.html', tags: ['form', 'contact'] },
     { id: 54, is_pro: 0, name: 'People', file: 'fp-theme-people.html', tags: ['team', 'media'] },
     { id: 55, is_pro: 0, name: 'Numbers 2', file: 'fp-theme-numbers-2.html', tags: ['numbers', 'stats'] },
     { id: 56, is_pro: 0, name: 'Phone Mockup', file: 'fp-theme-phone-mockup.html', tags: ['hero', 'media', 'apps', 'cta'] },
     { id: 57, is_pro: 1, name: 'Video Bottom', file: 'fp-theme-video-bottom.html', tags: ['video', 'media', 'hero'] },
     { id: 58, is_pro: 0, name: 'Video Top', file: 'fp-theme-video-top.html', tags: ['video', 'media', 'hero'] },
     { id: 59, is_pro: 1, name: 'Video Center', file: 'fp-theme-video-center.html', tags: ['video', 'media', 'portfolio'] },
     { id: 60, is_pro: 1, name: 'Half Image', file: 'fp-theme-half-image.html', tags: ['media', 'content'] },
     { id: 61, is_pro: 1, name: 'Rotated Images', file: 'fp-theme-rotated-images.html', tags: ['hereo', 'media', 'content', 'portfolio'] },
     { id: 62, is_pro: 1, name: 'Why Care', file: 'fp-theme-why-care.html', tags: ['content'] },
     { id: 63, is_pro: 1, name: 'Contact Info', file: 'fp-theme-contact-info.html', tags: ['contact'] },
     { id: 64, is_pro: 1, name: 'Pricing Comparison', file: 'fp-theme-pricing-comparison.html', tags: ['pricing', 'comparison'] },
     { id: 65, is_pro: 1, name: 'Comparison Table', file: 'fp-theme-comparison-table.html', tags: ['comparison', 'grid'] },
     { id: 66, is_pro: 1, name: 'Events Grid', file: 'fp-theme-events-grid.html', tags: ['events', 'grid'] },
     { id: 67, is_pro: 1, name: 'Events List', file: 'fp-theme-events-list.html', tags: ['events'] },
     { id: 68, is_pro: 1, name: 'Pros & Cons', file: 'fp-theme-pros-cons.html', tags: ['comparison', 'content'] },
     { id: 69, is_pro: 1, name: 'Features Accordion', file: 'fp-theme-features-accordion.html', tags: ['features', 'how_it_works', 'apps'] },
     { id: 70, is_pro: 1, name: 'Product Slider', file: 'fp-theme-product-slider.html', tags: ['media', 'portfolio'] },
     { id: 71, is_pro: 1, name: 'Video Split', file: 'fp-theme-video-split.html', tags: ['video', 'media'] },
     { id: 72, is_pro: 1, name: 'Video Split Right', file: 'fp-theme-video-split-right.html', tags: ['video', 'media'] },
     { id: 73, is_pro: 1, name: 'Video Heading', file: 'fp-theme-video-heading.html', tags: ['video', 'media', 'hero'] },
     { id: 74, is_pro: 1, name: 'Gallery Scroll', file: 'fp-theme-gallery-scroll.html', tags: ['gallery', 'media', 'portfolio'] },
     { id: 75, is_pro: 1, name: 'Image Only', file: 'fp-theme-image-only.html', tags: ['media'] },
     { id: 76, is_pro: 1, name: 'Image Center', file: 'fp-theme-image-center.html', tags: ['media', 'hero'] },
     { id: 77, is_pro: 1, name: 'Image Top', file: 'fp-theme-image-top.html', tags: ['media', 'hero'] },
     { id: 78, is_pro: 1, name: 'Image Bottom', file: 'fp-theme-image-bottom.html', tags: ['media', 'hero'] },
     { id: 79, is_pro: 1, name: 'Bento Gallery', file: 'fp-theme-bento-gallery.html', tags: ['gallery', 'media', 'portfolio'] },
     { id: 80, is_pro: 1, name: 'Masonry Gallery', file: 'fp-theme-masonry-gallery.html', tags: ['gallery', 'media', 'portfolio'], hidden: true },
     { id: 81, is_pro: 1, name: 'Gallery Split', file: 'fp-theme-gallery-split.html', tags: ['gallery', 'media', 'portfolio', 'cta'] },
     { id: 82, is_pro: 1, name: 'Gallery Grid', file: 'fp-theme-gallery-grid.html', tags: ['gallery', 'media', 'portfolio'] },
     { id: 83, is_pro: 1, name: 'Gallery Asymmetric', file: 'fp-theme-gallery-asymmetric.html', tags: ['gallery', 'media', 'portfolio'] },
     { id: 84, is_pro: 1, name: 'Gallery Slider', file: 'fp-theme-gallery-slider.html', tags: ['gallery', 'media', 'portfolio', 'cta'] },
     { id: 85, is_pro: 1, name: 'Gallery Expand', file: 'fp-theme-gallery-expand.html', tags: ['gallery', 'media', 'portfolio'] },
     { id: 86, is_pro: 1, name: 'Gallery Expand Overlay', file: 'fp-theme-gallery-expand-overlay.html', tags: ['gallery', 'media', 'portfolio'] },
     { id: 87, is_pro: 1, name: 'Gallery Slider Arrows', file: 'fp-theme-gallery-slider-arrows.html', tags: ['gallery', 'media', 'portfolio'] },
     { id: 88, is_pro: 1, name: 'Gallery Thumbs', file: 'fp-theme-gallery-thumbs.html', tags: ['gallery', 'media', 'portfolio'] },
     { id: 89, is_pro: 1, name: 'Gallery Thumbs Fade', file: 'fp-theme-gallery-thumbs-fade.html', tags: ['gallery', 'media', 'portfolio'] },
     { id: 90, is_pro: 1, name: 'Gallery Grid Links', file: 'fp-theme-gallery-grid-links.html', tags: ['gallery', 'media', 'portfolio'] },
     { id: 91, is_pro: 1, name: 'Gallery Collection Split', file: 'fp-theme-gallery-collection-split.html', tags: ['gallery', 'media', 'portfolio'] },
     { id: 92, is_pro: 1, name: 'Gallery Overflow', file: 'fp-theme-gallery-overflow.html', tags: ['gallery', 'media', 'portfolio'] },
     { id: 93, is_pro: 1, name: 'Gallery Features', file: 'fp-theme-gallery-features.html', tags: ['gallery', 'media', 'portfolio'] },
     { id: 94, is_pro: 1, name: 'Features Grid', file: 'fp-theme-features-grid.html', tags: ['features', 'grid'] },
     { id: 95, is_pro: 1, name: 'Featured Benefits', file: 'fp-theme-featured-benefits.html', tags: ['features', 'grid'] },
     { id: 96, is_pro: 1, name: 'User Features', file: 'fp-theme-user-features.html', tags: ['features'] },
     { id: 97, is_pro: 1, name: 'Business Features', file: 'fp-theme-business-features.html', tags: ['features'] },
     { id: 98, is_pro: 1, name: 'Image Features', file: 'fp-theme-image-features.html', tags: ['features', 'media'] },
     { id: 99, is_pro: 1, name: 'Task Features', file: 'fp-theme-task-features.html', tags: ['features', 'apps', 'cta'] },
     { id: 100, is_pro: 1, name: 'Phone Features', file: 'fp-theme-phone-features.html', tags: ['features', 'apps'] },
     { id: 101, is_pro: 1, name: 'Customer Features', file: 'fp-theme-customer-features.html', tags: ['features'] },
     { id: 102, is_pro: 1, name: 'Sustainable Features', file: 'fp-theme-sustainable-features.html', tags: ['features'] },
     { id: 103, is_pro: 1, name: 'Network Features', file: 'fp-theme-network-features.html', tags: ['features'] },
     { id: 104, is_pro: 1, name: 'Interactive Features', file: 'fp-theme-interactive-features.html', tags: ['features'] },
     { id: 105, is_pro: 1, name: 'Standout Features', file: 'fp-theme-standout-features.html', tags: ['features'] },
     { id: 106, is_pro: 1, name: 'Questions & Answers', file: 'fp-theme-questions-answers.html', tags: ['faqs'] },
     { id: 107, is_pro: 1, name: 'Popular Questions', file: 'fp-theme-popular-questions.html', tags: ['faqs'] },
     { id: 108, is_pro: 1, name: 'Inline FAQ', file: 'fp-theme-inline-faq.html', tags: ['faqs'] },
     { id: 109, is_pro: 1, name: 'Split FAQ', file: 'fp-theme-split-faq.html', tags: ['faqs', 'cta'] },
     { id: 110, is_pro: 1, name: 'FAQ Image', file: 'fp-theme-faq-image.html', tags: ['faqs', 'media'] },
     { id: 111, is_pro: 1, name: 'FAQ Visible', file: 'fp-theme-faq-visible.html', tags: ['faqs'] },
     { id: 112, is_pro: 1, name: 'FAQ Hover', file: 'fp-theme-faq-hover.html', tags: ['faqs'] },
     { id: 113, is_pro: 1, name: 'Pricing Toggle', file: 'fp-theme-pricing-toggle.html', tags: ['pricing'] },
     { id: 114, is_pro: 1, name: 'Pricing Cards', file: 'fp-theme-pricing-cards.html', tags: ['pricing'] },
     { id: 115, is_pro: 1, name: 'Pricing Features', file: 'fp-theme-pricing-features.html', tags: ['pricing'] },
     { id: 116, is_pro: 1, name: 'Event Pricing', file: 'fp-theme-event-pricing.html', tags: ['pricing', 'events'] },
     { id: 117, is_pro: 1, name: 'Dedicated Team', file: 'fp-theme-dedicated-team.html', tags: ['team'] },
     { id: 118, is_pro: 1, name: 'Creative Team', file: 'fp-theme-creative-team.html', tags: ['team'] },
     { id: 119, is_pro: 1, name: 'Skilled Team', file: 'fp-theme-skilled-team.html', tags: ['team'] },
     { id: 120, is_pro: 1, name: 'Exceptional Team 2', file: 'fp-theme-exceptional-team-2.html', tags: ['team'] },
     { id: 121, is_pro: 1, name: 'Award Team', file: 'fp-theme-award-team.html', tags: ['team'] },
     { id: 122, is_pro: 1, name: 'Talented Team', file: 'fp-theme-talented-team.html', tags: ['team'] },
     { id: 123, is_pro: 1, name: 'Collaboration Team', file: 'fp-theme-collaboration-team.html', tags: ['team'] },
     { id: 124, is_pro: 1, name: 'Exceptional Team', file: 'fp-theme-exceptional-team.html', tags: ['team'] },
     { id: 125, is_pro: 1, name: 'Team Slider', file: 'fp-theme-team-slider.html', tags: ['team'] },
     { id: 126, is_pro: 1, name: 'Staggered Team', file: 'fp-theme-staggered-team.html', tags: ['team'] },
     { id: 127, is_pro: 1, name: 'Team Carousel', file: 'fp-theme-team-carousel.html', tags: ['team'] },
     { id: 128, is_pro: 1, name: 'Portfolio Grid', file: 'fp-theme-portfolio-grid.html', tags: ['portfolio', 'grid'] },
     { id: 129, is_pro: 1, name: 'Blog Entries', file: 'fp-theme-blog-entries.html', tags: ['blog', 'content'] },
     { id: 130, is_pro: 1, name: 'Latest Blog', file: 'fp-theme-latest-blog.html', tags: ['blog', 'content'] },
     { id: 131, is_pro: 1, name: 'Contact Form', file: 'fp-theme-contact-form.html', tags: ['contact', 'form'] },
     { id: 132, is_pro: 1, name: 'Contact Map', file: 'fp-theme-contact-map.html', tags: ['contact', 'form'] },
     { id: 133, is_pro: 1, name: 'Logos Grid', file: 'fp-theme-logos-grid.html', tags: ['logos', 'grid'] },
     { id: 134, is_pro: 1, name: 'Contact Split', file: 'fp-theme-contact-split.html', tags: ['contact', 'form'] },
     { id: 135, is_pro: 1, name: 'Integrations Cards', file: 'fp-theme-integrations-cards.html', tags: ['features', 'integrations'] },
     { id: 136, is_pro: 1, name: 'Numbers Split', file: 'fp-theme-numbers-split.html', tags: ['numbers', 'stats'] },
     { id: 137, is_pro: 1, name: 'Numbers Centered', file: 'fp-theme-numbers-centered.html', tags: ['numbers', 'stats'] },
     { id: 138, is_pro: 1, name: 'Numbers With Features', file: 'fp-theme-numbers-with-features.html', tags: ['numbers', 'stats', 'features'] },
     { id: 139, is_pro: 1, name: 'Numbers Performance', file: 'fp-theme-numbers-performance.html', tags: ['numbers', 'stats'] },
     { id: 140, is_pro: 1, name: 'Integrations', file: 'fp-theme-integrations.html', tags: ['features', 'integrations'] },
     { id: 141, is_pro: 1, name: 'Numbers Innovative', file: 'fp-theme-numbers-innovative.html', tags: ['numbers', 'stats'] },
     { id: 142, is_pro: 1, name: 'Property Experts', file: 'fp-theme-property-experts.html', tags: ['content', 'team'] },
     { id: 143, is_pro: 1, name: 'Empowering Communities', file: 'fp-theme-empowering-communities.html', tags: ['hero', 'content', 'features'] },
     { id: 144, is_pro: 1, name: 'Testimonials Image', file: 'fp-theme-testimonials-image.html', tags: ['testimonial', 'media'] },
     { id: 145, is_pro: 1, name: 'Logos', file: 'fp-theme-logos.html', tags: ['logos', 'integrations'] },
     { id: 146, is_pro: 1, name: 'Login', file: 'fp-theme-login.html', tags: ['form', 'login'] },
     { id: 147, is_pro: 1, name: 'Newsletter Centered', file: 'fp-theme-newsletter-centered.html', tags: ['newsletter', 'subscribe', 'cta', 'hero'] },
     { id: 148, is_pro: 1, name: 'Newsletter', file: 'fp-theme-newsletter.html', tags: ['newsletter', 'subscribe', 'cta'] },
     { id: 149, is_pro: 1, name: 'CTA 1', file: 'fp-theme-cta-1.html', tags: ['cta'] },
     { id: 150, is_pro: 1, name: 'CTA 2', file: 'fp-theme-cta-2.html', tags: ['cta'] },
     { id: 151, is_pro: 1, name: 'CTA 3', file: 'fp-theme-cta-3.html', tags: ['cta'] },
     { id: 152, is_pro: 1, name: 'CTA 4', file: 'fp-theme-cta-4.html', tags: ['cta'], hidden: true },
     { id: 153, is_pro: 1, name: 'CTA 5', file: 'fp-theme-cta-5.html', tags: ['cta'] },
     { id: 154, is_pro: 1, name: 'CTA 6', file: 'fp-theme-cta-6.html', tags: ['cta'] },
     { id: 155, is_pro: 1, name: 'Contact 2', file: 'fp-theme-contact-2.html', tags: ['contact', 'form'] },
     { id: 156, is_pro: 1, name: 'Hero 4', file: 'fp-theme-hero-3.html', tags: ['hero', 'intro', 'cta'], hidden: true },
     { id: 157, is_pro: 1, name: 'Hero 5', file: 'fp-theme-hero-4.html', tags: ['hero', 'intro', 'cta'] },
     { id: 158, is_pro: 1, name: 'Hero 6', file: 'fp-theme-hero-5.html', tags: ['hero', 'intro', 'cta'] },
     { id: 159, is_pro: 1, name: 'Footer', file: 'fp-theme-footer.html', tags: ['footer'] },
     { id: 160, is_pro: 1, name: 'About Video Stats', file: 'fp-theme-about-video-stats.html', tags: ['about', 'video', 'stats'] },
     { id: 161, is_pro: 1, name: 'Achievement Story', file: 'fp-theme-achievement-story.html', tags: ['about', 'content', 'stats'] },
     { id: 162, is_pro: 1, name: 'Process Steps', file: 'fp-theme-process-steps.html', tags: ['how_it_works', 'content'] },
     { id: 163, is_pro: 1, name: 'Guide Steps', file: 'fp-theme-guide-steps.html', tags: ['how_it_works', 'content'] },
     { id: 164, is_pro: 1, name: 'Onboarding Flow', file: 'fp-theme-onboarding-flow.html', tags: ['how_it_works', 'content'] },
     { id: 165, is_pro: 1, name: 'Understanding Steps', file: 'fp-theme-understanding-steps.html', tags: ['how_it_works', 'content'] },
     { id: 166, is_pro: 1, name: 'Process Accordion', file: 'fp-theme-process-accordion.html', tags: ['how_it_works', 'content', 'features'] },
     { id: 167, is_pro: 1, name: 'Step Cards', file: 'fp-theme-step-cards.html', tags: ['how_it_works', 'content'] },
     { id: 168, is_pro: 1, name: 'Steps Slider', file: 'fp-theme-steps-slider.html', tags: ['how_it_works', 'content'] },
     { id: 169, is_pro: 1, name: 'Testimonials Cards', file: 'fp-theme-testimonials-cards.html', tags: ['testimonial'] },
     { id: 170, is_pro: 1, name: 'Footer 1', file: 'fp-theme-footer-1.html', tags: ['footer'] },
     { id: 171, is_pro: 1, name: 'Footer 2', file: 'fp-theme-footer-2.html', tags: ['footer'] },
     { id: 172, is_pro: 1, name: 'Footer 3', file: 'fp-theme-footer-3.html', tags: ['footer'] },
     { id: 173, is_pro: 1, name: 'Footer 4', file: 'fp-theme-footer-4.html', tags: ['footer'] }
 ];

// Template definitions - static registry similar to sections array above
// defaultTheme: the wedding theme pre-selected in the Themes panel when the user previews this template
const templates = [
    { id: 1, is_pro: 0, name: 'Wedding One',   file: 'template1.html', category: 'classic',     tags: ['classic', 'modern', 'cream'],    defaultTheme: 'theme-wedding-sepia-lace' },
    { id: 2, is_pro: 0, name: 'Luxury One',    file: 'template2.html', category: 'luxe',        tags: ['black', 'gold', 'cream'],        defaultTheme: 'theme-wedding-art-deco' },
    { id: 3, is_pro: 0, name: 'Rustic One',    file: 'template3.html', category: 'rustic',      tags: ['sage', 'terracota', 'chic'],     defaultTheme: 'theme-wedding-terracotta' },
    { id: 4, is_pro: 0, name: 'Beach Wedding', file: 'template4.html', category: 'modern',      tags: ['beach', 'sea', 'water'],         defaultTheme: 'theme-wedding-aqua-sand' },
    { id: 5, is_pro: 0, name: 'Travellers',    file: 'template5.html', category: 'alternative', tags: ['travel', 'adventure', 'road'],   defaultTheme: 'theme-wedding-champagne-pampas' },
    { id: 6, is_pro: 0, name: 'Funny Wedding', file: 'template6.html', category: 'funny',       tags: ['happy', 'laugh', 'casual'],      defaultTheme: 'theme-wedding-garden-party' },
];

// Template style categories - replaces templates/categorias.json
const templateCategories = [
    { id: 'all',         name: 'All Templates',  icon: '🎨' },
    { id: 'modern',      name: 'Modern',         icon: '🌿' },
    { id: 'classic',     name: 'Classic',        icon: '🌸' },
    { id: 'rustic',      name: 'Rustic',         icon: '🪵' },
    { id: 'funny',       name: 'Funny',          icon: '🤣' },
    { id: 'luxe',        name: 'Luxe',           icon: '✨' },
    { id: 'fairytale',   name: 'Fairytale',      icon: '🏰' },
    { id: 'vintage',     name: 'Vintage',        icon: '🎞️' },
    { id: 'alternative', name: 'Alternative',    icon: '🎸' },
];
// Expose so onboarding.js can build category pills
window.templateCategories = templateCategories;

 // Helper function to sort sections - free sections first for non-pro users
 function sortSectionsByUserAccess(sectionsArray) {
     // For pro users, keep natural order
     if (editorMode === 'paid') {
         return sectionsArray;
     }

     // For free users, show free sections first, then pro sections
     return sectionsArray.sort((a, b) => {
         if (a.is_pro !== b.is_pro) {
             return a.is_pro - b.is_pro; // 0 (free) comes before 1 (pro)
         }
         return 0; // Keep original order for sections of the same type
     });
 }

 // Category mapping for sections (usado por búsqueda y otras partes; el menú lateral usa templateStyles)
 const categories = {
     'All': {
         name: 'All',
         icon: 'list',
         sections: sortSectionsByUserAccess(sections.filter(s => !s.hidden))
     },
     'Hero': {
         name: 'Hero',
         icon: 'zap',
         sections: sortSectionsByUserAccess(sections.filter(s => (s.tags.includes('hero') || s.tags.includes('intro')) && !s.hidden))
     },
     'Features': {
         name: 'Features',
         icon: 'star',
         sections: sortSectionsByUserAccess(sections.filter(s => s.tags.includes('features') && !s.hidden))
     },
     'Testimonials': {
         name: 'Testimonials',
         icon: 'message-circle',
         sections: sortSectionsByUserAccess(sections.filter(s => s.tags.includes('testimonial') && !s.hidden))
     },
     'Pricing': {
         name: 'Pricing',
         icon: 'dollar-sign',
         sections: sortSectionsByUserAccess(sections.filter(s => s.tags.includes('pricing') && !s.hidden))
     },
     'Team': {
         name: 'Team',
         icon: 'users',
         sections: sortSectionsByUserAccess(sections.filter(s => s.tags.includes('team') && !s.hidden))
     },
     'Gallery': {
         name: 'Gallery',
         icon: 'image',
         sections: sortSectionsByUserAccess(sections.filter(s => s.tags.includes('gallery') && !s.hidden))
     },
     'Portfolio': {
         name: 'Portfolio',
         icon: 'briefcase',
         sections: sortSectionsByUserAccess(sections.filter(s => s.tags.includes('portfolio') && !s.hidden))
     },
     'Contact': {
         name: 'Contact',
         icon: 'phone',
         sections: sortSectionsByUserAccess(sections.filter(s => s.tags.includes('contact') && !s.hidden))
     },
    //  'Forms': {
    //      name: 'Forms',
    //      icon: 'edit',
    //      sections: sortSectionsByUserAccess(sections.filter(s => s.tags.includes('form') && !s.hidden))
    //  },
     'About': {
         name: 'About',
         icon: 'info',
         sections: sortSectionsByUserAccess(sections.filter(s => s.tags.includes('about') && !s.hidden))
     },
     'FAQs': {
         name: 'FAQs',
         icon: 'help-circle',
         sections: sortSectionsByUserAccess(sections.filter(s => s.tags.includes('faqs') && !s.hidden))
     },
     'How it works': {
         name: 'How it works',
         icon: 'settings',
         sections: sortSectionsByUserAccess(sections.filter(s => s.tags.includes('how_it_works') && !s.hidden))
     },
     'Stats': {
         name: 'Stats',
         icon: 'bar-chart',
         sections: sortSectionsByUserAccess(sections.filter(s => (s.tags.includes('stats') || s.tags.includes('numbers')) && !s.hidden))
     },
     'Media': {
         name: 'Media',
         icon: 'film',
         sections: sortSectionsByUserAccess(sections.filter(s => s.tags.includes('media') && !s.tags.includes('gallery') && !s.tags.includes('portfolio') && !s.hidden))
     },
     'Video': {
         name: 'Video',
         icon: 'video',
         sections: sortSectionsByUserAccess(sections.filter(s => s.tags.includes('video') && !s.hidden))
     },
     'Applications': {
         name: 'Applications',
         icon: 'smartphone',
         sections: sortSectionsByUserAccess(sections.filter(s => s.tags.includes('apps') && !s.hidden))
     },
     'Logo clouds': {
         name: 'Logo clouds',
         icon: 'cloud',
         sections: sortSectionsByUserAccess(sections.filter(s => s.tags.includes('logos') && !s.hidden))
     },
     'Newsletter': {
         name: 'Newsletter',
         icon: 'mail',
         sections: sortSectionsByUserAccess(sections.filter(s => (s.tags.includes('subscribe') || s.tags.includes('newsletter')) && !s.hidden))
     },
     'CTA': {
         name: 'CTA',
         icon: 'target',
         sections: sortSectionsByUserAccess(sections.filter(s => s.tags.includes('cta') && !s.hidden))
     },
     'Events': {
         name: 'Events',
         icon: 'calendar',
         sections: sortSectionsByUserAccess(sections.filter(s => s.tags.includes('events') && !s.hidden))
     },
     'Comparison': {
         name: 'Comparison',
         icon: 'git-compare',
         sections: sortSectionsByUserAccess(sections.filter(s => s.tags.includes('comparison') && !s.hidden))
     },
     'Content': {
         name: 'Content',
         icon: 'layout',
         sections: sortSectionsByUserAccess(sections.filter(s => s.tags.includes('content') && !s.tags.includes('hero') && !s.tags.includes('about') && !s.hidden))
     },
     'Blog': {
         name: 'Blog',
         icon: 'book-open',
         sections: sortSectionsByUserAccess(sections.filter(s => s.tags.includes('blog') && !s.hidden))
     },
     'Integrations': {
         name: 'Integrations',
         icon: 'git-merge',
         sections: sortSectionsByUserAccess(sections.filter(s => s.tags.includes('integrations') && !s.hidden))
     },
     'Footer': {
        name: 'Footer',
        icon: 'anchor',
        sections: sortSectionsByUserAccess(sections.filter(s => s.tags.includes('footer') && !s.hidden))
     },
 };

// Template style filters keyed by category id. Built from templateCategories and templates arrays.
const templateStyles = {};

// Builds templateStyles from the static `templates` and `templateCategories` arrays.
// Replaces the previous async loadTemplatesFromApi() that fetched api/list-templates.php.
function buildTemplateStyles() {
    // Map each template entry to the shape expected by the UI
    const list = templates.map(t => ({
        id:           String(t.id),
        name:         t.name,
        url:          'templates/html/' + t.file,
        category:     t.category,
        tags:         t.tags || [],
        styles:       [t.category],
        is_pro:       t.is_pro || 0,
        defaultTheme: t.defaultTheme || null,
    }));

    // Build templateStyles from templateCategories
    templateCategories.forEach(cat => {
        if (cat && cat.id) {
            templateStyles[cat.id] = {
                name:      cat.name || cat.id,
                icon:      cat.icon != null ? cat.icon : '📁',
                templates: [],
            };
        }
    });

    // Assign templates to their matching category entries
    Object.keys(templateStyles).forEach(styleKey => {
        if (styleKey === 'all') {
            templateStyles[styleKey].templates = list;
        } else {
            templateStyles[styleKey].templates = list.filter(t => t.category === styleKey);
        }
    });

    // Expose globally for template-search.js compatibility
    window.allTemplates = list;
}

// [DISABLED_FOR_WEDDING_VERSION]: Dynamic template loading from API replaced by static buildTemplateStyles().
// async function loadTemplatesFromApi() { ... }

// [DISABLED_FOR_WEDDING_VERSION]: Color filter functionality removed for wedding version.
// function applyColorFilter(selectedColors) {
//     if (currentCategoryKey) {
//         showStylePanel(currentCategoryKey);
//     }
// }

 /**
  * Parse full template HTML (document) into body content + head styles/scripts.
  * Supports templates with external CSS/JS: <link href="style.css">, <script src="script.js"></script>.
  * Relative URLs are resolved against the template folder (baseUrl).
  */
 function parseTemplateFullHtml(htmlString, baseUrl) {
     const parser = new DOMParser();
     const doc = parser.parseFromString(htmlString, 'text/html');
     const styleHrefs = [];
     const inlineStyles = [];
     const scriptSrcs = [];
     const inlineScripts = [];

     const resolve = (url) => {
         if (!url || url.startsWith('data:') || url.startsWith('#')) return url;
         try {
             return new URL(url, baseUrl).href;
         } catch (_) {
             return url;
         }
     };

     doc.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
         const href = link.getAttribute('href');
         if (href) styleHrefs.push(resolve(href));
     });
     doc.querySelectorAll('style').forEach(style => {
         if (style.textContent) inlineStyles.push(style.textContent);
     });
     doc.querySelectorAll('script[src]').forEach(script => {
         const src = script.getAttribute('src');
         if (src) scriptSrcs.push(resolve(src));
     });
     doc.querySelectorAll('script:not([src])').forEach(script => {
         if (script.textContent) inlineScripts.push(script.textContent);
     });

     const body = doc.body;
     const contentHtml = body ? body.innerHTML : '';

     return { contentHtml, styleHrefs, inlineStyles, scriptSrcs, inlineScripts };
 }

 /**
  * Same-origin CSS is fetched and returned as inline (so preview can rewrite/scope).
  * If fetch fails, the URL goes to styleHrefs so the preview injects <link>.
  * Tries full URL and pathname so it works in different server setups.
  */
 async function resolveTemplateStyles(styleHrefs, inlineStyles) {
     const externalHrefs = [];
     const mergedInline = [...(inlineStyles || [])];
     const origin = window.location.origin;
     for (const href of styleHrefs || []) {
         try {
             const url = new URL(href);
             if (url.origin !== origin) {
                 externalHrefs.push(href);
                 continue;
             }
             let text = null;
             const pathname = url.pathname + (url.search || '');
             const attempts = [href, pathname];
             for (const fetchUrl of attempts) {
                 try {
                     const res = await fetch(fetchUrl);
                     if (res.ok) {
                         text = await res.text();
                         break;
                     }
                 } catch (_) {}
             }
             if (text) {
                 mergedInline.push(text);
             } else {
                 console.warn('[Template] CSS no cargado, se usará <link> en preview:', pathname);
                 externalHrefs.push(href);
             }
         } catch (e) {
             console.warn('[Template] Error resolviendo CSS:', href, e);
             externalHrefs.push(href);
         }
     }
     return { styleHrefs: externalHrefs, inlineStyles: mergedInline };
 }

 /**
  * Load template in preview by navigating iframe to preview.php?template=...
  * preview.php injects the template's head (CSS, JS) and body content server-side.
  */
 function insertFullTemplateIntoPreview(template) {
     if (!template || !template.url) {
         console.warn('Template or template.url missing');
         return;
     }
currentTemplateUrl = template.url;
    const iframe = document.getElementById('preview-iframe');
     if (!iframe) {
         console.warn('Preview iframe not found');
         return;
     }
     const currentPath = window.location.pathname;
     const basePath = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);
     const previewPath = basePath + 'preview.php';
     const url = previewPath + '?template=' + encodeURIComponent(template.url);
     iframe.src = url;
     if (typeof scheduleAutosave === 'function') scheduleAutosave();
 }

 // Load section content from file
 async function loadSectionContent(fileName) {
     if (sectionCache.has(fileName)) {
         return sectionCache.get(fileName);
     }

     try {
         const response = await fetch(`sections_thumbnails/${fileName}`);
         const content = await response.text();
         sectionCache.set(fileName, content);
         return content;
     } catch (error) {
         console.error(`Error loading section ${fileName}:`, error);
         return '<div class="section-placeholder">Error loading section</div>';
     }
 }

 // Create section item element
 function createSectionItem(section) {
     const sectionItem = document.createElement('div');
     sectionItem.className = 'section-item';
     sectionItem.dataset.section = section.id;
     sectionItem.dataset.file = section.file;
     sectionItem.dataset.isPro = section.is_pro;
     
     const isProSection = section.is_pro === 1;
     const isPaidUser = editorMode === 'paid';
     
     // Add pro-section class if it's a pro section
     if (isProSection) {
         sectionItem.classList.add('pro-section');
         if (isPaidUser) {
             sectionItem.classList.add('paid-user');
         }
     }
     
     sectionItem.innerHTML = `
         <div class="section-number">${section.id}</div>
         <div class="section-content">
             <div class="section-content-inner @container">
                 ${isProSection && !isPaidUser ? 
                     `<img src="screenshots/${section.id}.jpg" alt="${section.name}" class="section-thumbnail" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                      <div class="section-loading" style="display: none;">Loading...</div>` 
                     : 
                     `<div class="section-loading">Loading...</div>`
                 }
             </div>
         </div>
         <div class="section-overlay">
             <button class="add-section-button" style="display: ${isProSection && !isPaidUser ? 'none' : 'flex'};">+</button>
         </div>
         ${isProSection && !isPaidUser ? '<div class="section-lock" data-tippy-content="Premium section - Upgrade to PRO to unlock"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-lock-icon lucide-lock"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>' : ''}
     `;
     
     return sectionItem;
 }

 // Load section content when it comes into view
 async function loadSectionWhenVisible(sectionItem) {
     const file = sectionItem.dataset.file;
     const isProSection = sectionItem.dataset.isPro === '1';
     const isPaidUser = editorMode === 'paid';
     const contentInner = sectionItem.querySelector('.section-content-inner');
     
     // For pro sections with free users, we use thumbnails instead of HTML content
     if (isProSection && !isPaidUser) {
         return;
     }
     
     if (loadedSections.has(file)) {
         return; // Already loaded
     }

     const content = await loadSectionContent(file);
     contentInner.innerHTML = content;
     loadedSections.add(file);
 }

 // Unload section content when it goes out of view
 function unloadSectionWhenHidden(sectionItem) {
     const file = sectionItem.dataset.file;
     const isProSection = sectionItem.dataset.isPro === '1';
     const isPaidUser = editorMode === 'paid';
     const contentInner = sectionItem.querySelector('.section-content-inner');
     
     // For pro sections with free users, we don't need to unload anything since we use thumbnails
     if (isProSection && !isPaidUser) {
         return;
     }
     
     // Unload when section goes out of view, regardless of loaded count
     if (loadedSections.has(file)) {
         contentInner.innerHTML = '<div class="section-loading">Loading...</div>';
         loadedSections.delete(file);
     }
 }

 // Intersection Observer for lazy loading
 function setupIntersectionObserver() {
     const options = {
         root: document.querySelector('.sidebar'),
         rootMargin: '400px',
         threshold: 0
     };

     observer = new IntersectionObserver((entries) => {
         entries.forEach(entry => {
             if (entry.isIntersecting) {
                 loadSectionWhenVisible(entry.target);
             } else {
                 unloadSectionWhenHidden(entry.target);
             }
         });
     }, options);
 }

 // Onboarding sidebar mode: true when no template is loaded yet.
 window.isOnboardingMode = false;

 // Enters onboarding: removes sidebar-ready from all elements so CSS defaults hide everything.
 // The main-area becomes full-width automatically (no translateX offset).
function enterOnboardingMode() {
    window.isOnboardingMode = true;
    // [DISABLED_FOR_WEDDING_VERSION]: Sidebar removed; no sidebar-ready class manipulation needed.
    // sidebarCollapsed = true;
    // const sidebar      = document.querySelector('.sidebar');
    // const editorLayout = document.querySelector('.editor-layout');
    // const topBar       = document.querySelector('.top-bar');
    // const toggleButton = document.getElementById('toggle-sidebar');
    // if (sidebar)      { sidebar.classList.remove('sidebar-ready', 'collapsed'); sidebar.classList.add('onboarding-mode'); }
    // if (editorLayout) editorLayout.classList.remove('sidebar-ready', 'collapsed');
    // if (topBar)       topBar.classList.remove('sidebar-ready', 'sidebar-collapsed');
    // if (toggleButton) toggleButton.classList.remove('sidebar-ready', 'collapsed', 'invisible');
    hideCategoryPanel();
    updateViewPagesBtnVisibility();
    updateTopbarFilesBtnVisibility();
    // Fetch pages so _userHasPages is set and "Your Pages" button appears if the user
    // already has pages (fixes race condition where button stayed hidden on first paint).
    fetchAndRenderPagesList();
}

 // Exits onboarding: adds sidebar-ready to all elements, revealing sidebar and offsetting main-area.
 // Sidebar starts collapsed so no open→close animation flashes when a template is inserted.
function exitOnboardingMode() {
    window.isOnboardingMode = false;
    sidebarCollapsed = true;
    const sidebar      = document.querySelector('.sidebar');
    const editorLayout = document.querySelector('.editor-layout');
    const topBar       = document.querySelector('.top-bar');
    const toggleButton = document.getElementById('toggle-sidebar');

    if (sidebar) {
        sidebar.classList.remove('onboarding-mode');
        sidebar.classList.add('sidebar-ready', 'collapsed');
    }
    // [DISABLED_FOR_WEDDING_VERSION]: Sidebar overlays editor — editorLayout/topBar/toggleButton no longer offset
    // if (editorLayout) {
    //     editorLayout.classList.add('sidebar-ready', 'collapsed');
    // }
    // if (topBar) {
    //     topBar.classList.add('sidebar-ready', 'sidebar-collapsed');
    // }
    // if (toggleButton) {
    //     toggleButton.classList.remove('invisible');
    //     toggleButton.classList.add('sidebar-ready', 'collapsed');
    //     const icon = toggleButton.querySelector('i');
    //     if (icon) icon.setAttribute('data-lucide', 'globe');
    // }

    // Hide "Your Pages" button when leaving onboarding
    updateViewPagesBtnVisibility();
    updateTopbarFilesBtnVisibility();

    // [DISABLED_FOR_WEDDING_VERSION]: Change Template button replaced by View Your Pages button.
    // const changeTemplateBtn = document.getElementById('change-template-btn');
    // if (changeTemplateBtn) changeTemplateBtn.style.display = '';

    document.querySelectorAll('#category-list .category-item').forEach(el => el.classList.remove('onboarding-active'));
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();

    // Load the pages list now that the user has a template
    fetchAndRenderPagesList();
}

// [DISABLED_FOR_WEDDING_VERSION]: Replaced by window._collapseAfterOnboarding flag inside exitOnboardingMode,
// which applies the collapsed state atomically so no open→close animation flashes.
// window.collapseSidebarAfterTemplateInsert = function collapseSidebarAfterTemplateInsert() {
//     sidebarCollapsed = true;
//     const sidebar = document.querySelector('.sidebar');
//     const editorLayout = document.querySelector('.editor-layout');
//     const topBar = document.querySelector('.top-bar');
//     const toggleButton = document.getElementById('toggle-sidebar');
//     if (sidebar) sidebar.classList.add('collapsed');
//     if (editorLayout) editorLayout.classList.add('collapsed');
//     if (topBar) { topBar.classList.remove('sidebar-collapsed'); topBar.classList.add('sidebar-collapsed'); }
//     if (toggleButton) {
//         toggleButton.classList.add('collapsed');
//         const icon = toggleButton.querySelector('i');
//         if (icon) icon.setAttribute('data-lucide', 'chevron-right');
//     }
//     const changeTemplateBtn = document.getElementById('change-template-btn');
//     if (changeTemplateBtn) changeTemplateBtn.style.display = '';
//     if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
// };

// Hides sidebar when opening the template preview popup (onboarding preview).
// In onboarding the sidebar already has no sidebar-ready, so nothing to do.
// In normal mode (template already chosen), collapse it temporarily.
function hideSidebarForPreview() {
     sidebarCollapsed = true;
     // [DISABLED_FOR_WEDDING_VERSION]: Only sidebar collapsed; editorLayout/topBar no longer manipulated
     // const editorLayout = document.querySelector('.editor-layout');
     const sidebar = document.querySelector('.sidebar');
     // const topBar = document.querySelector('.top-bar');
     const toggleButton = document.getElementById('toggle-sidebar');
     const categoryPanel = document.querySelector('.category-hover-panel');
     // if (editorLayout) editorLayout.classList.add('collapsed');
     if (sidebar) sidebar.classList.add('collapsed');
     // if (topBar) topBar.classList.add('sidebar-collapsed');
     if (toggleButton) {
         toggleButton.classList.add('invisible');
         // [DISABLED_FOR_WEDDING_VERSION]: 'collapsed' class on toggle no longer needed
         // toggleButton.classList.add('collapsed');
         // const icon = toggleButton.querySelector('i');
         // if (icon) icon.setAttribute('data-lucide', 'globe');
     }
     if (categoryPanel) categoryPanel.style.left = '0';
     if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
 }

 // Restores sidebar after closing the preview popup.
 // Stays hidden if still in onboarding (no template chosen yet).
 function showSidebarAfterPreview() {
     if (window.isOnboardingMode) {
         const categoryPanel = document.querySelector('.category-hover-panel');
         if (categoryPanel) categoryPanel.style.left = '0';
         return;
     }
     sidebarCollapsed = false;
     // [DISABLED_FOR_WEDDING_VERSION]: editorLayout/topBar no longer manipulated (overlay approach)
     // const editorLayout = document.querySelector('.editor-layout');
     const sidebar = document.querySelector('.sidebar');
     // const topBar = document.querySelector('.top-bar');
     const toggleButton = document.getElementById('toggle-sidebar');
     const categoryPanel = document.querySelector('.category-hover-panel');
     // if (editorLayout) editorLayout.classList.remove('collapsed');
     if (sidebar) sidebar.classList.remove('collapsed');
     // if (topBar) topBar.classList.remove('sidebar-collapsed');
     if (toggleButton) {
         toggleButton.classList.remove('invisible');
         // [DISABLED_FOR_WEDDING_VERSION]: 'collapsed' class on toggle no longer needed
         // toggleButton.classList.remove('collapsed');
         // const icon = toggleButton.querySelector('i');
         // if (icon) icon.setAttribute('data-lucide', 'globe');
     }
     // [DISABLED_FOR_WEDDING_VERSION]: No sidebar offset in overlay mode
     if (categoryPanel) categoryPanel.style.left = '0';
     if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
 }
 window.hideSidebarForPreview = hideSidebarForPreview;
 window.showSidebarAfterPreview = showSidebarAfterPreview;

 // Helper: marks a sidebar category item as active (onboarding selection).
 function setActiveSidebarCategory(styleKey) {
     document.querySelectorAll('#category-list .category-item').forEach(el => {
         el.classList.toggle('onboarding-active', el.dataset.category === styleKey);
     });
 }
 window.setActiveSidebarCategory = setActiveSidebarCategory;

// Genera el menú lateral con filtros de estilo (templates). Wedding/template-first: solo templates, no catálogo de secciones.
function generateCategories() {
    const categoryList = document.getElementById('category-list');
    if (!categoryList) return;
    categoryList.innerHTML = '';
     
     Object.entries(templateStyles).forEach(([styleKey, styleData]) => {
         const categoryItem = document.createElement('div');
         categoryItem.className = 'category-item category-item-style';
         categoryItem.dataset.category = styleKey;
         categoryItem.dataset.isStyleFilter = 'true';
         
         const count = styleData.templates ? styleData.templates.length : 0;
         categoryItem.innerHTML = `
             <span class="category-item-icon-emoji">${styleData.icon}</span>
             <span>${styleData.name}</span>
             ${count > 0 ? `<span class="category-count">${count}</span>` : ''}
         `;

         // Click handler: in onboarding mode, filter the central gallery;
         // in normal mode, open the style panel to the right.
         categoryItem.addEventListener('click', () => {
             if (window.isOnboardingMode) {
                 setActiveSidebarCategory(styleKey);
                 window.Onboarding?.filterByCategory(styleKey);
                 return;
             }
             showStylePanel(styleKey);
         });
         
         let itemHoverTimeout = null;
         categoryItem.addEventListener('mouseenter', () => {
             // In onboarding mode categories respond to click, not hover.
             if (window.isOnboardingMode) return;
             if (itemHoverTimeout) clearTimeout(itemHoverTimeout);
             itemHoverTimeout = setTimeout(() => {
                 showStylePanel(styleKey);
                 itemHoverTimeout = null;
             }, CATEGORY_HOVER_DELAY_MS);
         });
         categoryItem.addEventListener('mouseleave', () => {
             if (itemHoverTimeout) {
                 clearTimeout(itemHoverTimeout);
                 itemHoverTimeout = null;
             }
         });
         
         categoryList.appendChild(categoryItem);
     });
 }

 // Load category section content when visible
 async function loadCategorySectionWhenVisible(sectionItem) {
     // Store references at the start in case element gets recreated
     const sectionId = sectionItem.dataset.section;
     const file = sectionItem.dataset.file;
     const isProSection = sectionItem.dataset.isPro === '1';
     const isPaidUser = editorMode === 'paid';
     
     // For pro sections with free users, we use thumbnails instead of HTML content
     if (isProSection && !isPaidUser) {
         return;
     }
     
     if (!file || !sectionId) {
         return;
     }
     
     // Check if this specific element is already loaded
     const contentInner = sectionItem.querySelector('.category-section-content-inner');
     if (contentInner && contentInner.innerHTML.trim() && contentInner.querySelector('section, footer')) {
         // Already has content loaded
         return;
     }

     // Load the content
     const content = await loadSectionContent(file);
     
     // Re-query elements after async operation - DOM might have changed
     // Find the element by section ID to ensure we're updating the correct one
     const currentSectionItem = document.querySelector(`[data-section="${sectionId}"].category-section-item`);
     
     // Verify element still exists and is connected to DOM
     if (!currentSectionItem || !currentSectionItem.isConnected) {
         // Element was removed from DOM, don't update
         return;
     }
     
     // Re-query inner elements from the current element
     const currentContentInner = currentSectionItem.querySelector('.category-section-content-inner');
     const currentLoader = currentSectionItem.querySelector('.category-thumbnail-loader');
     
     // Only update if element is still in DOM and content is valid
     if (currentContentInner && content && content.trim()) {
         currentContentInner.innerHTML = content;
         if (currentLoader) {
             currentLoader.style.display = 'none';
         }
         loadedSections.add(file);
         
        // If background tab is active, add has-bg-image class directly to the section or footer
        const panel = document.getElementById('category-hover-panel');
        const activeTab = panel?.querySelector('.category-tab.active');
        if (activeTab && activeTab.dataset.tab === 'background') {
            const section = currentContentInner.querySelector('section[id^="fp-theme"]');
            const footer = currentContentInner.querySelector('footer[id^="fp-theme"]');
            if (section) {
                section.classList.add('has-bg-image');
            }
            if (footer) {
                footer.classList.add('has-bg-image');
            }
        }
     }
 }

 // Unload category section content when hidden
 function unloadCategorySectionWhenHidden(sectionItem) {
     const file = sectionItem.dataset.file;
     const isProSection = sectionItem.dataset.isPro === '1';
     const isPaidUser = editorMode === 'paid';
     
     // For pro sections with free users, we don't need to unload anything since we use thumbnails
     if (isProSection && !isPaidUser) {
         return;
     }
     
     // Only unload if element is still connected to DOM
     if (!sectionItem.isConnected) {
         // Element already removed, just clear from loadedSections
         if (loadedSections.has(file)) {
             loadedSections.delete(file);
         }
         return;
     }
     
     const contentInner = sectionItem.querySelector('.category-section-content-inner');
     const loader = sectionItem.querySelector('.category-thumbnail-loader');
     
     // Unload when section goes out of view
     if (loadedSections.has(file)) {
         if (contentInner) {
             contentInner.innerHTML = '';
         }
         if (loader) {
             loader.style.display = 'flex';
         }
         loadedSections.delete(file);
     }
 }

 // Setup intersection observer for category sections
 function setupCategorySectionObserver() {
     const options = {
         root: document.getElementById('category-sections-grid'),
         rootMargin: '200px',
         threshold: 0
     };

     const categoryObserver = new IntersectionObserver((entries) => {
         entries.forEach(entry => {
             if (entry.isIntersecting) {
                 loadCategorySectionWhenVisible(entry.target);
             } else {
                 unloadCategorySectionWhenHidden(entry.target);
             }
         });
     }, options);

     return categoryObserver;
 }

 // Muestra el panel de templates por estilo (estética)
 function showStylePanel(styleKey) {
     const panel = document.getElementById('category-hover-panel');
     const headerTitle = panel.querySelector('.category-hover-panel-title');
     const sectionsGrid = document.getElementById('category-sections-grid');
     const styleData = templateStyles[styleKey];
     if (!styleData) return;
     
     const isSameCategory = currentCategoryKey === styleKey;
     if (currentCategoryKey && !isSameCategory) {
         categoryScrollPositions = {};
         // [DISABLED_FOR_WEDDING_VERSION]: Color filter reset removed.
         // if (window.ColorFilter) {
         //     window.ColorFilter.clearFilterSilent();
         // }
     }
     
     panel.dataset.searchMode = 'false';
     panel.classList.add('template-mode');
     
     headerTitle.innerHTML = `
         <span class="category-hover-panel-title-emoji">${styleData.icon}</span>
         <span>${styleData.name}</span>
     `;
     
     cleanupTemplatePreviewIframe();
     sectionsGrid.innerHTML = '';
     sectionsGrid.classList.remove('template-preview-full-wrap');
     sectionsGrid.classList.add('template-cards-grid');
     sectionsGrid.classList.remove('category-sections-grid');
     
    // [DISABLED_FOR_WEDDING_VERSION]: Color filter per category removed.
    // const activeColors = window.ColorFilter ? window.ColorFilter.getSelectedColors() : [];
    // const filteredByColor = activeColors.length === 0
    //     ? baseTemplates
    //     : baseTemplates.filter(t => activeColors.includes(t.colorCategory));
    const baseTemplates = styleData.templates || [];
    const templates = baseTemplates;

         if (templates.length === 0) {
            const emptyMsg = activeColors.length > 0
                ? '<p>No templates found with that color in this style.</p><p class="template-cards-empty-hint">Try selecting another color or clear the filter.</p>'
                : '<p>Templates in this style coming soon.</p><p class="template-cards-empty-hint">When you add a complete template, it will appear here.</p>';
            sectionsGrid.innerHTML = `<div class="template-cards-empty">${emptyMsg}</div>`;
        } else {
         templates.forEach(template => {
             const cardHtml = createTemplateCard(template, styleKey);
             sectionsGrid.insertAdjacentHTML('beforeend', cardHtml);
         });
         attachTemplateCardHoverScroll(sectionsGrid);
     }
     
     if (isSameCategory && categoryScrollPositions[styleKey] !== undefined) {
         setTimeout(() => { sectionsGrid.scrollTop = categoryScrollPositions[styleKey]; }, 0);
     } else {
         sectionsGrid.scrollTop = 0;
     }
     
     currentCategoryKey = styleKey;
     panel.classList.add('show');
     closeThemePanel();
 }

 // Panel de categorías por secciones (usado por búsqueda y otros flujos)
 function showCategoryPanel(categoryKey, category) {
     const panel = document.getElementById('category-hover-panel');
     const headerTitle = panel.querySelector('.category-hover-panel-title');
     const sectionsGrid = document.getElementById('category-sections-grid');
     
     panel.classList.remove('template-mode');
     sectionsGrid.classList.remove('template-cards-grid');
     sectionsGrid.classList.add('category-sections-grid');
     
     const isSameCategory = currentCategoryKey === categoryKey;
     if (currentCategoryKey && !isSameCategory) {
         categoryScrollPositions = {};
     }
     
     panel.dataset.searchMode = 'false';
     
     headerTitle.innerHTML = `
         <i data-lucide="${category.icon}"></i>
         <span>${category.name}</span>
     `;
     
     sectionsGrid.innerHTML = '';
     category.sections.forEach(section => {
         const sectionElement = createCategorySectionItem(section);
         sectionsGrid.insertAdjacentHTML('beforeend', sectionElement);
     });
     
     if (isSameCategory && categoryScrollPositions[categoryKey] !== undefined) {
         setTimeout(() => { sectionsGrid.scrollTop = categoryScrollPositions[categoryKey]; }, 0);
     } else {
         sectionsGrid.scrollTop = 0;
     }
     
     currentCategoryKey = categoryKey;
     panel.classList.add('show');
     closeThemePanel();
     
     const categoryObserver = setupCategorySectionObserver();
     sectionsGrid.querySelectorAll('.category-section-item').forEach(item => {
         categoryObserver.observe(item);
     });
     lucide.createIcons();
 }

 // Toggle sidebar toggle visibility
function toggleSidebarVisibility(hide = true) {
    console.warn({toggleSidebarVisibility, hide});
    const sidebarToggle = document.getElementById('toggle-sidebar');
    if (!sidebarToggle) return;
    if (hide) {
        console.log("hide");
        sidebarToggle.classList.add('invisible');
    } else {
        console.log("show");
        sidebarToggle.classList.remove('invisible');
    }
}

 // Habilitar panel de temas (selector de skin/theme en sidebar)
 const THEMES_SELECTOR_ENABLED = true;

 // Open theme panel
 function openThemePanel() {
     if (!THEMES_SELECTOR_ENABLED) return;
     const panel = document.getElementById('theme-panel');
     if (panel) {
         panel.classList.add('show');
         hideCategoryPanel();
         window.HeaderModal?.close();
     }
     const topbarThemeBtn = document.getElementById('topbar-theme-btn');
     if (topbarThemeBtn) topbarThemeBtn.classList.add('active');
     document.body.classList.add('theme-panel-open');
 }

 // Close theme panel
 function closeThemePanel() {
     const panel = document.getElementById('theme-panel');
     if (panel) {
         panel.classList.remove('show');
     }
     const topbarThemeBtn = document.getElementById('topbar-theme-btn');
     if (topbarThemeBtn) topbarThemeBtn.classList.remove('active');
     document.body.classList.remove('theme-panel-open');
 }

 // Hide category hover panel
 function hideCategoryPanel() {
     const panel = document.getElementById('category-hover-panel');
     if (panel) {
         console.log("hiding panel..");
         
         // Save scroll position for current category
         if (currentCategoryKey) {
             const sectionsGrid = document.getElementById('category-sections-grid');
             categoryScrollPositions[currentCategoryKey] = sectionsGrid.scrollTop;
         }
         
         // Clear search mode flag
         panel.dataset.searchMode = 'false';
         
         cleanupTemplatePreviewIframe();
         
         // Hide panel
         panel.classList.remove('show');
         
         // Show sidebar toggle again
         toggleSidebarVisibility(false);
     } 
 }

 // Reset current category (used by search)
 window.resetCurrentCategory = function() {
     currentCategoryKey = null;
     categoryScrollPositions = {};
 };

 // Crea la tarjeta de un template (ratio 2:3). Imagen generada por template-screenshot-generator.cjs; lazy load; scroll suave al hover.
 function createTemplateCard(template, styleKey) {
     const id = template.id || `t-${styleKey}-${Math.random().toString(36).slice(2, 9)}`;
     const name = template.name || 'Template';
    const previewSrc = template.id ? `templates/previews/template${template.id}.jpg` : '';
     const innerContent = previewSrc
        ? `<img src="${previewSrc}" loading="lazy" alt="${name}" class="template-card-preview-img" onerror="this.onerror=null;this.src='templates/previews/${template.id}.jpg';" />`
         : `
             <div class="template-card-placeholder">
                 <span class="template-card-placeholder-label">Vista previa</span>
                 <p>Ejecuta <code>npm run templates:screenshots</code> para generar la imagen.</p>
                 <p class="template-card-placeholder-hint">Pasa el ratón para scroll</p>
             </div>
         `;
     return `
         <div class="template-card" data-template-id="${id}" data-style="${styleKey}">
             <div class="template-card-preview">
                 <div class="template-card-preview-inner">
                     ${innerContent}
                 </div>
             </div>
             <div class="template-card-overlay">
                 <span class="template-card-name">${name}</span>
                 <button class="template-card-add-button" type="button" aria-label="Usar template">+</button>
             </div>
         </div>
     `;
 }

 // Añade la lógica de scroll suave al hover (imagen generada o placeholder): transform del inner.
 window.createTemplateCard = createTemplateCard;
 function attachTemplateCardHoverScroll(container) {
     if (!container) return;
     const cards = container.querySelectorAll('.template-card');
     const SCROLL_DURATION_MS = 6000;
     cards.forEach(card => {
         const preview = card.querySelector('.template-card-preview');
         const inner = card.querySelector('.template-card-preview-inner');
         if (!preview || !inner) return;
         let animId = null;
         let startTime = null;
         function runTransformScroll(timestamp) {
             if (!startTime) startTime = timestamp;
             const elapsed = timestamp - startTime;
             const progress = Math.min(elapsed / SCROLL_DURATION_MS, 1);
             const easeProgress = 1 - Math.pow(1 - progress, 1.5);
             const previewHeight = preview.clientHeight;
             const innerHeight = inner.scrollHeight;
             const maxScroll = Math.max(0, innerHeight - previewHeight);
             inner.style.transform = `translateY(${-maxScroll * easeProgress}px)`;
             if (progress < 1) animId = requestAnimationFrame(runTransformScroll);
         }
         function startScroll() {
             if (animId) cancelAnimationFrame(animId);
             startTime = null;
             animId = requestAnimationFrame(runTransformScroll);
         }
         function stopScroll() {
             if (animId) {
                 cancelAnimationFrame(animId);
                 animId = null;
             }
             inner.style.transform = '';
         }
         card.addEventListener('mouseenter', startScroll);
         card.addEventListener('mouseleave', stopScroll);
     });
 }
 window.attachTemplateCardHoverScroll = attachTemplateCardHoverScroll;

function cleanupTemplatePreviewIframe() {
    const grid = document.getElementById('category-sections-grid');
    if (!grid) return;
    const iframe = grid.querySelector('.template-preview-full-iframe');
    if (iframe) {
        iframe.src = 'about:blank';
        iframe.remove();
    }
}

function showTemplatePreviewFull(sectionsGrid, styleKey, template) {
    cleanupTemplatePreviewIframe();
    const panel = document.getElementById('category-hover-panel');
    const headerTitle = panel.querySelector('.category-hover-panel-title');
    headerTitle.innerHTML = '<span class="template-preview-full-back" role="button" tabindex="0">← Volver</span><span class="template-preview-full-title-center"><button type="button" class="template-preview-use-btn">Apply Template</button></span><span class="template-preview-full-title-spacer"></span>';
    sectionsGrid.classList.remove('template-cards-grid');
    sectionsGrid.classList.add('template-preview-full-wrap');

    if (template.url) {
        sectionsGrid.innerHTML = '<div class="template-preview-full-inner">' +
            '<iframe src="' + template.url + '" class="template-preview-full-iframe" title="' + (template.name || 'Template') + '"></iframe>' +
            '</div>';
    } else {
        sectionsGrid.innerHTML = '<div class="template-preview-full-inner">' +
            '<div class="template-card-placeholder template-preview-full-placeholder"><p>No preview available.</p></div>' +
            '</div>';
    }
    sectionsGrid.scrollTop = 0;

    // Pre-select the template's default theme in the Themes panel (without creating a history entry)
    const themeBeforePreview = currentTheme;
    if (template.defaultTheme && typeof selectTheme === 'function') {
        suppressThemeHistory = true;
        try {
            selectTheme(template.defaultTheme, true);
        } finally {
            suppressThemeHistory = false;
        }
    }

    const backEl = headerTitle.querySelector('.template-preview-full-back');
    if (backEl) {
        const goBack = function () {
            // Restore the theme that was active before opening this template preview
            if (typeof selectTheme === 'function') {
                suppressThemeHistory = true;
                try {
                    if (themeBeforePreview) {
                        selectTheme(themeBeforePreview, true);
                    } else {
                        // No theme was active — clear the active highlight from all theme cards
                        document.querySelectorAll('.theme-card').forEach(card => card.classList.remove('active'));
                        currentTheme = null;
                    }
                } finally {
                    suppressThemeHistory = false;
                }
            }
            showStylePanel(styleKey);
        };
        backEl.addEventListener('click', goBack);
        backEl.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); goBack(); } });
    }
    const useBtn = headerTitle.querySelector('.template-preview-use-btn');
    if (useBtn && template.url) {
        useBtn.addEventListener('click', () => { insertFullTemplateIntoPreview(template); hideCategoryPanel(); });
        useBtn.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); insertFullTemplateIntoPreview(template); hideCategoryPanel(); }
        });
    }
}

 // Create category section item
 function createCategorySectionItem(section) {
     const isProSection = section.is_pro === 1;
     const isPaidUser = editorMode === 'paid';
     
     // Check if background tab is active
     const panel = document.getElementById('category-hover-panel');
     const activeTab = panel?.querySelector('.category-tab.active');
     const isBackgroundTab = activeTab && activeTab.dataset.tab === 'background';
     
     const sectionId = section.id;
     // Use -bg suffix if background tab is active and user is not paid
     const imageSuffix = (isProSection && !isPaidUser && isBackgroundTab) ? '-bg' : '';
     
     return `
         <div class="category-section-item ${isProSection ? 'pro-section' : ''} ${isProSection && isPaidUser ? 'paid-user' : ''}" data-section="${sectionId}" data-file="${section.file}" data-is-pro="${section.is_pro}">
             <div class="category-section-number">${sectionId}</div>
             <div class="category-section-content">
                 ${isProSection && !isPaidUser ? 
                     `<div class="category-thumbnail-loader"></div>
                      <div class="category-section-content-inner @container">
                         <img src="screenshots/${sectionId}${imageSuffix}.jpg" alt="${section.name}" class="section-thumbnail" onload="this.closest('.category-section-content').querySelector('.category-thumbnail-loader').style.display='none';" onerror="this.style.display='none';">
                      </div>` 
                     : 
                     `<div class="category-thumbnail-loader"></div>
                      <div class="category-section-content-inner @container"></div>`
                 }
             </div>
             <div class="category-section-overlay">
                 <button class="category-section-add-button" style="display: ${isProSection && !isPaidUser ? 'none' : 'flex'};">+</button>
             </div>
             ${isProSection && !isPaidUser ? '<div class="category-section-lock" data-tippy-content="Premium section - Upgrade to PRO to unlock"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-lock-icon lucide-lock"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>' : ''}
         </div>
     `;
 }

 // Toggle section selection
 function toggleSectionSelection(sectionItem, number) {
     const section = sections.find(s => s.id === number);
     const isProSection = section && section.is_pro === 1;
     const isPaidUser = editorMode === 'paid';
     
    // [DISABLED_FOR_WEDDING_VERSION]: Upgrade modal on PRO section click removed — modal only
    // appears during onboarding. Pro sections are silently blocked for non-paid users.
    if (isProSection && !isPaidUser) {
        // showUpgradeModal();
        return;
    }
     
     if (selectedSections.has(number)) {
         // Remove from selection
         selectedSections.delete(number);
         sectionItem.classList.remove('selected');
         removeSectionFromPreview(number);
     } else {
         // Add to selection
         selectedSections.add(number);
         sectionItem.classList.add('selected');
         addSectionToPreview(number, {
             selectionStateOnExecute: true,
             selectionStateOnUndo: false
         });
     }
     
     updateSectionCounter();
     
     // Update AI chat visibility
     if (typeof window.AIChat !== 'undefined') {
         window.AIChat.updateVisibility();
     }
     if (typeof window.Onboarding !== 'undefined') {
         window.Onboarding.checkVisibility();
     }
 }
 
 // Expose functions globally for dev.js and AI chat
 window.toggleSectionSelection = toggleSectionSelection;
 window.selectedSections = selectedSections;
    // Expose currentTemplateUrl for Onboarding (template-first paradigm: empty = no template)
    Object.defineProperty(window, 'currentTemplateUrl', {
        get: function() { return currentTemplateUrl; },
        set: function(v) { currentTemplateUrl = v; },
        configurable: true
    });
 window.addSectionToPreview = addSectionToPreview;
 window.initTinyMCEForSection = initTinyMCEForSection;
 window.sections = sections;
 window.updateSectionCounter = updateSectionCounter;
window.openThemePanel = openThemePanel;
window.showCategoryPanel = showCategoryPanel;

 // Add section to preview
 async function addSectionToPreview(sectionNumber, options = {}) {
     if (typeof options === 'boolean') {
         options = { skipTinyMCE: options };
     }
     const section = sections.find(s => s.id === sectionNumber);
     
     // Load the actual section content
     try {
         // Load full HTML from /sections using the real file name
         const response = await fetch(`sections/${section.file}`);
         const content = await response.text();
         const tempDiv = document.createElement('div');
         tempDiv.innerHTML = content;
         const sectionElement = tempDiv.querySelector('section') || tempDiv.querySelector('footer');
         
        if (sectionElement) {
            // If background tab is active, add has-bg-image class to the section or footer
            const panel = document.getElementById('category-hover-panel');
            const activeTab = panel?.querySelector('.category-tab.active');
            if (activeTab && activeTab.dataset.tab === 'background') {
                sectionElement.classList.add('has-bg-image');
            }
             
             const insertIndex = options.insertIndex ?? null;
             const skipScroll = options.skipScroll ?? false;
             const selectionStateOnExecute = options.selectionStateOnExecute ?? true;
             const selectionStateOnUndo = options.selectionStateOnUndo ?? false;
             
             if (historyManager && typeof SectionAddCommand !== 'undefined') {
                 const addCommand = new SectionAddCommand({
                     sectionNumber,
                     html: sectionElement.outerHTML,
                     insertIndex,
                     options: {
                         selectionStateOnExecute,
                         selectionStateOnUndo,
                         skipScroll
                     },
                     context: sectionCommandHelpers
                 });
                 historyManager.executeCommand(addCommand);
             } else {
                 sectionCommandHelpers.applySelectionState(sectionNumber, selectionStateOnExecute);
                 sectionCommandHelpers.addSection({
                     sectionNumber,
                     html: sectionElement.outerHTML,
                     insertIndex,
                     skipTinyMCE: options.skipTinyMCE ?? false,
                     skipScroll
                 });
                 if (typeof scheduleAutosave === 'function') {
                     scheduleAutosave();
                 }
             }
         }
     } catch (error) {
         console.error('Error loading section content:', error);
     }
 }
 
 // Initialize TinyMCE for a section after text updates
 function initTinyMCEForSection(sectionNumber) {
     const iframe = document.getElementById('preview-iframe');
     if (iframe && iframe.contentWindow) {
         iframe.contentWindow.postMessage({
             type: 'INIT_TINYMCE_FOR_SECTION',
             data: {
                 sectionNumber: sectionNumber
             }
         }, '*');
     }
 }

 // Remove section from preview
 function removeSectionFromPreview(sectionNumber) {
     const sectionElement = document.querySelector(`#preview-content [data-section="${sectionNumber}"]`);
     if (sectionElement) {
         sectionElement.remove();
     }
 }

 // Remove section (called from menu) - LEGACY, not currently used
 // Removal now happens via iframe button -> SECTION_REMOVED message -> SectionRemoveCommand
 function removeSection(sectionNumber) {
     selectedSections.delete(sectionNumber);
     const sectionItem = document.querySelector(`.section-item[data-section="${sectionNumber}"]`);
     if (sectionItem) {
         sectionItem.classList.remove('selected');
     }
     
     // Send message to iframe
     const iframe = document.getElementById('preview-iframe');
     iframe.contentWindow.postMessage({
         type: 'REMOVE_SECTION',
         data: { sectionNumber }
     }, '*');
     
     updateSectionCounter();
     
     // Update AI chat visibility
     if (typeof window.AIChat !== 'undefined') {
         window.AIChat.updateVisibility();
     }
     if (typeof window.Onboarding !== 'undefined') {
         window.Onboarding.checkVisibility();
     }
     
     // Note: History is now handled by SectionRemoveCommand
     // Autosave is triggered by executeCommand in history-manager
 }

 // Clone section
 function cloneSection(sectionNumber) {
     const section = sections.find(s => s.id === sectionNumber);
     if (section) {
         // Add to selected sections
         selectedSections.add(sectionNumber);
         const thumbnailItem = document.querySelector(`[data-screenshot="${sectionNumber}"]`);
         if (thumbnailItem) {
             thumbnailItem.classList.add('selected');
         }
         // Add to preview
         addSectionToPreview(sectionNumber, {
              selectionStateOnExecute: true,
             selectionStateOnUndo: false
         });
         updateSectionCounter();
         
         // Note: saveHistory is called in addSectionToPreview, so no need to call it here
     }
 }

 // Move section up in preview - LEGACY, not currently used
 // Movement now happens via iframe button -> SECTION_MOVED message -> SectionMoveCommand
 function moveSectionUp(sectionNumber) {
     const iframe = document.getElementById('preview-iframe');
     iframe.contentWindow.postMessage({
         type: 'MOVE_SECTION',
         data: { sectionNumber, direction: 'up' }
     }, '*');
     
     // Note: History is now handled by SectionMoveCommand
     // Autosave is triggered by executeCommand in history-manager
 }

 // Move section down in preview - LEGACY, not currently used
 // Movement now happens via iframe button -> SECTION_MOVED message -> SectionMoveCommand
 function moveSectionDown(sectionNumber) {
     const iframe = document.getElementById('preview-iframe');
     iframe.contentWindow.postMessage({
         type: 'MOVE_SECTION',
         data: { sectionNumber, direction: 'down' }
     }, '*');
     
     // Note: History is now handled by SectionMoveCommand
     // Autosave is triggered by executeCommand in history-manager
 }

 // Update section counter
 function updateSectionCounter() {
     const counter = document.getElementById('section-count');
     if (counter) {
         counter.textContent = selectedSections.size;
     }

     // Enable/disable preview button based on section count
     const previewBtn = document.getElementById('preview-fullscreen');
     if (previewBtn) {
         if (selectedSections.size === 0) {
             previewBtn.disabled = true;
         } else {
             previewBtn.disabled = false;
         }
     }

     // Enable/disable share button based on section count
     const shareBtn = document.getElementById('share-page');
     if (shareBtn) {
         if (selectedSections.size === 0) {
             shareBtn.disabled = true;
         } else {
             shareBtn.disabled = false;
         }
     }

     // Enable/disable download button based on section count
     const downloadBtn = document.getElementById('download-page');
     if (downloadBtn) {
         if (selectedSections.size === 0) {
             downloadBtn.disabled = true;
         } else {
             downloadBtn.disabled = false;
         }
     }

    // Enable/disable section outline toggle button based on section count
    const outlineToggle = document.querySelector('.section-outline-toggle');
    if (outlineToggle) {
        if (selectedSections.size === 0) {
            outlineToggle.disabled = true;
        } else {
            outlineToggle.disabled = false;
        }
    }

    // Enable/disable viewport buttons (mobile, tablet, desktop) when no template selected (onboarding)
    const viewportBtns = document.querySelectorAll('.viewport-btn');
    viewportBtns.forEach(function(btn) {
        btn.disabled = selectedSections.size === 0;
    });

    // Enable/disable topbar theme button
    const topbarThemeBtn = document.getElementById('topbar-theme-btn');
    if (topbarThemeBtn) {
        topbarThemeBtn.disabled = selectedSections.size === 0;
    }
}
 
 /**
 * Sincroniza selectedSections con las secciones que hay en el iframe (#preview-content section, footer).
 * Necesario para templates completos: las secciones están en el DOM del iframe pero no en selectedSections,
 * por eso el botón del layout quedaba deshabilitado. Tras esta sync, updateSectionCounter() habilita el botón.
 */
function syncSelectedSectionsFromIframe() {
    const iframe = document.getElementById('preview-iframe');
    if (!iframe || !iframe.contentDocument) return;
    const doc = iframe.contentDocument;
    const sections = doc.querySelectorAll('#preview-content section, #preview-content footer');
    selectedSections.clear();
    sections.forEach((el, index) => {
        const num = el.getAttribute('data-section') || String(index + 1);
        const n = parseInt(num, 10);
        if (!isNaN(n)) selectedSections.add(n);
    });
}

// Update section count (called from iframe)
 function updateSectionCount() {
     updateSectionCounter();
 }

 // Clear all sections
 function clearAllSections() {
     selectedSections.clear();
     document.querySelectorAll('.section-item, .category-section-item').forEach(item => {
         item.classList.remove('selected');
     });

     // Remove header if present
     if (window.HeaderModal) {
         window.HeaderModal.remove();
     }

     // Send message to iframe
     const iframe = document.getElementById('preview-iframe');
     iframe.contentWindow.postMessage({
         type: 'CLEAR_ALL',
         data: {}
     }, '*');

     updateSectionCounter();
     
     // Update AI chat visibility
     if (typeof window.AIChat !== 'undefined') {
         window.AIChat.updateVisibility();
     }
     if (typeof window.Onboarding !== 'undefined') {
         window.Onboarding.checkVisibility();
     }
     
     // Update outline - clear all sections from outline
     if (typeof window.sectionOutline !== 'undefined') {
         setTimeout(() => {
             window.sectionOutline.refresh();
         }, 100);
     }
     
             // Save history
             if (historyManager) historyManager.save();
             
             // Schedule autosave
             scheduleAutosave();
 }

// Show "Your Pages" button only when onboarding is visible AND user has pages
function updateViewPagesBtnVisibility() {
    const btn = document.getElementById('view-pages-btn');
    if (!btn) return;
    const shouldShow = window._userHasPages && window.isOnboardingMode;
    btn.style.display = shouldShow ? '' : 'none';
    if (shouldShow && typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
}
window.updateViewPagesBtnVisibility = updateViewPagesBtnVisibility;

// Top-bar "Pages" (files) icon no longer used in editor — pages are opened via the left sidebar toggle only.
function updateTopbarFilesBtnVisibility() {
    const btn = document.getElementById('topbar-files-btn');
    if (!btn) return;
    btn.style.display = 'none';
}
window.updateTopbarFilesBtnVisibility = updateTopbarFilesBtnVisibility;

// Toggle sidebar (pages list sidebar)
function toggleSidebar() {
    sidebarCollapsed = !sidebarCollapsed;
    const sidebar = document.querySelector('.sidebar');

    // [DISABLED_FOR_WEDDING_VERSION]: Sidebar now overlays editor — editorLayout/topBar no longer manipulated
    // const editorLayout = document.querySelector('.editor-layout');
    // const topBar = document.querySelector('.top-bar');
    // const toggleButton = document.getElementById('toggle-sidebar');
    // if (!toggleButton) return;
    // const icon = toggleButton.querySelector('i');

    if (sidebarCollapsed) {
        if (sidebar) sidebar.classList.add('collapsed');
        // [DISABLED_FOR_WEDDING_VERSION]: No longer needed with overlay approach
        // if (editorLayout) editorLayout.classList.add('collapsed');
        // if (topBar) topBar.classList.add('sidebar-collapsed');
        // toggleButton.classList.add('collapsed');
        // if (icon) icon.setAttribute('data-lucide', 'globe');
    } else {
        if (sidebar) {
            sidebar.classList.remove('collapsed');
            sidebar.classList.add('sidebar-ready');
        }
        // [DISABLED_FOR_WEDDING_VERSION]: No longer needed with overlay approach
        // if (editorLayout) { editorLayout.classList.remove('collapsed'); editorLayout.classList.add('sidebar-ready'); }
        // if (topBar) { topBar.classList.remove('sidebar-collapsed'); topBar.classList.add('sidebar-ready'); }
        // toggleButton.classList.remove('collapsed');
        // toggleButton.classList.add('sidebar-ready');
        // if (icon) icon.setAttribute('data-lucide', 'globe');
        // Refresh the pages list when opening the sidebar
        fetchAndRenderPagesList();
    }

    lucide.createIcons();
}

 // Switch viewport
 function switchViewport(viewport) {
     currentViewport = viewport;
     const viewportButtons = document.querySelectorAll('.viewport-btn');
     const iframe = document.getElementById('preview-iframe');
     
     // Update active button
     viewportButtons.forEach(btn => {
         btn.classList.remove('active');
     });
     document.querySelector(`[data-viewport="${viewport}"]`).classList.add('active');
     
     // Resize iframe based on viewport
     if (viewport === 'mobile') {
         iframe.style.width = '375px';
         iframe.style.height = '667px';
         iframe.style.margin = '0 auto';
         iframe.style.display = 'block';
         iframe.style.border = '2px solid #e5e7eb';
         iframe.style.borderRadius = '20px';
         iframe.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.1)';
     } else if (viewport === 'tablet') {
         iframe.style.width = '768px';
         iframe.style.height = '1024px';
         iframe.style.margin = '0 auto';
         iframe.style.display = 'block';
         iframe.style.border = '2px solid #e5e7eb';
         iframe.style.borderRadius = '12px';
         iframe.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.1)';
     } else { // desktop
         iframe.style.width = '100%';
         iframe.style.height = '100%';
         iframe.style.margin = '0';
         iframe.style.border = 'none';
         iframe.style.borderRadius = '0';
         iframe.style.boxShadow = 'none';
     }
     
     // Send viewport to iframe
     iframe.contentWindow.postMessage({
         type: 'SET_VIEWPORT',
         data: { viewport }
     }, '*');
 }

 // Toggle animations
 // Note: These settings only affect the full-screen preview, not the editor view
 function toggleAnimations() {
     animationsEnabled = !animationsEnabled;
     
     console.log('Animations toggled (for full-screen preview only):', animationsEnabled);
     
     // No need to send to iframe - this only affects full-screen preview generation
     
     // Schedule autosave
     scheduleAutosave();
 }

 // Toggle background animations
 // Note: These settings only affect the full-screen preview, not the editor view
 function toggleAnimateBackgrounds() {
     animateBackgroundsEnabled = !animateBackgroundsEnabled;
     
     console.log('Background animations toggled (for full-screen preview only):', animateBackgroundsEnabled);
     
     // No need to send to iframe - this only affects full-screen preview generation
     
     // Schedule autosave
     scheduleAutosave();
 }

 // Toggle fullPage.js
 // Note: These settings only affect the full-screen preview, not the editor view
 function toggleFullPage() {
     const beforeEnabled = window.fullpageEnabled;
     // Read the checkbox's NEW state (user just clicked it, so use its current value)
     const fullpageToggle = document.getElementById('fullpage-toggle');
     const afterEnabled = fullpageToggle ? fullpageToggle.checked : !window.fullpageEnabled;

     console.log('FullPage.js toggled (for full-screen preview only):', afterEnabled);
     
     // Create and execute command for history
     if (historyManager && typeof FullpageToggleCommand !== 'undefined') {
         const command = new FullpageToggleCommand({
             beforeEnabled,
             afterEnabled
         });
         historyManager.executeCommand(command);
     } else {
         // Fallback if command not available
         window.fullpageEnabled = afterEnabled;

         // Update UI
         const fullpageToggle = document.getElementById('fullpage-toggle');
         if (fullpageToggle) {
             fullpageToggle.checked = window.fullpageEnabled;
         }
         
         // Show/hide advanced settings button
         const advancedSettings = document.getElementById('fullpage-advanced-settings');
         if (advancedSettings) {
             if (window.fullpageEnabled) {
                 advancedSettings.classList.remove('hidden');
             } else {
                 advancedSettings.classList.add('hidden');
                 const advancedModal = document.getElementById('fullpage-advanced-modal');
                 if (advancedModal) {
                     advancedModal.classList.remove('show');
                 }
             }
         }
         
         // Schedule autosave
         scheduleAutosave();
     }
 }
 
 // Update fullPage.js settings
 function updateFullpageSettings() {
     const scrollSpeed = parseInt(document.getElementById('fullpage-scroll-speed')?.value || '700', 10);
     const navigation = document.getElementById('fullpage-navigation')?.checked || false;
     const navigationColor = document.getElementById('fullpage-navigation-color')?.value || '#333333';
     const disableOnMobile = document.getElementById('fullpage-disable-mobile')?.checked || false;
     const scrollBar = document.getElementById('fullpage-scrollbar')?.checked || false;
     const motionFeel = document.getElementById('fullpage-motion-feel')?.value || 'smooth';
     
     fullpageSettings = {
         scrollSpeed,
         navigation,
         navigationColor,
         disableOnMobile,
         scrollBar,
         motionFeel
     };
     
     // Note: History saves are handled by individual event handlers
     // This prevents duplicate saves and allows for better control (e.g., blur events for color picker)
     
     // Schedule autosave
     scheduleAutosave();
 }

 // Handle ESC key to exit fullscreen
 function handleEscKey(event) {
     if (event.key === 'Escape' && window.fullscreenMode) {
         toggleFullscreenPreview();
     }
 }

 // Toggle full-screen preview
 async function toggleFullscreenPreview() {
     window.fullscreenMode = !window.fullscreenMode;

     const editorLayout = document.querySelector('.editor-layout');
     const topBar = document.querySelector('.top-bar');
     const closeBtn = document.getElementById('close-fullscreen');
     const iframe = document.getElementById('preview-iframe');

    if (window.fullscreenMode) {
        // Enter full-screen mode
        editorLayout.classList.add('fullscreen');
        document.body.classList.add('fullscreen');
        topBar.classList.add('fullscreen');
        closeBtn.style.display = 'flex';
         
         // Recreate icons for the close button
         lucide.createIcons();
         
         // Wait for iframe to be ready before sending fullscreen message
         // Uses previewReady flag which is set when iframe sends PREVIEW_READY message
         // This is more reliable than just checking document.readyState
         const waitForIframeReady = () => {
             return new Promise((resolve) => {
                 // If preview already signaled ready, resolve immediately
                 if (previewReady) {
                     console.log('[App] Preview already ready, proceeding with fullscreen');
                     resolve();
                     return;
                 }
                 
                 // Otherwise wait for PREVIEW_READY message
                 console.log('[App] Waiting for preview iframe to be ready...');
                 const checkReady = () => {
                     if (previewReady) {
                         console.log('[App] Preview became ready');
                         resolve();
                     } else {
                         // Check again in 50ms
                         setTimeout(checkReady, 50);
                     }
                 };
                 
                 // Start checking
                 checkReady();
                 
                 // Fallback timeout - don't wait forever (2 seconds max)
                 setTimeout(() => {
                     if (!previewReady) {
                         console.warn('[App] Preview ready timeout, proceeding anyway');
                     }
                     resolve();
                 }, 2000);
             });
         };
         
         await waitForIframeReady();
         
         // Send fullscreen message to iframe with toggle states.
         // [WEDDING_VERSION]: En vista previa (Preview) no se aplica fullpage.js; la previsualización es siempre scroll normal.
         iframe.contentWindow.postMessage({
             type: 'SET_FULLSCREEN',
             data: {
                 enabled: true,
                 scrollToTop: true,
                 fullpageEnabled: false,
                 fullpageSettings: fullpageSettings,
                 animationsEnabled: window.animationsEnabled,
                 animateBackgroundsEnabled: window.animateBackgroundsEnabled
             }
         }, '*');
         
         // Add ESC key listener for fullscreen mode
         document.addEventListener('keydown', handleEscKey);
    } else {
        // Exit full-screen mode
        editorLayout.classList.remove('fullscreen');
        document.body.classList.remove('fullscreen');
        topBar.classList.remove('fullscreen');
        closeBtn.style.display = 'none';
         
         // Send fullscreen message to iframe
         iframe.contentWindow.postMessage({
             type: 'SET_FULLSCREEN',
             data: { enabled: false }
         }, '*');
         
         // Remove ESC key listener
         document.removeEventListener('keydown', handleEscKey);
     }
 }

 // Show upgrade modal (using on-demand component)
 async function showUpgradeModal() {
     if (typeof upgradeModal !== 'undefined') {
         await upgradeModal.show();
     } else {
         console.error('Upgrade modal component not loaded');
     }
 }

 // Hide upgrade modal
 function hideUpgradeModal() {
     if (typeof upgradeModal !== 'undefined') {
         upgradeModal.hide();
     }
 }

 // Handle login link click
 function handleLoginClick() {
     // Redirect to login page
     window.location.href = 'auth-wall.html';
 }

// Download generated page
function downloadPage() {
     const iframe = document.getElementById('preview-iframe');
     
     // Solicitar el HTML completo del template al iframe para descarga
     iframe.contentWindow.postMessage({
         type: 'GET_TEMPLATE_DATA',
         data: {
             fullpageEnabled: fullpageEnabled,
             fullpageSettings: fullpageSettings,
             animationsEnabled: animationsEnabled,
             animateBackgroundsEnabled: animateBackgroundsEnabled
         }
     }, '*');
 }

 // Generate and download the complete page
 function generateAndDownloadPage(data) {
     const { fullHtml, theme } = data;
     
     // Create form data to send to PHP backend (use toggle states from app.php context)
     const formData = new FormData();
     formData.append('fullHtml', fullHtml || '');
     formData.append('theme', theme);
     formData.append('fullpageEnabled', fullpageEnabled);
     formData.append('fullpageSettings', JSON.stringify(fullpageSettings));
     formData.append('animationsEnabled', animationsEnabled);
     formData.append('animateBackgroundsEnabled', animateBackgroundsEnabled);
     formData.append('isPaid', serverUserData?.is_paid || false);

     // Send to PHP backend for zip generation
     fetch('download-page.php', {
         method: 'POST',
         body: formData
     })
     .then(response => response.blob())
     .then(blob => {
         // Create download link
         const url = window.URL.createObjectURL(blob);
         const a = document.createElement('a');
         a.href = url;
         
         // Determine file type based on content type
         const contentType = blob.type;
         if (contentType === 'application/zip') {
             a.download = 'generated-page.zip';
         } else {
             a.download = 'generated-page.html';
         }
         
         document.body.appendChild(a);
         a.click();
         window.URL.revokeObjectURL(url);
         document.body.removeChild(a);
     })
     .catch(error => {
         console.error('Download failed:', error);
         alert('Download failed. Please try again.');
     });
 }

 // ============================================
 // AUTOSAVE FUNCTIONALITY
 // ============================================

 // Schedule autosave with debounce
 function scheduleAutosave() {
     // Don't autosave during initialization, restoration or when clearing draft
     if (isInitializing || isRestoring || isClearingDraft) return;
     
     clearTimeout(saveTimeout);
     saveTimeout = setTimeout(async () => {
         await saveDraft();
         saveTimeout = null; // Clear the timeout after save completes
     }, 1500);
 }
 
 // Expose scheduleAutosave globally so history-manager.js can trigger it
 window.scheduleAutosave = scheduleAutosave;

 // Update save indicator UI
 function updateSaveIndicator(status) {
     const indicator = document.getElementById('save-indicator');
     if (!indicator) return;

     indicator.classList.remove('saving', 'saved', 'failed', 'visible');

     if (status === 'saving') {
         indicator.classList.add('saving', 'visible');
         indicator.querySelector('.save-indicator-text').textContent = 'Saving...';
     } else if (status === 'saved') {
         indicator.classList.add('saved', 'visible');
         indicator.querySelector('.save-indicator-text').textContent = 'Saved';
     } else if (status === 'failed') {
         indicator.classList.add('failed', 'visible');
         indicator.querySelector('.save-indicator-text').textContent = 'Save';
         // Keep it visible (don't auto-hide on error)
     }
 }

 // Handle click on save indicator to trigger immediate save
 document.addEventListener('DOMContentLoaded', function() {
     const saveIndicator = document.getElementById('save-indicator');
     if (saveIndicator) {
         saveIndicator.addEventListener('click', function() {
             // Clear any pending autosave timeout
             clearTimeout(saveTimeout);
             // Trigger save immediately
             saveDraft();
         });
     }
 });

 // Save draft to localStorage or database
 async function saveDraft() {
     if (saveInProgress) return;

     const iframe = document.getElementById('preview-iframe');
     if (!iframe || !iframe.contentWindow) return;

     saveInProgress = true;
     updateSaveIndicator('saving');

     // Generate unique request ID for this autosave request
     const requestId = 'autosave_' + Date.now() + '_' + Math.random();
     autosaveRequestId = requestId;
     
     // Request full template HTML from iframe
     const handleResponse = async (event) => {
        // Only handle if this is the response to our autosave request
        if (event.data.type === 'TEMPLATE_DATA' && event.data.requestId === requestId) {
            const { fullHtml, templateHeadHtml, theme, fullpageEnabled, animationsEnabled, animateBackgroundsEnabled: responseAnimateBackgroundsEnabled } = event.data.data;

             // Don't save if there's nothing meaningful (empty content, default settings)
             const hasContent = fullHtml && fullHtml.trim().length > 0;
             const hasChangedSettings = (fullpageEnabled === true) || (animationsEnabled === true) || (theme && theme !== 'theme-light-minimal');
             
             if (!hasContent && !hasChangedSettings) {
                 localStorage.removeItem('fp_editor_draft');
                 draftData = null;
                 window.removeEventListener('message', handleResponse);
                 saveInProgress = false;
                 autosaveRequestId = null;
                 const indicator = document.getElementById('save-indicator');
                 if (indicator) {
                     indicator.classList.remove('saving', 'saved', 'failed', 'visible');
                 }
                 console.log('Empty draft - not saving');
                 return;
             }
             
             // Validación básica del tema (el servidor hará la normalización completa)
             let sanitizedTheme = theme || currentTheme;
             if (!sanitizedTheme || typeof sanitizedTheme !== 'string') {
                 sanitizedTheme = currentTheme || '';
             }
             
             const draft = {
                 fullHtml: fullHtml || '',
                 templateHeadHtml: templateHeadHtml || '',
                 theme: sanitizedTheme,
                 fullpageEnabled: fullpageEnabled === true,
                 fullpageSettings: fullpageSettings,
                 animationsEnabled: animationsEnabled === true,
                 animateBackgroundsEnabled: animateBackgroundsEnabled === true,
                 headerConfig: window.HeaderModal ? window.HeaderModal.getConfig() : null,
                 templateUrl: currentTemplateUrl || undefined,
                 timestamp: Date.now()
             };
             
             try {
                 // Save to database with cancellation support - server will normalize the data
                 await pageManager.saveDraftToDatabaseWithCancellation(draft);
                 draftData = draft;
                 console.log('Draft saved successfully');
                 updateSaveIndicator('saved');
             } catch (e) {
                 // Don't log abort errors as they're expected when cancelling old requests
                 if (e.name === 'AbortError') {
                     // Hide save indicator when save is cancelled
                     const indicator = document.getElementById('save-indicator');
                     if (indicator) {
                         indicator.classList.remove('saving', 'saved', 'failed', 'visible');
                     }
                     return;
                 }
                 console.error('Failed to save draft:', e);

                 // Show failed state
                 updateSaveIndicator('failed');

                 // Log unexpected save errors to Sentry
                 if (typeof SentryLogger !== 'undefined') {
                     SentryLogger.error('Unexpected error saving draft', e, {
                         errorType: 'draft_save_error',
                         errorName: e.name,
                         location: 'autosave_save_draft'
                     });
                 }
             }
             
             // Remove listener after handling response
             window.removeEventListener('message', handleResponse);
             saveInProgress = false;
             autosaveRequestId = null;
         }
     };
     
     // Listen for response from iframe
     window.addEventListener('message', handleResponse);
     
     // Solicitar datos completos del template al iframe
         iframe.contentWindow.postMessage({
             type: 'GET_TEMPLATE_DATA',
             data: {
                 requestId: requestId,
                 forAutosave: true,
                 fullpageEnabled: fullpageEnabled,
                 fullpageSettings: fullpageSettings,
                 animationsEnabled: animationsEnabled
             }
         }, '*');
     
     // Timeout after 3 seconds if no response
     setTimeout(() => {
         window.removeEventListener('message', handleResponse);
         if (saveInProgress) {
             saveInProgress = false;
             autosaveRequestId = null;
             console.warn('Autosave timeout - iframe may not be ready');
         }
     }, 3000);
 }

 // ============================================
 // HISTORY MANAGER INITIALIZATION
 // ============================================
 // History manager will be initialized in DOMContentLoaded after all context functions are defined

 // Restore draft from localStorage or database
 async function restoreDraft() {
     try {
         // Use preloaded draft if we loaded it to set iframe src with template
         let draft = preloadedDraft;
         if (preloadedDraft) preloadedDraft = null;
         if (!draft) draft = await pageManager.loadDraftFromDatabase();
         if (!draft) {
             // No page found - page name already prompted earlier
             // Hide loading overlay and check onboarding visibility
             if (typeof window.Onboarding !== 'undefined') {
                 window.Onboarding.checkVisibility();
             }
             return false;
         }
         
         // Validar y normalizar estructura del draft
         // Asegurar que fullHtml sea siempre un string
         if (typeof draft.fullHtml !== 'string') {
             console.warn('fullHtml ausente o inválido en el draft, usando vacío.');
             draft.fullHtml = '';
         }
         
        // Ensure theme is always a string (not an array)
        if (draft.theme) {
            if (Array.isArray(draft.theme)) {
                console.warn('Theme is an array in draft, extracting first valid value:', draft.theme);
                draft.theme = draft.theme.find(t => typeof t === 'string' && t.trim() !== '') || '';
            } else if (typeof draft.theme !== 'string') {
                console.warn('Invalid theme in draft, discarding:', draft.theme);
                draft.theme = '';
            }
        } else {
            // No theme saved — leave empty so no theme is pre-selected on restore
            draft.theme = '';
        }
         
         draftData = draft;
         currentTemplateUrl = draft.templateUrl || null;
         
         // Wait for iframe to be ready
         const iframe = document.getElementById('preview-iframe');
         if (!iframe) return false;
         
         const waitForIframe = () => {
             return new Promise((resolve) => {
                 if (iframe.contentWindow && iframe.contentWindow.document.readyState === 'complete') {
                     resolve();
                 } else {
                     iframe.addEventListener('load', () => resolve(), { once: true });
                     // Fallback timeout
                     setTimeout(() => resolve(), 3000);
                 }
             });
         };
         
         isRestoring = true; // Set flag to prevent autosave during restoration
         
         waitForIframe().then(() => {
             // Restore theme
             if (draft.theme) {
                 // Sanitize theme in case of corrupted data
                 let sanitizedTheme = draft.theme;
                 if (typeof sanitizedTheme === 'string' && sanitizedTheme.includes(' ')) {
                     console.warn('Draft theme contains spaces, sanitizing:', sanitizedTheme);
                     sanitizedTheme = sanitizedTheme.split(' ')[0];
                 }
                 // Only set theme if it's valid
                 if (sanitizedTheme && typeof sanitizedTheme === 'string' && sanitizedTheme.trim() !== '') {
                     currentTheme = sanitizedTheme;
                     // selectTheme will check isRestoring flag internally
                     selectTheme(sanitizedTheme);
                 } else {
                     console.warn('Invalid theme in draft, skipping theme restoration:', sanitizedTheme);
                 }
             }
             
             // Restore settings
             if (draft.fullpageEnabled !== undefined) {
                 fullpageEnabled = draft.fullpageEnabled;
                 const fullpageToggle = document.getElementById('fullpage-toggle');
                 if (fullpageToggle) {
                     fullpageToggle.checked = fullpageEnabled;
                     // Show/hide advanced settings
                     const advancedSettings = document.getElementById('fullpage-advanced-settings');
                     if (advancedSettings) {
                         if (fullpageEnabled) {
                             advancedSettings.classList.remove('hidden');
                         } else {
                             advancedSettings.classList.add('hidden');
                         }
                     }
                 }
                 // Restore fullpage settings if available
                 if (draft.fullpageSettings) {
                     fullpageSettings = { ...fullpageSettings, ...draft.fullpageSettings };
                     // Restore UI values
                     const scrollSpeed = document.getElementById('fullpage-scroll-speed');
                     const scrollSpeedValue = document.getElementById('fullpage-scroll-speed-value');
                     const navigation = document.getElementById('fullpage-navigation');
                     const navigationColor = document.getElementById('fullpage-navigation-color');
                     const navigationColorValue = document.getElementById('fullpage-navigation-color-value');
                     const disableOnMobile = document.getElementById('fullpage-disable-mobile');
                     const scrollBar = document.getElementById('fullpage-scrollbar');
                     const motionFeel = document.getElementById('fullpage-motion-feel');
                     
                     if (scrollSpeed) {
                         scrollSpeed.value = fullpageSettings.scrollSpeed || 700;
                     }
                     if (scrollSpeedValue) {
                         scrollSpeedValue.textContent = (fullpageSettings.scrollSpeed || 700) + ' ms';
                     }
                     if (navigation) navigation.checked = fullpageSettings.navigation !== false;
                     if (navigationColor) navigationColor.value = fullpageSettings.navigationColor || '#333333';
                     if (navigationColorValue) navigationColorValue.textContent = fullpageSettings.navigationColor || '#333333';
                     if (disableOnMobile) disableOnMobile.checked = fullpageSettings.disableOnMobile || false;
                     if (scrollBar) scrollBar.checked = fullpageSettings.scrollBar || false;
                     if (motionFeel) motionFeel.value = fullpageSettings.motionFeel || 'smooth';
                 }
                 // No need to send to iframe - only affects full-screen preview
             }
             
             if (draft.animationsEnabled !== undefined) {
                 animationsEnabled = draft.animationsEnabled;
                 const animationToggle = document.getElementById('animation-toggle');
                 if (animationToggle) {
                     animationToggle.checked = animationsEnabled;
                 }
                 // No need to send to iframe - only affects full-screen preview
             }
             
             if (draft.animateBackgroundsEnabled !== undefined) {
                 animateBackgroundsEnabled = draft.animateBackgroundsEnabled;
                 const animateBackgroundsToggle = document.getElementById('animate-backgrounds-toggle');
                 if (animateBackgroundsToggle) {
                     animateBackgroundsToggle.checked = animateBackgroundsEnabled;
                 }
                 // No need to send to iframe - only affects full-screen preview
             }
             
             // Restaurar el contenido completo del template
             const loadingOverlay = document.getElementById('loading-overlay');
             if (loadingOverlay && loadingOverlay.classList.contains('show')) {
                 loadingOverlay.classList.remove('show');
             }

             if (draft.fullHtml && draft.fullHtml.trim().length > 0) {
                 // Restaurar el HTML completo directamente (nav, sections, footer, todo incluido)
                 iframe.contentWindow.postMessage({
                     type: 'RESTORE_TEMPLATE',
                     data: {
                         fullHtml: draft.fullHtml,
                         templateHeadHtml: draft.templateHeadHtml || '',
                         animationsEnabled: animationsEnabled
                     }
                 }, '*');
                 setTimeout(() => {
                     iframe.contentWindow.postMessage({ type: 'INIT_CLOUDINARY', data: {} }, '*');
                 }, 200);
                 if (typeof window.sectionOutline !== 'undefined') {
                     setTimeout(() => window.sectionOutline.refresh(), 300);
                 }
             } else if (draft.templateUrl) {
                 // Template cargado pero sin fullHtml guardado (primera vez) — sincronizar outline desde DOM
                 setTimeout(syncOutlineFromTemplateContent, 400);
             }

             // Restaurar config del header modal si fue guardada (el HTML ya está en fullHtml)
             if (draft.headerConfig && window.HeaderModal) {
                 window.HeaderModal.restore(draft.headerConfig);
             }

             // Reset restoration flag
             isRestoring = false;

             // Reset initialization flag to allow autosave
             isInitializing = false;

             // Update AI chat and onboarding visibility (always, regardless of sections)
             if (typeof window.AIChat !== 'undefined') {
                 window.AIChat.updateVisibility();
             }
             if (typeof window.Onboarding !== 'undefined') {
                 window.Onboarding.checkVisibility();
             }
             
             // Show recovery toast only if there was actually content or settings restored
             const hasContent = draft.fullHtml && draft.fullHtml.trim().length > 0;
             const hasSettings = (draft.fullpageEnabled !== undefined) || (draft.animationsEnabled !== undefined) || (draft.theme && draft.theme !== 'theme-light-minimal');
             
             if (draft.timestamp && (hasContent || hasSettings)) {
                 const timeAgo = getTimeAgo(draft.timestamp);
                 // showToast('Session Restored', `Your last session from ${timeAgo} was restored.`, {
                 //     duration: 1400
                 // });
             } else if (draft.timestamp && !hasSections && !hasSettings) {
                 // Empty draft - remove it silently
                 localStorage.removeItem('fp_editor_draft');
             }
         });
         
         return true;
     } catch (e) {
         console.error('Failed to restore draft:', e);
         
         // Log to Sentry
         if (typeof SentryLogger !== 'undefined') {
             SentryLogger.error('Failed to restore draft from localStorage', e, {
                 errorType: 'corrupted_draft_restore_error',
                 errorMessage: e.message,
                 location: 'restoreDraft_function'
             });
         }
         
         // Remove corrupted data
         localStorage.removeItem('fp_editor_draft');
         // Reset flags on error
         isRestoring = false;
         isInitializing = false;

         // Hide loading overlay and check onboarding visibility even on error
         if (typeof window.Onboarding !== 'undefined') {
             window.Onboarding.checkVisibility();
         }

         return false;
     }
 }

// Show confirmation popup before changing template (replaces sidebar toggle behavior)
function showChangeTemplateConfirm() {
    const existingModal = document.getElementById('change-template-confirm-modal');
    if (existingModal) existingModal.remove();

    const modalHTML = `
        <div id="change-template-confirm-modal" class="modal-overlay fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-[10000]" style="display:flex;">
            <div class="download-options-modal-content github-export-content rounded-2xl shadow-2xl max-w-lg w-full mx-4" style="background-color: var(--primary-bg, #ffffff); max-height: unset; overflow: visible;" onclick="event.stopPropagation()">
                <div class="p-8 relative">
                    <button onclick="document.getElementById('change-template-confirm-modal').remove()" aria-label="Close" class="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full transition-all hover:bg-[var(--accent-bg)] text-[var(--secondary-text)] hover:text-[var(--primary-text)]">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                    <div class="flex items-center gap-3 mb-4">
                        <div class="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                            </svg>
                        </div>
                        <h2 class="text-xl font-bold text-[var(--primary-text)] pr-8">Change Template</h2>
                    </div>
                    <p class="text-[var(--secondary-text)] text-sm leading-relaxed mb-6">
                        Changing the template means starting a new website. You will lose the changes you made in your current website.
                        <br><br>
                        <strong class="text-[var(--primary-text)]">Are you sure?</strong>
                    </p>
                    <div class="flex gap-3 justify-end">
                        <button id="change-template-cancel-btn" class="change-template-modal-cancel-btn px-5 py-2.5 text-sm font-medium rounded-xl transition-all">
                            Cancel
                        </button>
                        <button id="change-template-confirm-btn" class="change-template-modal-confirm-btn px-5 py-2.5 text-sm font-medium rounded-xl transition-all">
                            Yes, change template
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const modal = document.getElementById('change-template-confirm-modal');

    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });

    document.getElementById('change-template-cancel-btn').addEventListener('click', () => {
        modal.remove();
    });

    document.getElementById('change-template-confirm-btn').addEventListener('click', () => {
        modal.remove();
        if (typeof window.Onboarding !== 'undefined') {
            window.Onboarding.reset();
        }
        clearDraft();
    });

    const escapeHandler = (e) => {
        if (e.key === 'Escape') {
            modal.remove();
            document.removeEventListener('keydown', escapeHandler);
        }
    };
    document.addEventListener('keydown', escapeHandler);
}

// Clear draft from localStorage and clear all sections
function clearDraft() {
     // Set flag to prevent autosave from creating a new draft
     isClearingDraft = true;
     
     // Clear the draft from localStorage
     localStorage.removeItem('fp_editor_draft');
     draftData = null;
     currentTemplateUrl = null;
     
     // Clear history as well
     if (historyManager) historyManager.clear();
     
   // Reset theme (no theme pre-selected after clear)
   currentTheme = null;
   initialTheme = null;
    const themeCards = document.querySelectorAll('.theme-card');
    themeCards.forEach(card => {
        card.classList.remove('active');
    });
     
     // Apply default theme to iframe without triggering autosave
     const iframe = document.getElementById('preview-iframe');
     if (iframe && iframe.contentWindow) {
         iframe.contentWindow.postMessage({
             type: 'SET_THEME',
             data: { theme: 'theme-light-minimal' }
         }, '*');
     }
     
     // Reset settings to defaults (but don't trigger autosave)
     animationsEnabled = false;
     fullpageEnabled = false;
     fullpageSettings = {
         scrollSpeed: 700,
         navigation: true,
         navigationColor: '#333333',
         disableOnMobile: false,
         scrollBar: false,
         motionFeel: 'smooth'
     };
    const animationToggle = document.getElementById('animation-toggle');
    const fullpageToggle = document.getElementById('fullpage-toggle');
    const animateBackgroundsToggle = document.getElementById('animate-backgrounds-toggle');
    // Simplified editor defaults: animations ON, backgrounds OFF
    animationsEnabled = true;
    animateBackgroundsEnabled = false;
    if (animationToggle) animationToggle.checked = true;
    if (animateBackgroundsToggle) animateBackgroundsToggle.checked = false;
    if (fullpageToggle) {
         fullpageToggle.checked = false;
         // Hide advanced settings
         const advancedSettings = document.getElementById('fullpage-advanced-settings');
         if (advancedSettings) {
             advancedSettings.classList.add('hidden');
         }
     }
     // Reset advanced settings UI
     const scrollSpeed = document.getElementById('fullpage-scroll-speed');
     const navigation = document.getElementById('fullpage-navigation');
     const navigationColor = document.getElementById('fullpage-navigation-color');
     const navigationColorValue = document.getElementById('fullpage-navigation-color-value');
     const disableOnMobile = document.getElementById('fullpage-disable-mobile');
     const scrollBar = document.getElementById('fullpage-scrollbar');
     const motionFeel = document.getElementById('fullpage-motion-feel');
     if (scrollSpeed) {
         scrollSpeed.value = 700;
     }
     const scrollSpeedValue = document.getElementById('fullpage-scroll-speed-value');
     if (scrollSpeedValue) {
         scrollSpeedValue.textContent = '700 ms';
     }
     if (navigation) navigation.checked = true;
     if (navigationColor) navigationColor.value = '#333333';
     if (navigationColorValue) navigationColorValue.textContent = '#333333';
     if (disableOnMobile) disableOnMobile.checked = false;
     if (scrollBar) scrollBar.checked = false;
     if (motionFeel) motionFeel.value = 'smooth';
     
     // No need to send to iframe - these only affect full-screen preview
     
     // Clear all sections from the canvas (same as "Clear All" button)
     // But skip autosave/history by temporarily disabling them
     selectedSections.clear();
     document.querySelectorAll('.section-item, .category-section-item').forEach(item => {
         item.classList.remove('selected');
     });
     
     // Send message to iframe to clear sections
     if (iframe && iframe.contentWindow) {
         iframe.contentWindow.postMessage({
             type: 'CLEAR_ALL',
             data: {}
         }, '*');
     }
     
     updateSectionCounter();
     
     // Update AI chat visibility
     if (typeof window.AIChat !== 'undefined') {
         window.AIChat.updateVisibility();
     }
     if (typeof window.Onboarding !== 'undefined') {
         window.Onboarding.checkVisibility();
     }
     
     // Update outline - clear all sections from outline
     if (typeof window.sectionOutline !== 'undefined') {
         setTimeout(() => {
             window.sectionOutline.refresh();
         }, 100);
     }
     
     if (historyManager) historyManager.updateButtons();
     
     // Clear any pending autosave
     clearTimeout(saveTimeout);
     
     // Reset flag after a short delay to allow operations to complete
     setTimeout(() => {
         isClearingDraft = false;
     }, 2000);
     
     // Hide the toast
     hideToast();
 }

 // Load shared document from Supabase
 function loadSharedDocument(docId) {
     // Fetch shared document from API
     fetch('api/get.php?id=' + encodeURIComponent(docId))
         .then(response => response.json())
         .then(result => {
             if (result.error) {
                 throw new Error(result.error);
             }
             
             const sharedData = result.data;
             
             // Wait for iframe to be ready
             const iframe = document.getElementById('preview-iframe');
             if (!iframe) return;
             
             const waitForIframe = () => {
                 return new Promise((resolve) => {
                     if (iframe.contentWindow && iframe.contentWindow.document.readyState === 'complete') {
                         resolve();
                     } else {
                         iframe.addEventListener('load', () => resolve(), { once: true });
                         // Fallback timeout
                         setTimeout(() => resolve(), 3000);
                     }
                 });
             };
             
             isRestoring = true; // Set flag to prevent autosave during restoration
             
             waitForIframe().then(() => {
                 // Restore theme
                 if (sharedData.theme && typeof sharedData.theme === 'string' && sharedData.theme.trim() !== '') {
                     currentTheme = sharedData.theme;
                     selectTheme(sharedData.theme);
                 }
                 
                 // Restore settings
                 if (sharedData.fullpageEnabled !== undefined) {
                     fullpageEnabled = sharedData.fullpageEnabled;
                     const fullpageToggle = document.getElementById('fullpage-toggle');
                     if (fullpageToggle) {
                         fullpageToggle.checked = fullpageEnabled;
                         // Show/hide advanced settings
                         const advancedSettings = document.getElementById('fullpage-advanced-settings');
                         if (advancedSettings) {
                             if (fullpageEnabled) {
                                 advancedSettings.classList.remove('hidden');
                             } else {
                                 advancedSettings.classList.add('hidden');
                             }
                         }
                     }
                     // Restore fullpage settings if available
                     if (sharedData.fullpageSettings) {
                         fullpageSettings = { ...fullpageSettings, ...sharedData.fullpageSettings };
                         // Restore UI values
                         const scrollSpeed = document.getElementById('fullpage-scroll-speed');
                         const navigation = document.getElementById('fullpage-navigation');
                         const navigationColor = document.getElementById('fullpage-navigation-color');
                         const navigationColorValue = document.getElementById('fullpage-navigation-color-value');
                         const disableOnMobile = document.getElementById('fullpage-disable-mobile');
                         const scrollBar = document.getElementById('fullpage-scrollbar');
                         const motionFeel = document.getElementById('fullpage-motion-feel');
                         
                         if (scrollSpeed) {
                             scrollSpeed.value = fullpageSettings.scrollSpeed || 700;
                         }
                         const scrollSpeedValue = document.getElementById('fullpage-scroll-speed-value');
                         if (scrollSpeedValue) {
                             scrollSpeedValue.textContent = (fullpageSettings.scrollSpeed || 700) + ' ms';
                         }
                         if (navigation) navigation.checked = fullpageSettings.navigation !== false;
                         if (navigationColor) navigationColor.value = fullpageSettings.navigationColor || '#333333';
                         if (navigationColorValue) navigationColorValue.textContent = fullpageSettings.navigationColor || '#333333';
                         if (disableOnMobile) disableOnMobile.checked = fullpageSettings.disableOnMobile || false;
                         if (scrollBar) scrollBar.checked = fullpageSettings.scrollBar || false;
                         if (motionFeel) motionFeel.value = fullpageSettings.motionFeel || 'smooth';
                     }
                     // No need to send to iframe - only affects full-screen preview
                 }
                 
                 if (sharedData.animationsEnabled !== undefined) {
                     animationsEnabled = sharedData.animationsEnabled;
                     const animationToggle = document.getElementById('animation-toggle');
                     if (animationToggle) {
                         animationToggle.checked = animationsEnabled;
                     }
                     // No need to send to iframe - only affects full-screen preview
                 }
                 
                 if (sharedData.animateBackgroundsEnabled !== undefined) {
                     animateBackgroundsEnabled = sharedData.animateBackgroundsEnabled;
                     const animateBackgroundsToggle = document.getElementById('animate-backgrounds-toggle');
                     if (animateBackgroundsToggle) {
                         animateBackgroundsToggle.checked = animateBackgroundsEnabled;
                     }
                     // No need to send to iframe - only affects full-screen preview
                 }
                 
                 // Clear existing sections first
                 iframe.contentWindow.postMessage({
                     type: 'CLEAR_ALL'
                 }, '*');
                 
                 selectedSections.clear();
                 addedSections = [];
                 updateSectionCounter();
                 
                 // Restore sections
                 if (sharedData.sections && sharedData.sections.length > 0) {
                     // Wait a bit for clear to complete
                     setTimeout(() => {
                         sharedData.sections.forEach(sectionData => {
                             const sectionNumber = parseInt(sectionData.number);
                             
                             // Add to selected sections
                             selectedSections.add(sectionNumber);
                             
                             // Mark section item as selected
                             const sectionItem = document.querySelector(`.section-item[data-section="${sectionNumber}"], .category-section-item[data-section="${sectionNumber}"]`);
                             if (sectionItem) {
                                 sectionItem.classList.add('selected');
                             }
                             
                             // Send section to iframe
                             iframe.contentWindow.postMessage({
                                 type: 'ADD_SECTION',
                                 data: {
                                     sectionNumber: sectionNumber,
                                     html: sectionData.html,
                                     animationsEnabled: animationsEnabled
                                 }
                             }, '*');
                         });
                         
                         updateSectionCounter();
                         
                         // Initialize Cloudinary for shared sections
                         setTimeout(() => {
                             iframe.contentWindow.postMessage({
                                 type: 'INIT_CLOUDINARY'
                             }, '*');
                         }, 200);
                         
                         // Update outline to reflect shared sections
                         if (typeof window.sectionOutline !== 'undefined') {
                             setTimeout(() => {
                                 window.sectionOutline.refresh();
                             }, 300);
                         }
                     }, 100);
                 }
                 
                 // Reset restoration flag
                 isRestoring = false;
                 
                 // Show success message
                 showToast('Shared Page Loaded', 'The shared page has been loaded successfully.', {});
             });
         })
         .catch(error => {
             console.error('Failed to load shared document:', error);
             showToast('Load Failed', 'Unable to load the shared page. Please check the link and try again.', {});
         });
 }

 // Get human-readable time ago
 function getTimeAgo(timestamp) {
     const now = Date.now();
     const diff = now - timestamp;
     const minutes = Math.floor(diff / 60000);
     const hours = Math.floor(diff / 3600000);
     const days = Math.floor(diff / 86400000);
     
     if (days > 0) {
         return `${days} day${days > 1 ? 's' : ''} ago`;
     } else if (hours > 0) {
         return `${hours} hour${hours > 1 ? 's' : ''} ago`;
     } else if (minutes > 0) {
         return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
     } else {
         return 'just now';
     }
 }

 // Toast notification functions
 let currentToast = null;
 
 function showToast(title, message, options = {}) {
     // Remove existing toast if any
     if (currentToast) {
         hideToast();
     }
     
     const toast = document.createElement('div');
     const isCompact = !options.action && !options.onAction;
     toast.className = 'toast' + (isCompact ? ' toast--compact' : '');
     
     // Build action buttons HTML
     let actionButtonsHTML = '';
     if (options.action && options.onAction) {
         actionButtonsHTML = `
             <div class="toast-action">
                 <button class="toast-btn toast-btn-primary" data-action="ok">Dismiss</button>
                 <button class="toast-btn toast-btn-danger" data-action="confirm">${options.action}</button>
             </div>
         `;
     }
     
     const iconName = isCompact ? 'check-circle' : 'info';
     
     toast.innerHTML = `
         <i data-lucide="${iconName}" class="toast-icon"></i>
         <div class="toast-content">
             <div class="toast-title">${title}</div>
             <div class="toast-message">${message}</div>
             ${actionButtonsHTML}
         </div>
         <button class="toast-close">
             <i data-lucide="x"></i>
         </button>
     `;
     
     document.body.appendChild(toast);
     currentToast = toast;
     
     // Recreate icons
     lucide.createIcons();
     
     // Show toast
     setTimeout(() => {
         toast.classList.add('show');
     }, 10);
     
     // Close button
     toast.querySelector('.toast-close').addEventListener('click', () => {
         hideToast();
     });
     
     // OK button - just hide the toast
     const okButton = toast.querySelector('[data-action="ok"]');
     if (okButton) {
         okButton.addEventListener('click', () => {
             hideToast();
         });
     }
     
     // Action button (e.g., Clear Draft) - calls the action
     if (options.action && options.onAction) {
         const actionButton = toast.querySelector('[data-action="confirm"]');
         if (actionButton) {
             actionButton.addEventListener('click', () => {
                 options.onAction();
             });
         }
     }
     
     // Auto-hide after specified duration (unless action buttons present)
     if (!options.action) {
         const duration = options.duration || (isCompact ? 3000 : 8000);
         setTimeout(() => {
             hideToast();
         }, duration);
     }
 }
 
 function hideToast() {
     if (currentToast) {
         currentToast.classList.add('hide');
         setTimeout(() => {
             if (currentToast && currentToast.parentNode) {
                 currentToast.parentNode.removeChild(currentToast);
             }
             currentToast = null;
         }, 300);
     }
 }



 // Populate theme grid
 function populateThemeGrid() {
     const themeGrid = document.getElementById('theme-grid');
     themeGrid.innerHTML = '';
     
     // Add predefined themes
     themes.forEach(theme => {
         const themeItem = document.createElement('div');
         themeItem.className = 'theme-item';
         
         const themeCard = document.createElement('div');
         themeCard.className = 'theme-card';
         themeCard.dataset.theme = theme.id;
         
         if (theme.id === currentTheme) {
             themeCard.classList.add('active');
         }
         
         // Create color palette HTML
         const colorPalette = theme.colors.map(color => 
             `<div class="theme-preview-color" style="background-color: ${color}"></div>`
         ).join('');
         
         themeCard.innerHTML = `
             <button class="custom-theme-menu-btn" data-theme-id="${theme.id}" data-is-predefined="true">
                 <i data-lucide="more-vertical"></i>
             </button>
             <div class="custom-theme-menu" data-theme-id="${theme.id}">
                 <button class="custom-theme-menu-item" data-action="clone" data-theme-data='${JSON.stringify(theme)}'>
                     <i data-lucide="copy"></i>
                     Clone
                 </button>
             </div>
             <div class="theme-preview">
                 ${colorPalette}
             </div>
         `;
         
         const themeName = document.createElement('div');
         themeName.className = 'theme-name';
         themeName.textContent = theme.name;
         
         themeItem.addEventListener('click', (e) => {
             // Don't select theme if clicking on menu button or menu items
             if (!e.target.closest('.custom-theme-menu-btn') && !e.target.closest('.custom-theme-menu')) {
                 selectTheme(theme.id, true); // Keep panel open
             }
         });
         
         themeItem.appendChild(themeCard);
         themeItem.appendChild(themeName);
         themeGrid.appendChild(themeItem);
     });
     
     // Add custom themes using the custom theme manager
     if (typeof populateCustomThemes !== 'undefined') {
         populateCustomThemes(themeGrid, selectTheme);
     }
     
     // Add event listeners for predefined theme menu buttons
     setupThemeMenuListeners();
     
     // Recreate Lucide icons for the new elements
     if (typeof lucide !== 'undefined') {
         lucide.createIcons();
     }
 }
 
 // Setup event listeners for theme menu buttons (only for predefined themes)
 function setupThemeMenuListeners() {
     // Handle menu button clicks (3-dot button) - only for predefined themes
     document.querySelectorAll('.custom-theme-menu-btn[data-is-predefined="true"]').forEach(btn => {
         btn.addEventListener('click', (e) => {
             e.stopPropagation();
             const themeId = btn.dataset.themeId;
             const menu = document.querySelector(`.custom-theme-menu[data-theme-id="${themeId}"]`);
             
             // Close all other menus
             document.querySelectorAll('.custom-theme-menu').forEach(m => {
                 if (m !== menu) m.classList.remove('show');
             });
             
             // Toggle this menu
             menu.classList.toggle('show');
         });
     });
     
     // Handle menu item clicks for predefined themes only
     document.querySelectorAll('.custom-theme-menu-btn[data-is-predefined="true"]').forEach(btn => {
         const themeId = btn.dataset.themeId;
         const menu = document.querySelector(`.custom-theme-menu[data-theme-id="${themeId}"]`);
         const menuItems = menu.querySelectorAll('.custom-theme-menu-item');
         
         menuItems.forEach(item => {
             item.addEventListener('click', (e) => {
                 e.stopPropagation();
                 const action = item.dataset.action;
                 
                 if (action === 'clone') {
                     // Clone predefined theme
                     const themeData = JSON.parse(item.dataset.themeData);
                     clonePredefinedTheme(themeData);
                 }
                 
                 // Close menu
                 menu.classList.remove('show');
             });
         });
     });
 }
 
 // Clone a predefined theme as a custom theme
 function clonePredefinedTheme(themeData) {
     if (typeof openCustomThemeModal === 'undefined') {
         console.error('Custom theme manager not loaded');
         return;
     }
     
     // Convert theme colors to variables format
     const variables = {
         'primary-bg': themeData.colors[0] || '#ffffff',
         'secondary-bg': themeData.colors[1] || '#f8f9fa',
         'accent-bg': themeData.colors[0] || '#ffffff',
         'primary-text': '#2c3e50',
         'secondary-text': '#6c757d',
         'accent-text': '#1a252f',
         'primary-accent': themeData.colors[2] || '#4285f4',
         'secondary-accent': themeData.colors[3] || '#3367d6',
         'border-color': themeData.colors[4] || '#e9ecef'
     };
     
     // Create a new custom theme with the same colors
     const newTheme = {
         id: `custom-theme-${Date.now()}`,
         name: `${themeData.name} (Copy)`,
         variables: variables,
         isCustom: true
     };
     
     // Save and apply the theme using custom theme manager
     if (typeof customThemes !== 'undefined' && typeof saveCustomThemes !== 'undefined') {
         customThemes.push(newTheme);
         saveCustomThemes();
         
         // Inject CSS
         if (typeof injectCustomThemeCSS !== 'undefined') {
             injectCustomThemeCSS(newTheme);
         }
         
         // Refresh theme grid
         populateThemeGrid();
         
         // Select the new theme but keep panel open
         selectTheme(newTheme.id, true);
     }
 }

// Update current theme button display
function updateCurrentThemeButton(themeId) {
    const previewContainer = document.getElementById('current-theme-preview');
    const nameElement = document.getElementById('current-theme-name');
    const topbarPreview = document.getElementById('topbar-theme-preview');
    
    // Find the theme data
    let themeData = themes.find(t => t.id === themeId);
    
    // If not found in predefined themes, check custom themes
    if (!themeData && typeof getCustomThemes !== 'undefined') {
        const customThemes = getCustomThemes();
        themeData = customThemes.find(t => t.id === themeId);
        
        // For custom themes, extract colors from variables
        if (themeData && themeData.variables) {
            themeData.colors = [
                themeData.variables['primary-bg'],
                themeData.variables['secondary-bg'],
                themeData.variables['primary-accent'],
                themeData.variables['secondary-accent'],
                themeData.variables['border-color']
            ];
        }
    }
    
    if (themeData) {
        const colorPalette = themeData.colors.map(color => 
            `<div class="theme-preview-color" style="background-color: ${color}"></div>`
        ).join('');

        // Update hidden sidebar preview (kept for JS compatibility)
        if (previewContainer) previewContainer.innerHTML = colorPalette;
        if (nameElement) nameElement.textContent = themeData.name;

        // Update topbar compact preview
        if (topbarPreview) topbarPreview.innerHTML = colorPalette;
    }
}

 window.applyThemeFromCommand = function(themeId, options = {}) {
     if (!themeId || typeof themeId !== 'string' || themeId.trim() === '') {
         return;
     }
     suppressThemeHistory = true;
     try {
         selectTheme(themeId, options.keepPanelOpen ?? true);
     } finally {
         suppressThemeHistory = false;
     }
 };

 // Select theme
 function selectTheme(themeId, keepPanelOpen = false) {
     const previousTheme = currentTheme;
     
     // Validate and sanitize themeId
     // Return early if themeId is invalid (null, undefined, empty string, or not a string)
     if (!themeId || typeof themeId !== 'string' || themeId.trim() === '') {
         console.warn('Invalid themeId provided to selectTheme:', themeId);
         return;
     }
     
     // Sanitize themeId - if it contains spaces, only use the first token (the actual theme)
     // This handles corrupted localStorage data where theme might be 'theme-light-minimal fullscreen-mode'
     if (themeId.includes(' ')) {
         console.warn('Theme ID contains spaces, sanitizing:', themeId);
         themeId = themeId.split(' ')[0];
     }
     
     // Ensure themeId is still valid after sanitization
     if (!themeId || themeId.trim() === '') {
         console.warn('ThemeId became invalid after sanitization');
         return;
     }
     
     // Remove active class from all theme cards
     document.querySelectorAll('.theme-card').forEach(card => {
         card.classList.remove('active');
     });
     
     // Add active class to selected theme card
     const selectedCard = document.querySelector(`[data-theme="${themeId}"]`);
     if (selectedCard) {
         selectedCard.classList.add('active');
     }
     
     // Update current theme
     currentTheme = themeId;

     // Record the very first theme applied so the Reset button can return to it
     if (initialTheme === null) {
         initialTheme = themeId;
     }
     
     // Update the theme selector button
     updateCurrentThemeButton(themeId);
     
     // Close the theme panel unless specified to keep open
     if (!keepPanelOpen) {
         closeThemePanel();
     }
     
    // Apply theme to category sections grid so thumbnails preview with the selected theme
    const categorySectionsGrid = document.getElementById('category-sections-grid');
    if (categorySectionsGrid) {
        // Remove all theme classes
        categorySectionsGrid.className = categorySectionsGrid.className.replace(/theme-[\w-]+/g, '').trim();
        // Add new theme class only if themeId is valid
        if (themeId && themeId.trim() !== '') {
            categorySectionsGrid.classList.add('category-sections-grid', themeId);
        } else {
            categorySectionsGrid.classList.add('category-sections-grid');
        }
    }
    
    // Apply theme class to .bg-picker-color elements inside .bg-picker-dropdown
    document.querySelectorAll('.bg-picker-dropdown .bg-picker-color').forEach(colorElement => {
        Array.from(colorElement.classList).forEach(cls => {
            if (cls.startsWith('theme-') || cls.startsWith('custom-theme-')) {
                colorElement.classList.remove(cls);
            }
        });
        if (themeId && themeId.trim() !== '') {
            colorElement.classList.add(themeId);
        }
    });

    // Apply theme class to section outline list
    const sectionOutlineList = document.getElementById('section-outline-list');
    if (sectionOutlineList) {
        // Remove old theme classes
        Array.from(sectionOutlineList.classList).forEach(cls => {
            if (cls.startsWith('theme-') || cls.startsWith('custom-theme-')) {
                sectionOutlineList.classList.remove(cls);
            }
        });
        // Add new theme
        if (themeId && themeId.trim() !== '') {
            sectionOutlineList.classList.add(themeId);
        }
    }

     // Send theme to iframe (only apply theme to iframe content, not editor)
     const iframe = document.getElementById('preview-iframe');
     if (iframe && iframe.contentWindow) {
         iframe.contentWindow.postMessage({
             type: 'SET_THEME',
             data: { theme: themeId }
         }, '*');
     }
     
     const canEmitCommand = !suppressThemeHistory &&
         previousTheme &&
         previousTheme !== themeId &&
         typeof ThemeChangeCommand !== 'undefined' &&
         typeof historyManager !== 'undefined' &&
         historyManager;
     
     if (canEmitCommand) {
         const themeCommand = new ThemeChangeCommand({
             beforeTheme: previousTheme,
             afterTheme: themeId,
             label: `Theme changed to ${themeId}`
         });
         historyManager.executeCommand(themeCommand);
     } else if (!suppressThemeHistory) {
         // If command cannot be emitted (e.g., historyManager not ready), fallback to autosave
         scheduleAutosave();
     }
 }

 // Authentication functions
 async function initializeAuthentication() {
     // If we already have server-provided user data, use it immediately
     if (serverUserData && serverUserData.authenticated) {
         console.log('Using server-provided authentication data');
         // State is already set from server data above
         // HTML is already rendered server-side, so just attach handlers
         attachUserMenuHandlers();
         
         // Still listen for Clerk changes in case user logs out
         if (typeof Clerk !== 'undefined' && !clerkListenerAdded) {
             clerkListenerAdded = true;
             Clerk.addListener(async ({ user }) => {
                 console.log('Clerk auth change:', user);
                 if (!user && isAuthenticated) {
                     // User signed out via Clerk
                     isAuthenticated = false;
                     currentUser = null;
                     editorMode = 'free';
                     console.log('User signed out via Clerk');
                     updateUserInterface();
                     // Reload page to sync with server
                     window.location.reload();
                 } else if (user && !isAuthenticated) {
                     // User signed in via Clerk, sync with server
                     await authenticateUserWithClerk(user);
                 }
             });
         }
         return;
     }
     
     // Prevent duplicate initialization
     if (authenticationInProgress) {
         console.log('Authentication already in progress, skipping...');
         return;
     }
     
     authenticationInProgress = true;
     console.log('Initializing authentication...');
     console.log('Clerk available:', typeof Clerk !== 'undefined');
     console.log('Clerk user:', typeof Clerk !== 'undefined' ? Clerk.user : 'Clerk not loaded');
     
     try {
         // Check if Clerk is available and user is signed in
         if (typeof Clerk !== 'undefined' && Clerk.user) {
             await authenticateUserWithClerk(Clerk.user);
         } else {
             // Check localStorage for authentication status
             const storedMode = localStorage.getItem('editorMode');
             const storedAuth = localStorage.getItem('isAuthenticated');
             
             console.log('Stored mode:', storedMode);
             console.log('Stored auth:', storedAuth);
             
             if (storedMode === 'authenticated' && storedAuth === 'true') {
                 const userEmail = localStorage.getItem('userEmail');
                 const userName = localStorage.getItem('userName');
                 const userAvatar = localStorage.getItem('userAvatar');
                 currentUser = {
                     email: userEmail,
                     name: userName,
                     imageUrl: userAvatar || null
                 };
                 console.log('User authenticated via localStorage:', currentUser);
                 
                 // Check paid status for stored user
                 await (userEmail);
             } else {
                 editorMode = 'free';
                 isAuthenticated = false;
                 currentUser = null;
                 console.log('User in free mode');
             }
         }
         
         updateUserInterface();
         
         // Listen for Clerk authentication changes (only once)
         if (typeof Clerk !== 'undefined' && !clerkListenerAdded) {
             clerkListenerAdded = true;
             Clerk.addListener(async ({ user }) => {
                 console.log('Clerk auth change:', user);
                 if (user && !isAuthenticated) {
                     // Only authenticate if not already authenticated
                     await authenticateUserWithClerk(user);
                 } else if (!user && isAuthenticated) {
                     // Only sign out if currently authenticated
                     isAuthenticated = false;
                     currentUser = null;
                     editorMode = 'free';
                     console.log('User signed out via Clerk');
                     updateUserInterface();
                 }
             });
         }
     } finally {
         authenticationInProgress = false;
     }
 }

 // Authenticate user with Clerk and check paid status
 async function authenticateUserWithClerk(clerkUser) {
     // Prevent duplicate authentication calls
     if (isAuthenticated && currentUser && currentUser.id === clerkUser.id) {
         console.log('User already authenticated, skipping...');
         return;
     }
     
     try {
         const userEmail = clerkUser.primaryEmailAddress?.emailAddress;
         const userName = clerkUser.fullName;
         const clerkUserId = clerkUser.id;
         const avatarUrl = clerkUser.imageUrl || clerkUser.profileImageUrl || null;
         
         if (!userEmail) {
             console.error('No email found in Clerk user');
             return;
         }
         
         console.log('Authenticating user:', userEmail);
         
         // Send authentication request to PHP backend
         const response = await fetch('api/auth-handler.php', {
             method: 'POST',
             headers: {
                 'Content-Type': 'application/json',
             },
             body: JSON.stringify({
                 action: 'authenticate',
                 email: userEmail,
                 name: userName,
                 clerk_user_id: clerkUserId,
                 avatar_url: avatarUrl
             })
         });
         
         const result = await response.json();
         
         if (result.success) {
             const userData = result.data;
             isAuthenticated = true;
             currentUser = {
                 email: userEmail,
                 name: userName,
                 id: clerkUserId,
                 imageUrl: avatarUrl,
             };
             editorMode = userData.is_paid ? 'paid' : 'authenticated';
             
             // Store authentication info
             localStorage.setItem('editorMode', editorMode);
             localStorage.setItem('isAuthenticated', 'true');
             localStorage.setItem('userEmail', userEmail);
             localStorage.setItem('userName', userName);
             localStorage.setItem('isPaid', userData.is_paid.toString());
             if (avatarUrl) {
                 localStorage.setItem('userAvatar', avatarUrl);
             } else {
                 localStorage.removeItem('userAvatar');
             }
             
             console.log('User authenticated:', userData);
             updateUserInterface();
             
            // [DISABLED_FOR_WEDDING_VERSION]: Auto-show after auth removed — upgrade modal only appears
            // during onboarding (when user has no pages). The primary onboarding check handles this.
            // if (editorMode === 'authenticated' && !userData.is_paid && !upgradeModalShownThisSession) {
            //     upgradeModalShownThisSession = true;
            //     setTimeout(() => {
            //         showUpgradeModal();
            //     }, 500);
            // }
         } else {
             console.error('Authentication failed:', result.error);
         }
     } catch (error) {
         console.error('Error authenticating user:', error);
     }
 }

 // Check user paid status
 async function checkUserPaidStatus(email) {
     try {
         const response = await fetch('api/auth-handler.php', {
             method: 'POST',
             headers: {
                 'Content-Type': 'application/json',
             },
             body: JSON.stringify({
                 action: 'check_paid_status',
                 email: email
             })
         });
         
         const result = await response.json();
         
         if (result.success) {
             const paidStatus = result.data;
             const isPaid = paidStatus.is_paid;
             
             // Update editor mode based on paid status
             if (isAuthenticated) {
                 editorMode = isPaid ? 'paid' : 'authenticated';
                 localStorage.setItem('editorMode', editorMode);
                 localStorage.setItem('isPaid', isPaid.toString());
             }
             
             console.log('Paid status checked:', paidStatus);
             updateUserInterface();
             
            // [DISABLED_FOR_WEDDING_VERSION]: Auto-show after paid-status check removed — upgrade modal
            // only appears during onboarding (when user has no pages).
            // if (isAuthenticated && editorMode === 'authenticated' && !isPaid && !upgradeModalShownThisSession) {
            //     upgradeModalShownThisSession = true;
            //     setTimeout(() => {
            //         showUpgradeModal();
            //     }, 500);
            // }
         } else {
             console.error('Paid status check failed:', result.error);
         }
     } catch (error) {
         console.error('Error checking paid status:', error);
     }
 }

 function updateServerUserDisplay(userDetails) {
     const display = document.getElementById('server-user-display');
     if (!display) return;

     const avatarWrapper = display.querySelector('[data-role="user-avatar-wrapper"]');
     const avatarImg = display.querySelector('[data-role="user-avatar-img"]');
     const avatarInitial = display.querySelector('[data-role="user-avatar-initial"]');
     const nameEl = display.querySelector('[data-role="user-name"]');

     const preferredName = (userDetails && (userDetails.name || userDetails.fullName)) || null;
     const fallbackEmail = userDetails && userDetails.email ? userDetails.email : null;
     const avatarUrl = (userDetails && (userDetails.avatar_url || userDetails.imageUrl || userDetails.image_url)) || null;

     const displayName = preferredName || fallbackEmail || 'Account';

     if (nameEl) {
         nameEl.textContent = displayName;
     }

     if (avatarWrapper) {
         avatarWrapper.classList.toggle('has-image', Boolean(avatarUrl));
     }

     if (avatarImg) {
         if (avatarUrl) {
             avatarImg.src = avatarUrl;
             avatarImg.alt = `${displayName} avatar`;
             avatarImg.style.display = 'block';
         } else {
             avatarImg.removeAttribute('src');
             avatarImg.style.display = 'none';
         }
     }

     if (avatarInitial) {
         const initialSource = (preferredName || fallbackEmail || '?').trim();
         const firstChar = initialSource ? Array.from(initialSource)[0] : '?';
         avatarInitial.textContent = firstChar ? firstChar.toLocaleUpperCase() : '?';
         avatarInitial.style.display = avatarUrl ? 'none' : 'block';
     }
 }

 function openClerkProfile() {
     if (typeof Clerk !== 'undefined' && typeof Clerk.openUserProfile === 'function') {
         Clerk.openUserProfile();
         return;
     }

     if (typeof Clerk !== 'undefined' && typeof Clerk.load === 'function') {
         Clerk.load()
             .then(() => {
                 if (typeof Clerk.openUserProfile === 'function') {
                     Clerk.openUserProfile();
                 } else {
                     console.warn('Clerk profile became available but openUserProfile is missing.');
                 }
             })
             .catch((error) => {
                 console.error('Unable to load Clerk to open the profile:', error);
             });
         return;
     }

     console.warn('Clerk profile is not available yet.');
 }

 function closeUserMenu() {
     const dropdown = document.getElementById('server-user-dropdown');
     const trigger = document.getElementById('server-user-display');
     if (dropdown) {
         dropdown.classList.remove('show');
         dropdown.setAttribute('aria-hidden', 'true');
     }
     if (trigger) {
         trigger.setAttribute('aria-expanded', 'false');
     }
     userMenuVisible = false;
 }

 function openUserMenu() {
     const dropdown = document.getElementById('server-user-dropdown');
     const trigger = document.getElementById('server-user-display');
     if (!dropdown || !trigger) {
         userMenuVisible = false;
         return;
     }
     if (typeof window.closePublishOptionsMenu === 'function') window.closePublishOptionsMenu();

     dropdown.classList.add('show');
     dropdown.setAttribute('aria-hidden', 'false');
     trigger.setAttribute('aria-expanded', 'true');
     userMenuVisible = true;
 }

 function toggleUserMenu(forceState) {
     if (forceState === true) {
         openUserMenu();
         return;
     }
     if (forceState === false) {
         closeUserMenu();
         return;
     }

     if (userMenuVisible) {
         closeUserMenu();
     } else {
         openUserMenu();
     }
 }

 // handleLogout is now defined in public/js/logout-handler.js (shared with pages.php)

 function attachUserMenuHandlers() {
     const display = document.getElementById('server-user-display');
     const dropdown = document.getElementById('server-user-dropdown');
     if (!display || !dropdown || display.dataset.menuAttached === 'true') {
         return;
     }

     display.dataset.menuAttached = 'true';

     display.addEventListener('click', (event) => {
         event.preventDefault();
         toggleUserMenu();
     });

     display.addEventListener('keydown', (event) => {
         if (event.key === 'Enter' || event.key === ' ') {
             event.preventDefault();
             toggleUserMenu();
         } else if (event.key === 'Escape') {
             event.preventDefault();
             closeUserMenu();
         }
     });

     dropdown.querySelectorAll('[data-menu-action]').forEach((button) => {
         button.addEventListener('click', (event) => {
             const action = event.currentTarget.dataset.menuAction;
             if (action === 'manage') {
                 closeUserMenu();
                 openClerkProfile();
             } else if (action === 'logout') {
                 handleLogout();
             } else if (action === 'darkmode') {
                 toggleDarkMode();
                 updateDarkModeDropdownState();
            } else if (action === 'upgrade') {
                closeUserMenu();
                // [DISABLED_FOR_WEDDING_VERSION]: Upgrade modal on menu button removed — modal only
                // appears during onboarding (when user has no pages).
                // showUpgradeModal();
            }
         });
     });

     dropdown.addEventListener('keydown', (event) => {
         if (event.key === 'Escape') {
             event.preventDefault();
             closeUserMenu();
             display.focus();
         }
     });

    if (!userMenuDocumentListenerAttached) {
        document.addEventListener('click', (event) => {
            const trigger = document.getElementById('server-user-display');
            const menu = document.getElementById('server-user-dropdown');
            const iframe = document.getElementById('preview-iframe');
            if (!trigger || !menu) {
                return;
            }

            // Check if menu is visible (by class) and click is outside both trigger and menu
            const isMenuVisible = menu.classList.contains('show');
            const isClickOnTrigger = trigger.contains(event.target);
            const isClickOnMenu = menu.contains(event.target);
            const isClickOnIframe = iframe && (iframe === event.target || iframe.contains(event.target));
            
            // Close menu if visible and click is outside trigger/menu
            // Note: Clicks inside iframe are handled via IFRAME_CLICK message from preview.js
            if (isMenuVisible && !isClickOnTrigger && !isClickOnMenu && !isClickOnIframe) {
                closeUserMenu();
            }
        });
        userMenuDocumentListenerAttached = true;
    }

     closeUserMenu();
 }

 function updateUserInterface() {
     // If server data is available, HTML is already rendered correctly by PHP
     // Only attach handlers, don't change display
     if (serverUserData && serverUserData.authenticated && isAuthenticated) {
         const serverUserDisplay = document.getElementById('server-user-display');
         if (serverUserDisplay) {
             attachUserMenuHandlers();
             serverUserDisplay.setAttribute('aria-expanded', userMenuVisible ? 'true' : 'false');
             const serverDropdown = document.getElementById('server-user-dropdown');
             if (serverDropdown) {
                 serverDropdown.setAttribute('aria-hidden', userMenuVisible ? 'false' : 'true');
             }
         }
         // Update section visibility based on user permissions
         updateSectionVisibility();
         return;
     }
     
     // Only update display if we don't have server-rendered data (fallback for JS-only auth)
     const freeModeDisplay = document.getElementById('free-mode-display');
     const clerkUserButton = document.getElementById('clerk-user-button');
     const statusIndicator = document.getElementById('status-indicator');
     const userMode = document.getElementById('user-mode');
     const clerkProBadge = document.getElementById('clerk-pro-badge');
     const serverUserDisplay = document.getElementById('server-user-display');
     
     console.log('Updating UI - isAuthenticated:', isAuthenticated);
     console.log('Updating UI - editorMode:', editorMode);
     console.log('Updating UI - Clerk.user:', typeof Clerk !== 'undefined' ? Clerk.user : 'Clerk not loaded');
     
     if (isAuthenticated) {
         if (freeModeDisplay) freeModeDisplay.style.display = 'none';
         if (clerkUserButton) clerkUserButton.style.display = 'block';

         if (serverUserDisplay) {
             serverUserDisplay.style.display = 'flex';
             updateServerUserDisplay(currentUser || serverUserData);
             attachUserMenuHandlers();
             serverUserDisplay.setAttribute('aria-expanded', userMenuVisible ? 'true' : 'false');
             const serverDropdown = document.getElementById('server-user-dropdown');
             if (serverDropdown) {
                 serverDropdown.setAttribute('aria-hidden', userMenuVisible ? 'false' : 'true');
             }
         }

         if (statusIndicator) {
             statusIndicator.className = 'status-indicator authenticated';
         }
         if (userMode) {
             userMode.textContent = editorMode === 'paid' ? 'Paid User' : 'Free User';
         }
         
         // Handle PRO badge - create if it doesn't exist and user is paid
         if (editorMode === 'paid') {
             if (clerkProBadge) {
                 clerkProBadge.style.display = 'inline-block';
             } else if (serverUserDisplay) {
                 // Create PRO badge if it doesn't exist
                 const badge = document.createElement('span');
                 badge.className = 'pro-badge';
                 badge.id = 'clerk-pro-badge';
                 badge.textContent = 'PRO';
                 serverUserDisplay.appendChild(badge);
                 console.log('Created PRO badge dynamically');
             }
         } else if (clerkProBadge) {
             clerkProBadge.style.display = 'none';
         }
     } else {
         console.log('Showing free mode interface');
         if (freeModeDisplay) freeModeDisplay.style.display = 'flex';
         if (clerkUserButton) clerkUserButton.style.display = 'none';
         if (serverUserDisplay) {
             serverUserDisplay.style.display = 'none';
         }
         closeUserMenu();

         if (statusIndicator) {
             statusIndicator.className = 'status-indicator free';
         }
         if (userMode) {
             userMode.textContent = 'Free Mode';
         }
         if (clerkProBadge) {
             clerkProBadge.style.display = 'none';
         }
     }

     // Update section visibility based on user permissions
     updateSectionVisibility();
 }

 // Update section visibility based on user permissions
 function updateSectionVisibility() {
     const isPaidUser = editorMode === 'paid';
     const sectionItems = document.querySelectorAll('.section-item, .category-section-item');
     
     sectionItems.forEach(item => {
         const isProSection = item.dataset.isPro === '1';
         const addButton = item.querySelector('.add-section-button, .category-section-add-button');
         const lockIcon = item.querySelector('.section-lock, .category-section-lock');
         
         if (isProSection && !isPaidUser) {
             // For free users, pro sections should be visible but locked
             item.style.display = 'block';
             item.classList.add('pro-section');
             // Hide add button for pro sections when user is not paid
             if (addButton) {
                 addButton.style.display = 'none';
             }
             // Show lock icon for pro sections when user is not paid
             if (lockIcon) {
                 lockIcon.style.display = 'flex';
             }
         } else {
             // For paid users, all sections are accessible
             item.style.display = 'block';
             item.classList.remove('pro-section');
             // Show add button for all sections when user is paid, or for free sections
             if (addButton) {
                 addButton.style.display = 'flex';
             }
             // Hide lock icon for paid users
             if (lockIcon) {
                 lockIcon.style.display = 'none';
             }
         }
     });
     
     // Reinitialize tooltips for lock icons
     setTimeout(() => {
         const lockIcons = document.querySelectorAll('.section-lock, .category-section-lock');
         lockIcons.forEach(lock => {
             if (!lock._tippy) {
                 tippy(lock, {
                     placement: 'top',
                     arrow: true,
                     theme: 'custom',
                     animation: 'scale',
                     duration: [200, 150],
                     delay: [300, 0]
                 });
             }
         });
     }, 100);
 }



 // Track preview iframe ready state
 let previewReady = false;
 
 // Listen for messages from iframe
 window.addEventListener('message', function(event) {
     const { type, data, requestId } = event.data;
     
     switch(type) {
         case 'PREVIEW_READY':
             previewReady = true;
             console.log('[App] Preview iframe is ready');
             break;
         case 'SECTION_REMOVED':
             // Create and execute remove command
             if (data.html && historyManager && window.SectionRemoveCommand) {
                 const removeCommand = new SectionRemoveCommand({
                     sectionNumber: data.sectionNumber,
                     html: data.html,
                     removeIndex: data.removeIndex,
                     context: window.sectionCommandHelpers
                 });
                 historyManager.executeCommand(removeCommand);
             }
             break;
         case 'SECTION_CLONED':
             // Create and execute clone command
             if (data.html && historyManager && window.SectionCloneCommand) {
                 const cloneCommand = new SectionCloneCommand({
                     originalSectionNumber: data.originalSectionNumber,
                     newSectionNumber: data.newSectionNumber,
                     html: data.html,
                     insertIndex: data.insertIndex,
                     context: window.sectionCommandHelpers
                 });
                 historyManager.executeCommand(cloneCommand);
             }
             break;
         case 'SECTION_MOVED':
             // Create and execute move command
             if (historyManager && window.SectionMoveCommand) {
                 const moveCommand = new SectionMoveCommand({
                     sectionNumber: data.sectionNumber,
                     direction: data.direction,
                     context: window.sectionCommandHelpers
                 });
                 historyManager.executeCommand(moveCommand);
             }
             break;
         case 'EXIT_FULLSCREEN':
             toggleFullscreenPreview();
             break;
        case 'RESTORE_TEMPLATE_DONE':
        case 'OUTLINE_READY':
            // Iframe tiene el DOM de secciones listo (restore o insert con ?template=).
            // Sincronizar selectedSections desde el iframe para que el botón del layout se habilite.
            syncSelectedSectionsFromIframe();
            updateSectionCounter();
            if (typeof window.sectionOutline !== 'undefined' && window.sectionOutline.refresh) {
                window.sectionOutline.refresh();
                // Re-apply theme after refresh so thumbnails inherit the correct CSS variables,
                // especially when no explicit theme change was made (onboarding direct select).
                if (typeof window.sectionOutline.refreshTheme === 'function') {
                    window.sectionOutline.refreshTheme();
                }
            }
            break;
         case 'IFRAME_CLICK':
             // Close user menu if open
             if (userMenuVisible) {
                 closeUserMenu();
             }
             // Only execute escape event if not in fullscreen mode
             if (!fullscreenMode) {
                 const escapeEvent = new KeyboardEvent('keydown', {
                     key: 'Escape',
                     code: 'Escape',
                     keyCode: 27,
                     which: 27,
                     bubbles: true,
                     cancelable: true
                 });
                 
                 document.dispatchEvent(escapeEvent);
             }
             break;
        case 'TEMPLATE_DATA':
            // Maneja datos del template completo para descarga, autosave o historial.
            // requestId está en el nivel superior de event.data, no en data.

            // Si es un request de autosave, ignorar (el handler de autosave lo procesa)
            if (requestId && requestId === autosaveRequestId) {
                break;
            }

            // Si es un request de export a GitHub, manejarlo
            if (requestId && typeof requestId === 'string' && requestId.startsWith('github_export_')) {
                if (window.downloadOptionsHandler) {
                    window.downloadOptionsHandler.pushProjectToGitHub(data);
                }
                break;
            }

            // Si es un request de export a React, manejarlo
            if (requestId && typeof requestId === 'string' && requestId.startsWith('react_export_')) {
                if (window.downloadOptionsHandler) {
                    window.downloadOptionsHandler.generateReactProject(data);
                }
                break;
            }

            // Si es un request de historial, ignorar (el handler de history lo procesa)
            if (requestId && typeof requestId === 'string' && requestId.startsWith('history_')) {
                break;
            }

            // No procesar durante restauración o respuestas de autosave
            if (isRestoring || (requestId && typeof requestId === 'string' && requestId.startsWith('autosave_'))) {
                break;
            }

            // Descarga iniciada por el usuario (sin requestId)
            generateAndDownloadPage(data);
            break;

        // [DISABLED_FOR_WEDDING_VERSION]: SECTIONS_DATA reemplazado por TEMPLATE_DATA que usa fullHtml.
        // case 'SECTIONS_DATA': ...
         case 'TEXT_EDITED':
             // Create and execute text edit command
             if (historyManager && window.TextEditCommand) {
                 const textCommand = new TextEditCommand({
                     sectionNumber: data.sectionNumber,
                     elementId: data.elementId,
                     beforeContent: data.beforeContent,
                     afterContent: data.afterContent,
                     context: window.sectionCommandHelpers
                 });
                 historyManager.executeCommand(textCommand);
             }
             break;
         case 'ELEMENT_REMOVED':
             // Create and execute element remove command
             if (historyManager && window.ElementRemoveCommand) {
                 const elementCommand = new ElementRemoveCommand({
                     sectionNumber: data.sectionNumber,
                     sectionUid: data.sectionUid, // Unique ID to target correct section instance
                     elementHtml: data.elementHtml,
                     elementIndex: data.elementIndex,
                     parentSelector: data.parentSelector
                 });
                 historyManager.executeCommand(elementCommand);
             }
             break;
         case 'SECTION_EDITED':
             // Handle section content edits (legacy - should not be used anymore)
             // This is only sent when editor loses focus, so save immediately
             if (historyManager) historyManager.save();
             scheduleAutosave();
             break;
         case 'COMMAND_BACKGROUND_CHANGE':
             if (historyManager && typeof BackgroundChangeCommand !== 'undefined') {
                 const command = new BackgroundChangeCommand({
                     sectionNumber: data.sectionNumber,
                     beforeState: data.beforeState,
                     afterState: data.afterState,
                     label: data.label
                 });
                 historyManager.executeCommand(command);
             }
             break;
         case 'COMMAND_OPACITY_CHANGE':
             if (historyManager && typeof OpacityChangeCommand !== 'undefined') {
                 const command = new OpacityChangeCommand({
                     sectionUid: data.sectionUid,
                     beforeOpacity: data.beforeOpacity,
                     afterOpacity: data.afterOpacity,
                     label: data.label || 'Overlay opacity change'
                 });
                 historyManager.executeCommand(command);
             }
             break;
         case 'COMMAND_IMAGE_CHANGE':
             if (historyManager && typeof ImageChangeCommand !== 'undefined') {
                 const imageCommand = new ImageChangeCommand({
                     sectionNumber: data.sectionNumber,
                     imageUid: data.imageUid,
                     beforeState: data.beforeState,
                     afterState: data.afterState,
                     label: data.label
                 });
                 historyManager.executeCommand(imageCommand);
             }
             break;
         case 'COMMAND_INLINE_VIDEO_CHANGE':
             if (historyManager && typeof InlineVideoChangeCommand !== 'undefined') {
                 const videoCommand = new InlineVideoChangeCommand({
                     sectionNumber: data.sectionNumber,
                     videoUid: data.videoUid,
                     beforeState: data.beforeState,
                     afterState: data.afterState,
                     label: data.label
                 });
                 historyManager.executeCommand(videoCommand);
             }
             break;
        case 'COMMAND_INLINE_SVG_CHANGE':
            if (historyManager && typeof InlineSVGChangeCommand !== 'undefined') {
                const svgCommand = new InlineSVGChangeCommand({
                    sectionNumber: data.sectionNumber,
                    svgUid: data.svgUid,
                    beforeState: data.beforeState,
                    afterState: data.afterState,
                    label: data.label
                });
                historyManager.executeCommand(svgCommand);
            }
            break;
        case 'COMMAND_MAP_CHANGE':
            if (historyManager && typeof MapChangeCommand !== 'undefined') {
                const mapCommand = new MapChangeCommand({
                    sectionNumber: data.sectionNumber,
                    mapUid: data.mapUid,
                    beforeState: data.beforeState,
                    afterState: data.afterState,
                    label: data.label
                });
                historyManager.executeCommand(mapCommand);
            }
            break;
        case 'COMMAND_COUNTDOWN_CHANGE':
            if (historyManager && typeof CountdownChangeCommand !== 'undefined') {
                const cdCommand = new CountdownChangeCommand({
                    sectionNumber: data.sectionNumber,
                    countdownUid: data.countdownUid,
                    beforeState: data.beforeState,
                    afterState: data.afterState,
                    label: data.label
                });
                historyManager.executeCommand(cdCommand);
            }
            break;
    }
});

// Dark mode functions
function loadDarkModePreference() {
    const darkModeValue = localStorage.getItem('darkMode');
    const darkModeInitialized = localStorage.getItem('darkModeInitialized');

    // Default to dark mode if no preference is set OR if this is the first time with new default
    const isDark = (darkModeValue === null || darkModeInitialized === null) ? true : darkModeValue === 'true';

    // Save the default preference if none exists or not yet initialized with new default
    if (darkModeValue === null || darkModeInitialized === null) {
        localStorage.setItem('darkMode', 'true');
        localStorage.setItem('darkModeInitialized', 'true');
    }

    if (isDark) {
        document.body.classList.add('dark-mode');
    }
}

function toggleDarkMode() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', isDark ? 'true' : 'false');
    
    // Sync to preview iframe
    const iframe = document.getElementById('preview-iframe');
    if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({
            type: 'TOGGLE_DARK_MODE',
            data: {
                darkMode: isDark
            }
        }, '*');
    }
}

// Update Modo Boda dropdown state (text and icons)
function updateDarkModeDropdownState() {
    const isWeddingMode = document.body.classList.contains('dark-mode');
    const darkModeText = document.getElementById('dark-mode-text');
    if (darkModeText) {
        darkModeText.textContent = isWeddingMode ? 'Modo estándar' : 'Modo Boda';
    }
}

// Load dark mode preference on page load
loadDarkModePreference();
updateDarkModeDropdownState();

// Sincronizar outline desde el DOM del iframe (el outline lee las secciones directamente del DOM).
// Ya no necesita solicitar TEMPLATE_DATA al iframe ya que section-outline.js hace querySelectorAll en el iframe.
function syncOutlineFromTemplateContent() {
    syncSelectedSectionsFromIframe();
    updateSectionCounter();
    if (typeof window.sectionOutline !== 'undefined' && window.sectionOutline.refresh) {
        window.sectionOutline.refresh();
        // Re-apply theme after refresh to ensure CSS variables resolve correctly
        // when inserting a template without an explicit theme change.
        if (typeof window.sectionOutline.refreshTheme === 'function') {
            window.sectionOutline.refreshTheme();
        }
    }
    if (typeof window.Onboarding !== 'undefined' && window.Onboarding.checkVisibility) {
        window.Onboarding.checkVisibility();
    }
}

// Initialize event listeners
document.addEventListener('DOMContentLoaded', async () => {
     // Set iframe source with proper error handling
     const iframe = document.getElementById('preview-iframe');
     
    // Use absolute path to ensure correct loading
    const currentPath = window.location.pathname;
    const basePath = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);
    const previewPath = basePath + 'preview.php';
     
     console.log('Loading preview iframe from:', previewPath);
     
    // Set up iframe load handler BEFORE setting src to avoid race conditions
    // Only run restore-draft / shared-doc on first load; subsequent loads (e.g. user picked template) must not overwrite
    let initialIframeLoadDone = false;
    iframe.onload = async () => {
        console.log('Preview iframe loaded successfully');
        
        // Sync dark mode state to preview iframe
        const isDark = document.body.classList.contains('dark-mode');
        if (iframe.contentWindow) {
            iframe.contentWindow.postMessage({
                type: 'TOGGLE_DARK_MODE',
                data: {
                    darkMode: isDark
                }
            }, '*');
        }
        
        // Re-apply current theme to the freshly loaded iframe content
        if (currentTheme && iframe.contentWindow) {
            iframe.contentWindow.postMessage({
                type: 'SET_THEME',
                data: { theme: currentTheme }
            }, '*');
        }

        // Sync sections-grid display theme with the loaded template.
        // When the user has not selected a theme (currentTheme is null), read the
        // theme class embedded in the template's <body> and apply it to the
        // category-sections-grid so section thumbnails preview with matching colors.
        // This is display-only: currentTheme stays null and no theme card is marked active.
        if (!currentTheme && currentTemplateUrl) {
            try {
                const bodyClasses = iframe.contentDocument?.body?.className || '';
                const templateThemeMatch = bodyClasses.match(/\btheme-[\w-]+/);
                if (templateThemeMatch) {
                    const templateTheme = templateThemeMatch[0];
                    const categorySectionsGrid = document.getElementById('category-sections-grid');
                    if (categorySectionsGrid) {
                        categorySectionsGrid.className = categorySectionsGrid.className.replace(/theme-[\w-]+/g, '').trim();
                        categorySectionsGrid.classList.add('category-sections-grid', templateTheme);
                    }
                }
            } catch (e) {
                // Silently ignore cross-origin or access errors
            }
        }

        // Template-first: after template load, sync outline/selectedSections from DOM (user picked template)
        if (currentTemplateUrl && !isRestoring) {
            setTimeout(syncOutlineFromTemplateContent, 400);
        }
        
        // Restore draft / shared doc only on first iframe load (initial app load). When user picks a template we change iframe.src and onload fires again — we must NOT run restoreDraft then or it overwrites currentTemplateUrl and can CLEAR the template.
        if (initialIframeLoadDone) {
            return;
        }
        initialIframeLoadDone = true;
        
        // Check for shared document ID in URL
        const urlParams = new URLSearchParams(window.location.search);
        const docId = urlParams.get('doc');
         
         if (docId) {
             // Load shared document (this takes precedence over draft)
             setTimeout(() => {
                 loadSharedDocument(docId);
                 // Reset initialization flag after loading shared doc
                 setTimeout(() => {
                     isInitializing = false;
                 }, 1000);
             }, 500);
         } else {
             // [DISABLED_FOR_WEDDING_VERSION]: Page name prompt moved to onboarding selectTemplate().
             // The page is now created after the user picks a template, not on iframe load.
             // if (pageManager.shouldPromptForPageName()) {
             //     await pageManager.promptForPageName();
             // }

             // Try to restore draft after iframe is loaded (only once, on initial load)
             setTimeout(async () => {
                 const restored = await restoreDraft();
                 // If no draft was restored, reset initialization flag
                 if (!restored) {
                     isInitializing = false;
                 }
             }, 500);
         }
     };
     
    iframe.onerror = () => {
        console.error('Failed to load preview iframe');
        // Fallback: try relative path
        iframe.src = './preview.php';
    };
     
     // Load draft first so we can restore template assets client-side.
     // Fallback: if the draft lacks templateHeadHtml (saved before this update), load ?template= so PHP re-inyecta los assets del head.
     preloadedDraft = await pageManager.loadDraftFromDatabase();
     if (preloadedDraft && preloadedDraft.templateUrl && !preloadedDraft.templateHeadHtml) {
         // Draft antiguo sin templateHeadHtml: cargar el template desde el servidor para recuperar CSS/fuentes
         iframe.src = previewPath + '?template=' + encodeURIComponent(preloadedDraft.templateUrl);
     } else {
         // Nuevo flujo: todo se restaura client-side desde draft.templateHeadHtml via RESTORE_TEMPLATE
         iframe.src = previewPath;
     }
     
     buildTemplateStyles();
     setupIntersectionObserver();
     generateCategories();
     
     // Load custom themes from localStorage
     loadCustomThemes();
     
     // Initialize theme grid
     populateThemeGrid();
     selectTheme(currentTheme);
     
             // Initialize authentication after Clerk loads
 if (typeof Clerk !== 'undefined') {
     // Get the base URL and construct the redirect URL
     const baseUrl = window.location.origin;
     const redirectPath = '/nine-screen-canvas-flow/signin/';
     const afterSignOutUrl = baseUrl + redirectPath;
     
     Clerk.load({
         afterSignOutUrl: afterSignOutUrl
     }).then(() => {
         console.log('Clerk loaded, checking authentication...');
         initializeAuthentication();
     }).catch(error => {
         console.error('Error loading Clerk:', error);
         initializeAuthentication();
     });
 } else {
     // Wait for Clerk to be available
     const checkClerk = () => {
         if (typeof Clerk !== 'undefined') {
             // Get the base URL and construct the redirect URL
             const baseUrl = window.location.origin;
             const redirectPath = '/nine-screen-canvas-flow/signin/';
             const afterSignOutUrl = baseUrl + redirectPath;
             
             Clerk.load({
                 afterSignOutUrl: afterSignOutUrl
             }).then(() => {
                 console.log('Clerk loaded, checking authentication...');
                 initializeAuthentication();
             }).catch(error => {
                 console.error('Error loading Clerk:', error);
                 initializeAuthentication();
             });
         } else {
             setTimeout(checkClerk, 100);
         }
     };
     checkClerk();
 }
 
// [DISABLED_FOR_WEDDING_VERSION]: Backup auto-show removed — upgrade modal only appears during
// onboarding (when user has no pages). The primary check at page load already handles this.
// if (serverUserData && serverUserData.authenticated &&
//     editorMode === 'authenticated' &&
//     !serverUserData.is_paid &&
//     !upgradeModalShownThisSession) {
//     const showUpgradeModalOnLoad = () => {
//         if (typeof upgradeModal !== 'undefined') {
//             upgradeModalShownThisSession = true;
//             setTimeout(() => {
//                 showUpgradeModal();
//             }, 1500);
//         } else {
//             setTimeout(showUpgradeModalOnLoad, 100);
//         }
//     };
//     showUpgradeModalOnLoad();
// }
     
    //  // Clear all button
    //  const clearButton = document.getElementById('clear-all');
    //  clearButton.addEventListener('click', clearAllSections);
     
     // Toggle sidebar button (pages list)
     const toggleButton = document.getElementById('toggle-sidebar');
     if (toggleButton) {
         toggleButton.addEventListener('click', (e) => {
             e.stopPropagation();
             toggleSidebar();
         });
     }

     // Pages sidebar close button (X in header)
     const pagesSidebarCloseBtn = document.getElementById('pages-sidebar-close');
     if (pagesSidebarCloseBtn) {
         pagesSidebarCloseBtn.addEventListener('click', () => {
             if (!sidebarCollapsed) toggleSidebar();
         });
     }

     // Close pages sidebar on ESC
     document.addEventListener('keydown', (e) => {
         if (e.key === 'Escape' && !sidebarCollapsed) {
             const sidebar = document.querySelector('.sidebar');
             if (sidebar && sidebar.classList.contains('sidebar-ready')) {
                 toggleSidebar();
             }
         }
     });

    // Close pages sidebar when clicking outside (main area, top-bar, etc.)
    // Exclude view-pages-btn and topbar-files-btn so opening the sidebar via them does not immediately close it
    document.addEventListener('click', (e) => {
        if (sidebarCollapsed) return;
        const sidebar = document.querySelector('.sidebar');
        if (!sidebar || !sidebar.classList.contains('sidebar-ready')) return;
        if (e.target.closest('#pages-sidebar') || e.target.closest('#toggle-sidebar') || e.target.closest('#view-pages-btn') || e.target.closest('#topbar-files-btn')) return;
        toggleSidebar();
    });

     // View Your Pages button: opens the left sidebar OVER the onboarding overlay.
     // The sidebar (z-index 10) appears above the overlay (z-index 4) so the user
     // can pick an existing page to edit without losing the template gallery.
     // Onboarding is NOT hidden here — it stays visible behind the sidebar.
     const viewPagesBtn = document.getElementById('view-pages-btn');
     if (viewPagesBtn) {
         viewPagesBtn.addEventListener('click', () => {
             if (window.isOnboardingMode) {
                 // In onboarding the sidebar has no .sidebar-ready so it stays hidden.
                 // Force-open: add sidebar-ready and show the pages list.
                 sidebarCollapsed = false;
                 const sidebar = document.querySelector('.sidebar');
                 if (sidebar) {
                     sidebar.classList.remove('collapsed', 'onboarding-mode');
                     sidebar.classList.add('sidebar-ready');
                 }
                 fetchAndRenderPagesList();
                 if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
             } else {
                 if (sidebarCollapsed) toggleSidebar();
             }
         });
     }

     // Topbar files icon: opens the left sidebar (pages list) from the top bar.
     const topbarFilesBtn = document.getElementById('topbar-files-btn');
     if (topbarFilesBtn) {
         topbarFilesBtn.addEventListener('click', () => {
             if (sidebarCollapsed) toggleSidebar();
         });
     }

     // [DISABLED_FOR_WEDDING_VERSION]: Change Template button replaced by View Your Pages button.
     // const changeTemplateBtn = document.getElementById('change-template-btn');
     // if (changeTemplateBtn) {
     //     changeTemplateBtn.addEventListener('click', () => {
     //         showChangeTemplateConfirm();
     //     });
     // }
     
    // Dark mode toggle button
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', () => {
            toggleDarkMode();
            updateDarkModeDropdownState();
        });
    }
    
    // Theme selector button (sidebar – kept for compatibility, currently commented out in HTML)
    const themeSelectorButton = document.getElementById('theme-selector-button');
    if (themeSelectorButton) {
        themeSelectorButton.addEventListener('click', openThemePanel);
    }

    // Topbar theme button (compact button in the top bar)
    const topbarThemeBtn = document.getElementById('topbar-theme-btn');
    if (topbarThemeBtn) {
        topbarThemeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!sidebarCollapsed) toggleSidebar();
            const panel = document.getElementById('theme-panel');
            if (panel && panel.classList.contains('show')) {
                closeThemePanel();
            } else {
                openThemePanel();
            }
        });
    }

    // Header selector button
    const headerSelectorButton = document.getElementById('header-selector-button');
    if (headerSelectorButton) {
        headerSelectorButton.addEventListener('click', () => {
            window.HeaderModal?.open();
        });
    }

    // Close header panel when clicking outside
    const headerPanel = document.getElementById('header-panel');
    if (headerPanel) {
        document.addEventListener('click', (e) => {
            if (headerPanel.classList.contains('show') &&
                !headerPanel.contains(e.target) &&
                headerSelectorButton && !headerSelectorButton.contains(e.target)) {
                window.HeaderModal?.close();
            }
        });

        // Close header panel when clicking inside the preview iframe
        const hpPreviewIframe = document.getElementById('preview-iframe');
        if (hpPreviewIframe) {
            window.addEventListener('blur', () => {
                setTimeout(() => {
                    if (document.activeElement === hpPreviewIframe &&
                        headerPanel.classList.contains('show')) {
                        window.HeaderModal?.close();
                    }
                }, 0);
            });
        }
    }

     // Theme panel close button
     const closeThemePanelButton = document.getElementById('close-theme-panel');
     if (closeThemePanelButton) {
         closeThemePanelButton.addEventListener('click', closeThemePanel);
     }

    // Theme panel reset badge: return to the first theme the template had
    const themePanelResetBtn = document.getElementById('theme-panel-reset');
    if (themePanelResetBtn && typeof selectTheme === 'function') {
        themePanelResetBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!initialTheme || currentTheme === initialTheme) return;
            selectTheme(initialTheme, true);
        });
    }

     // Close theme panel when clicking outside
     const themePanel = document.getElementById('theme-panel');
     if (themePanel) {
         // Track if we just closed the custom theme modal
         let justClosedModal = false;
         
         document.addEventListener('click', (e) => {
             // Don't close if custom theme modal is open
             const customThemeModal = document.getElementById('custom-theme-modal');
             const isModalOpen = customThemeModal && customThemeModal.classList.contains('show');

             // Don't close if clicking on onboarding step 1
             const onboardingStep1 = document.querySelector('#onboarding-overlay [data-step="1"]');
             const isOnboardingStep1Click = onboardingStep1 && onboardingStep1.contains(e.target);

             // Don't close when clicking the topbar theme button (it handles toggle itself)
             const topbarBtnClick = topbarThemeBtn && topbarThemeBtn.contains(e.target);
             // Don't close when clicking the sidebar theme selector (legacy, currently hidden)
             const sidebarBtnClick = themeSelectorButton && themeSelectorButton.contains(e.target);

             if (themePanel.classList.contains('show') &&
                 !themePanel.contains(e.target) &&
                 !topbarBtnClick &&
                 !sidebarBtnClick &&
                 !isModalOpen &&
                 !isOnboardingStep1Click) {
                 closeThemePanel();
             }
         });
         
         // Close theme panel when clicking inside the preview iframe
         // (iframe clicks don't bubble to parent document)
         const previewIframe = document.getElementById('preview-iframe');
         if (previewIframe) {
             // Detect when custom theme modal is closed
             const customThemeModal = document.getElementById('custom-theme-modal');
             if (customThemeModal) {
                 const observer = new MutationObserver((mutations) => {
                     mutations.forEach((mutation) => {
                         if (mutation.attributeName === 'class') {
                             const isOpen = customThemeModal.classList.contains('show');
                             // If modal just closed, set flag to prevent theme panel from closing
                             if (!isOpen && mutation.oldValue && mutation.oldValue.includes('show')) {
                                 justClosedModal = true;
                                 setTimeout(() => {
                                     justClosedModal = false;
                                 }, 300); // Give 300ms buffer
                             }
                         }
                     });
                 });
                 observer.observe(customThemeModal, { 
                     attributes: true, 
                     attributeOldValue: true,
                     attributeFilter: ['class']
                 });
             }
             
             window.addEventListener('blur', () => {
                 // Check if focus moved to the iframe
                 setTimeout(() => {
                     const customThemeModal = document.getElementById('custom-theme-modal');
                     const isModalOpen = customThemeModal && customThemeModal.classList.contains('show');
                     
                     // Don't close if we just closed the modal
                     if (document.activeElement === previewIframe && 
                         themePanel.classList.contains('show') &&
                         !isModalOpen &&
                         !justClosedModal) {
                         closeThemePanel();
                     }
                 }, 0);
             });
         }
     }
     
     // Viewport buttons
     const viewportButtons = document.querySelectorAll('.viewport-btn');
     viewportButtons.forEach(btn => {
         btn.addEventListener('click', () => {
             const viewport = btn.dataset.viewport;
             switchViewport(viewport);
         });
     });
     
     // Animation toggle (optional: panel may be hidden in simplified editor)
     const animationToggle = document.getElementById('animation-toggle');
     if (animationToggle) animationToggle.addEventListener('change', toggleAnimations);
     
     // Animate backgrounds toggle (optional: panel may be hidden in simplified editor)
     const animateBackgroundsToggle = document.getElementById('animate-backgrounds-toggle');
     if (animateBackgroundsToggle) animateBackgroundsToggle.addEventListener('change', toggleAnimateBackgrounds);
     
     // [DISABLED_FOR_WEDDING_VERSION]: Listener del toggle "Enable fullscreen transition" desactivado; la versión bodas no muestra esta opción.
    // // FullPage.js toggle
    // const fullpageToggle = document.getElementById('fullpage-toggle');
    // fullpageToggle.addEventListener('change', toggleFullPage);
     
     // FullPage.js advanced settings modal
     const advancedSettingsBtn = document.getElementById('fullpage-advanced-settings-btn');
     const advancedModal = document.getElementById('fullpage-advanced-modal');
     const advancedModalClose = document.getElementById('fullpage-advanced-modal-close');
     
     // Open modal
     if (advancedSettingsBtn && advancedModal) {
         advancedSettingsBtn.addEventListener('click', function() {
             advancedModal.classList.add('show');
             lucide.createIcons();
             
             // Initialize tooltips for help icons
             if (typeof tippy !== 'undefined') {
                 const helpIcons = advancedModal.querySelectorAll('.fullpage-help-icon');
                 helpIcons.forEach(icon => {
                     if (!icon._tippy) {
                         tippy(icon, {
                             placement: 'top',
                             arrow: true,
                             theme: 'custom',
                             animation: 'scale',
                             duration: [200, 150],
                             delay: [300, 0]
                         });
                     }
                 });
                 
                 // Initialize tooltip for reset button
                 const resetBtn = document.getElementById('fullpage-navigation-color-reset');
                 if (resetBtn && !resetBtn._tippy) {
                     tippy(resetBtn, {
                         placement: 'top',
                         arrow: true,
                         theme: 'custom',
                         animation: 'scale',
                         duration: [200, 150],
                         delay: [300, 0]
                     });
                 }
             }
         });
     }
     
     // Close modal
     if (advancedModalClose && advancedModal) {
         advancedModalClose.addEventListener('click', function() {
             advancedModal.classList.remove('show');
         });
     }
     
     // Close modal when clicking outside
     if (advancedModal) {
         advancedModal.addEventListener('click', function(e) {
             if (e.target === advancedModal) {
                 advancedModal.classList.remove('show');
             }
         });
     }
     
     // Advanced settings inputs
     const scrollSpeed = document.getElementById('fullpage-scroll-speed');
     const scrollSpeedValue = document.getElementById('fullpage-scroll-speed-value');
     const navigation = document.getElementById('fullpage-navigation');
     const navigationColor = document.getElementById('fullpage-navigation-color');
     const navigationColorValue = document.getElementById('fullpage-navigation-color-value');
     const navigationColorRow = document.getElementById('fullpage-navigation-color-row');
     const disableOnMobile = document.getElementById('fullpage-disable-mobile');
     const scrollBar = document.getElementById('fullpage-scrollbar');
     const motionFeel = document.getElementById('fullpage-motion-feel');
     
     // Update scroll speed value display
     function updateScrollSpeedDisplay() {
         if (scrollSpeed && scrollSpeedValue) {
             scrollSpeedValue.textContent = scrollSpeed.value + ' ms';
         }
     }
     
     // Track initial values for debounced settings
     let scrollSpeedInitialValue = null;
     let navigationColorInitialValue = null;
     
     if (scrollSpeed) {
         scrollSpeed.addEventListener('input', function() {
             // Store initial value on first input
             if (scrollSpeedInitialValue === null) {
                 scrollSpeedInitialValue = parseInt(scrollSpeed.value);
             }
             
             updateScrollSpeedDisplay();
             updateFullpageSettings();
             // Schedule preview update
             if (typeof window.scheduleFullpagePreviewUpdate === 'function') {
                 window.scheduleFullpagePreviewUpdate();
             }
         });
         
         // Save to history when user releases the slider (mouseup/touchend)
         scrollSpeed.addEventListener('change', function() {
             if (scrollSpeedInitialValue !== null) {
                 const finalValue = parseInt(scrollSpeed.value);
                 
                 if (scrollSpeedInitialValue !== finalValue && historyManager && typeof FullpageSettingsCommand !== 'undefined') {
                     const command = new FullpageSettingsCommand({
                         settingKey: 'scrollSpeed',
                         beforeValue: scrollSpeedInitialValue,
                         afterValue: finalValue,
                         label: 'FullPage scroll speed'
                     });
                     historyManager.executeCommand(command);
                 }
                 
                 scrollSpeedInitialValue = null;
             }
         });
         
         // Initialize display
         updateScrollSpeedDisplay();
     }
     
     // Make scroll speed value editable
     if (scrollSpeedValue) {
         scrollSpeedValue.style.cursor = 'pointer';
         let scrollSpeedEditInitialValue = null;
         
         scrollSpeedValue.addEventListener('click', function() {
             // Store initial value when starting to edit
             scrollSpeedEditInitialValue = parseInt(scrollSpeed.value);
             
             // Make it editable
             scrollSpeedValue.contentEditable = 'true';
             scrollSpeedValue.focus();
             
             // Select all text
             const range = document.createRange();
             range.selectNodeContents(scrollSpeedValue);
             const selection = window.getSelection();
             selection.removeAllRanges();
             selection.addRange(range);
         });
         
         function applyEditedValue() {
             scrollSpeedValue.contentEditable = 'false';
             
             // Extract numeric value from text (e.g., "1950 ms" -> 1950)
             const text = scrollSpeedValue.textContent.trim();
             const numericValue = parseInt(text.replace(/[^0-9]/g, ''), 10);
             
             if (!isNaN(numericValue)) {
                 // Clamp value between min and max
                 const min = parseInt(scrollSpeed.min, 10) || 100;
                 const max = parseInt(scrollSpeed.max, 10) || 3000;
                 const clampedValue = Math.max(min, Math.min(max, numericValue));
                 
                 // Update slider
                 scrollSpeed.value = clampedValue;
                 
                 // Update display and settings
                 updateScrollSpeedDisplay();
                 updateFullpageSettings();
                 
                 // Save to history via command pattern
                 if (scrollSpeedEditInitialValue !== null && scrollSpeedEditInitialValue !== clampedValue) {
                     if (historyManager && typeof FullpageSettingsCommand !== 'undefined') {
                         const command = new FullpageSettingsCommand({
                             settingKey: 'scrollSpeed',
                             beforeValue: scrollSpeedEditInitialValue,
                             afterValue: clampedValue,
                             label: 'FullPage scroll speed'
                         });
                         historyManager.executeCommand(command);
                     }
                 }
                 scrollSpeedEditInitialValue = null;
                 
                 // Schedule preview update
                 if (typeof window.scheduleFullpagePreviewUpdate === 'function') {
                     window.scheduleFullpagePreviewUpdate();
                 }
             } else {
                 // Invalid input, restore original value
                 updateScrollSpeedDisplay();
                 scrollSpeedEditInitialValue = null;
             }
         }
         
         scrollSpeedValue.addEventListener('blur', applyEditedValue);
         
         scrollSpeedValue.addEventListener('keydown', function(e) {
             if (e.key === 'Enter') {
                 e.preventDefault();
                 scrollSpeedValue.blur();
             } else if (e.key === 'Escape') {
                 e.preventDefault();
                 scrollSpeedValue.contentEditable = 'false';
                 updateScrollSpeedDisplay();
             }
         });
     }
     
     // Update navigation color display
     function updateNavigationColorDisplay() {
         if (navigationColor && navigationColorValue) {
             navigationColorValue.textContent = navigationColor.value;
         }
     }
     
     // Toggle navigation color picker visibility based on navigation toggle
     function updateNavigationColorVisibility() {
         if (navigation && navigationColorRow) {
             if (navigation.checked) {
                 navigationColorRow.style.display = 'flex';
             } else {
                 navigationColorRow.style.display = 'none';
             }
         }
     }
     
     if (navigation) {
         navigation.addEventListener('change', function() {
             const beforeValue = !navigation.checked;
             const afterValue = navigation.checked;
             
             updateFullpageSettings();
             updateNavigationColorVisibility();
             
             // Save to history via command pattern
             if (historyManager && typeof FullpageSettingsCommand !== 'undefined') {
                 const command = new FullpageSettingsCommand({
                     settingKey: 'navigation',
                     beforeValue,
                     afterValue,
                     label: 'FullPage navigation bullets'
                 });
                 historyManager.executeCommand(command);
             }
         });
         // Initialize visibility
         updateNavigationColorVisibility();
     }
     
     if (navigationColor) {
         navigationColor.addEventListener('focus', function() {
             // Store initial value when color picker opens
             navigationColorInitialValue = navigationColor.value;
         });
         
         navigationColor.addEventListener('input', function() {
             updateNavigationColorDisplay();
             updateFullpageSettings();
         });
         
         // Save to history only when user finishes selecting color and closes the picker (on blur)
         navigationColor.addEventListener('blur', function() {
             if (navigationColorInitialValue !== null && navigationColorInitialValue !== navigationColor.value) {
                 if (historyManager && typeof FullpageSettingsCommand !== 'undefined') {
                     const command = new FullpageSettingsCommand({
                         settingKey: 'navigationColor',
                         beforeValue: navigationColorInitialValue,
                         afterValue: navigationColor.value,
                         label: 'FullPage navigation color'
                     });
                     historyManager.executeCommand(command);
                 }
             }
             navigationColorInitialValue = null;
         });
         // Initialize display
         updateNavigationColorDisplay();
     }
     
     // Reset navigation color to default
     const navigationColorReset = document.getElementById('fullpage-navigation-color-reset');
     if (navigationColorReset && navigationColor) {
         navigationColorReset.addEventListener('click', function() {
             const beforeValue = navigationColor.value;
             const afterValue = '#333333';
             
             navigationColor.value = afterValue;
             updateNavigationColorDisplay();
             updateFullpageSettings();
             
             // Save to history via command pattern
             if (beforeValue !== afterValue && historyManager && typeof FullpageSettingsCommand !== 'undefined') {
                 const command = new FullpageSettingsCommand({
                     settingKey: 'navigationColor',
                     beforeValue,
                     afterValue,
                     label: 'Reset navigation color'
                 });
                 historyManager.executeCommand(command);
             }
         });
     }
     
     if (disableOnMobile) {
         disableOnMobile.addEventListener('change', function() {
             const beforeValue = !disableOnMobile.checked;
             const afterValue = disableOnMobile.checked;
             
             updateFullpageSettings();
             
             // Save to history via command pattern
             if (historyManager && typeof FullpageSettingsCommand !== 'undefined') {
                 const command = new FullpageSettingsCommand({
                     settingKey: 'disableOnMobile',
                     beforeValue,
                     afterValue,
                     label: 'FullPage disable on mobile'
                 });
                 historyManager.executeCommand(command);
             }
         });
     }
     
     if (scrollBar) {
         scrollBar.addEventListener('change', function() {
             const beforeValue = !scrollBar.checked;
             const afterValue = scrollBar.checked;
             
             updateFullpageSettings();
             
             // Save to history via command pattern
             if (historyManager && typeof FullpageSettingsCommand !== 'undefined') {
                 const command = new FullpageSettingsCommand({
                     settingKey: 'scrollBar',
                     beforeValue,
                     afterValue,
                     label: 'FullPage show scrollbar'
                 });
                 historyManager.executeCommand(command);
             }
         });
     }
     
     if (motionFeel) {
         let motionFeelInitialValue = motionFeel.value;
         
         motionFeel.addEventListener('focus', function() {
             // Store initial value when dropdown opens
             motionFeelInitialValue = motionFeel.value;
         });
         
         motionFeel.addEventListener('change', function() {
             const beforeValue = motionFeelInitialValue;
             const afterValue = motionFeel.value;
             
             updateFullpageSettings();
             
             // Save to history via command pattern
             if (beforeValue !== afterValue && historyManager && typeof FullpageSettingsCommand !== 'undefined') {
                 const command = new FullpageSettingsCommand({
                     settingKey: 'motionFeel',
                     beforeValue,
                     afterValue,
                     label: 'FullPage motion feel'
                 });
                 historyManager.executeCommand(command);
             }
             
             motionFeelInitialValue = afterValue;
             
             // Schedule preview update
             if (typeof window.scheduleFullpagePreviewUpdate === 'function') {
                 window.scheduleFullpagePreviewUpdate();
             }
         });
     }
     
     
     
     // Initialize advanced settings button visibility based on fullPage.js toggle state
    // [DISABLED_FOR_WEDDING_VERSION]: usa getElementById para no depender de la variable fullpageToggle (toggle oculto).
     const fullpageToggleEl = document.getElementById('fullpage-toggle');
     if (fullpageToggleEl && fullpageToggleEl.checked) {
         const advancedSettings = document.getElementById('fullpage-advanced-settings');
         if (advancedSettings) {
             advancedSettings.classList.remove('hidden');
         }
     }
     
     // Initialize history manager with context
     historyManager = new HistoryManager({
         isDeveloperMode: isDeveloperMode,
         isRestoring: false, // Will be set during restore
         isClearingDraft: false, // Will be set during draft clearing
         currentTheme: currentTheme,
         selectedSections: selectedSections,
         fullpageEnabled: fullpageEnabled,
         animationsEnabled: animationsEnabled,
         fullpageSettings: fullpageSettings,
         selectTheme: selectTheme,
         addSectionToPreview: addSectionToPreview,
         updateSectionCounter: updateSectionCounter
     });
     
     // Expose historyManager globally for debugging and testing
     window.historyManager = historyManager;
     
     // Make isRestoring accessible to history manager
     Object.defineProperty(historyManager.context, 'isRestoring', {
         get: () => isRestoring,
         set: (value) => { isRestoring = value; }
     });
     
     // Make fullpageSettings accessible to history manager (dynamically updated)
     Object.defineProperty(historyManager.context, 'fullpageSettings', {
         get: () => fullpageSettings,
         set: (value) => { fullpageSettings = value; }
     });
     
     // Make isClearingDraft accessible to history manager
     Object.defineProperty(historyManager.context, 'isClearingDraft', {
         get: () => isClearingDraft || false,
         set: (value) => { 
             if (typeof isClearingDraft !== 'undefined') {
                 isClearingDraft = value;
             }
         }
     });
     
     // Undo/Redo buttons
     const undoBtn = document.getElementById('undo-btn');
     const redoBtn = document.getElementById('redo-btn');
     if (undoBtn) {
         undoBtn.addEventListener('click', () => {
             if (historyManager) historyManager.undo();
         });
     }
     if (redoBtn) {
         redoBtn.addEventListener('click', () => {
             if (historyManager) historyManager.redo();
         });
     }
     
     // Keyboard shortcuts for undo/redo
     document.addEventListener('keydown', (e) => {
         // Ctrl+Z or Cmd+Z for undo
         if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
             e.preventDefault();
             if (historyManager) historyManager.undo();
         }
         // Ctrl+Shift+Z or Cmd+Shift+Z or Ctrl+Y for redo
         if ((e.ctrlKey || e.metaKey) && (
             (e.shiftKey && e.key.toLowerCase() === 'z') ||
             (!e.shiftKey && e.key.toLowerCase() === 'y')
         )) {
             e.preventDefault();
             if (historyManager) historyManager.redo();
         }
     });
     
     // Initialize tooltips for undo/redo buttons
     if (undoBtn) {
         tippy(undoBtn, {
             placement: 'bottom',
             arrow: true,
             theme: 'custom',
             animation: 'scale',
             duration: [200, 150],
             delay: [300, 0]
         });
     }
     if (redoBtn) {
         tippy(redoBtn, {
             placement: 'bottom',
             arrow: true,
             theme: 'custom',
             animation: 'scale',
             duration: [200, 150],
             delay: [300, 0]
         });
     }
     
     // Full-screen preview toggle
     const previewFullscreenBtn = document.getElementById('preview-fullscreen');
     previewFullscreenBtn.addEventListener('click', toggleFullscreenPreview);
     
     // Close full-screen button
     const closeFullscreenBtn = document.getElementById('close-fullscreen');
     closeFullscreenBtn.addEventListener('click', toggleFullscreenPreview);
     
     // Download page button - when not published: show publish modal; when published: "Published!" opens site, options in dropdown
     const downloadBtn = document.getElementById('download-page');
     const publishWrap = document.getElementById('publish-dropdown-wrap');
     const publishOptionsTrigger = document.getElementById('publish-options-trigger');
     const publishOptionsMenu = document.getElementById('publish-options-menu');

     downloadBtn.addEventListener('click', async (e) => {
         // When published: main button opens published website in new tab (do not unpublish)
         const slug = (publishWrap && publishWrap.dataset.viewWebsiteSlug) || downloadBtn.dataset.viewWebsiteSlug;
         if (slug) {
             const viewLink = document.getElementById('topbar-view-website-link');
             const href = viewLink ? viewLink.href : (new URL('shared.html?slug=' + encodeURIComponent(slug), window.location.href)).href;
             if (href && href !== '#') window.open(href, '_blank', 'noopener');
             return;
         }
         if (window.downloadOptionsHandler) {
             window.downloadOptionsHandler.showDownloadOptions();
         } else {
             downloadPage();
         }
     });

     if (publishOptionsTrigger && publishOptionsMenu) {
         publishOptionsTrigger.addEventListener('click', function (e) {
             e.stopPropagation();
             if (typeof closeUserMenu === 'function') closeUserMenu();
             const isOpen = publishOptionsMenu.classList.toggle('open');
             publishOptionsTrigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
             publishOptionsMenu.setAttribute('aria-hidden', !isOpen);
             if (isOpen) publishOptionsMenu.style.minWidth = Math.max(180, publishWrap ? publishWrap.offsetWidth : 180) + 'px';
         });
         publishOptionsMenu.querySelectorAll('[data-publish-action]').forEach(function (item) {
             item.addEventListener('click', async function (e) {
                 e.stopPropagation();
                 publishOptionsMenu.classList.remove('open');
                 publishOptionsTrigger.setAttribute('aria-expanded', 'false');
                 publishOptionsMenu.setAttribute('aria-hidden', 'true');
                 const action = item.getAttribute('data-publish-action');
                 const pageId = typeof currentPageId !== 'undefined' ? currentPageId : (window.pageManagerInstance && window.pageManagerInstance.currentPageId);
                 const slug = (publishWrap && publishWrap.dataset.viewWebsiteSlug) || downloadBtn.dataset.viewWebsiteSlug;

                 if (action === 'unpublish' && pageId && slug) {
                     openUnpublishWebsiteModal(pageId, slug);
                 } else if (action === 'copy-link' && slug) {
                     // Prefer the topbar published link (exact URL from server: subdomain, custom domain, or .local)
                     const topbarLink = document.getElementById('topbar-published-link');
                     let fullUrl = (topbarLink && topbarLink.href && topbarLink.href !== '#' && topbarLink.getAttribute('href') !== '#') ? topbarLink.href : null;
                     if (!fullUrl) {
                         // Build from slug: custom domain has a dot (e.g. mi-boda.com), subdomain does not
                         fullUrl = slug.indexOf('.') !== -1
                             ? 'https://' + slug
                             : 'https://' + slug + '.yeslovey.com';
                     }
                     function copyPublishLinkFallback(text) {
                         var ta = document.createElement('textarea');
                         ta.value = text;
                         ta.style.position = 'fixed';
                         ta.style.left = '-999999px';
                         ta.style.top = '-999999px';
                         document.body.appendChild(ta);
                         ta.focus();
                         ta.select();
                         try {
                             document.execCommand('copy');
                             if (typeof showToast === 'function') showToast('Link Copied!', 'Share link has been copied to your clipboard.', {});
                         } catch (e) {
                             if (typeof showToast === 'function') showToast('Copy Failed', 'Could not copy. Please copy the link manually.', {});
                         }
                         document.body.removeChild(ta);
                     }
                     if (navigator.clipboard && navigator.clipboard.writeText) {
                         navigator.clipboard.writeText(fullUrl).then(function () {
                             if (typeof showToast === 'function') showToast('Link Copied!', 'Share link has been copied to your clipboard.', {});
                         }).catch(function () { copyPublishLinkFallback(fullUrl); });
                     } else {
                         copyPublishLinkFallback(fullUrl);
                     }
                 } else if (action === 'change-domain' && window.downloadOptionsHandler) {
                     window.downloadOptionsHandler.showChangeDomainModal();
                 }
             });
         });
     }

     function closePublishOptionsMenu() {
         if (publishOptionsMenu && publishOptionsTrigger) {
             publishOptionsMenu.classList.remove('open');
             publishOptionsTrigger.setAttribute('aria-expanded', 'false');
             publishOptionsMenu.setAttribute('aria-hidden', 'true');
         }
     }
     window.closePublishOptionsMenu = closePublishOptionsMenu;

     // 1) Close when user clicks outside the dropdown (anywhere in document)
     document.addEventListener('click', function (e) {
         if (publishOptionsMenu && publishOptionsMenu.classList.contains('open') && !e.target.closest('.publish-dropdown-wrap')) {
             closePublishOptionsMenu();
         }
     });

     // 2) Close when user triggers another action: themes, account, share, preview, etc. (use capture so we run first)
     document.addEventListener('click', function (e) {
         if (!publishOptionsMenu || !publishOptionsMenu.classList.contains('open')) return;
         var target = e.target;
         if (target.closest('#topbar-theme-btn') || target.closest('#share-page') || target.closest('#preview-fullscreen') ||
             target.closest('#server-user-display') || target.closest('#clerk-user-button') || target.closest('.user-info') ||
             target.closest('#undo-btn') || target.closest('#redo-btn') || target.closest('.top-bar-left') || target.closest('.top-bar-center')) {
             closePublishOptionsMenu();
         }
     }, true);

     document.addEventListener('keydown', function (e) {
         if (e.key === 'Escape' && publishOptionsMenu && publishOptionsMenu.classList.contains('open')) {
             closePublishOptionsMenu();
         }
     });
     
     // Upgrade modal event listeners are now handled by upgrade-modal.js component
     // No need to set them up here as they're attached when the modal is loaded
     
     // Custom theme modal event listeners are now handled in custom-theme-manager.js
     
     // Initialize Tippy.js tooltips for all elements with data-tippy-content in the top-bar
     const topBarTooltips = document.querySelectorAll('.top-bar [data-tippy-content]');
     if (topBarTooltips.length > 0) {
         tippy(topBarTooltips, {
             placement: 'bottom',
             arrow: true,
             theme: 'custom',
             animation: 'scale',
             duration: [200, 150],
             delay: [300, 0]
         });
     }

     // Sidebar toggle (Pages) tooltip - placement right, same style as section-outline "Layout"
     const sidebarToggleBtn = document.getElementById('toggle-sidebar');
     if (sidebarToggleBtn && typeof tippy !== 'undefined' && !sidebarToggleBtn._tippy) {
         tippy(sidebarToggleBtn, {
             placement: 'right',
             arrow: true,
             theme: 'custom',
             content: sidebarToggleBtn.getAttribute('data-tippy-content') || 'Pages',
             animation: 'scale',
             duration: [200, 150],
             delay: [300, 0]
         });
     }
     
     // Initialize tooltips for lock icons (will be updated when sections are generated)
     function initializeLockTooltips() {
         const lockIcons = document.querySelectorAll('.section-lock');
         lockIcons.forEach(lock => {
             tippy(lock, {
                 placement: 'top',
                 arrow: true,
                 theme: 'custom',
                 animation: 'scale',
                 duration: [200, 150],
                 delay: [300, 0]
             });
         });
     }
     
     // Call this after sections are generated
     setTimeout(initializeLockTooltips, 1000);
     
     // Setup beforeunload backup
     window.addEventListener('beforeunload', (e) => {
         // If a save is in progress, prevent navigation and show confirmation
         // This ensures the user doesn't lose unsaved changes
         if (saveInProgress) {
             // Modern browsers ignore custom messages, but we still need to set returnValue
             e.preventDefault();
             e.returnValue = ''; // Chrome requires returnValue to be set
             return ''; // Some browsers require a return value
         }
         
         // If there's a pending save timeout (save scheduled but not started yet),
         // show confirmation and try to save immediately
         // Note: We can't wait for async operations in beforeunload, but we try to save
         // If user clicks "Cancel", they stay and the save can complete
         if (saveTimeout) {
             // Clear the timeout and try to save immediately
             clearTimeout(saveTimeout);
             saveTimeout = null;
             // Try to save immediately (fire-and-forget, we can't wait for completion)
             saveDraft();
             
             // Show confirmation dialog to give the save a chance to complete
             e.preventDefault();
             e.returnValue = ''; // Chrome requires returnValue to be set
             return ''; // Some browsers require a return value
         }
     });
     
     // Add event listeners to static category hover panel
     const categoryHoverPanel = document.getElementById('category-hover-panel');
     const closeBtn = categoryHoverPanel.querySelector('.category-hover-panel-close');
     const sectionsGrid = document.getElementById('category-sections-grid');
     
     // Close button
     closeBtn.addEventListener('click', hideCategoryPanel);
     
    // Background toggle function for category panel sections
    function toggleCategoryPanelBackgrounds(enabled) {
        const panel = document.getElementById('category-hover-panel');
        const sections = panel.querySelectorAll('section[id^="fp-theme"], footer[id^="fp-theme"]');
        sections.forEach(section => {
            if (enabled) {
                section.classList.add('has-bg-image');
            } else {
                section.classList.remove('has-bg-image');
            }
        });
         
         // Update thumbnail images for pro sections (non-paid users)
         const thumbnails = panel.querySelectorAll('.section-thumbnail');
         thumbnails.forEach(img => {
             const sectionItem = img.closest('.category-section-item');
             if (!sectionItem) return;
             
             const sectionId = sectionItem.dataset.section;
             const currentSrc = img.getAttribute('src');
             
             if (enabled) {
                 // Switch to -bg version if not already
                 if (!currentSrc.includes('-bg.jpg')) {
                     img.setAttribute('src', `screenshots/${sectionId}-bg.jpg`);
                 }
             } else {
                 // Switch to non-bg version
                 if (currentSrc.includes('-bg.jpg')) {
                     img.setAttribute('src', `screenshots/${sectionId}.jpg`);
                 }
             }
         });
     }
     
     // Tab click handlers
     const categoryTabs = categoryHoverPanel.querySelectorAll('.category-tab');
     categoryTabs.forEach(tab => {
         tab.addEventListener('click', function() {
             // Remove active class from all tabs
             categoryTabs.forEach(t => t.classList.remove('active'));
             // Add active class to clicked tab
             this.classList.add('active');
             
             // Toggle backgrounds based on tab
             const tabType = this.dataset.tab;
             if (tabType === 'background') {
                 toggleCategoryPanelBackgrounds(true);
             } else if (tabType === 'white') {
                 toggleCategoryPanelBackgrounds(false);
             }
         });
     });
     
     // Panel hover events
     categoryHoverPanel.addEventListener('mouseenter', () => {
         toggleSidebarVisibility(true);
     });
     
     categoryHoverPanel.addEventListener('mouseleave', (e) => {
         // Don't hide panel if it's in search mode
         if (categoryHoverPanel.dataset.searchMode === 'true') {
             return;
         }
         
         const relatedTarget = e.relatedTarget;
         // Add a small delay to handle border transitions
         setTimeout(() => {
             if (relatedTarget && !relatedTarget.closest('.category-item') && !relatedTarget.closest('.category-list-wrapper') && !relatedTarget.closest('.sidebar')) {
                 console.warn(relatedTarget);
                 hideCategoryPanel();
             }
         }, 10);
     });
     
     // Single delegated event listener for section clicks and template card preview
     sectionsGrid.addEventListener('click', (e) => {
         if (sectionsGrid.classList.contains('template-cards-grid')) {
             if (e.target.closest('.template-card-add-button')) {
                 e.preventDefault();
                 e.stopPropagation();
                 const card = e.target.closest('.template-card');
                 if (card) {
                     const id = card.dataset.templateId;
                     const styleKey = card.dataset.style || 'minimal';
                     const template = (templateStyles[styleKey] && templateStyles[styleKey].templates)
                         ? templateStyles[styleKey].templates.find(t => t.id === id)
                         : null;
                     if (template && template.url) insertFullTemplateIntoPreview(template);
                 }
                 return;
             }
             const card = e.target.closest('.template-card');
             if (card) {
                 e.preventDefault();
                 e.stopPropagation();
                 const id = card.dataset.templateId;
                 const styleKey = card.dataset.style || 'minimal';
                 const template = (templateStyles[styleKey] && templateStyles[styleKey].templates)
                     ? templateStyles[styleKey].templates.find(t => t.id === id)
                     : null;
                 const displayTemplate = template
                    ? { ...template, previewSrc: template.id ? 'templates/previews/template' + template.id + '.jpg' : '' }
                    : { id, name: (card.querySelector('.template-card-name') || {}).textContent || 'Template', previewSrc: id ? 'templates/previews/template' + id + '.jpg' : '' };
                 showTemplatePreviewFull(sectionsGrid, styleKey, displayTemplate);
                 return;
             }
         }
         const sectionItem = e.target.closest('.category-section-item');
         if (!sectionItem) return;
         
         const sectionId = parseInt(sectionItem.dataset.section);
         const section = sections.find(s => s.id === sectionId);
         
        // Don't trigger section selection if clicking on lock icon
        if (e.target.closest('.category-section-lock')) {
            e.stopPropagation();
            // [DISABLED_FOR_WEDDING_VERSION]: Upgrade modal on lock icon click removed — modal only
            // appears during onboarding (when user has no pages).
            // showUpgradeModal();
            return;
        }
         
         toggleSectionSelection(sectionItem, sectionId);
     });
     
     // Event delegation for category items
     const categoryList = document.getElementById('category-list');
     const categoryListWrapper = document.querySelector('.category-list-wrapper');
     
     // Variable to store the timeout for category hover
     let categoryHoverTimeout = null;
     
     // Guard: sidebar may be disabled; skip all hover listeners if elements are not present.
     if (categoryList && categoryListWrapper) {
     // Category item hover events. Template-first: all sidebar items are style filters (templates); showCategoryPanel branch kept for possible search/other use.
     categoryList.addEventListener('mouseenter', (e) => {
         // In onboarding mode, categories respond to click (not hover).
         if (window.isOnboardingMode) return;

         const categoryItem = e.target.closest('.category-item');
         if (categoryItem) {
             if (categoryHoverTimeout) clearTimeout(categoryHoverTimeout);
             const categoryKey = categoryItem.dataset.category;
             const isStyleFilter = categoryItem.dataset.isStyleFilter === 'true';
             categoryHoverTimeout = setTimeout(() => {
                 if (isStyleFilter) {
                     showStylePanel(categoryKey);
                 } else {
                     // [DISABLED_FOR_WEDDING_VERSION]: Section catalog not in main flow; only templates in sidebar.
                     const category = categories[categoryKey];
                     if (category) showCategoryPanel(categoryKey, category);
                 }
                 categoryHoverTimeout = null;
             }, CATEGORY_HOVER_DELAY_MS);
         }
     }, true); // Use capture phase to handle nested elements
     
     // Category list mouse leave
     categoryList.addEventListener('mouseleave', (e) => {
         // Clear any pending timeout
         if (categoryHoverTimeout) {
             clearTimeout(categoryHoverTimeout);
             categoryHoverTimeout = null;
         }
         
         // Don't hide panel if it's in search mode
         if (categoryHoverPanel.dataset.searchMode === 'true') {
             return;
         }
         
         const relatedTarget = e.relatedTarget;
         // Add a small delay to handle border transitions
         setTimeout(() => {
             if (relatedTarget && !relatedTarget.closest('.category-hover-panel') && !relatedTarget.closest('.category-list-wrapper') && !relatedTarget.closest('.sidebar')) {
                 console.log(relatedTarget);
                 hideCategoryPanel();
             }
         }, 10);
     });
     
     // Category list wrapper hover events for sidebar toggle
     categoryListWrapper.addEventListener('mouseenter', () => {
         toggleSidebarVisibility(true);
     });
     
     categoryListWrapper.addEventListener('mouseleave', (e) => {
         const relatedTarget = e.relatedTarget;
         if (relatedTarget && !relatedTarget.closest('.category-hover-panel')) {
             toggleSidebarVisibility(false);
         }
     });
     } // end if (categoryList && categoryListWrapper)
 });
