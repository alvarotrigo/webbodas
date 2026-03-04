// TinyMCE Inline Editor for Dynamic Content
// Note: TinyMCE library is now loaded statically in HTML with defer attribute
class TinyMCEEditor {
    constructor() {
        this.editor = null;
        this.initializedElements = new Set(); // Track which elements have been initialized
        this.activeSections = new Set(); // Track which sections currently have TinyMCE active
        this.scrollThrottleTimeout = null;
        this.isViewportManagementEnabled = true; // Enable viewport-based management by default
        this.visibleSections = new Set(); // Track sections currently visible in viewport (via IntersectionObserver)
        this.intersectionObserver = null; // IntersectionObserver for tracking visible sections
        this.sectionCache = new Map(); // Cache section positions to avoid repeated measurements
        this.pendingInitQueue = new Set(); // Queue of sections waiting to be initialized
        this.idleCallbackId = null; // Track pending idle callback
        this.rafId = null; // Track pending rAF
        this.init();
    }

    init() {
        // TinyMCE is loaded via <script defer> in HTML before this script
        // With defer, scripts execute in order, so TinyMCE should already be loaded
        if (window.tinymce) {
            this.initEditor();
        } else {
            // Fallback: If TinyMCE isn't loaded yet, wait for its script's load event
            const tinyMCEScript = document.getElementById('tinymce-lib');
            if (tinyMCEScript) {
                tinyMCEScript.addEventListener('load', () => {
                    console.log('TinyMCE loaded, initializing editor');
                    this.initEditor();
                }, { once: true });
                
                // If script already loaded but window.tinymce not set, something went wrong
                if (tinyMCEScript.complete || tinyMCEScript.readyState === 'complete') {
                    console.error('TinyMCE script loaded but window.tinymce is undefined');
                }
            } else {
                console.error('TinyMCE script tag not found - ensure <script id="tinymce-lib"> exists in HTML');
            }
        }
    }

    initEditor() {
        // Check if we're in fullscreen/preview mode - don't initialize editors in preview mode
        const isFullscreen = document.body.classList.contains('fullscreen-mode');
        if (isFullscreen) {
            console.log('Skipping TinyMCE initialization in preview/fullscreen mode');
            return;
        }
        
        // Get all editable elements that haven't been initialized yet
        // blockquote/cite sin prefijo "section" para los que están fuera de section (ej. div.parallax-quote entre secciones)
        // nav a / #nav a / #navMenu a: enlaces del menú de navegación (solo el <a>, en templates con ul#navMenu no se hace editable el <li>)
        const selector = 'section h1, section h2, section h3, section h4, section h5, section h6, section p, section a, section span, section blockquote, section cite, blockquote, cite, label, section li, section button:not(.section-menu button), nav a, #nav a, #navMenu a';
        const allElements = document.querySelectorAll(selector);
        // Divs que solo contienen texto (sin hijos elemento): candidatos a contenteditable
        const textOnlyDivs = this.#getTextOnlyDivCandidates(document.body);
        const allCandidates = [...Array.from(allElements), ...textOnlyDivs];
        const newElements = allCandidates.filter(el => {
            // Exclude elements that are already initialized
            if (this.initializedElements.has(el)) return false;
            
            // Exclude elements inside .section-menu
            if (el.closest('.section-menu')) return false;
            
            // Exclude children/descendants of elements that already have TinyMCE initialized
            // This prevents nested initialization (e.g., <p> inside <a>)
            // Check if any ancestor is in initializedElements
            let parent = el.parentElement;
            while (parent) {
                if (this.initializedElements.has(parent)) return false;
                parent = parent.parentElement;
            }
            
            // Exclude elements with fps-non-edit class or inside fps-non-edit elements
            if (el.classList.contains('fps-non-edit') || el.closest('.fps-non-edit')) return false;
            
            // Exclude elements with no meaningful text content
            if (!this.#hasMeaningfulText(el)) return false;
            
            return true;
        });
        
        // SECOND PASS: Exclude elements whose parent is also in the newElements list
        // This prevents initializing both <a> and <p> inside <a> at the same time
        const finalElements = newElements.filter(el => {
            let parent = el.parentElement;
            while (parent) {
                if (newElements.includes(parent)) return false;
                parent = parent.parentElement;
            }
            return true;
        });
        
        if (finalElements.length === 0) {
            console.log('No new elements to initialize TinyMCE for');
            return;
        }
        
        // Divs solo-texto: solo permitir texto e inline (no insertar div, p, etc.)
        const finalTextOnlyDivs = finalElements.filter(el => el.getAttribute('data-fp-text-only-div') === '1');
        const finalNormalElements = finalElements.filter(el => el.getAttribute('data-fp-text-only-div') !== '1');
        
        const baseTinyConfig = {
            inline: true,
            menubar: false,
            toolbar: 'bold italic underline | forecolor | link | removeformat',
            toolbar_location: 'auto',
            plugins: 'link',
            license_key: 'gpl',
            ui_mode: 'split',
            toolbar_sticky_offset: 20,
            readonly: isFullscreen,
            extended_valid_elements: 'i[*],svg[*],path[*],img[*]',
            forced_root_block: false,
            custom_undo_redo_levels: 0,
            content_style: `
                body { margin: 0; padding: 0; }
                [data-mce-selected] { outline: 2px solid #3b82f6 !important; }
                nav [data-mce-selected], #nav [data-mce-selected], #navMenu [data-mce-selected] {
                    outline: 2px solid #3b82f6 !important;
                    position: relative !important;
                    z-index: 9998 !important;
                }
                .tox-tinymce { 
                    z-index: 9999 !important;
                    transform: translateY(-25px) !important;
                }
                .tox-tinymce.fp-tinymce-nav {
                    transform: translateY(28px) !important;
                }
                .tox-toolbar { 
                    z-index: 10000 !important;
                }
            `,
            setup: (editor) => {
                console.log('TinyMCE editor initialized for new element');
                
                // Mark this element as initialized
                const element = editor.getElement();
                if (element) {
                    this.initializedElements.add(element);
                }
                
                // Customize toolbar appearance
                editor.on('init', () => {
                    // Remove TinyMCE's default undo/redo shortcuts AFTER initialization
                    if (editor.shortcuts) {
                        editor.shortcuts.remove('meta+z'); // Undo
                        editor.shortcuts.remove('meta+y'); // Redo
                        editor.shortcuts.remove('meta+shift+z'); // Redo
                        editor.shortcuts.remove('ctrl+z'); // Undo
                        editor.shortcuts.remove('ctrl+y'); // Redo  
                        editor.shortcuts.remove('ctrl+shift+z'); // Redo
                    }
                    
                    // Add our own shortcuts that delegate to global history
                    if (editor.shortcuts) {
                        editor.shortcuts.add('meta+z', 'Global Undo', () => {
                            editor.getElement().blur();
                            setTimeout(() => {
                                if (window.parent && window.parent.historyManager) {
                                    window.parent.historyManager.undo();
                                }
                            }, 10);
                            return false;
                        });
                        
                        editor.shortcuts.add('ctrl+z', 'Global Undo', () => {
                            editor.getElement().blur();
                            setTimeout(() => {
                                if (window.parent && window.parent.historyManager) {
                                    window.parent.historyManager.undo();
                                }
                            }, 10);
                            return false;
                        });
                        
                        editor.shortcuts.add('meta+shift+z', 'Global Redo', () => {
                            editor.getElement().blur();
                            setTimeout(() => {
                                if (window.parent && window.parent.historyManager) {
                                    window.parent.historyManager.redo();
                                }
                            }, 10);
                            return false;
                        });
                        
                        editor.shortcuts.add('ctrl+shift+z', 'Global Redo', () => {
                            editor.getElement().blur();
                            setTimeout(() => {
                                if (window.parent && window.parent.historyManager) {
                                    window.parent.historyManager.redo();
                                }
                            }, 10);
                            return false;
                        });
                        
                        editor.shortcuts.add('ctrl+y', 'Global Redo', () => {
                            editor.getElement().blur();
                            setTimeout(() => {
                                if (window.parent && window.parent.historyManager) {
                                    window.parent.historyManager.redo();
                                }
                            }, 10);
                            return false;
                        });
                    }
                    const toolbar = editor.container.querySelector('.tox-toolbar');
                    if (toolbar) {
                        // Make the editor container visible
                        if (editor.container) {
                            editor.container.style.visibility = 'visible';
                        }
                    }
                    // Nav: poner la barra debajo del enlace para no tapar el texto
                    const el = editor.getElement();
                    if (el && (el.closest('nav') || el.closest('#nav') || el.closest('#navMenu'))) {
                        editor.container.classList.add('fp-tinymce-nav');
                    }
                });
                
                // Track outerHTML to detect actual changes (including classes, styles, attributes)
                let outerHTMLBeforeEdit = '';
                let normalizedHTMLBeforeEdit = '';
                
                // Helper function to normalize HTML for comparison
                // Removes TinyMCE-specific attributes, classes, and normalizes whitespace
                const normalizeHTML = (html) => {
                    if (!html) return '';
                    
                    // Create a temporary element to parse and clean the HTML
                    const temp = document.createElement('div');
                    temp.innerHTML = html;
                    const el = temp.firstElementChild;
                    
                    if (!el) return html;
                    
                    // Remove all TinyMCE-specific attributes and classes
                    const removeTinyMCEArtifacts = (element) => {
                        // Remove all data-mce-* attributes
                        const attributes = Array.from(element.attributes);
                        attributes.forEach(attr => {
                            // Remove any attribute starting with 'data-mce-'
                            if (attr.name.startsWith('data-mce-')) {
                                element.removeAttribute(attr.name);
                            }
                        });
                        
                        // Remove contenteditable attribute added by TinyMCE
                        element.removeAttribute('contenteditable');
                        
                        // Remove all classes that start with 'mce-'
                        if (element.classList && element.classList.length > 0) {
                            const classesToRemove = Array.from(element.classList).filter(cls => 
                                cls.startsWith('mce-')
                            );
                            classesToRemove.forEach(cls => element.classList.remove(cls));
                        }
                    };
                    
                    // Remove from the main element
                    removeTinyMCEArtifacts(el);
                    
                    // Remove from all descendants
                    el.querySelectorAll('*').forEach(child => {
                        removeTinyMCEArtifacts(child);
                    });
                    
                    // Return normalized HTML (trim to remove extra whitespace)
                    return el.outerHTML.trim();
                };
                
                // Capture full outerHTML when editor gains focus (for "before" state)
                editor.on('focus', () => {
                    const element = editor.getElement();
                    if (element) {
                        outerHTMLBeforeEdit = element.outerHTML;
                        normalizedHTMLBeforeEdit = normalizeHTML(outerHTMLBeforeEdit);
                    }
                });
                
                // Save history only when editor loses focus (blur event)
                editor.on('blur', () => {
                    // Get section number from the element (null si está en nav)
                    const element = editor.getElement();
                    const section = element ? element.closest('section') : null;
                    const inNav = element && (element.closest('nav') || element.closest('#nav') || element.closest('#navMenu'));
                    const sectionNumber = section ? section.getAttribute('data-section') : (inNav ? 'nav' : null);
                    const elementId = element ? element.id : null;
                    
                    // Get current HTML and normalize it for comparison
                    const outerHTMLAfterEdit = element ? element.outerHTML : '';
                    const normalizedHTMLAfterEdit = normalizeHTML(outerHTMLAfterEdit);
                    
                    // Only create history entry if normalized content actually changed
                    if (normalizedHTMLBeforeEdit !== normalizedHTMLAfterEdit) {
                        // Emit text edit command to parent (section o nav; nav usa sectionNumber 'nav')
                        if (window.parent && window.parent !== window && elementId && sectionNumber) {
                            window.parent.postMessage({
                                type: 'TEXT_EDITED',
                                data: {
                                    sectionNumber: sectionNumber,
                                    elementId: elementId,
                                    beforeContent: outerHTMLBeforeEdit,
                                    afterContent: outerHTMLAfterEdit
                                }
                            }, '*');
                        }
                    }
                });
            }
        };
        
        const assignId = (el) => {
            if (!el.id) el.id = 'tinymce-' + Math.random().toString(36).substr(2, 9);
        };
        finalNormalElements.forEach(assignId);
        finalTextOnlyDivs.forEach(assignId);
        
        const normalSelectors = finalNormalElements.map(el => '#' + el.id).join(', ');
        const textOnlySelectors = finalTextOnlyDivs.map(el => '#' + el.id).join(', ');
        
        if (finalNormalElements.length > 0) {
            console.log(`Initializing TinyMCE for ${finalNormalElements.length} normal elements`);
            tinymce.init({ ...baseTinyConfig, selector: normalSelectors });
        }
        if (finalTextOnlyDivs.length > 0) {
            console.log(`Initializing TinyMCE for ${finalTextOnlyDivs.length} text-only div(s) (solo texto, sin insertar div)`);
            tinymce.init({
                ...baseTinyConfig,
                selector: textOnlySelectors,
                invalid_elements: 'div,p,h1,h2,h3,h4,h5,h6,ul,ol,li,blockquote,section,article,header,footer,nav'
            });
        }
        
        // Single message listener to prevent multiple listeners
        if (!this.messageListener) {
            this.messageListener = (event) => {
                if (event.data.type === 'ADD_SECTION') {
                    console.log('New section added - TinyMCE will be initialized for the new section only');
                    // Note: TinyMCE initialization is now handled directly in the addSection function
                    // for better performance - only the new section gets initialized
                }
            };
            window.addEventListener('message', this.messageListener);
        }
    }

    reinitEditor() {
        // Only reinitialize if not already doing so
        if (this.isReinitializing) {
            return;
        }
        
        this.isReinitializing = true;
        
        // Remove existing editor
        if (typeof tinymce !== 'undefined' && tinymce) {
            try {
                tinymce.remove();
            } catch (error) {
                console.log('TinyMCE already removed');
            }
        }
        
        // Clear any remaining TinyMCE elements
        const tinymceElements = document.querySelectorAll('.tox-tinymce, .tox-toolbar, [data-mce-selected]');
        tinymceElements.forEach(el => {
            if (el.parentNode) {
                el.parentNode.removeChild(el);
            }
        });
        
        // Reset initialized elements tracking
        this.initializedElements.clear();
        
        // Clear active sections tracking
        this.activeSections.clear();
        
        // Reinitialize with all elements (for cases like fullscreen toggle)
        setTimeout(() => {
            this.initEditor();
            this.isReinitializing = false;
        }, 100);
    }
    
    setReadOnly(readonly) {
        // Update readonly state without reinitializing
        if (typeof tinymce !== 'undefined' && tinymce) {
            try {
                const editors = tinymce.get();
                editors.forEach(editor => {
                    editor.setMode(readonly ? 'readonly' : 'design');
                });
            } catch (error) {
                console.log('Error setting readonly mode:', error);
            }
        }
    }
    
    // Method to handle fullscreen mode changes
    handleFullscreenChange() {
        console.log('Handling fullscreen mode change...');
        this.reinitEditor();
    }
    
    // Method to initialize TinyMCE for a specific section only
    initForSection(sectionElement) {
        // @ts-ignore - tinymce is loaded globally
        if (!sectionElement || typeof tinymce === 'undefined') {
            console.log('TinyMCE not available or section element not provided');
            return;
        }
        
        // Check if we're in fullscreen/preview mode - don't initialize editors in preview mode
        const isFullscreen = document.body.classList.contains('fullscreen-mode');
        if (isFullscreen) {
            console.log('Skipping TinyMCE initialization in preview/fullscreen mode');
            return;
        }
        
        // Ensure IntersectionObserver is set up and observe this new section
        if (!this.intersectionObserver) {
            this.setupIntersectionObserver();
        } else if (this.intersectionObserver && sectionElement.classList.contains('section')) {
            this.intersectionObserver.observe(sectionElement);
        }
        
        const sectionNumber = sectionElement.getAttribute('data-section');
        if (sectionNumber) {
            this.activeSections.add(sectionNumber);
        }
        
        console.log('Initializing TinyMCE for specific section:', sectionElement);
        
        // Get editable elements only from this section that haven't been initialized
        const selector = 'h1, h2, h3, h4, h5, h6, p, a, span, blockquote, cite, li p, li, label, button:not(.section-menu button)';
        const sectionElements = sectionElement.querySelectorAll(selector);
        const textOnlyDivsSection = this.#getTextOnlyDivCandidates(sectionElement);
        const allCandidatesSection = [...Array.from(sectionElements), ...textOnlyDivsSection];
        const newElements = allCandidatesSection.filter(el => {
            // Exclude elements that are already initialized
            if (this.initializedElements.has(el)) return false;
            
            // Exclude elements inside .section-menu
            if (el.closest('.section-menu')) return false;
            
            // Exclude children/descendants of elements that already have TinyMCE initialized
            // This prevents nested initialization (e.g., <p> inside <a>)
            // Check if any ancestor is in initializedElements
            let parent = el.parentElement;
            while (parent) {
                if (this.initializedElements.has(parent)) return false;
                parent = parent.parentElement;
            }
            
            // Exclude elements with fps-non-edit class or inside fps-non-edit elements
            if (el.classList.contains('fps-non-edit') || el.closest('.fps-non-edit')) return false;
            
            // Exclude elements with no meaningful text content
            if (!this.#hasMeaningfulText(el)) return false;
            
            return true;
        });
        
        // SECOND PASS: Exclude elements whose parent is also in the newElements list
        // This prevents initializing both <a> and <p> inside <a> at the same time
        const finalElements = newElements.filter(el => {
            let parent = el.parentElement;
            while (parent) {
                if (newElements.includes(parent)) return false;
                parent = parent.parentElement;
            }
            return true;
        });
        
        const finalTextOnlyDivsSection = finalElements.filter(el => el.getAttribute('data-fp-text-only-div') === '1');
        const finalNormalElementsSection = finalElements.filter(el => el.getAttribute('data-fp-text-only-div') !== '1');
        
        if (finalElements.length === 0) {
            console.log('No new elements in section to initialize TinyMCE for');
            return;
        }
        
        const assignIdSection = (el) => {
            if (!el.id) el.id = 'tinymce-' + Math.random().toString(36).substr(2, 9);
        };
        finalNormalElementsSection.forEach(assignIdSection);
        finalTextOnlyDivsSection.forEach(assignIdSection);
        const normalSelectorsSection = finalNormalElementsSection.map(el => '#' + el.id).join(', ');
        const textOnlySelectorsSection = finalTextOnlyDivsSection.map(el => '#' + el.id).join(', ');
        
        console.log(`Initializing TinyMCE for ${finalElements.length} elements in new section (optimized approach)`);
        
        const startTime = performance.now();
        
        const initSectionConfig = (selector, extraOptions = {}) => ({
            selector,
            inline: true,
            ...extraOptions,
            menubar: false,
            toolbar: 'bold italic underline | forecolor | link | removeformat',
            toolbar_location: 'auto',
            plugins: 'link',  // Don't include 'undo' plugin - we use our own global undo/redo
            license_key: 'gpl',
            ui_mode: 'split',
            toolbar_sticky_offset: 20,
            readonly: isFullscreen,
            // Preserve icons, SVGs, and images inside elements
            extended_valid_elements: 'i[*],svg[*],path[*],img[*]',
            // Prevent TinyMCE from wrapping content in paragraphs
            forced_root_block: false,
            // Disable TinyMCE's built-in undo manager - we use global history
            custom_undo_redo_levels: 0,
            content_style: `
                body { margin: 0; padding: 0; }
                [data-mce-selected] { outline: 2px solid #3b82f6 !important; }
                nav [data-mce-selected], #nav [data-mce-selected], #navMenu [data-mce-selected] {
                    outline: 2px solid #3b82f6 !important;
                    position: relative !important;
                    z-index: 9998 !important;
                }
                .tox-tinymce { 
                    z-index: 9999 !important;
                    transform: translateY(-25px) !important;
                }
                .tox-tinymce.fp-tinymce-nav {
                    transform: translateY(28px) !important;
                }
                .tox-toolbar { 
                    z-index: 10000 !important;
                }
            `,
            setup: (editor) => {
                console.log('TinyMCE editor initialized for section element');
                
                // Mark this element as initialized
                const element = editor.getElement();
                if (element) {
                    this.initializedElements.add(element);
                }
                
                // Customize toolbar appearance
                editor.on('init', () => {
                    // Remove TinyMCE's default undo/redo shortcuts AFTER initialization
                    if (editor.shortcuts) {
                        editor.shortcuts.remove('meta+z'); // Undo
                        editor.shortcuts.remove('meta+y'); // Redo
                        editor.shortcuts.remove('meta+shift+z'); // Redo
                        editor.shortcuts.remove('ctrl+z'); // Undo
                        editor.shortcuts.remove('ctrl+y'); // Redo  
                        editor.shortcuts.remove('ctrl+shift+z'); // Redo
                    }
                    
                    // Add our own shortcuts that delegate to global history
                    if (editor.shortcuts) {
                        editor.shortcuts.add('meta+z', 'Global Undo', () => {
                            editor.getElement().blur();
                            setTimeout(() => {
                                if (window.parent && window.parent.historyManager) {
                                    window.parent.historyManager.undo();
                                }
                            }, 10);
                            return false;
                        });
                        
                        editor.shortcuts.add('ctrl+z', 'Global Undo', () => {
                            editor.getElement().blur();
                            setTimeout(() => {
                                if (window.parent && window.parent.historyManager) {
                                    window.parent.historyManager.undo();
                                }
                            }, 10);
                            return false;
                        });
                        
                        editor.shortcuts.add('meta+shift+z', 'Global Redo', () => {
                            editor.getElement().blur();
                            setTimeout(() => {
                                if (window.parent && window.parent.historyManager) {
                                    window.parent.historyManager.redo();
                                }
                            }, 10);
                            return false;
                        });
                        
                        editor.shortcuts.add('ctrl+shift+z', 'Global Redo', () => {
                            editor.getElement().blur();
                            setTimeout(() => {
                                if (window.parent && window.parent.historyManager) {
                                    window.parent.historyManager.redo();
                                }
                            }, 10);
                            return false;
                        });
                        
                        editor.shortcuts.add('ctrl+y', 'Global Redo', () => {
                            editor.getElement().blur();
                            setTimeout(() => {
                                if (window.parent && window.parent.historyManager) {
                                    window.parent.historyManager.redo();
                                }
                            }, 10);
                            return false;
                        });
                    }
                    const toolbar = editor.container.querySelector('.tox-toolbar');
                    if (toolbar) {
                        // Make the editor container visible
                        if (editor.container) {
                            editor.container.style.visibility = 'visible';
                        }
                    }
                    // Nav: poner la barra debajo del enlace para no tapar el texto
                    const elNav = editor.getElement();
                    if (elNav && (elNav.closest('nav') || elNav.closest('#nav') || elNav.closest('#navMenu'))) {
                        editor.container.classList.add('fp-tinymce-nav');
                    }
                    
                    // Log performance when editor is initialized
                    const endTime = performance.now();
                    console.log(`TinyMCE editor initialized in ${(endTime - startTime).toFixed(2)}ms`);
                });
                
                // Track outerHTML to detect actual changes (including classes, styles, attributes)
                let outerHTMLBeforeEdit = '';
                let normalizedHTMLBeforeEdit = '';
                
                // Helper function to normalize HTML for comparison
                // Removes TinyMCE-specific attributes, classes, and normalizes whitespace
                const normalizeHTML = (html) => {
                    if (!html) return '';
                    
                    // Create a temporary element to parse and clean the HTML
                    const temp = document.createElement('div');
                    temp.innerHTML = html;
                    const el = temp.firstElementChild;
                    
                    if (!el) return html;
                    
                    // Remove all TinyMCE-specific attributes and classes
                    const removeTinyMCEArtifacts = (element) => {
                        // Remove all data-mce-* attributes
                        const attributes = Array.from(element.attributes);
                        attributes.forEach(attr => {
                            // Remove any attribute starting with 'data-mce-'
                            if (attr.name.startsWith('data-mce-')) {
                                element.removeAttribute(attr.name);
                            }
                        });
                        
                        // Remove contenteditable attribute added by TinyMCE
                        element.removeAttribute('contenteditable');
                        
                        // Remove all classes that start with 'mce-'
                        if (element.classList && element.classList.length > 0) {
                            const classesToRemove = Array.from(element.classList).filter(cls => 
                                cls.startsWith('mce-')
                            );
                            classesToRemove.forEach(cls => element.classList.remove(cls));
                        }
                    };
                    
                    // Remove from the main element
                    removeTinyMCEArtifacts(el);
                    
                    // Remove from all descendants
                    el.querySelectorAll('*').forEach(child => {
                        removeTinyMCEArtifacts(child);
                    });
                    
                    // Return normalized HTML (trim to remove extra whitespace)
                    return el.outerHTML.trim();
                };
                
                // Capture full outerHTML when editor gains focus (for "before" state)
                editor.on('focus', () => {
                    const element = editor.getElement();
                    if (element) {
                        outerHTMLBeforeEdit = element.outerHTML;
                        normalizedHTMLBeforeEdit = normalizeHTML(outerHTMLBeforeEdit);
                    }
                });
                
                // Save history only when editor loses focus (blur event)
                editor.on('blur', () => {
                    // Get section number from the element (null si está en nav)
                    const element = editor.getElement();
                    const section = element ? element.closest('section') : null;
                    const inNav = element && (element.closest('nav') || element.closest('#nav') || element.closest('#navMenu'));
                    const sectionNumber = section ? section.getAttribute('data-section') : (inNav ? 'nav' : null);
                    const elementId = element ? element.id : null;
                    
                    // Get current HTML and normalize it for comparison
                    const outerHTMLAfterEdit = element ? element.outerHTML : '';
                    const normalizedHTMLAfterEdit = normalizeHTML(outerHTMLAfterEdit);
                    
                    // Only create history entry if normalized content actually changed
                    if (normalizedHTMLBeforeEdit !== normalizedHTMLAfterEdit) {
                        // Emit text edit command to parent (section o nav; nav usa sectionNumber 'nav')
                        if (window.parent && window.parent !== window && elementId && sectionNumber) {
                            window.parent.postMessage({
                                type: 'TEXT_EDITED',
                                data: {
                                    sectionNumber: sectionNumber,
                                    elementId: elementId,
                                    beforeContent: outerHTMLBeforeEdit,
                                    afterContent: outerHTMLAfterEdit
                                }
                            }, '*');
                        }
                    }
                });
            }
        });
        
        if (finalNormalElementsSection.length > 0) {
            tinymce.init(initSectionConfig(normalSelectorsSection));
        }
        if (finalTextOnlyDivsSection.length > 0) {
            tinymce.init(initSectionConfig(textOnlySelectorsSection, {
                invalid_elements: 'div,p,h1,h2,h3,h4,h5,h6,ul,ol,li,blockquote,section,article,header,footer,nav'
            }));
        }
    }

    #hasMeaningfulText(element) {
        if (!element) return false;
        // Remove zero-width spaces and trim
        const text = (element.textContent || '').replace(/\u200B/g, '').trim();
        return text.length > 0;
    }

    /**
     * Divs que no tienen hijos elemento (solo texto): candidatos a contenteditable.
     * El usuario en estos solo debe poder editar texto, no insertar otro div.
     * @param {Element} root - Contenedor (document.body o un section)
     * @returns {Element[]}
     */
    #getTextOnlyDivCandidates(root) {
        if (!root) return [];
        const selector = root.tagName === 'BODY' ? 'section div' : 'div';
        const divs = root.querySelectorAll(selector);
        return Array.from(divs).filter(div => {
            if (div.children.length !== 0) return false;
            if ((div.textContent || '').trim() === '') return false;
            div.setAttribute('data-fp-text-only-div', '1');
            return true;
        });
    }

    /**
     * Destroy TinyMCE editors for a specific section
     * @param {HTMLElement} sectionElement - The section element
     */
    destroyForSection(sectionElement) {
        if (!sectionElement || typeof tinymce === 'undefined') {
            return;
        }

        const sectionNumber = sectionElement.getAttribute('data-section');
        if (!sectionNumber) {
            return;
        }

        // Find all editable elements in this section that have TinyMCE initialized (incl. divs solo-texto)
        const selector = 'h1, h2, h3, h4, h5, h6, p, a, span, blockquote, cite, li p, li, label, button:not(.section-menu button), div';
        const sectionElements = sectionElement.querySelectorAll(selector);
        
        let destroyedCount = 0;
        sectionElements.forEach(el => {
            if (this.initializedElements.has(el) && el.id) {
                const editor = tinymce.get(el.id);
                if (editor) {
                    try {
                        editor.remove();
                        this.initializedElements.delete(el);
                        destroyedCount++;
                    } catch (error) {
                        console.warn('Error destroying TinyMCE editor:', error);
                    }
                }
            }
        });

        // Remove from active sections tracking
        this.activeSections.delete(sectionNumber);

        if (destroyedCount > 0) {
            console.log(`Destroyed ${destroyedCount} TinyMCE editor(s) for section ${sectionNumber}`);
        }
    }

    /**
     * Get the section currently in the viewport
     * @returns {HTMLElement|null} The section element in viewport, or null
     */
    /**
     * Setup IntersectionObserver to track visible sections without forcing layout
     * This avoids the performance issue of measuring all sections on every scroll
     */
    setupIntersectionObserver() {
        const previewContent = document.getElementById('preview-content');
        if (!previewContent || this.intersectionObserver) {
            return;
        }

        // Create observer to track sections entering/leaving viewport
        this.intersectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const section = entry.target;
                const sectionNumber = section.getAttribute('data-section');
                if (entry.isIntersecting) {
                    this.visibleSections.add(section);
                    // Cache section position when it becomes visible (only measure once)
                    if (sectionNumber && !this.sectionCache.has(sectionNumber)) {
                        const rect = section.getBoundingClientRect();
                        const containerRect = previewContent.getBoundingClientRect();
                        const scrollTop = previewContent.scrollTop;
                        
                        this.sectionCache.set(sectionNumber, {
                            top: rect.top - containerRect.top + scrollTop,
                            height: rect.height
                        });
                    }
                } else {
                    this.visibleSections.delete(section);
                    // Optionally clear cache when section leaves viewport to save memory
                    // (commented out to keep cache for faster lookups)
                    // if (sectionNumber) {
                    //     this.sectionCache.delete(sectionNumber);
                    // }
                }
            });
        }, {
            root: previewContent,
            rootMargin: '50% 0px', // Expand viewport by 50% above and below to track adjacent sections
            threshold: [0, 0.1, 0.5, 1.0] // Multiple thresholds for better tracking
        });

        // Observe all existing sections (if any)
        this.observeExistingSections();
    }

    /**
     * Observe all existing sections in the DOM
     * This method can be called after sections are dynamically added
     */
    observeExistingSections() {
        if (!this.intersectionObserver) {
            return;
        }

        const sections = document.querySelectorAll('.section');
        sections.forEach(section => {
            this.intersectionObserver.observe(section);
        });
        
        console.log(`IntersectionObserver now observing ${sections.length} section(s)`);
    }

    /**
     * Get the active section (the one most visible in viewport)
     * Optimized to only measure visible sections, not all sections
     */
    getActiveSection() {
        const previewContent = document.getElementById('preview-content');
        if (!previewContent) {
            return null;
        }

        // Ensure IntersectionObserver is set up
        if (!this.intersectionObserver) {
            this.setupIntersectionObserver();
        }

        // If we have visible sections tracked, only measure those
        if (this.visibleSections.size > 0) {
            const viewportTop = previewContent.scrollTop;
            const viewportBottom = viewportTop + previewContent.clientHeight;
            const viewportCenter = viewportTop + (previewContent.clientHeight / 2);

            let activeSection = null;
            let maxVisibleArea = 0;

            // Only measure sections that are visible (tracked by IntersectionObserver)
            for (const section of this.visibleSections) {
                const rect = section.getBoundingClientRect();
                const containerRect = previewContent.getBoundingClientRect();
                
                // Calculate section position relative to container
                const sectionTop = rect.top - containerRect.top + previewContent.scrollTop;
                const sectionBottom = sectionTop + rect.height;

                // Check if viewport center is within this section
                if (viewportCenter >= sectionTop && viewportCenter <= sectionBottom) {
                    return section; // Found exact match
                }

                // Calculate visible area for fallback
                const visibleTop = Math.max(viewportTop, sectionTop);
                const visibleBottom = Math.min(viewportBottom, sectionBottom);
                const visibleArea = Math.max(0, visibleBottom - visibleTop);

                if (visibleArea > maxVisibleArea) {
                    maxVisibleArea = visibleArea;
                    activeSection = section;
                }
            }

            // Return section with most visible area if we found one
            if (activeSection) {
                return activeSection;
            }
        }

        // Fallback: if no visible sections tracked yet, use a smart approach
        // Only check sections near the viewport by using scroll position and estimated section heights
        const sections = Array.from(document.querySelectorAll('.section'));
        if (sections.length === 0) {
            return null;
        }

        const viewportTop = previewContent.scrollTop;
        const viewportCenter = viewportTop + (previewContent.clientHeight / 2);
        
        // Estimate which section index we're likely in based on scroll position
        // This avoids measuring all sections - we'll only measure a small window
        const estimatedSectionHeight = previewContent.clientHeight; // Rough estimate
        const estimatedIndex = Math.floor(viewportTop / estimatedSectionHeight);
        
        // Only check sections around the estimated index (within ±3 sections)
        const startIndex = Math.max(0, estimatedIndex - 3);
        const endIndex = Math.min(sections.length - 1, estimatedIndex + 3);
        
        let activeSection = null;
        let maxVisibleArea = 0;

        for (let i = startIndex; i <= endIndex; i++) {
            const section = sections[i];
            const rect = section.getBoundingClientRect();
            const containerRect = previewContent.getBoundingClientRect();
            
            const sectionTop = rect.top - containerRect.top + previewContent.scrollTop;
            const sectionBottom = sectionTop + rect.height;

            // Check if viewport center is within this section
            if (viewportCenter >= sectionTop && viewportCenter <= sectionBottom) {
                return section;
            }

            // Calculate visible area
            const viewportBottom = viewportTop + previewContent.clientHeight;
            const visibleTop = Math.max(viewportTop, sectionTop);
            const visibleBottom = Math.min(viewportBottom, sectionBottom);
            const visibleArea = Math.max(0, visibleBottom - visibleTop);

            if (visibleArea > maxVisibleArea) {
                maxVisibleArea = visibleArea;
                activeSection = section;
            }
        }

        return activeSection;
    }

    /**
     * Manage TinyMCE editors based on viewport visibility
     * Only keeps editors active for the visible section and its adjacent sections
     * This method schedules initialization off the scroll event using requestIdleCallback/rAF
     */
    manageEditorsByViewport() {
        if (!this.isViewportManagementEnabled) {
            return;
        }

        // In fullscreen mode, we still want to initialize editors for visible sections
        // but we won't destroy editors for sections outside viewport to avoid disruption
        const isFullscreen = document.body.classList.contains('fullscreen-mode');

        // Use IntersectionObserver data to avoid getBoundingClientRect calls during scroll
        // Only use visible sections tracked by IntersectionObserver
        const activeSection = this.getActiveSectionFromVisible();
        if (!activeSection) {
            return;
        }

        const allSections = Array.from(document.querySelectorAll('.section'));
        if (allSections.length === 0) {
            return;
        }

        const activeIndex = allSections.indexOf(activeSection);
        if (activeIndex === -1) {
            return;
        }

        // Determine which sections should have TinyMCE active
        const sectionsToKeep = new Set();
        
        // Add active section
        const activeSectionNumber = activeSection.getAttribute('data-section');
        if (activeSectionNumber) {
            sectionsToKeep.add(activeSectionNumber);
        }

        // Add section above (if exists)
        if (activeIndex > 0) {
            const sectionAbove = allSections[activeIndex - 1];
            const sectionAboveNumber = sectionAbove.getAttribute('data-section');
            if (sectionAboveNumber) {
                sectionsToKeep.add(sectionAboveNumber);
            }
        }

        // Add section below (if exists)
        if (activeIndex < allSections.length - 1) {
            const sectionBelow = allSections[activeIndex + 1];
            const sectionBelowNumber = sectionBelow.getAttribute('data-section');
            if (sectionBelowNumber) {
                sectionsToKeep.add(sectionBelowNumber);
            }
        }

        // Queue sections that need initialization (off the scroll event)
        sectionsToKeep.forEach(sectionNumber => {
            if (!this.activeSections.has(sectionNumber)) {
                this.pendingInitQueue.add(sectionNumber);
            }
        });

        // Schedule initialization off the scroll event
        this.schedulePendingInits();

        // Destroy TinyMCE for sections that shouldn't be active
        // In fullscreen mode, skip destruction to avoid disrupting the presentation
        // This can run synchronously as it's just cleanup
        if (!isFullscreen) {
            allSections.forEach(section => {
                const sectionNumber = section.getAttribute('data-section');
                if (sectionNumber && !sectionsToKeep.has(sectionNumber) && this.activeSections.has(sectionNumber)) {
                    this.destroyForSection(section);
                }
            });
        }
    }

    /**
     * Get active section using only IntersectionObserver data (no layout thrashing)
     * Falls back to getActiveSection() if IntersectionObserver isn't ready
     */
    getActiveSectionFromVisible() {
        // If we have visible sections from IntersectionObserver, use them
        if (this.visibleSections.size > 0) {
            // Find the section closest to viewport center from visible sections
            const previewContent = document.getElementById('preview-content');
            if (!previewContent) {
                return null;
            }

            const viewportCenter = previewContent.scrollTop + (previewContent.clientHeight / 2);
            let closestSection = null;
            let closestDistance = Infinity;

            // Only iterate over visible sections (no getBoundingClientRect needed)
            for (const section of this.visibleSections) {
                const sectionNumber = section.getAttribute('data-section');
                // Use cached position if available, otherwise skip (will use fallback)
                if (this.sectionCache.has(sectionNumber)) {
                    const cached = this.sectionCache.get(sectionNumber);
                    const sectionCenter = cached.top + (cached.height / 2);
                    const distance = Math.abs(viewportCenter - sectionCenter);
                    if (distance < closestDistance) {
                        closestDistance = distance;
                        closestSection = section;
                    }
                }
            }

            if (closestSection) {
                return closestSection;
            }
        }

        // Fallback to original method if IntersectionObserver data isn't sufficient
        return this.getActiveSection();
    }

    /**
     * Schedule pending TinyMCE initializations off the scroll event
     * Uses requestIdleCallback with rAF fallback to avoid render-tree churn
     */
    schedulePendingInits() {
        if (this.pendingInitQueue.size === 0) {
            return;
        }

        // Cancel any pending callbacks
        if (this.idleCallbackId !== null) {
            if (typeof cancelIdleCallback !== 'undefined') {
                cancelIdleCallback(this.idleCallbackId);
            }
            this.idleCallbackId = null;
        }
        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }

        // Use requestIdleCallback if available, otherwise use requestAnimationFrame
        if (typeof requestIdleCallback !== 'undefined') {
            this.idleCallbackId = requestIdleCallback((deadline) => {
                this.idleCallbackId = null;
                this.processPendingInits(deadline);
            }, { timeout: 1000 }); // Timeout after 1s to ensure init happens
        } else {
            // Fallback to rAF (single tick)
            this.rafId = requestAnimationFrame(() => {
                this.rafId = null;
                this.processPendingInits({ timeRemaining: () => 5 }); // Simulate idle callback
            });
        }
    }

    /**
     * Process pending initializations during idle time
     * Only initializes one section per idle callback to avoid blocking
     */
    processPendingInits(deadline) {
        // Process one section at a time to avoid blocking
        while (this.pendingInitQueue.size > 0 && 
               (deadline.timeRemaining() > 0 || deadline.didTimeout)) {
            const sectionNumber = this.pendingInitQueue.values().next().value;
            this.pendingInitQueue.delete(sectionNumber);

            // Guard: only init once per section
            if (this.activeSections.has(sectionNumber)) {
                continue;
            }

            const sectionElement = document.querySelector(`.section[data-section="${sectionNumber}"]`);
            if (sectionElement) {
                // Initialize TinyMCE for this section (only touches this section's DOM)
                this.initForSection(sectionElement);
                this.activeSections.add(sectionNumber);
            }
        }

        // If there are more pending inits, schedule another callback
        if (this.pendingInitQueue.size > 0) {
            this.schedulePendingInits();
        }
    }

    /**
     * Enable or disable viewport-based management
     * @param {boolean} enabled - Whether to enable viewport management
     */
    setViewportManagement(enabled) {
        this.isViewportManagementEnabled = enabled;
        
        if (!enabled) {
            // If disabling, clear the scroll listener and pending callbacks
            if (this.scrollThrottleTimeout) {
                clearTimeout(this.scrollThrottleTimeout);
                this.scrollThrottleTimeout = null;
            }
            if (this.idleCallbackId !== null) {
                if (typeof cancelIdleCallback !== 'undefined') {
                    cancelIdleCallback(this.idleCallbackId);
                }
                this.idleCallbackId = null;
            }
            if (this.rafId !== null) {
                cancelAnimationFrame(this.rafId);
                this.rafId = null;
            }
            this.pendingInitQueue.clear();
        } else {
            // If enabling, trigger initial management
            this.manageEditorsByViewport();
        }
    }
}

// Initialize immediately (with defer attribute, DOM is already parsed)
function initTinyMCEEditorIfReady() {
    // Prevent multiple instantiations
    if (window.tinyMCEEditor) {
        console.log('TinyMCEEditor already initialized, skipping');
        return;
    }
    
    // Check if DOM is ready
    if (document.readyState === 'loading') {
        // DOM not ready yet, wait for it
        document.addEventListener('DOMContentLoaded', initTinyMCEEditorIfReady);
        return;
    }
    
    // DOM is ready, initialize immediately
    window.tinyMCEEditor = new TinyMCEEditor();
    
    // Set up viewport-based management with throttled scroll listener
    // Note: manageEditorsByViewport() now schedules init off the scroll event using requestIdleCallback/rAF
    const previewContent = document.getElementById('preview-content');
    if (previewContent && window.tinyMCEEditor) {
        let scrollTimeout = null;
        
        const handleScroll = () => {
            // Cancel any pending timeout
            if (scrollTimeout) {
                clearTimeout(scrollTimeout);
            }
            
            // Throttle scroll handler to avoid calling manageEditorsByViewport too frequently
            // The actual TinyMCE init is scheduled off the scroll event via requestIdleCallback/rAF
            scrollTimeout = setTimeout(() => {
                if (window.tinyMCEEditor && window.tinyMCEEditor.isViewportManagementEnabled) {
                    window.tinyMCEEditor.manageEditorsByViewport();
                }
            }, 150); // Throttle to every 150ms
        };
        
        previewContent.addEventListener('scroll', handleScroll, { passive: true });
        
        // Set up IntersectionObserver for tracking visible sections
        // The observer will be created immediately, but sections will be observed as they're added
        setTimeout(() => {
            if (window.tinyMCEEditor) {
                window.tinyMCEEditor.setupIntersectionObserver();
                // Only run viewport management if there are sections already loaded
                const sections = document.querySelectorAll('.section');
                if (sections.length > 0) {
                    window.tinyMCEEditor.manageEditorsByViewport();
                }
            }
        }, 100);
    }
}

// Start initialization
initTinyMCEEditorIfReady();

// Cleanup when page is unloaded to prevent memory leaks
window.addEventListener('beforeunload', () => {
    if (window.tinyMCEEditor) {
        // Disconnect IntersectionObserver
        if (window.tinyMCEEditor.intersectionObserver) {
            window.tinyMCEEditor.intersectionObserver.disconnect();
            window.tinyMCEEditor.intersectionObserver = null;
        }
        
        // Clear any pending timeouts and callbacks
        if (window.tinyMCEEditor.reinitTimeout) {
            clearTimeout(window.tinyMCEEditor.reinitTimeout);
        }
        if (window.tinyMCEEditor.idleCallbackId !== null) {
            if (typeof cancelIdleCallback !== 'undefined') {
                cancelIdleCallback(window.tinyMCEEditor.idleCallbackId);
            }
        }
        if (window.tinyMCEEditor.rafId !== null) {
            cancelAnimationFrame(window.tinyMCEEditor.rafId);
        }
        
        // Remove message listener
        if (window.tinyMCEEditor.messageListener) {
            window.removeEventListener('message', window.tinyMCEEditor.messageListener);
        }
        
        // Destroy TinyMCE instances
        if (typeof tinymce !== 'undefined' && tinymce) {
            try {
                tinymce.remove();
            } catch (error) {
                console.log('TinyMCE cleanup completed');
            }
        }
    }
});

// Global function to manually trigger editor initialization
window.initTinyMCE = () => {
    if (window.tinyMCEEditor) {
        window.tinyMCEEditor.reinitEditor();
    } else {
        console.log('TinyMCE Editor not initialized yet');
    }
}; 