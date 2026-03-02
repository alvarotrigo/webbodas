/**
 * Removable Elements Manager
 * Handles removal of dynamic elements with data-fp-dynamic attribute
 * - Shows a single visual indicator that moves to hovered elements
 * - Provides remove button
 * - Integrates with history manager for undo/redo
 *
 * Performance: Uses 1 indicator element instead of 100+ (one per removable element)
 */

class RemovableElementsManager {
    constructor() {
        this.overlayContainer = null;
        this.indicator = null; // Single indicator element
        this.activeElement = null; // Currently hovered element
        this.removableElements = new Set(); // Track elements for cleanup
        this.lastMouseX = 0; // Track mouse position for scroll detection
        this.lastMouseY = 0;

        // Create overlay container for indicator (Portal pattern)
        this.createOverlayContainer();

        // Create single indicator
        this.createIndicator();

        // Track mouse position globally
        this.setupMouseTracking();

        // Handle scroll events to hide indicator when element scrolls away
        this.setupScrollHandler();
    }

    /**
     * Create overlay container for indicator (Portal pattern)
     * This keeps indicator separate from the document flow
     */
    createOverlayContainer() {
        // Wait for DOM to be ready
        const createContainer = () => {
            // Check if already exists
            const existing = document.getElementById('removable-indicators-overlay');
            if (existing) {
                this.overlayContainer = existing;
                console.log('🗑️ Removable: Using existing overlay container');
                return;
            }

            this.overlayContainer = document.createElement('div');
            this.overlayContainer.id = 'removable-indicators-overlay';
            this.overlayContainer.style.position = 'fixed';
            this.overlayContainer.style.top = '0';
            this.overlayContainer.style.left = '0';
            this.overlayContainer.style.width = '100%';
            this.overlayContainer.style.height = '100%';
            this.overlayContainer.style.pointerEvents = 'none';
            this.overlayContainer.style.zIndex = '9999';
            document.body.appendChild(this.overlayContainer);
            console.log('🗑️ Removable: Created overlay container');
        };

        if (document.body) {
            createContainer();
        } else {
            // Wait for DOM ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', createContainer);
            } else {
                // DOM is already ready but body doesn't exist? Try next tick
                setTimeout(createContainer, 0);
            }
        }
    }

    /**
     * Create single indicator element
     */
    createIndicator() {
        // Wait for overlay container to be ready
        const create = () => {
            if (!this.overlayContainer) {
                console.warn('🗑️ Removable: Overlay container not ready, retrying indicator creation...');
                setTimeout(create, 100);
                return;
            }

            // Create indicator element
            this.indicator = document.createElement('div');
            this.indicator.className = 'removable-indicator';
            this.indicator.innerHTML = `
                <div class="removable-indicator-content">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <polyline points="3 6 5 6 21 6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"></path>
                        <line x1="10" y1="11" x2="10" y2="17" stroke="currentColor" stroke-width="2" stroke-linecap="round"></line>
                        <line x1="14" y1="11" x2="14" y2="17" stroke="currentColor" stroke-width="2" stroke-linecap="round"></line>
                    </svg> Remove
                </div>
            `;

            // Set initial styles
            this.indicator.style.position = 'fixed';
            this.indicator.style.opacity = '0';
            this.indicator.style.pointerEvents = 'auto';
            this.indicator.style.transition = 'opacity 0.15s ease, transform 0.15s ease';

            // Click handler
            this.indicator.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.handleIndicatorClick();
            });

            // Keep indicator visible when hovering over it
            this.indicator.addEventListener('mouseenter', () => {
                // Keep indicator visible
            });

            this.indicator.addEventListener('mouseleave', () => {
                this.hideIndicator();
            });

            this.overlayContainer.appendChild(this.indicator);
            console.log('🗑️ Removable: Created single indicator element');
        };

        create();
    }

    /**
     * Track mouse position globally for scroll detection
     */
    setupMouseTracking() {
        window.addEventListener('mousemove', (e) => {
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
        }, { passive: true });
    }

    /**
     * Handle scroll events - hide indicator if element scrolls away from cursor
     */
    setupScrollHandler() {
        let scrollPending = false;

        window.addEventListener('scroll', () => {
            // Only check if indicator is visible and we have an active element
            if (!this.activeElement || parseFloat(this.indicator?.style.opacity || '0') === 0) {
                return;
            }

            // Throttle with RAF
            if (scrollPending) return;
            scrollPending = true;

            requestAnimationFrame(() => {
                scrollPending = false;

                // Check if mouse is still over the active element
                if (this.activeElement) {
                    const rect = this.activeElement.getBoundingClientRect();
                    const isMouseOverElement = (
                        this.lastMouseX >= rect.left &&
                        this.lastMouseX <= rect.right &&
                        this.lastMouseY >= rect.top &&
                        this.lastMouseY <= rect.bottom
                    );

                    // If mouse is no longer over element, hide indicator
                    if (!isMouseOverElement) {
                        this.hideIndicator();
                    }
                }
            });
        }, { passive: true, capture: true });
    }

    /**
     * Initialize removable functionality for all elements in a section
     */
    initForSection(sectionElement) {
        if (!sectionElement) return;

        // Skip if already initialized
        if (sectionElement.hasAttribute('data-removable-initialized')) {
            console.log('⚠️ Removable: Section already initialized, skipping');
            return;
        }

        // Mark section as initialized
        sectionElement.setAttribute('data-removable-initialized', 'true');

        // Find elements with data-fp-dynamic attribute
        const dynamicElements = sectionElement.querySelectorAll('[data-fp-dynamic]');

        // Find direct children of elements with data-fp-dynamic-items="true"
        const dynamicItemContainers = sectionElement.querySelectorAll('[data-fp-dynamic-items="true"]');
        const dynamicItemChildren = [];
        dynamicItemContainers.forEach(container => {
            // Get only direct children
            Array.from(container.children).forEach(child => {
                // Mark child as removable for future detection (e.g., after undo/redo)
                child.setAttribute('data-fp-dynamic-item', 'true');
                dynamicItemChildren.push(child);
            });
        });

        // Combine both sets, avoiding duplicates
        const allRemovableElements = new Set([...dynamicElements, ...dynamicItemChildren]);

        console.log(`✅ Removable: Initializing ${allRemovableElements.size} removable elements in section (${dynamicElements.length} dynamic + ${dynamicItemChildren.length} dynamic items)`);

        // Add event listeners to each removable element
        allRemovableElements.forEach(element => {
            this.attachListeners(element);
        });
    }

    /**
     * Attach event listeners to a removable element
     */
    attachListeners(element) {
        // Skip if already tracked
        if (this.removableElements.has(element)) {
            return;
        }

        console.log('🗑️ Removable: Attaching listeners to element', element);

        // Mouse enter handler
        const handleMouseEnter = () => {
            this.handleMouseEnter(element);
        };

        // Mouse leave handler
        const handleMouseLeave = () => {
            this.handleMouseLeave(element);
        };

        element.addEventListener('mouseenter', handleMouseEnter);
        element.addEventListener('mouseleave', handleMouseLeave);

        // Store element for cleanup
        this.removableElements.add(element);

        // Store handlers for cleanup
        element._removableHandlers = {
            mouseenter: handleMouseEnter,
            mouseleave: handleMouseLeave
        };
    }

    /**
     * Handle mouse enter on element - show and position indicator
     */
    handleMouseEnter(element) {
        // Skip if in fullscreen mode
        if (document.body.classList.contains('fullscreen-mode')) {
            return;
        }

        // Clean up previous element's outline (if moving to a different element)
        if (this.activeElement && this.activeElement !== element) {
            this.activeElement.classList.remove('removable-element-active');
        }

        // Calculate position
        const rect = element.getBoundingClientRect();

        // Position indicator at top-right
        this.indicator.style.top = `${rect.top - 40}px`;
        this.indicator.style.left = `${rect.right - 40}px`;

        // Show indicator
        this.indicator.style.opacity = '1';
        this.indicator.style.transform = 'translateY(-2px)';

        // Add blue outline to element
        element.classList.add('removable-element-active');

        // Store reference
        this.activeElement = element;
    }

    /**
     * Handle mouse leave on element - hide indicator with delay
     */
    handleMouseLeave(element) {
        // Delay hiding to allow mouse to reach indicator
        setTimeout(() => {
            // Only hide if we haven't moved to another element in the meantime
            // This prevents race conditions when quickly moving between elements
            if (!this.indicator.matches(':hover') && this.activeElement === element) {
                this.hideIndicator();
            }
        }, 100);
    }

    /**
     * Hide indicator and clear outline
     */
    hideIndicator() {
        this.indicator.style.opacity = '0';
        this.indicator.style.transform = 'translateY(0)';

        if (this.activeElement) {
            this.activeElement.classList.remove('removable-element-active');
            this.activeElement = null;
        }
    }

    /**
     * Handle indicator click - remove currently active element
     */
    handleIndicatorClick() {
        if (this.activeElement) {
            console.log('🗑️ Remove button clicked');
            this.removeElement(this.activeElement);
            this.hideIndicator();
        }
    }

    /**
     * Remove an element from the DOM and trigger history save
     */
    removeElement(element, options = {}) {
        console.log('🗑️ Removing element:', element);

        const skipNotify = options.skipNotify || false;

        // Capture element information before removal (for history)
        const section = element.closest('.section');
        const sectionNumber = section ? section.getAttribute('data-section') : null;
        const sectionUid = section ? section.getAttribute('data-section-uid') : null;
        const parent = element.parentElement;
        const elementIndex = Array.from(parent.children).indexOf(element);
        const elementHtml = element.outerHTML;

        // Get a selector to identify the parent
        const parentSelector = this.getParentSelector(parent);

        // Remove blue outline if active
        element.classList.remove('removable-element-active');

        // Remove the element with animation
        element.style.transition = 'opacity 0.3s, transform 0.3s';
        element.style.opacity = '0';
        element.style.transform = 'scale(0.95)';

        setTimeout(() => {
            // Remove from DOM
            element.remove();

            // Clean up from tracking Set
            this.removableElements.delete(element);

            // Clean up handlers
            if (element._removableHandlers) {
                delete element._removableHandlers;
            }

            // Notify parent window about the change (for history tracking)
            if (!skipNotify && window.parent && window.parent.postMessage) {
                window.parent.postMessage({
                    type: 'ELEMENT_REMOVED',
                    data: {
                        sectionNumber,
                        sectionUid,
                        elementHtml,
                        elementIndex,
                        parentSelector
                    }
                }, '*');
            }

            console.log('✅ Element removed successfully');
        }, 300);
    }

    /**
     * Get a selector to identify a parent element
     */
    getParentSelector(parent) {
        if (parent.id) {
            return `#${parent.id}`;
        } else if (parent.className) {
            // Use all classes to make selector more specific and unique
            const classes = parent.className.trim().split(/\s+/).filter(c => c);
            if (classes.length > 0) {
                // Escape special characters in class names (e.g., Tailwind's md:, lg:, etc.)
                const escapedClasses = classes.map(c => {
                    return c.replace(/[:.[\]/]/g, '\\$&');
                });
                return '.' + escapedClasses.join('.');
            } else {
                return parent.tagName.toLowerCase();
            }
        } else {
            return parent.tagName.toLowerCase();
        }
    }

    /**
     * Initialize all existing sections when the page loads
     */
    async initializeExistingSections() {
        console.log('🗑️ Removable: initializeExistingSections() called');

        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            await new Promise(resolve => {
                document.addEventListener('DOMContentLoaded', resolve);
            });
        }

        console.log('🗑️ Removable: DOM ready, initializing sections...');

        // Initialize all sections that are already in the DOM
        const sections = document.querySelectorAll('.section');
        console.log(`🗑️ Removable: Found ${sections.length} sections to initialize`);

        sections.forEach((section, index) => {
            console.log(`🗑️ Removable: Processing section ${index + 1}/${sections.length}`);
            // Remove initialization marker to ensure sections get re-initialized properly
            section.removeAttribute('data-removable-initialized');
            this.initForSection(section);
        });

        console.log('🗑️ Removable: All sections processed');
    }

    /**
     * Reinitialize for all sections (useful after DOM changes)
     */
    reinitialize() {
        const sections = document.querySelectorAll('.section');
        console.log(`🗑️ Reinitializing removable elements for ${sections.length} sections`);
        sections.forEach(section => {
            // Remove initialization marker to allow re-initialization
            section.removeAttribute('data-removable-initialized');
            this.initForSection(section);
        });
    }

    /**
     * Add event listeners to a specific element (useful for restored elements after undo)
     */
    addIndicatorToElement(element) {
        if (!element) {
            console.warn('🗑️ Removable: Cannot add indicator to null element');
            return;
        }

        // Check if this element should be removable
        const isRemovable = element.hasAttribute('data-fp-dynamic') ||
                          element.hasAttribute('data-fp-dynamic-item');

        if (!isRemovable) {
            console.warn('🗑️ Removable: Element is not marked as removable', element);
            return;
        }

        console.log('🗑️ Removable: Adding listeners to restored element', element);
        this.attachListeners(element);
    }

    /**
     * Reinitialize a specific section (useful after element restoration)
     */
    reinitializeSection(sectionElement) {
        if (!sectionElement) return;

        console.log('🗑️ Removable: Reinitializing specific section');
        sectionElement.removeAttribute('data-removable-initialized');
        this.initForSection(sectionElement);
    }

    /**
     * Clean up and remove all event listeners
     */
    destroy() {
        // Clean up all tracked elements
        this.removableElements.forEach((element) => {
            if (element._removableHandlers) {
                element.removeEventListener('mouseenter', element._removableHandlers.mouseenter);
                element.removeEventListener('mouseleave', element._removableHandlers.mouseleave);
                delete element._removableHandlers;
            }
            element.classList.remove('removable-element-active');
        });
        this.removableElements.clear();

        // Remove indicator
        if (this.indicator) {
            this.indicator.remove();
            this.indicator = null;
        }

        // Remove overlay container
        if (this.overlayContainer) {
            this.overlayContainer.remove();
            this.overlayContainer = null;
        }

        // Remove initialization markers from sections
        const sections = document.querySelectorAll('.section[data-removable-initialized]');
        sections.forEach(section => {
            section.removeAttribute('data-removable-initialized');
        });

        this.activeElement = null;
    }
}

// Add styles for indicator and active element outline
const removableStyle = document.createElement('style');
removableStyle.textContent = `
    .removable-indicator {
        /* Static styling */
        background-color: #fff;
        border: 2px solid #eee;
        border-radius: 10px;
        box-shadow: none;
        padding: 6px;
        display: flex;
        flex: 0 0 auto;
        align-items: center;
        justify-content: center;
        width: auto;
        height: auto;
        pointer-events: auto;
        z-index: 10000;
        cursor: pointer;
        color: #222f3e;
        font-size: 13px;
        font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif;
    }

    .removable-indicator-content {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 4px 8px;
        border-radius: 6px;
        transition: background-color 0.15s ease;
    }

    .removable-indicator svg {
        margin: 0 4px 0 0;
        display: inline-flex;
        width: 20px;
        height: 20px;
    }

    .removable-indicator:hover .removable-indicator-content {
        background: #f0f0f0;
    }

    .removable-indicator:active .removable-indicator-content {
        background: #e3e3e3;
    }

    .removable-indicator:focus {
        outline: none;
        box-shadow: 0 0 0 2px #fff, 0 0 0 4px #006ce7 !important;
    }

    /* Outline for active removable elements - no animation */
    .removable-element-active {
        outline: 2px solid #3b82f6 !important;
        outline-offset: 2px !important;
        /* Ensure outline never animates, even if element has transition: all */
        transition-property: opacity, transform, background, background-color, color, border, border-color, box-shadow, filter, backdrop-filter !important;
    }
`;
document.head.appendChild(removableStyle);

// Initialize global instance (with singleton protection)
if (!window.removableElementsManager) {
    window.removableElementsManager = new RemovableElementsManager();
} else {
    console.log('RemovableElementsManager already initialized, skipping');
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RemovableElementsManager;
}
