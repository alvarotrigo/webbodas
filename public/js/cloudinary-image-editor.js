/**
 * Cloudinary Image Editor
 * Handles inline image editing with Cloudinary Upload Widget
 * - Upload images
 * - Crop/resize images
 * - Deliver optimized images
 */

class CloudinaryImageEditor {
    constructor(config = {}) {
        this.cloudName = config.cloudName || 'devdwphku'; // Your Cloudinary cloud name
        this.uploadPreset = config.uploadPreset || 'fp_studio'; // Your upload preset name
        this.widget = null;
        this.preloadedWidget = null; // Preloaded flexible widget for faster opening
        this.currentImage = null;
        this.currentBackgroundElement = null; // Current background element being edited
        this.initialized = false;
        this.initPromise = null;
        this.loadingPromise = null; // Track script loading to prevent duplicate requests
        this.pendingSections = []; // Queue of sections waiting for initialization
        this.overlayContainer = null; // Overlay container for indicators
        this.activeIndicators = new Map(); // Map of img/element -> {indicator, cleanup}
        this.updatePositionsRAF = null;
        this.loadingModal = null; // Loading modal wrapper
        this.widgetObserver = null; // Observer to detect when widget is ready
        this.currentWidgetAspectRatio = null; // Track aspect ratio of current widget
        this.isApplyingImageState = false;
        this.imageDataAttributes = [
            'data-image-uid',
            'data-cloudinary-public-id',
            'data-cloudinary-format',
            'data-cloudinary-width',
            'data-cloudinary-height'
        ];
        
        // Create overlay container for indicators (Portal pattern)
        this.createOverlayContainer();
        
        // Load Cloudinary Upload Widget script
        this.initPromise = this.loadCloudinaryScripts();
    }
    
    /**
     * Check if an element is currently in the viewport (with small margin for edge cases)
     * @param {HTMLElement} element 
     * @returns {boolean}
     */
    isElementInViewport(element) {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const margin = 100; // Small margin to handle edge cases
        return (
            rect.bottom >= -margin &&
            rect.top <= window.innerHeight + margin &&
            rect.right >= -margin &&
            rect.left <= window.innerWidth + margin
        );
    }
    
    /**
     * Create overlay container for indicators (Portal pattern)
     * This keeps indicators separate from the document flow
     */
    createOverlayContainer() {
        // Wait for DOM to be ready
        const createContainer = () => {
            // Check if already exists
            const existing = document.getElementById('cloudinary-indicators-overlay');
            if (existing) {
                this.overlayContainer = existing;
                console.log('📸 Cloudinary: Using existing overlay container');
                return;
            }
            
            this.overlayContainer = document.createElement('div');
            this.overlayContainer.id = 'cloudinary-indicators-overlay';
            this.overlayContainer.style.position = 'fixed';
            this.overlayContainer.style.top = '0';
            this.overlayContainer.style.left = '0';
            this.overlayContainer.style.width = '100%';
            this.overlayContainer.style.height = '100%';
            this.overlayContainer.style.pointerEvents = 'none';
            this.overlayContainer.style.zIndex = '9999';
            document.body.appendChild(this.overlayContainer);
            console.log('📸 Cloudinary: Created overlay container');
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
    
    loadCloudinaryScripts() {
        // Check if scripts are already loaded
        if (this.initialized || (window.cloudinary && window.cloudinary.createUploadWidget)) {
            this.initialized = true;
            this.processPendingSections();
            return Promise.resolve();
        }
        
        // Check if already loading
        if (this.loadingPromise) {
            return this.loadingPromise;
        }
        
        // Load Upload Widget script only (Media Library removed - requires authentication)
        this.loadingPromise = this.loadScript('https://upload-widget.cloudinary.com/global/all.js', 'Upload Widget')
            .then(() => {
                this.initialized = true;
                console.log('✅ Cloudinary Upload Widget loaded');
                
                // Process any sections that were queued during initialization
                this.processPendingSections();
            })
            .catch((error) => {
                console.error('❌ Failed to load Cloudinary scripts:', error);
                this.loadingPromise = null; // Allow retry on error
                throw error;
            });
            
        return this.loadingPromise;
    }
    
    loadScript(src, name) {
        return new Promise((resolve, reject) => {
            // Check if script already exists
            const existing = document.querySelector(`script[src="${src}"]`);
            if (existing) {
                console.log(`${name} script already loaded`);
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.onload = () => {
                console.log(`✅ ${name} loaded`);
                resolve();
            };
            script.onerror = () => {
                console.error(`❌ Failed to load ${name}`);
                reject(new Error(`Failed to load ${name}`));
            };
            document.head.appendChild(script);
        });
    }
    
    /**
     * Process sections that were queued while script was loading
     */
    processPendingSections() {
        if (this.pendingSections.length > 0) {
            console.log(`Initializing ${this.pendingSections.length} pending sections`);
            this.pendingSections.forEach(section => {
                this.initForSectionNow(section);
            });
            this.pendingSections = [];
        }
        
        // Preload widget after first initialization for faster opening
        setTimeout(() => {
            this.preloadWidget();
        }, 1000);
    }
    
    /**
     * Initialize image editing for all images in a section
     * This method queues the section if Cloudinary isn't loaded yet
     */
    initForSection(sectionElement) {
        if (!sectionElement) return;
        
        // If not initialized yet, queue this section
        if (!this.initialized) {
            console.log('Cloudinary not ready yet, queuing section for initialization');
            this.pendingSections.push(sectionElement);
            return;
        }
        
        // If initialized, process immediately
        this.initForSectionNow(sectionElement);
    }
    
    /**
     * Actually initialize images in a section (called when Cloudinary is ready)
     */
    initForSectionNow(sectionElement) {
        if (!sectionElement) {
            console.log('⚠️ Cloudinary: No section element provided');
            return;
        }
        
        // Skip if already initialized
        if (sectionElement.hasAttribute('data-cloudinary-initialized')) {
            console.log('⚠️ Cloudinary: Section already initialized, skipping');
            return;
        }
        
        // Mark section as initialized
        sectionElement.setAttribute('data-cloudinary-initialized', 'true');
        
        const images = sectionElement.querySelectorAll('img');
        const bgElements = sectionElement.querySelectorAll('[data-bg="true"]');
        const bgImageElements = sectionElement.querySelectorAll('[data-bg-image="true"]');
        
        console.log(`✅ Cloudinary: Initializing ${images.length} images, ${bgElements.length} background elements, and ${bgImageElements.length} bg-image elements in section`);
        
        // Add visual indicators for all images (but skip those inside data-bg-image elements)
        images.forEach(img => {
            // Skip images that are inside data-bg-image elements (they'll be handled by the bg-image element)
            if (img.closest('[data-bg-image="true"]')) {
                return;
            }
            
            // Ensure overlay container exists before adding indicators
            if (!this.overlayContainer) {
                console.warn('📸 Cloudinary: Overlay container not ready yet, creating now...');
                // Try to create it synchronously if body exists
                if (document.body) {
                    const existing = document.getElementById('cloudinary-indicators-overlay');
                    if (existing) {
                        this.overlayContainer = existing;
                    } else {
                        this.overlayContainer = document.createElement('div');
                        this.overlayContainer.id = 'cloudinary-indicators-overlay';
                        this.overlayContainer.style.position = 'fixed';
                        this.overlayContainer.style.top = '0';
                        this.overlayContainer.style.left = '0';
                        this.overlayContainer.style.width = '100%';
                        this.overlayContainer.style.height = '100%';
                        this.overlayContainer.style.pointerEvents = 'none';
                        this.overlayContainer.style.zIndex = '9999';
                        document.body.appendChild(this.overlayContainer);
                        console.log('📸 Cloudinary: Created overlay container on-demand');
                    }
                }
            }
            
            // Add visual indicator on hover
            this.addEditIndicator(img);
        });
        
        // Add visual indicators for all data-bg and data-bg-image elements (reuse same method)
        [...bgElements, ...bgImageElements].forEach(bgElement => {
            // Ensure overlay container exists before adding indicators
            if (!this.overlayContainer) {
                console.warn('📸 Cloudinary: Overlay container not ready yet, creating now...');
                // Try to create it synchronously if body exists
                if (document.body) {
                    const existing = document.getElementById('cloudinary-indicators-overlay');
                    if (existing) {
                        this.overlayContainer = existing;
                    } else {
                        this.overlayContainer = document.createElement('div');
                        this.overlayContainer.id = 'cloudinary-indicators-overlay';
                        this.overlayContainer.style.position = 'fixed';
                        this.overlayContainer.style.top = '0';
                        this.overlayContainer.style.left = '0';
                        this.overlayContainer.style.width = '100%';
                        this.overlayContainer.style.height = '100%';
                        this.overlayContainer.style.pointerEvents = 'none';
                        this.overlayContainer.style.zIndex = '9999';
                        document.body.appendChild(this.overlayContainer);
                        console.log('📸 Cloudinary: Created overlay container on-demand');
                    }
                }
            }
            
            // Add visual indicator on hover (handles both data-bg and data-bg-image)
            this.addBackgroundEditIndicator(bgElement);
        });
    }
    
    /**
     * Find an image element (either <img> or SVG <image>) within a container
     * @param {HTMLElement} container - Container element to search within
     * @returns {HTMLElement|null} - Found image element or null
     */
    findImageElement(container) {
        // First try to find a regular <img> element
        const imgElement = container.querySelector('img');
        if (imgElement) {
            return imgElement;
        }
        
        // Then try to find an SVG <image> element
        const svgImageElement = container.querySelector('image');
        if (svgImageElement) {
            return svgImageElement;
        }
        
        return null;
    }
    
    /**
     * Get the aspect ratio of an image element (works for both <img> and SVG <image>)
     * @param {HTMLElement} imageElement - The image element
     * @returns {number|null} - Aspect ratio or null if cannot be determined
     */
    getImageAspectRatio(imageElement) {
        if (!imageElement) return null;
        
        const tagName = imageElement.tagName.toLowerCase();
        
        if (tagName === 'img') {
            // For regular <img> elements
            const naturalWidth = imageElement.width || imageElement.naturalWidth;
            const naturalHeight = imageElement.height || imageElement.naturalHeight;
            
            if (naturalWidth > 0 && naturalHeight > 0) {
                return naturalWidth / naturalHeight;
            }
        } else if (tagName === 'image') {
            // For SVG <image> elements - use width/height attributes
            const width = parseFloat(imageElement.getAttribute('width')) || 0;
            const height = parseFloat(imageElement.getAttribute('height')) || 0;
            
            if (width > 0 && height > 0) {
                return width / height;
            }
        }
        
        // Fallback: calculate from display dimensions
        const rect = imageElement.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
            return rect.width / rect.height;
        }
        
        return null;
    }
    
    /**
     * Handle click on a data-bg or data-bg-image element
     * Finds the actual target (img or background-image element) within it
     */
    handleBackgroundElementClick(bgElement) {
        console.log('📸 Background element clicked, searching for target...');
        
        // Check if this is a data-bg-image element - handle it differently
        const isBgImage = bgElement.hasAttribute('data-bg-image') && 
                         bgElement.getAttribute('data-bg-image') === 'true';
        
        if (isBgImage) {
            // For data-bg-image, always find and update the image element inside
            const imgElement = this.findImageElement(bgElement);
            if (!imgElement) {
                console.warn('📸 No <img> or SVG <image> element found inside data-bg-image element');
                return;
            }
            
            const elementType = imgElement.tagName.toLowerCase();
            console.log(`📸 Found <${elementType}> element inside data-bg-image`);
            this.currentImage = imgElement;
            this.currentBackgroundElement = null;
            
            // Calculate aspect ratio from the image
            const aspectRatio = this.getImageAspectRatio(imgElement);
            
            if (aspectRatio) {
                this.currentImageAspectRatio = aspectRatio;
                console.log(`📸 Image aspect ratio: ${this.currentImageAspectRatio.toFixed(3)}`);
            } else {
                this.currentImageAspectRatio = null;
                console.log('📸 Could not determine aspect ratio, using free crop');
            }
            
            this.openUploadWidget();
            return;
        }
        
        // For data-bg elements, use existing logic
        // Strategy 1: Look for an image element in children
        const imgElement = this.findImageElement(bgElement);
        if (imgElement) {
            const elementType = imgElement.tagName.toLowerCase();
            console.log(`📸 Found <${elementType}> element inside data-bg`);
            this.currentImage = imgElement;
            this.currentBackgroundElement = null;
            
            // Check if this is a section with data-bg="true" - use 16:9 for section backgrounds
            const isSectionBackground = bgElement.tagName === 'SECTION' && 
                                       bgElement.hasAttribute('data-bg') && 
                                       bgElement.getAttribute('data-bg') === 'true';
            
            // Check if this is a .fp-bg element - also use 16:9 for .fp-bg backgrounds
            const isFpBg = bgElement.classList && bgElement.classList.contains('fp-bg');
            
            if (isSectionBackground || isFpBg) {
                // Always use 16:9 for section and .fp-bg background images
                this.currentImageAspectRatio = 16 / 9;
                console.log(`📸 ${isFpBg ? '.fp-bg' : 'Section'} background - using 16:9 aspect ratio`);
            } else {
                // Use image's natural aspect ratio for non-section backgrounds
                const aspectRatio = this.getImageAspectRatio(imgElement);
                if (aspectRatio) {
                    this.currentImageAspectRatio = aspectRatio;
                    console.log(`📸 Image aspect ratio: ${this.currentImageAspectRatio.toFixed(3)}`);
                } else {
                    this.currentImageAspectRatio = null;
                    console.log('📸 Could not determine aspect ratio, using free crop');
                }
            }
            
            this.openUploadWidget();
            return;
        }
        
        // Strategy 2: Look for an element with background-image in children (or self)
        const bgImageElement = this.findBackgroundImageElement(bgElement);
        
        if (bgImageElement) {
            console.log('📸 Found element with background-image');
            this.currentBackgroundElement = bgImageElement;
            this.currentImage = null;
            
            // Check if this is a section with data-bg="true" - use 16:9 for section backgrounds
            const isSectionBackground = bgElement.tagName === 'SECTION' && 
                                       bgElement.hasAttribute('data-bg') && 
                                       bgElement.getAttribute('data-bg') === 'true';
            
            // Check if this is a .fp-bg element - also use 16:9 for .fp-bg backgrounds
            const isFpBg = bgElement.classList && bgElement.classList.contains('fp-bg');
            
            if (isSectionBackground || isFpBg) {
                // Always use 16:9 for section and .fp-bg background images
                this.currentImageAspectRatio = 16 / 9;
                console.log(`📸 ${isFpBg ? '.fp-bg' : 'Section'} background - using 16:9 aspect ratio`);
            } else {
                // Calculate aspect ratio from element dimensions for non-section backgrounds
                const rect = bgImageElement.getBoundingClientRect();
                this.currentImageAspectRatio = rect.width / rect.height;
                console.log(`📸 Background aspect ratio: ${this.currentImageAspectRatio.toFixed(3)} (${rect.width}×${rect.height})`);
            }
            
            this.openUploadWidget();
            return;
        }
        
        // Strategy 3: Use the data-bg element itself as the target
        // This handles cases where the element should receive the background-image directly
        console.log('📸 No img or background-image found, using data-bg element itself as target');
        this.currentBackgroundElement = bgElement;
        this.currentImage = null;
        
        // Check if this is a section with data-bg="true" - use 16:9 for section backgrounds
        const isSectionBackground = bgElement.tagName === 'SECTION' && 
                                   bgElement.hasAttribute('data-bg') && 
                                   bgElement.getAttribute('data-bg') === 'true';
        
        // Check if this is a .fp-bg element - also use 16:9 for .fp-bg backgrounds
        const isFpBg = bgElement.classList && bgElement.classList.contains('fp-bg');
        
        if (isSectionBackground || isFpBg) {
            // Always use 16:9 for section and .fp-bg background images
            this.currentImageAspectRatio = 16 / 9;
            console.log(`📸 ${isFpBg ? '.fp-bg' : 'Section'} background - using 16:9 aspect ratio`);
        } else {
            // Calculate aspect ratio from element dimensions
            const rect = bgElement.getBoundingClientRect();
            this.currentImageAspectRatio = rect.width / rect.height;
            console.log(`📸 Element aspect ratio: ${this.currentImageAspectRatio.toFixed(3)} (${rect.width}×${rect.height})`);
        }
        
        this.openUploadWidget();
    }
    
    /**
     * Find the closest element with background-image style
     * Searches the element itself first, then children
     * Checks both inline styles and computed styles
     */
    findBackgroundImageElement(rootElement) {
        // Check the root element itself - inline style first
        const rootBgInline = rootElement.style.backgroundImage || rootElement.style.background;
        if (rootBgInline && rootBgInline.includes('url(')) {
            return rootElement;
        }
        
        // Check computed style for the root element (for CSS-based backgrounds)
        const rootComputedStyle = getComputedStyle(rootElement);
        const rootBgComputed = rootComputedStyle.backgroundImage;
        if (rootBgComputed && rootBgComputed !== 'none' && rootBgComputed.includes('url(')) {
            return rootElement;
        }
        
        // Search all children for background-image
        const allElements = rootElement.querySelectorAll('*');
        for (let element of allElements) {
            // Check inline style
            const bgInline = element.style.backgroundImage || element.style.background;
            if (bgInline && bgInline.includes('url(')) {
                return element;
            }
            
            // Check computed style (for CSS-based backgrounds)
            const computedStyle = getComputedStyle(element);
            const bgComputed = computedStyle.backgroundImage;
            if (bgComputed && bgComputed !== 'none' && bgComputed.includes('url(')) {
                return element;
            }
        }
        
        return null;
    }
    
    /**
     * Add a visual indicator for background elements
     */
    addBackgroundEditIndicator(bgElement) {
        // Skip if already tracking this element
        if (this.activeIndicators.has(bgElement)) {
            return;
        }
        
        // Ensure overlay container exists
        if (!this.overlayContainer) {
            console.warn('📸 Cloudinary: Overlay container not ready, skipping indicator');
            return;
        }
        
        console.log('📸 Cloudinary: Adding background indicator for element', bgElement);
        
        // Create edit indicator in the overlay container
        const indicator = document.createElement('div');
        indicator.className = 'cloudinary-edit-indicator cloudinary-bg-indicator';
        indicator.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
            </svg>
        `;
        indicator.style.position = 'fixed';
        indicator.style.background = 'rgba(0, 0, 0, 0.7)';
        indicator.style.borderRadius = '50%';
        indicator.style.width = '32px';
        indicator.style.height = '32px';
        indicator.style.display = 'flex';
        indicator.style.alignItems = 'center';
        indicator.style.justifyContent = 'center';
        indicator.style.opacity = '0';
        indicator.style.transition = 'opacity 0.2s';
        indicator.style.pointerEvents = 'auto';
        indicator.style.zIndex = '10000';
        indicator.style.cursor = 'pointer';
        
        this.overlayContainer.appendChild(indicator);
        console.log('📸 Cloudinary: Background indicator added to overlay');
        
        // Function to update indicator position
        const updatePosition = () => {
            const rect = bgElement.getBoundingClientRect();
            indicator.style.top = `${rect.top + 8}px`;
            indicator.style.left = `${rect.right - 40}px`;
        };
        
        // Initial position
        updatePosition();
        
        // Click handler on indicator
        const handleIndicatorClick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('📸 Background indicator clicked - opening widget immediately');
            this.handleBackgroundElementClick(bgElement);
        };
        
        indicator.addEventListener('click', handleIndicatorClick);
        
        // Event listeners for hover on background element
        const handleMouseEnter = () => {
            if (!document.body.classList.contains('fullscreen-mode')) {
                updatePosition();
                indicator.style.opacity = '1';
            }
        };
        
        const handleMouseLeave = () => {
            // Delay hiding to allow mouse to reach indicator
            setTimeout(() => {
                if (!indicator.matches(':hover')) {
                    indicator.style.opacity = '0';
                }
            }, 100);
        };
        
        // Keep indicator visible when hovering over it
        const handleIndicatorMouseEnter = () => {
            indicator.style.opacity = '1';
        };
        
        const handleIndicatorMouseLeave = () => {
            indicator.style.opacity = '0';
        };
        
        indicator.addEventListener('mouseenter', handleIndicatorMouseEnter);
        indicator.addEventListener('mouseleave', handleIndicatorMouseLeave);
        
        // Scroll/resize listeners with optimized scroll handler (passive + rAF)
        // Only update if element is in viewport to avoid unnecessary work
        let scrollPending = false;
        const handleScroll = () => {
            if (scrollPending) return;
            scrollPending = true;
            requestAnimationFrame(() => {
                scrollPending = false;
                // Only update position if element is in viewport
                if (this.isElementInViewport(bgElement)) {
                    updatePosition(); // minimal work
                }
            });
        };
        
        bgElement.addEventListener('mouseenter', handleMouseEnter);
        bgElement.addEventListener('mouseleave', handleMouseLeave);
        window.addEventListener('scroll', handleScroll, { passive: true, capture: true });
        window.addEventListener('resize', updatePosition);
        
        // Store reference for cleanup
        this.activeIndicators.set(bgElement, {
            indicator,
            cleanup: () => {
                indicator.removeEventListener('click', handleIndicatorClick);
                indicator.removeEventListener('mouseenter', handleIndicatorMouseEnter);
                indicator.removeEventListener('mouseleave', handleIndicatorMouseLeave);
                bgElement.removeEventListener('mouseenter', handleMouseEnter);
                bgElement.removeEventListener('mouseleave', handleMouseLeave);
                window.removeEventListener('scroll', handleScroll, { passive: true, capture: true });
                window.removeEventListener('resize', updatePosition);
                indicator.remove();
            }
        });
    }
    
    /**
     * Add a subtle edit indicator that appears on hover
     * Uses Portal pattern - indicator is rendered in overlay, not in DOM flow
     */
    addEditIndicator(img) {
        // Skip if already tracking this image
        if (this.activeIndicators.has(img)) {
            return;
        }
        
        // Ensure overlay container exists
        if (!this.overlayContainer) {
            console.warn('📸 Cloudinary: Overlay container not ready, skipping indicator');
            return;
        }
        
        console.log('📸 Cloudinary: Adding indicator for image', img);
        
        // Create edit indicator in the overlay container
        const indicator = document.createElement('div');
        indicator.className = 'cloudinary-edit-indicator';
        indicator.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
        `;
        indicator.style.position = 'fixed';
        indicator.style.background = 'rgba(0, 0, 0, 0.7)';
        indicator.style.borderRadius = '50%';
        indicator.style.width = '32px';
        indicator.style.height = '32px';
        indicator.style.display = 'flex';
        indicator.style.alignItems = 'center';
        indicator.style.justifyContent = 'center';
        indicator.style.opacity = '0';
        indicator.style.transition = 'opacity 0.2s';
        indicator.style.pointerEvents = 'auto';
        indicator.style.zIndex = '10000';
        indicator.style.cursor = 'pointer';
        
        this.overlayContainer.appendChild(indicator);
        console.log('📸 Cloudinary: Indicator added to overlay');
        
        // Function to update indicator position based on image position
        const updatePosition = () => {
            const rect = img.getBoundingClientRect();
            indicator.style.top = `${rect.top + 8}px`;
            indicator.style.left = `${rect.right - 40}px`;
        };
        
        // Initial position
        updatePosition();
        
        // Click handler on indicator
        const handleIndicatorClick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('📸 Image indicator clicked - opening widget immediately');
            
            this.currentImage = img;
            this.currentBackgroundElement = null; // Clear background element
            
            // Calculate and store the aspect ratio for the cropping widget
            const naturalWidth = img.width;
            const naturalHeight = img.height;
            this.currentImageAspectRatio = naturalWidth / naturalHeight;
            
            console.log(`📸 Current image aspect ratio: ${this.currentImageAspectRatio.toFixed(3)} (${naturalWidth}×${naturalHeight})`);
            
            // Open upload widget directly with correct aspect ratio
            this.openUploadWidget();
        };
        
        indicator.addEventListener('click', handleIndicatorClick);
        
        // Event listeners for hover
        const handleMouseEnter = () => {
            if (!document.body.classList.contains('fullscreen-mode')) {
                updatePosition(); // Update position on hover in case image moved
                indicator.style.opacity = '1';
            }
        };
        
        const handleMouseLeave = () => {
            // Delay hiding to allow mouse to reach indicator
            setTimeout(() => {
                if (!indicator.matches(':hover')) {
                    indicator.style.opacity = '0';
                }
            }, 100);
        };
        
        // Keep indicator visible when hovering over it
        const handleIndicatorMouseEnter = () => {
            indicator.style.opacity = '1';
        };
        
        const handleIndicatorMouseLeave = () => {
            indicator.style.opacity = '0';
        };
        
        indicator.addEventListener('mouseenter', handleIndicatorMouseEnter);
        indicator.addEventListener('mouseleave', handleIndicatorMouseLeave);
        
        // Scroll/resize listeners to update position with optimized scroll handler (passive + rAF)
        // Only update if element is in viewport to avoid unnecessary work
        let scrollPending = false;
        const handleScroll = () => {
            if (scrollPending) return;
            scrollPending = true;
            requestAnimationFrame(() => {
                scrollPending = false;
                // Only update position if image is in viewport
                if (this.isElementInViewport(img)) {
                    updatePosition(); // minimal work
                }
            });
        };
        
        img.addEventListener('mouseenter', handleMouseEnter);
        img.addEventListener('mouseleave', handleMouseLeave);
        window.addEventListener('scroll', handleScroll, { passive: true, capture: true }); // Use capture for all scrolls
        window.addEventListener('resize', updatePosition);
        
        // Store reference for cleanup
        this.activeIndicators.set(img, {
            indicator,
            cleanup: () => {
                indicator.removeEventListener('click', handleIndicatorClick);
                indicator.removeEventListener('mouseenter', handleIndicatorMouseEnter);
                indicator.removeEventListener('mouseleave', handleIndicatorMouseLeave);
                img.removeEventListener('mouseenter', handleMouseEnter);
                img.removeEventListener('mouseleave', handleMouseLeave);
                window.removeEventListener('scroll', handleScroll, { passive: true, capture: true });
                window.removeEventListener('resize', updatePosition);
                indicator.remove();
            }
        });
    }
    
    /**
     * Get user folder path for organizing uploads
     */
    getUserFolder() {
        // Try to get user email from parent window
        const userEmail = window.parent?.currentUser?.email || 
                         window.parent?.Clerk?.user?.primaryEmailAddress?.emailAddress;
        
        if (userEmail) {
            // Sanitize email for folder name
            const sanitized = userEmail.replace(/[^a-zA-Z0-9@._-]/g, '_');
            return `fp-studio-media/${sanitized}`;
        }
        
        return 'fp-studio-media/anonymous';
    }
    
    /**
     * Show loading modal wrapper (instant feedback)
     */
    showLoadingModal() {
        // Remove existing modal if any
        this.hideLoadingModal();
        
        // Create modal wrapper
        this.loadingModal = document.createElement('div');
        this.loadingModal.id = 'cloudinary-widget-loading-modal';
        this.loadingModal.style.position = 'fixed';
        this.loadingModal.style.top = '0';
        this.loadingModal.style.left = '0';
        this.loadingModal.style.width = '100%';
        this.loadingModal.style.height = '100%';
        this.loadingModal.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        this.loadingModal.style.display = 'flex';
        this.loadingModal.style.alignItems = 'center';
        this.loadingModal.style.justifyContent = 'center';
        this.loadingModal.style.zIndex = '99999';
        this.loadingModal.style.backdropFilter = 'blur(4px)';
        this.loadingModal.style.animation = 'fadeIn 0.2s ease-in';
        
        // Create loading content
        const loadingContent = document.createElement('div');
        loadingContent.style.textAlign = 'center';
        loadingContent.style.color = 'white';
        
        const spinner = document.createElement('div');
        spinner.className = 'cloudinary-spinner';
        spinner.style.margin = '0 auto 20px';
        
        const text = document.createElement('div');
        text.textContent = 'Loading image editor...';
        text.style.fontSize = '16px';
        text.style.fontWeight = '500';
        text.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        
        loadingContent.appendChild(spinner);
        loadingContent.appendChild(text);
        this.loadingModal.appendChild(loadingContent);
        
        document.body.appendChild(this.loadingModal);
        console.log('📸 Loading modal shown');
    }
    
    /**
     * Hide loading modal wrapper
     */
    hideLoadingModal() {
        if (this.loadingModal) {
            this.loadingModal.style.animation = 'fadeOut 0.2s ease-out';
            setTimeout(() => {
                if (this.loadingModal && this.loadingModal.parentNode) {
                    this.loadingModal.remove();
                }
                this.loadingModal = null;
            }, 200);
        }
        
        // Clean up observer
        if (this.widgetObserver) {
            this.widgetObserver.disconnect();
            this.widgetObserver = null;
        }
    }
    
    /**
     * Properly destroy a widget instance using Cloudinary's API
     */
    destroyWidget(widget) {
        if (!widget) return;
        
        try {
            // First close it if it's open
            if (typeof widget.close === 'function') {
                widget.close();
            }
            
            // Then destroy it using Cloudinary's API (removes from DOM)
            if (typeof widget.destroy === 'function') {
                widget.destroy();
                console.log('📸 Widget destroyed using Cloudinary API');
            }
        } catch (error) {
            console.warn('📸 Error destroying widget:', error);
        }
    }
    
    /**
     * Wait for Cloudinary widget to be visible, then hide our loading modal
     */
    waitForWidgetReady() {
        // Poll for Cloudinary widget container (it creates its own modal)
        // The widget typically creates an iframe with cloudinary.com in the src
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds max wait
        let widgetDetected = false;
        
        const checkWidget = () => {
            if (widgetDetected) return; // Already detected, stop checking
            
            attempts++;
            
            // Look for Cloudinary widget container - multiple strategies
            // Strategy 1: Look for iframe with cloudinary.com
            const cloudinaryIframe = document.querySelector('iframe[src*="cloudinary.com"]');
            
            // Strategy 2: Look for elements with cloudinary in class/id
            const cloudinaryElement = document.querySelector('[class*="cloudinary" i], [id*="cloudinary" i]');
            
            // Strategy 3: Look for widget overlay/backdrop (common pattern)
            const widgetOverlay = document.querySelector('[class*="widget" i][class*="overlay" i], [class*="widget" i][class*="backdrop" i]');
            
            // Check if any widget element is visible
            const widgetContainer = cloudinaryIframe || cloudinaryElement || widgetOverlay;
            
            if (widgetContainer) {
                // Check if it's actually visible (not hidden)
                const rect = widgetContainer.getBoundingClientRect();
                const htmlElement = widgetContainer instanceof HTMLElement ? widgetContainer : null;
                const isVisible = rect.width > 0 && rect.height > 0 && 
                                 (htmlElement ? htmlElement.offsetParent !== null : true) &&
                                 window.getComputedStyle(widgetContainer).display !== 'none' &&
                                 window.getComputedStyle(widgetContainer).visibility !== 'hidden';
                
                if (isVisible) {
                    // Widget is visible!
                    widgetDetected = true;
                    console.log('📸 Cloudinary widget is ready, hiding loading modal');
                    this.hideLoadingModal();
                    return;
                }
            }
            
            if (attempts < maxAttempts) {
                setTimeout(checkWidget, 100);
            } else {
                // Timeout - hide loading modal anyway (widget might have loaded but we missed it)
                console.warn('📸 Widget detection timeout, hiding loading modal');
                this.hideLoadingModal();
            }
        };
        
        // Start checking after a short delay to let widget start rendering
        setTimeout(checkWidget, 150);
        
        // Also use MutationObserver as a backup for faster detection
        this.widgetObserver = new MutationObserver((mutations) => {
            if (widgetDetected) return;
            
            // Check for widget on each mutation
            const cloudinaryIframe = document.querySelector('iframe[src*="cloudinary.com"]');
            const cloudinaryElement = document.querySelector('[class*="cloudinary" i], [id*="cloudinary" i]');
            const widgetContainer = cloudinaryIframe || cloudinaryElement;
            
            if (widgetContainer) {
                const rect = widgetContainer.getBoundingClientRect();
                const htmlElement = widgetContainer instanceof HTMLElement ? widgetContainer : null;
                const isVisible = rect.width > 0 && rect.height > 0 && 
                                 (htmlElement ? htmlElement.offsetParent !== null : true) &&
                                 window.getComputedStyle(widgetContainer).display !== 'none';
                
                if (isVisible) {
                    widgetDetected = true;
                    console.log('📸 Cloudinary widget detected via MutationObserver');
                    this.hideLoadingModal();
                }
            }
        });
        
        this.widgetObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'id', 'style']
        });
    }
    
    /**
     * Open Cloudinary Upload Widget
     * Reuses existing widget when possible, otherwise destroys old one and creates new
     */
    openUploadWidget() {
        if (!this.initialized || !window.cloudinary) {
            console.error('Cloudinary Upload Widget not loaded yet');
            return;
        }
        
        // Show loading modal immediately for instant feedback
        this.showLoadingModal();
        
        // Get aspect ratio for cropping constraint
        const aspectRatio = this.currentImageAspectRatio || null;
        
        // Check if we can reuse the existing widget (same aspect ratio)
        const canReuseWidget = this.widget && 
                               this.currentWidgetAspectRatio === aspectRatio;
        
        if (canReuseWidget) {
            console.log('📸 Reusing existing widget ⚡');
            // Only open if not already open (widget might still be open from previous use)
            try {
                this.widget.open();
            } catch (error) {
                // Widget might already be open, that's okay
                console.log('📸 Widget already open or opening');
            }
            this.waitForWidgetReady();
            return;
        }
        
        // Strategy: Use preloaded widget ONLY if we don't need aspect ratio enforcement
        // AND we don't already have a widget with the right aspect ratio
        if (!aspectRatio && this.preloadedWidget) {
            console.log('📸 Using preloaded widget (no aspect ratio constraint) ⚡');
            
            // Destroy existing widget if it exists
            if (this.widget) {
                this.destroyWidget(this.widget);
                this.widget = null;
            }
            
            this.widget = this.preloadedWidget;
            this.preloadedWidget = null; // Clear so we create a new one
            this.currentWidgetAspectRatio = null;
            this.widget.open();
            
            // Wait for widget to be ready
            this.waitForWidgetReady();
            
            // Preload another one in the background for next time
            setTimeout(() => this.preloadWidget(), 1000);
            return;
        }
        
        // Need to create a new widget (different aspect ratio or no widget exists)
        if (aspectRatio) {
            console.log(`📸 Creating widget with LOCKED aspect ratio: ${aspectRatio.toFixed(3)} 🔒`);
        } else {
            console.log('📸 Creating widget without aspect ratio constraint');
        }
        
        // Properly destroy existing widget if any (removes from DOM)
        if (this.widget) {
            console.log('📸 Destroying existing widget before creating new one');
            this.destroyWidget(this.widget);
            this.widget = null;
            this.currentWidgetAspectRatio = null;
        }
        
        // Also destroy preloaded widget if it exists (to avoid multiple instances)
        if (this.preloadedWidget) {
            console.log('📸 Destroying preloaded widget to avoid conflicts');
            this.destroyWidget(this.preloadedWidget);
            this.preloadedWidget = null;
        }
        
        const userFolder = this.getUserFolder();
        this.widget = cloudinary.createUploadWidget(
            {
                cloudName: this.cloudName,
                uploadPreset: this.uploadPreset,
                // Include both local upload and media library in the same widget
                sources: ['local', 'url', 'camera', 'image_search'],
                // Enable search in user's folder
                searchByRights: false,
                searchBySites: [],
                multiple: false,
                cropping: true,
                croppingAspectRatio: aspectRatio, // Force aspect ratio to match original image
                croppingShowDimensions: true,
                croppingCoordinatesMode: 'custom',
                showSkipCropButton: aspectRatio ? false : true, // Hide skip if we're enforcing ratio
                    folder: userFolder, // Organize by user
                    // Default to "My Files" tab to show previously uploaded images first
                    defaultSource: 'local',
                    tabs: 'file',
                    styles: {
                        palette: {
                            window: '#FFFFFF',
                            windowBorder: '#90A0B3',
                            tabIcon: '#0078FF',
                            menuIcons: '#5A616A',
                            textDark: '#000000',
                            textLight: '#FFFFFF',
                            link: '#0078FF',
                            action: '#FF620C',
                            inactiveTabIcon: '#0E2F5A',
                            error: '#F44235',
                            inProgress: '#0078FF',
                            complete: '#20B832',
                            sourceBg: '#E4EBF1'
                        },
                        fonts: {
                            default: null,
                            "'Poppins', sans-serif": {
                                url: 'https://fonts.googleapis.com/css?family=Poppins',
                                active: true
                            }
                        }
                    },
                    // Advanced options
                    clientAllowedFormats: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'],
                    maxImageFileSize: 10000000, // 10MB
                    maxImageWidth: 4000,
                    maxImageHeight: 4000,
                    showAdvancedOptions: false,
                    showCompletedButton: false,
                    showUploadMoreButton: false,
                    language: 'en',
                    text: {
                        en: {
                            or: 'or',
                            back: 'Back',
                            advanced: 'Advanced',
                            close: 'Close',
                            no_results: 'No results',
                            search_placeholder: 'Search files',
                            about_uw: 'About the Upload Widget',
                            menu: {
                                files: 'My Files',
                                web: 'Web Address',
                                camera: 'Camera'
                            },
                            local: {
                                browse: 'Browse',
                                dd_title_single: 'Drag and Drop image here',
                                dd_title_multi: 'Drag and Drop images here',
                                drop_title_single: 'Drop image to upload',
                                drop_title_multiple: 'Drop images to upload'
                            },
                            crop: {
                                title: aspectRatio ? `Crop (${aspectRatio.toFixed(2)} ratio locked)` : 'Crop',
                                crop_btn: 'Crop & Upload',
                                skip_btn: 'Skip Cropping',
                                reset_btn: 'Reset',
                                close_btn: 'Close',
                                close_prompt: 'Closing will cancel all uploads, Are you sure?',
                                image_error: 'Error loading image',
                                corner_tooltip: 'Drag corner to resize',
                                handle_tooltip: aspectRatio ? 'Drag to reposition (ratio locked)' : 'Drag handle to resize'
                            }
                        }
                    }
                },
                (error, result) => {
                    this.handleUploadResult(error, result);
                }
            );
        
        // Track the aspect ratio for this widget
        this.currentWidgetAspectRatio = aspectRatio;
        
        // Open the widget
        this.widget.open();
        
        // Wait for widget to be ready
        this.waitForWidgetReady();
    }
    
    /**
     * Preload/create a flexible widget instance for faster opening
     * This widget has NO aspect ratio constraint, used for images where ratio doesn't matter
     */
    preloadWidget() {
        if (!this.initialized || !window.cloudinary) {
            return;
        }
        
        if (this.preloadedWidget) {
            return; // Already have one
        }
        
        console.log('📸 Preloading flexible widget in background...');
        
        const userFolder = this.getUserFolder();
        
        // Create widget WITHOUT aspect ratio constraint
        this.preloadedWidget = cloudinary.createUploadWidget(
            {
                cloudName: this.cloudName,
                uploadPreset: this.uploadPreset,
                sources: ['local', 'url', 'camera', 'image_search'],
                searchByRights: false,
                searchBySites: [],
                multiple: false,
                cropping: true,
                croppingAspectRatio: null, // NO constraint - free cropping
                croppingShowDimensions: true,
                croppingCoordinatesMode: 'custom',
                showSkipCropButton: true,
                folder: userFolder,
                defaultSource: 'local',
                tabs: 'file',
                styles: {
                    palette: {
                        window: '#FFFFFF',
                        windowBorder: '#90A0B3',
                        tabIcon: '#0078FF',
                        menuIcons: '#5A616A',
                        textDark: '#000000',
                        textLight: '#FFFFFF',
                        link: '#0078FF',
                        action: '#FF620C',
                        inactiveTabIcon: '#0E2F5A',
                        error: '#F44235',
                        inProgress: '#0078FF',
                        complete: '#20B832',
                        sourceBg: '#E4EBF1'
                    },
                    fonts: {
                        default: null,
                        "'Poppins', sans-serif": {
                            url: 'https://fonts.googleapis.com/css?family=Poppins',
                            active: true
                        }
                    }
                },
                clientAllowedFormats: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'],
                maxImageFileSize: 10000000,
                maxImageWidth: 4000,
                maxImageHeight: 4000,
                showAdvancedOptions: false,
                showCompletedButton: false,
                showUploadMoreButton: false,
                language: 'en',
                text: {
                    en: {
                        or: 'or',
                        back: 'Back',
                        advanced: 'Advanced',
                        close: 'Close',
                        no_results: 'No results',
                        search_placeholder: 'Search files',
                        about_uw: 'About the Upload Widget',
                        menu: {
                            files: 'My Files',
                            web: 'Web Address',
                            camera: 'Camera'
                        },
                        local: {
                            browse: 'Browse',
                            dd_title_single: 'Drag and Drop image here',
                            dd_title_multi: 'Drag and Drop images here',
                            drop_title_single: 'Drop image to upload',
                            drop_title_multiple: 'Drop images to upload'
                        },
                        crop: {
                            title: 'Crop',
                            crop_btn: 'Crop & Upload',
                            skip_btn: 'Skip Cropping',
                            reset_btn: 'Reset',
                            close_btn: 'Close',
                            close_prompt: 'Closing will cancel all uploads, Are you sure?',
                            image_error: 'Error loading image',
                            corner_tooltip: 'Drag corner to resize',
                            handle_tooltip: 'Drag handle to resize'
                        }
                    }
                }
            },
            (error, result) => {
                this.handleUploadResult(error, result);
            }
        );
        
        console.log('✅ Flexible widget preloaded and ready');
    }
    
    /**
     * Open editor for data attribute editing
     * This creates a specialized widget for editing data-* attributes
     * @param {string} currentImageUrl - Current image URL
     * @param {function} onSuccess - Callback when image is successfully edited
     * @param {object} options - Additional options
     */
    openEditorForDataAttribute(currentImageUrl, onSuccess, options = {}) {
        if (!this.initialized || !window.cloudinary) {
            console.error('Cloudinary not initialized');
            return;
        }
        
        // Get user folder for organization
        const userFolder = window.CLERK_USER_ID || 'guest';
        
        // Create a one-time widget for this edit
        const dataAttributeWidget = cloudinary.createUploadWidget(
            {
                cloudName: this.cloudName,
                uploadPreset: this.uploadPreset,
                sources: ['local', 'url', 'camera', 'image_search'],
                searchByRights: false,
                searchBySites: [],
                multiple: false,
                cropping: true,
                croppingShowDimensions: true,
                croppingCoordinatesMode: 'custom',
                showSkipCropButton: true,
                folder: userFolder,
                defaultSource: 'local',
                tabs: 'file',
                styles: {
                    palette: {
                        window: '#FFFFFF',
                        windowBorder: '#90A0B3',
                        tabIcon: '#0078FF',
                        menuIcons: '#5A616A',
                        textDark: '#000000',
                        textLight: '#FFFFFF',
                        link: '#0078FF',
                        action: '#FF620C',
                        inactiveTabIcon: '#0E2F5A',
                        error: '#F44235',
                        inProgress: '#0078FF',
                        complete: '#20B832',
                        sourceBg: '#E4EBF1'
                    },
                    fonts: {
                        default: null,
                        "'Poppins', sans-serif": {
                            url: 'https://fonts.googleapis.com/css?family=Poppins',
                            active: true
                        }
                    }
                },
                clientAllowedFormats: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'],
                maxImageFileSize: 10000000,
                maxImageWidth: 4000,
                maxImageHeight: 4000,
                showAdvancedOptions: false,
                showCompletedButton: false,
                showUploadMoreButton: false,
                language: 'en',
                text: {
                    en: {
                        or: 'or',
                        back: 'Back',
                        advanced: 'Advanced',
                        close: 'Close',
                        no_results: 'No results',
                        search_placeholder: 'Search files',
                        about_uw: 'About the Upload Widget',
                        menu: {
                            files: 'My Files',
                            web: 'Web Address',
                            camera: 'Camera'
                        },
                        local: {
                            browse: 'Browse',
                            dd_title_single: 'Drag and Drop image here',
                            dd_title_multi: 'Drag and Drop images here',
                            drop_title_single: 'Drop image to upload',
                            drop_title_multiple: 'Drop images to upload'
                        },
                        crop: {
                            title: 'Edit Image',
                            crop_btn: 'Crop & Save',
                            skip_btn: 'Skip Cropping',
                            reset_btn: 'Reset',
                            close_btn: 'Close',
                            close_prompt: 'Closing will cancel all uploads, Are you sure?',
                            image_error: 'Error loading image',
                            corner_tooltip: 'Drag corner to resize',
                            handle_tooltip: 'Drag handle to resize'
                        }
                    }
                }
            },
            (error, result) => {
                if (error) {
                    console.error('Cloudinary upload error:', error);
                    return;
                }
                
                if (result.event === 'success') {
                    // Get the optimized image URL
                    const imageUrl = result.info.secure_url;
                    
                    // Call success callback with both URL and full upload info
                    // This allows the caller to generate custom optimized URLs if needed
                    if (typeof onSuccess === 'function') {
                        onSuccess(imageUrl, result.info);
                    }
                    
                    // Close the widget
                    dataAttributeWidget.close();
                }
            }
        );
        
        // Open the widget
        dataAttributeWidget.open();
    }
    
    /**
     * Show loading overlay while widget is loading
     */
    showLoadingOverlay() {
        // Remove existing overlay if any
        this.hideLoadingOverlay();
        
        const overlay = document.createElement('div');
        overlay.id = 'cloudinary-loading-overlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.zIndex = '99999';
        overlay.style.backdropFilter = 'blur(4px)';
        
        const spinner = document.createElement('div');
        spinner.className = 'cloudinary-loading-spinner';
        spinner.innerHTML = `
            <div class="cloudinary-spinner"></div>
            <div style="color: white; margin-top: 20px; font-size: 16px; font-weight: 500;">
                Loading image editor...
            </div>
        `;
        spinner.style.textAlign = 'center';
        
        overlay.appendChild(spinner);
        document.body.appendChild(overlay);
    }
    
    /**
     * Hide loading overlay
     */
    hideLoadingOverlay() {
        const overlay = document.getElementById('cloudinary-loading-overlay');
        if (overlay) {
            overlay.remove();
        }
    }
    
    /**
     * Open Cloudinary Media Library to browse existing uploads
     * 
     * NOTE: This method has been disabled because Cloudinary's Media Library widget
     * requires users to authenticate with their Cloudinary credentials, which is not
     * acceptable for end users of this app.
     * 
     * To implement a proper media library:
     * 1. Create a backend API endpoint that queries Cloudinary's Search API
     * 2. Build a custom UI that displays the user's uploaded images
     * 3. Handle image selection without requiring Cloudinary authentication
     * 
     * For now, users can only upload new images via the Upload Widget.
     */
    openMediaLibrary() {
        console.warn('Media Library has been disabled. Please use the Upload Widget to add images.');
        console.warn('To implement a custom media library, see the comments in this method.');
        
        // Removed authentication-based Media Library implementation
        // Users should not be required to create Cloudinary accounts
    }
    
    /**
     * Handle upload result from Cloudinary
     */
    handleUploadResult(error, result) {
        if (error) {
            console.error('Upload error:', error);
            this.showNotification('Failed to upload image', 'error');
            return;
        }
        
        if (result && result.event === 'success') {
            console.log('Upload successful:', result.info);
            
            // Check if we're updating a regular image or a background element
            if (this.currentImage) {
                // Update regular <img> element
                this.updateImage(this.currentImage, result.info.secure_url, result.info);
            } else if (this.currentBackgroundElement) {
                // Update background-image style
                this.updateBackgroundImage(this.currentBackgroundElement, result.info.secure_url, result.info);
            }
            
            // Success notification is shown in updateImage/updateBackgroundImage after loading
        }
        
        if (result && result.event === 'close') {
            console.log('Widget closed');
            // Hide loading modal if it's still showing
            this.hideLoadingModal();
            
            // Clean up replace flags if user closed without uploading
            if (this.currentBackgroundElement) {
                const fpBg = this.currentBackgroundElement.classList && this.currentBackgroundElement.classList.contains('fp-bg')
                    ? this.currentBackgroundElement
                    : this.currentBackgroundElement.querySelector('.fp-bg');
                
                if (fpBg) {
                    // Clean up flag if user cancelled
                    if (fpBg.hasAttribute('data-replace-video-with-image')) {
                        fpBg.removeAttribute('data-replace-video-with-image');
                    }
                }
            }
        }
    }
    
    /**
     * Get optimized URL with Cloudinary transformations
     * Intelligently sizes the image based on display dimensions
     */
    getOptimizedUrl(info, targetElement = null) {
        const { public_id, format, resource_type, width, height } = info;
        
        // Detect the actual display size of the target image element
        let targetWidth = null;
        let targetHeight = null;
        
        // Detect crop mode based on image styling
        let cropMode = 'limit'; // Default: fit within bounds
        
        if (targetElement) {
            const rect = targetElement.getBoundingClientRect();
            const computedStyle = window.getComputedStyle(targetElement);
            const tagName = targetElement.tagName.toLowerCase();
            
            // Get width and height based on element type
            let elementWidth, elementHeight;
            if (tagName === 'image') {
                // SVG <image> elements use attributes
                elementWidth = parseFloat(targetElement.getAttribute('width')) || 0;
                elementHeight = parseFloat(targetElement.getAttribute('height')) || 0;
            } else {
                // Regular <img> elements use properties
                elementWidth = targetElement.width || 0;
                elementHeight = targetElement.height || 0;
            }
            
            // Get the display dimensions (accounting for DPR for retina displays)
            const displayWidth = rect.width || parseInt(computedStyle.width) || elementWidth;
            const displayHeight = rect.height || parseInt(computedStyle.height) || elementHeight;
            
            // Get the original image's aspect ratio to preserve it
            const originalWidth = elementWidth || displayWidth;
            const originalHeight = elementHeight || displayHeight;
            const originalAspectRatio = originalWidth / originalHeight;
            
            console.log(`📸 Original image aspect ratio: ${originalAspectRatio.toFixed(2)} (${originalWidth}×${originalHeight})`);
            
            // Detect if image uses object-fit: cover (needs c_fill)
            const objectFit = computedStyle.objectFit;
            const borderRadius = computedStyle.borderRadius;
            
            // If object-fit is 'cover' or image has significant border-radius (circular/rounded),
            // use c_fill to ensure it fills the container properly
            if (objectFit === 'cover' || 
                (borderRadius && (borderRadius === '50%' || parseInt(borderRadius) > 20))) {
                cropMode = 'fill';
                console.log('📸 Detected object-fit:cover or rounded image → using c_fill');
            }
            
            // Calculate target dimensions with 2x multiplier for retina displays
            // IMPORTANT: Maintain the original image's aspect ratio
            if (displayWidth > 0 && displayHeight > 0) {
                // Use display dimensions but force the original aspect ratio
                targetWidth = Math.ceil(displayWidth * 2);
                targetHeight = Math.ceil(displayHeight * 2);
                
                // Verify aspect ratio matches - if not, adjust to match original
                const targetAspectRatio = targetWidth / targetHeight;
                const aspectRatioDiff = Math.abs(targetAspectRatio - originalAspectRatio);
                
                // If aspect ratios differ by more than 1%, force match the original
                if (aspectRatioDiff > 0.01) {
                    console.log(`📸 Adjusting to match original aspect ratio (${originalAspectRatio.toFixed(2)})`);
                    // Adjust height to match original aspect ratio
                    targetHeight = Math.ceil(targetWidth / originalAspectRatio);
                }
            } else if (displayWidth > 0) {
                targetWidth = Math.ceil(displayWidth * 2);
                targetHeight = Math.ceil(targetWidth / originalAspectRatio);
            } else if (displayHeight > 0) {
                targetHeight = Math.ceil(displayHeight * 2);
                targetWidth = Math.ceil(targetHeight * originalAspectRatio);
            }
            
            console.log(`📸 Image display size: ${displayWidth}x${displayHeight}px → Requesting: ${targetWidth}x${targetHeight}px (aspect ratio: ${(targetWidth/targetHeight).toFixed(2)}, mode: ${cropMode})`);
        }
        
        // Build transformations
        const baseUrl = `https://res.cloudinary.com/${this.cloudName}/${resource_type}/upload/`;
        
        // Build transformation string
        let transformations = 'f_auto,q_auto:good'; // Auto format + auto quality
        
        // Add intelligent width/height constraints with appropriate crop mode
        if (targetWidth && targetHeight) {
            if (cropMode === 'fill') {
                // c_fill = crop to fill container (for object-fit: cover images)
                // g_auto = smart cropping (focuses on faces/important content)
                transformations += `,w_${targetWidth},h_${targetHeight},c_fill,g_auto`;
            } else {
                // c_limit = fit within bounds without cropping
                transformations += `,w_${targetWidth},h_${targetHeight},c_limit`;
            }
        } else if (targetWidth) {
            transformations += `,w_${targetWidth},c_limit`;
        } else {
            // Fallback: cap at reasonable max width to prevent loading huge images
            transformations += `,w_2000,c_limit`;
        }
        
        // Add DPR for automatic device pixel ratio handling (optional, already handled with 2x multiplier)
        // transformations += ',dpr_auto';
        
        const imageId = `${public_id}.${format}`;
        const optimizedUrl = `${baseUrl}${transformations}/${imageId}`;
        
        console.log(`📸 Cloudinary URL: ${optimizedUrl}`);
        return optimizedUrl;
    }
    
    /**
     * Generate responsive srcset for an image
     * Creates multiple size variants for different screen sizes while maintaining aspect ratio
     */
    getResponsiveSrcset(info, targetElement = null) {
        const { public_id, format, resource_type } = info;
        const baseUrl = `https://res.cloudinary.com/${this.cloudName}/${resource_type}/upload/`;
        
        // Get aspect ratio from target element if available
        let aspectRatio = null;
        if (targetElement) {
            const originalWidth = targetElement.width;
            const originalHeight = targetElement.height;
            aspectRatio = originalWidth / originalHeight;
        }
        
        // Common responsive sizes (optimized for web)
        const sizes = [320, 640, 768, 1024, 1280, 1920, 2560];
        
        const srcsetEntries = sizes.map(size => {
            let transformations = `f_auto,q_auto:good,w_${size}`;
            
            // If we have aspect ratio, add height to maintain it
            if (aspectRatio) {
                const height = Math.ceil(size / aspectRatio);
                transformations += `,h_${height},c_fill,g_auto`;
            } else {
                transformations += `,c_limit`;
            }
            
            const imageId = `${public_id}.${format}`;
            return `${baseUrl}${transformations}/${imageId} ${size}w`;
        });
        
        return srcsetEntries.join(', ');
    }
    
    generateImageUid() {
        return 'img_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
    }
    
    ensureImageUid(imgElement) {
        if (!imgElement) return null;
        let uid = imgElement.getAttribute('data-image-uid');
        if (!uid) {
            uid = this.generateImageUid();
            imgElement.setAttribute('data-image-uid', uid);
        }
        return uid;
    }
    
    captureImageState(imgElement) {
        if (!imgElement) return null;
        
        const tagName = imgElement.tagName.toLowerCase();
        const dataAttributes = {};
        this.imageDataAttributes.forEach(attr => {
            const value = imgElement.getAttribute(attr);
            if (value !== null && value !== undefined) {
                dataAttributes[attr] = value;
            }
        });
        
        // Handle SVG <image> elements differently
        if (tagName === 'image') {
            return {
                src: imgElement.getAttribute('href') || 
                     imgElement.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || '',
                srcset: '', // SVG images don't use srcset
                sizes: '', // SVG images don't use sizes
                alt: '', // SVG images don't use alt
                dataAttributes,
                isSvgImage: true // Flag to identify SVG images
            };
        }
        
        // Handle regular <img> elements
        return {
            src: imgElement.getAttribute('src') || '',
            srcset: imgElement.getAttribute('srcset') || '',
            sizes: imgElement.getAttribute('sizes') || '',
            alt: imgElement.getAttribute('alt') || '',
            dataAttributes,
            isSvgImage: false
        };
    }
    
    cloneImageState(state) {
        if (!state) return null;
        return {
            src: state.src,
            srcset: state.srcset,
            sizes: state.sizes,
            alt: state.alt,
            dataAttributes: { ...(state.dataAttributes || {}) },
            isSvgImage: state.isSvgImage || false
        };
    }
    
    getSectionNumberFromElement(element) {
        if (!element) return null;
        const section = element.closest('.section');
        if (section && section.hasAttribute('data-section')) {
            return section.getAttribute('data-section');
        }
        return null;
    }
    
    emitImageCommand({ sectionNumber, imageUid, beforeState, afterState, label }) {
        if (!window.parent || window.parent === window || !window.parent.postMessage) {
            return;
        }
        
        if (!sectionNumber || !imageUid || !beforeState || !afterState) {
            return;
        }
        
        const beforeSerialized = JSON.stringify(beforeState);
        const afterSerialized = JSON.stringify(afterState);
        if (beforeSerialized === afterSerialized) {
            return;
        }
        
        window.parent.postMessage({
            type: 'COMMAND_IMAGE_CHANGE',
            data: {
                sectionNumber,
                imageUid,
                beforeState: this.cloneImageState(beforeState),
                afterState: this.cloneImageState(afterState),
                label
            }
        }, '*');
    }
    
    applyImageState(imageUid, state, options = {}) {
        if (!imageUid || !state) return;
        
        const sectionNumber = options.sectionNumber;
        const beforeState = options.beforeState;
        const afterState = options.afterState;
        const shouldScroll = options.shouldScroll || false;
        
        // Try to find by UID first
        let imgElement = document.querySelector(`[data-image-uid="${imageUid}"]`);
        
        // If not found by UID, try smart fallbacks (important for restored sections)
        if (!imgElement && sectionNumber) {
            const section = document.querySelector(`[data-section="${sectionNumber}"]`);
            if (section) {
                // Strategy 1: Find by matching the "opposite" state's src
                // Look for image with the before state's src if we have it
                const searchState = beforeState;
                if (searchState && searchState.src) {
                    // Search both <img> and SVG <image> elements
                    const imgElements = section.querySelectorAll('img');
                    for (const img of imgElements) {
                        if (img.getAttribute('src') === searchState.src) {
                            imgElement = img;
                            console.log(`📸 Image UID not found, found <img> by beforeState src: ${searchState.src}`);
                            break;
                        }
                    }
                    
                    // Also search SVG <image> elements if not found
                    if (!imgElement) {
                        const svgImages = section.querySelectorAll('image');
                        for (const svgImg of svgImages) {
                            const href = svgImg.getAttribute('href') || 
                                        svgImg.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
                            if (href === searchState.src) {
                                imgElement = svgImg;
                                console.log(`📸 Image UID not found, found SVG <image> by beforeState href: ${searchState.src}`);
                                break;
                            }
                        }
                    }
                }
                
                // Strategy 2: Find by Cloudinary public ID if available
                if (!imgElement && state.dataAttributes && state.dataAttributes['data-cloudinary-public-id']) {
                    const publicId = state.dataAttributes['data-cloudinary-public-id'];
                    imgElement = section.querySelector(`[data-cloudinary-public-id="${publicId}"]`);
                    if (imgElement) {
                        console.log(`📸 Image UID not found, found by public ID: ${publicId}`);
                    }
                }
                
                // Strategy 3: Find by current src (fallback)
                if (!imgElement && state.src) {
                    const imgElements = section.querySelectorAll('img');
                    for (const img of imgElements) {
                        if (img.getAttribute('src') === state.src) {
                            imgElement = img;
                            console.log(`📸 Image UID not found, found <img> by current src: ${state.src}`);
                            break;
                        }
                    }
                    
                    // Also search SVG <image> elements if not found
                    if (!imgElement) {
                        const svgImages = section.querySelectorAll('image');
                        for (const svgImg of svgImages) {
                            const href = svgImg.getAttribute('href') || 
                                        svgImg.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
                            if (href === state.src) {
                                imgElement = svgImg;
                                console.log(`📸 Image UID not found, found SVG <image> by current href: ${state.src}`);
                                break;
                            }
                        }
                    }
                }
            }
        }
        
        if (!imgElement) {
            console.warn(`📸 Could not find image with UID: ${imageUid} in section: ${sectionNumber}`);
            return;
        }
        
        const shouldSuppressHistory = options.skipHistory === true;
        if (shouldSuppressHistory) {
            this.isApplyingImageState = true;
        }
        
        // Ensure UID is set (important for newly restored sections)
        imgElement.setAttribute('data-image-uid', imageUid);
        
        const tagName = imgElement.tagName.toLowerCase();
        const isSvgImage = tagName === 'image';
        
        // Handle src/href based on element type
        if (state.src !== undefined) {
            if (isSvgImage) {
                // SVG <image> uses href/xlink:href
                if (state.src) {
                    imgElement.setAttribute('href', state.src);
                    imgElement.setAttributeNS('http://www.w3.org/1999/xlink', 'href', state.src);
                } else {
                    imgElement.removeAttribute('href');
                    imgElement.removeAttributeNS('http://www.w3.org/1999/xlink', 'href');
                }
            } else {
                // Regular <img> uses src
                if (state.src) {
                    imgElement.setAttribute('src', state.src);
                } else {
                    imgElement.removeAttribute('src');
                }
            }
        }
        
        // srcset, sizes, and alt only apply to regular <img> elements
        if (!isSvgImage) {
            if (state.srcset !== undefined) {
                if (state.srcset) {
                    imgElement.setAttribute('srcset', state.srcset);
                } else {
                    imgElement.removeAttribute('srcset');
                }
            }
            
            if (state.sizes !== undefined) {
                if (state.sizes) {
                    imgElement.setAttribute('sizes', state.sizes);
                } else {
                    imgElement.removeAttribute('sizes');
                }
            }
            
            if (state.alt !== undefined) {
                if (state.alt) {
                    imgElement.setAttribute('alt', state.alt);
                } else {
                    imgElement.removeAttribute('alt');
                }
            }
        }
        
        const dataAttributes = state.dataAttributes || {};
        this.imageDataAttributes.forEach(attr => {
            if (dataAttributes[attr]) {
                imgElement.setAttribute(attr, dataAttributes[attr]);
            } else {
                imgElement.removeAttribute(attr);
            }
        });
        
        // Scroll to the section if requested (for undo/redo)
        if (shouldScroll) {
            const section = imgElement.closest('.section');
            if (section) {
                section.scrollIntoView({ behavior: 'auto', block: 'center' });
            }
        }
        
        if (shouldSuppressHistory) {
            this.isApplyingImageState = false;
        }
    }
    
    /**
     * Update image element with new URL
     * Intelligently requests the appropriate size from Cloudinary
     */
    /**
     * Get the image source from an element (works for both <img> and SVG <image>)
     * @param {HTMLElement} imgElement - The image element
     * @returns {string} - The image source URL
     */
    getImageSource(imgElement) {
        const tagName = imgElement.tagName.toLowerCase();
        
        if (tagName === 'img') {
            return imgElement.src || '';
        } else if (tagName === 'image') {
            // SVG <image> elements use href or xlink:href
            return imgElement.getAttribute('href') || 
                   imgElement.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || '';
        }
        
        return '';
    }
    
    /**
     * Set the image source on an element (works for both <img> and SVG <image>)
     * @param {HTMLElement} imgElement - The image element
     * @param {string} url - The image source URL
     */
    setImageSource(imgElement, url) {
        const tagName = imgElement.tagName.toLowerCase();
        
        if (tagName === 'img') {
            imgElement.src = url;
        } else if (tagName === 'image') {
            // SVG <image> elements use href (modern) and xlink:href (legacy)
            imgElement.setAttribute('href', url);
            // Also set xlink:href for broader compatibility
            imgElement.setAttributeNS('http://www.w3.org/1999/xlink', 'href', url);
        }
    }
    
    updateImage(imgElement, url, info) {
        const oldSrc = this.getImageSource(imgElement);
        const sectionNumber = this.getSectionNumberFromElement(imgElement);
        const imageUid = this.ensureImageUid(imgElement);
        const previousState = this.captureImageState(imgElement);
        const tagName = imgElement.tagName.toLowerCase();
        
        // Show loader on the image
        this.showImageLoader(imgElement);
        
        // Store Cloudinary info as data attributes
        imgElement.setAttribute('data-cloudinary-public-id', info.public_id);
        imgElement.setAttribute('data-cloudinary-format', info.format);
        imgElement.setAttribute('data-cloudinary-width', info.width);
        imgElement.setAttribute('data-cloudinary-height', info.height);
        
        // Get optimized URL based on actual display size and aspect ratio
        const optimizedUrl = this.getOptimizedUrl(info, imgElement);
        
        // Generate responsive srcset for different screen sizes (matching aspect ratio)
        const responsiveSrcset = this.getResponsiveSrcset(info, imgElement);
        
        // Create a new image to preload
        const newImage = new Image();
        
        // Set up onload handler to hide loader when image is fully loaded
        newImage.onload = () => {
            // Update the actual image source with optimized URL
            this.setImageSource(imgElement, optimizedUrl);
            
            // Add responsive srcset for automatic size selection (only for <img> elements)
            if (tagName === 'img') {
                imgElement.srcset = responsiveSrcset;
                
                // Add sizes attribute to help browser choose the right image
                // This tells the browser the image will be displayed at 100% viewport width
                // You can customize this based on your layout
                imgElement.sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw';
                
                // Update alt text if available
                if (info.original_filename) {
                    imgElement.alt = info.original_filename;
                }
            }
            
            // Hide loader after image is loaded
            this.hideImageLoader(imgElement);
            
            // Show success notification with size info
            const rect = imgElement.getBoundingClientRect();
            const displaySize = Math.round(rect.width);
            this.showNotification(`Image updated! (optimized for ${displaySize}px display)`, 'success');
            
            if (!this.isApplyingImageState && sectionNumber && imageUid) {
                const nextState = this.captureImageState(imgElement);
                const label = info.original_filename
                    ? `Image updated: ${info.original_filename}`
                    : 'Image updated';
                this.emitImageCommand({
                    sectionNumber,
                    imageUid,
                    beforeState: previousState,
                    afterState: nextState,
                    label
                });
            }
        };
        
        // Set up onerror handler in case image fails to load
        newImage.onerror = () => {
            // Hide loader on error
            this.hideImageLoader(imgElement);
            
            // Show error notification
            this.showNotification('Failed to load new image', 'error');
            
            // Revert to old source
            this.setImageSource(imgElement, oldSrc);
        };
        
        // Start loading the new image (use optimized URL)
        newImage.src = optimizedUrl;
        
    }
    
    /**
     * Update background-image style on an element
     * Preserves existing gradients/overlays
     */
    updateBackgroundImage(element, url, info) {
        // Capture state before update for history tracking (for both .fp-bg and section-level backgrounds)
        let beforeState = null;
        let sectionNumber = null;
        const isFpBg = element.classList && element.classList.contains('fp-bg');
        const isSection = element.tagName === 'SECTION' && 
                         element.hasAttribute('data-bg') && 
                         element.getAttribute('data-bg') === 'true';
        
        if ((isFpBg || isSection) && window.sectionBackgroundPicker) {
            const section = isSection ? element : element.closest('section');
            if (section) {
                sectionNumber = section.getAttribute('data-section');
                if (sectionNumber) {
                    // Capture state before update
                    beforeState = window.sectionBackgroundPicker.captureBackgroundState(section);
                }
            }
        }
        
        // Check if we need to remove video after image is applied (replace-video-with-image action)
        if (isFpBg && element.hasAttribute('data-replace-video-with-image')) {
            const video = element.querySelector('video');
            if (video) {
                video.remove();
            }
            element.removeAttribute('data-replace-video-with-image');
            // Update section state after removing video
            if (window.sectionBackgroundPicker && sectionNumber) {
                const section = element.closest('section');
                if (section) {
                    window.sectionBackgroundPicker.updateSectionImageState(section);
                    window.sectionBackgroundPicker.updateButtonCircle(sectionNumber);
                }
            }
        }
        
        // Parse existing background to preserve gradients
        // Check inline style first, then computed style (for CSS-based backgrounds)
        let existingBg = element.style.background || element.style.backgroundImage || '';
        if (!existingBg || !existingBg.includes('url(')) {
            // If no inline style, check computed style
            const computedStyle = getComputedStyle(element);
            existingBg = computedStyle.background || computedStyle.backgroundImage || '';
        }
        
        // Preserve existing background-size and background-position
        // Check inline style first, then computed style
        let existingBgSize = element.style.backgroundSize || '';
        let existingBgPosition = element.style.backgroundPosition || '';
        
        if (!existingBgSize || !existingBgPosition) {
            const computedStyle = getComputedStyle(element);
            if (!existingBgSize) {
                existingBgSize = computedStyle.backgroundSize || 'cover';
            }
            if (!existingBgPosition) {
                existingBgPosition = computedStyle.backgroundPosition || 'center';
            }
        }
        
        // Ensure we have defaults
        existingBgSize = existingBgSize || 'cover';
        existingBgPosition = existingBgPosition || 'center';
        
        console.log('📸 Preserving background-size:', existingBgSize);
        console.log('📸 Preserving background-position:', existingBgPosition);
        
        // Extract gradient by finding everything before the url()
        // This is more reliable than regex for handling nested parentheses
        let preservedGradient = null;
        
        // Look for ", url(" or " url(" which separates gradient from image URL
        const urlSeparators = [', url(', ' url(', ',url('];
        for (const separator of urlSeparators) {
            const urlIndex = existingBg.indexOf(separator);
            if (urlIndex > 0) {
                // Found a URL, extract everything before it
                const beforeUrl = existingBg.substring(0, urlIndex).trim();
                // Check if it's a gradient
                if (beforeUrl.includes('gradient')) {
                    // Remove any trailing background-size/position properties
                    // e.g., "linear-gradient(...) center center / cover" -> "linear-gradient(...)"
                    const gradientPart = beforeUrl.split(/\s+(center|top|bottom|left|right|\d+%|\d+px|\/)/)[0].trim();
                    preservedGradient = gradientPart;
                    break;
                }
            }
        }
        
        // Show loader
        this.showBackgroundLoader(element);
        
        // Store Cloudinary info as data attributes
        element.setAttribute('data-cloudinary-public-id', info.public_id);
        element.setAttribute('data-cloudinary-format', info.format);
        element.setAttribute('data-cloudinary-width', info.width);
        element.setAttribute('data-cloudinary-height', info.height);
        
        // Get optimized URL based on element size
        const optimizedUrl = this.getOptimizedUrl(info, element);
        
        // Preload the image to ensure it's ready
        const preloadImage = new Image();
        
        preloadImage.onload = () => {
            // Build new background style
            let newBackground;
            
            if (preservedGradient) {
                // Combine gradient with new image URL
                newBackground = `${preservedGradient}, url('${optimizedUrl}')`;
            } else {
                // Just the image
                newBackground = `url('${optimizedUrl}')`;
            }
            
            // Update the background
            element.style.background = newBackground;
            element.style.backgroundSize = existingBgSize;
            element.style.backgroundPosition = existingBgPosition;
            
            console.log('📸 Applied background-size:', existingBgSize);
            console.log('📸 Applied background-position:', existingBgPosition);
            
            // Hide loader
            this.hideBackgroundLoader(element);
            
            // Show success notification
            const rect = element.getBoundingClientRect();
            const displaySize = Math.round(rect.width);
            this.showNotification(`Background updated! (optimized for ${displaySize}px display)`, 'success');
            
            // Notify parent window about the change (for history tracking)
            if (window.parent && window.parent.postMessage) {
                // Send SECTION_EDITED to trigger history save
                window.parent.postMessage({
                    type: 'SECTION_EDITED',
                    data: {}
                }, '*');
            }
            
            // If this is a .fp-bg element or section-level background, update state and record history
            if (isFpBg || isSection) {
                const section = isSection ? element : element.closest('section');
                if (section && window.sectionBackgroundPicker) {
                    window.sectionBackgroundPicker.updateSectionImageState(section);
                    
                    // Emit background change command for history tracking
                    if (sectionNumber && beforeState) {
                        const afterState = window.sectionBackgroundPicker.captureBackgroundState(section);
                        const label = isFpBg 
                            ? 'Background image updated on .fp-bg'
                            : 'Background image updated';
                        window.sectionBackgroundPicker.emitBackgroundCommand(
                            sectionNumber,
                            beforeState,
                            afterState,
                            label
                        );
                    }
                }
            }
        };
        
        preloadImage.onerror = () => {
            // Hide loader on error
            this.hideBackgroundLoader(element);
            
            // Show error notification
            this.showNotification('Failed to load new background image', 'error');
            
            // Revert to old background
            element.style.background = existingBg;
        };
        
        // Start preloading
        preloadImage.src = optimizedUrl;
    }
    
    /**
     * Show loader overlay on background element while it's loading
     */
    showBackgroundLoader(element) {
        element.setAttribute('data-cloudinary-loading', 'true');
        
        // Create loader overlay
        const loader = document.createElement('div');
        loader.className = 'cloudinary-background-loader';
        
        loader.innerHTML = `
            <div class="cloudinary-spinner"></div>
            <div class="cloudinary-loader-text">Loading background...</div>
        `;
        
        // Position overlay on top of element using fixed positioning
        const rect = element.getBoundingClientRect();
        loader.style.position = 'fixed';
        loader.style.top = `${rect.top}px`;
        loader.style.left = `${rect.left}px`;
        loader.style.width = `${rect.width}px`;
        loader.style.height = `${rect.height}px`;
        loader.style.background = 'rgba(0, 0, 0, 0.7)';
        loader.style.display = 'flex';
        loader.style.flexDirection = 'column';
        loader.style.alignItems = 'center';
        loader.style.justifyContent = 'center';
        loader.style.zIndex = '9998';
        loader.style.borderRadius = getComputedStyle(element).borderRadius || '0';
        loader.style.animation = 'fadeIn 0.2s ease-in';
        loader.style.pointerEvents = 'none';
        
        // Add to overlay container
        if (this.overlayContainer) {
            this.overlayContainer.appendChild(loader);
        } else {
            document.body.appendChild(loader);
        }
        
        // Store loader reference
        element._cloudinaryBackgroundLoader = loader;
        
        // Update position on scroll/resize with optimized scroll handler (passive + rAF)
        // Only update if element is in viewport to avoid unnecessary work
        const updatePosition = () => {
            const rect = element.getBoundingClientRect();
            loader.style.top = `${rect.top}px`;
            loader.style.left = `${rect.left}px`;
            loader.style.width = `${rect.width}px`;
            loader.style.height = `${rect.height}px`;
        };
        
        let scrollPending = false;
        const handleScroll = () => {
            if (scrollPending) return;
            scrollPending = true;
            requestAnimationFrame(() => {
                scrollPending = false;
                // Only update position if element is in viewport
                if (this.isElementInViewport(element)) {
                    updatePosition(); // minimal work
                }
            });
        };
        
        window.addEventListener('scroll', handleScroll, { passive: true, capture: true });
        window.addEventListener('resize', updatePosition);
        loader._cleanup = () => {
            window.removeEventListener('scroll', handleScroll, { passive: true, capture: true });
            window.removeEventListener('resize', updatePosition);
        };
    }
    
    /**
     * Hide loader overlay from background element
     */
    hideBackgroundLoader(element) {
        element.removeAttribute('data-cloudinary-loading');
        
        // Find and remove loader
        const loader = element._cloudinaryBackgroundLoader;
        if (loader) {
            // Cleanup event listeners
            if (loader._cleanup) {
                loader._cleanup();
            }
            
            // Fade out animation
            loader.style.animation = 'fadeOut 0.3s ease-out';
            setTimeout(() => {
                if (loader.parentNode) {
                    loader.remove();
                }
                delete element._cloudinaryBackgroundLoader;
            }, 300);
        }
    }
    
    /**
     * Show loader overlay on image while it's loading
     * Uses fixed positioning overlay - does NOT modify DOM structure
     */
    showImageLoader(imgElement) {
        // Store reference to image for cleanup
        imgElement.setAttribute('data-cloudinary-loading', 'true');
        
        // Create loader overlay in the overlay container (portal pattern)
        const loader = document.createElement('div');
        loader.className = 'cloudinary-image-loader';
        loader.setAttribute('data-loader-for', imgElement.getAttribute('src') || 'image');
        
        loader.innerHTML = `
            <div class="cloudinary-spinner"></div>
            <div class="cloudinary-loader-text">Loading image...</div>
        `;
        
        // Position overlay on top of image using fixed positioning
        const rect = imgElement.getBoundingClientRect();
        loader.style.position = 'fixed';
        loader.style.top = `${rect.top}px`;
        loader.style.left = `${rect.left}px`;
        loader.style.width = `${rect.width}px`;
        loader.style.height = `${rect.height}px`;
        loader.style.background = 'rgba(255, 255, 255, 0.95)';
        loader.style.display = 'flex';
        loader.style.flexDirection = 'column';
        loader.style.alignItems = 'center';
        loader.style.justifyContent = 'center';
        loader.style.zIndex = '9998';
        loader.style.borderRadius = getComputedStyle(imgElement).borderRadius || '4px';
        loader.style.animation = 'fadeIn 0.2s ease-in';
        loader.style.pointerEvents = 'none';
        
        // Add to overlay container (not to the image's DOM)
        if (this.overlayContainer) {
            this.overlayContainer.appendChild(loader);
        } else {
            document.body.appendChild(loader);
        }
        
        // Store loader reference on the image for cleanup
        imgElement._cloudinaryLoader = loader;
        
        // Update position on scroll/resize with optimized scroll handler (passive + rAF)
        // Only update if element is in viewport to avoid unnecessary work
        const updatePosition = () => {
            const rect = imgElement.getBoundingClientRect();
            loader.style.top = `${rect.top}px`;
            loader.style.left = `${rect.left}px`;
            loader.style.width = `${rect.width}px`;
            loader.style.height = `${rect.height}px`;
        };
        
        let scrollPending = false;
        const handleScroll = () => {
            if (scrollPending) return;
            scrollPending = true;
            requestAnimationFrame(() => {
                scrollPending = false;
                // Only update position if image is in viewport
                if (this.isElementInViewport(imgElement)) {
                    updatePosition(); // minimal work
                }
            });
        };
        
        window.addEventListener('scroll', handleScroll, { passive: true, capture: true });
        window.addEventListener('resize', updatePosition);
        loader._cleanup = () => {
            window.removeEventListener('scroll', handleScroll, { passive: true, capture: true });
            window.removeEventListener('resize', updatePosition);
        };
        
        // Dim the image slightly
        imgElement.style.opacity = '0.3';
    }
    
    /**
     * Hide loader overlay from image
     */
    hideImageLoader(imgElement) {
        // Restore image opacity
        imgElement.style.opacity = '1';
        imgElement.removeAttribute('data-cloudinary-loading');
        
        // Find and remove loader
        const loader = imgElement._cloudinaryLoader;
        if (loader) {
            // Cleanup event listeners
            if (loader._cleanup) {
                loader._cleanup();
            }
            
            // Fade out animation
            loader.style.animation = 'fadeOut 0.3s ease-out';
            setTimeout(() => {
                if (loader.parentNode) {
                    loader.remove();
                }
                delete imgElement._cloudinaryLoader;
            }, 300);
        }
    }
    
    /**
     * Show notification to user
     */
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `cloudinary-notification cloudinary-notification-${type}`;
        notification.textContent = message;
        
        // Style notification
        notification.style.position = 'fixed';
        notification.style.top = '20px';
        notification.style.right = '20px';
        notification.style.padding = '12px 20px';
        notification.style.borderRadius = '8px';
        notification.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
        notification.style.zIndex = '10000';
        notification.style.fontSize = '14px';
        notification.style.fontWeight = '500';
        notification.style.animation = 'slideInRight 0.3s ease-out';
        
        // Set colors based on type
        if (type === 'success') {
            notification.style.background = '#10b981';
            notification.style.color = 'white';
        } else if (type === 'error') {
            notification.style.background = '#ef4444';
            notification.style.color = 'white';
        } else {
            notification.style.background = '#3b82f6';
            notification.style.color = 'white';
        }
        
        // Add to body
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
    
    /**
     * Reinitialize editor for all sections (useful after DOM changes)
     */
    reinitialize() {
        const sections = document.querySelectorAll('.section');
        console.log(`Reinitializing Cloudinary for ${sections.length} sections`);
        sections.forEach(section => {
            this.initForSection(section);
        });
    }
    
    /**
     * Initialize all existing sections when the page loads
     * Call this after sections are loaded from localStorage
     */
    async initializeExistingSections() {
        console.log('📸 Cloudinary: initializeExistingSections() called');
        
        // Wait for Cloudinary to be loaded
        if (this.initPromise) {
            console.log('📸 Cloudinary: Waiting for script to load...');
            await this.initPromise;
        }
        
        console.log('📸 Cloudinary: Script loaded, initializing sections...');
        
        // Now initialize all sections that are already in the DOM
        const sections = document.querySelectorAll('.section');
        console.log(`📸 Cloudinary: Found ${sections.length} sections to initialize`);
        
        sections.forEach((section, index) => {
            console.log(`📸 Cloudinary: Processing section ${index + 1}/${sections.length}`);
            this.initForSectionNow(section);
        });
        
        console.log('📸 Cloudinary: All sections processed');
    }
    
    /**
     * Clean up and remove all event listeners
     */
    destroy() {
        if (this.widget) {
            this.destroyWidget(this.widget);
            this.widget = null;
        }
        
        if (this.preloadedWidget) {
            this.destroyWidget(this.preloadedWidget);
            this.preloadedWidget = null;
        }
        
        this.currentWidgetAspectRatio = null;
        
        // Clean up all active indicators using their cleanup functions
        this.activeIndicators.forEach((data) => {
            data.cleanup();
        });
        this.activeIndicators.clear();
        
        // Hide and remove loading modal
        this.hideLoadingModal();
        
        // Remove overlay container
        if (this.overlayContainer) {
            this.overlayContainer.remove();
            this.overlayContainer = null;
        }
        
        // Remove initialization markers from sections
        const sections = document.querySelectorAll('.section[data-cloudinary-initialized]');
        sections.forEach(section => {
            section.removeAttribute('data-cloudinary-initialized');
        });
        
        // Reset cursor on all images
        const images = document.querySelectorAll('img');
        images.forEach(img => {
            if (img instanceof HTMLImageElement) {
                img.style.cursor = '';
            }
        });
    }
}

// Add animation keyframes and styles
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    @keyframes fadeIn {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }
    
    @keyframes fadeOut {
        from {
            opacity: 1;
        }
        to {
            opacity: 0;
        }
    }
    
    @keyframes spin {
        0% {
            transform: rotate(0deg);
        }
        100% {
            transform: rotate(360deg);
        }
    }
    
    @keyframes scaleIn {
        from {
            transform: scale(0.9);
            opacity: 0;
        }
        to {
            transform: scale(1);
            opacity: 1;
        }
    }
    
    .cloudinary-edit-indicator {
        transition: opacity 0.2s ease;
    }
    
    .cloudinary-image-loader {
        backdrop-filter: blur(2px);
        transition: opacity 0.2s ease;
    }
    
    .cloudinary-background-loader {
        backdrop-filter: blur(2px);
        transition: opacity 0.2s ease;
    }
    
    .cloudinary-background-loader .cloudinary-spinner {
        border-color: rgba(255, 255, 255, 0.2);
        border-top-color: #ffffff;
    }
    
    .cloudinary-background-loader .cloudinary-loader-text {
        color: #ffffff;
    }
    
    .cloudinary-spinner {
        width: 50px;
        height: 50px;
        border: 4px solid rgba(255, 255, 255, 0.2);
        border-top-color: #ffffff;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        margin: 0 auto;
    }
    
    .cloudinary-loading-spinner .cloudinary-spinner {
        width: 50px;
        height: 50px;
        border: 4px solid rgba(255, 255, 255, 0.2);
        border-top-color: #ffffff;
    }
    
    #cloudinary-loading-overlay {
        animation: fadeIn 0.2s ease;
    }
    
    .cloudinary-loader-text {
        color: #374151;
        font-size: 14px;
        font-weight: 500;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    
    .cloudinary-bg-indicator {
        /* Distinct styling for background element indicators */
        background: rgba(59, 130, 246, 0.9) !important;
    }
`;
document.head.appendChild(style);

// Initialize global instance (with singleton protection)
if (!window.cloudinaryImageEditor) {
    window.cloudinaryImageEditor = new CloudinaryImageEditor({
        cloudName: 'devdwphku', // Your Cloudinary cloud name
        uploadPreset: 'fp_studio' // Your upload preset name
    });
} else {
    console.log('CloudinaryImageEditor already initialized, skipping');
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CloudinaryImageEditor;
}
