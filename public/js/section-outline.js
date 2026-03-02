/**
 * Section Outline Sidebar
 * Displays a collapsible sidebar with thumbnails of all sections in the preview
 * 
 * Features:
 * - Lazy loading: Only loads thumbnails when they're visible
 * - Event-driven sync: Thumbnails update when history is saved (efficient, no polling)
 * - Navigation: Click thumbnails to jump to sections (works with fullPage.js and regular scrolling)
 * - Performance: Updates triggered only on meaningful changes, with 500ms delay
 */

(function() {
    'use strict';

    let outlineObserver = null;
    let loadedOutlineSections = new Set();
    let sectionOutlineEnabled = false;
    let refreshTimeout = null; // Single timeout for refresh after history save
    let sortableInstance = null; // html5sortable instance
    let forceLoadTimeout = null; // Timeout for force-loading thumbnails
    let forceLoadRetries = 0; // Retry counter for force loading

    // Initialize the section outline sidebar
    function initSectionOutline() {
        // Create the outline sidebar HTML
        createOutlineSidebar();
        
        // Setup event listeners
        setupOutlineEventListeners();
        
        // Setup intersection observer for lazy loading
        setupOutlineIntersectionObserver();
        
        // Load sections from the preview
        loadSectionsIntoOutline();
        
        // Setup drag-and-drop sorting
        setupSortableFunctionality();
        
        // Listen for section changes in the preview
        setupPreviewListeners();
        
        // Register hook with history manager
        registerHistoryHook();
        
        // Listen for theme changes
        setupThemeListener();
        
        sectionOutlineEnabled = true;
    }

    // Apply the current theme to the outline sidebar
    function applyCurrentTheme() {
        const outlineList = document.getElementById('section-outline-list');
        if (!outlineList) return;

        // Get current theme from parent window
        const currentTheme = window.currentTheme;
        if (!currentTheme) return;

        // Remove old theme classes
        Array.from(outlineList.classList).forEach(cls => {
            if (cls.startsWith('theme-') || cls.startsWith('custom-theme-')) {
                outlineList.classList.remove(cls);
            }
        });

        // Add new theme class
        if (currentTheme && currentTheme.trim() !== '') {
            outlineList.classList.add(currentTheme);
        }
    }

    // Listen for theme changes in the preview
    function setupThemeListener() {
        window.addEventListener('message', function(event) {
            // Update sidebar theme when preview theme changes
            if (event.data && event.data.type === 'THEME_APPLIED') {
                setTimeout(() => {
                    applyCurrentTheme();
                    // Also refresh visible thumbnails to reflect new theme
                    scheduleRefresh();
                }, 100);
            }
        });
    }

    // Register a hook with the history manager to refresh thumbnails when history is saved
    function registerHistoryHook() {
        // Check if history manager exists
        if (!window.historyManager) {
            // Retry after a short delay if history manager isn't ready yet
            setTimeout(registerHistoryHook, 500);
            return;
        }

        // Add a callback that will be called after history is saved
        const originalSave = window.historyManager.save.bind(window.historyManager);
        
        window.historyManager.save = function() {
            // Call original save
            const result = originalSave();
            
            // After history is saved, refresh visible thumbnails with a delay
            scheduleRefresh();
            
            return result;
        };
    }

    // Schedule a refresh of visible thumbnails (debounced)
    function scheduleRefresh() {
        // Clear any pending refresh
        if (refreshTimeout) {
            clearTimeout(refreshTimeout);
        }

        // Schedule new refresh with 500ms delay for performance
        refreshTimeout = setTimeout(() => {
            refreshVisibleThumbnails();
            refreshTimeout = null;
        }, 500);
    }

    // Schedule a forced load of unloaded thumbnail items.
    // This is a safety net for when IntersectionObserver doesn't fire reliably.
    function scheduleForceLoad() {
        if (forceLoadTimeout) {
            clearTimeout(forceLoadTimeout);
        }
        forceLoadRetries = 0;

        // Wait for sidebar transition (300ms) + buffer
        forceLoadTimeout = setTimeout(() => {
            forceLoadUnloadedItems();
        }, 400);
    }

    // Iterate through all outline items and load any that haven't been loaded yet.
    // Retries up to 3 times if items still fail to load (e.g. iframe not ready).
    function forceLoadUnloadedItems() {
        const outlineList = document.getElementById('section-outline-list');
        if (!outlineList) return;

        const items = outlineList.querySelectorAll('.section-outline-item');
        let unloadedCount = 0;

        items.forEach(item => {
            const sectionNumber = item.dataset.section;
            if (!loadedOutlineSections.has(sectionNumber)) {
                loadOutlineSectionWhenVisible(item);
                // Check again after the (sync) load attempt
                if (!loadedOutlineSections.has(sectionNumber)) {
                    unloadedCount++;
                }
            }
        });

        // If some items still failed to load, retry with increasing delay
        if (unloadedCount > 0 && forceLoadRetries < 3) {
            forceLoadRetries++;
            forceLoadTimeout = setTimeout(() => {
                forceLoadUnloadedItems();
            }, 500 * forceLoadRetries);
        }
    }

    // Create the outline sidebar HTML structure
    function createOutlineSidebar() {
        const existingSidebar = document.getElementById('section-outline-sidebar');
        if (existingSidebar) {
            existingSidebar.remove();
        }

        const sidebar = document.createElement('div');
        sidebar.id = 'section-outline-sidebar';
        sidebar.className = 'section-outline-sidebar collapsed';
        
        sidebar.innerHTML = `
            <button class="section-outline-toggle" aria-label="Layout" data-tippy-content="Layout" data-tippy-placement="left" disabled>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-layers2-icon lucide-layers-2"><path d="M13 13.74a2 2 0 0 1-2 0L2.5 8.87a1 1 0 0 1 0-1.74L11 2.26a2 2 0 0 1 2 0l8.5 4.87a1 1 0 0 1 0 1.74z"/><path d="m20 14.285 1.5.845a1 1 0 0 1 0 1.74L13 21.74a2 2 0 0 1-2 0l-8.5-4.87a1 1 0 0 1 0-1.74l1.5-.845"/></svg>
            </button>
            <div class="section-outline-content">
                <div class="section-outline-header">
                    <h3 class="section-outline-title">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M3 3v18h18"/>
                            <path d="M18 17V9"/>
                            <path d="M13 17V5"/>
                            <path d="M8 17v-3"/>
                        </svg>
                        <span>Layout</span>
                    </h3>
                    <button class="section-outline-close" aria-label="Close outline">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div class="section-outline-list" id="section-outline-list">
                    <!-- Section thumbnails will be loaded here -->
                </div>
            </div>
        `;

        document.body.appendChild(sidebar);
        
        // Initialize tooltip for toggle button
        initializeToggleButtonTooltip();
        
        // Apply current theme after sidebar is added to DOM
        setTimeout(() => {
            applyCurrentTheme();
        }, 100);
    }

    // Setup event listeners for the sidebar
    function setupOutlineEventListeners() {
        const sidebar = document.getElementById('section-outline-sidebar');
        const toggleBtn = sidebar.querySelector('.section-outline-toggle');
        const closeBtn = sidebar.querySelector('.section-outline-close');

        // Toggle sidebar open/close
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');

            // If opening, refresh the sections
            if (!sidebar.classList.contains('collapsed')) {
                loadSectionsIntoOutline();
            }
        });

        // After the sidebar opening transition completes, force-load any
        // thumbnails that the IntersectionObserver may have missed
        sidebar.addEventListener('transitionend', (e) => {
            if (e.propertyName === 'transform' && !sidebar.classList.contains('collapsed')) {
                forceLoadUnloadedItems();
            }
        });

        // Close button
        closeBtn.addEventListener('click', () => {
            sidebar.classList.add('collapsed');
        });

        // Click outside to close (optional)
        document.addEventListener('click', (e) => {
            if (!sidebar.contains(e.target) && !sidebar.classList.contains('collapsed')) {
                // Only close if clicking outside and not on interactive elements
                if (!e.target.closest('.section-outline-sidebar')) {
                    // Don't auto-close for now to avoid interrupting workflow
                    // sidebar.classList.add('collapsed');
                }
            }
        });
    }

    // Setup drag-and-drop sorting using html5sortable
    function setupSortableFunctionality() {
        const outlineList = document.getElementById('section-outline-list');
        if (!outlineList || typeof sortable === 'undefined') {
            // Retry if sortable library isn't loaded yet
            setTimeout(setupSortableFunctionality, 500);
            return;
        }

        // Destroy existing instance if any
        if (sortableInstance) {
            sortable(outlineList, 'destroy');
        }

        // Initialize sortable with custom options
        sortableInstance = sortable(outlineList, {
            items: '.section-outline-item',
            handle: '.section-outline-thumbnail-wrapper',
            forcePlaceholderSize: true,
            placeholder: '<div class="section-outline-item-placeholder"></div>',
            hoverClass: 'sortable-over'
        });

        // Listen for sort events
        outlineList.addEventListener('sortupdate', handleSortUpdate);
    }

    // Handle when sections are reordered via drag and drop
    function handleSortUpdate(e) {
        const detail = e.detail;
        if (!detail || !detail.item) return;

        const item = detail.item;
        const oldIndex = detail.origin.index;
        const newIndex = detail.destination.index;

        // Don't do anything if position hasn't changed
        if (oldIndex === newIndex) return;

        console.log('Section reordered via drag:', { oldIndex, newIndex });

        // Get the section number of the moved item
        const sectionNumber = item.dataset.section;

        // Move the section in the preview iframe
        moveSectionInPreview(oldIndex, newIndex);
    }

    // Move a section in the preview iframe using Command Pattern
    function moveSectionInPreview(fromIndex, toIndex) {
        // Use the Command Pattern for proper undo/redo support
        if (window.historyManager && window.SectionReorderCommand && window.sectionCommandHelpers) {
            console.log('📝 Section reordered via drag: Using Command Pattern', { fromIndex, toIndex });
            
            const reorderCommand = new window.SectionReorderCommand({
                fromIndex: fromIndex,
                toIndex: toIndex,
                context: window.sectionCommandHelpers
            });
            
            window.historyManager.executeCommand(reorderCommand);
            
            // Refresh the outline to reflect new order
            setTimeout(() => {
                loadSectionsIntoOutline();
            }, 100);
        } else {
            console.warn('⚠️ Command Pattern not available - falling back to manual reorder');
            // Fallback: manual reorder (shouldn't happen in production)
            const previewIframe = document.getElementById('preview-iframe');
            if (!previewIframe || !previewIframe.contentWindow) {
                return;
            }

            const previewDoc = previewIframe.contentDocument || previewIframe.contentWindow.document;
            const previewContent = previewDoc.getElementById('preview-content');
            if (!previewContent) return;

            const sections = Array.from(previewDoc.querySelectorAll('.section'));
            if (!sections[fromIndex] || fromIndex === toIndex) return;

            const sectionToMove = sections[fromIndex];

            // Determine the reference element for insertion
            let referenceSection;
            if (toIndex > fromIndex) {
                // Moving down: insert after the target index
                referenceSection = sections[toIndex + 1] || null;
            } else {
                // Moving up: insert before the target index
                referenceSection = sections[toIndex];
            }

            // Move the section
            if (referenceSection) {
                previewContent.insertBefore(sectionToMove, referenceSection);
            } else {
                previewContent.appendChild(sectionToMove);
            }

            // Update section numbers
            updateSectionNumbers();

            // Save history (fallback)
            if (window.historyManager) {
                window.historyManager.save();
            }

            // Refresh the outline to reflect new order
            setTimeout(() => {
                loadSectionsIntoOutline();
            }, 100);
        }
    }

    // Update section data-section attributes after reordering
    function updateSectionNumbers() {
        const previewIframe = document.getElementById('preview-iframe');
        if (!previewIframe || !previewIframe.contentWindow) return;

        const previewDoc = previewIframe.contentDocument || previewIframe.contentWindow.document;
        const sections = previewDoc.querySelectorAll('.section');

        sections.forEach((section, index) => {
            section.setAttribute('data-section', index);
        });
    }

    // Setup intersection observer for lazy loading section thumbnails
    function setupOutlineIntersectionObserver() {
        const options = {
            root: document.querySelector('.section-outline-list'),
            rootMargin: '200px',
            threshold: 0
        };

        outlineObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    loadOutlineSectionWhenVisible(entry.target);
                } else {
                    unloadOutlineSectionWhenHidden(entry.target);
                }
            });
        }, options);
    }

    // Load sections from the preview iframe into the outline (template-first: use section, footer like preview; .section is added by preview init)
    function loadSectionsIntoOutline() {
        const previewIframe = document.getElementById('preview-iframe');
        if (!previewIframe || !previewIframe.contentWindow) {
            return;
        }

        const previewDoc = previewIframe.contentDocument || previewIframe.contentWindow.document;
        const sections = previewDoc.querySelectorAll('#preview-content section, #preview-content footer');
        
        const outlineList = document.getElementById('section-outline-list');
        if (!outlineList) return;

        // Clear existing items
        outlineList.innerHTML = '';
        loadedOutlineSections.clear();

        // Disconnect existing observer
        if (outlineObserver) {
            outlineObserver.disconnect();
        }

        // Create outline items for each section
        sections.forEach((section, index) => {
            const sectionNumber = section.getAttribute('data-section') || (index + 1);
            const outlineItem = createOutlineItem(section, sectionNumber, index);
            outlineList.appendChild(outlineItem);

            // Observe for lazy loading
            if (outlineObserver) {
                outlineObserver.observe(outlineItem);
            }
        });

        // Reinitialize sortable after loading sections
        setupSortableFunctionality();

        // Force load visible items after a delay to handle cases where
        // IntersectionObserver doesn't fire reliably (e.g. during sidebar
        // transition, or when root and items share the same transform)
        scheduleForceLoad();
    }

    // Create an outline item for a section
    function createOutlineItem(section, sectionNumber, index) {
        const outlineItem = document.createElement('div');
        outlineItem.className = 'section-outline-item';
        outlineItem.dataset.section = sectionNumber;
        outlineItem.dataset.index = index;

        outlineItem.innerHTML = `
            <div class="section-outline-actions fp-ui-theme">
                <button class="section-outline-action-btn move-up-btn" data-section="${sectionNumber}" title="Move up">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path fill-rule="evenodd" clip-rule="evenodd" d="M10.265 8.4a.375.375 0 0 0-.53 0l-4.793 4.792a.625.625 0 1 1-.884-.884l4.793-4.793a1.625 1.625 0 0 1 2.298 0l4.793 4.793a.625.625 0 1 1-.884.884l-4.793-4.793Z" fill="currentColor"/>
                    </svg>
                </button>
                <button class="section-outline-action-btn move-down-btn" data-section="${sectionNumber}" title="Move down">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path fill-rule="evenodd" clip-rule="evenodd" d="M10.265 11.101a.375.375 0 0 1-.53 0L4.942 6.308a.625.625 0 1 0-.884.884l4.793 4.793a1.625 1.625 0 0 0 2.298 0l4.793-4.793a.625.625 0 1 0-.884-.884l-4.793 4.793Z" fill="currentColor"/>
                    </svg>
                </button>
                <button class="section-outline-action-btn clone-btn" data-section="${sectionNumber}" title="Clone section">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                </button>
                <button class="section-outline-action-btn remove-btn" data-section="${sectionNumber}" title="Remove section">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                </button>
            </div>
            <div class="section-outline-thumbnail-wrapper">
                <div class="section-outline-loader">
                    <div class="loader-spinner"></div>
                </div>
                <div class="section-outline-thumbnail-content"></div>
            </div>
        `;

        // Click handler for navigation (only on thumbnail area)
        const thumbnailWrapper = outlineItem.querySelector('.section-outline-thumbnail-wrapper');
        
        thumbnailWrapper.addEventListener('click', (e) => {
            navigateToSection(index, sectionNumber);
            highlightActiveSection(outlineItem);
        });

        // Action button handlers
        const moveUpBtn = outlineItem.querySelector('.move-up-btn');
        const moveDownBtn = outlineItem.querySelector('.move-down-btn');
        const cloneBtn = outlineItem.querySelector('.clone-btn');
        const removeBtn = outlineItem.querySelector('.remove-btn');

        moveUpBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleMoveSection(sectionNumber, 'up');
        });

        moveDownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleMoveSection(sectionNumber, 'down');
        });

        cloneBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleCloneSection(sectionNumber);
        });

        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleRemoveSection(sectionNumber);
        });

        // Initialize tooltips for action buttons
        initializeActionButtonTooltips(outlineItem);

        return outlineItem;
    }

    // Initialize Tippy.js tooltip for toggle button (shared initialization with data attributes)
    function initializeToggleButtonTooltip() {
        if (typeof tippy === 'undefined') {
            return; // Tippy.js not loaded
        }

        const toggleButton = document.querySelector('.section-outline-toggle');
        if (!toggleButton || toggleButton._tippy) {
            return; // Already initialized or doesn't exist
        }

        const tooltipContent = toggleButton.getAttribute('data-tippy-content');
        const placement = toggleButton.getAttribute('data-tippy-placement') || 'left';

        if (tooltipContent) {
            tippy(toggleButton, {
                content: tooltipContent,
                placement: placement,
                arrow: true,
                theme: 'custom',
                animation: 'scale',
                duration: [200, 150],
                delay: [300, 0]
            });
        }
    }

    // Initialize Tippy.js tooltips for action buttons
    function initializeActionButtonTooltips(outlineItem) {
        if (typeof tippy === 'undefined') {
            return; // Tippy.js not loaded
        }

        const actionButtons = outlineItem.querySelectorAll('.section-outline-action-btn');
        actionButtons.forEach(button => {
            if (!button._tippy) {
                const tooltipContent = button.getAttribute('title');
                if (tooltipContent) {
                    // Remove title attribute to prevent default browser tooltip
                    button.removeAttribute('title');
                    
                    tippy(button, {
                        content: tooltipContent,
                        placement: 'right',
                        arrow: true,
                        theme: 'custom',
                        animation: 'scale',
                        duration: [200, 150],
                        delay: [400, 0]
                    });
                }
            }
        });
    }

    // Load section content when it becomes visible in the outline
    async function loadOutlineSectionWhenVisible(outlineItem) {
        const sectionNumber = outlineItem.dataset.section;
        const index = parseInt(outlineItem.dataset.index);

        // Check if already loaded
        if (loadedOutlineSections.has(sectionNumber)) {
            return;
        }

        const previewIframe = document.getElementById('preview-iframe');
        if (!previewIframe || !previewIframe.contentWindow) {
            return;
        }

        const previewDoc = previewIframe.contentDocument || previewIframe.contentWindow.document;
        const section = previewDoc.querySelectorAll('#preview-content section, #preview-content footer')[index];
        
        if (!section) return;

        const thumbnailContent = outlineItem.querySelector('.section-outline-thumbnail-content');
        const loader = outlineItem.querySelector('.section-outline-loader');

        try {
            // Clone the section content
            updateThumbnailContent(section, thumbnailContent);
            
            // Hide loader
            if (loader) {
                loader.style.display = 'none';
            }

            loadedOutlineSections.add(sectionNumber);
        } catch (error) {
            console.error('Error loading section thumbnail:', error);
            if (loader) {
                loader.innerHTML = '<span style="font-size: 10px;">Error</span>';
            }
        }
    }

    // Update thumbnail content from a section
    function updateThumbnailContent(section, thumbnailContent) {
        // Clone the section content
        const clonedSection = section.cloneNode(true);
        
        // Remove any section menus, edit buttons, etc.
        const menusToRemove = clonedSection.querySelectorAll('.section-menu, .edit-text-button, .image-edit-button, .remove-element-button, .fp-watermark');
        menusToRemove.forEach(menu => menu.remove());
        
        // Disable autoplay on video elements in thumbnails
        const videos = clonedSection.querySelectorAll('video');
        videos.forEach(video => {
            video.removeAttribute('autoplay');
            video.setAttribute('preload', 'none'); // Prevent any preloading
            video.pause(); // Also pause any videos that might have started
        });
        
        // Remove inline height style from the cloned section
        if (clonedSection.style && clonedSection.style.height) {
            clonedSection.style.removeProperty('height');
        }
        
        // Add the cloned content to the thumbnail
        thumbnailContent.innerHTML = '';
        thumbnailContent.appendChild(clonedSection);
    }

    // Refresh all visible (loaded) thumbnails
    function refreshVisibleThumbnails() {
        const previewIframe = document.getElementById('preview-iframe');
        if (!previewIframe || !previewIframe.contentWindow) {
            return;
        }

        const previewDoc = previewIframe.contentDocument || previewIframe.contentWindow.document;

        // Only update thumbnails that are currently loaded (visible)
        loadedOutlineSections.forEach(sectionNumber => {
            const outlineItem = document.querySelector(`.section-outline-item[data-section="${sectionNumber}"]`);
            if (!outlineItem) return;

            const sections = previewDoc.querySelectorAll('#preview-content section, #preview-content footer');
            const section = Array.from(sections).find(function(s) { return s.getAttribute('data-section') === sectionNumber; });
            if (!section) return;

            const thumbnailContent = outlineItem.querySelector('.section-outline-thumbnail-content');
            if (!thumbnailContent) return;

            try {
                updateThumbnailContent(section, thumbnailContent);
            } catch (error) {
                console.error('Error refreshing section thumbnail:', error);
            }
        });
    }

    // Unload section content when it goes out of view
    function unloadOutlineSectionWhenHidden(outlineItem) {
        const sectionNumber = outlineItem.dataset.section;

        if (!loadedOutlineSections.has(sectionNumber)) {
            return;
        }

        const thumbnailContent = outlineItem.querySelector('.section-outline-thumbnail-content');
        const loader = outlineItem.querySelector('.section-outline-loader');

        if (thumbnailContent) {
            thumbnailContent.innerHTML = '';
        }

        if (loader) {
            loader.style.display = 'flex';
            loader.innerHTML = '<div class="loader-spinner"></div>';
        }

        loadedOutlineSections.delete(sectionNumber);
    }

    // Navigate to a section in the preview
    // Editor view always uses regular scroll (fullpage.js only applies to full-screen preview)
    function navigateToSection(index, sectionNumber) {
        const previewIframe = document.getElementById('preview-iframe');
        if (!previewIframe || !previewIframe.contentWindow) {
            return;
        }

        const previewWindow = previewIframe.contentWindow;
        const previewDoc = previewIframe.contentDocument || previewWindow.document;

        // Always use regular scroll navigation in editor view
        const section = previewDoc.querySelectorAll('#preview-content section, #preview-content footer')[index];
        if (section) {
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    /**
     * Handle move section action
     * Triggers the section menu's move button to ensure proper history tracking
     */
    function handleMoveSection(sectionNumber, direction) {
        const button = getSectionMenuButton(sectionNumber, 'move', direction);
        if (button) {
            button.click();
        }
    }

    /**
     * Handle clone section action
     * Triggers the section menu's clone button to ensure proper history tracking
     */
    function handleCloneSection(sectionNumber) {
        const button = getSectionMenuButton(sectionNumber, 'clone');
        if (button) {
            button.click();
        }
    }

    /**
     * Handle remove section action
     * Triggers the section menu's remove button to ensure proper history tracking
     */
    function handleRemoveSection(sectionNumber) {
        const button = getSectionMenuButton(sectionNumber, 'remove');
        if (button) {
            button.click();
        }
    }

    /**
     * Get a section menu button from the preview iframe
     * @param {string|number} sectionNumber - The section number
     * @param {string} action - The action type: 'move', 'clone', or 'remove'
     * @param {string} direction - For move action: 'up' or 'down'
     * @returns {HTMLElement|null} The button element or null if not found
     */
    function getSectionMenuButton(sectionNumber, action, direction = null) {
        const previewIframe = document.getElementById('preview-iframe');
        if (!previewIframe || !previewIframe.contentWindow) {
            console.warn('Preview iframe not available');
            return null;
        }

        const previewDoc = previewIframe.contentDocument || previewIframe.contentWindow.document;
        const section = previewDoc.querySelector(`.section[data-section="${sectionNumber}"]`);
        
        if (!section) {
            console.warn(`Section ${sectionNumber} not found`);
            return null;
        }

        const sectionMenu = section.querySelector('.section-menu');
        if (!sectionMenu) {
            console.warn(`Section menu not found for section ${sectionNumber}`);
            return null;
        }

        // Find the appropriate button based on action type
        let button = null;
        switch (action) {
            case 'move':
                // Find move up or move down button
                const moveButtons = sectionMenu.querySelectorAll('button[onclick*="moveSection"]');
                button = Array.from(moveButtons).find(btn => {
                    const onclick = btn.getAttribute('onclick');
                    return onclick && onclick.includes(`'${direction}'`);
                });
                break;
            
            case 'clone':
                button = sectionMenu.querySelector('button[onclick*="cloneSection"]');
                break;
            
            case 'remove':
                button = sectionMenu.querySelector('.remove-section-button');
                break;
            
            default:
                console.warn(`Unknown action type: ${action}`);
                return null;
        }

        if (!button) {
            console.warn(`Button not found for action '${action}' on section ${sectionNumber}`);
        }

        return button;
    }

    // Highlight the active section in the outline
    function highlightActiveSection(outlineItem) {
        // Remove active class from all items
        const allItems = document.querySelectorAll('.section-outline-item');
        allItems.forEach(item => item.classList.remove('active'));

        // Add active class to clicked item
        if (outlineItem) {
            outlineItem.classList.add('active');
        }
    }

    // Inject template CSS into the app so outline thumbnails show template styles (template-first: thumbnails clone DOM from iframe but parent has no template CSS). css=null clears.
    function injectTemplateStylesForOutline(css) {
        var el = document.getElementById('template-styles-outline');
        if (!css || typeof css !== 'string') {
            if (el) { el.remove(); }
            return;
        }
        var scoped = css.replace(/#preview-content\.has-full-template/g, '.section-outline-thumbnail-content');
        if (!el) {
            el = document.createElement('style');
            el.id = 'template-styles-outline';
            document.head.appendChild(el);
        }
        el.textContent = scoped;
        refreshVisibleThumbnails();
    }

    // Setup listeners for preview changes
    function setupPreviewListeners() {
        // Listen for messages from the preview iframe
        window.addEventListener('message', function(event) {
            // Template CSS for outline thumbnails (from preview.php when full template is loaded)
            if (event.data && event.data.type === 'TEMPLATE_CSS_FOR_OUTLINE') {
                injectTemplateStylesForOutline(event.data.css);
                return;
            }

            // Refresh outline when sections are added/removed/reordered
            if (event.data && (
                event.data.type === 'sectionAdded' || 
                event.data.type === 'sectionDeleted' ||
                event.data.type === 'sectionReordered'
            )) {
                setTimeout(() => {
                    loadSectionsIntoOutline();
                }, 300);
            }

            // Update active highlight when section changes in fullPage.js
            if (event.data && event.data.type === 'fullpageAfterLoad') {
                const index = event.data.index;
                const outlineItems = document.querySelectorAll('.section-outline-item');
                if (outlineItems[index]) {
                    highlightActiveSection(outlineItems[index]);
                }
            }
        });

        // Refresh outline when iframe loads
        const previewIframe = document.getElementById('preview-iframe');
        if (previewIframe) {
            previewIframe.addEventListener('load', () => {
                setTimeout(() => {
                    if (sectionOutlineEnabled) {
                        loadSectionsIntoOutline();
                        applyCurrentTheme(); // Apply theme after iframe loads
                    }
                }, 500);
            });
        }

        // Refresh button (optional - could add to UI)
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + Shift + O to toggle outline
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'O') {
                e.preventDefault();
                const sidebar = document.getElementById('section-outline-sidebar');
                if (sidebar) {
                    sidebar.classList.toggle('collapsed');
                    if (!sidebar.classList.contains('collapsed')) {
                        loadSectionsIntoOutline();
                    }
                }
            }
        });
    }

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSectionOutline);
    } else {
        initSectionOutline();
    }

    // Export for external access if needed
    window.sectionOutline = {
        refresh: loadSectionsIntoOutline,
        refreshTheme: applyCurrentTheme,
        toggle: function() {
            const sidebar = document.getElementById('section-outline-sidebar');
            if (sidebar) {
                sidebar.classList.toggle('collapsed');
            }
        }
    };

})();

