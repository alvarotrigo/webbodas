/**
 * Inline SVG Editor
 * Allows users to replace SVG icons by pasting SVG code
 * - Simple click-to-edit interface
 * - Live preview of new icon
 * - Preserves styling and dimensions
 */

class InlineSVGEditor {
    constructor() {
        this.currentSVG = null;
        this.init();
    }
    
    init() {
        console.log('🎨 SVG Editor: Initializing');
        this.setupEventListeners();
        this.setupMessageListeners();
    }
    
    /**
     * Setup event listeners for SVG clicks
     */
    setupEventListeners() {
        // Use event delegation with capture phase to intercept clicks before other handlers
        // This ensures we catch SVG clicks even if parent elements call stopPropagation()
        document.addEventListener('click', (e) => {
            // Don't open modal in fullscreen preview mode
            if (document.body.classList.contains('fullscreen-mode')) {
                return;
            }
            
            // Check if clicked element is an SVG or inside an SVG
            const svg = e.target.closest('svg');
            
            // Only handle SVGs inside sections (not UI elements elsewhere)
            // Exclude SVGs inside .section-menu (UI controls) and TinyMCE editor
            if (svg && svg.closest('section') && !svg.closest('.section-menu') && !svg.closest('.tox-tinymce')) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation(); // Also stop other listeners on same element
                this.openEditModal(svg);
            }
        }, true); // Use capture phase (true) to catch events before they bubble
    }
    
    /**
     * Setup message listeners for undo/redo operations
     */
    setupMessageListeners() {
        window.addEventListener('message', (event) => {
            if (event.data.type === 'APPLY_INLINE_SVG_STATE') {
                const { sectionNumber, svgUid, state, shouldScroll } = event.data.data;
                this.applyState(sectionNumber, svgUid, state, shouldScroll);
            }
        });
    }
    
    /**
     * Open the edit modal for an SVG
     */
    openEditModal(svg) {
        console.log('🎨 SVG Editor: Opening edit modal for', svg);
        
        this.currentSVG = svg;
        
        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.className = 'svg-edit-modal-overlay modal-overlay';
        
        // Create modal
        const modal = document.createElement('div');
        modal.className = 'svg-edit-modal fp-ui-theme';
        
        // Get current SVG code (cleaned)
        const currentSVGCode = this.getSVGOuterHTML(svg);
        
        // Build modal HTML
        modal.innerHTML = `
            <h2>
                Change Icon
                <button type="button" class="close-btn" aria-label="Close">&times;</button>
            </h2>
            
            <!-- Content wrapper for side-by-side layout -->
            <div class="svg-edit-content">
                <!-- Icon Preview Section -->
                <div class="svg-preview-section">
                    <h3>Preview</h3>
                    <div class="svg-preview-container" id="svg-preview">
                        ${currentSVGCode}
                    </div>
                </div>
                
                <!-- Code Input Section -->
                <div class="svg-code-section">
                    <label for="svg-code-input">Paste SVG Code:</label>
                    <textarea 
                        id="svg-code-input" 
                        class="svg-code-textarea" 
                        placeholder="<svg xmlns=&quot;http://www.w3.org/2000/svg&quot; ...>&#10;  <path d=&quot;...&quot;/>&#10;</svg>"
                        spellcheck="false"
                    >${this.escapeHTML(currentSVGCode)}</textarea>
                    <div id="svg-error-message" class="svg-error-message"></div>
                </div>
            </div>
            
            <!-- Helper Text -->
            <div class="svg-helper-text">
                <h4>Find SVG Icons</h4>
                <div class="svg-helper-sites">
                    <a href="https://heroicons.com/" target="_blank" rel="noopener noreferrer">
                        Heroicons
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-up-right h-3 w-3 opacity-50"><path d="M7 7h10v10"></path><path d="M7 17 17 7"></path></svg>
                    </a>
                    <a href="https://lucide.dev/" target="_blank" rel="noopener noreferrer">
                        Lucide
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-up-right h-3 w-3 opacity-50"><path d="M7 7h10v10"></path><path d="M7 17 17 7"></path></svg>
                    </a>
                    <a href="https://www.svgrepo.com/" target="_blank" rel="noopener noreferrer">
                        SVGRepo
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-up-right h-3 w-3 opacity-50"><path d="M7 7h10v10"></path><path d="M7 17 17 7"></path></svg>
                    </a>
                    <a href="https://simpleicons.org/" target="_blank" rel="noopener noreferrer">
                        Simple Icons
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-up-right h-3 w-3 opacity-50"><path d="M7 7h10v10"></path><path d="M7 17 17 7"></path></svg>
                    </a>
                </div>
            </div>
            
            <!-- Action Buttons -->
            <div class="svg-modal-actions">
                <button type="button" class="svg-modal-btn cancel">Cancel</button>
                <button type="button" class="svg-modal-btn apply">Apply</button>
            </div>
        `;
        
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        
        // Get elements
        const textarea = modal.querySelector('#svg-code-input');
        const previewContainer = modal.querySelector('#svg-preview');
        const errorMessage = modal.querySelector('#svg-error-message');
        const applyBtn = modal.querySelector('.svg-modal-btn.apply');
        const cancelBtn = modal.querySelector('.svg-modal-btn.cancel');
        const closeBtn = modal.querySelector('.close-btn');
        
        // Track mousedown target to prevent accidental closes during text selection
        let mouseDownTarget = null;
        
        // Close modal function
        const closeModal = () => {
            if (overlay.parentNode) {
                document.body.removeChild(overlay);
            }
            document.removeEventListener('keydown', handleEscKey);
            overlay.removeEventListener('mousedown', handleMouseDown);
        };
        
        // Cancel button
        cancelBtn.addEventListener('click', closeModal);
        closeBtn.addEventListener('click', closeModal);
        
        // Track mousedown
        const handleMouseDown = (e) => {
            mouseDownTarget = e.target;
        };
        overlay.addEventListener('mousedown', handleMouseDown);
        
        // Close on overlay click (only if both mousedown and click on overlay)
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay && mouseDownTarget === overlay) {
                closeModal();
            }
            mouseDownTarget = null;
        });
        
        // Prevent clicks inside modal from closing it
        modal.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        // Close on ESC key
        const handleEscKey = (e) => {
            if (e.key === 'Escape' || e.key === 'Esc') {
                closeModal();
            }
        };
        document.addEventListener('keydown', handleEscKey);
        
        // Live preview as user types
        textarea.addEventListener('input', () => {
            const code = textarea.value.trim();
            
            if (!code) {
                previewContainer.innerHTML = '<span style="color: #9ca3af; font-size: 14px;">Enter SVG code below</span>';
                applyBtn.disabled = true;
                errorMessage.classList.remove('visible');
                textarea.classList.remove('error');
                return;
            }
            
            // Validate and preview SVG
            const validation = this.validateAndPreviewSVG(code, previewContainer, svg);
            
            if (validation.valid) {
                applyBtn.disabled = false;
                errorMessage.classList.remove('visible');
                textarea.classList.remove('error');
            } else {
                applyBtn.disabled = true;
                errorMessage.textContent = validation.error;
                errorMessage.classList.add('visible');
                textarea.classList.add('error');
            }
        });
        
        // Apply button
        applyBtn.addEventListener('click', () => {
            const code = textarea.value.trim();
            if (code) {
                this.applySVGChange(svg, code);
                closeModal();
            }
        });
        
        // Focus textarea
        setTimeout(() => textarea.focus(), 100);
    }
    
    /**
     * Validate SVG code and show preview
     */
    validateAndPreviewSVG(code, previewContainer, originalSVG) {
        try {
            // Create a temporary container to parse the SVG
            const temp = document.createElement('div');
            temp.innerHTML = code.trim();
            
            // Check if there's an SVG element
            const newSVG = temp.querySelector('svg');
            if (!newSVG) {
                return {
                    valid: false,
                    error: 'Invalid SVG code. Please paste valid SVG markup starting with <svg>.'
                };
            }
            
            // Create preview SVG with original styling
            const previewSVG = this.createStyledSVG(newSVG, originalSVG);
            
            // Show preview
            previewContainer.innerHTML = '';
            previewContainer.appendChild(previewSVG);
            
            return { valid: true };
            
        } catch (error) {
            return {
                valid: false,
                error: 'Failed to parse SVG code. Please check for syntax errors.'
            };
        }
    }
    
    /**
     * Create a new SVG with styling from the original
     */
    createStyledSVG(newSVG, originalSVG) {
        // Clone the new SVG
        const styledSVG = newSVG.cloneNode(true);
        
        // Transfer classes from original
        if (originalSVG.className.baseVal) {
            styledSVG.setAttribute('class', originalSVG.className.baseVal);
        }
        
        // Transfer inline styles from original
        if (originalSVG.getAttribute('style')) {
            styledSVG.setAttribute('style', originalSVG.getAttribute('style'));
        }
        
        // Transfer width and height attributes
        if (originalSVG.hasAttribute('width')) {
            styledSVG.setAttribute('width', originalSVG.getAttribute('width'));
        }
        if (originalSVG.hasAttribute('height')) {
            styledSVG.setAttribute('height', originalSVG.getAttribute('height'));
        }
        
        // Ensure currentColor is used for theme compatibility
        this.ensureCurrentColor(styledSVG);
        
        // Normalize viewBox if needed
        this.normalizeViewBox(styledSVG);
        
        return styledSVG;
    }
    
    /**
     * Ensure SVG uses currentColor for theme compatibility
     */
    ensureCurrentColor(svg) {
        // If stroke exists and isn't currentColor, make it currentColor
        const hasStroke = svg.querySelector('[stroke]');
        if (hasStroke) {
            svg.querySelectorAll('[stroke]').forEach(el => {
                const stroke = el.getAttribute('stroke');
                if (stroke && stroke !== 'none' && stroke !== 'currentColor') {
                    el.setAttribute('stroke', 'currentColor');
                }
            });
        }
        
        // If fill exists and isn't currentColor or none, make it currentColor
        const hasFill = svg.querySelector('[fill]');
        if (hasFill) {
            svg.querySelectorAll('[fill]').forEach(el => {
                const fill = el.getAttribute('fill');
                if (fill && fill !== 'none' && fill !== 'currentColor') {
                    el.setAttribute('fill', 'currentColor');
                }
            });
        }
    }
    
    /**
     * Normalize viewBox to standard dimensions
     */
    normalizeViewBox(svg) {
        // If SVG doesn't have a viewBox, try to create one from width/height
        if (!svg.hasAttribute('viewBox')) {
            const width = svg.getAttribute('width') || '24';
            const height = svg.getAttribute('height') || '24';
            svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        }
    }
    
    /**
     * Apply the SVG change
     */
    applySVGChange(originalSVG, newSVGCode) {
        console.log('🎨 SVG Editor: Applying SVG change');
        
        // Get the section for history tracking
        const section = originalSVG.closest('.section');
        const sectionNumber = section ? section.getAttribute('data-section') : null;
        
        // Capture state for undo/redo
        const previousState = this.captureSVGState(originalSVG);
        
        // Parse new SVG
        const temp = document.createElement('div');
        temp.innerHTML = newSVGCode.trim();
        const newSVG = temp.querySelector('svg');
        
        if (!newSVG) {
            console.error('Failed to parse new SVG');
            return;
        }
        
        // Create styled version
        const styledSVG = this.createStyledSVG(newSVG, originalSVG);
        
        // Transfer the UID if it exists
        if (originalSVG.hasAttribute('data-svg-uid')) {
            styledSVG.setAttribute('data-svg-uid', originalSVG.getAttribute('data-svg-uid'));
        } else {
            // Create new UID
            const uid = this.getSVGUid(originalSVG);
            styledSVG.setAttribute('data-svg-uid', uid);
        }
        
        // Replace the SVG in the DOM
        originalSVG.parentNode.replaceChild(styledSVG, originalSVG);
        
        // Capture new state
        const nextState = this.captureSVGState(styledSVG);
        
        // Emit command for undo/redo
        if (sectionNumber) {
            this.emitSVGChangeCommand(sectionNumber, styledSVG, previousState, nextState);
        }
        
        console.log('🎨 SVG Editor: SVG updated successfully');
    }
    
    /**
     * Get SVG outer HTML
     */
    getSVGOuterHTML(svg) {
        const temp = document.createElement('div');
        temp.appendChild(svg.cloneNode(true));
        return temp.innerHTML;
    }
    
    /**
     * Escape HTML for textarea
     */
    escapeHTML(html) {
        const div = document.createElement('div');
        div.textContent = html;
        return div.innerHTML;
    }
    
    /**
     * Capture SVG state for undo/redo
     */
    captureSVGState(svg) {
        return {
            outerHTML: this.getSVGOuterHTML(svg),
            className: svg.className.baseVal || '',
            style: svg.getAttribute('style') || '',
            width: svg.getAttribute('width') || '',
            height: svg.getAttribute('height') || ''
        };
    }
    
    /**
     * Get or create a unique ID for an SVG element
     */
    getSVGUid(svg) {
        let uid = svg.getAttribute('data-svg-uid');
        if (!uid) {
            uid = 'svg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
            svg.setAttribute('data-svg-uid', uid);
        }
        return uid;
    }
    
    /**
     * Emit SVG change command for undo/redo
     */
    emitSVGChangeCommand(sectionNumber, svg, beforeState, afterState) {
        if (!window.parent || window.parent === window || !window.parent.postMessage) {
            return;
        }
        
        const svgUid = this.getSVGUid(svg);
        
        window.parent.postMessage({
            type: 'COMMAND_INLINE_SVG_CHANGE',
            data: {
                sectionNumber,
                svgUid,
                beforeState,
                afterState,
                label: 'Icon changed'
            }
        }, '*');
    }
    
    /**
     * Apply SVG state (for undo/redo operations)
     */
    applyState(sectionNumber, svgUid, state, shouldScroll = false) {
        console.log('🎨 Applying SVG state:', { sectionNumber, svgUid, state });
        
        // Find the section
        const section = document.querySelector(`.section[data-section="${sectionNumber}"]`);
        if (!section) {
            console.warn(`Section ${sectionNumber} not found for SVG state application`);
            return;
        }
        
        // Find the SVG element by UID
        const svg = section.querySelector(`svg[data-svg-uid="${svgUid}"]`);
        if (!svg) {
            console.warn(`SVG with UID ${svgUid} not found in section ${sectionNumber}`);
            return;
        }
        
        // Parse the state HTML
        const temp = document.createElement('div');
        temp.innerHTML = state.outerHTML;
        const newSVG = temp.querySelector('svg');
        
        if (!newSVG) {
            console.error('Failed to parse SVG state');
            return;
        }
        
        // Ensure UID is preserved
        newSVG.setAttribute('data-svg-uid', svgUid);
        
        // Replace the SVG
        svg.parentNode.replaceChild(newSVG, svg);
        
        // Scroll to the section if requested
        if (shouldScroll && section) {
            section.scrollIntoView({ behavior: 'auto', block: 'center' });
        }
        
        console.log('🎨 SVG state applied successfully');
    }
}

// Initialize global instance (with singleton protection)
if (!window.inlineSVGEditor) {
    window.inlineSVGEditor = new InlineSVGEditor();
    console.log('🎨 SVG Editor: Initialized');
} else {
    console.log('🎨 SVG Editor: Already initialized, skipping');
}
