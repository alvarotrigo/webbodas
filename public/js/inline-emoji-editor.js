/**
 * Inline Emoji Editor
 * Allows users to replace emoji icons by clicking on them and selecting from a picker
 * - Click-to-edit interface for any element with a CSS class containing "emoji"
 * - Category tabs + search powered by TinyMCE emojis database
 * - Live preview of selected emoji
 * - Undo/redo support via history manager
 */

class InlineEmojiEditor {
    constructor() {
        this.currentElement = null;
        this.selectedEmoji = null;
        this.selectedCategoryKey = null;
        this.emojiData = null;
        this.init();
    }

    init() {
        console.log('😀 Emoji Editor: Initializing');
        this.ensureEmojiDBShim();
        this.setupEventListeners();
        this.setupMessageListeners();
    }

    /**
     * Ensure tinymce.Resource has a _data cache so we can read emojis synchronously.
     * This runs BEFORE emojis.min.js loads (script order guarantees it when defer is used).
     * We patch Resource.add to mirror registrations into _data.
     */
    ensureEmojiDBShim() {
        // Case 1: TinyMCE not loaded at all yet - create minimal stub
        if (!window.tinymce) {
            window.tinymce = {};
        }
        if (!window.tinymce.Resource) {
            window.tinymce.Resource = {
                _data: {},
                add(id, data) { this._data[id] = data; },
                get(id) { return this._data[id]; }
            };
            return;
        }

        // Case 2: TinyMCE Resource exists but lacks _data mirror
        if (!window.tinymce.Resource._data) {
            window.tinymce.Resource._data = {};
            const originalAdd = window.tinymce.Resource.add.bind(window.tinymce.Resource);
            window.tinymce.Resource.add = function(id, data) {
                window.tinymce.Resource._data[id] = data;
                originalAdd(id, data);
            };
        }
        // Case 3: _data already present (shim already installed) - nothing to do
    }

    /**
     * Load emoji data from TinyMCE resource, waiting if not yet available
     */
    getEmojiData() {
        if (this.emojiData) return this.emojiData;

        const EMOJI_DB_KEY = 'tinymce.plugins.emoticons';

        // Try direct _data access first (our shim)
        if (window.tinymce?.Resource?._data?.[EMOJI_DB_KEY]) {
            this.emojiData = window.tinymce.Resource._data[EMOJI_DB_KEY];
            return this.emojiData;
        }

        // Try TinyMCE Resource.get() method
        if (window.tinymce?.Resource?.get) {
            try {
                const data = window.tinymce.Resource.get(EMOJI_DB_KEY);
                if (data) {
                    this.emojiData = data;
                    return this.emojiData;
                }
            } catch (e) {
                // Resource.get may not be synchronous
            }
        }

        return null;
    }

    /**
     * Category name mapping (mirrors TinyMCE emoticons plugin)
     */
    getCategoryMap() {
        return {
            'people': 'People',
            'animals_and_nature': 'Animals & Nature',
            'food_and_drink': 'Food & Drink',
            'activity': 'Activity',
            'travel_and_places': 'Travel & Places',
            'objects': 'Objects',
            'symbols': 'Symbols',
            'flags': 'Flags',
            'user': 'Custom'
        };
    }

    /**
     * Convert a two-letter ISO country code to the Unicode flag emoji (regional indicators).
     * Flags in the TinyMCE database are stored as "AD", "FR", etc.; they need to be
     * converted to the actual flag character sequence for display.
     */
    countryCodeToFlag(code) {
        if (typeof code !== 'string' || code.length !== 2) return code;
        const a = code.toUpperCase().charCodeAt(0) - 0x41;
        const b = code.toUpperCase().charCodeAt(1) - 0x41;
        if (a < 0 || a > 25 || b < 0 || b > 25) return code;
        return String.fromCodePoint(0x1F1E6 + a, 0x1F1E6 + b);
    }

    /**
     * Get current emoji value from an editable element (text or flag img).
     */
    getCurrentEmojiFromElement(element) {
        if (!element) return { emojiChar: '', isFlag: false };
        const img = element.querySelector('img.emoji-flag-img');
        if (img && img.getAttribute('data-emoji-char')) {
            return { emojiChar: img.getAttribute('data-emoji-char'), isFlag: true };
        }
        const emojiChar = element.textContent?.trim() || '';
        return { emojiChar, isFlag: false };
    }

    /**
     * Get Twemoji CDN URL for an emoji character (or sequence).
     * Use this for the Flags category so flags render correctly on all platforms
     * (Windows often fails to render regional indicator pairs as actual flags).
     */
    getTwemojiUrl(emojiStr) {
        if (!emojiStr || typeof emojiStr !== 'string') return '';
        const codePoints = [];
        for (const s of emojiStr) {
            const cp = s.codePointAt(0);
            if (cp !== undefined) codePoints.push(cp.toString(16).toLowerCase());
        }
        if (!codePoints.length) return '';
        const slug = codePoints.join('-');
        return `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/${slug}.png`;
    }

    /**
     * Process raw emoji data into categorized structure.
     * Converts flag entries from two-letter codes (e.g. "FR") to Unicode flag emoji.
     */
    processEmojiData(rawData) {
        const categoryMap = this.getCategoryMap();
        const categories = {};
        const all = [];

        Object.entries(rawData).forEach(([name, entry]) => {
            const rawCat = entry.category || 'objects';
            const catKey = rawCat.toLowerCase();
            const catLabel = categoryMap[rawCat] || categoryMap[catKey] || rawCat;

            let char = entry.char;
            const isFlagsCategory = catKey === 'flags';
            const looksLikeCountryCode = typeof char === 'string' && /^[A-Za-z]{2}$/.test(char);
            const nameIsCountryCode = typeof name === 'string' && /^[A-Za-z]{2}$/.test(name);
            if (isFlagsCategory && (looksLikeCountryCode || nameIsCountryCode)) {
                char = this.countryCodeToFlag(looksLikeCountryCode ? char : name);
            }

            const item = {
                name,
                char,
                keywords: entry.keywords || [],
                category: catLabel,
                categoryKey: catKey
            };

            if (!categories[catLabel]) categories[catLabel] = [];
            categories[catLabel].push(item);
            all.push(item);
        });

        return { categories, all };
    }

    /**
     * Setup click event listeners for emoji elements
     */
    setupEventListeners() {
        document.addEventListener('click', (e) => {
            // Don't open modal in fullscreen preview mode
            if (document.body.classList.contains('fullscreen-mode')) return;

            // Find the closest element marked as editable emoji (data-emoji-edit)
            const emojiEl = e.target.closest('[data-emoji-edit]');

            if (!emojiEl) return;

            // Must be inside a section or footer
            const inSection = emojiEl.closest('section') || emojiEl.closest('footer');
            if (!inSection) return;

            // Exclude UI control areas
            if (
                emojiEl.closest('.section-menu') ||
                emojiEl.closest('.tox-tinymce') ||
                emojiEl.closest('.emoji-edit-modal') ||
                emojiEl.closest('.svg-edit-modal')
            ) return;

            // Exclude SVG elements (handled by InlineSVGEditor)
            if (emojiEl.tagName === 'svg' || emojiEl.closest('svg')) return;

            // Allow if element has text (normal emoji) or a flag image (Twemoji img)
            const hasText = (emojiEl.textContent || '').trim().length > 0;
            const hasFlagImg = !!emojiEl.querySelector('img.emoji-flag-img');
            if (!hasText && !hasFlagImg) return;

            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            this.openEditModal(emojiEl);
        }, true);
    }

    /**
     * Setup message listeners for undo/redo operations from parent window
     */
    setupMessageListeners() {
        window.addEventListener('message', (event) => {
            if (event.data.type === 'APPLY_INLINE_EMOJI_STATE') {
                const { sectionNumber, emojiUid, state, shouldScroll } = event.data.data;
                this.applyState(sectionNumber, emojiUid, state, shouldScroll);
            }
        });
    }

    /**
     * Open the emoji picker modal
     */
    openEditModal(emojiElement) {
        console.log('😀 Emoji Editor: Opening modal for', emojiElement);

        this.currentElement = emojiElement;
        const { emojiChar } = this.getCurrentEmojiFromElement(emojiElement);
        this.selectedEmoji = emojiChar;
        this.selectedCategoryKey = null;

        const rawData = this.getEmojiData();
        if (!rawData) {
            console.error('Emoji Editor: Could not load emoji database');
            return;
        }

        const { categories, all } = this.processEmojiData(rawData);
        const categoryLabels = ['All', ...Object.keys(categories)];

        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'emoji-edit-modal-overlay modal-overlay';

        // Create modal
        const modal = document.createElement('div');
        modal.className = 'emoji-edit-modal fp-ui-theme';

        modal.innerHTML = `
            <h2>
                Change Emoji
                <button type="button" class="close-btn" aria-label="Close">&times;</button>
            </h2>

            <div class="emoji-edit-content">
                <!-- Preview panel -->
                <div class="emoji-preview-section">
                    <h3>Preview</h3>
                    <div class="emoji-preview-container" id="emoji-preview">
                        ${this.renderPreviewContent(this.selectedEmoji)}
                    </div>
                </div>

                <!-- Picker panel -->
                <div class="emoji-picker-section">
                    <!-- Search -->
                    <div class="emoji-search-wrapper">
                        <input
                            type="text"
                            id="emoji-search-input"
                            class="emoji-search-input"
                            placeholder="Search emojis..."
                            autocomplete="off"
                            spellcheck="false"
                        />
                    </div>

                    <!-- Category tabs -->
                    <div class="emoji-category-tabs" id="emoji-category-tabs">
                        ${categoryLabels.map((cat, i) => `
                            <button type="button"
                                class="emoji-category-tab${i === 0 ? ' active' : ''}"
                                data-category="${this.escapeHTML(cat)}"
                            >${this.escapeHTML(cat)}</button>
                        `).join('')}
                    </div>

                    <!-- Emoji grid -->
                    <div class="emoji-grid" id="emoji-grid">
                        ${this.renderEmojiGrid(all)}
                    </div>
                </div>
            </div>

            <!-- Actions -->
            <div class="emoji-modal-actions">
                <button type="button" class="emoji-modal-btn cancel">Cancel</button>
                <button type="button" class="emoji-modal-btn apply">Apply</button>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Store data for filtering
        modal._allEmojis = all;
        modal._categories = categories;

        // Wire up interactions
        this.wireModal(overlay, modal, all, categories);
    }

    /**
     * Render the big preview content (Twemoji image so flags and all emojis display correctly).
     */
    renderPreviewContent(emojiChar) {
        if (!emojiChar) return '<span class="emoji-preview-placeholder">—</span>';
        const url = this.getTwemojiUrl(emojiChar);
        if (!url) return `<span class="emoji-preview-char">${this.escapeHTML(emojiChar)}</span>`;
        return `<img src="${this.escapeHTML(url)}" alt="" class="emoji-preview-img" loading="lazy">`;
    }

    /**
     * Render the emoji grid HTML.
     * Flags category uses Twemoji images so they display correctly on all platforms
     * (Windows often does not render regional indicator pairs as real flags).
     */
    renderEmojiGrid(emojis) {
        if (!emojis.length) {
            return '<div class="emoji-grid-empty">No emojis found</div>';
        }
        return emojis.map(item => {
            const isFlag = item.categoryKey === 'flags';
            const twemojiUrl = isFlag ? this.getTwemojiUrl(item.char) : '';
            const content = isFlag && twemojiUrl
                ? `<img src="${this.escapeHTML(twemojiUrl)}" alt="" class="emoji-grid-img" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='inline';"><span class="emoji-grid-fallback" style="display:none">${item.char}</span>`
                : item.char;
            return `
            <button
                type="button"
                class="emoji-grid-btn${item.char === this.selectedEmoji ? ' selected' : ''}"
                data-char="${this.escapeHTML(item.char)}"
                data-category-key="${this.escapeHTML(item.categoryKey)}"
                title="${this.escapeHTML(item.name)}"
                aria-label="${this.escapeHTML(item.name)}"
            >${content}</button>
        `;
        }).join('');
    }

    /**
     * Wire all modal interactions
     */
    wireModal(overlay, modal, all, categories) {
        const grid = modal.querySelector('#emoji-grid');
        const searchInput = modal.querySelector('#emoji-search-input');
        const categoryTabsContainer = modal.querySelector('#emoji-category-tabs');
        const previewContainer = modal.querySelector('#emoji-preview');
        const applyBtn = modal.querySelector('.emoji-modal-btn.apply');
        const cancelBtn = modal.querySelector('.emoji-modal-btn.cancel');
        const closeBtn = modal.querySelector('.close-btn');

        let activeCategory = 'All';
        let searchTerm = '';
        let mouseDownTarget = null;

        const getFilteredEmojis = () => {
            let list = activeCategory === 'All' ? all : (categories[activeCategory] || []);
            if (searchTerm) {
                const lower = searchTerm.toLowerCase();
                list = list.filter(item =>
                    item.name.toLowerCase().includes(lower) ||
                    item.keywords.some(k => k.toLowerCase().includes(lower))
                );
            }
            return list;
        };

        const updatePreview = () => {
            if (previewContainer) previewContainer.innerHTML = this.renderPreviewContent(this.selectedEmoji);
        };

        const rerender = () => {
            const filtered = getFilteredEmojis();
            grid.innerHTML = this.renderEmojiGrid(filtered);
            // Re-attach grid click listeners
            grid.querySelectorAll('.emoji-grid-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.selectedEmoji = btn.dataset.char;
                    this.selectedCategoryKey = btn.dataset.categoryKey || null;
                    updatePreview();
                    grid.querySelectorAll('.emoji-grid-btn').forEach(b => b.classList.remove('selected'));
                    btn.classList.add('selected');
                });
            });
        };

        // Initial grid click listeners
        grid.querySelectorAll('.emoji-grid-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectedEmoji = btn.dataset.char;
                this.selectedCategoryKey = btn.dataset.categoryKey || null;
                updatePreview();
                grid.querySelectorAll('.emoji-grid-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
            });
        });

        // Category tab clicks
        categoryTabsContainer.addEventListener('click', (e) => {
            const tab = e.target.closest('.emoji-category-tab');
            if (!tab) return;
            activeCategory = tab.dataset.category;
            categoryTabsContainer.querySelectorAll('.emoji-category-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            searchInput.value = '';
            searchTerm = '';
            rerender();
        });

        // Search input
        searchInput.addEventListener('input', () => {
            searchTerm = searchInput.value.trim();
            // When searching, reset to All category visually
            if (searchTerm) {
                categoryTabsContainer.querySelectorAll('.emoji-category-tab').forEach(t => t.classList.remove('active'));
                const allTab = categoryTabsContainer.querySelector('[data-category="All"]');
                if (allTab) allTab.classList.add('active');
                activeCategory = 'All';
            }
            rerender();
        });

        const closeModal = () => {
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            document.removeEventListener('keydown', handleEsc);
            overlay.removeEventListener('mousedown', handleMouseDown);
        };

        const handleEsc = (e) => {
            if (e.key === 'Escape') closeModal();
        };

        const handleMouseDown = (e) => {
            mouseDownTarget = e.target;
        };

        cancelBtn.addEventListener('click', closeModal);
        closeBtn.addEventListener('click', closeModal);
        document.addEventListener('keydown', handleEsc);
        overlay.addEventListener('mousedown', handleMouseDown);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay && mouseDownTarget === overlay) closeModal();
            mouseDownTarget = null;
        });

        modal.addEventListener('click', (e) => e.stopPropagation());

        applyBtn.addEventListener('click', () => {
            if (this.selectedEmoji) {
                this.applyEmojiChange(this.currentElement, this.selectedEmoji, this.selectedCategoryKey);
                closeModal();
            }
        });

        // Focus search on open
        setTimeout(() => searchInput.focus(), 100);
    }

    /**
     * Apply the chosen emoji to the DOM element and emit undo/redo command.
     * Flags are inserted as Twemoji images so they display correctly on all platforms.
     */
    applyEmojiChange(element, newEmoji, categoryKey) {
        console.log('😀 Emoji Editor: Applying emoji change', newEmoji);

        const section = element.closest('.section');
        const sectionNumber = section ? section.getAttribute('data-section') : null;

        const previousState = this.captureState(element);

        const isFlag = categoryKey === 'flags';
        if (isFlag) {
            const url = this.getTwemojiUrl(newEmoji);
            if (url) {
                element.innerHTML = `<img src="${this.escapeHTML(url)}" alt="" class="emoji-flag-img" data-emoji-char="${this.escapeHTML(newEmoji)}" loading="lazy">`;
            } else {
                element.textContent = newEmoji;
            }
        } else {
            element.textContent = newEmoji;
        }

        const nextState = this.captureState(element);

        if (sectionNumber) {
            this.emitChangeCommand(sectionNumber, element, previousState, nextState);
        }

        console.log('😀 Emoji Editor: Emoji updated to', newEmoji);
    }

    /**
     * Capture element state for undo/redo (supports text and flag img).
     */
    captureState(element) {
        const { emojiChar, isFlag } = this.getCurrentEmojiFromElement(element);
        return {
            emojiChar,
            isFlag,
            className: element.className || '',
            textContent: emojiChar
        };
    }

    /**
     * Get or create a unique ID for the emoji element
     */
    getEmojiUid(element) {
        let uid = element.getAttribute('data-emoji-uid');
        if (!uid) {
            uid = 'emoji-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
            element.setAttribute('data-emoji-uid', uid);
        }
        return uid;
    }

    /**
     * Emit change command to parent window for undo/redo support
     */
    emitChangeCommand(sectionNumber, element, beforeState, afterState) {
        if (!window.parent || window.parent === window || !window.parent.postMessage) return;

        const emojiUid = this.getEmojiUid(element);

        window.parent.postMessage({
            type: 'COMMAND_INLINE_EMOJI_CHANGE',
            data: {
                sectionNumber,
                emojiUid,
                beforeState,
                afterState,
                label: 'Emoji changed'
            }
        }, '*');
    }

    /**
     * Apply a captured state (for undo/redo operations from parent)
     */
    applyState(sectionNumber, emojiUid, state, shouldScroll = false) {
        console.log('😀 Emoji Editor: Applying state', { sectionNumber, emojiUid, state });

        const section = document.querySelector(`.section[data-section="${sectionNumber}"]`);
        if (!section) {
            console.warn(`Emoji Editor: Section ${sectionNumber} not found`);
            return;
        }

        const element = section.querySelector(`[data-emoji-uid="${emojiUid}"]`);
        if (!element) {
            console.warn(`Emoji Editor: Element with UID ${emojiUid} not found`);
            return;
        }

        const emojiChar = state.emojiChar !== undefined ? state.emojiChar : (state.textContent || '');
        const isFlag = state.isFlag === true;
        if (isFlag && emojiChar) {
            const url = this.getTwemojiUrl(emojiChar);
            if (url) {
                element.innerHTML = `<img src="${this.escapeHTML(url)}" alt="" class="emoji-flag-img" data-emoji-char="${this.escapeHTML(emojiChar)}" loading="lazy">`;
            } else {
                element.textContent = emojiChar;
            }
        } else {
            element.textContent = emojiChar;
        }
        if (state.className !== undefined) element.className = state.className;

        if (shouldScroll) {
            section.scrollIntoView({ behavior: 'auto', block: 'center' });
        }

        console.log('😀 Emoji Editor: State applied successfully');
    }

    /**
     * Escape HTML special characters
     */
    escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    }
}

// Initialize global instance (singleton protection)
if (!window.inlineEmojiEditor) {
    window.inlineEmojiEditor = new InlineEmojiEditor();
    console.log('😀 Emoji Editor: Initialized');
} else {
    console.log('😀 Emoji Editor: Already initialized, skipping');
}
