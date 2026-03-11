// Section Background Picker
// Handles background color selection for sections

class SectionBackgroundPicker {
    constructor() {
        this.initialized = false;
        this.suppressHistory = false;
        this.backgroundUtilityClasses = [
            'bg-[var(--primary-bg)]',
            'bg-[var(--secondary-bg)]',
            'bg-[var(--accent-bg)]',
            'bg-themed-primary',
            'bg-themed-secondary',
            'bg-themed-accent',
            'gradient-themed-1',
            'gradient-themed-2',
            'bg-features2-themed'
        ];
        this.init();
    }

    init() {
        if (this.initialized) return;
        this.initialized = true;
        
        // Initialize event delegation
        this.initEventDelegation();
    }

    initEventDelegation() {
        // Use event delegation for button clicks
        document.addEventListener('click', (e) => {
            // Handle background image picker button clicks (shows dropdown)
            const imgButton = e.target.closest('.bg-picker-img-button');
            if (imgButton) {
                e.stopPropagation();
                const sectionNumber = imgButton.getAttribute('data-section');
                const wrapper = imgButton.closest('.bg-picker-wrapper');
                if (!wrapper) return;
                
                const dropdown = wrapper.querySelector('.bg-picker-img-dropdown');
                if (!dropdown) return;
                
                // Find the section to determine background type
                const sectionMenu = imgButton.closest('.section-menu');
                if (!sectionMenu) return;
                const section = sectionMenu.closest('.section');
                if (!section) return;
                
                // Update dropdown content based on background type
                this.updateMediaDropdown(sectionNumber, section);
                
                // Close all other dropdowns (including color picker dropdown)
                document.querySelectorAll('.bg-picker-dropdown, .bg-picker-img-dropdown').forEach(dd => {
                    if (dd !== dropdown) {
                        dd.classList.remove('active');
                    }
                });
                
                // Toggle this dropdown
                dropdown.classList.toggle('active');
                return;
            }
            
            // Handle background image picker option clicks
            const imgOption = e.target.closest('.bg-picker-img-option');
            if (imgOption) {
                e.stopPropagation();
                const action = imgOption.getAttribute('data-action');
                const dropdown = imgOption.closest('.bg-picker-img-dropdown');
                
                // Find the section element by traversing from section-menu (not by data-section)
                const sectionMenu = imgOption.closest('.section-menu');
                if (!sectionMenu) return;
                
                const section = sectionMenu.closest('.section');
                if (!section) return;
                
                const sectionNumber = section.getAttribute('data-section');
                
                if (action === 'change-image') {
                    // Section itself has background (data-bg="true" or computed from CSS class e.g. .parallax-quote)
                    const sectionHasBg = section.hasAttribute('data-bg') && section.getAttribute('data-bg') === 'true';
                    const sectionHasComputedBg = this.hasSectionComputedBackgroundImage(section);
                    if ((sectionHasBg || sectionHasComputedBg) && window.cloudinaryImageEditor) {
                        if (sectionHasComputedBg && !sectionHasBg) section.setAttribute('data-bg', 'true');
                        window.cloudinaryImageEditor.handleBackgroundElementClick(section);
                    }
                    // Section has background on .fp-bg element
                    else if ((section.classList.contains('has-bg-image') || this.hasFpBgImage(section)) && window.cloudinaryImageEditor) {
                        const fpBg = section.querySelector('.fp-bg');
                        if (fpBg) {
                            window.cloudinaryImageEditor.handleBackgroundElementClick(fpBg);
                        }
                    }
                } else if (action === 'remove-image') {
                    if (section.hasAttribute('data-bg') && section.getAttribute('data-bg') === 'true') {
                        this.removeSectionBackgroundImage(section, sectionNumber);
                    } else if (this.hasSectionComputedBackgroundImage(section)) {
                        // Background from CSS class (e.g. .parallax-quote): clear by setting inline none
                        section.style.setProperty('background-image', 'none');
                        section.setAttribute('data-bg', 'default');
                        this.updateSectionImageState(section);
                    } else if (this.hasFpBgImage(section)) {
                        this.removeFpBgImage(section, sectionNumber);
                    }
                } else if (action === 'change-video') {
                    this.showVideoUrlModal(section, sectionNumber);
                } else if (action === 'remove-video') {
                    this.removeFpBgVideo(section, sectionNumber);
                } else if (action === 'replace-video-with-image') {
                    // Mark fp-bg to remove video after image is applied (don't remove yet)
                    const fpBg = section.querySelector('.fp-bg');
                    if (fpBg && window.cloudinaryImageEditor) {
                        // Set flag to remove video after image is successfully applied
                        fpBg.setAttribute('data-replace-video-with-image', 'true');
                        // Open Cloudinary modal
                        // Note: Video will be removed in cloudinaryImageEditor.updateBackgroundImage() when image is applied
                        // Flag will be cleaned up in cloudinaryImageEditor close handler if user cancels
                        window.cloudinaryImageEditor.handleBackgroundElementClick(fpBg);
                    }
                } else if (action === 'replace-image-with-video') {
                    // Mark section to remove image after video is applied (don't remove yet)
                    const fpBg = section.querySelector('.fp-bg');
                    if (fpBg) {
                        // Set flag to remove image after video is successfully applied
                        fpBg.setAttribute('data-replace-image-with-video', 'true');
                        // Show video modal - video will remove image when saved
                        this.showVideoUrlModal(section, sectionNumber);
                    }
                }
                
                if (dropdown) {
                    dropdown.classList.remove('active');
                }
                return;
            }
            
            // Handle background picker button clicks
            const button = e.target.closest('.bg-picker-button');
            if (button) {
                e.stopPropagation();
                const sectionNumber = button.getAttribute('data-section');
                const wrapper = button.closest('.bg-picker-wrapper');
                if (!wrapper) return;
                const dropdown = wrapper.querySelector('.bg-picker-dropdown');
                if (!dropdown) return;
                document.querySelectorAll('.bg-picker-dropdown').forEach(dd => {
                    if (dd !== dropdown) dd.classList.remove('active');
                });
                dropdown.classList.toggle('active');
                return;
            }

            // Handle background picker option clicks
            const option = e.target.closest('.bg-picker-option');
            if (option) {
                e.stopPropagation();
                const bgValue = option.getAttribute('data-bg');
                const dropdown = option.closest('.bg-picker-dropdown');
                const sectionMenu = option.closest('.section-menu');
                if (!sectionMenu) return;
                const section = sectionMenu.closest('.section');
                if (!section) return;
                const sectionNumber = section.getAttribute('data-section');
                this.changeSectionBackground(section, sectionNumber, bgValue);
                if (dropdown) dropdown.classList.remove('active');
                return;
            }

            // Close all dropdowns when clicking outside
            const clickedInsidePicker = e.target.closest('.bg-picker-wrapper');
            if (!clickedInsidePicker) {
                document.querySelectorAll('.bg-picker-dropdown, .bg-picker-img-dropdown').forEach(dd => {
                    dd.classList.remove('active');
                });
            }
        });
    }
    
    /**
     * Remove background image from a section
     */
    removeSectionBackgroundImage(section, sectionNumber) {
        if (!section) return;
        
        const previousState = this.captureBackgroundState(section);
        
        // Remove background-image from style
        const currentStyle = section.getAttribute('style') || '';
        if (currentStyle) {
            // Remove background-image and background properties that contain url()
            let cleanedStyle = currentStyle
                .replace(/background-image\s*:\s*[^;]+;?/gi, '')
                .replace(/background\s*:\s*[^;]*url\([^)]+\)[^;]*;?/gi, '')
                .replace(/background\s*:\s*[^;]*linear-gradient[^;]*url\([^)]+\)[^;]*;?/gi, '')
                .trim();
            
            // Clean up any trailing semicolons or extra spaces
            cleanedStyle = cleanedStyle.replace(/;\s*;+/g, ';').replace(/^\s*;\s*|\s*;\s*$/g, '');
            
            if (cleanedStyle) {
                section.setAttribute('style', cleanedStyle);
            } else {
                section.removeAttribute('style');
            }
        }
        
        // Remove data-bg="true" attribute
        section.removeAttribute('data-bg');
        
        // Update section image state
        this.updateSectionImageState(section);
        
        // Update button circle color (will show color picker button automatically via CSS)
        this.updateButtonCircle(sectionNumber);
        
        if (!this.suppressHistory) {
            const nextState = this.captureBackgroundState(section);
            this.emitBackgroundCommand(sectionNumber, previousState, nextState, 'Background removed');
        }
    }
    
    /**
     * Remove background image from .fp-bg element
     */
    removeFpBgImage(section, sectionNumber) {
        if (!section) return;
        
        const fpBg = section.querySelector('.fp-bg');
        if (!fpBg) return;
        
        const previousState = this.captureBackgroundState(section);
        
        // Remove background-image from .fp-bg style
        const currentStyle = fpBg.getAttribute('style') || '';
        if (currentStyle) {
            // Remove background-image and background properties that contain url()
            let cleanedStyle = currentStyle
                .replace(/background-image\s*:\s*[^;]+;?/gi, '')
                .replace(/background\s*:\s*[^;]*url\([^)]+\)[^;]*;?/gi, '')
                .replace(/background\s*:\s*[^;]*linear-gradient[^;]*url\([^)]+\)[^;]*;?/gi, '')
                .trim();
            
            // Clean up any trailing semicolons or extra spaces
            cleanedStyle = cleanedStyle.replace(/;\s*;+/g, ';').replace(/^\s*;\s*|\s*;\s*$/g, '');
            
            if (cleanedStyle) {
                fpBg.setAttribute('style', cleanedStyle);
            } else {
                fpBg.removeAttribute('style');
            }
        }
        
        // Also check if background is set via CSS class and remove has-bg-image class
        section.classList.remove('has-bg-image');
        
        // Update section image state
        this.updateSectionImageState(section);
        
        // Update button circle color
        this.updateButtonCircle(sectionNumber);
        
        if (!this.suppressHistory) {
            const nextState = this.captureBackgroundState(section);
            this.emitBackgroundCommand(sectionNumber, previousState, nextState, 'Background image removed from .fp-bg');
        }
    }
    
    /**
     * Remove background video from .fp-bg element
     */
    removeFpBgVideo(section, sectionNumber) {
        if (!section) return;
        
        const fpBg = section.querySelector('.fp-bg');
        if (!fpBg) return;
        
        const previousState = this.captureBackgroundState(section);
        
        // Remove video element
        const video = fpBg.querySelector('video');
        if (video) {
            video.remove();
        }
        
        // Update section state
        this.updateSectionImageState(section);
        this.updateButtonCircle(sectionNumber);
        
        if (!this.suppressHistory) {
            const nextState = this.captureBackgroundState(section);
            this.emitBackgroundCommand(sectionNumber, previousState, nextState, 'Background video removed');
        }
    }
    
    /**
     * Update the media dropdown content based on background type
     */
    updateMediaDropdown(sectionNumber, section) {
        const dropdown = document.querySelector(`.bg-picker-img-dropdown[data-section="${sectionNumber}"]`);
        if (!dropdown) return;
        
        let bgType = this.getFpBgType(section);

        // Fallback: sections where the background lives on the section element itself
        // (e.g. .parallax-quote promoted to <section data-bg="true">), no .fp-bg child.
        if (!bgType) {
            const sectionHasBg = section.getAttribute('data-bg') === 'true';
            const sectionHasComputedBg = this.hasSectionComputedBackgroundImage(section);
            if (sectionHasBg || sectionHasComputedBg) bgType = 'image';
        }
        
        // Clear existing options
        dropdown.innerHTML = '';
        
        if (bgType === 'video') {
            // Video options
            dropdown.innerHTML = `
                <div class="bg-picker-img-option" data-action="change-video" data-section="${sectionNumber}">
                    <span>Change Video</span>
                </div>
                <div class="bg-picker-img-option danger" data-action="remove-video" data-section="${sectionNumber}">
                    <span>Remove Video</span>
                </div>
                <div class="bg-picker-img-option" data-action="replace-video-with-image" data-section="${sectionNumber}">
                    <span>Replace with Image</span>
                </div>
            `;
        } else if (bgType === 'image') {
            // Image options
            dropdown.innerHTML = `
                <div class="bg-picker-img-option" data-action="change-image" data-section="${sectionNumber}">
                    <span>Change Image</span>
                </div>
                <div class="bg-picker-img-option danger" data-action="remove-image" data-section="${sectionNumber}">
                    <span>Remove Image</span>
                </div>
                <div class="bg-picker-img-option" data-action="replace-image-with-video" data-section="${sectionNumber}">
                    <span>Replace with Video</span>
                </div>
            `;
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
     * Show video URL modal for adding/changing video sources
     */
    showVideoUrlModal(section, sectionNumber) {
        const fpBg = section.querySelector('.fp-bg');
        if (!fpBg) return;
        
        // Get existing video if present
        const existingVideo = fpBg.querySelector('video');
        const existingSources = existingVideo ? Array.from(existingVideo.querySelectorAll('source')) : [];
        
        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.className = 'fp-ui-theme video-url-modal-overlay modal-overlay';
        
        // Create modal
        const modal = document.createElement('div');
        modal.className = 'video-url-modal';
        
        // Video sources array (only URLs, type will be inferred)
        const sources = existingSources.length > 0 
            ? existingSources.map(s => ({ url: s.getAttribute('src') || '' }))
            : [{ url: '' }];
        
        // Helper function to get placeholder based on source index
        const getPlaceholderForIndex = (index) => {
            if (index === 0) return 'https://example.com/video.mp4';
            if (index === 1) return 'https://example.com/video.webm';
            if (index === 2) return 'https://example.com/video.mov';
            return 'https://example.com/video.mp4'; // Default for index 3+
        };
        
        // Build modal HTML
        let sourcesHTML = '';
        sources.forEach((source, index) => {
            sourcesHTML += `
                <div class="video-source-row">
                    <div>
                        <label class="video-source-label">Video URL ${index + 1}</label>
                        <input type="text" class="video-url-input" data-index="${index}" placeholder="${getPlaceholderForIndex(index)}" value="${source.url}">
                    </div>
                    ${index > 0 ? `<button type="button" class="remove-source-btn" data-index="${index}">Remove</button>` : ''}
                </div>
            `;
        });
        
        modal.innerHTML = `
            <h2>${existingVideo ? 'Change' : 'Add'} Background Video</h2>
            <div class="video-url-modal-info">
                <p>
                    <strong>About Video Sources:</strong> HTML5 video elements support multiple source files for better browser compatibility. The browser will automatically use the first format it supports. Common formats include MP4 (widely supported), WebM (better compression), and MOV (QuickTime format).
                </p>
            </div>
            <div class="video-sources-container">
                ${sourcesHTML}
            </div>
            <button type="button" class="add-source-btn" title="Add multiple video sources for better browser compatibility (e.g., MP4, WebM, MOV)">+ Add Source</button>
            <div class="video-modal-actions">
                <button type="button" class="cancel-video-btn">Cancel</button>
                <button type="button" class="save-video-btn">Save</button>
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
            newRow.className = 'video-source-row';
            newRow.innerHTML = `
                <div>
                    <label class="video-source-label">Video URL ${index + 1}</label>
                    <input type="text" class="video-url-input" data-index="${index}" placeholder="${getPlaceholderForIndex(index)}">
                </div>
                <button type="button" class="remove-source-btn" data-index="${index}">Remove</button>
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
        
        // Cancel button handler
        const cancelBtn = modal.querySelector('.cancel-video-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                document.body.removeChild(overlay);
            });
        }
        
        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
            }
        });
        
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
                this.applyVideoSources(section, sectionNumber, validSources, existingVideo);
                
                // Close modal
                document.body.removeChild(overlay);
            });
        }
    }
    
    /**
     * Apply video sources to section
     */
    applyVideoSources(section, sectionNumber, sources, existingVideo) {
        if (!section) return;
        
        const fpBg = section.querySelector('.fp-bg');
        if (!fpBg) return;
        
        const previousState = this.captureBackgroundState(section);
        
        // Check if we're replacing an image with video
        const isReplacingImage = fpBg.hasAttribute('data-replace-image-with-video');
        
        // Remove existing video if present (but not if we're replacing image - video will be removed after image is removed)
        if (existingVideo && !isReplacingImage) {
            existingVideo.remove();
        }
        
        // If replacing image with video, remove the image now (video is about to be applied)
        if (isReplacingImage) {
            // Remove image background
            if (section.hasAttribute('data-bg') && section.getAttribute('data-bg') === 'true') {
                this.removeSectionBackgroundImage(section, sectionNumber);
            } else if (this.hasFpBgImage(section)) {
                this.removeFpBgImage(section, sectionNumber);
            }
            // Clean up flag
            fpBg.removeAttribute('data-replace-image-with-video');
            
            // Now remove existing video if present (after image is removed)
            if (existingVideo) {
                existingVideo.remove();
            }
        }
        
        // Create new video element
        const video = document.createElement('video');
        video.className = 'absolute inset-0 w-full h-full object-cover';
        video.setAttribute('loop', '');
        video.setAttribute('muted', '');
        video.setAttribute('playsinline', '');
        video.setAttribute('autoplay', '');
        video.setAttribute('data-autoplay', '');
        video.setAttribute('data-keepplaying', '');
        video.setAttribute('allow', 'autoplay');
        video.setAttribute('onloadedmetadata', 'this.muted = true');
        
        // Add sources
        sources.forEach(source => {
            const sourceElement = document.createElement('source');
            sourceElement.setAttribute('src', source.url);
            if (source.type) {
                sourceElement.setAttribute('type', source.type);
            }
            video.appendChild(sourceElement);
        });
        
        // Append video to fp-bg
        fpBg.appendChild(video);
        
        // Update section state (this will add both has-bg-video and has-bg-image classes)
        this.updateSectionImageState(section);
        this.updateButtonCircle(sectionNumber);
        
        if (!this.suppressHistory) {
            const nextState = this.captureBackgroundState(section);
            this.emitBackgroundCommand(sectionNumber, previousState, nextState, 'Background video updated');
        }
    }
    

    // Detect and save original background classes to data-original-bg
    saveOriginalBackground(section) {
        // Only save if not already saved
        if (section.hasAttribute('data-original-bg')) {
            return;
        }
        
        // Detect all background classes that are present on the section
        const backgroundClasses = this.backgroundUtilityClasses.filter(className => 
            section.classList.contains(className)
        );
        
        // Save the original background classes as a comma-separated string
        if (backgroundClasses.length > 0) {
            section.setAttribute('data-original-bg', backgroundClasses.join(','));
        } else {
            // No background classes found, save empty string to indicate no original background
            section.setAttribute('data-original-bg', '');
        }
    }

    // Get computed CSS variable value and format it for display
    getCSSVariableValue(cssVar, sectionElement = null) {
        // Use the section element or body to get the correct computed value
        // This ensures we get the value with theme classes applied
        const element = sectionElement || document.body || document.documentElement;
        const computedStyle = getComputedStyle(element);
        const computedValue = computedStyle.getPropertyValue(cssVar).trim();
        
        if (!computedValue) return '';
        
        // Check if it's a gradient
        if (computedValue.includes('gradient')) {
            return 'Gradient';
        }
        
        // For solid colors, try to convert to hex
        // Handle rgb/rgba values
        if (computedValue.startsWith('rgb')) {
            const rgbMatch = computedValue.match(/\d+/g);
            if (rgbMatch && rgbMatch.length >= 3) {
                const r = parseInt(rgbMatch[0]);
                const g = parseInt(rgbMatch[1]);
                const b = parseInt(rgbMatch[2]);
                return '#' + [r, g, b].map(x => {
                    const hex = x.toString(16);
                    return hex.length === 1 ? '0' + hex : hex;
                }).join('');
            }
        }
        
        // If already hex, return as is
        if (computedValue.startsWith('#')) {
            return computedValue;
        }
        
        // Fallback: return the computed value (might be a color name or other format)
        return computedValue;
    }

    // Convert RGB/RGBA to hex
    rgbToHex(rgb) {
        // Handle rgb(r, g, b) or rgba(r, g, b, a)
        const match = rgb.match(/\d+/g);
        if (match && match.length >= 3) {
            const r = parseInt(match[0]);
            const g = parseInt(match[1]);
            const b = parseInt(match[2]);
            return '#' + [r, g, b].map(x => {
                const hex = x.toString(16);
                return hex.length === 1 ? '0' + hex : hex;
            }).join('');
        }
        return '';
    }

    // Get the actual computed background color from an element
    getComputedBackgroundColor(element) {
        if (!element) return '';
        
        const computedStyle = getComputedStyle(element);
        const bgColor = computedStyle.backgroundColor;
        const bgImage = computedStyle.backgroundImage;
        
        // Check if it's a gradient
        if (bgImage && bgImage !== 'none' && bgImage.includes('gradient')) {
            return 'Gradient';
        }
        
        // Convert RGB/RGBA to hex
        if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
            const hex = this.rgbToHex(bgColor);
            if (hex) return hex;
        }
        
        return bgColor || '';
    }

    // Update color values in dropdown options
    updateColorValues(dropdown, sectionElement = null) {
        if (!dropdown) return;
        
        // Get the section element by traversing from section-menu (never query by data-section)
        if (!sectionElement) {
            const sectionMenu = dropdown.closest('.section-menu');
            if (sectionMenu) {
                sectionElement = sectionMenu.closest('.section');
            }
        }
        
        const options = dropdown.querySelectorAll('.bg-picker-option');
        options.forEach(option => {
            const valueElement = option.querySelector('.bg-picker-value');
            const colorSwatch = option.querySelector('.bg-picker-color');
            const bgValue = option.getAttribute('data-bg');
            
            if (!valueElement || !colorSwatch) return;
            
            // Handle "default" option separately - show the original background
            if (bgValue === 'default') {
                if (sectionElement) {
                    // Get the original background from data-original-bg
                    const originalBg = sectionElement.getAttribute('data-original-bg');
                    
                    if (originalBg && originalBg !== '') {
                        // If original background has classes, apply them temporarily to get the color
                        const originalClasses = originalBg.split(',');
                        const tempDiv = document.createElement('div');
                        tempDiv.style.cssText = 'position: absolute; visibility: hidden; pointer-events: none;';
                        // Append inside #preview-content so CSS variables resolve from
                        // the template context instead of the editor UI (body.dark-mode)
                        const previewContent = document.getElementById('preview-content');
                        const tempParent = previewContent || document.body;
                        tempParent.appendChild(tempDiv);
                        
                        // Apply original classes to temp element
                        originalClasses.forEach(className => {
                            if (className.trim()) {
                                tempDiv.classList.add(className.trim());
                            }
                        });
                        
                        // Get computed color
                        const computedStyle = getComputedStyle(tempDiv);
                        const bgColor = computedStyle.backgroundColor;
                        const bgImage = computedStyle.backgroundImage;
                        
                        // Clean up
                        tempParent.removeChild(tempDiv);
                        
                        // Set color swatch (no hex or "Gradient" label)
                        if (bgImage && bgImage !== 'none' && bgImage.includes('gradient')) {
                            colorSwatch.style.setProperty('background', bgImage);
                            valueElement.textContent = '';
                        } else if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
                            colorSwatch.style.setProperty('background-color', bgColor);
                            valueElement.textContent = '';
                        } else {
                            colorSwatch.style.removeProperty('background');
                            colorSwatch.style.removeProperty('background-color');
                            valueElement.textContent = '';
                        }
                    } else {
                        // No original background
                        colorSwatch.style.removeProperty('background');
                        colorSwatch.style.removeProperty('background-color');
                        valueElement.textContent = '';
                    }
                }
            } else {
                // Resolve CSS variable from the section context (not from .fp-ui-theme which
                // overrides template variables with editor UI colors in dark mode)
                const cssVar = option.getAttribute('data-css-var');
                const varSource = sectionElement || document.getElementById('preview-content');
                if (cssVar && varSource) {
                    const resolvedValue = getComputedStyle(varSource).getPropertyValue(cssVar).trim();
                    if (resolvedValue) {
                        colorSwatch.style.setProperty('background', resolvedValue);
                    }
                    valueElement.textContent = '';
                } else {
                    valueElement.textContent = '';
                }
            }
        });
    }

    // Update all color values in all dropdowns (called when theme changes)
    updateAllColorValues() {
        const allDropdowns = document.querySelectorAll('.bg-picker-dropdown');
        allDropdowns.forEach(dropdown => {
            this.updateColorValues(dropdown);
        });
        
        // Also update all button circles
        const allButtons = document.querySelectorAll('.bg-picker-button');
        allButtons.forEach(button => {
            const sectionNumber = button.getAttribute('data-section');
            if (sectionNumber) {
                this.updateButtonCircle(sectionNumber);
            }
        });
    }
    

    // Update the background picker button circle color
    updateButtonCircle(sectionNumber) {
        // Find button by sectionNumber, then find section from its section-menu
        const button = document.querySelector(`.bg-picker-button[data-section="${sectionNumber}"]`);
        if (!button) return;
        
        const sectionMenu = button.closest('.section-menu');
        if (!sectionMenu) return;
        
        const section = sectionMenu.closest('.section');
        if (!section) return;
        
        const circle = button.querySelector('.bg-picker-button-circle');
        if (!circle) return;
        
        // Get the computed background color from the section
        const computedStyle = getComputedStyle(section);
        const bgColor = computedStyle.backgroundColor;
        const bgImage = computedStyle.backgroundImage;
        
        // If it's a gradient, use the first color or a default
        if (bgImage && bgImage !== 'none' && bgImage.includes('gradient')) {
            // For gradients, extract the first color from the gradient
            const gradientMatch = bgImage.match(/rgba?\([^)]+\)|#[0-9a-fA-F]{3,6}/);
            if (gradientMatch) {
                circle.style.setProperty('background', gradientMatch[0]);
            } else {
                // Fallback: use a gradient preview
                circle.style.setProperty('background', bgImage);
            }
        } else if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
            circle.style.setProperty('background-color', bgColor);
        } else {
            // Default: transparent or use CSS variable
            circle.style.removeProperty('background');
            circle.style.removeProperty('background-color');
        }
    }

    /**
     * Check if the section element itself has a background image (inline or from CSS class).
     * Used for sections like .parallax-quote where the background is on the section, not on .fp-bg.
     */
    hasSectionComputedBackgroundImage(section) {
        if (!section) return false;
        const style = getComputedStyle(section);
        const bg = style.backgroundImage || style.background || '';
        return typeof bg === 'string' && bg !== 'none' && bg.includes('url(');
    }

    /**
     * Check if section has a background image on .fp-bg element
     */
    hasFpBgImage(section) {
        if (!section) return false;
        
        const fpBg = section.querySelector('.fp-bg');
        if (!fpBg) return false;
        
        // Check inline style
        const inlineBg = fpBg.style.backgroundImage || fpBg.style.background;
        if (inlineBg && inlineBg.includes('url(')) {
            return true;
        }
        
        // Check computed style
        const computedStyle = getComputedStyle(fpBg);
        const computedBg = computedStyle.backgroundImage;
        if (computedBg && computedBg !== 'none' && computedBg.includes('url(')) {
            return true;
        }
        
        return false;
    }
    
    /**
     * Check if section has a background video on .fp-bg element
     */
    hasFpBgVideo(section) {
        if (!section) return false;
        
        const fpBg = section.querySelector('.fp-bg');
        if (!fpBg) return false;
        
        // Check if there's a <video> element inside .fp-bg
        const video = fpBg.querySelector('video');
        return video !== null;
    }
    
    /**
     * Get the background type: 'image', 'video', or null
     */
    getFpBgType(section) {
        if (this.hasFpBgVideo(section)) {
            return 'video';
        } else if (this.hasFpBgImage(section)) {
            return 'image';
        }
        return null;
    }
    
    /**
     * Update section classes based on background image/video state
     */
    updateSectionImageState(section) {
        if (!section) return;
        
        const hasSectionBg = section.hasAttribute('data-bg') && section.getAttribute('data-bg') === 'true';
        const hasSectionComputedBg = this.hasSectionComputedBackgroundImage(section);
        const hasFpBgImage = this.hasFpBgImage(section);
        const hasFpBgVideo = this.hasFpBgVideo(section);
        const hasFpBg = section.querySelector('.fp-bg') !== null;
        const alreadyHasBgImageClass = section.classList.contains('has-bg-image');
        
        // Section itself has background (data-bg or CSS class like .parallax-quote): ensure editable
        if (hasSectionBg || hasSectionComputedBg) {
            section.classList.add('has-bg-image');
            section.classList.remove('has-bg-video');
            return;
        }
        if (hasFpBgImage) {
            section.classList.add('has-bg-image');
            section.classList.remove('has-bg-video');
        } else if (hasFpBgVideo) {
            section.classList.add('has-bg-video');
            section.classList.add('has-bg-image');
        } else {
            if (!hasFpBg || !alreadyHasBgImageClass) {
                section.classList.remove('has-bg-image', 'has-bg-video');
            }
        }
    }

    // Initialize background picker for a section (just updates state)
    initForSection(sectionNumber) {
        const section = document.querySelector(`.section[data-section="${sectionNumber}"]`);
        if (!section) return;

        const sectionMenu = section.querySelector('.section-menu');
        if (!sectionMenu) return;

        // Update section image/video state (for .fp-bg detection)
        this.updateSectionImageState(section);
        // Update media button tooltip
        this.updateMediaButton(sectionNumber, section);
        // Save original background if not already saved
        this.saveOriginalBackground(section);

        const dropdown = document.querySelector(`.bg-picker-dropdown[data-section="${sectionNumber}"]`);
        if (dropdown) {
            this.updateColorValues(dropdown, section);
            this.updateButtonCircle(sectionNumber);
            this.updateBackgroundPickerState(sectionNumber);
        }
    }
    
    /**
     * Update media button tooltip and icon based on background type
     */
    updateMediaButton(sectionNumber, section) {
        const button = document.querySelector(`.bg-picker-img-button[data-section="${sectionNumber}"]`);
        if (!button) return;
        
        let sectionElement = section;
        if (!sectionElement) {
            const sectionMenu = button.closest('.section-menu');
            if (!sectionMenu) return;
            sectionElement = sectionMenu.closest('.section');
            if (!sectionElement) return;
        }
        
        const bgType = this.getFpBgType(sectionElement);
        
        if (bgType === 'video') {
            button.setAttribute('data-tippy-content', 'Edit background video');
            // Optionally update icon to video icon - keeping image icon for now as it's more generic
        } else if (bgType === 'image') {
            button.setAttribute('data-tippy-content', 'Edit background image');
        }
    }

    // Update background picker visual state
    updateBackgroundPickerState(sectionNumber) {
        // Find dropdown by sectionNumber, then find section from its section-menu
        const dropdown = document.querySelector(`.bg-picker-dropdown[data-section="${sectionNumber}"]`);
        if (!dropdown) return;
        
        const sectionMenu = dropdown.closest('.section-menu');
        if (!sectionMenu) return;
        
        const section = sectionMenu.closest('.section');
        if (!section) return;
        
        // Check for current background by looking at both data-bg attribute and classes
        let currentBg = section.getAttribute('data-bg');
        
        // If no data-bg, try to detect from existing classes or inline styles
        if (!currentBg || currentBg === 'default') {
            const inlineBg = section.style.getPropertyValue('background') || '';
            const inlineBgColor = section.style.getPropertyValue('background-color') || '';

            // Detect from inline styles first (set by picker)
            if (inlineBg.includes('--gradient-1')) {
                currentBg = 'gradient-1';
            } else if (inlineBg.includes('--gradient-2')) {
                currentBg = 'gradient-2';
            } else if (inlineBg.includes('--features2-bg')) {
                currentBg = 'features2';
            } else if (inlineBg === 'transparent') {
                currentBg = 'none';
            } else if (inlineBgColor.includes('--primary-bg')) {
                currentBg = 'primary';
            } else if (inlineBgColor.includes('--secondary-bg')) {
                currentBg = 'secondary';
            } else if (inlineBgColor.includes('--accent-bg')) {
                currentBg = 'accent';
            // Fallback: detect from legacy CSS classes
            } else if (section.classList.contains('gradient-themed-1')) {
                currentBg = 'gradient-1';
            } else if (section.classList.contains('gradient-themed-2')) {
                currentBg = 'gradient-2';
            } else if (section.classList.contains('bg-features2-themed')) {
                currentBg = 'features2';
            } else if (section.classList.contains('bg-[var(--primary-bg)]') || section.classList.contains('bg-themed-primary')) {
                currentBg = 'primary';
            } else if (section.classList.contains('bg-[var(--secondary-bg)]') || section.classList.contains('bg-themed-secondary')) {
                currentBg = 'secondary';
            } else if (section.classList.contains('bg-[var(--accent-bg)]') || section.classList.contains('bg-themed-accent')) {
                currentBg = 'accent';
            } else {
                currentBg = 'default';
            }
            // Update data-bg to match detected state
            section.setAttribute('data-bg', currentBg);
        }
        
        // Remove active class from all options
        dropdown.querySelectorAll('.bg-picker-option').forEach(option => {
            option.classList.remove('active');
        });
        
        // Add active class to current option
        const activeOption = dropdown.querySelector(`[data-bg="${currentBg}"]`);
        if (activeOption) {
            activeOption.classList.add('active');
        }
    }

    // Change section background
    changeSectionBackground(sectionElement, sectionNumber, bgValue) {
        // Section element must be provided (never query by data-section)
        const section = sectionElement;
        if (!section) {
            console.warn(`Section element not provided`);
            return;
        }
        
        // Ensure we're working with the actual section element
        // The section should have the 'section' class or be a section/footer element with data-section attribute
        if (!section.classList.contains('section') && !section.hasAttribute('data-section')) {
            console.warn('Element is not a valid section element');
            return;
        }
        
        // Get sectionNumber from the element if not provided
        if (!sectionNumber) {
            sectionNumber = section.getAttribute('data-section');
        }
        
        // Save original background before removing (if not already saved)
        this.saveOriginalBackground(section);
        
        const previousState = this.captureBackgroundState(section);
        
        // Remove any existing background utility classes (both Tailwind arbitrary values and custom classes)
        // This includes solid backgrounds and gradient backgrounds
        section.classList.remove(...this.backgroundUtilityClasses);
        
        // Remove all inline background styles for a clean slate
        section.style.removeProperty('background');
        section.style.removeProperty('background-color');
        section.style.removeProperty('background-image');
        
        // Apply new background based on selection (always use inline styles to override template CSS)
        if (bgValue === 'primary') {
            section.style.setProperty('background-color', 'var(--primary-bg)');
            section.setAttribute('data-bg', 'primary');
        } else if (bgValue === 'secondary') {
            section.style.setProperty('background-color', 'var(--secondary-bg)');
            section.setAttribute('data-bg', 'secondary');
        } else if (bgValue === 'accent') {
            section.style.setProperty('background-color', 'var(--accent-bg)');
            section.setAttribute('data-bg', 'accent');
        } else if (bgValue === 'gradient-1') {
            section.style.setProperty('background', 'var(--gradient-1)');
            section.setAttribute('data-bg', 'gradient-1');
        } else if (bgValue === 'gradient-2') {
            section.style.setProperty('background', 'var(--gradient-2)');
            section.setAttribute('data-bg', 'gradient-2');
        } else if (bgValue === 'features2') {
            section.style.setProperty('background', 'var(--features2-bg)');
            section.setAttribute('data-bg', 'features2');
        } else if (bgValue === 'none') {
            section.style.setProperty('background', 'transparent');
            section.setAttribute('data-bg', 'none');
        } else {
            // Default - restore original background classes
            const originalBg = section.getAttribute('data-original-bg');
            if (originalBg && originalBg !== '') {
                // Restore original background classes
                const originalClasses = originalBg.split(',');
                originalClasses.forEach(className => {
                    if (className.trim()) {
                        section.classList.add(className.trim());
                    }
                });
            }
            section.setAttribute('data-bg', 'default');
        }
        
        // Update picker visual state
        this.updateBackgroundPickerState(sectionNumber);
        
        // Update button circle color
        this.updateButtonCircle(sectionNumber);
        
        if (!this.suppressHistory) {
            const nextState = this.captureBackgroundState(section);
            this.emitBackgroundCommand(sectionNumber, previousState, nextState, 'Background updated');
        }
    }

    captureBackgroundState(section) {
        if (!section) return null;
        
        // Capture .fp-bg element's style if it exists
        const fpBg = section.querySelector('.fp-bg');
        const fpBgStyle = fpBg ? (fpBg.getAttribute('style') || null) : null;
        
        // Capture video element if it exists
        const video = fpBg ? fpBg.querySelector('video') : null;
        const videoSources = video ? Array.from(video.querySelectorAll('source')).map(source => ({
            src: source.getAttribute('src'),
            type: source.getAttribute('type')
        })) : null;
        const videoAttributes = video ? {
            loop: video.hasAttribute('loop'),
            muted: video.hasAttribute('muted'),
            playsinline: video.hasAttribute('playsinline'),
            autoplay: video.hasAttribute('autoplay'),
            className: video.className
        } : null;
        
        return {
            dataBg: section.getAttribute('data-bg'),
            style: section.getAttribute('style') || null,
            backgroundClasses: this.getBackgroundClassList(section),
            fpBgStyle: fpBgStyle,
            hasBgImageClass: section.classList.contains('has-bg-image'),
            hasBgVideoClass: section.classList.contains('has-bg-video'),
            videoSources: videoSources,
            videoAttributes: videoAttributes,
            overlayOpacity: section.getAttribute('data-overlay-opacity') || null
        };
    }
    
    getBackgroundClassList(section) {
        if (!section) return [];
        return this.backgroundUtilityClasses.filter(className => section.classList.contains(className));
    }
    
    cloneBackgroundState(state) {
        if (!state) return null;
        return {
            dataBg: state.dataBg ?? null,
            style: state.style ?? null,
            backgroundClasses: state.backgroundClasses ? [...state.backgroundClasses] : [],
            fpBgStyle: state.fpBgStyle ?? null,
            hasBgImageClass: state.hasBgImageClass ?? false,
            hasBgVideoClass: state.hasBgVideoClass ?? false,
            videoSources: state.videoSources ? [...state.videoSources] : null,
            videoAttributes: state.videoAttributes ? {...state.videoAttributes} : null,
            overlayOpacity: state.overlayOpacity ?? null
        };
    }
    
    emitBackgroundCommand(sectionNumber, beforeState, afterState, label) {
        if (!window.parent || window.parent === window || !window.parent.postMessage) {
            return;
        }
        
        const serializedBefore = JSON.stringify(beforeState);
        const serializedAfter = JSON.stringify(afterState);
        if (serializedBefore === serializedAfter) {
            return;
        }
        
        window.parent.postMessage({
            type: 'COMMAND_BACKGROUND_CHANGE',
            data: {
                sectionNumber,
                beforeState: this.cloneBackgroundState(beforeState),
                afterState: this.cloneBackgroundState(afterState),
                label
            }
        }, '*');
    }
    
    applyBackgroundState(sectionIdentifier, state, options = {}) {
        if (!state) return;
        
        const section = typeof sectionIdentifier === 'object' && sectionIdentifier !== null
            ? sectionIdentifier
            : document.querySelector(`.section[data-section="${sectionIdentifier}"]`);
        
        if (!section) return;
        
        const shouldSuppress = options.skipHistory === true;
        const shouldScroll = options.shouldScroll === true;
        
        if (shouldSuppress) {
            this.suppressHistory = true;
        }
        
        section.classList.remove(...this.backgroundUtilityClasses);
        
        if (state.backgroundClasses && Array.isArray(state.backgroundClasses)) {
            state.backgroundClasses.forEach(cls => {
                if (cls && cls.trim()) {
                    section.classList.add(cls);
                }
            });
        }
        
        if (state.style && state.style.trim()) {
            section.setAttribute('style', state.style);
        } else {
            section.removeAttribute('style');
        }
        
        if (typeof state.dataBg === 'string') {
            section.setAttribute('data-bg', state.dataBg);
        } else {
            section.removeAttribute('data-bg');
        }
        
        // Restore .fp-bg element's style if it exists in state
        const fpBg = section.querySelector('.fp-bg');
        if (fpBg) {
            if (state.fpBgStyle && state.fpBgStyle.trim()) {
                fpBg.setAttribute('style', state.fpBgStyle);
            } else {
                fpBg.removeAttribute('style');
            }
        }
        
        // Restore has-bg-image and has-bg-video class state
        if (state.hasBgImageClass) {
            section.classList.add('has-bg-image');
        } else {
            section.classList.remove('has-bg-image');
        }
        
        if (state.hasBgVideoClass) {
            section.classList.add('has-bg-video');
        } else {
            section.classList.remove('has-bg-video');
        }
        
        // Restore video element if present in state
        if (fpBg && state.videoSources && state.videoSources.length > 0) {
            // Remove existing video if present
            const existingVideo = fpBg.querySelector('video');
            if (existingVideo) {
                existingVideo.remove();
            }
            
            // Create video element
            const video = document.createElement('video');
            video.className = state.videoAttributes?.className || 'absolute inset-0 w-full h-full object-cover';
            
            if (state.videoAttributes) {
                if (state.videoAttributes.loop) video.setAttribute('loop', '');
                if (state.videoAttributes.muted) video.setAttribute('muted', '');
                if (state.videoAttributes.playsinline) video.setAttribute('playsinline', '');
                if (state.videoAttributes.autoplay) video.setAttribute('autoplay', '');
                video.setAttribute('data-autoplay', '');
                video.setAttribute('data-keepplaying', '');
                video.setAttribute('allow', 'autoplay');
                video.setAttribute('onloadedmetadata', 'this.muted = true');
            } else {
                // Default attributes
                video.className = 'absolute inset-0 w-full h-full object-cover';
                video.setAttribute('loop', '');
                video.setAttribute('muted', '');
                video.setAttribute('playsinline', '');
                video.setAttribute('autoplay', '');
                video.setAttribute('data-autoplay', '');
                video.setAttribute('data-keepplaying', '');
                video.setAttribute('allow', 'autoplay');
                video.setAttribute('onloadedmetadata', 'this.muted = true');
            }
            
            // Add sources
            state.videoSources.forEach(source => {
                const sourceElement = document.createElement('source');
                sourceElement.setAttribute('src', source.src);
                if (source.type) {
                    sourceElement.setAttribute('type', source.type);
                }
                video.appendChild(sourceElement);
            });
            
            fpBg.appendChild(video);
        } else if (fpBg && (!state.videoSources || state.videoSources.length === 0)) {
            // Remove video if state indicates no video
            const existingVideo = fpBg.querySelector('video');
            if (existingVideo) {
                existingVideo.remove();
            }
        }
        
        // Update section image state to reflect .fp-bg changes
        this.updateSectionImageState(section);
        
        const sectionNumber = section.getAttribute('data-section');
        if (sectionNumber) {
            this.updateBackgroundPickerState(sectionNumber);
            this.updateButtonCircle(sectionNumber);
        }
        
        // Scroll to section if requested (for undo/redo visibility)
        if (shouldScroll) {
            section.scrollIntoView({ behavior: 'auto', block: 'center' });
        }
        
        if (shouldSuppress) {
            this.suppressHistory = false;
        }
    }
    
    // Restore background class based on data-bg attribute (used when restoring from history)
    restoreBackgroundForSection(sectionElement) {
        const bgValue = sectionElement.getAttribute('data-bg');
        if (!bgValue) return;
        
        // Remove both Tailwind arbitrary values and custom classes (including gradients)
        sectionElement.classList.remove(
            'bg-[var(--primary-bg)]', 
            'bg-[var(--secondary-bg)]', 
            'bg-[var(--accent-bg)]',
            'bg-themed-primary',
            'bg-themed-secondary',
            'bg-themed-accent',
            'gradient-themed-1',
            'gradient-themed-2',
            'bg-features2-themed'
        );
        
        // Remove all inline background styles for a clean slate
        sectionElement.style.removeProperty('background');
        sectionElement.style.removeProperty('background-color');
        sectionElement.style.removeProperty('background-image');
        
        if (bgValue === 'primary') {
            sectionElement.style.setProperty('background-color', 'var(--primary-bg)');
        } else if (bgValue === 'secondary') {
            sectionElement.style.setProperty('background-color', 'var(--secondary-bg)');
        } else if (bgValue === 'accent') {
            sectionElement.style.setProperty('background-color', 'var(--accent-bg)');
        } else if (bgValue === 'gradient-1') {
            sectionElement.style.setProperty('background', 'var(--gradient-1)');
        } else if (bgValue === 'gradient-2') {
            sectionElement.style.setProperty('background', 'var(--gradient-2)');
        } else if (bgValue === 'features2') {
            sectionElement.style.setProperty('background', 'var(--features2-bg)');
        } else if (bgValue === 'none') {
            sectionElement.style.setProperty('background', 'transparent');
        } else if (bgValue === 'default') {
            // Restore original background classes
            const originalBg = sectionElement.getAttribute('data-original-bg');
            if (originalBg && originalBg !== '') {
                const originalClasses = originalBg.split(',');
                originalClasses.forEach(className => {
                    if (className.trim()) {
                        sectionElement.classList.add(className.trim());
                    }
                });
            }
        }
        
        // Update button circle after restoring
        const sectionNumber = sectionElement.getAttribute('data-section');
        if (sectionNumber) {
            this.updateButtonCircle(sectionNumber);
        }
    }
}

// Initialize global instance (with singleton protection)
if (!window.sectionBackgroundPicker) {
    window.sectionBackgroundPicker = new SectionBackgroundPicker();
} else {
    console.log('SectionBackgroundPicker already initialized, skipping');
}

