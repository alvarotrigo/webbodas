/**
 * AI Image Replacer
 * Handles automatic image replacement with Unsplash images based on AI-generated keywords
 * Only processes sections that have images or background-image properties
 */

(function() {
    'use strict';

    /**
     * Replace images in sections with Unsplash images based on AI-generated keywords
     * @param {Array<string>} sectionIds - Array of section IDs to process
     * @param {string} creativeBrief - The creative brief for context
     */
    async function replaceImagesWithUnsplash(sectionIds, creativeBrief) {
        if (!sectionIds || sectionIds.length === 0) {
            console.log('🖼️ No sections to process for image replacement');
            return;
        }

        const iframe = document.getElementById('preview-iframe');
        if (!iframe || !iframe.contentWindow) {
            console.error('🖼️ Preview iframe not found');
            return;
        }

        console.log('🖼️ Starting AI-powered image replacement for', sectionIds.length, 'sections...');

        // Filter sections to only those with images or background images
        const sectionsWithImages = await filterSectionsWithImages(sectionIds, iframe);
        
        if (sectionsWithImages.length === 0) {
            console.log('🖼️ No sections with images found');
            return;
        }

        console.log(`🖼️ Found ${sectionsWithImages.length} sections with images to process`);

        // Process all sections in parallel
        const sectionPromises = sectionsWithImages.map(sectionData => 
            processSectionImages(sectionData, creativeBrief, iframe)
        );

        // Wait for all sections to complete
        await Promise.allSettled(sectionPromises);

        console.log('🖼️ Image replacement completed');
    }

    /**
     * Filter sections to only those that have images or background images
     * @param {Array<string>} sectionIds - Array of section IDs
     * @param {HTMLIFrameElement} iframe - Preview iframe element
     * @returns {Promise<Array>} Array of section data with images
     */
    async function filterSectionsWithImages(sectionIds, iframe) {
        const sectionsWithImages = [];
        const iframeWindow = iframe.contentWindow;
        const iframeDocument = iframe.contentWindow.document;

        for (const sectionId of sectionIds) {
            const section = window.sections?.find(s => s.id === sectionId);
            if (!section) continue;

            // Get section element from preview iframe
            const sectionElement = iframeDocument.querySelector(
                `[data-section="${sectionId}"]`
            );
            
            if (!sectionElement) continue;

            // Check for regular images
            const images = sectionElement.querySelectorAll('img');
            
            // Check for background images (pass iframe window for getComputedStyle)
            const hasBackgroundImage = checkForBackgroundImages(sectionElement, iframeWindow);

            if (images.length > 0 || hasBackgroundImage) {
                sectionsWithImages.push({
                    sectionId,
                    section,
                    sectionElement,
                    images: Array.from(images),
                    hasBackgroundImage
                });
            }
        }

        return sectionsWithImages;
    }

    /**
     * Check if section has background images
     * @param {HTMLElement} sectionElement - Section element
     * @param {Window} iframeWindow - Iframe window object for getComputedStyle
     * @returns {boolean}
     */
    function checkForBackgroundImages(sectionElement, iframeWindow) {
        // Check the section element itself
        const sectionStyle = iframeWindow.getComputedStyle(sectionElement);
        if (sectionStyle.backgroundImage && sectionStyle.backgroundImage !== 'none') {
            return true;
        }

        // Check all child elements
        const allElements = sectionElement.querySelectorAll('*');
        for (const element of allElements) {
            const style = iframeWindow.getComputedStyle(element);
            if (style.backgroundImage && style.backgroundImage !== 'none') {
                return true;
            }
        }

        return false;
    }

    /**
     * Process images for a single section
     * @param {Object} sectionData - Section data object
     * @param {string} creativeBrief - Creative brief
     * @param {HTMLIFrameElement} iframe - Preview iframe
     */
    async function processSectionImages(sectionData, creativeBrief, iframe) {
        const { sectionId, section, sectionElement, images, hasBackgroundImage } = sectionData;

        try {
            // Get section category
            let category = section.category;
            if (!category && section.tags && section.tags.length > 0) {
                const tagToCategory = {
                    'hero': 'hero', 'intro': 'hero',
                    'features': 'features',
                    'testimonial': 'testimonials', 'testimonials': 'testimonials',
                    'pricing': 'pricing',
                    'team': 'team',
                    'gallery': 'gallery',
                    'portfolio': 'portfolio',
                    'contact': 'contact',
                    'form': 'forms', 'forms': 'forms',
                    'about': 'about',
                    'faq': 'faqs', 'faqs': 'faqs',
                    'how-it-works': 'how it works',
                    'stats': 'stats',
                    'media': 'media',
                    'video': 'video',
                    'applications': 'applications',
                    'logo': 'logo clouds',
                    'newsletter': 'newsletter',
                    'cta': 'cta',
                    'events': 'events',
                    'comparison': 'comparison',
                    'content': 'content',
                    'footer': 'footer',
                    'blog': 'blog',
                    'integrations': 'integrations'
                };
                for (const tag of section.tags) {
                    if (tagToCategory[tag]) {
                        category = tagToCategory[tag];
                        break;
                    }
                }
            }
            category = category || 'content';

            // Extract generated text from section
            const sectionText = extractSectionText(sectionElement);

            // Load section HTML for context
            let sectionHtml = '';
            try {
                const response = await fetch(`sections/${section.file}`);
                sectionHtml = await response.text();
            } catch (error) {
                console.error(`🖼️ Error loading section HTML for ${sectionId}:`, error);
                return;
            }

            // Count total images (regular + background)
            const totalImageCount = images.length + (hasBackgroundImage ? 1 : 0);

            if (totalImageCount === 0) {
                return; // No images to replace
            }

            // Get AI-generated keywords for this section (in parallel with other sections)
            const keywordsResponse = await fetch('api/generate-image-keywords.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    section_html: sectionHtml,
                    section_text: sectionText,
                    creative_brief: creativeBrief,
                    section_category: category,
                    image_count: totalImageCount
                })
            });

            const keywordsData = await keywordsResponse.json();

            if (!keywordsData.success || !keywordsData.keywords || keywordsData.keywords.length === 0) {
                console.warn(`🖼️ No keywords generated for section ${sectionId}`);
                return;
            }

            // Process all images in parallel
            const imagePromises = [];

            // Process regular images
            for (let i = 0; i < images.length; i++) {
                const img = images[i];
                const keywordSet = keywordsData.keywords[i] || keywordsData.keywords[0]; // Fallback to first set
                
                imagePromises.push(
                    replaceImage(img, keywordSet, sectionId, i)
                );
            }

            // Process background images if any
            if (hasBackgroundImage) {
                const bgKeywordSet = keywordsData.keywords[images.length] || keywordsData.keywords[0];
                imagePromises.push(
                    replaceBackgroundImage(sectionElement, bgKeywordSet, sectionId)
                );
            }

            // Wait for all images in this section to be replaced
            await Promise.allSettled(imagePromises);

        } catch (error) {
            console.error(`🖼️ Error processing images for section ${sectionId}:`, error);
        }
    }

    /**
     * Replace a single image with Unsplash image
     * @param {HTMLImageElement} img - Image element
     * @param {Array<string>} keywordSet - Array of keywords
     * @param {string} sectionId - Section ID
     * @param {number} imageIndex - Image index
     */
    async function replaceImage(img, keywordSet, sectionId, imageIndex) {
        try {
            // Combine keywords into search query
            const searchQuery = keywordSet.join(' ');
            
            // Get image dimensions
            const rect = img.getBoundingClientRect();
            const width = Math.ceil(rect.width * 2); // 2x for retina
            const height = Math.ceil(rect.height * 2);
            
            // Get aspect ratio
            const aspectRatio = width / height;
            
            // Call API to get Unsplash image
            const unsplashResponse = await fetch('api/get-unsplash-image.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: searchQuery,
                    width: width,
                    height: height,
                    aspectRatio: aspectRatio
                })
            });
            
            const unsplashData = await unsplashResponse.json();
            
            if (unsplashData.success && unsplashData.imageUrl) {
                // Replace image src
                img.src = unsplashData.imageUrl;
                console.log(`✅ Replaced image ${imageIndex + 1} in section ${sectionId} with Unsplash: "${searchQuery}"`);
            } else {
                console.warn(`⚠️ Failed to get Unsplash image for "${searchQuery}"`);
            }
        } catch (error) {
            console.error(`🖼️ Error replacing image ${imageIndex} in section ${sectionId}:`, error);
        }
    }

    /**
     * Replace background image with Unsplash image
     * @param {HTMLElement} sectionElement - Section element
     * @param {Array<string>} keywordSet - Array of keywords
     * @param {string} sectionId - Section ID
     */
    async function replaceBackgroundImage(sectionElement, keywordSet, sectionId) {
        try {
            // Find element with background image
            const bgElement = findBackgroundImageElement(sectionElement);
            if (!bgElement) {
                console.warn(`⚠️ No background image element found in section ${sectionId}`);
                return;
            }

            // Combine keywords into search query
            const searchQuery = keywordSet.join(' ');
            
            // Get element dimensions
            const rect = bgElement.getBoundingClientRect();
            const width = Math.ceil(rect.width * 2); // 2x for retina
            const height = Math.ceil(rect.height * 2);
            
            // Get aspect ratio
            const aspectRatio = width / height;
            
            // Call API to get Unsplash image
            const unsplashResponse = await fetch('api/get-unsplash-image.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: searchQuery,
                    width: width,
                    height: height,
                    aspectRatio: aspectRatio
                })
            });
            
            const unsplashData = await unsplashResponse.json();
            
            if (unsplashData.success && unsplashData.imageUrl) {
                // Get existing background style to preserve gradients/overlays
                const existingBg = bgElement.style.background || bgElement.style.backgroundImage || '';
                
                // Extract gradient if present
                let preservedGradient = null;
                const urlSeparators = [', url(', ' url(', ',url('];
                for (const separator of urlSeparators) {
                    const urlIndex = existingBg.indexOf(separator);
                    if (urlIndex > 0) {
                        const beforeUrl = existingBg.substring(0, urlIndex).trim();
                        if (beforeUrl.includes('gradient')) {
                            preservedGradient = beforeUrl.split(/\s+(center|top|bottom|left|right|\d+%|\d+px|\/)/)[0].trim();
                            break;
                        }
                    }
                }

                // Preserve background-size and background-position
                const elementWindow = bgElement.ownerDocument.defaultView || bgElement.ownerDocument.parentWindow;
                const computedStyle = elementWindow.getComputedStyle(bgElement);
                const existingBgSize = bgElement.style.backgroundSize || computedStyle.backgroundSize || 'cover';
                const existingBgPosition = bgElement.style.backgroundPosition || computedStyle.backgroundPosition || 'center';

                // Build new background
                let newBackground;
                if (preservedGradient) {
                    newBackground = `${preservedGradient}, url('${unsplashData.imageUrl}')`;
                } else {
                    newBackground = `url('${unsplashData.imageUrl}')`;
                }

                // Update background
                bgElement.style.backgroundImage = newBackground;
                bgElement.style.backgroundSize = existingBgSize;
                bgElement.style.backgroundPosition = existingBgPosition;

                console.log(`✅ Replaced background image in section ${sectionId} with Unsplash: "${searchQuery}"`);
            } else {
                console.warn(`⚠️ Failed to get Unsplash background image for "${searchQuery}"`);
            }
        } catch (error) {
            console.error(`🖼️ Error replacing background image in section ${sectionId}:`, error);
        }
    }

    /**
     * Find element with background image
     * @param {HTMLElement} rootElement - Root element to search
     * @returns {HTMLElement|null}
     */
    function findBackgroundImageElement(rootElement) {
        // Get the window object from the element's owner document
        const elementWindow = rootElement.ownerDocument.defaultView || rootElement.ownerDocument.parentWindow;
        
        // Check root element first
        const rootStyle = elementWindow.getComputedStyle(rootElement);
        if (rootStyle.backgroundImage && rootStyle.backgroundImage !== 'none') {
            return rootElement;
        }

        // Search all children
        const allElements = rootElement.querySelectorAll('*');
        for (const element of allElements) {
            const style = elementWindow.getComputedStyle(element);
            if (style.backgroundImage && style.backgroundImage !== 'none') {
                return element;
            }
        }

        return null;
    }

    /**
     * Extract text content from section element
     * @param {HTMLElement} sectionElement - Section element
     * @returns {string}
     */
    function extractSectionText(sectionElement) {
        const textParts = [];
        
        // Get headings
        const headings = sectionElement.querySelectorAll('h1, h2, h3, h4, h5, h6');
        headings.forEach(h => {
            const text = h.textContent.trim();
            if (text) textParts.push(text);
        });
        
        // Get paragraphs
        const paragraphs = sectionElement.querySelectorAll('p');
        paragraphs.forEach(p => {
            const text = p.textContent.trim();
            if (text && text.length > 10) {
                textParts.push(text);
            }
        });
        
        // Get button text
        const buttons = sectionElement.querySelectorAll('button, a[class*="button"]');
        buttons.forEach(btn => {
            const text = btn.textContent.trim();
            if (text) textParts.push(text);
        });
        
        return textParts.join('\n');
    }

    // Expose API for external use
    window.AIImageReplacer = {
        replaceImagesWithUnsplash: replaceImagesWithUnsplash
    };

})();

