/**
 * Viewport Animations Manager
 * Handles scroll-based animations when fullPage.js is disabled
 * Triggers animations when elements enter the viewport with configurable offset
 * 
 * This system is completely separate from fullPage.js animations:
 * - Adds 'viewport-animations-only' class to body when animations are ON and fullPage is OFF
 * - Observes elements and adds 'in-viewport' class when they enter the viewport
 * - CSS animations only apply with the 'viewport-animations-only' class present
 */

class ViewportAnimations {
    constructor(options = {}) {
        this.config = {
            // Distance from bottom of viewport to trigger animation (in pixels)
            bottomOffset: options.bottomOffset || 200,
            // Whether animations are enabled
            enabled: false,
            // Whether fullPage.js is active
            fullPageActive: false,
            // Selector for elements to animate
            selectors: [
                '.section h1',
                '.section h2',
                '.section h3',
                '.section h4',
                '.section h5',
                '.section h6',
                '.section p:not(a > p)',
                '.section a:not(p > a)',
                '.section img',
                '.section form',
                '.section label',
                '.section input',
                '.section textarea',
                '.section button',
                '.section .animate-element'
            ],
            // Elements to exclude from animation
            excludeSelectors: [
                '.tox-tinymce',
                '.tox-tinymce *',
                '.tox-toolbar',
                '.tox-toolbar *',
                '.tox-editor-header',
                '.tox-editor-header *',
                '.tox-menubar',
                '.tox-menubar *',
                '.tox-toolbar__primary',
                '.tox-toolbar__primary *',
                '.tox-toolbar__overflow',
                '.tox-toolbar__overflow *',
                '.tox-tinymce-aux',
                '.tox-tinymce-aux *'
            ]
        };

        this.observer = null;
        this.animatableElements = new Set();
        
        this.init();
    }

    /**
     * Initialize the viewport animations system
     */
    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    /**
     * Setup the animation system
     */
    setup() {
        this.createObserver();
        this.setupEventListeners();
        
        // Check initial state
        this.checkState();
    }

    /**
     * Create Intersection Observer with configurable bottom offset
     */
    createObserver() {
        const rootMarginBottom = `-${this.config.bottomOffset}px`;
        
        this.observer = new IntersectionObserver(
            (entries) => this.handleIntersection(entries),
            {
                root: null, // Use viewport as root
                rootMargin: `0px 0px ${rootMarginBottom} 0px`, // Offset from bottom
                threshold: 0.01 // Trigger when even 1% is visible
            }
        );
    }

    /**
     * Handle intersection events
     */
    handleIntersection(entries) {
        // Only process if animations are enabled and fullPage is disabled
        if (!this.config.enabled || this.config.fullPageActive) {
            return;
        }

        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Element has entered the viewport
                this.animateElement(entry.target);
            }
        });
    }

    /**
     * Animate an element by adding the in-viewport class
     */
    animateElement(element) {
        if (!element.classList.contains('in-viewport')) {
            element.classList.add('in-viewport');
            
            // Stop observing this element once animated
            this.observer.unobserve(element);
            this.animatableElements.delete(element);
        }
    }

    /**
     * Setup event listeners for toggle switches
     * Note: In editor mode, state is controlled externally via setAnimationsEnabled() and setFullPageActive()
     * In standalone exported HTML, state is set via window.VIEWPORT_ANIMATIONS_CONFIG
     */
    setupEventListeners() {
        // Check for global config (used in exported HTML)
        if (window.VIEWPORT_ANIMATIONS_CONFIG) {
            const config = window.VIEWPORT_ANIMATIONS_CONFIG;
            this.setAnimationsEnabled(config.enabled !== false); // Default to true
            this.setFullPageActive(config.fullPageActive === true); // Default to false
            console.log('[ViewportAnimations] Initialized from global config:', config);
        } else {
            console.log('[ViewportAnimations] No config found - will be controlled externally');
        }
    }

    /**
     * Set whether animations are enabled
     */
    setAnimationsEnabled(enabled) {
        this.config.enabled = enabled;
        this.checkState();
    }

    /**
     * Set whether fullPage.js is active
     */
    setFullPageActive(active) {
        this.config.fullPageActive = active;
        this.checkState();
    }

    /**
     * Check state and start/stop observing elements
     */
    checkState() {
        const shouldObserve = this.config.enabled && !this.config.fullPageActive;
        
        // Update body class to control CSS animations
        // This ensures viewport animations only apply when animations are ON and fullPage is OFF
        if (shouldObserve) {
            document.body.classList.add('viewport-animations-only');
            this.startObserving();
        } else {
            document.body.classList.remove('viewport-animations-only');
            this.stopObserving();
        }
    }

    /**
     * Start observing elements for viewport animations
     */
    startObserving() {
        // Clear existing observations
        this.stopObserving();

        // Get all animatable elements
        const elements = this.getAnimatableElements();
        
        elements.forEach(element => {
            // Don't observe if already animated
            if (!element.classList.contains('in-viewport') && 
                !element.classList.contains('fp-completely')) {
                this.animatableElements.add(element);
                this.observer.observe(element);
            }
        });

        console.log(`[ViewportAnimations] Started observing ${this.animatableElements.size} elements`);
    }

    /**
     * Stop observing all elements
     */
    stopObserving() {
        this.animatableElements.forEach(element => {
            this.observer.unobserve(element);
        });
        this.animatableElements.clear();
    }

    /**
     * Get all elements that should be animated
     */
    getAnimatableElements() {
        const elements = [];
        
        // Get all matching elements
        this.config.selectors.forEach(selector => {
            try {
                const matches = document.querySelectorAll(selector);
                elements.push(...matches);
            } catch (e) {
                console.warn(`[ViewportAnimations] Invalid selector: ${selector}`, e);
            }
        });

        // Filter out excluded elements
        return elements.filter(element => {
            // Check if element or any parent matches exclude selectors
            return !this.config.excludeSelectors.some(excludeSelector => {
                try {
                    return element.matches(excludeSelector) || 
                           element.closest(excludeSelector);
                } catch (e) {
                    return false;
                }
            });
        });
    }

    /**
     * Update the bottom offset configuration
     */
    setBottomOffset(offset) {
        if (typeof offset === 'number' && offset >= 0) {
            this.config.bottomOffset = offset;
            
            // Recreate observer with new offset
            this.observer.disconnect();
            this.createObserver();
            
            // Restart observing if active
            if (this.config.enabled && !this.config.fullPageActive) {
                this.startObserving();
            }
            
            console.log(`[ViewportAnimations] Bottom offset updated to ${offset}px`);
        }
    }

    /**
     * Reset all animations (remove in-viewport class from all elements)
     */
    resetAnimations() {
        const elements = this.getAnimatableElements();
        elements.forEach(element => {
            element.classList.remove('in-viewport');
        });
        
        // Restart observing
        if (this.config.enabled && !this.config.fullPageActive) {
            this.startObserving();
        }
        
        console.log('[ViewportAnimations] Animations reset');
    }

    /**
     * Destroy the viewport animations instance
     */
    destroy() {
        this.stopObserving();
        if (this.observer) {
            this.observer.disconnect();
        }
    }
}

// Initialize viewport animations when script loads (with singleton protection)
// Expose globally for configuration
if (!window.viewportAnimations) {
    window.viewportAnimations = new ViewportAnimations({
        bottomOffset: 100 // Default 100px offset
    });
} else {
    console.log('ViewportAnimations already initialized, skipping');
}

// Add global configuration function for easy offset adjustment
window.setAnimationOffset = function(offset) {
    if (window.viewportAnimations) {
        window.viewportAnimations.setBottomOffset(offset);
    }
};

// Add global function to reset animations
window.resetViewportAnimations = function() {
    if (window.viewportAnimations) {
        window.viewportAnimations.resetAnimations();
    }
};

console.log('[ViewportAnimations] Script loaded. Use setAnimationOffset(pixels) to adjust trigger point.');

