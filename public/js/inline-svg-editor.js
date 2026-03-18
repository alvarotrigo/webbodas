/**
 * Inline SVG Editor
 * Allows users to replace SVG icons by selecting from a visual icon picker.
 * - Click-to-edit interface for any SVG inside a section
 * - Category tabs + search powered by lucide-icons.json + Iconify
 * - Live preview of selected icon
 * - Preserves styling and dimensions from the original SVG
 * - Undo/redo support via history manager
 */

class InlineSVGEditor {
    constructor() {
        this.currentSVG = null;
        this.selectedIconId = null;
        this.iconRegistry = null;       // cached from lucide-icons.json
        this.registryLoadPromise = null; // deduplicates concurrent fetches
        this.init();
    }

    init() {
        console.log('🎨 SVG Editor: Initializing');
        this.setupEventListeners();
        this.setupMessageListeners();
        // Pre-fetch registry in background so the modal opens faster
        this.loadIconRegistry();
    }

    // ─── Icon Registry ────────────────────────────────────────────────────────

    /**
     * Load and cache the lucide-icons.json registry.
     * Returns a Promise that resolves with the icon array.
     */
    loadIconRegistry() {
        if (this.iconRegistry) return Promise.resolve(this.iconRegistry);
        if (this.registryLoadPromise) return this.registryLoadPromise;

        this.registryLoadPromise = fetch('./public/data/lucide-icons.json')
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then(data => {
                this.iconRegistry = data;
                console.log('[SVGEditor] Loaded', data.length, 'icons from registry');
                return data;
            })
            .catch(err => {
                console.error('[SVGEditor] Failed to load icon registry:', err);
                this.registryLoadPromise = null;
                return [];
            });

        return this.registryLoadPromise;
    }

    // ─── Category Mapping ─────────────────────────────────────────────────────

    /**
     * Featured wedding-curated icon IDs shown in the first tab.
     */
    getFeaturedIds() {
        return new Set([
            'lucide:heart', 'lucide:flower-2', 'lucide:camera', 'lucide:map-pinned',
            'lucide:calendar', 'lucide:clock-3', 'lucide:mail', 'lucide:phone',
            'lucide:gift', 'lucide:music', 'lucide:cake', 'lucide:car',
            'lucide:plane', 'lucide:hotel', 'lucide:church', 'lucide:circle-dot',
            'lucide:users', 'lucide:image', 'lucide:navigation', 'lucide:sparkles',
            'lucide:rose', 'lucide:ribbon', 'lucide:crown', 'lucide:gem',
            'lucide:champagne', 'lucide:wine', 'lucide:star', 'lucide:diamond',
            'lucide:handshake', 'lucide:hand-heart'
        ]);
    }

    /**
     * Map Lucide categories into grouped tabs matching the emoji modal structure.
     * Each group maps tab label → array of raw Lucide category strings.
     */
    getCategoryGroups() {
        return {
            'People':           ['people', 'social', 'account', 'emoji'],
            'Animals & Nature': ['animals', 'nature', 'seasons', 'weather', 'sustainability'],
            'Food & Drink':     ['food-beverage'],
            'Activity':         ['sports', 'gaming', 'multimedia'],
            'Travel & Places':  ['travel', 'transportation', 'maps', 'navigation', 'buildings'],
            'Objects':          ['home', 'furniture', 'tools', 'devices', 'design', 'photography', 'shopping', 'files', 'money', 'currency'],
            'Symbols':          ['shapes', 'math', 'accessibility', 'arrows', 'cursors', 'layout', 'text-formatting'],
            'Communication':    ['communication', 'connectivity', 'mail', 'notifications', 'security'],
        };
    }

    /**
     * Build category lookup: iconId → first matched tab label.
     * Icons not matching any group appear only under "All".
     */
    buildCategoryLookup(registry) {
        const groups = this.getCategoryGroups();
        // Invert: rawCategory → tabLabel
        const rawToTab = {};
        for (const [tab, raws] of Object.entries(groups)) {
            for (const raw of raws) {
                rawToTab[raw] = tab;
            }
        }
        const lookup = {};
        for (const icon of registry) {
            for (const cat of (icon.categories || [])) {
                const tab = rawToTab[cat];
                if (tab && !lookup[icon.id]) {
                    lookup[icon.id] = tab;
                }
            }
        }
        return lookup;
    }

    // ─── Search ───────────────────────────────────────────────────────────────

    norm(s) {
        return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    }

    scoreIcon(icon, q) {
        if (!q) return 100;
        const ql = this.norm(q);
        const name = this.norm(icon.name);
        const label = icon.label ? this.norm(icon.label) : '';
        if (name === ql) return 100;
        if (label === ql) return 95;
        if (name.startsWith(ql)) return 80;
        if (label.startsWith(ql)) return 75;
        if (name.includes(ql)) return 60;
        if (label.includes(ql)) return 55;
        if (icon.tags && icon.tags.some(t => this.norm(t) === ql)) return 50;
        if (icon.tags && icon.tags.some(t => this.norm(t).startsWith(ql))) return 40;
        if (icon.tags && icon.tags.some(t => this.norm(t).includes(ql))) return 30;
        if (icon.categories && icon.categories.some(c => this.norm(c).includes(ql))) return 20;
        return 0;
    }

    filterIcons(registry, query, activeTab, categoryLookup) {
        const featuredIds = this.getFeaturedIds();
        const q = (query || '').trim();

        const scored = registry.map(icon => {
            let score = this.scoreIcon(icon, q);
            if (score === 0) return null;

            // Tab filter
            if (activeTab === 'Wedding') {
                if (!featuredIds.has(icon.id)) return null;
            } else if (activeTab !== 'All') {
                if (categoryLookup[icon.id] !== activeTab) return null;
            }

            return { icon, score };
        }).filter(Boolean);

        return scored
            .sort((a, b) => b.score - a.score)
            .map(x => x.icon);
    }

    // ─── Event Listeners ──────────────────────────────────────────────────────

    setupEventListeners() {
        document.addEventListener('click', (e) => {
            if (document.body.classList.contains('fullscreen-mode')) return;

            const svg = e.target.closest('svg');
            if (svg && svg.closest('section') && !svg.closest('.section-menu') && !svg.closest('.tox-tinymce')) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                this.openEditModal(svg);
            }
        }, true);
    }

    setupMessageListeners() {
        window.addEventListener('message', (event) => {
            if (event.data.type === 'APPLY_INLINE_SVG_STATE') {
                const { sectionNumber, svgUid, state, shouldScroll } = event.data.data;
                this.applyState(sectionNumber, svgUid, state, shouldScroll);
            }
        });
    }

    // ─── Modal ────────────────────────────────────────────────────────────────

    /**
     * Open the icon picker modal for a clicked SVG.
     */
    openEditModal(svg) {
        console.log('🎨 SVG Editor: Opening icon picker for', svg);
        this.currentSVG = svg;
        this.selectedIconId = null;

        // Show modal shell immediately (with loading state), then populate
        const overlay = document.createElement('div');
        overlay.className = 'svg-edit-modal-overlay modal-overlay';

        const modal = document.createElement('div');
        modal.className = 'svg-edit-modal fp-ui-theme fp-keep-color';

        modal.innerHTML = `
            <h2>
                Change Icon
                <button type="button" class="close-btn" aria-label="Close">&times;</button>
            </h2>
            <div class="svg-edit-content">
                <!-- Preview panel -->
                <div class="svg-preview-section">
                    <h3>Preview</h3>
                    <div class="svg-preview-container" id="svg-icon-preview">
                        ${this.getSVGOuterHTML(svg)}
                    </div>
                </div>
                <!-- Picker panel -->
                <div class="svg-picker-section">
                    <div class="svg-search-wrapper">
                        <input
                            type="text"
                            id="svg-search-input"
                            class="svg-search-input"
                            placeholder="Search icons..."
                            autocomplete="off"
                            spellcheck="false"
                        />
                    </div>
                    <div class="svg-category-tabs" id="svg-category-tabs">
                        <div class="svg-tabs-loading">Loading…</div>
                    </div>
                    <div class="svg-icon-grid" id="svg-icon-grid">
                        <div class="svg-icon-grid-loading">Loading icons…</div>
                    </div>
                </div>
            </div>
            <div class="svg-modal-actions">
                <button type="button" class="svg-modal-btn cancel">Cancel</button>
                <button type="button" class="svg-modal-btn apply" disabled>Apply</button>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Wire close / ESC / overlay-click
        let mouseDownTarget = null;
        const applyBtn = modal.querySelector('.svg-modal-btn.apply');
        const cancelBtn = modal.querySelector('.svg-modal-btn.cancel');
        const closeBtn = modal.querySelector('.close-btn');

        const closeModal = () => {
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            document.removeEventListener('keydown', handleEscKey);
            overlay.removeEventListener('mousedown', handleMouseDown);
        };
        const handleMouseDown = (e) => { mouseDownTarget = e.target; };
        const handleEscKey = (e) => { if (e.key === 'Escape') closeModal(); };

        cancelBtn.addEventListener('click', closeModal);
        closeBtn.addEventListener('click', closeModal);
        document.addEventListener('keydown', handleEscKey);
        overlay.addEventListener('mousedown', handleMouseDown);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay && mouseDownTarget === overlay) closeModal();
            mouseDownTarget = null;
        });
        modal.addEventListener('click', (e) => e.stopPropagation());

        applyBtn.addEventListener('click', () => {
            if (this.selectedIconId) {
                this.applyFromIconId(svg, this.selectedIconId);
                closeModal();
            }
        });

        // Populate with registry data
        this.loadIconRegistry().then(registry => {
            if (!registry.length) {
                modal.querySelector('#svg-icon-grid').innerHTML =
                    '<div class="svg-icon-grid-empty">Could not load icon library.</div>';
                return;
            }
            this.populatePicker(modal, registry, applyBtn, svg);
        });
    }

    /**
     * Populate the category tabs and icon grid once registry is loaded.
     */
    populatePicker(modal, registry, applyBtn, originalSVG) {
        const categoryLookup = this.buildCategoryLookup(registry);
        const tabLabels = ['All', 'Wedding', ...Object.keys(this.getCategoryGroups())];

        let activeTab = 'All';
        let searchQuery = '';

        const tabsContainer = modal.querySelector('#svg-category-tabs');
        const grid = modal.querySelector('#svg-icon-grid');
        const searchInput = modal.querySelector('#svg-search-input');
        const previewContainer = modal.querySelector('#svg-icon-preview');

        // Build tabs
        tabsContainer.innerHTML = tabLabels.map((label, i) => `
            <button type="button"
                class="svg-category-tab${i === 0 ? ' active' : ''}"
                data-tab="${this.escapeHTML(label)}"
            >${this.escapeHTML(label)}</button>
        `).join('');

        const renderGrid = () => {
            const filtered = this.filterIcons(registry, searchQuery, activeTab, categoryLookup);
            if (!filtered.length) {
                grid.innerHTML = '<div class="svg-icon-grid-empty">No icons found</div>';
                return;
            }
            grid.innerHTML = filtered.map(icon => `
                <button
                    type="button"
                    class="svg-icon-card${icon.id === this.selectedIconId ? ' selected' : ''}"
                    data-icon-id="${this.escapeHTML(icon.id)}"
                    title="${this.escapeHTML(icon.label || icon.name)}"
                    aria-label="${this.escapeHTML(icon.label || icon.name)}"
                >
                    <span class="iconify" data-icon="${this.escapeHTML(icon.id)}" data-width="24" data-height="24"></span>
                </button>
            `).join('');

            // Ask Iconify to render all spans in the grid
            if (window.Iconify) Iconify.scan(grid);

            // Wire click listeners on grid cards
            grid.querySelectorAll('.svg-icon-card').forEach(card => {
                card.addEventListener('click', () => {
                    const id = card.dataset.iconId;
                    this.selectedIconId = id;
                    applyBtn.disabled = false;

                    // Highlight selected
                    grid.querySelectorAll('.svg-icon-card').forEach(c => c.classList.remove('selected'));
                    card.classList.add('selected');

                    // Update preview
                    this.updatePreview(previewContainer, id, originalSVG);
                });
            });
        };

        // Wire tab clicks
        tabsContainer.addEventListener('click', (e) => {
            const tab = e.target.closest('.svg-category-tab');
            if (!tab) return;
            activeTab = tab.dataset.tab;
            tabsContainer.querySelectorAll('.svg-category-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            searchInput.value = '';
            searchQuery = '';
            renderGrid();
        });

        // Wire search
        let debounceTimer;
        searchInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                searchQuery = searchInput.value;
                // Reset to All when searching
                if (searchQuery) {
                    activeTab = 'All';
                    tabsContainer.querySelectorAll('.svg-category-tab').forEach(t => t.classList.remove('active'));
                    const allTab = tabsContainer.querySelector('[data-tab="All"]');
                    if (allTab) allTab.classList.add('active');
                }
                renderGrid();
            }, 200);
        });

        // Initial render
        renderGrid();

        // Focus search
        setTimeout(() => searchInput.focus(), 100);
    }

    /**
     * Update the preview panel with the selected icon.
     */
    updatePreview(previewContainer, iconId, originalSVG) {
        const svgEl = window.Iconify ? Iconify.renderSVG(iconId, { width: 96, height: 96 }) : null;
        if (svgEl) {
            const styled = this.createStyledSVG(svgEl, originalSVG);
            // Override size for preview display
            styled.setAttribute('width', '96');
            styled.setAttribute('height', '96');
            previewContainer.innerHTML = '';
            previewContainer.appendChild(styled);
        } else {
            // Fallback: use iconify span (will render async)
            previewContainer.innerHTML = `<span class="iconify" data-icon="${this.escapeHTML(iconId)}" data-width="96" data-height="96"></span>`;
            if (window.Iconify) Iconify.scan(previewContainer);
        }
    }

    // ─── Apply ────────────────────────────────────────────────────────────────

    /**
     * Render selected icon via Iconify, style it, and replace the original SVG in DOM.
     */
    applyFromIconId(originalSVG, iconId) {
        console.log('🎨 SVG Editor: Applying icon', iconId);

        const svgEl = window.Iconify ? Iconify.renderSVG(iconId, { width: 24, height: 24 }) : null;
        if (!svgEl) {
            console.error('SVG Editor: Iconify.renderSVG returned null for', iconId);
            return;
        }

        const svgCode = svgEl.outerHTML;
        this.applySVGChange(originalSVG, svgCode);
    }

    /**
     * Apply the SVG change (accepts raw SVG HTML string).
     */
    applySVGChange(originalSVG, newSVGCode) {
        console.log('🎨 SVG Editor: Applying SVG change');

        const section = originalSVG.closest('.section');
        const sectionNumber = section ? section.getAttribute('data-section') : null;

        const previousState = this.captureSVGState(originalSVG);

        const temp = document.createElement('div');
        temp.innerHTML = newSVGCode.trim();
        const newSVG = temp.querySelector('svg');

        if (!newSVG) {
            console.error('SVG Editor: Failed to parse new SVG');
            return;
        }

        const styledSVG = this.createStyledSVG(newSVG, originalSVG);

        if (originalSVG.hasAttribute('data-svg-uid')) {
            styledSVG.setAttribute('data-svg-uid', originalSVG.getAttribute('data-svg-uid'));
        } else {
            const uid = this.getSVGUid(originalSVG);
            styledSVG.setAttribute('data-svg-uid', uid);
        }

        originalSVG.parentNode.replaceChild(styledSVG, originalSVG);

        const nextState = this.captureSVGState(styledSVG);

        if (sectionNumber) {
            this.emitSVGChangeCommand(sectionNumber, styledSVG, previousState, nextState);
        }

        console.log('🎨 SVG Editor: SVG updated successfully');
    }

    // ─── SVG Helpers ──────────────────────────────────────────────────────────

    getSVGOuterHTML(svg) {
        const temp = document.createElement('div');
        temp.appendChild(svg.cloneNode(true));
        return temp.innerHTML;
    }

    createStyledSVG(newSVG, originalSVG) {
        const styledSVG = newSVG.cloneNode(true);

        if (originalSVG.className && originalSVG.className.baseVal) {
            styledSVG.setAttribute('class', originalSVG.className.baseVal);
        }
        if (originalSVG.getAttribute('style')) {
            styledSVG.setAttribute('style', originalSVG.getAttribute('style'));
        }
        if (originalSVG.hasAttribute('width')) {
            styledSVG.setAttribute('width', originalSVG.getAttribute('width'));
        }
        if (originalSVG.hasAttribute('height')) {
            styledSVG.setAttribute('height', originalSVG.getAttribute('height'));
        }

        this.ensureCurrentColor(styledSVG);
        this.normalizeViewBox(styledSVG);

        return styledSVG;
    }

    ensureCurrentColor(svg) {
        svg.querySelectorAll('[stroke]').forEach(el => {
            const stroke = el.getAttribute('stroke');
            if (stroke && stroke !== 'none' && stroke !== 'currentColor') {
                el.setAttribute('stroke', 'currentColor');
            }
        });
        svg.querySelectorAll('[fill]').forEach(el => {
            const fill = el.getAttribute('fill');
            if (fill && fill !== 'none' && fill !== 'currentColor') {
                el.setAttribute('fill', 'currentColor');
            }
        });
    }

    normalizeViewBox(svg) {
        if (!svg.hasAttribute('viewBox')) {
            const width = svg.getAttribute('width') || '24';
            const height = svg.getAttribute('height') || '24';
            svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        }
    }

    captureSVGState(svg) {
        return {
            outerHTML: this.getSVGOuterHTML(svg),
            className: svg.className.baseVal || '',
            style: svg.getAttribute('style') || '',
            width: svg.getAttribute('width') || '',
            height: svg.getAttribute('height') || ''
        };
    }

    getSVGUid(svg) {
        let uid = svg.getAttribute('data-svg-uid');
        if (!uid) {
            uid = 'svg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
            svg.setAttribute('data-svg-uid', uid);
        }
        return uid;
    }

    emitSVGChangeCommand(sectionNumber, svg, beforeState, afterState) {
        if (!window.parent || window.parent === window || !window.parent.postMessage) return;

        const svgUid = this.getSVGUid(svg);

        window.parent.postMessage({
            type: 'COMMAND_INLINE_SVG_CHANGE',
            data: {
                sectionNumber,
                svgUid,
                beforeState,
                afterState,
                label: 'Icon changed'
            }
        }, '*');
    }

    applyState(sectionNumber, svgUid, state, shouldScroll = false) {
        console.log('🎨 Applying SVG state:', { sectionNumber, svgUid, state });

        const section = document.querySelector(`.section[data-section="${sectionNumber}"]`);
        if (!section) {
            console.warn(`SVG Editor: Section ${sectionNumber} not found`);
            return;
        }

        const svg = section.querySelector(`svg[data-svg-uid="${svgUid}"]`);
        if (!svg) {
            console.warn(`SVG Editor: SVG with UID ${svgUid} not found in section ${sectionNumber}`);
            return;
        }

        const temp = document.createElement('div');
        temp.innerHTML = state.outerHTML;
        const newSVG = temp.querySelector('svg');

        if (!newSVG) {
            console.error('SVG Editor: Failed to parse SVG state');
            return;
        }

        newSVG.setAttribute('data-svg-uid', svgUid);
        svg.parentNode.replaceChild(newSVG, svg);

        if (shouldScroll && section) {
            section.scrollIntoView({ behavior: 'auto', block: 'center' });
        }

        console.log('🎨 SVG state applied successfully');
    }

    // ─── Utility ──────────────────────────────────────────────────────────────

    escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    }
}

// Initialize global instance (singleton protection)
if (!window.inlineSVGEditor) {
    window.inlineSVGEditor = new InlineSVGEditor();
    console.log('🎨 SVG Editor: Initialized');
} else {
    console.log('🎨 SVG Editor: Already initialized, skipping');
}

// ─── [DISABLED_FOR_WEDDING_VERSION]: Old textarea-based modal code removed.
// The openEditModal() previously showed a textarea where users could paste raw SVG code.
// It has been replaced by the visual icon picker (see populatePicker() above).
// The code below was the old implementation kept for reference:
//
// openEditModal(svg) {
//     modal.innerHTML = `
//         ...
//         <!-- Code Input Section -->
//         <div class="svg-code-section">
//             <label for="svg-code-input">Paste SVG Code:</label>
//             <textarea id="svg-code-input" class="svg-code-textarea" ...>${currentSVGCode}</textarea>
//             <div id="svg-error-message" class="svg-error-message"></div>
//         </div>
//         ...
//         <!-- Helper Text -->
//         <div class="svg-helper-text">
//             <h4>Find SVG Icons</h4>
//             <div class="svg-helper-sites">
//                 <a href="https://heroicons.com/" ...>Heroicons</a>
//                 <a href="https://lucide.dev/" ...>Lucide</a>
//                 <a href="https://www.svgrepo.com/" ...>SVGRepo</a>
//                 <a href="https://simpleicons.org/" ...>Simple Icons</a>
//             </div>
//         </div>
//     `;
//     // textarea.addEventListener('input', () => { validateAndPreviewSVG(...) });
// }
//
// validateAndPreviewSVG(code, previewContainer, originalSVG) { ... }
