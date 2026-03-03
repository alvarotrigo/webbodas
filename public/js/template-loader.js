/**
 * TemplateLoader - Loads and parses full HTML page templates
 * Extracts sections from HTML templates and loads them into the editor
 */
class TemplateLoader {
    constructor() {
        this.manifest = null;
        this.templates = [];
    }

    /**
     * Load the templates manifest file
     * @returns {Promise<Object>} The manifest data
     */
    async loadManifest() {
        try {
            const response = await fetch('templates/templates-manifest.json');
            if (!response.ok) {
                throw new Error(`Failed to load manifest: ${response.statusText}`);
            }
            this.manifest = await response.json();
            this.templates = this.manifest.templates || [];
            console.log('Templates loaded:', this.templates);
            return this.manifest;
        } catch (error) {
            console.error('Error loading templates manifest:', error);
            console.error('Error details:', error);
            throw error;
        }
    }

    /**
     * Get all available templates
     * @returns {Array} List of templates
     */
    getTemplates() {
        return this.templates;
    }

    /**
     * Get a specific template by ID
     * @param {string} templateId - The template ID
     * @returns {Object|null} The template object or null if not found
     */
    getTemplateById(templateId) {
        return this.templates.find(t => t.id === templateId) || null;
    }

    /**
     * Get CSS class names (without leading dot) that have background-image or background with url() in the given CSS text.
     * @param {string} css - CSS content
     * @returns {string[]}
     */
    getCssClassesWithBackgroundImage(css) {
        const classes = [];
        const re = /\.([a-zA-Z0-9_-]+)\s*\{[^}]*url\s*\(/gs;
        let m;
        while ((m = re.exec(css)) !== null) {
            classes.push(m[1]);
        }
        return [...new Set(classes)];
    }

    /**
     * Normalize a section/footer to .fp-bg and data-bg so the editor detects background images.
     * - If section has inline background image -> set data-bg="true".
     * - If a direct child has inline bg image or a class that has bg image in CSS -> add class "fp-bg" to that child and "has-bg-image" to the section.
     * @param {Element} section - section or footer element
     * @param {Set<string>|string[]} cssClassesWithBg - class names that have background image in CSS
     */
    normalizeSectionBackground(section, cssClassesWithBg) {
        const tag = section.tagName.toLowerCase();
        if (tag !== 'section' && tag !== 'footer') return;
        if (section.getAttribute('data-bg') === 'true') return;
        const hasFpBg = section.querySelector('.fp-bg');
        if (hasFpBg) return;

        const sectionStyle = (section.getAttribute('style') || '').trim();
        if (sectionStyle && /url\s*\(/i.test(sectionStyle)) {
            section.setAttribute('data-bg', 'true');
            return;
        }

        const set = cssClassesWithBg instanceof Set ? cssClassesWithBg : new Set(cssClassesWithBg);

        for (const child of section.children) {
            const childStyle = (child.getAttribute('style') || '').trim();
            if (childStyle && /url\s*\(/i.test(childStyle)) {
                child.classList.add('fp-bg');
                section.classList.add('has-bg-image');
                return;
            }
            const childClasses = (child.getAttribute('class') || '').split(/\s+/).filter(Boolean);
            if (childClasses.some(c => set.has(c))) {
                child.classList.add('fp-bg');
                section.classList.add('has-bg-image');
                return;
            }
        }
    }

    /**
     * Parse HTML string and extract section/footer elements.
     * Normalizes each section/footer to .fp-bg and data-bg so the editor detects background images.
     * @param {string} htmlString - The HTML content to parse
     * @returns {Array} Array of section objects with html and metadata
     */
    parseSectionsFromHtml(htmlString) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, 'text/html');

        const cssClassesWithBg = new Set();
        doc.querySelectorAll('style').forEach(styleEl => {
            this.getCssClassesWithBackgroundImage(styleEl.textContent || '').forEach(c => cssClassesWithBg.add(c));
        });

        const elements = doc.querySelectorAll('section, footer');
        elements.forEach(el => this.normalizeSectionBackground(el, cssClassesWithBg));

        return Array.from(elements).map((el, index) => ({
            html: el.outerHTML,
            index: index,
            type: el.tagName.toLowerCase(),
            id: el.id || `section-${index}`
        }));
    }

    /**
     * Load a template by ID
     * @param {string} templateId - The template ID to load
     * @returns {Promise<Array>} Array of parsed sections
     */
    async loadTemplate(templateId) {
        const template = this.getTemplateById(templateId);

        if (!template) {
            throw new Error(`Template not found: ${templateId}`);
        }

        try {
            // Fetch the HTML file (use relative path)
            const response = await fetch(template.file);
            if (!response.ok) {
                throw new Error(`Failed to load template file: ${response.statusText}`);
            }

            const htmlContent = await response.text();

            // Parse and extract sections
            const sections = this.parseSectionsFromHtml(htmlContent);

            return sections;
        } catch (error) {
            console.error('Error loading template:', error);
            throw error;
        }
    }

    /**
     * Load a template and add all sections to the preview
     * @param {string} templateId - The template ID to load
     * @param {Object} options - Loading options
     * @param {Function} options.onProgress - Progress callback (current, total)
     * @param {Function} options.beforeLoad - Called before loading starts
     * @param {Function} options.afterLoad - Called after loading completes
     * @returns {Promise<Object>} Result object with sections count
     */
    async loadTemplateToPreview(templateId, options = {}) {
        const {
            onProgress = null,
            beforeLoad = null,
            afterLoad = null
        } = options;

        try {
            const template = this.getTemplateById(templateId);
            if (!template) {
                throw new Error(`Template not found: ${templateId}`);
            }

            // Call beforeLoad hook
            if (beforeLoad) {
                await beforeLoad();
            }

            const iframe = document.getElementById('preview-iframe');
            if (!iframe || !iframe.contentWindow) {
                throw new Error('Preview iframe not found');
            }

            // Clear existing sections and template assets
            iframe.contentWindow.postMessage({
                type: 'CLEAR_ALL',
                data: {}
            }, '*');

            await new Promise(resolve => setTimeout(resolve, 100));

            // Inject template styles and theme class (before sections so CSS is ready)
            if (template.css || template.themeClass) {
                iframe.contentWindow.postMessage({
                    type: 'SET_TEMPLATE_STYLES',
                    data: {
                        cssUrl: template.css || null,
                        themeClass: template.themeClass || null,
                        styleHrefs: template.styleHrefs || []
                    }
                }, '*');
            }

            // Load template sections from dist (template.file points to dist/index.html after build)
            const sections = await this.loadTemplate(templateId);
            if (!sections || sections.length === 0) {
                throw new Error('No sections found in template');
            }

            for (let i = 0; i < sections.length; i++) {
                const section = sections[i];
                if (onProgress) {
                    onProgress(i + 1, sections.length);
                }
                iframe.contentWindow.postMessage({
                    type: 'ADD_PARSED_SECTION',
                    data: {
                        html: section.html,
                        index: section.index,
                        skipTinyMCE: false
                    }
                }, '*');
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            // Inject template scripts after sections exist
            if (template.js || (template.scriptSrcs && template.scriptSrcs.length > 0)) {
                iframe.contentWindow.postMessage({
                    type: 'SET_TEMPLATE_SCRIPTS',
                    data: {
                        jsUrl: template.js || null,
                        scriptSrcs: template.scriptSrcs || []
                    }
                }, '*');
            }

            if (afterLoad) {
                await afterLoad();
            }

            return {
                success: true,
                sectionsLoaded: sections.length,
                templateId: templateId
            };
        } catch (error) {
            console.error('Error loading template to preview:', error);
            throw error;
        }
    }
}

// Export for use in app.js
if (typeof window !== 'undefined') {
    window.TemplateLoader = TemplateLoader;
}
