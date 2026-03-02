/**
 * Lazy Background Loader
 * Uses Intersection Observer API to lazy load AND UNLOAD background images on .fp-bg elements
 * Loads backgrounds when they are within 1000px of the viewport (up or down)
 * UNLOADS backgrounds when they leave the viewport range to free up RAM
 * 
 * This significantly improves performance on pages with many sections containing
 * large background images by:
 * 1. Deferring loading until backgrounds are needed
 * 2. Unloading backgrounds when they're far from the viewport to free memory
 */
class LazyBackgroundLoader {
    constructor(options = {}) {
        this.rootMargin = options.rootMargin || '1000px 0px 1000px 0px'; // 1000px top and bottom
        this.observer = null;
        this.lazyClass = 'fp-bg-lazy';
        this.loadedClass = 'fp-bg-loaded';
        this.initialized = false;
        this.isFullscreen = false; // Don't unload in fullscreen mode
        
        // Defer initialization to ensure DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    init() {
        if (this.initialized) return;
        this.initialized = true;

        // Get the scroll container (preview-content in this app)
        const scrollContainer = document.getElementById('preview-content');
        
        // Create intersection observer
        this.observer = new IntersectionObserver(
            this.handleIntersection.bind(this),
            {
                root: scrollContainer || null, // Use viewport if no scroll container
                rootMargin: this.rootMargin,
                threshold: 0
            }
        );

        // Inject CSS for lazy loading if not already present
        this.injectStyles();

        // Observe existing .fp-bg elements
        this.observeAll();
        
        console.log('[LazyBackgroundLoader] Initialized with rootMargin:', this.rootMargin);
    }

    /**
     * Inject the CSS needed for lazy loading
     */
    injectStyles() {
        if (document.getElementById('lazy-bg-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'lazy-bg-styles';
        style.textContent = `
            /* Hide background image when lazy/unloaded class is applied */
            /* Use high specificity to override section-specific rules, but only when lazy/unloaded */
            section.has-bg-image .fp-bg.fp-bg-lazy,
            section.has-bg-image .fp-bg.fp-bg-unloaded,
            .fp-bg.fp-bg-lazy,
            .fp-bg.fp-bg-unloaded {
                background-image: none !important;
            }
            
            /* Ensure loaded backgrounds are visible (remove any interference) */
            section.has-bg-image .fp-bg.fp-bg-loaded,
            .fp-bg.fp-bg-loaded {
                /* Let the section-specific CSS rules apply */
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Observe all .fp-bg elements in the document
     */
    observeAll() {
        const fpBgElements = document.querySelectorAll('.fp-bg');
        fpBgElements.forEach(el => {
            // Check if element is already in viewport before observing
            // This handles elements that are visible on initial load
            if (this.isInViewport(el)) {
                // Load immediately if already in viewport
                this.loadBackground(el);
            } else {
                // Otherwise observe for lazy loading
                this.observeElement(el);
            }
        });
        
        console.log(`[LazyBackgroundLoader] Observing ${fpBgElements.length} .fp-bg elements`);
    }

    /**
     * Check if an element is currently in the viewport (with margin)
     * @param {HTMLElement} element 
     * @returns {boolean}
     */
    isInViewport(element) {
        const scrollContainer = document.getElementById('preview-content');
        const container = scrollContainer || window;
        
        const rect = element.getBoundingClientRect();
        const containerRect = scrollContainer ? scrollContainer.getBoundingClientRect() : {
            top: 0,
            bottom: window.innerHeight,
            left: 0,
            right: window.innerWidth
        };
        
        // Check if element is within 1000px of viewport (top and bottom)
        const margin = 1000;
        const isInRange = (
            rect.bottom >= containerRect.top - margin &&
            rect.top <= containerRect.bottom + margin
        );
        
        return isInRange;
    }

    /**
     * Handle intersection changes - load when entering, unload when leaving
     * @param {IntersectionObserverEntry[]} entries 
     */
    handleIntersection(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Element is within 1000px of viewport - load background
                this.loadBackground(entry.target);
            } else {
                // Element is outside 1000px range - unload to free RAM
                // Skip unloading in fullscreen mode (presentations need all backgrounds ready)
                if (!this.isFullscreen) {
                    this.unloadBackground(entry.target);
                }
            }
        });
    }

    /**
     * Load the background for an element
     * @param {HTMLElement} element 
     */
    loadBackground(element) {
        const wasUnloaded = element.classList.contains('fp-bg-unloaded');
        const wasLazy = element.classList.contains(this.lazyClass);
        
        if (!wasUnloaded && !wasLazy && element.classList.contains(this.loadedClass)) {
            return; // Already loaded and visible
        }
        
        // Remove lazy/unloaded classes and add loaded class
        element.classList.remove(this.lazyClass);
        element.classList.remove('fp-bg-unloaded');
        element.classList.add(this.loadedClass);
        
        // Debug: log which section's background was loaded
        const section = element.closest('section');
        const sectionId = section ? (section.id || section.getAttribute('data-section')) : 'unknown';
        console.log(`[LazyBackgroundLoader] Loaded background for section: ${sectionId}`);
    }

    /**
     * Unload the background for an element to free RAM
     * @param {HTMLElement} element 
     */
    unloadBackground(element) {
        if (element.classList.contains('fp-bg-unloaded')) {
            return; // Already unloaded
        }
        
        // Add unloaded class to hide background-image (frees RAM)
        element.classList.add('fp-bg-unloaded');
        element.classList.remove(this.loadedClass);
        
        // Debug: log which section's background was unloaded
        const section = element.closest('section');
        const sectionId = section ? (section.id || section.getAttribute('data-section')) : 'unknown';
        console.log(`[LazyBackgroundLoader] Unloaded background for section: ${sectionId}`);
    }

    /**
     * Observe a single element (for dynamically added sections)
     * @param {HTMLElement} element 
     */
    observeElement(element) {
        if (!element || !this.observer) return;
        
        // Add lazy class to prevent immediate loading (if not already processed)
        if (!element.classList.contains(this.loadedClass) && !element.classList.contains('fp-bg-unloaded')) {
            element.classList.add(this.lazyClass);
        }
        
        // Start observing (keep observing to handle load/unload cycles)
        this.observer.observe(element);
    }

    /**
     * Initialize lazy loading for a newly added section
     * @param {HTMLElement} section 
     */
    initForSection(section) {
        if (!section) return;
        
        const fpBg = section.querySelector('.fp-bg');
        if (fpBg) {
            this.observeElement(fpBg);
        }
    }

    /**
     * Re-observe all elements (useful after DOM changes)
     */
    refresh() {
        if (!this.observer) return;
        
        // Observe all .fp-bg elements (including already loaded ones for unload tracking)
        const fpBgElements = document.querySelectorAll('.fp-bg');
        fpBgElements.forEach(el => {
            // Re-observe to enable unloading when scrolling away
            this.observer.observe(el);
            
            // Add lazy class only if not already processed
            if (!el.classList.contains(this.loadedClass) && !el.classList.contains('fp-bg-unloaded')) {
                el.classList.add(this.lazyClass);
            }
        });
        
        console.log(`[LazyBackgroundLoader] Refreshed, observing ${fpBgElements.length} elements`);
    }

    /**
     * Force load a specific element's background (bypass lazy loading)
     * @param {HTMLElement} element 
     */
    forceLoad(element) {
        if (!element) return;
        
        element.classList.remove(this.lazyClass);
        element.classList.remove('fp-bg-unloaded');
        element.classList.add(this.loadedClass);
    }

    /**
     * Force load all backgrounds and disable unloading (for fullscreen mode)
     */
    forceLoadAll() {
        this.isFullscreen = true;
        
        const fpBgElements = document.querySelectorAll('.fp-bg');
        fpBgElements.forEach(el => this.forceLoad(el));
        
        console.log(`[LazyBackgroundLoader] Force loaded ${fpBgElements.length} backgrounds (fullscreen mode)`);
    }

    /**
     * Re-enable unloading (when exiting fullscreen mode)
     */
    enableUnloading() {
        this.isFullscreen = false;
        
        // Refresh to re-observe all elements for unloading
        this.refresh();
        
        console.log('[LazyBackgroundLoader] Unloading re-enabled');
    }

    /**
     * Reset an element to lazy state (for cleanup/testing)
     * @param {HTMLElement} element 
     */
    resetElement(element) {
        if (!element) return;
        
        element.classList.remove(this.loadedClass);
        element.classList.remove('fp-bg-unloaded');
        element.classList.add(this.lazyClass);
        
        if (this.observer) {
            this.observer.observe(element);
        }
    }

    /**
     * Destroy the lazy loader and clean up
     */
    destroy() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        
        // Remove all lazy loading classes from elements
        const elements = document.querySelectorAll('.fp-bg-lazy, .fp-bg-unloaded');
        elements.forEach(el => {
            el.classList.remove(this.lazyClass);
            el.classList.remove('fp-bg-unloaded');
        });
        
        this.initialized = false;
        this.isFullscreen = false;
        console.log('[LazyBackgroundLoader] Destroyed');
    }
}

// Create global instance (with singleton protection)
if (!window.lazyBackgroundLoader) {
    window.lazyBackgroundLoader = new LazyBackgroundLoader();
} else {
    console.log('LazyBackgroundLoader already initialized, skipping');
}

