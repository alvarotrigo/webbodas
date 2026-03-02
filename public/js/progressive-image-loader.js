/**
 * Progressive Image Loader
 * 
 * Prevents browser connection limit issues by loading images in controlled batches.
 * Browsers typically have 6-8 concurrent connections per domain. Loading too many
 * images at once causes them to queue up, blocking ALL images from loading.
 * 
 * This loader:
 * - Loads images in small batches (4-5 at a time)
 * - Uses timeouts to prevent stuck images from blocking everything
 * - Prioritizes visible/near-viewport images
 * - Falls back gracefully if images fail
 */

class ProgressiveImageLoader {
    constructor(options = {}) {
        this.maxConcurrent = options.maxConcurrent || 5; // Max concurrent loads per domain
        this.timeout = options.timeout || 8000; // 8 second timeout per image
        this.retryDelay = options.retryDelay || 1000; // Retry after 1 second
        this.domains = new Map(); // Track loading per domain
        this.queue = []; // Global queue
        this.observer = null; // Intersection observer for lazy loading
        this.debug = options.debug || false; // Enable debug logging
        this.loadStartTime = Date.now();
        
        this.init();
    }
    
    log(...args) {
        if (this.debug) {
            console.log('[ProgressiveLoader]', ...args);
        }
    }
    
    init() {
        // Set up intersection observer for lazy loading
        if ('IntersectionObserver' in window) {
            this.observer = new IntersectionObserver(
                (entries) => this.handleIntersection(entries),
                {
                    rootMargin: '200px', // Start loading 200px before visible
                    threshold: 0.01
                }
            );
        }
        
        // Wait for critical resources before starting image loads
        // This ensures CSS, JS, and fonts load first without competition
        if (document.readyState === 'loading') {
            // Wait for DOMContentLoaded (HTML parsed, critical resources loading)
            document.addEventListener('DOMContentLoaded', () => {
                // Then wait a bit more for critical resources to finish
                this.waitForCriticalResources();
            });
        } else {
            this.waitForCriticalResources();
        }
    }
    
    /**
     * Wait for critical resources (CSS, JS, fonts) before loading images
     * This prevents image loading from competing for connections
     */
    waitForCriticalResources() {
        this.log('⏳ Waiting for critical resources (CSS, JS, fonts) to finish...');
        
        // If page is already loaded, start immediately
        if (document.readyState === 'complete') {
            this.log('✅ Critical resources already loaded, starting image loading');
            this.scanAndLoad();
            return;
        }
        
        // Otherwise wait for window.load (all critical resources done)
        window.addEventListener('load', () => {
            this.log('✅ Critical resources finished loading');
            // Small delay to ensure browser has finished prioritizing
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    this.log('🚀 Starting progressive image loading');
                    this.scanAndLoad();
                });
            });
        });
    }
    
    /**
     * Scan page for images and background images that need loading
     */
    scanAndLoad() {
        this.log('🔍 Scanning page for images to load...');
        
        // Find all img elements
        const imgs = document.querySelectorAll('img[loading="lazy"]');
        this.log(`Found ${imgs.length} lazy-loaded images`);
        imgs.forEach(img => {
            if (this.observer) {
                this.observer.observe(img);
            }
        });
        
        // Find elements with background images
        this.loadBackgroundImages();
    }
    
    /**
     * Load CSS background images progressively
     */
    loadBackgroundImages() {
        const elementsWithBg = document.querySelectorAll('[data-bg="true"], [style*="background"]');
        this.log(`Found ${elementsWithBg.length} elements with background images`);
        
        let queuedCount = 0;
        elementsWithBg.forEach(element => {
            const style = window.getComputedStyle(element);
            const bgImage = style.backgroundImage;
            
            if (bgImage && bgImage !== 'none') {
                // Extract URL from background-image
                const match = bgImage.match(/url\(['"]?([^'"()]+)['"]?\)/);
                if (match && match[1]) {
                    const url = match[1];
                    const domain = this.getDomain(url);
                    
                    // Add to queue if from external domain (like Unsplash)
                    if (domain && domain.includes('unsplash')) {
                        this.queueImage(url, domain, element);
                        queuedCount++;
                    }
                }
            }
        });
        
        this.log(`📋 Queued ${queuedCount} images for progressive loading`);
        
        // Start processing queue
        this.processQueue();
    }
    
    /**
     * Handle intersection observer events
     */
    handleIntersection(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                if (img.dataset.src) {
                    const domain = this.getDomain(img.dataset.src);
                    this.queueImage(img.dataset.src, domain, img);
                }
                this.observer.unobserve(img);
            }
        });
        
        this.processQueue();
    }
    
    /**
     * Extract domain from URL
     */
    getDomain(url) {
        try {
            const urlObj = new URL(url, window.location.href);
            return urlObj.hostname;
        } catch (e) {
            return null;
        }
    }
    
    /**
     * Add image to queue
     */
    queueImage(url, domain, element) {
        // Check if already loaded or queued
        if (element.dataset.imageLoaded === 'true') {
            return;
        }
        
        this.queue.push({
            url,
            domain,
            element,
            priority: this.calculatePriority(element)
        });
        
        // Sort queue by priority (higher first)
        this.queue.sort((a, b) => b.priority - a.priority);
    }
    
    /**
     * Calculate priority based on viewport distance
     */
    calculatePriority(element) {
        const rect = element.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        
        // In viewport = highest priority
        if (rect.top < viewportHeight && rect.bottom > 0) {
            return 100;
        }
        
        // Near viewport = medium priority
        const distance = rect.top < 0 ? Math.abs(rect.bottom) : rect.top;
        if (distance < viewportHeight * 2) {
            return 50 - (distance / (viewportHeight * 2)) * 50;
        }
        
        // Far from viewport = low priority
        return 10;
    }
    
    /**
     * Process the queue
     */
    processQueue() {
        // Process items from queue
        while (this.queue.length > 0) {
            const item = this.queue[0];
            const domain = item.domain;
            
            // Initialize domain tracker if needed
            if (!this.domains.has(domain)) {
                this.domains.set(domain, {
                    loading: 0,
                    queue: []
                });
            }
            
            const domainData = this.domains.get(domain);
            
            // Check if we can load more for this domain
            if (domainData.loading < this.maxConcurrent) {
                // Remove from global queue
                this.queue.shift();
                
                // Start loading
                this.loadImage(item);
            } else {
                // Can't load more for this domain right now
                // Move to next item in queue
                this.queue.shift();
                domainData.queue.push(item);
            }
        }
    }
    
    /**
     * Load a single image with timeout
     */
    loadImage(item) {
        const { url, domain, element } = item;
        const domainData = this.domains.get(domain);
        
        domainData.loading++;
        const startTime = Date.now();
        
        // Get short URL for logging
        const shortUrl = url.split('/').pop().substring(0, 30);
        this.log(`⬇️  Loading [${domainData.loading}/${this.maxConcurrent}] from ${domain}: ${shortUrl}...`);
        
        // Create timeout promise
        const timeoutPromise = new Promise((resolve) => {
            setTimeout(() => resolve({ status: 'timeout' }), this.timeout);
        });
        
        // Create load promise
        const loadPromise = new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve({ status: 'loaded', img });
            img.onerror = () => reject({ status: 'error' });
            img.src = url;
        });
        
        // Race between load and timeout
        Promise.race([loadPromise, timeoutPromise])
            .then((result) => {
                const duration = ((Date.now() - startTime) / 1000).toFixed(2);
                
                if (result.status === 'loaded') {
                    element.dataset.imageLoaded = 'true';
                    this.log(`✅ Loaded in ${duration}s: ${shortUrl}`);
                    
                    // Apply loaded image if it's an img element
                    if (element.tagName === 'IMG' && element.dataset.src) {
                        element.src = element.dataset.src;
                    }
                } else if (result.status === 'timeout') {
                    this.log(`⏱️  Timeout after ${duration}s: ${shortUrl}`);
                }
            })
            .catch((error) => {
                const duration = ((Date.now() - startTime) / 1000).toFixed(2);
                this.log(`❌ Failed after ${duration}s: ${shortUrl}`, error);
            })
            .finally(() => {
                // Decrement loading counter
                domainData.loading--;
                
                // Process domain queue
                if (domainData.queue.length > 0) {
                    const nextItem = domainData.queue.shift();
                    this.log(`📦 Queue size for ${domain}: ${domainData.queue.length + 1} remaining`);
                    this.loadImage(nextItem);
                } else {
                    // Check global queue
                    this.processQueue();
                }
            });
    }
}

// Initialize progressive loader when script loads
// Set debug: true to see detailed loading logs in console
window.progressiveImageLoader = new ProgressiveImageLoader({
    maxConcurrent: 5, // Load 5 images at a time per domain
    timeout: 8000, // 8 second timeout
    debug: false, // Set to true to enable detailed logging
});

