let animationsEnabled = false;
let scrollAnimations = null;
const pendingTextUpdates = new Map();

// Si true, enlaces #id y formularios funcionan (vista fullscreen "ojo"). Si false, deshabilitados para edición.
let linksAndFormsEnabled = false;

// Load custom themes on page load
if (typeof loadCustomThemes !== 'undefined') {
    loadCustomThemes();
}

// Notify parent that preview iframe is ready to receive messages
// This is more reliable than just checking iframe.onload since deferred scripts
// execute after DOM is ready but this inline script runs immediately
window.parent.postMessage({
    type: 'PREVIEW_READY'
}, '*');
console.log('[Preview] PREVIEW_READY message sent to parent');

// Add click listener to notify parent when iframe is clicked
document.addEventListener('click', () => {
    window.parent.postMessage({
        type: 'IFRAME_CLICK'
    }, '*');
});

// Enlaces #id: en modo edición no hacen nada (para poder editar el texto). En vista preview (ojo) hacen scroll suave al destino.
// Usa fase capture para interceptar ANTES que los handlers inline del template (p. ej. smooth-scroll propio del template),
// que se registran directamente en el <a> y se ejecutarían primero en fase bubbling.
(function handleAnchorLinksInPreview() {
    const previewContent = document.getElementById('preview-content');
    if (!previewContent) return;
    previewContent.addEventListener('click', function(e) {
        const a = e.target.closest('a[href^="#"]');
        if (!a) return;
        const href = (a.getAttribute('href') || '').trim();
        if (href === '#' || href === '') return;
        const id = href.slice(1);
        if (!id) return;
        e.preventDefault();
        // stopPropagation evita que el handler inline del template llegue a ejecutarse
        e.stopPropagation();
        if (!linksAndFormsEnabled) return; // Modo edición: no hacer scroll.
        const target = previewContent.querySelector('#' + CSS.escape(id));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, true); // true = fase capture: se ejecuta antes que los listeners del propio elemento
})();

// Evitar que el clic en un <label for="..."> enfoque el input asociado en el preview,
// para que el usuario pueda hacer clic en el label y editar su texto sin que el foco salte al placeholder del input.
(function preventLabelFocusInPreview() {
    const previewContent = document.getElementById('preview-content');
    if (!previewContent) return;
    previewContent.addEventListener('click', function(e) {
        const label = e.target.closest('label[for]');
        if (!label) return;
        e.preventDefault();
    }, true);
})();

// [PREVIEW_EDIT_MODE]: Deshabilitar envío y validación de formularios en el preview (solo cuando no es vista page=).
(function disableFormSubmitInPreview() {
    const previewContent = document.getElementById('preview-content');
    if (!previewContent) return;
    previewContent.addEventListener('click', function(e) {
        if (linksAndFormsEnabled) return;
        const submitControl = e.target.closest('button[type="submit"], input[type="submit"]');
        if (!submitControl) return;
        e.preventDefault();
    }, true);
    previewContent.addEventListener('submit', function(e) {
        if (linksAndFormsEnabled) return;
        e.preventDefault();
    }, true);
})();

// Global keyboard shortcuts for undo/redo (when not in TinyMCE)
document.addEventListener('keydown', (e) => {
    // Only handle if NOT in a TinyMCE editor (TinyMCE has its own handlers)
    const target = e.target;
    const isInTinyMCE = target && (
        target.classList.contains('mce-content-body') ||
        target.hasAttribute('data-mce-bogus') ||
        target.closest('.mce-content-body')
    );
    
    // If in TinyMCE, let TinyMCE's custom shortcuts handle it
    if (isInTinyMCE) {
        return;
    }
    
    // Ctrl+Z or Cmd+Z for undo
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        if (window.parent && window.parent.historyManager) {
            window.parent.historyManager.undo();
        }
    }
    
    // Ctrl+Shift+Z or Cmd+Shift+Z or Ctrl+Y for redo
    if ((e.ctrlKey || e.metaKey) && (
        (e.shiftKey && e.key.toLowerCase() === 'z') ||
        (!e.shiftKey && e.key.toLowerCase() === 'y')
    )) {
        e.preventDefault();
        e.stopPropagation();
        if (window.parent && window.parent.historyManager) {
            window.parent.historyManager.redo();
        }
    }
});

// Overlay Opacity Control Event Handlers
document.addEventListener('click', (e) => {
    // Handle overlay opacity button clicks
    const opacityButton = e.target.closest('.overlay-opacity-button');
    if (opacityButton) {
        e.stopPropagation();
        const wrapper = opacityButton.closest('.overlay-opacity-wrapper');
        if (!wrapper) return;
        
        const dropdown = wrapper.querySelector('.overlay-opacity-dropdown');
        if (!dropdown) return;
        
        // Close the currently active overlay opacity dropdown if it's a different one
        const activeOpacityDropdown = document.querySelector('.overlay-opacity-dropdown.active');
        if (activeOpacityDropdown && activeOpacityDropdown !== dropdown) {
            // Check if value changed and save to history
            if (overlayOpacityActiveSection && overlayOpacityInitialValue !== null) {
                const currentOpacity = overlayOpacityActiveSection.getAttribute('data-overlay-opacity') || '0.6';
                
                // If value changed, save to history via command pattern
                if (overlayOpacityInitialValue !== currentOpacity) {
                    const sectionUid = overlayOpacityActiveSection.getAttribute('data-section-uid');
                    if (sectionUid) {
                        sendOpacityChangeCommand(
                            sectionUid,
                            parseFloat(overlayOpacityInitialValue),
                            parseFloat(currentOpacity)
                        );
                    }
                }
                
                // Clear the tracked values
                overlayOpacityInitialValue = null;
                overlayOpacityActiveSection = null;
            }
            
            activeOpacityDropdown.classList.remove('active');
        }
        
        // Close all other non-opacity dropdowns
        document.querySelectorAll('.bg-picker-dropdown, .bg-picker-img-dropdown').forEach(dd => {
            if (dd !== dropdown) {
                dd.classList.remove('active');
            }
        });
        
        // Check if dropdown was active before toggle (for history management)
        const wasActive = dropdown.classList.contains('active');
        
        // Toggle this dropdown
        dropdown.classList.toggle('active');
        
        // If opening, initialize the slider with current value
        if (dropdown.classList.contains('active')) {
            const section = wrapper.closest('.section');
            if (section) {
                const currentOpacity = section.getAttribute('data-overlay-opacity') || '0.6';
                const displayValue = Math.round(parseFloat(currentOpacity) * 100);
                const rangeInput = dropdown.querySelector('.opacity-range-input');
                const valueInput = dropdown.querySelector('.opacity-value-input');
                if (rangeInput) rangeInput.value = displayValue;
                if (valueInput) valueInput.value = displayValue;
                
                // Store initial value and section reference for history tracking
                overlayOpacityInitialValue = currentOpacity;
                overlayOpacityActiveSection = section;
            }
        } else if (wasActive) {
            // Dropdown was just closed - check if value changed and save to history
            if (overlayOpacityActiveSection && overlayOpacityInitialValue !== null) {
                const currentOpacity = overlayOpacityActiveSection.getAttribute('data-overlay-opacity') || '0.6';
                
                // If value changed, save to history via command pattern
                if (overlayOpacityInitialValue !== currentOpacity) {
                    const sectionUid = overlayOpacityActiveSection.getAttribute('data-section-uid');
                    if (sectionUid) {
                        sendOpacityChangeCommand(
                            sectionUid,
                            parseFloat(overlayOpacityInitialValue),
                            parseFloat(currentOpacity)
                        );
                    }
                }
                
                // Clear the tracked values
                overlayOpacityInitialValue = null;
                overlayOpacityActiveSection = null;
            }
        }
        return;
    }
    
    // Close opacity dropdown when clicking outside
    if (!e.target.closest('.overlay-opacity-wrapper')) {
        const activeOpacityDropdown = document.querySelector('.overlay-opacity-dropdown.active');
        if (activeOpacityDropdown) {
            // Dropdown is being closed - check if value changed and save to history
            if (overlayOpacityActiveSection && overlayOpacityInitialValue !== null) {
                const currentOpacity = overlayOpacityActiveSection.getAttribute('data-overlay-opacity') || '0.6';
                
                // If value changed, save to history via command pattern
                if (overlayOpacityInitialValue !== currentOpacity) {
                    const sectionUid = overlayOpacityActiveSection.getAttribute('data-section-uid');
                    if (sectionUid) {
                        sendOpacityChangeCommand(
                            sectionUid,
                            parseFloat(overlayOpacityInitialValue),
                            parseFloat(currentOpacity)
                        );
                    }
                }
                
                // Clear the tracked values
                overlayOpacityInitialValue = null;
                overlayOpacityActiveSection = null;
            }
            
            activeOpacityDropdown.classList.remove('active');
        }
    }
});

// Throttle opacity updates using requestAnimationFrame (per-section)
const pendingOpacityUpdates = new Map();

// Track initial opacity value when dropdown opens (for history management)
let overlayOpacityInitialValue = null;
let overlayOpacityActiveSection = null;

// Helper function to send opacity change command to history manager
function sendOpacityChangeCommand(sectionUid, beforeOpacity, afterOpacity) {
    if (window.parent && window.parent.postMessage) {
        window.parent.postMessage({
            type: 'COMMAND_OPACITY_CHANGE',
            data: {
                sectionUid,
                beforeOpacity,
                afterOpacity,
                label: 'Overlay opacity change'
            }
        }, '*');
    }
}

// Handle opacity range input changes
document.addEventListener('input', (e) => {
    if (e.target.classList.contains('opacity-range-input')) {
        const rangeInput = e.target;
        const displayValue = parseInt(rangeInput.value);
        const opacityValue = displayValue / 100; // Convert 0-100 to 0-1
        const sectionNumber = rangeInput.getAttribute('data-section');
        
        // Update the number input immediately (cheap operation)
        const dropdown = rangeInput.closest('.overlay-opacity-dropdown');
        if (dropdown) {
            const valueInput = dropdown.querySelector('.opacity-value-input');
            if (valueInput) {
                valueInput.value = displayValue;
            }
        }
        
        // Check if we already have a pending update for this section
        const hasScheduled = pendingOpacityUpdates.has(sectionNumber);
        
        // Store the latest update data for this section
        pendingOpacityUpdates.set(sectionNumber, opacityValue);
        
        // Schedule the expensive DOM update using RAF (only if not already scheduled)
        if (!hasScheduled) {
            requestAnimationFrame(() => {
                const latestOpacityValue = pendingOpacityUpdates.get(sectionNumber);
                if (latestOpacityValue !== undefined) {
                    // Find the section
                    const section = document.querySelector(`section[data-section="${sectionNumber}"]`);
                    if (section) {
                        // Apply the opacity using CSS custom property
                        section.style.setProperty('--overlay-opacity', latestOpacityValue);
                        
                        // Save the opacity value as a data attribute for persistence (as 0-1 value)
                        section.setAttribute('data-overlay-opacity', latestOpacityValue);
                    }
                    pendingOpacityUpdates.delete(sectionNumber);
                }
            });
        }
    }
    
    // Handle opacity number input changes
    if (e.target.classList.contains('opacity-value-input')) {
        const valueInput = e.target;
        let displayValue = parseInt(valueInput.value);
        
        // Clamp value between 0 and 100
        if (isNaN(displayValue)) displayValue = 60;
        if (displayValue < 0) displayValue = 0;
        if (displayValue > 100) displayValue = 100;
        
        const opacityValue = displayValue / 100; // Convert 0-100 to 0-1
        const sectionNumber = valueInput.getAttribute('data-section');
        
        // Update the range slider immediately (cheap operation)
        const dropdown = valueInput.closest('.overlay-opacity-dropdown');
        if (dropdown) {
            const rangeInput = dropdown.querySelector('.opacity-range-input');
            if (rangeInput) {
                rangeInput.value = displayValue;
            }
        }
        
        // Check if we already have a pending update for this section
        const hasScheduled = pendingOpacityUpdates.has(sectionNumber);
        
        // Store the latest update data for this section
        pendingOpacityUpdates.set(sectionNumber, opacityValue);
        
        // Schedule the expensive DOM update using RAF (only if not already scheduled)
        if (!hasScheduled) {
            requestAnimationFrame(() => {
                const latestOpacityValue = pendingOpacityUpdates.get(sectionNumber);
                if (latestOpacityValue !== undefined) {
                    // Find the section
                    const section = document.querySelector(`section[data-section="${sectionNumber}"]`);
                    if (section) {
                        // Apply the opacity using CSS custom property
                        section.style.setProperty('--overlay-opacity', latestOpacityValue);
                        
                        // Save the opacity value as a data attribute for persistence (as 0-1 value)
                        section.setAttribute('data-overlay-opacity', latestOpacityValue);
                    }
                    pendingOpacityUpdates.delete(sectionNumber);
                }
            });
        }
    }
});

// Handle opacity number input blur (ensure valid value)
document.addEventListener('blur', (e) => {
    if (e.target.classList.contains('opacity-value-input')) {
        const valueInput = e.target;
        let displayValue = parseInt(valueInput.value);
        
        // Clamp value between 0 and 100
        if (isNaN(displayValue)) displayValue = 60;
        if (displayValue < 0) displayValue = 0;
        if (displayValue > 100) displayValue = 100;
        
        // Update the input to show the clamped value
        valueInput.value = displayValue;
    }
}, true);

// Listen for messages from parent window
window.addEventListener('message', function(event) {
    const { type, data } = event.data;
    
    switch(type) {
        case 'ADD_SECTION':
            addSection(
                data.sectionNumber,
                data.html,
                data.animationsEnabled,
                data.skipScroll || false,
                data.skipTinyMCE || false,
                typeof data.insertIndex === 'number' ? data.insertIndex : null
            );
            break;
        case 'ADD_SECTIONS_BATCH':
            // Batch add all sections without scrolling for better performance
            if (data.sections && data.sections.length > 0) {
                data.sections.forEach((sectionData, index) => {
                    // Add each section with skipScroll=true to prevent scrolling during batch load
                    addSection(
                        sectionData.sectionNumber,
                        sectionData.html,
                        sectionData.animationsEnabled,
                        true, // skipScroll
                        false, // skipTinyMCE
                        null // insertIndex
                    );
                });
            }
            break;
        case 'REMOVE_SECTION':
            removeSection(data.sectionNumber, { skipNotify: true });
            break;
        case 'ADD_CLONED_SECTION':
            addClonedSection(data);
            break;
        case 'ADD_PARSED_SECTION':
            addParsedSection(data.html, data.index, data.skipTinyMCE || false);
            break;
        case 'MOVE_SECTION':
            moveSection({
                sectionNumber: data.sectionNumber,
                direction: data.direction,
                skipNotify: data.skipNotify || false
            });
            break;
        case 'REORDER_SECTION':
            reorderSection({
                fromIndex: data.fromIndex,
                toIndex: data.toIndex,
                skipNotify: data.skipNotify || false
            });
            break;
        case 'CLONE_SECTION':
            cloneSection(data.sectionNumber);
            break;
        case 'SET_THEME':
            setTheme(data.theme);
            break;
        case 'SET_VIEWPORT':
            setViewport(data.viewport);
            break;
        case 'TOGGLE_ANIMATIONS':
            animationsEnabled = data.enabled;
            // Update animation classes and initialize/destroy viewport animations
            updateAnimationClasses();
            break;
        case 'SCROLL_TO_TOP':
            scrollToTop();
            break;
        case 'CLEAR_ALL':
            clearAllSections();
            break;
        case 'CLEAR_SECTIONS_ONLY':
            clearSectionsOnly();
            break;
        case 'SET_TEMPLATE_STYLES':
            setTemplateStyles(data || {});
            break;
        case 'SET_TEMPLATE_SCRIPTS':
            setTemplateScripts(data || {});
            break;
        case 'RESTORE_TEMPLATE':
            restoreHistorySnapshot(data.fullHtml, data.animationsEnabled, data.templateHeadHtml);
            break;
        // [DISABLED_FOR_WEDDING_VERSION]: RESTORE_HISTORY reemplazado por RESTORE_TEMPLATE que usa fullHtml en vez de array de secciones.
        // case 'RESTORE_HISTORY':
        //     restoreHistorySnapshot(data.sections, data.animationsEnabled);
        //     break;
        case 'INSERT_FULL_TEMPLATE_HTML':
            insertFullTemplateHtml(data || {});
            break;
        case 'SET_FULLSCREEN':
            setFullscreenMode(data.enabled, data.scrollToTop, data.fullpageEnabled, data.fullpageSettings, data.animationsEnabled, data.animateBackgroundsEnabled);
            break;
        case 'SET_HEADER':
            setHeader(data.html, data.themeClass);
            break;
        case 'UPDATE_HEADER_CLASSES':
            updateHeaderClasses(data.prefix, data.value);
            break;
        case 'UPDATE_HEADER_CTA':
            updateHeaderCta(data.ctaType, data.ctaStyle);
            break;
        case 'REMOVE_HEADER':
            removeHeader();
            break;
        case 'GET_TEMPLATE_DATA':
            sendTemplateData(data);
            break;
        // [DISABLED_FOR_WEDDING_VERSION]: GET_SECTIONS_DATA reemplazado por GET_TEMPLATE_DATA que devuelve fullHtml del contenido completo.
        // case 'GET_SECTIONS_DATA':
        //     sendSectionsData(data);
        //     break;
        case 'INIT_CLOUDINARY':
            // Initialize Cloudinary for all existing sections (called after localStorage restore)
            if (window.cloudinaryImageEditor) {
                window.cloudinaryImageEditor.initializeExistingSections();
            }
            // Initialize inline video editor for all existing sections
            if (window.inlineVideoEditor) {
                window.inlineVideoEditor.initializeExistingSections();
            }
            // Initialize removable elements manager for all existing sections
            if (window.removableElementsManager) {
                window.removableElementsManager.initializeExistingSections();
            }
            // Initialize overlay opacity for all existing sections
            document.querySelectorAll('.section').forEach(section => {
                initOverlayOpacity(section);
            });
            // Refresh lazy background loader for all existing sections
            if (window.lazyBackgroundLoader) {
                window.lazyBackgroundLoader.refresh();
            }
            // Initialize TinyMCE IntersectionObserver and viewport management for restored sections
            if (window.tinyMCEEditor) {
                // Ensure IntersectionObserver is observing all restored sections
                if (window.tinyMCEEditor.observeExistingSections) {
                    window.tinyMCEEditor.observeExistingSections();
                }
                // Trigger viewport management to initialize editors for visible sections
                if (window.tinyMCEEditor.manageEditorsByViewport) {
                    setTimeout(() => {
                        window.tinyMCEEditor.manageEditorsByViewport();
                    }, 100);
                }
            }
            break;
        case 'TOGGLE_DARK_MODE':
            if (data.darkMode) {
                document.body.classList.add('dark-mode');
            } else {
                document.body.classList.remove('dark-mode');
            }
            break;
        case 'APPLY_TEXT_UPDATES':
            applyTextUpdates(data.sectionNumber, data.textUpdates);
            break;
        case 'INIT_TINYMCE_FOR_SECTION':
            initTinyMCEForSection(data.sectionNumber);
            break;
        case 'APPLY_BACKGROUND_STATE':
            if (window.sectionBackgroundPicker) {
                window.sectionBackgroundPicker.applyBackgroundState(
                    data.sectionNumber,
                    data.state,
                    { skipHistory: true, shouldScroll: data.shouldScroll || false }
                );
            }
            break;
        case 'APPLY_OPACITY_STATE':
            // Find section by unique UID (not data-section, as it's not unique)
            const targetSection = document.querySelector(`section[data-section-uid="${data.sectionUid}"]`);
            if (targetSection) {
                // Apply the opacity using CSS custom property
                targetSection.style.setProperty('--overlay-opacity', data.opacity);
                
                // Save the opacity value as a data attribute for persistence
                targetSection.setAttribute('data-overlay-opacity', data.opacity);
                
                // Scroll to section if requested (for undo/redo visibility)
                if (data.shouldScroll) {
                    targetSection.scrollIntoView({ behavior: 'auto', block: 'center' });
                }
            }
            break;
        case 'APPLY_IMAGE_STATE':
            if (window.cloudinaryImageEditor && window.cloudinaryImageEditor.applyImageState) {
                window.cloudinaryImageEditor.applyImageState(
                    data.imageUid,
                    data.state,
                    { 
                        skipHistory: true,
                        sectionNumber: data.sectionNumber,
                        beforeState: data.beforeState,
                        afterState: data.afterState,
                        shouldScroll: data.shouldScroll || false
                    }
                );
            }
            break;
        case 'APPLY_INLINE_VIDEO_STATE':
            window.inlineVideoEditor?.applyState(
                data.sectionNumber,
                data.videoUid,
                data.state,
                data.shouldScroll || false
            );
            break;
        case 'APPLY_TEXT_STATE':
            applyTextState(data.sectionNumber, data.elementId, data.content, data.shouldScroll || false);
            break;
        case 'RESTORE_ELEMENT':
            restoreElement(data);
            break;
        case 'REMOVE_ELEMENT':
            removeElementByCommand(data);
            break;
    }
});

function initOverlayOpacity(sectionElement) {
    if (!sectionElement) return;
    
    // Check if section has a saved overlay opacity value
    const savedOpacity = sectionElement.getAttribute('data-overlay-opacity');
    
    if (savedOpacity) {
        // Apply the saved opacity using CSS custom property
        sectionElement.style.setProperty('--overlay-opacity', savedOpacity);
    }
}

function addSection(sectionNumber, html, animationsEnabled, skipScroll = false, skipTinyMCE = false, insertIndex = null) {
    // Create a temporary div to parse the HTML and extract the section element
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    // Find the section or footer element in the parsed HTML (use tag names; .section is added later)
    let sectionElement = tempDiv.querySelector('section') || tempDiv.querySelector('footer');
    
    if (!sectionElement) {
        // If no section or footer element found, create one and wrap the content
        sectionElement = document.createElement('section');
        sectionElement.innerHTML = html;
    }
    
    // Add the section class and data attribute to the section element itself
    sectionElement.classList.add('section');
    sectionElement.setAttribute('data-section', sectionNumber);
    
    // Generate a unique instance ID for this section (for undo/redo element targeting)
    // Only add if not already present (e.g., from restored state)
    if (!sectionElement.hasAttribute('data-section-uid')) {
        sectionElement.setAttribute('data-section-uid', `${sectionNumber}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    }
    
    // Add data-bg attribute (default if not already set)
    if (!sectionElement.getAttribute('data-bg')) {
        sectionElement.setAttribute('data-bg', 'default');
    }
    
    // Save original background classes before any modifications
    if (window.sectionBackgroundPicker) {
        window.sectionBackgroundPicker.saveOriginalBackground(sectionElement);
    }
    
    // Add section menu inside the section element
    const menu = createSectionMenu(sectionNumber);
    sectionElement.appendChild(menu);
    adjustFirstSectionMenu();
    
    // Add to preview content
    const previewContent = document.getElementById('preview-content');
    let referenceNode = null;
    if (typeof insertIndex === 'number' && !Number.isNaN(insertIndex)) {
        // insertIndex es el índice entre secciones (sin contar nav); usar la lista de secciones para la posición correcta
        const sectionsInOrder = Array.from(previewContent.querySelectorAll(':scope > section, :scope > footer'));
        const targetAt = Math.max(0, Math.min(insertIndex, sectionsInOrder.length));
        referenceNode = sectionsInOrder[targetAt] || null;
    }
    if (referenceNode) {
        previewContent.insertBefore(sectionElement, referenceNode);
    } else {
        previewContent.appendChild(sectionElement);
    }
    
    // Apply any pending text updates for this section
    const pendingUpdates = pendingTextUpdates.get(String(sectionNumber));
    if (pendingUpdates) {
        applyTextUpdates(sectionNumber, pendingUpdates);
        pendingTextUpdates.delete(String(sectionNumber));
    }
    
    // Observe new section with viewport animations if enabled
    if (animationsEnabled && window.viewportAnimations) {
        // Viewport animations will automatically observe new elements
        window.viewportAnimations.startObserving();
    }
    
    // Initialize section-specific scripts
    if (window.SectionInitializer) {
        window.SectionInitializer.initSection(sectionElement);
    }
    
    // Initialize TinyMCE for the new section only if it's in viewport or adjacent (unless skipped or in fullscreen mode)
    const isFullscreen = document.body.classList.contains('fullscreen-mode');
    if (!skipTinyMCE && !isFullscreen && window.tinyMCEEditor) {
        // Always use initForSection for new sections - it handles IntersectionObserver registration
        // and viewport management automatically
        setTimeout(() => {
            if (window.tinyMCEEditor && window.tinyMCEEditor.initForSection) {
                window.tinyMCEEditor.initForSection(sectionElement);
            }
        }, 100);
    } else if (isFullscreen) {
        // If in fullscreen mode, ensure no TinyMCE attributes are present on the new section
        cleanTinyMCEContent(sectionElement);
    }
    
    // Initialize Cloudinary image editor for the new section
    if (window.cloudinaryImageEditor && window.cloudinaryImageEditor.initForSection) {
        setTimeout(() => {
            window.cloudinaryImageEditor.initForSection(sectionElement);
        }, 100);
    }
    
    // Initialize inline video editor for the new section
    if (window.inlineVideoEditor && window.inlineVideoEditor.initForSection) {
        setTimeout(() => {
            window.inlineVideoEditor.initForSection(sectionElement);
        }, 100);
    }
    
    // Initialize removable elements manager for the new section
    if (window.removableElementsManager && window.removableElementsManager.initForSection) {
        setTimeout(() => {
            window.removableElementsManager.initForSection(sectionElement);
        }, 100);
    }
    
    // Initialize lazy background loader for the new section
    if (window.lazyBackgroundLoader && window.lazyBackgroundLoader.initForSection) {
        window.lazyBackgroundLoader.initForSection(sectionElement);
    }
    
    // Initialize overlay opacity for the new section
    initOverlayOpacity(sectionElement);

    // Sincronizar navbar: restaurar enlace si la sección fue re-añadida (undo) — antes del return por skipScroll
    if (window.navbarSectionSync) window.navbarSectionSync.sync();
    
    // Skip scrolling if this is a history restoration (undo/redo)
    if (skipScroll) {
        return;
    }
    
    // Scroll the new section into view
    sectionElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    
    // Notify parent window about section addition (for outline sidebar)
    if (window.parent && window.parent !== window) {
        window.parent.postMessage({
            type: 'sectionAdded',
            sectionNumber: sectionNumber
        }, '*');
    }
}

/**
 * Add a parsed section from template HTML (without section number tracking)
 * Used for loading full HTML templates
 */
function addParsedSection(html, index, skipTinyMCE = false) {
    // Create a temporary div to parse the HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    // Find the section or footer element (use tag names; .section class is added below)
    let sectionElement = tempDiv.querySelector('section') || tempDiv.querySelector('footer');

    if (!sectionElement) {
        console.error('No section or footer element found in parsed HTML');
        return;
    }

    // Generate a unique section number based on current sections count
    const previewContent = document.getElementById('preview-content');
    const existingSections = previewContent.querySelectorAll('section, footer');
    const sectionNumber = existingSections.length + 1;

    // Add section class and data attributes
    sectionElement.classList.add('section');
    sectionElement.setAttribute('data-section', sectionNumber);

    // Generate unique instance ID
    sectionElement.setAttribute('data-section-uid', `${sectionNumber}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);

    // Add data-bg attribute if not present
    if (!sectionElement.getAttribute('data-bg')) {
        sectionElement.setAttribute('data-bg', 'default');
    }

    // Save original background classes
    if (window.sectionBackgroundPicker) {
        window.sectionBackgroundPicker.saveOriginalBackground(sectionElement);
    }

    // Add section menu
    const menu = createSectionMenu(sectionNumber);
    sectionElement.appendChild(menu);
    adjustFirstSectionMenu();

    // Add to preview content
    previewContent.appendChild(sectionElement);

    // Initialize section-specific scripts
    if (window.SectionInitializer) {
        window.SectionInitializer.initSection(sectionElement);
    }

    // Initialize TinyMCE
    const isFullscreen = document.body.classList.contains('fullscreen-mode');
    if (!skipTinyMCE && !isFullscreen && window.tinyMCEEditor) {
        setTimeout(() => {
            if (window.tinyMCEEditor && window.tinyMCEEditor.initForSection) {
                window.tinyMCEEditor.initForSection(sectionElement);
            }
        }, 100);
    } else if (isFullscreen) {
        cleanTinyMCEContent(sectionElement);
    }

    // Initialize Cloudinary image editor
    if (window.cloudinaryImageEditor && window.cloudinaryImageEditor.initForSection) {
        setTimeout(() => {
            window.cloudinaryImageEditor.initForSection(sectionElement);
        }, 100);
    }

    // Initialize inline video editor
    if (window.inlineVideoEditor && window.inlineVideoEditor.initForSection) {
        setTimeout(() => {
            window.inlineVideoEditor.initForSection(sectionElement);
        }, 100);
    }

    // Initialize removable elements manager
    if (window.removableElementsManager && window.removableElementsManager.initForSection) {
        setTimeout(() => {
            window.removableElementsManager.initForSection(sectionElement);
        }, 100);
    }

    // Initialize lazy background loader
    if (window.lazyBackgroundLoader && window.lazyBackgroundLoader.initForSection) {
        window.lazyBackgroundLoader.initForSection(sectionElement);
    }

    // Initialize overlay opacity
    initOverlayOpacity(sectionElement);

    // Notify parent window
    if (window.parent && window.parent !== window) {
        window.parent.postMessage({
            type: 'sectionAdded',
            sectionNumber: sectionNumber
        }, '*');
    }

    // Sincronizar navbar: restaurar enlace si la sección fue re-añadida
    if (window.navbarSectionSync) window.navbarSectionSync.sync();
}

function createSectionMenu(sectionNumber) {
    const menu = document.createElement('div');
    menu.className = 'section-menu fp-ui-theme';
    menu.innerHTML = `
        <button class="menu-button" onclick="cloneSection(this)" data-tippy-content="Clone section">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
        </button>
        <!-- Copy HTML option removed for simplified editor. To re-enable, uncomment the button below.
        <button class="menu-button" onclick="copySectionHTML(this)" data-tippy-content="Copy HTML">
            <svg width="16" height="16" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" fill="currentColor">
                <path d="M480 400L288 400C279.2 400 272 392.8 272 384L272 128C272 119.2 279.2 112 288 112L421.5 112C425.7 112 429.8 113.7 432.8 116.7L491.3 175.2C494.3 178.2 496 182.3 496 186.5L496 384C496 392.8 488.8 400 480 400zM288 448L480 448C515.3 448 544 419.3 544 384L544 186.5C544 169.5 537.3 153.2 525.3 141.2L466.7 82.7C454.7 70.7 438.5 64 421.5 64L288 64C252.7 64 224 92.7 224 128L224 384C224 419.3 252.7 448 288 448zM160 192C124.7 192 96 220.7 96 256L96 512C96 547.3 124.7 576 160 576L352 576C387.3 576 416 547.3 416 512L416 496L368 496L368 512C368 520.8 360.8 528 352 528L160 528C151.2 528 144 520.8 144 512L144 256C144 247.2 151.2 240 160 240L176 240L176 192L160 192z"/>
            </svg>
        </button>
        -->
        <button class="menu-button" onclick="moveSection(this, 'up')" data-tippy-content="Move section up">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="18 15 12 9 6 15"/>
            </svg>
        </button>
        <button class="menu-button" onclick="moveSection(this, 'down')" data-tippy-content="Move section down">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"/>
            </svg>
        </button>
        <div class="bg-picker-wrapper">
            <button class="menu-button bg-picker-button" data-section="${sectionNumber}" data-tippy-content="Change background">
                <span class="bg-picker-button-circle"></span>
            </button>
            <button class="menu-button bg-picker-img-button" data-section="${sectionNumber}" data-tippy-content="Edit background image">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-image"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><circle cx="9" cy="9" r="2"></circle><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path></svg>
                <span>Edit</span>
            </button>
            <div class="bg-picker-img-dropdown" data-section="${sectionNumber}">
                <div class="bg-picker-img-option" data-action="change-image" data-section="${sectionNumber}">
                    <span>Change Image</span>
                </div>
                <div class="bg-picker-img-option danger" data-action="remove-image" data-section="${sectionNumber}">
                    <span>Remove image</span>
                </div>
            </div>
            <div class="bg-picker-dropdown" data-section="${sectionNumber}">
                <div class="bg-picker-option" data-bg="default" data-section="${sectionNumber}">
                    <span class="bg-picker-color"></span>
                    <span class="bg-picker-label">Default</span>
                    <span class="bg-picker-value"></span>
                </div>
                <div class="bg-picker-option" data-bg="primary" data-section="${sectionNumber}" data-css-var="--primary-bg">
                    <span class="bg-picker-color" style="background: var(--primary-bg);"></span>
                    <span class="bg-picker-label">Primary</span>
                    <span class="bg-picker-value"></span>
                </div>
                <div class="bg-picker-option" data-bg="secondary" data-section="${sectionNumber}" data-css-var="--secondary-bg">
                    <span class="bg-picker-color" style="background: var(--secondary-bg);"></span>
                    <span class="bg-picker-label">Secondary</span>
                    <span class="bg-picker-value"></span>
                </div>
                <div class="bg-picker-option" data-bg="accent" data-section="${sectionNumber}" data-css-var="--accent-bg">
                    <span class="bg-picker-color" style="background: var(--accent-bg);"></span>
                    <span class="bg-picker-label">Accent</span>
                    <span class="bg-picker-value"></span>
                </div>
                <div class="bg-picker-option" data-bg="gradient-1" data-section="${sectionNumber}" data-css-var="--gradient-1">
                    <span class="bg-picker-color" style="background: var(--gradient-1);"></span>
                    <span class="bg-picker-label">Gradient 1</span>
                    <span class="bg-picker-value"></span>
                </div>
                <div class="bg-picker-option" data-bg="gradient-2" data-section="${sectionNumber}" data-css-var="--gradient-2">
                    <span class="bg-picker-color" style="background: var(--gradient-2);"></span>
                    <span class="bg-picker-label">Gradient 2</span>
                    <span class="bg-picker-value"></span>
                </div>
                <div class="bg-picker-option" data-bg="features2" data-section="${sectionNumber}" data-css-var="--features2-bg">
                    <span class="bg-picker-color" style="background: var(--features2-bg);"></span>
                    <span class="bg-picker-label">Gradient 3</span>
                    <span class="bg-picker-value"></span>
                </div>
                <div class="bg-picker-option" data-bg="none" data-section="${sectionNumber}">
                    <span class="bg-picker-label">None</span>
                </div>
            </div>
        </div>
        <div class="overlay-opacity-wrapper">
            <button class="menu-button overlay-opacity-button" data-section="${sectionNumber}" data-tippy-content="Adjust overlay opacity">
                <svg class="toolbar-icon fp-tooltip" data-placement="bottom" title="" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" data-original-title="Opacity"><g fill="currentColor" fill-rule="evenodd"><path d="M3 2h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm0 8h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1zm0 8h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1z"></path><path d="M11 2h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm0 8h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1zm0 8h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1z" opacity=".45"></path><path d="M19 2h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm0 8h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1zm0 8h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1z" opacity=".15"></path><path d="M7 6h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zm0 8h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1z" opacity=".7"></path><path d="M15 6h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zm0 8h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1z" opacity=".3"></path></g></svg>
            </button>
            <div class="overlay-opacity-dropdown" data-section="${sectionNumber}">
                <div class="opacity-control-header">
                    <span>Opacity</span>
                </div>
                <div class="opacity-slider-wrapper">
                    <input type="range" class="opacity-range-input" min="0" max="100" step="1" value="60" data-section="${sectionNumber}">
                    <input type="number" class="opacity-value-input" min="0" max="100" value="60" data-section="${sectionNumber}">
                </div>
            </div>
        </div>
        <button class="menu-button remove-section-button" onclick="removeSection(this)" data-tippy-content="Remove section">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
        </button>
    `;
    
    // Initialize Tippy.js for all menu buttons
    if (typeof tippy !== 'undefined') {
        const buttons = menu.querySelectorAll('.menu-button');
        buttons.forEach(button => {
            tippy(button, {
                placement: 'top',
                arrow: true,
                theme: 'custom',
                animation: 'scale',
                duration: [200, 150],
                delay: [300, 0]
            });
        });
    }
    
    // Initialize background picker for this menu
    if (window.sectionBackgroundPicker) {
        // Small delay to ensure CSS variables are available
        setTimeout(() => {
            window.sectionBackgroundPicker.initForSection(sectionNumber);
        }, 10);
    }
    
    // Apply current theme class to .bg-picker-color elements
    const currentTheme = Array.from(document.body.classList).find(cls =>
        cls.startsWith('theme-') || cls.startsWith('custom-theme-')
    );
    if (currentTheme) {
        const colorElements = menu.querySelectorAll('.bg-picker-color');
        colorElements.forEach(colorElement => {
            colorElement.classList.add(currentTheme);
        });
    }

    return menu;
}

/**
 * Marks the first .section in #preview-content with the class "is-first-section"
 * and removes it from all other sections. CSS uses this class to push the section
 * menu below the fixed navbar. Also sets --nav-height so the offset is calculated
 * correctly regardless of which template is loaded.
 * Must be called after adding, removing, or reordering sections, and on load.
 */
function adjustFirstSectionMenu() {
    const previewContent = document.getElementById('preview-content');
    if (!previewContent) return;

    // Remove the marker class from every section, then re-add it only to the first one.
    previewContent.querySelectorAll(':scope > .section').forEach((s, i) => {
        if (i === 0) {
            s.classList.add('is-first-section');
        } else {
            s.classList.remove('is-first-section');
        }
    });

    // Set --nav-height so the CSS calc() knows how far to push down.
    const nav = previewContent.querySelector('nav');
    const navHeight = nav ? nav.offsetHeight : 0;
    previewContent.style.setProperty('--nav-height', navHeight + 'px');
}

function removeSection(target, options = {}) {
    let section = null;
    let sectionNumber = null;
    const skipNotify = options.skipNotify === true;
    
    if (typeof target === 'object' && target !== null && typeof target.closest === 'function') {
        const button = target;
        const sectionMenu = button.closest('.section-menu');
        if (!sectionMenu) return;
        section = sectionMenu.closest('.section');
    } else {
        sectionNumber = target != null ? target.toString() : null;
        if (sectionNumber) {
            section = document.querySelector(`.section[data-section="${sectionNumber}"]`);
        }
    }
    
    if (!section) return;
    sectionNumber = sectionNumber || section.getAttribute('data-section');
    
    // If this is a user-initiated removal (not from a command), capture the HTML and position
    if (!skipNotify) {
        // Get the position before removing
        const allSections = Array.from(document.querySelectorAll('.section'));
        const removeIndex = allSections.indexOf(section);
        
        // Get the HTML of the section
        const sectionHTML = section.outerHTML;
        
        // Notify parent to create a command
        window.parent.postMessage({
            type: 'SECTION_REMOVED',
            data: {
                sectionNumber,
                html: sectionHTML,
                removeIndex
            }
        }, '*');
    } else {
        // Command-driven removal, just remove it
        section.remove();
        // Sincronizar navbar: ocultar enlace que apuntaba a esta sección
        if (window.navbarSectionSync) window.navbarSectionSync.sync();
        // Re-apply first-section menu offset (CSS :first-child handles it, but
        // this also clears any leftover inline top styles from the removed section's siblings)
        adjustFirstSectionMenu();
    }
    
    // Clean up TinyMCE for removed section
    if (window.tinyMCEEditor && window.tinyMCEEditor.destroyForSection) {
        window.tinyMCEEditor.destroyForSection(section);
    }
    
    // Notify parent window about section deletion (for outline sidebar)
    if (window.parent && window.parent !== window) {
        window.parent.postMessage({
            type: 'sectionDeleted',
            sectionNumber: sectionNumber
        }, '*');
    }
}

function cloneSection(button) {
    // Find section by traversing from button -> section-menu -> section
    const sectionMenu = button.closest('.section-menu');
    if (!sectionMenu) return;
    
    const section = sectionMenu.closest('.section');
    if (!section) return;
    
    const sectionNumber = section.getAttribute('data-section');
    
    if (section) {
        // Prepare the clone (but don't add it to DOM yet)
        const clone = section.cloneNode(true);
        const newSectionNumber = Date.now(); // Generate unique number
        clone.classList.remove('active');
        clone.setAttribute('data-section', newSectionNumber);
        // Generate a new unique UID for the duplicated section
        clone.setAttribute('data-section-uid', `${newSectionNumber}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
        
        // Preserve background settings
        const bgValue = section.getAttribute('data-bg') || 'default';
        clone.setAttribute('data-bg', bgValue);
        
        // Preserve original background if it exists
        const originalBg = section.getAttribute('data-original-bg');
        if (originalBg !== null) {
            clone.setAttribute('data-original-bg', originalBg);
        }
        
        // Update menu buttons - be more specific to avoid corrupting SVG content
        const menu = clone.querySelector('.section-menu');
        if (menu) {
            // Replace only in onclick attributes and data attributes, not in SVG content
            const buttons = menu.querySelectorAll('button');
            buttons.forEach(button => {
                // Update onclick attribute
                if (button.onclick) {
                    const onclickStr = button.getAttribute('onclick');
                    if (onclickStr) {
                        button.setAttribute('onclick', onclickStr.replace(sectionNumber, newSectionNumber));
                    }
                }
            });
            
            // Update data-section attributes in background picker
            const bgPickerWrapper = menu.querySelector('.bg-picker-wrapper');
            if (bgPickerWrapper) {
                const bgPickerButton = bgPickerWrapper.querySelector('.bg-picker-button');
                const bgPickerImgButton = bgPickerWrapper.querySelector('.bg-picker-img-button');
                const bgPickerDropdown = bgPickerWrapper.querySelector('.bg-picker-dropdown');
                const bgPickerImgDropdown = bgPickerWrapper.querySelector('.bg-picker-img-dropdown');
                const bgPickerOptions = bgPickerWrapper.querySelectorAll('.bg-picker-option');
                const bgPickerImgOptions = bgPickerWrapper.querySelectorAll('.bg-picker-img-option');
                if (bgPickerButton) bgPickerButton.setAttribute('data-section', newSectionNumber);
                if (bgPickerImgButton) bgPickerImgButton.setAttribute('data-section', newSectionNumber);
                if (bgPickerDropdown) bgPickerDropdown.setAttribute('data-section', newSectionNumber);
                if (bgPickerImgDropdown) bgPickerImgDropdown.setAttribute('data-section', newSectionNumber);
                bgPickerOptions.forEach(option => {
                    option.setAttribute('data-section', newSectionNumber);
                });
                bgPickerImgOptions.forEach(option => {
                    option.setAttribute('data-section', newSectionNumber);
                });
            }
            
            // Update data-section attributes for opacity button and dropdown (in overlay-opacity-wrapper)
            const overlayOpacityWrapper = menu.querySelector('.overlay-opacity-wrapper');
            if (overlayOpacityWrapper) {
                const overlayOpacityButton = overlayOpacityWrapper.querySelector('.overlay-opacity-button');
                const overlayOpacityDropdown = overlayOpacityWrapper.querySelector('.overlay-opacity-dropdown');
                const opacityRangeInput = overlayOpacityWrapper.querySelector('.opacity-range-input');
                if (overlayOpacityButton) overlayOpacityButton.setAttribute('data-section', newSectionNumber);
                if (overlayOpacityDropdown) overlayOpacityDropdown.setAttribute('data-section', newSectionNumber);
                if (opacityRangeInput) opacityRangeInput.setAttribute('data-section', newSectionNumber);
            }
        }
        
        // Get the insert position (index after the original section)
        const allSections = Array.from(document.querySelectorAll('.section'));
        const insertIndex = allSections.indexOf(section) + 1;
        
        // Clean up inline height styles before cloning
        if (clone.style.height) {
            clone.style.removeProperty('height');
            
            // Rebuild the style attribute to ensure it's reflected in outerHTML
            const styleProperties = [];
            for (let i = 0; i < clone.style.length; i++) {
                const prop = clone.style[i];
                const value = clone.style.getPropertyValue(prop);
                if (value) {
                    styleProperties.push(`${prop}: ${value}`);
                }
            }
            
            if (styleProperties.length > 0) {
                clone.setAttribute('style', styleProperties.join('; ') + ';');
            } else {
                clone.removeAttribute('style');
            }
        }
        
        // Get the HTML of the prepared clone
        const cloneHTML = clone.outerHTML;
        
        // Notify parent to create a command and execute it
        window.parent.postMessage({
            type: 'SECTION_CLONED',
            data: {
                originalSectionNumber: sectionNumber,
                newSectionNumber: newSectionNumber,
                html: cloneHTML,
                insertIndex: insertIndex
            }
        }, '*');
    }
}

function addClonedSection(data) {
    const { newSectionNumber, html, insertIndex } = data;
    
    // Create temporary container to parse HTML
    const temp = document.createElement('div');
    temp.innerHTML = html;
    const clone = temp.firstElementChild;
    
    if (!clone) return;
    
    const previewContent = document.getElementById('preview-content');
    const allSections = Array.from(document.querySelectorAll('.section'));
    
    // Insert at the specified index
    if (insertIndex >= 0 && insertIndex < allSections.length) {
        allSections[insertIndex].parentNode.insertBefore(clone, allSections[insertIndex]);
    } else {
        // Append to the end if index is out of bounds
        previewContent.appendChild(clone);
    }
    
    // Initialize section-specific scripts for the cloned section
    const menu = clone.querySelector('.section-menu');
    if (menu) {
        // Initialize Tippy.js for all menu buttons in the cloned section
        if (typeof tippy !== 'undefined') {
            const menuButtons = menu.querySelectorAll('.menu-button');
            menuButtons.forEach(button => {
                tippy(button, {
                    placement: 'top',
                    arrow: true,
                    theme: 'custom',
                    animation: 'scale',
                    duration: [200, 150],
                    delay: [300, 0]
                });
            });
        }
        
        // Initialize background picker for cloned section
        if (window.sectionBackgroundPicker) {
            window.sectionBackgroundPicker.initForSection(newSectionNumber);
        }
    }
    
    if (window.SectionInitializer) {
        window.SectionInitializer.initSection(clone);
    }
    
    // Initialize Cloudinary image editor for the cloned section
    if (window.cloudinaryImageEditor && window.cloudinaryImageEditor.initForSection) {
        window.cloudinaryImageEditor.initForSection(clone);
    }
    
    // Initialize inline video editor for the cloned section
    if (window.inlineVideoEditor && window.inlineVideoEditor.initForSection) {
        window.inlineVideoEditor.initForSection(clone);
    }
    
    // Initialize removable elements manager for the cloned section
    if (window.removableElementsManager && window.removableElementsManager.initForSection) {
        window.removableElementsManager.initForSection(clone);
    }
    
    // Initialize lazy background loader for the cloned section
    if (window.lazyBackgroundLoader && window.lazyBackgroundLoader.initForSection) {
        window.lazyBackgroundLoader.initForSection(clone);
    }
    
    // Scroll the new section into view
    clone.scrollIntoView({ behavior: 'smooth', block: 'start' });
    
    // Notify parent window about section addition (for outline sidebar)
    if (window.parent && window.parent !== window) {
        window.parent.postMessage({
            type: 'sectionAdded',
            sectionNumber: newSectionNumber
        }, '*');
    }

    // Sincronizar navbar: restaurar enlace si la sección clonada coincide con un id existente
    if (window.navbarSectionSync) window.navbarSectionSync.sync();
}

function moveSection(buttonOrData, direction) {
    let section = null;
    let sectionNumber = null;
    let skipNotify = false;
    
    // Check if called from button (user action) or data object (command)
    if (typeof buttonOrData === 'object' && buttonOrData !== null) {
        if (buttonOrData.closest && typeof buttonOrData.closest === 'function') {
            // Called from button click
            const sectionMenu = buttonOrData.closest('.section-menu');
            if (!sectionMenu) return;
            section = sectionMenu.closest('.section');
            if (!section) return;
            sectionNumber = section.getAttribute('data-section');
        } else if (buttonOrData.sectionNumber !== undefined) {
            // Called from command with data object
            sectionNumber = buttonOrData.sectionNumber;
            direction = buttonOrData.direction;
            skipNotify = buttonOrData.skipNotify === true;
            section = document.querySelector(`.section[data-section="${sectionNumber}"]`);
            if (!section) return;
        }
    }
    
    if (!section || !sectionNumber) return;
    
    // Check if move is possible
    const canMoveUp = direction === 'up' && section.previousElementSibling;
    const canMoveDown = direction === 'down' && section.nextElementSibling;
    
    if (!canMoveUp && !canMoveDown) return;
    
    // If this is a user-initiated move (not from a command), notify parent to create command
    if (!skipNotify) {
        window.parent.postMessage({
            type: 'SECTION_MOVED',
            data: { sectionNumber, direction }
        }, '*');
        return;
    }
    
    // Otherwise, perform the move (command-driven)
    if (direction === 'up' && section.previousElementSibling) {
        section.parentNode.insertBefore(section, section.previousElementSibling);
    } else if (direction === 'down' && section.nextElementSibling) {
        section.parentNode.insertBefore(section.nextElementSibling, section);
    }

    // Update is-first-section class after DOM change
    adjustFirstSectionMenu();
    
    // Scroll the moved section into view
    setTimeout(() => {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 200);
    
    // Notify parent window about section reordering (for outline sidebar)
    if (window.parent && window.parent !== window) {
        window.parent.postMessage({
            type: 'sectionReordered',
            sectionNumber: sectionNumber,
            direction: direction
        }, '*');
    }
}

// Reorder section via drag-and-drop (move from one index to another)
function reorderSection({ fromIndex, toIndex, skipNotify = false }) {
    const previewContent = document.getElementById('preview-content');
    if (!previewContent) return;
    
    const sections = Array.from(previewContent.querySelectorAll('.section'));
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
    const updatedSections = Array.from(previewContent.querySelectorAll('.section'));
    updatedSections.forEach((section, index) => {
        section.setAttribute('data-section', index);
    });
    adjustFirstSectionMenu();
    
    // Notify parent window about section reordering (for outline sidebar)
    if (!skipNotify && window.parent && window.parent !== window) {
        window.parent.postMessage({
            type: 'sectionReordered',
            fromIndex: fromIndex,
            toIndex: toIndex
        }, '*');
    }
}

function copySectionHTML(button) {
    // Find section by traversing from button -> section-menu -> section
    const sectionMenu = button.closest('.section-menu');
    if (!sectionMenu) return;
    
    const section = sectionMenu.closest('.section');
    if (!section) return;
    
    const sectionNumber = section.getAttribute('data-section');
    
    if (section) {
        // Find all contenteditable elements in THIS section only and remove their TinyMCE editors
        const removedElements = [];
        if (typeof tinymce !== 'undefined' && tinymce) {
            const editableElements = section.querySelectorAll('[contenteditable="true"]');
            editableElements.forEach(element => {
                // Get the editor ID from the element
                const editorId = element.id;
                if (editorId) {
                    const editor = tinymce.get(editorId);
                    if (editor) {
                        editor.remove();
                        // Clean up tracking so it can be reinitialized
                        if (window.tinyMCEEditor && window.tinyMCEEditor.initializedElements) {
                            window.tinyMCEEditor.initializedElements.delete(element);
                        }
                        removedElements.push(element);
                    }
                }
            });
        }
        
        // Clone the section to get clean HTML (without TinyMCE modifications)
        const sectionClone = section.cloneNode(true);
        
        // Remove the section-menu from the clone
        const menuElement = sectionClone.querySelector('.section-menu');
        if (menuElement) {
            menuElement.remove();
        }
        
        // Remove Grammarly elements before cleaning TinyMCE
        const grammarlyElements = sectionClone.querySelectorAll('grammarly-extension, grammarly-extension-vbars, [data-grammarly-shadow-root]');
        grammarlyElements.forEach(el => el.remove());
        
        // Clean TinyMCE attributes from the cloned content
        cleanTinyMCEContent(sectionClone);
        
        // Clean up inline height styles before copying
        if (sectionClone.style.height) {
            sectionClone.style.removeProperty('height');
            
            // Rebuild the style attribute to ensure it's reflected in outerHTML
            const styleProperties = [];
            for (let i = 0; i < sectionClone.style.length; i++) {
                const prop = sectionClone.style[i];
                const value = sectionClone.style.getPropertyValue(prop);
                if (value) {
                    styleProperties.push(`${prop}: ${value}`);
                }
            }
            
            if (styleProperties.length > 0) {
                sectionClone.setAttribute('style', styleProperties.join('; ') + ';');
            } else {
                sectionClone.removeAttribute('style');
            }
        }
        
        // Get the clean HTML
        const cleanHTML = sectionClone.outerHTML;
        
        // Reinitialize TinyMCE for THIS section only
        if (window.tinyMCEEditor && window.tinyMCEEditor.initForSection) {
            setTimeout(() => {
                window.tinyMCEEditor.initForSection(section);
            }, 100);
        }
        
        // Check if document is focused and clipboard API is available
        if (document.hasFocus() && navigator.clipboard && navigator.clipboard.writeText) {
            // Try modern clipboard API
            navigator.clipboard.writeText(cleanHTML).then(() => {
                // Show success feedback on the button
                showCopyButtonFeedback(sectionNumber);
            }).catch(err => {
                console.error('Failed to copy HTML: ', err);
                // Fallback for clipboard API failures
                fallbackCopyTextToClipboard(cleanHTML, sectionNumber);
            });
        } else {
            // Use fallback method if document is not focused or clipboard API not available
            fallbackCopyTextToClipboard(cleanHTML, sectionNumber);
        }
    }
}

function showCopyButtonFeedback(buttonOrSectionNumber) {
    let section = null;
    
    // Handle both button element and section number
    if (typeof buttonOrSectionNumber === 'object' && buttonOrSectionNumber !== null && buttonOrSectionNumber.closest) {
        // It's a button element
        const sectionMenu = buttonOrSectionNumber.closest('.section-menu');
        if (!sectionMenu) return;
        section = sectionMenu.closest('.section');
    } else {
        // It's a section number
        const sectionNumber = buttonOrSectionNumber;
        section = document.querySelector(`.section[data-section="${sectionNumber}"]`);
    }
    
    if (!section) return;
    
    const copyButton = section.querySelector('.section-menu button[onclick*="copySectionHTML"]');
    if (!copyButton) return;
    
    const originalIcon = copyButton.innerHTML;
    const originalColor = copyButton.style.color;
    
    // Change to checkmark icon and green color
    copyButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check-icon lucide-check"><path d="M20 6 9 17l-5-5"/></svg>
    `;
    copyButton.style.color = '#10b981'; // Green color
    
    // Add a subtle scale animation
    copyButton.style.transform = 'scale(1.1)';
    copyButton.style.transition = 'all 0.2s ease';
    
    // Reset after 1.5 seconds
    setTimeout(() => {
        copyButton.innerHTML = originalIcon;
        copyButton.style.color = originalColor;
        copyButton.style.transform = 'scale(1)';
    }, 1500);
}

function fallbackCopyTextToClipboard(text, sectionNumber) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showCopyButtonFeedback(sectionNumber);
        } else {
            console.error('Fallback copy command failed');
        }
    } catch (err) {
        console.error('Fallback copy failed: ', err);
    }
    
    document.body.removeChild(textArea);
}

function setTheme(theme) {
    const previewContent = document.getElementById('preview-content');

    // Remove all existing theme classes from body and re-apply
    document.body.className = document.body.className
        .split(' ')
        .filter(cls => !cls.startsWith('theme-') && !cls.startsWith('custom-theme-'))
        .join(' ');
    document.body.classList.add(theme);

    // Apply theme to preview-content (works for both section-based and full-template mode)
    if (previewContent) {
        previewContent.className = previewContent.className
            .split(' ')
            .filter(cls => !cls.startsWith('theme-') && !cls.startsWith('custom-theme-'))
            .join(' ');
        previewContent.classList.add(theme);
    }
    
    // Apply theme class to .bg-picker-color elements inside .bg-picker-dropdown
    document.querySelectorAll('.bg-picker-dropdown .bg-picker-color').forEach(colorElement => {
        Array.from(colorElement.classList).forEach(cls => {
            if (cls.startsWith('theme-') || cls.startsWith('custom-theme-')) {
                colorElement.classList.remove(cls);
            }
        });
        colorElement.classList.add(theme);
    });

    // If it's a custom theme that's not in the DOM yet, try to load it
    if (theme.startsWith('custom-theme-') && typeof loadCustomThemes !== 'undefined') {
        // Reload custom themes to ensure CSS is injected
        loadCustomThemes();
    }
    
    // Update color values in all background pickers after theme change
    if (window.sectionBackgroundPicker) {
        setTimeout(() => {
            window.sectionBackgroundPicker.updateAllColorValues();
        }, 100);
    }

    // Notify parent window about theme change (for outline sidebar)
    if (window.parent && window.parent !== window) {
        window.parent.postMessage({
            type: 'THEME_APPLIED',
            theme: theme
        }, '*');
    }
}

/**
 * Rewrite template CSS so body/html apply to #preview-content and template rules win over editor.
 */
function rewriteTemplateCssForPreview(cssText) {
    if (!cssText || typeof cssText !== 'string') return cssText;
    let out = cssText
        .replace(/(^|\})\s*:root\s*\{/gm, '$1:where(#preview-content) {')
        .replace(/(^|\})\s*html\s*\{/gm, '$1#preview-content {')
        .replace(/(^|\})\s*body\s*\{/gm, '$1#preview-content {')
        .replace(/(^|\})\s*body\s*,\s*html\s*\{/gm, '$1#preview-content {')
        .replace(/(^|\})\s*html\s*,\s*body\s*\{/gm, '$1#preview-content {');
    // min-height: auto y content-visibility: visible para templates ya se gestionan
    // desde preview.css con la regla #preview-content.has-full-template .section:not(footer).
    // No es necesario inyectarlo aquí; se deja el comentario para referencia futura.
    return out;
}

/**
 * Remove template-injected styles, scripts, and theme class from preview.
 */
function clearTemplateAssets() {
    const link = document.getElementById('template-stylesheet');
    if (link) link.remove();
    document.querySelectorAll('[data-template-asset="styles"]').forEach(el => el.remove());
    document.querySelectorAll('[data-template-asset="script"]').forEach(el => el.remove());

    const previewContent = document.getElementById('preview-content');
    if (previewContent) {
        previewContent.classList.remove('has-full-template');
        previewContent.className = previewContent.className
            .split(' ')
            .filter(cls => !cls.startsWith('theme-') && !cls.startsWith('custom-theme-'))
            .join(' ')
            .trim() || '@container preview-container';
        if (!previewContent.className) {
            previewContent.className = '@container preview-container';
        }
    }
}

/** Class names of loose divs that should be promoted to <section> (must match TemplateLoader.LOOSE_BLOCK_CLASSES). */
const LOOSE_BLOCK_CLASSES = ['parallax-quote'];

/**
 * Converts loose <div> elements that are direct children of a container and appear
 * AFTER the first <section>/<footer> sibling into proper <section> elements.
 * Only divs with an allowlisted class are converted. If the div has a CSS class with
 * a background-image URL, moves the URL to an inline style so the editor's background
 * picker (data-bg="true") can detect and modify it.
 * @param {Element} container - The element whose direct-children divs will be promoted
 */
function normalizeLooseBlocksInContainer(container) {
    let cssText = '';
    document.querySelectorAll('style').forEach(s => { cssText += (s.textContent || ''); });

    const bgUrlMap = new Map();
    const ruleRe = /\.([a-zA-Z0-9_-]+)\s*\{([^}]*)\}/gs;
    let rm;
    while ((rm = ruleRe.exec(cssText)) !== null) {
        const cls = rm[1];
        const urlMatch = /url\s*\(\s*(['"]?)([^'")\s]+)\1\s*\)/i.exec(rm[2]);
        if (urlMatch) bgUrlMap.set(cls, `url('${urlMatch[2]}')`);
    }

    let foundFirstSection = false;
    Array.from(container.children).forEach(el => {
        if (el.tagName === 'SECTION' || el.tagName === 'FOOTER') {
            foundFirstSection = true;
            return;
        }
        const hasAllowedClass = el.tagName === 'DIV' && LOOSE_BLOCK_CLASSES.some(c => el.classList.contains(c));
        if (!hasAllowedClass || !foundFirstSection) return;

        const section = document.createElement('section');
        Array.from(el.attributes).forEach(attr => section.setAttribute(attr.name, attr.value));
        while (el.firstChild) section.appendChild(el.firstChild);

        const classes = (el.getAttribute('class') || '').split(/\s+/).filter(Boolean);
        for (const cls of classes) {
            if (bgUrlMap.has(cls)) {
                const existing = (section.getAttribute('style') || '').trim();
                const sep = existing && !existing.endsWith(';') ? '; ' : '';
                section.setAttribute('style', `${existing}${sep}background-image: ${bgUrlMap.get(cls)};`);
                section.setAttribute('data-bg', 'true');
                section.setAttribute('data-overlay-by-var', 'true');

                // Inject a style AFTER the template styles so cascade order makes it win.
                // This overrides the template's hardcoded rgba() in ::before with the
                // --overlay-opacity variable, enabling the opacity slider to work.
                const overrideId = `overlay-override-${cls}`;
                if (!document.getElementById(overrideId)) {
                    const overrideStyle = document.createElement('style');
                    overrideStyle.id = overrideId;
                    overrideStyle.setAttribute('data-template-asset', 'styles');
                    overrideStyle.textContent = `.${cls}::before { background: rgba(0, 0, 0, var(--overlay-opacity, 0.6)); }`;
                    document.head.appendChild(overrideStyle);
                }
                break;
            }
        }

        container.replaceChild(section, el);
        console.log(`[preview] Loose <div.${el.className}> promoted to <section>`);
    });
}

/**
 * Insert full template HTML into preview (body content + styles + scripts).
 * Supports templates with external style.css and script.js; CSS is rewritten so body/html → #preview-content.
 */
function insertFullTemplateHtml(data) {
    const previewContent = document.getElementById('preview-content');
    if (!previewContent) return;

    if (typeof tinymce !== 'undefined' && tinymce) {
        try { tinymce.remove(); } catch (err) { console.log('TinyMCE remove:', err); }
    }
    if (window.tinyMCEEditor && window.tinyMCEEditor.initializedElements) {
        window.tinyMCEEditor.initializedElements.clear();
    }
    if (window.tinyMCEEditor && window.tinyMCEEditor.activeSections) {
        window.tinyMCEEditor.activeSections.clear();
    }
    if (window.removableElementsManager && window.removableElementsManager.destroy) {
        window.removableElementsManager.destroy();
        window.removableElementsManager = new RemovableElementsManager();
    }

    clearTemplateAssets();

    let styleHrefs = data.styleHrefs || [];
    const inlineStyles = data.inlineStyles || [];
    const scriptSrcs = data.scriptSrcs || [];
    const inlineScripts = data.inlineScripts || [];
    if (styleHrefs.length === 0 && inlineStyles.length === 0 && (data.templateStyleHrefsFallback || []).length > 0) {
        styleHrefs = data.templateStyleHrefsFallback;
    }

    previewContent.classList.add('has-full-template');

    styleHrefs.forEach((href, i) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.setAttribute('data-template-asset', 'styles');
        link.id = 'template-link-' + (i + 1);
        document.head.appendChild(link);
    });
    inlineStyles.forEach((css, i) => {
        const style = document.createElement('style');
        style.setAttribute('data-template-asset', 'styles');
        style.id = 'template-styles-inline-' + (i + 1);
        style.textContent = rewriteTemplateCssForPreview(css);
        document.head.appendChild(style);
    });

    previewContent.innerHTML = data.contentHtml || '';

    // Promote loose <div> blocks between sections to <section> elements
    normalizeLooseBlocksInContainer(previewContent);

    const sectionElements = previewContent.querySelectorAll('section, footer');
    sectionElements.forEach((sectionElement, index) => {
        const sectionNumber = (index + 1).toString();
        sectionElement.classList.add('section');
        sectionElement.setAttribute('data-section', sectionNumber);
        if (!sectionElement.hasAttribute('data-section-uid')) {
            sectionElement.setAttribute('data-section-uid', `${sectionNumber}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
        }
        if (sectionElement.style.height) sectionElement.style.removeProperty('height');
        if (!sectionElement.getAttribute('data-bg')) sectionElement.setAttribute('data-bg', 'default');
        if (window.sectionBackgroundPicker) {
            window.sectionBackgroundPicker.saveOriginalBackground(sectionElement);
            window.sectionBackgroundPicker.restoreBackgroundForSection(sectionElement);
        }
        if (!sectionElement.querySelector('.section-menu')) {
            sectionElement.appendChild(createSectionMenu(sectionNumber));
        }
        if (window.SectionInitializer) window.SectionInitializer.initSection(sectionElement);
        if (window.sectionBackgroundPicker) window.sectionBackgroundPicker.initForSection(sectionNumber);
    });
    adjustFirstSectionMenu();

    setTimeout(() => {
        if (window.tinyMCEEditor) {
            if (window.tinyMCEEditor.observeExistingSections) window.tinyMCEEditor.observeExistingSections();
            if (window.tinyMCEEditor.isViewportManagementEnabled) {
                window.tinyMCEEditor.manageEditorsByViewport();
            } else if (window.tinyMCEEditor.initForSection) {
                sectionElements.forEach(el => window.tinyMCEEditor.initForSection(el));
            }
        }
        if (window.cloudinaryImageEditor && window.cloudinaryImageEditor.initForSection) {
            sectionElements.forEach(el => window.cloudinaryImageEditor.initForSection(el));
        }
        if (window.inlineVideoEditor && window.inlineVideoEditor.initForSection) {
            sectionElements.forEach(el => window.inlineVideoEditor.initForSection(el));
        }
        if (window.inlineMapEditor && typeof window.inlineMapEditor.initAllMapContainers === 'function') {
            previewContent.querySelectorAll('.map-container').forEach(c => {
                c.removeAttribute('data-map-editor-initialized');
            });
            window.inlineMapEditor.initAllMapContainers();
        }
        if (window.inlineCountdownEditor && typeof window.inlineCountdownEditor.initAllCountdowns === 'function') {
            previewContent.querySelectorAll('section.countdown-section').forEach(s => {
                s.removeAttribute('data-countdown-editor-initialized');
            });
            window.inlineCountdownEditor.initAllCountdowns();
        }
        if (window.removableElementsManager && window.removableElementsManager.initializeExistingSections) {
            window.removableElementsManager.initializeExistingSections();
        }
        document.querySelectorAll('.section').forEach(el => initOverlayOpacity(el));
        if (window.lazyBackgroundLoader && window.lazyBackgroundLoader.refresh) window.lazyBackgroundLoader.refresh();
    }, 100);

    scriptSrcs.forEach(src => {
        const script = document.createElement('script');
        script.src = src;
        script.setAttribute('data-template-asset', 'script');
        document.body.appendChild(script);
    });
    inlineScripts.forEach(content => {
        const script = document.createElement('script');
        script.setAttribute('data-template-asset', 'script');
        script.textContent = content;
        document.body.appendChild(script);
    });

    // Sincronizar navbar con el estado inicial del template
    if (window.navbarSectionSync) window.navbarSectionSync.sync();
}

/**
 * Initialize sections when content was injected server-side (preview.php?template=...).
 * Adds .section, data-section, section-menu and runs SectionInitializer, TinyMCE, etc.
 */
function initServerRenderedTemplateContent() {
    const previewContent = document.getElementById('preview-content');
    if (!previewContent || previewContent.getAttribute('data-initial-template') !== '1') return;

    // Promote loose <div> blocks between sections to <section> elements
    normalizeLooseBlocksInContainer(previewContent);

    const sectionElements = previewContent.querySelectorAll('section, footer');
    if (!sectionElements.length) return;
    sectionElements.forEach((sectionElement, index) => {
        const sectionNumber = (index + 1).toString();
        sectionElement.classList.add('section');
        sectionElement.setAttribute('data-section', sectionNumber);
        if (!sectionElement.hasAttribute('data-section-uid')) {
            sectionElement.setAttribute('data-section-uid', `${sectionNumber}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
        }
        if (sectionElement.style.height) sectionElement.style.removeProperty('height');
        if (!sectionElement.getAttribute('data-bg')) sectionElement.setAttribute('data-bg', 'default');
        if (window.sectionBackgroundPicker) {
            window.sectionBackgroundPicker.saveOriginalBackground(sectionElement);
            window.sectionBackgroundPicker.restoreBackgroundForSection(sectionElement);
        }
        if (!sectionElement.querySelector('.section-menu')) {
            sectionElement.appendChild(createSectionMenu(sectionNumber));
        }
        if (window.SectionInitializer) window.SectionInitializer.initSection(sectionElement);
        if (window.sectionBackgroundPicker) window.sectionBackgroundPicker.initForSection(sectionNumber);
    });
    adjustFirstSectionMenu();
    setTimeout(() => {
        if (window.tinyMCEEditor) {
            if (window.tinyMCEEditor.observeExistingSections) window.tinyMCEEditor.observeExistingSections();
            if (window.tinyMCEEditor.isViewportManagementEnabled) {
                window.tinyMCEEditor.manageEditorsByViewport();
            } else if (window.tinyMCEEditor.initForSection) {
                sectionElements.forEach(el => window.tinyMCEEditor.initForSection(el));
            }
        }
        if (window.cloudinaryImageEditor && window.cloudinaryImageEditor.initForSection) {
            sectionElements.forEach(el => window.cloudinaryImageEditor.initForSection(el));
        }
        if (window.inlineVideoEditor && window.inlineVideoEditor.initForSection) {
            sectionElements.forEach(el => window.inlineVideoEditor.initForSection(el));
        }
        if (window.inlineMapEditor && typeof window.inlineMapEditor.initAllMapContainers === 'function') {
            const pc = document.getElementById('preview-content');
            if (pc) pc.querySelectorAll('.map-container').forEach(c => c.removeAttribute('data-map-editor-initialized'));
            window.inlineMapEditor.initAllMapContainers();
        }
        if (window.inlineCountdownEditor && typeof window.inlineCountdownEditor.initAllCountdowns === 'function') {
            const pc = document.getElementById('preview-content');
            if (pc) pc.querySelectorAll('section.countdown-section').forEach(s => s.removeAttribute('data-countdown-editor-initialized'));
            window.inlineCountdownEditor.initAllCountdowns();
        }
        if (window.removableElementsManager && window.removableElementsManager.initializeExistingSections) {
            window.removableElementsManager.initializeExistingSections();
        }
        document.querySelectorAll('.section').forEach(el => initOverlayOpacity(el));
        if (window.lazyBackgroundLoader && window.lazyBackgroundLoader.refresh) window.lazyBackgroundLoader.refresh();

        // Avisar al padre para que actualice el outline de secciones (insert de template con ?template=).
        try {
            if (window.parent !== window) {
                window.parent.postMessage({ type: 'OUTLINE_READY' }, '*');
            }
        } catch (e) {}

        // Sincronizar navbar con las secciones del template renderizado en servidor
        if (window.navbarSectionSync) window.navbarSectionSync.sync();
    }, 100);
}

/**
 * Apply template styles and theme class (SET_TEMPLATE_STYLES from parent).
 * data: { cssUrl, themeClass, styleHrefs }
 */
function setTemplateStyles(data) {
    clearTemplateAssets();

    const styleHrefs = data.styleHrefs || [];
    styleHrefs.forEach(href => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.setAttribute('data-template-asset', 'styles');
        document.head.appendChild(link);
    });

    if (data.cssUrl) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = data.cssUrl;
        link.id = 'template-stylesheet';
        document.head.appendChild(link);
    }

    const previewContent = document.getElementById('preview-content');
    if (previewContent && data.themeClass) {
        const base = previewContent.className
            .split(' ')
            .filter(cls => !cls.startsWith('theme-') && !cls.startsWith('custom-theme-'))
            .join(' ')
            .trim();
        previewContent.className = (base || '@container preview-container') + ' ' + data.themeClass;
    }
}

/**
 * Inject template scripts (SET_TEMPLATE_SCRIPTS from parent).
 * data: { jsUrl, scriptSrcs }
 */
function setTemplateScripts(data) {
    document.querySelectorAll('[data-template-asset="script"]').forEach(el => el.remove());
    const idLink = document.getElementById('template-script');
    if (idLink) idLink.remove();

    const scriptSrcs = data.scriptSrcs || [];
    if (data.jsUrl) scriptSrcs.unshift(data.jsUrl);

    scriptSrcs.forEach(src => {
        const script = document.createElement('script');
        script.src = src;
        script.setAttribute('data-template-asset', 'script');
        document.body.appendChild(script);
    });
}

function setViewport(viewport) {
    // Preserve critical classes (has-full-template, theme-*) while resetting viewport-specific ones.
    // Previously this overwrote ALL classes, destroying has-full-template and causing template
    // CSS variables (--blush, --forest, etc.) to stop resolving → colors broke on viewport switch.
    const container = document.getElementById('preview-content');
    const keepClasses = ['@container', 'preview-container'];
    container.classList.forEach(cls => {
        if (
            cls === 'has-full-template' ||
            cls.startsWith('theme-') ||
            cls.startsWith('custom-theme-')
        ) {
            keepClasses.push(cls);
        }
    });
    container.className = keepClasses.join(' ');

    // Track the active viewport on the body element
    document.body.setAttribute('data-view', viewport);
}

function clearAllSections() {
    const previewContent = document.getElementById('preview-content');
    
    // Remove all TinyMCE instances before clearing
    if (typeof tinymce !== 'undefined' && tinymce) {
        try {
            tinymce.remove();
        } catch (error) {
            console.log('Error removing TinyMCE instances:', error);
        }
    }
    
    // Clear the initialized elements tracking so elements can be re-initialized
    if (window.tinyMCEEditor && window.tinyMCEEditor.initializedElements) {
        window.tinyMCEEditor.initializedElements.clear();
    }
    
    // Clear active sections tracking
    if (window.tinyMCEEditor && window.tinyMCEEditor.activeSections) {
        window.tinyMCEEditor.activeSections.clear();
    }
    
    // Clean up removable elements manager
    if (window.removableElementsManager && window.removableElementsManager.destroy) {
        window.removableElementsManager.destroy();
        // Recreate the instance after destroying
        window.removableElementsManager = new RemovableElementsManager();
    }
    
    previewContent.innerHTML = '';
    clearTemplateAssets();
}

/**
 * Clear section content but keep template assets and has-full-template (for restore when draft has templateUrl).
 * Use when re-injecting sections so template CSS (--blush etc.) is not removed.
 */
function clearSectionsOnly() {
    const previewContent = document.getElementById('preview-content');
    if (!previewContent) return;

    if (typeof tinymce !== 'undefined' && tinymce) {
        try {
            tinymce.remove();
        } catch (error) {
            console.log('Error removing TinyMCE instances:', error);
        }
    }
    if (window.tinyMCEEditor && window.tinyMCEEditor.initializedElements) {
        window.tinyMCEEditor.initializedElements.clear();
    }
    if (window.tinyMCEEditor && window.tinyMCEEditor.activeSections) {
        window.tinyMCEEditor.activeSections.clear();
    }
    if (window.removableElementsManager && window.removableElementsManager.destroy) {
        window.removableElementsManager.destroy();
        window.removableElementsManager = new RemovableElementsManager();
    }
    // En templates completos, eliminar solo <section> y <footer> para preservar
    // elementos de estructura como <nav> que no son secciones editables.
    if (previewContent.classList.contains('has-full-template')) {
        previewContent.querySelectorAll('section, footer').forEach(el => el.remove());
    } else {
        previewContent.innerHTML = '';
    }
}

function restoreHistorySnapshot(fullHtml, animationsEnabled, templateHeadHtml) {
    const previewContent = document.getElementById('preview-content');

    // Eliminar todas las instancias de TinyMCE antes de reemplazar el HTML
    if (typeof tinymce !== 'undefined' && tinymce) {
        try {
            tinymce.remove();
        } catch (error) {
            console.log('Error removing TinyMCE instances:', error);
        }
    }

    // Limpiar tracking de elementos inicializados
    if (window.tinyMCEEditor && window.tinyMCEEditor.initializedElements) {
        window.tinyMCEEditor.initializedElements.clear();
    }

    if (window.tinyMCEEditor && window.tinyMCEEditor.activeSections) {
        window.tinyMCEEditor.activeSections.clear();
    }

    // Limpiar gestor de elementos removibles
    if (window.removableElementsManager && window.removableElementsManager.destroy) {
        window.removableElementsManager.destroy();
        window.removableElementsManager = new RemovableElementsManager();
    }

    // Inyectar assets del head del template (CSS, fuentes) si estan disponibles en el snapshot.
    // Esto permite restaurar la apariencia correcta del template sin depender de ?template= en la URL.
    if (templateHeadHtml) {
        injectTemplateHeadHtml(templateHeadHtml);
    }

    // Restaurar el HTML completo directamente (nav, sections, footer: todo incluido)
    previewContent.innerHTML = fullHtml || '';

    // Re-ejecutar scripts inline del body (innerHTML no los ejecuta automaticamente).
    // Esto restaura funcionalidades como scroll del nav, reveal-on-scroll y smooth scroll.
    reactivateBodyScripts(previewContent);

    // Notificar al outline del layout de secciones con los estilos actuales del template
    sendTemplateCssForOutline();

    // Re-sincronizar estado .scrolled del navbar: el scroll en el editor es #preview-content, no window.
    // Llamar varias veces (rAF + timeout) para asegurar que el layout ya se aplicó y el nav existe.
    function syncNavScrollState() {
        if (typeof window.__previewNavScrollUpdate === 'function') {
            window.__previewNavScrollUpdate();
        }
    }
    requestAnimationFrame(syncNavScrollState);
    requestAnimationFrame(function() { requestAnimationFrame(syncNavScrollState); });
    setTimeout(syncNavScrollState, 50);

    // Now add section menus and re-initialize TinyMCE for all sections
    const sectionElements = previewContent.querySelectorAll('.section');
    sectionElements.forEach((sectionElement) => {
        const sectionNumber = sectionElement.getAttribute('data-section');
        
        // Remove initialization markers to ensure fresh initialization
        sectionElement.removeAttribute('data-removable-initialized');
        
        // Ensure section has a unique UID (for backwards compatibility with old history entries)
        if (!sectionElement.hasAttribute('data-section-uid')) {
            sectionElement.setAttribute('data-section-uid', `${sectionNumber}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
        }
        
        // Clean up any inline height styles that might have been saved in history
        // (in case old history entries still have heights baked in)
        if (sectionElement.style.height) {
            sectionElement.style.removeProperty('height');
        }
        
        // Ensure data-bg attribute exists (default if not set)
        if (!sectionElement.getAttribute('data-bg')) {
            sectionElement.setAttribute('data-bg', 'default');
        }
        
        // Restore background class based on data-bg attribute
        if (window.sectionBackgroundPicker) {
            window.sectionBackgroundPicker.restoreBackgroundForSection(sectionElement);
        }
        
        // Add section menu if it doesn't exist
        if (sectionNumber && !sectionElement.querySelector('.section-menu')) {
            const menu = createSectionMenu(sectionNumber);
            sectionElement.appendChild(menu);
            adjustFirstSectionMenu();
        }
        
        // Initialize section-specific scripts
        if (window.SectionInitializer) {
            window.SectionInitializer.initSection(sectionElement);
        }
        
        // Initialize background picker for this section
        if (window.sectionBackgroundPicker) {
            window.sectionBackgroundPicker.initForSection(sectionNumber);
        }
    });
    
    // Re-initialize TinyMCE and Cloudinary for all editable content once DOM is ready
    setTimeout(() => {
        if (window.tinyMCEEditor) {
            // Full init (incl. nav) tras restore: el nav está fuera de .section y no se cubre con initForSection/manageEditorsByViewport
            window.tinyMCEEditor.initEditor();
        }
        // Use viewport-based management for sections (nav ya inicializado arriba)
        if (window.tinyMCEEditor) {
            // First, ensure IntersectionObserver is observing all restored sections
            if (window.tinyMCEEditor.observeExistingSections) {
                window.tinyMCEEditor.observeExistingSections();
            }
            
            if (window.tinyMCEEditor.isViewportManagementEnabled) {
                // Let viewport management handle initialization
                window.tinyMCEEditor.manageEditorsByViewport();
            } else if (window.tinyMCEEditor.initForSection) {
                // Fallback: initialize all sections if viewport management is disabled
                sectionElements.forEach((sectionElement) => {
                    window.tinyMCEEditor.initForSection(sectionElement);
                });
            }
        }
        
        if (window.cloudinaryImageEditor && window.cloudinaryImageEditor.initForSection) {
            sectionElements.forEach((sectionElement) => {
                window.cloudinaryImageEditor.initForSection(sectionElement);
            });
        }
        
        if (window.inlineVideoEditor && window.inlineVideoEditor.initForSection) {
            sectionElements.forEach((sectionElement) => {
                window.inlineVideoEditor.initForSection(sectionElement);
            });
        }

        if (window.inlineMapEditor && typeof window.inlineMapEditor.initAllMapContainers === 'function') {
            // Strip the stale attribute (saved into the HTML) so containers are re-initialized
            previewContent.querySelectorAll('.map-container').forEach(c => {
                c.removeAttribute('data-map-editor-initialized');
            });
            window.inlineMapEditor.initAllMapContainers();
        }
        if (window.inlineCountdownEditor && typeof window.inlineCountdownEditor.initAllCountdowns === 'function') {
            previewContent.querySelectorAll('section.countdown-section').forEach(s => {
                s.removeAttribute('data-countdown-editor-initialized');
            });
            window.inlineCountdownEditor.initAllCountdowns();
        }
        
        if (window.removableElementsManager && window.removableElementsManager.initForSection) {
            sectionElements.forEach((sectionElement) => {
                window.removableElementsManager.initForSection(sectionElement);
            });
        }
        
        // Refresh lazy background loader for restored sections
        if (window.lazyBackgroundLoader && window.lazyBackgroundLoader.refresh) {
            window.lazyBackgroundLoader.refresh();
        }
    }, 50);

    // Avisar al padre cuando el DOM ya tiene secciones y menus para que refresque el outline de secciones.
    try {
        if (window.parent !== window) {
            window.parent.postMessage({ type: 'RESTORE_TEMPLATE_DONE' }, '*');
        }
    } catch (e) {}
}

function scrollToTop() {
    const previewContent = document.getElementById('preview-content');
    previewContent.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

// Store fullpage API instance for fullscreen mode
let fullscreenFullpageApi = null;

/**
 * Set fullscreen mode with dynamic feature loading
 * @param {boolean} enabled - Whether fullscreen is enabled
 * @param {boolean} scrollToTop - Whether to scroll to top
 * @param {boolean} fullpageEnabled - Whether fullPage.js should be active
 * @param {boolean} animationsEnabled - Whether animations should be active
 */
function setFullscreenMode(enabled, scrollToTop = false, fullpageEnabled = false, fullpageSettings = null, animationsEnabled = false, animateBackgroundsEnabled = false) {
    // En preview (ojo) los enlaces #id y formularios funcionan; en el editor están desactivados.
    linksAndFormsEnabled = enabled;

    if (enabled) {
        document.body.classList.add('fullscreen-mode');
        
        // Force load all lazy backgrounds for fullscreen presentation
        if (window.lazyBackgroundLoader && window.lazyBackgroundLoader.forceLoadAll) {
            window.lazyBackgroundLoader.forceLoadAll();
        }
        
        // Scroll to top if requested
        if (scrollToTop) {
            window.scrollTo(0, 0);
        }
        
        // Add ESC key listener for fullscreen mode
        document.addEventListener('keydown', handleEscKey);
        
        // Destroy all TinyMCE instances when entering preview mode
        // Viewport management will be disabled to prevent reinitialization
        disableTinyMCE();
        
        // Apply animate-backgrounds class if enabled
        if (animateBackgroundsEnabled) {
            document.body.classList.add('animate-backgrounds');
        } else {
            document.body.classList.remove('animate-backgrounds');
        }
        
        // Apply fullpage.js if enabled
        if (fullpageEnabled) {
            loadAndInitializeFullpage(fullpageSettings, animationsEnabled, animateBackgroundsEnabled);
        } else if (animationsEnabled) {
            // Enable viewport animations if animations are on and fullpage is off
            enableViewportAnimationsForFullscreen();
        }
    } else {
        document.body.classList.remove('fullscreen-mode');
        
        // Remove ESC key listener
        document.removeEventListener('keydown', handleEscKey);
        
        // Clean up fullpage.js if it was loaded
        if (fullscreenFullpageApi) {
            fullscreenFullpageApi.destroy('all');
            fullscreenFullpageApi = null;
            document.body.classList.remove('fullpage-enabled');
            document.body.classList.remove('animations-enabled');
            
            // Restore overflow for regular scrolling
            const previewContent = document.getElementById('preview-content');
            if (previewContent) {
                previewContent.style.overflow = 'auto';
            }
            
            // Remove custom navigation color
            removeNavigationColor();
        }
        
        // Disable viewport animations for fullscreen
        disableViewportAnimationsForFullscreen();
        
        // Re-enable TinyMCE editing when exiting fullscreen
        enableTinyMCE();
        
        // Re-enable lazy background unloading (was disabled for fullscreen)
        if (window.lazyBackgroundLoader && window.lazyBackgroundLoader.enableUnloading) {
            window.lazyBackgroundLoader.enableUnloading();
        }
    }
}

/**
 * Load and initialize fullPage.js for fullscreen mode
 * @param {boolean} animationsEnabled - Whether animations should be enabled with fullPage.js
 * @param {boolean} animateBackgroundsEnabled - Whether background animations should be enabled
 */
function loadAndInitializeFullpage(fullpageSettings = null, animationsEnabled = false, animateBackgroundsEnabled = false) {
    console.log('[Fullscreen] loadAndInitializeFullpage called');
    
    // Check if fullPage.js is already loaded
    if (typeof fullpage !== 'undefined') {
        console.log('[Fullscreen] fullPage.js already loaded, initializing...');
        initializeFullpageForFullscreen(fullpageSettings, animationsEnabled, animateBackgroundsEnabled);
        return;
    }
    
    // Check if we're already loading fullPage.js (prevent duplicate loading)
    if (document.getElementById('fullpage-js-fullscreen')) {
        console.log('[Fullscreen] fullPage.js script already being loaded, waiting...');
        // Wait for the existing script to load
        const existingScript = document.getElementById('fullpage-js-fullscreen');
        existingScript.addEventListener('load', function() {
            initializeFullpageForFullscreen(fullpageSettings, animationsEnabled, animateBackgroundsEnabled);
        });
        return;
    }
    
    // Dynamically load fullPage.js CSS
    if (!document.getElementById('fullpage-css-fullscreen')) {
        const fullpageCss = document.createElement('link');
        fullpageCss.rel = 'stylesheet';
        fullpageCss.href = 'https://cdnjs.cloudflare.com/ajax/libs/fullPage.js/4.0.37/fullpage.min.css';
        fullpageCss.id = 'fullpage-css-fullscreen';
        document.head.appendChild(fullpageCss);
    }
    
    // Dynamically load fullPage.js script
    const fullpageScript = document.createElement('script');
    fullpageScript.src = 'public/js/fullpage.js';
    fullpageScript.id = 'fullpage-js-fullscreen';
    
    fullpageScript.onload = function() {
        console.log('[Fullscreen] fullPage.js script loaded successfully');
        // Small delay to ensure script is fully parsed and executed
        setTimeout(() => {
            if (typeof fullpage !== 'undefined') {
                initializeFullpageForFullscreen(fullpageSettings, animationsEnabled, animateBackgroundsEnabled);
            } else {
                console.error('[Fullscreen] fullPage.js loaded but fullpage is undefined');
            }
        }, 50);
    };
    
    fullpageScript.onerror = function(error) {
        console.error('[Fullscreen] Failed to load fullPage.js script:', error);
        // Remove fullpage-enabled class since we couldn't load
        document.body.classList.remove('fullpage-enabled');
    };
    
    console.log('[Fullscreen] Loading fullPage.js script...');
    document.head.appendChild(fullpageScript);
}

/**
 * Initialize fullPage.js for fullscreen mode
 * @param {object} fullpageSettings - FullPage.js configuration settings
 * @param {boolean} animationsEnabled - Whether animations should be enabled with fullPage.js
 * @param {boolean} animateBackgroundsEnabled - Whether background animations should be enabled
 */
function initializeFullpageForFullscreen(fullpageSettings = null, animationsEnabled = false, animateBackgroundsEnabled = false) {
    // Safety check: Only initialize if we're actually in fullscreen mode
    if (!document.body.classList.contains('fullscreen-mode')) {
        console.warn('[Fullscreen] Cannot initialize fullPage.js - not in fullscreen mode');
        return;
    }
    
    const previewContent = document.getElementById('preview-content');
    
    // Add fullpage-enabled class
    document.body.classList.add('fullpage-enabled');
    
    // Add animate-backgrounds class if enabled
    if (animateBackgroundsEnabled) {
        document.body.classList.add('animate-backgrounds');
    } else {
        document.body.classList.remove('animate-backgrounds');
    }
    
    // Add animations-enabled class if animations are on
    if (animationsEnabled) {
        // First remove any existing fullpage animation classes
        const sections = document.querySelectorAll('.section');
        sections.forEach(section => {
            section.classList.remove('fp-completely', 'active');
            
            // Clear any inline styles on animatable elements that might override CSS
            const animatableElements = section.querySelectorAll('h1, h2, h3, h4, h5, h6, p:not(a > p), a:not(p > a), img, form, label, input, textarea, button, .animate-element');
            animatableElements.forEach(el => {
                // Remove inline opacity and transform to let CSS take over
                el.style.removeProperty('opacity');
                el.style.removeProperty('transform');
            });
        });
        
        // Force a reflow
        void document.body.offsetHeight;
        
        // Now add the animations-enabled class (elements will be hidden by CSS)
        document.body.classList.add('animations-enabled');
        
        // Force another reflow to ensure the hidden state is applied
        void document.body.offsetHeight;
    }
    
    // Set overflow for fullPage.js
    previewContent.style.overflow = 'visible';
    
    // Default settings
    const defaultSettings = {
        scrollSpeed: 700,
        navigation: true,
        disableOnMobile: false,
        scrollBar: false,
        motionFeel: 'smooth'
    };
    
    // Merge with provided settings
    const settings = fullpageSettings ? { ...defaultSettings, ...fullpageSettings } : defaultSettings;
    
    // Build fullPage.js config
    const fullpageConfig = {
        licenseKey: window.parent.FULLPAGE_LICENSE_KEY || 'YOUR_LICENSE_KEY',
        showActiveTooltip: false,
        anchors: [],
        sectionsColor: [],
        sectionSelector: '.section',
        onLeave: function(origin, destination, direction, trigger){
            var overflowItem = destination.item.querySelector('.fp-overflow');
            if(overflowItem){
                overflowItem.setAttribute('style', 'overflow-y: hidden !important');
            }
        },
        afterLoad: function(origin, destination, direction, trigger){
            var overflowItem = destination.item.querySelector('.fp-overflow');
            if(overflowItem){
                overflowItem.style.overflowY = '';
            }
        },
        afterRender: function(){
            // Fix animation issue for .animate-backgrounds .section.fp-completely .fp-bg
            // by toggling the animate-backgrounds class to trigger reflow
            if (animateBackgroundsEnabled && document.body.classList.contains('animate-backgrounds')) {
                var completely = document.querySelector('.fp-completely');
                if(completely){
                    completely.classList.remove('fp-completely');

                    setTimeout(function() {
                        completely.classList.add('fp-completely');
                    }, 2000);
                }
                
            }
        }
    };
    
    // Apply scroll speed (always apply if provided)
    fullpageConfig.scrollingSpeed = settings.scrollSpeed;
    
    // Apply navigation bullets
    fullpageConfig.navigation = settings.navigation;
    
    // Apply disable on mobile
    if (settings.disableOnMobile) {
        fullpageConfig.responsiveWidth = 768;
        fullpageConfig.responsiveHeight = 0;
    }
    
    // Apply scroll bar
    fullpageConfig.scrollBar = settings.scrollBar;
    
    // Apply motion feel (easingCss3)
    if (settings.motionFeel !== 'smooth') {
        // Map motion feel to easingCss3 values
        const easingMap = {
            'snappy': 'cubic-bezier(0.25, 0.46, 0.45, 0.94)', // easeOutQuad
            'relaxed': 'cubic-bezier(0.42, 0, 0.58, 1)' // easeInOut
        };
        if (easingMap[settings.motionFeel]) {
            fullpageConfig.easingcss3 = easingMap[settings.motionFeel];
        }
    }
    
    // Apply custom navigation bullet color if not default
    if (settings.navigationColor && settings.navigationColor !== '#333333') {
        applyNavigationColor(settings.navigationColor);
    } else {
        // Remove custom navigation color if it was previously set
        removeNavigationColor();
    }
    
    // Initialize fullPage.js
    fullscreenFullpageApi = new fullpage('#preview-content', fullpageConfig);
    
    if(animationsEnabled){
        document.querySelector('.section').classList.add('fp-completely');
    }
    else{
        document.querySelector('.section').classList.remove('fp-completely');

    }
    console.log('[Fullscreen] FullPage.js initialized' + (animationsEnabled ? ' with animations' : '') + ' with settings:', settings);
}

/**
 * Apply custom navigation bullet color
 */
function applyNavigationColor(color) {
    // Remove existing style if any
    let styleEl = document.getElementById('custom-nav-color');
    if (styleEl) {
        styleEl.remove();
    }
    
    // Add new style
    styleEl = document.createElement('style');
    styleEl.id = 'custom-nav-color';
    styleEl.textContent = `
        /* Custom navigation bullet color */
        #fp-nav ul li a span {
            background-color: ${color};
        }
    `;
    document.head.appendChild(styleEl);
}

/**
 * Remove custom navigation bullet color
 */
function removeNavigationColor() {
    const styleEl = document.getElementById('custom-nav-color');
    if (styleEl) {
        styleEl.remove();
    }
}

/**
 * Enable viewport animations for fullscreen mode
 */
function enableViewportAnimationsForFullscreen() {
    if (window.viewportAnimations) {
        // First, get all elements that might have animations
        const allAnimatableElements = document.querySelectorAll('.section h1, .section h2, .section h3, .section h4, .section h5, .section h6, .section p:not(a > p), .section a:not(p > a), .section img, .section form, .section label, .section input, .section textarea, .section button, .section .animate-element');
        
        // Remove all in-viewport classes and clear inline styles
        allAnimatableElements.forEach(el => {
            el.classList.remove('in-viewport');
            // Clear any inline opacity/transform styles that might override CSS
            el.style.removeProperty('opacity');
            el.style.removeProperty('transform');
        });
        
        // Temporarily remove the viewport-animations-only class
        document.body.classList.remove('viewport-animations-only');
        
        // Force a reflow to ensure classes and styles are removed
        void document.body.offsetHeight;
        
        // Now enable viewport animations after a short delay
        setTimeout(() => {
            window.viewportAnimations.setAnimationsEnabled(true);
            window.viewportAnimations.setFullPageActive(false);
            console.log('[Fullscreen] Viewport animations enabled and reset');
        }, 100); // Delay to ensure clean reset
    }
}

/**
 * Disable viewport animations for fullscreen mode
 */
function disableViewportAnimationsForFullscreen() {
    if (window.viewportAnimations) {
        window.viewportAnimations.setAnimationsEnabled(false);
        window.viewportAnimations.setFullPageActive(false);
        console.log('[Fullscreen] Viewport animations disabled');
    }
}

// Disable TinyMCE editing
function disableTinyMCE() {
    let wasDisabled = false;
    
    // Destroy all TinyMCE instances and disable viewport management
    // This prevents editors from being reinitialized while in preview/fullscreen mode
    if (typeof tinymce !== 'undefined' && tinymce) {
        try {
            // Check if TinyMCE instances exist
            const instances = tinymce.get();
            wasDisabled = instances.length === 0;
            
            // Remove all TinyMCE instances
            tinymce.remove();
            
            // Clear tracking sets
            if (window.tinyMCEEditor) {
                if (window.tinyMCEEditor.initializedElements) {
                    window.tinyMCEEditor.initializedElements.clear();
                }
                if (window.tinyMCEEditor.activeSections) {
                    window.tinyMCEEditor.activeSections.clear();
                }
                // Disable viewport management to prevent reinitialization in preview mode
                if (window.tinyMCEEditor.setViewportManagement) {
                    window.tinyMCEEditor.setViewportManagement(false);
                }
            }
        } catch (error) {
            console.log('Error disabling TinyMCE:', error);
        }
    } else {
        wasDisabled = true;
    }
    
    return wasDisabled;
}

// Enable TinyMCE editing
function enableTinyMCE() {
    if (typeof tinymce !== 'undefined' && tinymce) {
        try {
            // Re-enable TinyMCE editing when exiting preview mode
            if (window.tinyMCEEditor) {
                // Re-enable viewport management first
                if (window.tinyMCEEditor.setViewportManagement) {
                    window.tinyMCEEditor.setViewportManagement(true);
                }
                
                setTimeout(() => {
                    if (!window.tinyMCEEditor) return;
                    // El navbar está fuera de .section y no se cubre con manageEditorsByViewport.
                    // initEditor() es necesario para restaurar la edición del navbar al cerrar fullscreen.
                    if (window.tinyMCEEditor.initEditor) {
                        window.tinyMCEEditor.initEditor();
                    }
                    // Viewport management inicializa las secciones visibles.
                    if (window.tinyMCEEditor.manageEditorsByViewport) {
                        window.tinyMCEEditor.manageEditorsByViewport();
                    }
                }, 100);
            }
        } catch (error) {
            console.log('Error enabling TinyMCE:', error);
        }
    }
}

// Clean TinyMCE attributes and elements from HTML content
function cleanTinyMCEContent(element) {
    // Remove TinyMCE-specific attributes from all elements
    const allElements = element.querySelectorAll('*');
    allElements.forEach(el => {
        // Remove TinyMCE-specific attributes
        el.removeAttribute('contenteditable');
        el.removeAttribute('spellcheck');
        el.removeAttribute('data-mce-style');
        el.removeAttribute('data-mce-href');
        el.removeAttribute('data-mce-selected');
        el.removeAttribute('data-mce-bogus');
        el.removeAttribute('data-mce-type');
        el.removeAttribute('data-mce-pseudo');
        el.removeAttribute('data-mce-resize');
        el.removeAttribute('data-mce-placeholder');
        
        // Remove TinyMCE-specific IDs
        if (el.id && el.id.startsWith('mce_')) {
            el.removeAttribute('id');
        }
        
        // Remove TinyMCE-specific IDs that we generate
        if (el.id && el.id.startsWith('tinymce-')) {
            el.removeAttribute('id');
        }
        
        // Remove TinyMCE-specific classes
        // Handle both regular elements (className is string) and SVG elements (className is object)
        if (el.className) {
            if (typeof el.className === 'string') {
                const classes = el.className.split(' ');
                const filteredClasses = classes.filter(cls => 
                    !cls.includes('mce-content-body') && 
                    !cls.includes('mce-') &&
                    !cls.includes('tox-')
                );
                el.className = filteredClasses.join(' ');
            } else if (el.className.baseVal !== undefined) {
                // SVG element - className is an SVGAnimatedString
                const classes = el.className.baseVal.split(' ');
                const filteredClasses = classes.filter(cls => 
                    !cls.includes('mce-content-body') && 
                    !cls.includes('mce-') &&
                    !cls.includes('tox-')
                );
                el.className.baseVal = filteredClasses.join(' ');
            }
        }
        
        // Remove TinyMCE-specific styles
        if (el.style) {
            el.style.removeProperty('position');
            el.style.removeProperty('min-height');
            el.style.removeProperty('border');
            el.style.removeProperty('outline');
        }
        
        // Remove empty style attributes
        if (el.hasAttribute('style') && (!el.style.cssText || el.style.cssText.trim() === '')) {
            el.removeAttribute('style');
        }
    });
    
    // Remove TinyMCE wrapper elements
    const mceWrappers = element.querySelectorAll('.mce-content-body');
    mceWrappers.forEach(wrapper => {
        // Move all children up one level
        while (wrapper.firstChild) {
            wrapper.parentNode.insertBefore(wrapper.firstChild, wrapper);
        }
        // Remove the wrapper
        wrapper.remove();
    });
    
    // Remove Grammarly injected elements
    const grammarlyElements = element.querySelectorAll('grammarly-extension, grammarly-extension-vbars, [data-grammarly-shadow-root]');
    grammarlyElements.forEach(el => el.remove());
    
    // Remove Grammarly attributes from all elements
    allElements.forEach(el => {
        // Remove all data-grammarly-* attributes
        Array.from(el.attributes).forEach(attr => {
            if (attr.name.startsWith('data-grammarly-') || attr.name.startsWith('data-gr-')) {
                el.removeAttribute(attr.name);
            }
        });
    });
    
    // Unwrap <p> tags that are direct children of inline elements like <a> or <button>
    // This fixes TinyMCE's invalid HTML structure where it wraps content in <p> inside inline elements
    const inlineElements = element.querySelectorAll('a, button');
    inlineElements.forEach(inline => {
        const directParagraphs = Array.from(inline.children).filter(child => child.tagName === 'P');
        directParagraphs.forEach(p => {
            // Move paragraph's content directly into the inline element
            while (p.firstChild) {
                inline.insertBefore(p.firstChild, p);
            }
            // Remove the now-empty paragraph
            p.remove();
        });
    });
    
    // Clean up empty paragraphs that TinyMCE might have added
    const paragraphs = element.querySelectorAll('p');
    paragraphs.forEach(p => {
        if (!p.textContent.trim() && !p.innerHTML.trim()) {
            p.remove();
        }
    });
    
    // Clean up empty class attributes
    allElements.forEach(el => {
        const classValue = typeof el.className === 'string' ? el.className : el.className?.baseVal;
        if (el.hasAttribute('class') && (!classValue || classValue.trim() === '')) {
            el.removeAttribute('class');
        }
    });
}

// Handle ESC key to exit fullscreen
function handleEscKey(event) {
    if (event.key === 'Escape') {
        // Send message to parent to exit fullscreen
        window.parent.postMessage({
            type: 'EXIT_FULLSCREEN'
        }, '*');
    }
}

// ============================================
// HEADER NAV FUNCTIONS
// ============================================

/**
 * Set header nav in the preview. Replaces existing nav if any.
 */
/**
 * Bind click-to-edit zones in header
 */
function bindHeaderZones() {
    const previewContent = document.getElementById('preview-content');
    if (!previewContent) return;
    const nav = previewContent.querySelector(':scope > nav');
    if (!nav) return;

    const zones = nav.querySelectorAll('[data-header-zone]');
    zones.forEach(zone => {
        // Click handler - send message to parent
        zone.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const zoneName = zone.getAttribute('data-header-zone');
            window.parent.postMessage({
                type: 'HEADER_ZONE_CLICKED',
                data: { zone: zoneName }
            }, '*');
        });

        // Hover highlight
        zone.addEventListener('mouseenter', () => {
            zone.classList.add('header-zone-hover');
        });

        zone.addEventListener('mouseleave', () => {
            zone.classList.remove('header-zone-hover');
        });
    });
}

function setHeader(html, themeClass) {
    const previewContent = document.getElementById('preview-content');
    if (!previewContent) return;

    // Remove existing nav
    const existingNav = previewContent.querySelector(':scope > nav');
    if (existingNav) existingNav.remove();

    // Parse and insert as first child
    const temp = document.createElement('div');
    temp.innerHTML = html;
    const nav = temp.querySelector('nav');
    if (!nav) return;

    // Apply page theme class to nav so CSS vars are available
    if (themeClass) {
        // Remove existing theme classes
        Array.from(nav.classList)
            .filter(cls => cls.startsWith('theme-'))
            .forEach(cls => nav.classList.remove(cls));
        nav.classList.add(themeClass);
    }

    previewContent.insertBefore(nav, previewContent.firstChild);

    // Bind click-to-edit zones
    bindHeaderZones();
}

/**
 * Update header nav classes by prefix swap (e.g. swap nav-bg-solid for nav-bg-glass)
 */
function updateHeaderClasses(prefix, value) {
    const previewContent = document.getElementById('preview-content');
    if (!previewContent) return;
    const nav = previewContent.querySelector(':scope > nav');
    if (!nav) return;

    // Remove classes starting with prefix
    Array.from(nav.classList)
        .filter(cls => cls.startsWith(prefix))
        .forEach(cls => nav.classList.remove(cls));
    nav.classList.add(value);
}

/**
 * Update header CTA type (none, button, 2-buttons, icons) and style (auto, text, outline, solid)
 */
function updateHeaderCta(ctaType, ctaStyle) {
    const previewContent = document.getElementById('preview-content');
    if (!previewContent) return;
    const nav = previewContent.querySelector(':scope > nav');
    if (!nav) return;

    const buttonContainers = nav.querySelectorAll('[data-nav-buttons]');
    const iconContainers = nav.querySelectorAll('[data-nav-icons]');
    const cta1Elements = nav.querySelectorAll('[data-cta-1]');
    const cta2Elements = nav.querySelectorAll('[data-cta-2]');

    // Reset display
    buttonContainers.forEach(c => { c.style.display = ''; });
    iconContainers.forEach(c => { c.style.display = 'none'; });
    cta1Elements.forEach(el => { el.style.display = ''; });
    cta2Elements.forEach(el => { el.style.display = ''; });

    // Apply CTA type
    if (ctaType === 'none') {
        buttonContainers.forEach(c => { c.style.display = 'none'; });
    } else if (ctaType === 'button') {
        cta1Elements.forEach(el => { el.style.display = 'none'; });
    } else if (ctaType === 'icons') {
        buttonContainers.forEach(c => { c.style.display = 'none'; });
        iconContainers.forEach(c => { c.style.display = 'flex'; });
    }
    // '2-buttons' is the default (already reset above)

    // Apply CTA styles
    const ctas = Array.from(nav.querySelectorAll('[data-cta="true"]'));
    ctas.forEach(cta => {
        cta.classList.remove('nav-cta-text', 'nav-cta-outline', 'nav-cta-solid');
    });

    if (ctaStyle === 'text') {
        ctas.forEach(cta => cta.classList.add('nav-cta-text'));
    } else if (ctaStyle === 'outline') {
        ctas.forEach(cta => cta.classList.add('nav-cta-outline'));
    } else if (ctaStyle === 'solid') {
        ctas.forEach(cta => cta.classList.add('nav-cta-solid'));
    } else if (ctaStyle === 'auto') {
        if (ctas.length === 1) {
            ctas[0].classList.add('nav-cta-solid');
        } else if (ctas.length === 2) {
            ctas[0].classList.add('nav-cta-outline');
            ctas[1].classList.add('nav-cta-solid');
        } else if (ctas.length >= 3) {
            ctas[0].classList.add('nav-cta-text');
            ctas[1].classList.add('nav-cta-outline');
            ctas[2].classList.add('nav-cta-solid');
        }
    }
}

/**
 * Remove header nav from preview
 */
function removeHeader() {
    const previewContent = document.getElementById('preview-content');
    if (!previewContent) return;
    const nav = previewContent.querySelector(':scope > nav');
    if (nav) nav.remove();
}

/**
 * Toggle mobile menu in header nav
 */
function toggleHeaderMenu(menuId) {
    const menu = document.getElementById(menuId);
    if (menu) {
        menu.classList.toggle('open');
    }
}

// Expose toggleHeaderMenu to global scope for inline onclick handlers
window.toggleHeaderMenu = toggleHeaderMenu;

// [DISABLED_FOR_WEDDING_VERSION]: Reemplazada por sendTemplateData() que guarda el HTML completo del preview-content en vez de un array de secciones.
// function sendSectionsData(requestData = {}) { ... }

/**
 * Inyecta el HTML del head del template (guardado en el draft como templateHeadHtml)
 * en el <head> del iframe. Limpia los assets anteriores antes de inyectar.
 * Tambien activa la clase has-full-template en #preview-content.
 */
function injectTemplateHeadHtml(headHtml) {
    if (!headHtml || typeof headHtml !== 'string' || headHtml.trim() === '') return;

    // Limpiar assets de template anteriores (styles, links, scripts marcados como template)
    clearTemplateAssets();

    // Parsear el headHtml usando un contenedor temporal
    const tempContainer = document.createElement('div');
    tempContainer.innerHTML = headHtml;

    Array.from(tempContainer.children).forEach(node => {
        const tag = node.tagName.toLowerCase();
        if (tag === 'style') {
            const style = document.createElement('style');
            Array.from(node.attributes).forEach(attr => style.setAttribute(attr.name, attr.value));
            style.textContent = node.textContent;
            document.head.appendChild(style);
        } else if (tag === 'link') {
            const link = document.createElement('link');
            Array.from(node.attributes).forEach(attr => link.setAttribute(attr.name, attr.value));
            document.head.appendChild(link);
        }
    });

    // Marcar el contenedor como template completo para que los CSS funcionen correctamente
    const previewContent = document.getElementById('preview-content');
    if (previewContent) {
        previewContent.classList.add('has-full-template');
    }
}

/**
 * Re-ejecuta los <script> inline del contenedor dado reemplazandolos por clones.
 * Necesario porque innerHTML no ejecuta scripts al restaurar el HTML.
 * Usa un guard para evitar acumulacion de listeners en undo/redo.
 */
function reactivateBodyScripts(container) {
    container.querySelectorAll('script').forEach(oldScript => {
        const newScript = document.createElement('script');
        Array.from(oldScript.attributes).forEach(attr => {
            newScript.setAttribute(attr.name, attr.value);
        });
        newScript.textContent = oldScript.textContent;
        oldScript.parentNode.replaceChild(newScript, oldScript);
    });
}

/**
 * Recolecta los assets del <head> que pertenecen al template (estilos inline, links externos, fuentes).
 * Devuelve un string HTML para que pueda ser guardado en el draft y restaurado client-side.
 */
function collectTemplateHeadHtml() {
    const parts = [];
    // Estilos inline inyectados por preview.php desde el template
    document.querySelectorAll('style[data-template-style="1"]').forEach(el => {
        parts.push(el.outerHTML);
    });
    // Links externos inyectados por insertFullTemplateHtml o setTemplateStyles
    document.querySelectorAll('link[data-template-asset="styles"]').forEach(el => {
        parts.push(el.outerHTML);
    });
    // Fuentes de Google Fonts (preconnect + stylesheet) inyectadas por el template
    document.querySelectorAll('link[rel="preconnect"][href*="fonts.google"], link[rel="preconnect"][href*="fonts.gstatic"], link[href*="fonts.googleapis.com"]').forEach(el => {
        // Evitar duplicar si ya esta incluida como data-template-asset
        if (!el.hasAttribute('data-template-asset')) {
            parts.push(el.outerHTML);
        }
    });
    return parts.join('\n');
}

/**
 * Envia el CSS del template al frame padre para que el outline de secciones pueda estilizar sus miniaturas.
 * Replica el comportamiento del script inline de preview.php (linea ~339) pero ejecutable en cualquier momento.
 */
function sendTemplateCssForOutline() {
    if (window.parent === window) return;
    const wrap = document.getElementById('preview-content');
    let css = null;
    if (wrap && wrap.classList.contains('has-full-template')) {
        const styles = document.querySelectorAll('style[data-template-style="1"]');
        if (styles.length) {
            css = Array.from(styles).map(s => s.textContent).join('\n');
        }
    }
    try { window.parent.postMessage({ type: 'TEMPLATE_CSS_FOR_OUTLINE', css: css }, '*'); } catch (e) {}
}

function sendTemplateData(requestData = {}) {
    const previewContent = document.getElementById('preview-content');

    // Clonar todo el contenido del preview de una sola vez
    const contentClone = previewContent.cloneNode(true);

    // Eliminar todos los menús de sección del clon
    const menuElements = contentClone.querySelectorAll('.section-menu');
    menuElements.forEach(menu => menu.remove());

    // Eliminar overlays y botones de edición de mapa (inyectados por inline-map-editor.js)
    contentClone.querySelectorAll('.map-pointer-overlay, .map-edit-btn').forEach(el => el.remove());
    // Eliminar el atributo de inicialización para que se re-inicialice correctamente al restaurar
    contentClone.querySelectorAll('.map-container').forEach(el => el.removeAttribute('data-map-editor-initialized'));

    // Remove countdown editor buttons and attributes (injected by inline-countdown-editor.js)
    contentClone.querySelectorAll('.countdown-edit-btn').forEach(el => el.remove());
    contentClone.querySelectorAll('[data-countdown-editor-initialized]').forEach(el => el.removeAttribute('data-countdown-editor-initialized'));
    contentClone.querySelectorAll('.countdown-edit-container').forEach(el => el.classList.remove('countdown-edit-container'));

    // Eliminar elementos de UI de TinyMCE (toolbars, sinks, popups)
    const tinyMCEUIElements = contentClone.querySelectorAll(
        '.tox-tinymce, .tox-tinymce-aux, .tox-popup, .tox-silver-sink, ' +
        '[class*="tox-"], [id*="mce_"], [class*="mce-"]'
    );
    tinyMCEUIElements.forEach(el => {
        if (el.classList.toString().includes('tox-') ||
            (el.id && el.id.startsWith('mce_'))) {
            el.remove();
        }
    });

    // Obtener contenido limpio de TinyMCE API para todos los elementos editables
    if (typeof tinymce !== 'undefined' && tinymce) {
        const tinyMCEInstances = tinymce.get();

        tinyMCEInstances.forEach(editor => {
            const originalElement = editor.getElement();
            if (!originalElement) return;

            // Coincidir por ID (el método más confiable)
            let matchingElement = null;
            if (originalElement.id) {
                matchingElement = contentClone.querySelector(`[id="${originalElement.id}"]`);
            }

            if (matchingElement) {
                const cleanContent = editor.getContent({ format: 'html' });
                matchingElement.innerHTML = cleanContent;
                matchingElement.removeAttribute('contenteditable');
                matchingElement.removeAttribute('spellcheck');
                matchingElement.removeAttribute('data-mce-selected');
                matchingElement.removeAttribute('data-mce-bogus');
                matchingElement.removeAttribute('data-mce-type');

                const mceWrappers = matchingElement.querySelectorAll('.mce-content-body');
                mceWrappers.forEach(wrapper => {
                    while (wrapper.firstChild) {
                        wrapper.parentNode.insertBefore(wrapper.firstChild, wrapper);
                    }
                    wrapper.remove();
                });
            }
        });
    }

    // Limpiar atributos y clases de TinyMCE de todos los elementos
    const allElements = contentClone.querySelectorAll('*');
    allElements.forEach(el => {
        Array.from(el.attributes).forEach(attr => {
            if (attr.name.startsWith('data-mce-')) {
                el.removeAttribute(attr.name);
            }
        });

        if (el.id && (el.id.startsWith('mce_') || el.id.startsWith('tinymce-'))) {
            el.removeAttribute('id');
        }

        if (el.className) {
            if (typeof el.className === 'string') {
                const classes = el.className.split(' ').filter(cls =>
                    !cls.includes('tox-') &&
                    !cls.includes('mce-content-body') &&
                    !cls.startsWith('mce-')
                );
                el.className = classes.join(' ').trim();
            } else if (el.className.baseVal !== undefined) {
                const classes = el.className.baseVal.split(' ').filter(cls =>
                    !cls.includes('tox-') &&
                    !cls.includes('mce-content-body') &&
                    !cls.startsWith('mce-')
                );
                el.className.baseVal = classes.join(' ').trim();
            }
        }

        const classValue = typeof el.className === 'string' ? el.className : el.className?.baseVal;
        if (el.hasAttribute('class') && (!classValue || classValue.trim() === '')) {
            el.removeAttribute('class');
        }
    });

    // Desenvuelve <p> que son hijos directos de elementos inline como <a> o <button>
    const inlineElements = contentClone.querySelectorAll('a, button');
    inlineElements.forEach(inline => {
        const directParagraphs = Array.from(inline.children).filter(child => child.tagName === 'P');
        directParagraphs.forEach(p => {
            while (p.firstChild) {
                inline.insertBefore(p.firstChild, p);
            }
            p.remove();
        });
    });

    // Eliminar elementos inyectados por Grammarly
    const grammarlyElements = contentClone.querySelectorAll('grammarly-extension, grammarly-extension-vbars, [data-grammarly-shadow-root]');
    grammarlyElements.forEach(el => el.remove());

    allElements.forEach(el => {
        Array.from(el.attributes).forEach(attr => {
            if (attr.name.startsWith('data-grammarly-') || attr.name.startsWith('data-gr-')) {
                el.removeAttribute(attr.name);
            }
        });
    });

    // Limpiar clases y atributos de runtime del gestor de elementos removibles
    const removableActiveElements = contentClone.querySelectorAll('.removable-element-active');
    removableActiveElements.forEach(el => {
        el.classList.remove('removable-element-active');
    });

    const removableElements = contentClone.querySelectorAll('[data-fp-dynamic]');
    removableElements.forEach(el => {
        if (el.style.outline) el.style.removeProperty('outline');
        if (el.style.outlineOffset) el.style.removeProperty('outline-offset');
        if (el.style.transition && el.style.transition === 'none') {
            el.style.removeProperty('transition');
        }
    });

    // Eliminar loaders de Cloudinary
    const cloudinaryLoaders = contentClone.querySelectorAll('.cloudinary-image-loader');
    cloudinaryLoaders.forEach(loader => loader.remove());

    // Limpiar atributos de runtime de imágenes (Cloudinary)
    const images = contentClone.querySelectorAll('img');
    images.forEach(img => {
        if (img.style.cursor === 'pointer') {
            img.style.cursor = '';
        }
    });

    // Limpiar atributos de inicialización de runtime en cada sección
    const sectionElements = contentClone.querySelectorAll('.section');
    sectionElements.forEach(sectionEl => {
        sectionEl.removeAttribute('data-removable-initialized');
        sectionEl.removeAttribute('data-cloudinary-initialized');
        sectionEl.removeAttribute('data-video-editor-initialized');
        sectionEl.removeAttribute('data-interactive-features-initialized');

        if (sectionEl.style.height) {
            sectionEl.style.removeProperty('height');

            const styleProperties = [];
            for (let i = 0; i < sectionEl.style.length; i++) {
                const prop = sectionEl.style[i];
                const value = sectionEl.style.getPropertyValue(prop);
                if (value) {
                    styleProperties.push(`${prop}: ${value}`);
                }
            }

            if (styleProperties.length > 0) {
                sectionEl.setAttribute('style', styleProperties.join('; ') + ';');
            } else {
                sectionEl.removeAttribute('style');
            }
        }
    });

    // Obtener el HTML completo del contenido del preview limpio
    const fullHtml = contentClone.innerHTML;

    // Extraer clase de tema (empieza con 'theme-')
    const bodyClasses = document.body.className.split(' ');
    const themeClass = bodyClasses.find(cls => cls.startsWith('theme-')) || 'theme-light-minimal';

    // Retransmitir estados de toggle desde el padre
    const animateBackgroundsEnabled = document.body.classList.contains('animate-backgrounds');
    const toggleStates = {
        fullpageEnabled: requestData.fullpageEnabled !== undefined ? requestData.fullpageEnabled : false,
        fullpageSettings: requestData.fullpageSettings || null,
        animationsEnabled: requestData.animationsEnabled !== undefined ? requestData.animationsEnabled : animationsEnabled,
        animateBackgroundsEnabled: requestData.animateBackgroundsEnabled !== undefined ? requestData.animateBackgroundsEnabled : animateBackgroundsEnabled
    };

    console.log('[preview.html] sendTemplateData - Request data:', requestData);

    window.parent.postMessage({
        type: 'TEMPLATE_DATA',
        requestId: requestData.requestId || null,
        data: {
            fullHtml: fullHtml,
            templateHeadHtml: collectTemplateHeadHtml(),
            theme: themeClass,
            fullpageEnabled: toggleStates.fullpageEnabled,
            fullpageSettings: toggleStates.fullpageSettings,
            animationsEnabled: toggleStates.animationsEnabled,
            animateBackgroundsEnabled: toggleStates.animateBackgroundsEnabled
        }
    }, '*');
}

/**
 * Update animation classes based on animation toggle state
 * Viewport animations are handled by viewport-animations.js
 */
function updateAnimationClasses() {
    // Notify viewport-animations.js of animation state
    if (window.viewportAnimations) {
        window.viewportAnimations.setAnimationsEnabled(animationsEnabled);
        // Always set fullPage as inactive in editor view
        window.viewportAnimations.setFullPageActive(false);
    }
    
    console.log('Animation classes updated:', {
        animationsEnabled,
        classes: document.body.className
    });
}

/**
    * Apply text updates to a section
    * @param {number} sectionNumber - The section number
    * @param {object} textUpdates - Object with selectors as keys and text as values
    * Example: { "h2": "New Heading", "p[0]": "First paragraph", "p[1]": "Second paragraph" }
    */
function applyTextUpdates(sectionNumber, textUpdates) {
    // Note: This is called from message handlers, so we query all sections with this number
    // (since same section can be added multiple times, we apply to all matches)
    const sections = document.querySelectorAll(`[data-section="${sectionNumber}"]`);
    if (sections.length === 0) {
        console.warn(`Section ${sectionNumber} not found for text updates, queuing for later`);
        pendingTextUpdates.set(String(sectionNumber), textUpdates);
        return;
    }
    
    // Apply updates to all sections with this number
    sections.forEach(section => {
        // Parse and apply each text update
        Object.entries(textUpdates).forEach(([selector, text]) => {
            try {
            // Parse selector format: "tag" or "tag[index]"
            const match = selector.match(/^(\w+)(?:\[(\d+)\])?$/);
            if (!match) {
                console.warn(`Invalid selector format: ${selector}`);
                return;
            }
            
            const tagName = match[1];
            const index = match[2] ? parseInt(match[2], 10) : null;
            
            // Get elements using querySelectorAll
            const elements = section.querySelectorAll(tagName);
            
            if (index !== null) {
                // Indexed selector: "p[0]", "button[1]", etc.
                if (index >= 0 && index < elements.length) {
                    const element = elements[index];
                    // Check if it's a TinyMCE editor
                    if (element.hasAttribute('contenteditable') && typeof tinymce !== 'undefined') {
                        const editor = tinymce.get(element.id);
                        if (editor) {
                            editor.setContent(text);
                        } else {
                            // Use innerHTML to allow HTML tags like <br> to render
                            element.innerHTML = text;
                        }
                    } else {
                        // Use innerHTML to allow HTML tags like <br> to render
                        element.innerHTML = text;
                    }
                } else {
                    console.warn(`Index ${index} out of range for selector ${selector} (found ${elements.length} elements)`);
                }
            } else {
                // Non-indexed selector: "h2", "h3", etc. (use first match)
                if (elements.length > 0) {
                    const element = elements[0];
                    // Check if it's a TinyMCE editor
                    if (element.hasAttribute('contenteditable') && typeof tinymce !== 'undefined') {
                        const editor = tinymce.get(element.id);
                        if (editor) {
                            editor.setContent(text);
                        } else {
                            // Use innerHTML to allow HTML tags like <br> to render
                            element.innerHTML = text;
                        }
                    } else {
                        // Use innerHTML to allow HTML tags like <br> to render
                        element.innerHTML = text;
                    }
                } else {
                    console.warn(`No elements found for selector ${selector}`);
                }
            }
        } catch (error) {
            console.error(`Error applying text update for selector ${selector}:`, error);
        }
        });
    });
    
    // Save history after text updates
    if (window.parent && window.parent.historyManager) {
        window.parent.historyManager.save();
    }
    
    // Schedule autosave
    if (window.parent && typeof window.parent.scheduleAutosave === 'function') {
        window.parent.scheduleAutosave();
    }
}

function initTinyMCEForSection(sectionNumber) {
    // Note: This is called from message handlers, so we query all sections with this number
    // (since same section can be added multiple times, we initialize all matches)
    const sections = document.querySelectorAll(`[data-section="${sectionNumber}"]`);
    if (sections.length === 0) {
        console.warn(`Section ${sectionNumber} not found for TinyMCE initialization`);
        return;
    }
    
    // Initialize TinyMCE for all sections with this number
    sections.forEach(section => {
        // Use viewport management if enabled, otherwise initialize directly
        if (window.tinyMCEEditor) {
            setTimeout(() => {
                if (window.tinyMCEEditor.isViewportManagementEnabled) {
                    // Check if this section should be active (in viewport or adjacent)
                    window.tinyMCEEditor.manageEditorsByViewport();
                } else if (window.tinyMCEEditor.initForSection) {
                    // Fallback: initialize directly if viewport management is disabled
                    window.tinyMCEEditor.initForSection(section);
                }
            }, 100);
        }
    });
}

/**
    * Apply text content to a specific element (for undo/redo)
    * @param {number} sectionNumber - The section number
    * @param {string} elementId - The element ID
    * @param {string} content - The content to apply
    * @param {boolean} shouldScroll - Whether to scroll to the section
    */
function applyTextState(sectionNumber, elementId, content, shouldScroll = false) {
    // Find the element by ID
    const element = document.getElementById(elementId);
    if (!element) {
        console.warn(`Element ${elementId} not found for text state application`);
        return;
    }
    
    // Store reference to parent and section before replacing element
    const parent = element.parentNode;
    const section = element.closest('.section');
    
    // Remove TinyMCE instance from the old element if it exists
    if (typeof tinymce !== 'undefined') {
        const editor = tinymce.get(elementId);
        if (editor) {
            editor.remove();
        }
    }
    
    // Create temporary container to parse the outerHTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;
    const newElement = tempDiv.firstElementChild;
    
    if (!newElement) {
        console.warn(`Could not parse content for element ${elementId}`);
        return;
    }
    
    // Replace the old element with the new one
    parent.replaceChild(newElement, element);
    
    // Reinitialize TinyMCE for the new element if the editor exists
    if (typeof tinymce !== 'undefined' && window.tinyMCEEditor) {
        // Initialize TinyMCE for the specific element
        setTimeout(() => {
            window.tinyMCEEditor.initEditor();
        }, 10);
    }
    
    // Scroll to the section if requested (for undo/redo visibility)
    if (shouldScroll && section) {
        section.scrollIntoView({ behavior: 'auto', block: 'center' });
    }
}

/**
    * Restore a removed element (for undo)
    * @param {Object} data - Contains sectionNumber, elementHtml, elementIndex, parentSelector, shouldScroll
    */
function restoreElement(data) {
    const { sectionNumber, sectionUid, elementHtml, elementIndex, parentSelector, shouldScroll } = data;
    
    console.log('🔄 Restoring element:', { sectionNumber, sectionUid, elementIndex, parentSelector });
    
    // Find the section - prefer sectionUid for precise targeting when same template is used multiple times
    let section = null;
    if (sectionUid) {
        section = document.querySelector(`.section[data-section-uid="${sectionUid}"]`);
    }
    // Fallback to sectionNumber if sectionUid not found (backwards compatibility)
    if (!section) {
        section = document.querySelector(`.section[data-section="${sectionNumber}"]`);
    }
    if (!section) {
        console.warn(`Section ${sectionUid || sectionNumber} not found for element restoration`);
        return;
    }
    
    // Find the parent element within the section
    const parent = section.querySelector(parentSelector);
    if (!parent) {
        console.warn(`Parent element with selector "${parentSelector}" not found in section ${sectionNumber}`);
        return;
    }
    
    // Create element from HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = elementHtml;
    const element = tempDiv.firstElementChild;
    
    if (!element) {
        console.warn('Could not parse element HTML');
        return;
    }
    
    // Check if parent has data-fp-dynamic-items="true"
    // If yes, mark the restored element as a dynamic item (for backward compatibility)
    if (parent.hasAttribute('data-fp-dynamic-items') && 
        parent.getAttribute('data-fp-dynamic-items') === 'true') {
        if (!element.hasAttribute('data-fp-dynamic-item')) {
            element.setAttribute('data-fp-dynamic-item', 'true');
            console.log('🔄 Marked restored element as dynamic item');
        }
    }
    
    // Insert element at the correct position
    const children = Array.from(parent.children);
    if (elementIndex >= children.length) {
        parent.appendChild(element);
    } else {
        parent.insertBefore(element, children[elementIndex]);
    }
    
    // Reinitialize removable elements manager for this element
    if (window.removableElementsManager) {
        window.removableElementsManager.addIndicatorToElement(element);
    }
    
    console.log('✅ Element restored successfully');
    
    // Scroll to the section if requested (for undo/redo visibility)
    if (shouldScroll) {
        section.scrollIntoView({ behavior: 'auto', block: 'center' });
    }
}

/**
    * Remove an element (for redo)
    * @param {Object} data - Contains sectionNumber, sectionUid, parentSelector, elementIndex, shouldScroll
    */
function removeElementByCommand(data) {
    const { sectionNumber, sectionUid, parentSelector, elementIndex, shouldScroll } = data;
    
    console.log('🗑️ Removing element by command:', { sectionNumber, sectionUid, elementIndex, parentSelector });
    
    // Find the section - prefer sectionUid for precise targeting when same template is used multiple times
    let section = null;
    if (sectionUid) {
        section = document.querySelector(`.section[data-section-uid="${sectionUid}"]`);
    }
    // Fallback to sectionNumber if sectionUid not found (backwards compatibility)
    if (!section) {
        section = document.querySelector(`.section[data-section="${sectionNumber}"]`);
    }
    if (!section) {
        console.warn(`Section ${sectionUid || sectionNumber} not found for element removal`);
        return;
    }
    
    // Find the parent element within the section
    const parent = section.querySelector(parentSelector);
    if (!parent) {
        console.warn(`Parent element with selector "${parentSelector}" not found in section ${sectionNumber}`);
        return;
    }
    
    // Find the element at the specified index
    const element = parent.children[elementIndex];
    if (!element) {
        console.warn(`Element at index ${elementIndex} not found in parent`);
        return;
    }
    
    // Remove the element using removableElementsManager
    if (window.removableElementsManager) {
        window.removableElementsManager.removeElement(element, { skipNotify: true });
    } else {
        // Fallback: just remove it
        element.remove();
    }
    
    console.log('✅ Element removed successfully by command');
    
    // Scroll to the section if requested (for undo/redo visibility)
    if (shouldScroll) {
        section.scrollIntoView({ behavior: 'auto', block: 'center' });
    }
}

// When preview loads with template from server (preview.php?template=...), init sections
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initServerRenderedTemplateContent);
} else {
    initServerRenderedTemplateContent();
}