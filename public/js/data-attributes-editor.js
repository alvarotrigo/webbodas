/**
 * Data Attributes Editor
 * Handles editing of data-* attributes on interactive elements
 * Now runs entirely in preview.html iframe for simplicity
 */

class DataAttributesEditor {
    constructor() {
        this.modal = null;
        this.currentElement = null;
        this.attributes = [];
        this.changes = {};
        
        this.init();
    }
    
    init() {
        console.log('✅ Data Attributes Editor initialized in iframe (preview.html)');
        this.setupModal();
        this.setupClickDetection();
    }
    
    /**
     * Setup modal in iframe
     */
    setupModal() {
        this.modal = document.getElementById('data-attributes-modal');
        
        if (!this.modal) {
            console.error('❌ Data Attributes Modal not found in iframe - will retry');
            // Retry after a short delay (might be a timing issue)
            setTimeout(() => {
                this.modal = document.getElementById('data-attributes-modal');
                if (this.modal) {
                    console.log('✅ Modal found on retry');
                    this.setupEventListeners();
                } else {
                    console.error('❌ Modal still not found after retry - check preview.html');
                }
            }, 100);
            return;
        }
        
        console.log('✅ Modal found immediately');
        this.setupEventListeners();
    }
    
    /**
     * Setup click detection on elements with data-group-edit
     */
    setupClickDetection() {
        document.addEventListener('click', (e) => {
            // Skip if in fullscreen preview mode
            if (this.isFullscreenMode()) {
                return;
            }
            
            // Find the closest element with data-group-edit="true"
            const targetElement = this.findGroupEditElement(e.target);
            
            if (targetElement && this.hasEditableDataAttributes(targetElement)) {
                console.log('📝 Found editable element', targetElement);
                e.preventDefault();
                e.stopPropagation();
                
                // Open modal directly (no parent window communication needed)
                this.openModal(targetElement);
            }
        }, true);
    }
    
    /**
     * Check if we're in fullscreen preview mode
     */
    isFullscreenMode() {
        return document.body.classList.contains('fullscreen-mode');
    }
    
    /**
     * Setup event listeners for modal controls
     */
    setupEventListeners() {
        // Close modal
        const closeBtn = document.getElementById('data-attributes-modal-close');
        const cancelBtn = document.getElementById('data-attributes-cancel');
        const saveBtn = document.getElementById('data-attributes-save');
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.close());
        }
        
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.save());
        }
        
        // Close on overlay click
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.close();
            }
        });
        
        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal.classList.contains('show')) {
                this.close();
            }
        });
    }
    
    /**
     * Get a selector for the element to find it later
     */
    getElementSelector(element) {
        // Try to find a unique selector
        if (element.id) {
            return `#${element.id}`;
        }
        
        if (element.className) {
            const classes = element.className.split(' ').filter(c => c.trim()).join('.');
            if (classes) {
                // Add data-section attribute if available for better specificity
                const section = element.closest('[data-section]');
                if (section) {
                    const sectionNum = section.getAttribute('data-section');
                    return `[data-section="${sectionNum}"] .${classes}`;
                }
                return `.${classes}`;
            }
        }
        
        // Fallback: use data-group-edit attribute
        return '[data-group-edit="true"]';
    }
    
    findGroupEditElement(element) {
        // Walk up the DOM tree to find element with data-group-edit="true"
        let current = element;
        let maxDepth = 10; // Prevent infinite loops
        
        while (current && maxDepth > 0) {
            if (current.dataset && current.dataset.groupEdit === 'true') {
                return current;
            }
            current = current.parentElement;
            maxDepth--;
        }
        
        return null;
    }
    
    hasEditableDataAttributes(element) {
        if (!element || !element.dataset) return false;
        
        // Check if element has data-image-* or data-description-* attributes
        // Supports both "image0" and "image-0" formats
        const keys = Object.keys(element.dataset);
        return keys.some(key => 
            /^image-?\d+$/.test(key) || /^description-?\d+$/.test(key)
        );
    }
    
    extractAttributes(element) {
        const attributes = [];
        const keys = Object.keys(element.dataset);
        
        // Group attributes by index
        const groups = {};
        
        keys.forEach(key => {
            // Match both "image0" and "image-0" formats
            const imageMatch = key.match(/^image-?(\d+)$/);
            const descriptionMatch = key.match(/^description-?(\d+)$/);
            
            if (imageMatch) {
                const index = imageMatch[1];
                if (!groups[index]) groups[index] = {};
                groups[index].image = element.dataset[key];
                groups[index].imageKey = key;
            } else if (descriptionMatch) {
                const index = descriptionMatch[1];
                if (!groups[index]) groups[index] = {};
                groups[index].description = element.dataset[key];
                groups[index].descriptionKey = key;
            }
        });
        
        // Convert to array and sort by index
        Object.keys(groups).sort((a, b) => parseInt(a) - parseInt(b)).forEach(index => {
            attributes.push({
                index: parseInt(index),
                ...groups[index]
            });
        });
        
        return attributes;
    }
    
    /**
     * Open modal for editing element
     */
    openModal(element) {
        this.currentElement = element;
        this.elementSelector = this.getElementSelector(element);
        this.attributes = this.extractAttributes(element);
        this.changes = {};
        
        if (this.attributes.length === 0) {
            console.warn('No editable attributes found');
            return;
        }
        
        console.log(`📋 Found ${this.attributes.length} editable attribute groups:`, this.attributes);
        
        this.renderTabs();
        this.renderContent();
        
        this.modal.classList.add('show');
        
        // Initialize Lucide icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
        
        // Select first tab
        this.selectTab(0);
    }
    
    renderTabs() {
        const tabsContainer = document.getElementById('data-attributes-tabs');
        if (!tabsContainer) return;
        
        tabsContainer.innerHTML = '';
        
        this.attributes.forEach((attr, index) => {
            const tab = document.createElement('button');
            tab.className = 'data-attributes-tab';
            tab.textContent = `Item ${attr.index + 1}`;
            tab.dataset.index = index;
            
            tab.addEventListener('click', () => {
                this.selectTab(index);
            });
            
            tabsContainer.appendChild(tab);
        });
    }
    
    selectTab(index) {
        // Update tab active state
        const tabs = document.querySelectorAll('.data-attributes-tab');
        tabs.forEach((tab, i) => {
            tab.classList.toggle('active', i === index);
        });
        
        // Update content active state
        const contents = document.querySelectorAll('.data-attributes-tab-content');
        contents.forEach((content, i) => {
            content.classList.toggle('active', i === index);
        });
    }
    
    renderContent() {
        const bodyContainer = document.getElementById('data-attributes-modal-body');
        if (!bodyContainer) return;
        
        bodyContainer.innerHTML = '';
        
        this.attributes.forEach((attr, index) => {
            const tabContent = document.createElement('div');
            tabContent.className = 'data-attributes-tab-content';
            tabContent.dataset.index = index;
            
            // Add image field if present
            if (attr.image !== undefined) {
                const imageField = this.createImageField(attr, index);
                tabContent.appendChild(imageField);
            }
            
            // Add description field if present
            if (attr.description !== undefined) {
                const descriptionField = this.createDescriptionField(attr, index);
                tabContent.appendChild(descriptionField);
            }
            
            bodyContainer.appendChild(tabContent);
        });
    }
    
    createImageField(attr, index) {
        const field = document.createElement('div');
        field.className = 'data-attributes-field';
        
        field.innerHTML = `
            <div class="data-attributes-image-field">
                <div class="data-attributes-image-preview" id="data-image-preview-${index}">
                    ${attr.image ? `<img src="${attr.image}" alt="Preview">` : `
                        <div class="data-attributes-image-preview-empty">
                            <i data-lucide="image"></i>
                            <span>No image</span>
                        </div>
                    `}
                </div>
                <input type="text" 
                       class="data-attributes-image-input" 
                       id="data-image-input-${index}"
                       value="${attr.image || ''}"
                       placeholder="https://example.com/image.jpg">
                <div class="data-attributes-image-actions">
                    <button class="data-attributes-btn data-attributes-btn-primary" 
                            id="data-image-edit-${index}" 
                            type="button">
                        <i data-lucide="edit"></i>
                        Upload Image
                    </button>
                </div>
            </div>
        `;
        
        // Setup image input change listener
        setTimeout(() => {
            const input = document.getElementById(`data-image-input-${index}`);
            if (input) {
                input.addEventListener('input', (e) => {
                    this.updateImagePreview(index, e.target.value);
                    this.trackChange(attr.imageKey, e.target.value);
                });
            }
            
            // Setup Cloudinary edit button
            const editBtn = document.getElementById(`data-image-edit-${index}`);
            if (editBtn) {
                editBtn.addEventListener('click', () => {
                    this.openCloudinaryEditor(index, attr);
                });
            }
        }, 0);
        
        return field;
    }
    
    createDescriptionField(attr, index) {
        const field = document.createElement('div');
        field.className = 'data-attributes-field';
        
        field.innerHTML = `
            <label class="data-attributes-label">Description</label>
            <textarea class="data-attributes-textarea" 
                      id="data-description-input-${index}"
                      placeholder="Enter description...">${attr.description || ''}</textarea>
        `;
        
        // Setup description input change listener
        setTimeout(() => {
            const textarea = document.getElementById(`data-description-input-${index}`);
            if (textarea) {
                textarea.addEventListener('input', (e) => {
                    this.trackChange(attr.descriptionKey, e.target.value);
                });
            }
        }, 0);
        
        return field;
    }
    
    updateImagePreview(index, url) {
        const preview = document.getElementById(`data-image-preview-${index}`);
        if (!preview) return;
        
        if (url) {
            preview.innerHTML = `<img src="${url}" alt="Preview">`;
        } else {
            preview.innerHTML = `
                <div class="data-attributes-image-preview-empty">
                    <i data-lucide="image"></i>
                    <span>No image</span>
                </div>
            `;
            
            // Re-initialize Lucide icons
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        }
    }
    
    openCloudinaryEditor(index, attr) {
        const currentImageUrl = document.getElementById(`data-image-input-${index}`)?.value || attr.image;
        
        console.log('📸 Opening Cloudinary editor (already loaded in iframe)');
        
        // Cloudinary is already loaded in preview.html, just use it!
        if (!window.cloudinaryImageEditor) {
            console.error('❌ Cloudinary not found (should be loaded in preview.html)');
            alert('Image editor not available');
            return;
        }
        
        // Find the original image element in the page (not the modal preview)
        const originalImageElement = this.findOriginalImageElement(attr);
        
        // Wait for initialization if needed
        if (!window.cloudinaryImageEditor.initialized && window.cloudinaryImageEditor.initPromise) {
            console.log('⏳ Waiting for Cloudinary to initialize...');
            window.cloudinaryImageEditor.initPromise.then(() => {
                this.openEditorNow(index, attr, currentImageUrl, originalImageElement);
            }).catch((error) => {
                console.error('❌ Cloudinary init failed:', error);
                alert('Failed to initialize image editor');
            });
            return;
        }
        
        // Open directly
        this.openEditorNow(index, attr, currentImageUrl, originalImageElement);
    }
    
    openEditorNow(index, attr, currentImageUrl, originalImageElement) {
        console.log('🚀 Opening Cloudinary editor...');
        
        // Store original image element for use in callback
        const originalImg = originalImageElement;
        
        if (originalImg) {
            console.log('📐 Using original image dimensions for optimization:', {
                width: originalImg.width,
                height: originalImg.height,
                naturalWidth: originalImg.naturalWidth,
                naturalHeight: originalImg.naturalHeight
            });
        } else {
            console.log('⚠️ Original image element not found, will use raw Cloudinary URL');
        }
        
        window.cloudinaryImageEditor.openEditorForDataAttribute(
            currentImageUrl,
            (editedUrl, uploadInfo) => {
                console.log('✅ Image edited:', editedUrl);
                
                // If we have the original image element and upload info,
                // generate an optimized URL based on the original image's dimensions
                let finalUrl = editedUrl;
                
                if (originalImg && uploadInfo && window.cloudinaryImageEditor) {
                    console.log('🎯 Generating optimized URL based on original image dimensions...');
                    try {
                        // Use Cloudinary's getOptimizedUrl with the original image element
                        finalUrl = window.cloudinaryImageEditor.getOptimizedUrl(uploadInfo, originalImg);
                        console.log('✅ Optimized URL generated:', finalUrl);
                    } catch (error) {
                        console.warn('⚠️ Failed to generate optimized URL, using default:', error);
                        finalUrl = editedUrl;
                    }
                } else {
                    console.log('ℹ️ Using raw Cloudinary URL (no optimization applied)');
                }
                
                const input = document.getElementById(`data-image-input-${index}`);
                if (input) {
                    input.value = finalUrl;
                    this.updateImagePreview(index, finalUrl);
                    this.trackChange(attr.imageKey, finalUrl);
                }
            },
            {
                isDataAttribute: true,
                attributeName: attr.imageKey
            }
        );
    }
    
    /**
     * Find the original image element in the page that corresponds to this data attribute
     * This ensures we use the actual page image dimensions, not the modal preview
     */
    findOriginalImageElement(attr) {
        if (!this.currentElement) return null;
        
        // Simply find the first img inside the wrapper with data attributes
        const img = this.currentElement.querySelector('img');
        
        if (img) {
            console.log('✅ Found original image element:', {
                width: img.width,
                height: img.height,
                naturalWidth: img.naturalWidth,
                naturalHeight: img.naturalHeight
            });
            return img;
        }
        
        console.log('⚠️ Could not find original image element');
        return null;
    }
    
    trackChange(key, value) {
        this.changes[key] = value;
    }
    
    save() {
        console.log('💾 Saving data attributes changes:', this.changes);
        
        // Apply changes directly to the element (we're in the same context now!)
        if (this.currentElement) {
            Object.keys(this.changes).forEach(key => {
                this.currentElement.dataset[key] = this.changes[key];
                console.log(`✅ Updated data-${key} = "${this.changes[key]}"`);
                
                // Update actual DOM elements for first image or first description
                this.updateDOMElement(key, this.changes[key]);
            });
            
            // Notify parent window that changes were made (for history/autosave)
            if (window.parent && window.parent !== window) {
                window.parent.postMessage({
                    type: 'SECTION_EDITED',
                    data: {}
                }, '*');
            }
        }
        
        this.close();
    }
    
    /**
     * Update actual DOM elements when first image or description is changed
     */
    updateDOMElement(key, value) {
        if (!this.currentElement) return;
        
        // Check if this is the first image (data-image-0 or data-image0)
        if (/^image-?0$/.test(key)) {
            console.log('🖼️ Updating first image in DOM');
            const img = this.currentElement.querySelector('img');
            if (img) {
                img.src = value;
                console.log(`✅ Updated <img> src to: ${value}`);
            } else {
                console.warn('⚠️ No <img> element found to update');
            }
        }
        
        // Check if this is the first description (data-description-0 or data-description0)
        if (/^description-?0$/.test(key)) {
            console.log('📝 Updating first description in DOM');
            
            // Try to find text element - common patterns in sections
            let textElement = this.currentElement.querySelector('p, .text, .description, span');
            
            // If we found multiple, try to be smarter about which one to update
            if (textElement) {
                textElement.textContent = value;
                console.log(`✅ Updated text element to: ${value}`);
            } else {
                console.warn('⚠️ No text element found to update');
            }
        }
    }
    
    close() {
        this.modal.classList.remove('show');
        this.currentElement = null;
        this.elementSelector = null;
        this.attributes = [];
        this.changes = {};
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('🚀 Initializing Data Attributes Editor...');
        window.dataAttributesEditor = new DataAttributesEditor();
    });
} else {
    console.log('🚀 Initializing Data Attributes Editor...');
    window.dataAttributesEditor = new DataAttributesEditor();
}
