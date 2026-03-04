/**
 * Inline Map Editor
 * Allows users to change Google Maps location in templates
 * - Hover indicator button on .map-container elements
 * - Popup modal to enter a new address and preview the map
 * - Integrates with HistoryManager via COMMAND_MAP_CHANGE / APPLY_MAP_STATE messages
 */

class InlineMapEditor {
    constructor() {
        this.init();
    }

    init() {
        console.log('🗺️ Map Editor: Initializing');
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this._setup());
        } else {
            this._setup();
        }
    }

    _setup() {
        this.initAllMapContainers();
        this.setupMessageListeners();
        this.setupMutationObserver();
    }

    // ─── Container initialization ──────────────────────────────────────────────

    initAllMapContainers() {
        document.querySelectorAll('section .map-container').forEach(container => {
            this.initContainer(container);
        });
    }

    initContainer(container) {
        if (container.hasAttribute('data-map-editor-initialized')) return;

        const iframe = container.querySelector('iframe');
        if (!iframe) return;

        container.setAttribute('data-map-editor-initialized', 'true');

        // Assign a unique UID to the iframe for undo/redo tracking
        if (!iframe.hasAttribute('data-map-uid')) {
            iframe.setAttribute(
                'data-map-uid',
                'map-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
            );
        }

        // Transparent overlay to intercept pointer events over the iframe
        const pointerOverlay = document.createElement('div');
        pointerOverlay.className = 'map-pointer-overlay';
        container.appendChild(pointerOverlay);

        // Edit button (pencil + location icon)
        const editBtn = document.createElement('button');
        editBtn.className = 'map-edit-btn';
        editBtn.setAttribute('type', 'button');
        editBtn.setAttribute('aria-label', 'Change location');
        editBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
            </svg>
            <span>Change Location</span>
        `;
        container.appendChild(editBtn);

        const openHandler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!document.body.classList.contains('fullscreen-mode')) {
                this.openModal(container, iframe);
            }
        };

        editBtn.addEventListener('click', openHandler);
        pointerOverlay.addEventListener('click', openHandler);
    }

    // ─── Modal ─────────────────────────────────────────────────────────────────

    openModal(container, iframe) {
        console.log('🗺️ Map Editor: Opening modal');

        const currentSrc = iframe.getAttribute('src') || '';

        // Build overlay
        const overlay = document.createElement('div');
        overlay.className = 'map-edit-modal-overlay modal-overlay';

        // Build modal
        const modal = document.createElement('div');
        modal.className = 'map-edit-modal fp-ui-theme';

        modal.innerHTML = `
            <h2>
                Change Location
                <button type="button" class="close-btn" aria-label="Close">&times;</button>
            </h2>

            <div class="map-modal-body">
                <label for="map-address-input">Address or place name:</label>
                <div class="map-search-row">
                    <input
                        type="text"
                        id="map-address-input"
                        class="map-address-input"
                        placeholder="e.g. Jardines de Santa María, Pozuelo de Alarcón, Madrid"
                        autocomplete="off"
                        spellcheck="false"
                    />
                    <button type="button" class="map-search-btn">Preview</button>
                </div>
                <div class="map-preview-wrapper">
                    <iframe
                        id="map-preview-iframe"
                        class="map-preview-iframe"
                        src=""
                        loading="lazy"
                        frameborder="0"
                        style="border:0"
                        allowfullscreen
                    ></iframe>
                    <div class="map-preview-placeholder">
                        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.3; margin-bottom:12px">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                            <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                        <p>Enter an address and click <strong>Preview</strong> to see the map</p>
                    </div>
                </div>
            </div>

            <div class="map-modal-actions">
                <button type="button" class="map-modal-btn cancel">Cancel</button>
                <button type="button" class="map-modal-btn apply" disabled>Apply</button>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // ── Element refs ──────────────────────────────────────────────────────
        const addressInput    = modal.querySelector('#map-address-input');
        const searchBtn       = modal.querySelector('.map-search-btn');
        const previewIframe   = modal.querySelector('#map-preview-iframe');
        const previewWrapper  = modal.querySelector('.map-preview-wrapper');
        const placeholder     = modal.querySelector('.map-preview-placeholder');
        const applyBtn        = modal.querySelector('.map-modal-btn.apply');
        const cancelBtn       = modal.querySelector('.map-modal-btn.cancel');
        const closeBtn        = modal.querySelector('.close-btn');

        let pendingUrl = null; // URL ready to apply (after a successful preview)

        // ── Helpers ───────────────────────────────────────────────────────────

        const buildEmbedUrl = (address) =>
            `https://maps.google.com/maps?q=${encodeURIComponent(address.trim())}&output=embed`;

        const showPreview = () => {
            const address = addressInput.value.trim();
            if (!address) return;

            const url = buildEmbedUrl(address);
            pendingUrl = url;

            // Show iframe, hide placeholder
            placeholder.style.display = 'none';
            previewIframe.style.display = 'block';
            previewIframe.src = url;

            applyBtn.disabled = false;
        };

        const closeModal = () => {
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            document.removeEventListener('keydown', handleEscKey);
        };

        // ── Event listeners ───────────────────────────────────────────────────

        searchBtn.addEventListener('click', showPreview);

        addressInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                showPreview();
            }
        });

        applyBtn.addEventListener('click', () => {
            if (pendingUrl) {
                this.applyMapChange(iframe, pendingUrl);
                closeModal();
            }
        });

        cancelBtn.addEventListener('click', closeModal);
        closeBtn.addEventListener('click', closeModal);

        // Close on overlay backdrop click
        let mouseDownTarget = null;
        overlay.addEventListener('mousedown', (e) => { mouseDownTarget = e.target; });
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay && mouseDownTarget === overlay) closeModal();
            mouseDownTarget = null;
        });
        modal.addEventListener('click', (e) => e.stopPropagation());

        const handleEscKey = (e) => {
            if (e.key === 'Escape' || e.key === 'Esc') closeModal();
        };
        document.addEventListener('keydown', handleEscKey);

        // Focus input
        setTimeout(() => addressInput.focus(), 100);
    }

    // ─── Apply change ──────────────────────────────────────────────────────────

    applyMapChange(iframe, newSrc) {
        const section = iframe.closest('.section');
        const sectionNumber = section ? section.getAttribute('data-section') : null;
        const mapUid = this.getMapUid(iframe);

        const beforeState = { src: iframe.getAttribute('src') || '' };

        // Update the map
        iframe.setAttribute('src', newSrc);

        const afterState = { src: newSrc };

        // Emit command to parent for undo/redo
        if (sectionNumber && window.parent && window.parent !== window) {
            window.parent.postMessage({
                type: 'COMMAND_MAP_CHANGE',
                data: {
                    sectionNumber,
                    mapUid,
                    beforeState,
                    afterState,
                    label: 'Location changed'
                }
            }, '*');
        }

        console.log('🗺️ Map Editor: Location updated successfully');
    }

    // ─── Undo / Redo state application ────────────────────────────────────────

    applyState(sectionNumber, mapUid, state, shouldScroll = false) {
        const section = document.querySelector(`.section[data-section="${sectionNumber}"]`);
        if (!section) {
            console.warn(`🗺️ Map Editor: Section ${sectionNumber} not found`);
            return;
        }

        const iframe = section.querySelector(`iframe[data-map-uid="${mapUid}"]`);
        if (!iframe) {
            console.warn(`🗺️ Map Editor: iframe with uid "${mapUid}" not found`);
            return;
        }

        iframe.setAttribute('src', state.src);

        if (shouldScroll) {
            section.scrollIntoView({ behavior: 'auto', block: 'center' });
        }

        console.log('🗺️ Map Editor: State applied (undo/redo)');
    }

    // ─── Helpers ───────────────────────────────────────────────────────────────

    getMapUid(iframe) {
        let uid = iframe.getAttribute('data-map-uid');
        if (!uid) {
            uid = 'map-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
            iframe.setAttribute('data-map-uid', uid);
        }
        return uid;
    }

    // ─── Message listeners (for undo/redo from parent) ────────────────────────

    setupMessageListeners() {
        window.addEventListener('message', (event) => {
            if (event.data.type === 'APPLY_MAP_STATE') {
                const { sectionNumber, mapUid, state, shouldScroll } = event.data.data;
                this.applyState(sectionNumber, mapUid, state, shouldScroll);
            }
        });
    }

    // ─── MutationObserver (for dynamically added sections) ────────────────────

    setupMutationObserver() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType !== Node.ELEMENT_NODE) return;
                    // Direct match
                    if (node.classList && node.classList.contains('map-container')) {
                        this.initContainer(node);
                    }
                    // Descendants
                    node.querySelectorAll &&
                        node.querySelectorAll('.map-container').forEach(c => this.initContainer(c));
                });
            });
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }
}

// ─── Singleton initialization ──────────────────────────────────────────────────

if (!window.inlineMapEditor) {
    window.inlineMapEditor = new InlineMapEditor();
    console.log('🗺️ Map Editor: Initialized');
} else {
    console.log('🗺️ Map Editor: Already initialized, skipping');
}
