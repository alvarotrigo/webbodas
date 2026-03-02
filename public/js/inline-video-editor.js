/**
 * Inline Video Editor
 * Handles inline video editing with URL modal
 * - Change video sources
 * - Supports standalone videos and videos with overlay divs
 */

class InlineVideoEditor {
    constructor() {
        this.overlayContainer = null; // Overlay container for indicators
        this.activeIndicators = new Map(); // Map of video -> {indicator, cleanup}
        
        // Create overlay container for indicators (Portal pattern)
        this.createOverlayContainer();
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
     * Create overlay container for video edit indicators
     */
    createOverlayContainer() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.createOverlayContainerNow();
            });
        } else {
            this.createOverlayContainerNow();
        }
    }
    
    createOverlayContainerNow() {
        // Check if already exists
        const existing = document.getElementById('video-indicators-overlay');
        if (existing) {
            this.overlayContainer = existing;
            return;
        }

        // Create overlay container
        this.overlayContainer = document.createElement('div');
        this.overlayContainer.id = 'video-indicators-overlay';
        this.overlayContainer.className = 'fixed inset-0 pointer-events-none z-[9999]';

        document.body.appendChild(this.overlayContainer);
        console.log('🎥 Video Editor: Overlay container created');
    }
    
    /**
     * Initialize video editor for a section
     */
    initForSection(sectionElement) {
        if (!sectionElement) return;
        
        // Skip if already initialized
        if (sectionElement.hasAttribute('data-video-editor-initialized')) {
            console.log('🎥 Video Editor: Section already initialized, skipping');
            return;
        }
        
        // Mark section as initialized
        sectionElement.setAttribute('data-video-editor-initialized', 'true');
        
        // Find all video elements in the section
        const videos = sectionElement.querySelectorAll('video');
        
        if (videos.length === 0) {
            return;
        }
        
        console.log(`🎥 Video Editor: Found ${videos.length} videos in section`);
        
        // Add visual indicators for videos (excluding those inside .fp-bg)
        videos.forEach(video => {
            // Skip videos inside .fp-bg (handled by section-background-picker)
            if (video.closest('.fp-bg')) {
                console.log('🎥 Video Editor: Skipping video inside .fp-bg');
                return;
            }
            
            // Add visual indicator on hover
            this.addEditIndicator(video);
        });
    }
    
    /**
     * Add a subtle edit indicator that appears on hover
     * Uses Portal pattern - indicator is rendered in overlay, not in DOM flow
     */
    addEditIndicator(video) {
        // Skip if already tracking this video
        if (this.activeIndicators.has(video)) {
            return;
        }
        
        // Ensure overlay container exists
        if (!this.overlayContainer) {
            console.warn('🎥 Video Editor: Overlay container not ready, skipping indicator');
            return;
        }
        
        console.log('🎥 Video Editor: Adding indicator for video', video);
        
        // Create edit indicator in the overlay container
        const indicator = document.createElement('div');
        indicator.className = 'video-edit-indicator fixed top-0 left-0 w-8 h-8 rounded-full flex items-center justify-center opacity-0 transition-opacity duration-200 pointer-events-auto z-[10000] cursor-pointer';
        indicator.style.background = 'rgba(0, 0, 0, 0.7)';
        indicator.style.willChange = 'transform'; // Hint for GPU optimization
        indicator.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
        `;
        
        this.overlayContainer.appendChild(indicator);
        console.log('🎥 Video Editor: Indicator added to overlay');
        
        // Get the target element (video or overlay div)
        const targetElement = this.getTargetElement(video);
        
        // Function to update indicator position based on video position
        const updatePosition = () => {
            const rect = targetElement.getBoundingClientRect();
            // Use translate3d for better performance (GPU accelerated)
            const x = rect.right - 40;
            const y = rect.top + 8;
            indicator.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        };
        
        // Initial position update
        updatePosition();
        
        // Click handler to open video URL modal
        const clickHandler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.openVideoUrlModal(video);
        };
        
        indicator.addEventListener('click', clickHandler);
        
        // Event listeners for hover
        const handleMouseEnter = () => {
            if (!document.body.classList.contains('fullscreen-mode')) {
                updatePosition(); // Update position on hover in case video moved
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
                // Only update position if video is in viewport
                if (this.isElementInViewport(targetElement)) {
                    updatePosition(); // minimal work
                }
            });
        };
        
        targetElement.addEventListener('mouseenter', handleMouseEnter);
        targetElement.addEventListener('mouseleave', handleMouseLeave);
        window.addEventListener('scroll', handleScroll, { passive: true, capture: true }); // Use capture for all scrolls
        window.addEventListener('resize', updatePosition);
        
        // Cleanup function
        const cleanup = () => {
            indicator.removeEventListener('click', clickHandler);
            indicator.removeEventListener('mouseenter', handleIndicatorMouseEnter);
            indicator.removeEventListener('mouseleave', handleIndicatorMouseLeave);
            targetElement.removeEventListener('mouseenter', handleMouseEnter);
            targetElement.removeEventListener('mouseleave', handleMouseLeave);
            window.removeEventListener('scroll', handleScroll, { passive: true, capture: true });
            window.removeEventListener('resize', updatePosition);
            indicator.remove();
        };
        
        // Store indicator and cleanup function
        this.activeIndicators.set(video, {
            indicator,
            cleanup
        });
    }
    
    /**
     * Get the target element for positioning
     * This could be the video itself, or the next sibling if it has data-video="prev"
     */
    getTargetElement(video) {
        // Check if next sibling has data-video="prev"
        const nextSibling = video.nextElementSibling;
        if (nextSibling && nextSibling.getAttribute('data-video') === 'prev') {
            return nextSibling;
        }
        return video;
    }
    
    /**
     * Open video URL modal to change video sources
     */
    openVideoUrlModal(video) {
        console.log('🎥 Video Editor: Opening video URL modal for', video);
        
        // Get existing sources
        const existingSources = Array.from(video.querySelectorAll('source'));
        
        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.className = 'fp-ui-theme video-url-modal-overlay modal-overlay fixed inset-0 flex items-center justify-center z-[10000]';
        overlay.style.background = 'rgba(0, 0, 0, 0.5)';

        // Create modal
        const modal = document.createElement('div');
        modal.className = 'video-url-modal rounded-xl p-6 max-w-[600px] w-[90%] max-h-[80vh] overflow-y-auto shadow-2xl';
        modal.style.background = 'var(--primary-bg)';
        modal.style.color = 'var(--primary-text)';
        
        // Video sources array (only URLs, type will be inferred)
        const sources = existingSources.length > 0 
            ? existingSources.map(s => ({ url: s.getAttribute('src') || '' }))
            : [{ url: '' }];
        
        // Build modal HTML
        let sourcesHTML = '';
        sources.forEach((source, index) => {
            sourcesHTML += `
                <div class="video-source-row mb-4 flex gap-2 items-start">
                    <div class="flex-1">
                        <label class="block mb-1 text-sm font-medium" style="color: var(--primary-text);">Video URL ${index + 1}</label>
                        <input type="text" class="video-url-input w-full px-3 py-2 rounded-md text-sm border"
                            data-index="${index}"
                            placeholder="https://example.com/video.mp4"
                            value="${source.url}"
                            style="background: var(--primary-bg); color: var(--primary-text); border-color: var(--border-color);">
                    </div>
                    ${index > 0 ? `<button type="button" class="remove-source-btn mt-6 px-3 py-2 rounded-md cursor-pointer text-sm font-medium border-none text-white" data-index="${index}" style="background: #ef4444;">Remove</button>` : ''}
                </div>
            `;
        });
        
        modal.innerHTML = `
            <h2 class="m-0 mb-5 text-xl font-semibold" style="color: var(--primary-text);">Change Video</h2>
            <div class="video-sources-container">
                ${sourcesHTML}
            </div>
            <button type="button" class="add-source-btn mb-5 px-4 py-2 rounded-md cursor-pointer text-sm font-medium border-none text-white" title="Add multiple video sources for better browser compatibility (e.g., MP4, WebM, MOV)" style="background: var(--primary-accent);">+ Add Source</button>
            <div class="flex gap-3 justify-end">
                <button type="button" class="cancel-video-btn px-5 py-2.5 rounded-md cursor-pointer text-sm font-medium border-none" style="background: var(--secondary-bg); color: var(--primary-text);">Cancel</button>
                <button type="button" class="save-video-btn px-5 py-2.5 rounded-md cursor-pointer text-sm font-medium border-none text-white" style="background: var(--primary-accent);">Save</button>
            </div>
        `;
        
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        
        // Add source button handler
        const addSourceBtn = modal.querySelector('.add-source-btn');
        if (addSourceBtn) {
            addSourceBtn.addEventListener('click', () => {
                const container = modal.querySelector('.video-sources-container');
                if (!container) return;
                const index = container.querySelectorAll('.video-source-row').length;
                const newRow = document.createElement('div');
                newRow.className = 'video-source-row mb-4 flex gap-2 items-start';
                newRow.innerHTML = `
                    <div class="flex-1">
                        <label class="block mb-1 text-sm font-medium" style="color: var(--primary-text);">Video URL ${index + 1}</label>
                        <input type="text" class="video-url-input w-full px-3 py-2 rounded-md text-sm border"
                            data-index="${index}"
                            placeholder="https://example.com/video.mp4"
                            style="background: var(--primary-bg); color: var(--primary-text); border-color: var(--border-color);">
                    </div>
                    <button type="button" class="remove-source-btn mt-6 px-3 py-2 rounded-md cursor-pointer text-sm font-medium border-none text-white" data-index="${index}" style="background: #ef4444;">Remove</button>
                `;
                container.appendChild(newRow);

                // Add remove handler
                const removeBtn = newRow.querySelector('.remove-source-btn');
                if (removeBtn) {
                    removeBtn.addEventListener('click', () => {
                        newRow.remove();
                    });
                }
            });
        }
        
        // Remove source button handlers
        modal.querySelectorAll('.remove-source-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = btn.getAttribute('data-index');
                modal.querySelectorAll('.video-source-row').forEach(row => {
                    if (row.querySelector(`[data-index="${index}"]`)) {
                        row.remove();
                    }
                });
            });
        });
        
        // Track where mousedown started to prevent accidental closes during text selection
        let mouseDownTarget = null;
        
        // Function to close modal
        const closeModal = () => {
            if (overlay.parentNode) {
                document.body.removeChild(overlay);
            }
            // Remove ESC key listener when modal closes
            document.removeEventListener('keydown', handleEscKey);
            // Remove mousedown listener
            overlay.removeEventListener('mousedown', handleMouseDown);
        };
        
        // Cancel button handler
        const cancelBtn = modal.querySelector('.cancel-video-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', closeModal);
        }
        
        // Track where mousedown happens
        const handleMouseDown = (e) => {
            mouseDownTarget = e.target;
        };
        overlay.addEventListener('mousedown', handleMouseDown);
        
        // Close on overlay click only if both mousedown and click happened on overlay
        overlay.addEventListener('click', (e) => {
            // Only close if both the mousedown and click happened on the overlay
            // This prevents closing when user starts text selection inside modal and releases outside
            if (e.target === overlay && mouseDownTarget === overlay) {
                closeModal();
            }
            // Reset for next interaction
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
        
        // Save button handler
        const saveBtn = modal.querySelector('.save-video-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                const urlInputs = modal.querySelectorAll('.video-url-input');
                
                const validSources = [];
                urlInputs.forEach((urlInput) => {
                    const input = urlInput instanceof HTMLInputElement ? urlInput : null;
                    if (!input) return;
                    const url = input.value.trim();
                    
                    if (url) {
                        // Validate URL has video file extension
                        const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.ogv', '.m4v'];
                        const urlLower = url.toLowerCase();
                        const hasValidExtension = videoExtensions.some(ext => urlLower.includes(ext));
                        
                        if (hasValidExtension || url.startsWith('http')) {
                            // Infer video type from URL extension
                            const type = this.inferVideoTypeFromUrl(url);
                            validSources.push({ url, type });
                        } else {
                            alert(`Invalid video URL: ${url}\nPlease provide a URL with a video file extension (.mp4, .webm, .mov, etc.)`);
                            return;
                        }
                    }
                });
                
                if (validSources.length === 0) {
                    alert('Please provide at least one valid video URL');
                    return;
                }
                
                // Apply video sources
                this.applyVideoSources(video, validSources);
                
                // Close modal
                closeModal();
            });
        }
    }
    
    /**
     * Infer video MIME type from URL file extension
     */
    inferVideoTypeFromUrl(url) {
        if (!url) return 'video/mp4'; // Default fallback
        
        const urlLower = url.toLowerCase();
        const extensionMap = {
            '.mp4': 'video/mp4',
            '.webm': 'video/webm',
            '.mov': 'video/quicktime',
            '.avi': 'video/x-msvideo',
            '.mkv': 'video/x-matroska',
            '.ogv': 'video/ogg',
            '.m4v': 'video/x-m4v',
            '.flv': 'video/x-flv',
            '.wmv': 'video/x-ms-wmv'
        };
        
        // Extract extension from URL (handle query strings and fragments)
        const urlPath = urlLower.split('?')[0].split('#')[0];
        for (const [ext, mimeType] of Object.entries(extensionMap)) {
            if (urlPath.endsWith(ext)) {
                return mimeType;
            }
        }
        
        // Default fallback
        return 'video/mp4';
    }
    
    /**
     * Apply video sources to the video element
     */
    applyVideoSources(video, sources) {
        console.log('🎥 Video Editor: Applying video sources', sources);
        
        // Get the section for history tracking
        const section = video.closest('.section');
        const sectionNumber = section ? section.getAttribute('data-section') : null;
        
        // Capture state for undo/redo
        const previousState = this.captureVideoState(video);
        
        // Remove existing sources
        const existingSources = video.querySelectorAll('source');
        existingSources.forEach(source => source.remove());
        
        // Add new sources
        sources.forEach(source => {
            const sourceElement = document.createElement('source');
            sourceElement.setAttribute('src', source.url);
            if (source.type) {
                sourceElement.setAttribute('type', source.type);
            }
            video.appendChild(sourceElement);
        });
        
        // Reload video to apply new sources
        video.load();
        
        // Capture new state
        const nextState = this.captureVideoState(video);
        
        // Emit command for undo/redo
        if (sectionNumber) {
            this.emitVideoChangeCommand(sectionNumber, video, previousState, nextState);
        }
        
        console.log('🎥 Video Editor: Video sources updated');
    }
    
    /**
     * Capture video state for undo/redo
     */
    captureVideoState(video) {
        const sources = Array.from(video.querySelectorAll('source')).map(source => ({
            src: source.getAttribute('src'),
            type: source.getAttribute('type')
        }));
        
        return {
            sources,
            className: video.className,
            attributes: {
                loop: video.hasAttribute('loop'),
                muted: video.hasAttribute('muted'),
                playsinline: video.hasAttribute('playsinline'),
                autoplay: video.hasAttribute('autoplay')
            }
        };
    }
    
    /**
     * Emit video change command for undo/redo
     */
    emitVideoChangeCommand(sectionNumber, video, beforeState, afterState) {
        if (!window.parent || window.parent === window || !window.parent.postMessage) {
            return;
        }
        
        // Generate a unique ID for this video
        const videoUid = this.getVideoUid(video);
        
        window.parent.postMessage({
            type: 'COMMAND_INLINE_VIDEO_CHANGE',
            data: {
                sectionNumber,
                videoUid,
                beforeState,
                afterState,
                label: 'Video updated'
            }
        }, '*');
    }
    
    /**
     * Get or create a unique ID for a video element
     */
    getVideoUid(video) {
        // Check if video already has a UID
        let uid = video.getAttribute('data-video-uid');
        if (!uid) {
            // Generate new UID
            uid = 'video-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
            video.setAttribute('data-video-uid', uid);
        }
        return uid;
    }
    
    /**
     * Apply video state (for undo/redo operations)
     * @param {number} sectionNumber - The section number
     * @param {string} videoUid - The video unique ID
     * @param {Object} state - The state to apply (sources, attributes, className)
     * @param {boolean} shouldScroll - Whether to scroll to the section
     */
    applyState(sectionNumber, videoUid, state, shouldScroll = false) {
        console.log('🎥 Applying inline video state:', { sectionNumber, videoUid, state });
        
        // Find the section
        const section = document.querySelector(`.section[data-section="${sectionNumber}"]`);
        if (!section) {
            console.warn(`Section ${sectionNumber} not found for video state application`);
            return;
        }
        
        // Find the video element by UID
        const video = section.querySelector(`video[data-video-uid="${videoUid}"]`);
        if (!video) {
            console.warn(`Video with UID ${videoUid} not found in section ${sectionNumber}`);
            return;
        }
        
        // Remove existing sources
        const existingSources = video.querySelectorAll('source');
        existingSources.forEach(source => source.remove());
        
        // Add new sources from state
        if (state.sources && Array.isArray(state.sources)) {
            state.sources.forEach(sourceData => {
                const sourceElement = document.createElement('source');
                sourceElement.setAttribute('src', sourceData.src);
                if (sourceData.type) {
                    sourceElement.setAttribute('type', sourceData.type);
                }
                video.appendChild(sourceElement);
            });
        }
        
        // Update className if provided
        if (state.className) {
            video.className = state.className;
        }
        
        // Update attributes if provided
        if (state.attributes) {
            const attrs = state.attributes;
            
            // Set or remove loop attribute
            if (attrs.loop) {
                video.setAttribute('loop', '');
            } else {
                video.removeAttribute('loop');
            }
            
            // Set or remove muted attribute
            if (attrs.muted) {
                video.setAttribute('muted', '');
            } else {
                video.removeAttribute('muted');
            }
            
            // Set or remove playsinline attribute
            if (attrs.playsinline) {
                video.setAttribute('playsinline', '');
            } else {
                video.removeAttribute('playsinline');
            }
            
            // Set or remove autoplay attribute
            if (attrs.autoplay) {
                video.setAttribute('autoplay', '');
            } else {
                video.removeAttribute('autoplay');
            }
        }
        
        // Reload video to apply new sources
        video.load();
        
        // Scroll to the section if requested (for undo/redo visibility)
        if (shouldScroll && section) {
            section.scrollIntoView({ behavior: 'auto', block: 'center' });
        }
        
        console.log('🎥 Video state applied successfully');
    }
    
    /**
     * Reinitialize editor for all sections (useful after DOM changes)
     */
    reinitialize() {
        const sections = document.querySelectorAll('.section');
        console.log(`🎥 Video Editor: Reinitializing for ${sections.length} sections`);
        sections.forEach(section => {
            this.initForSection(section);
        });
    }
    
    /**
     * Initialize all existing sections when the page loads
     */
    initializeExistingSections() {
        console.log('🎥 Video Editor: initializeExistingSections() called');
        
        const sections = document.querySelectorAll('.section');
        console.log(`🎥 Video Editor: Found ${sections.length} sections to initialize`);
        
        sections.forEach((section, index) => {
            console.log(`🎥 Video Editor: Processing section ${index + 1}/${sections.length}`);
            this.initForSection(section);
        });
        
        console.log('🎥 Video Editor: All sections processed');
    }
    
    /**
     * Clean up and remove all event listeners
     */
    destroy() {
        // Clean up all active indicators using their cleanup functions
        this.activeIndicators.forEach((data) => {
            data.cleanup();
        });
        this.activeIndicators.clear();
        
        // Remove overlay container
        if (this.overlayContainer) {
            this.overlayContainer.remove();
            this.overlayContainer = null;
        }
        
        // Remove initialization markers from sections
        const sections = document.querySelectorAll('.section[data-video-editor-initialized]');
        sections.forEach(section => {
            section.removeAttribute('data-video-editor-initialized');
        });
    }
}

// Initialize global instance (with singleton protection)
if (!window.inlineVideoEditor) {
    window.inlineVideoEditor = new InlineVideoEditor();
} else {
    console.log('InlineVideoEditor already initialized, skipping');
}

