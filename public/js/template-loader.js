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
     * Builds a map of CSS class name -> background-image url() string from a CSS text.
     * Used to move CSS background-images to inline styles during normalization.
     * @param {string} css - CSS text content
     * @returns {Map<string, string>} Map of className -> url('...') string
     */
    buildBgUrlMap(css) {
        const map = new Map();
        const ruleRe = /\.([a-zA-Z0-9_-]+)\s*\{([^}]*)\}/gs;
        let m;
        while ((m = ruleRe.exec(css)) !== null) {
            const cls = m[1];
            const ruleBody = m[2];
            const urlMatch = /url\s*\(\s*(['"]?)([^'")\s]+)\1\s*\)/i.exec(ruleBody);
            if (urlMatch) {
                map.set(cls, `url('${urlMatch[2]}')`);
            }
        }
        return map;
    }

    /** Class names of loose divs that should be promoted to <section> (e.g. parallax-quote blocks). */
    static LOOSE_BLOCK_CLASSES = ['parallax-quote'];

    /**
     * Converts loose <div> elements that are direct children of <body> and siblings
     * of <section>/<footer> elements into proper <section> elements so the editor
     * recognizes them as movable, editable mini-sections. Only divs with an allowlisted
     * class (see LOOSE_BLOCK_CLASSES) are converted to avoid promoting nav wrappers, etc.
     *
     * If a converted div has a CSS class whose rule contains a background-image URL,
     * that URL is moved to an inline style so the editor's background picker can
     * detect and modify it (data-bg="true" is set by normalizeSectionBackground later).
     *
     * @param {Document} doc - The parsed document
     */
    normalizeLooseBlocksToSections(doc) {
        const body = doc.body;
        if (!body) return;

        const bodyChildren = Array.from(body.children);
        const hasSectionOrFooter = bodyChildren.some(
            el => el.tagName === 'SECTION' || el.tagName === 'FOOTER'
        );
        if (!hasSectionOrFooter) return;

        const allowlist = TemplateLoader.LOOSE_BLOCK_CLASSES;

        // Build class -> background url() map from all <style> blocks
        const bgUrlMap = new Map();
        doc.querySelectorAll('style').forEach(styleEl => {
            this.buildBgUrlMap(styleEl.textContent || '').forEach((url, cls) => {
                bgUrlMap.set(cls, url);
            });
        });

        let foundFirstSection = false;
        bodyChildren.forEach(el => {
            // Track when we've passed the first section/footer so we
            // don't accidentally promote preloaders or nav wrappers
            if (el.tagName === 'SECTION' || el.tagName === 'FOOTER') {
                foundFirstSection = true;
                return;
            }

            // Only promote divs that appear AFTER the first section/footer AND have an allowlisted class
            const hasAllowedClass = el.tagName === 'DIV' && allowlist.some(c => el.classList.contains(c));
            if (!hasAllowedClass || !foundFirstSection) return;

            // Create replacement <section> with same attributes and children
            const section = doc.createElement('section');
            Array.from(el.attributes).forEach(attr => {
                section.setAttribute(attr.name, attr.value);
            });
            while (el.firstChild) {
                section.appendChild(el.firstChild);
            }

            // If any class has a background-image in CSS, move it to inline style
            // so normalizeSectionBackground sets data-bg="true" and the editor detects it
            const classes = (el.getAttribute('class') || '').split(/\s+/).filter(Boolean);
            for (const cls of classes) {
                if (bgUrlMap.has(cls)) {
                    const existing = (section.getAttribute('style') || '').trim();
                    const sep = existing && !existing.endsWith(';') ? '; ' : '';
                    section.setAttribute('style', `${existing}${sep}background-image: ${bgUrlMap.get(cls)};`);
                    break;
                }
            }

            body.replaceChild(section, el);
            console.log(`[TemplateLoader] Loose <div.${el.className}> converted to <section>`);
        });
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

        // Convert any loose <div> siblings of sections to proper <section> elements
        // and move CSS background-image URLs to inline style for editor detection
        this.normalizeLooseBlocksToSections(doc);

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
