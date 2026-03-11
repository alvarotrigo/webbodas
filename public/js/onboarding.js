/**
 * Onboarding Component (template-first / Wedding paradigm)
 * Shows a full-width template gallery grid with hover-scroll and action buttons.
 * Cards use the same scroll-on-hover mechanic as the sidebar template panel.
 */
(function() {
    'use strict';

    console.log('Onboarding.js loaded');

    // === CONSTANTS ===
    const CONFETTI_COLORS_TEMPLATE = ['#10b981', '#34d399', '#6ee7b7'];
    const SCROLL_DURATION_MS = 6000;
    // Max wait time (ms) for window.allTemplates to be populated by app.js
    const TEMPLATES_WAIT_MAX_MS = 5000;
    const TEMPLATES_POLL_INTERVAL_MS = 80;

    // === STATE ===
    let overlay = null;
    let galleryEl = null;
    let categoryFiltersEl = null;
    let searchInputEl = null;
    let searchClearEl = null;
    let isVisible = false;
    let hasBuiltGallery = false;
    let step1Complete = false;
    // Multi-select: empty Set = show all templates
    let activeCategories = new Set();
    // Search state (driven by #onboarding-search-input)
    let onboardingSearchQuery = '';

    // Preview popup state
    let popup = null;
    let popupIframe = null;
    let popupThemesCol = null;
    let popupThemesList = null;
    let popupChooseBtn = null;
    let popupCloseBtn = null;
    let popupNavPrev = null;
    let popupNavNext = null;
    let popupThemesToggle = null;
    let popupThemesReopen = null;
    let popupIframeCol = null;
    let popupDeviceBtns = null;
    let currentPopupTemplate = null;
    let currentPopupThemeId = null;
    let initialPopupThemeId = null; // First theme the template had — used by Reset button
    let popupTemplateList = [];
    let currentDeviceMode = 'desktop';

    // === INITIALIZATION ===
    function init() {
        console.log('Onboarding initializing...');

        overlay           = document.getElementById('onboarding-overlay');
        galleryEl         = document.getElementById('onboarding-template-gallery');
        categoryFiltersEl = document.getElementById('onboarding-category-filters');
        searchInputEl     = document.getElementById('onboarding-search-input');
        searchClearEl     = document.getElementById('onboarding-search-clear');

        if (!overlay) {
            console.warn('Onboarding overlay not found');
            return;
        }

        if (searchInputEl) setupOnboardingSearch();

        popup            = document.getElementById('onboarding-preview-popup');
        popupIframe      = document.getElementById('onboarding-preview-iframe');
        popupThemesCol   = document.getElementById('onboarding-preview-themes-col');
        popupThemesList  = document.getElementById('onboarding-preview-themes-list');
        popupChooseBtn   = document.getElementById('onboarding-preview-choose-btn');
        popupCloseBtn    = document.getElementById('onboarding-preview-popup-close');
        popupNavPrev     = document.getElementById('onboarding-preview-nav-prev');
        popupNavNext     = document.getElementById('onboarding-preview-nav-next');
        popupThemesToggle = document.getElementById('onboarding-preview-themes-toggle');
        popupThemesReopen = document.getElementById('onboarding-preview-themes-reopen');
        popupIframeCol   = document.getElementById('onboarding-preview-iframe-col');
        popupDeviceBtns  = document.querySelectorAll('.onboarding-preview-device-btn');

        if (popup) setupPopupListeners();

        hookIntoTemplateInsert();
        console.log('Onboarding initialized');
    }

    // === GALLERY BUILD ===

    /**
     * Waits for window.allTemplates (set by buildTemplateStyles() in app.js),
     * then populates the gallery grid.
     */
    function buildGallery() {
        if (hasBuiltGallery) return;
        if (!galleryEl) return;

        const startTime = Date.now();

        function tryBuild() {
            const templates = window.allTemplates;
            if (Array.isArray(templates) && templates.length > 0) {
                renderGallery(templates);
                hasBuiltGallery = true;
                return;
            }
            if (Date.now() - startTime < TEMPLATES_WAIT_MAX_MS) {
                setTimeout(tryBuild, TEMPLATES_POLL_INTERVAL_MS);
            } else {
                // Timeout – show friendly message
                galleryEl.innerHTML = '<p class="onboarding-gallery-error">Could not load templates. Please refresh the page.</p>';
                console.warn('Onboarding: timed out waiting for allTemplates');
            }
        }

        tryBuild();
    }

    function renderGallery(templates) {
        if (!galleryEl) return;

        // Build category filter pills now that templates are loaded
        buildCategoryFilters(templates);

        // Render gallery with current filters
        applyFilters();
    }

    // === CATEGORY FILTER PILLS ===

    /**
     * Builds the row of category pill buttons above the gallery.
     * "All" is first (left), then the rest. Each pill shows name and template count.
     */
    function buildCategoryFilters(templates) {
        if (!categoryFiltersEl) return;

        const allTemplates = templates || window.allTemplates || [];
        const categories   = window.templateCategories || [];
        const totalCount   = allTemplates.filter(t => t.id && !isNaN(Number(t.id))).length;

        // Count valid templates per category
        const countMap = {};
        allTemplates.forEach(t => {
            if (!t.id || isNaN(Number(t.id))) return;
            if (!t.category) return;
            countMap[t.category] = (countMap[t.category] || 0) + 1;
        });

        categoryFiltersEl.innerHTML = '';

        // Add "All" pill first (left)
        const allCat = categories.find(c => c.id === 'all');
        if (allCat && totalCount > 0) {
            const allBtn = document.createElement('button');
            allBtn.type = 'button';
            allBtn.className = 'onboarding-cat-btn';
            allBtn.dataset.catId = 'all';
            allBtn.innerHTML = `
                <span class="onboarding-cat-name">${allCat.name}</span>
                <span class="onboarding-cat-count">${totalCount}</span>
            `;
            allBtn.addEventListener('click', () => toggleCategory('all'));
            categoryFiltersEl.appendChild(allBtn);
        }

        // Rest of categories (skip 'all')
        categories.forEach(cat => {
            if (cat.id === 'all') return;
            const count = countMap[cat.id] || 0;
            if (count === 0) return;

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'onboarding-cat-btn';
            btn.dataset.catId = cat.id;
            btn.innerHTML = `
                <span class="onboarding-cat-name">${cat.name}</span>
                <span class="onboarding-cat-count">${count}</span>
            `;
            btn.addEventListener('click', () => toggleCategory(cat.id));
            categoryFiltersEl.appendChild(btn);
        });

        refreshCategoryUI();
    }

    /**
     * Toggles a category in/out of activeCategories and re-renders the gallery.
     * "All" clears the selection (show all templates).
     */
    function toggleCategory(key) {
        if (key === 'all') {
            activeCategories.clear();
        } else {
            if (activeCategories.has(key)) {
                activeCategories.delete(key);
            } else {
                activeCategories.add(key);
            }
        }
        refreshCategoryUI();
        applyFilters();
    }

    /**
     * Updates pill button visual state to match activeCategories.
     * "All" is active when no categories are selected.
     */
    function refreshCategoryUI() {
        if (!categoryFiltersEl) return;
        categoryFiltersEl.querySelectorAll('.onboarding-cat-btn').forEach(btn => {
            const catId = btn.dataset.catId;
            const isActive = catId === 'all' ? activeCategories.size === 0 : activeCategories.has(catId);
            btn.classList.toggle('active', isActive);
        });
    }

    function createOnboardingCard(template) {
        const id = template.id || '';
        const name = template.name || 'Template';
        const previewSrc = id ? `templates/previews/template${id}.jpg` : '';

        const card = document.createElement('div');
        card.className = 'onboarding-template-card';
        card.dataset.templateId = id;

        // Preview area (reuses .template-card-preview / .template-card-preview-inner structure)
        const previewHtml = previewSrc
            ? `<img src="${previewSrc}" loading="lazy" alt="${name}" class="template-card-preview-img" onerror="this.onerror=null;this.parentElement.parentElement.classList.add('no-preview');" />`
            : `<div class="template-card-placeholder"><span class="template-card-placeholder-label">${name}</span></div>`;

        card.innerHTML = `
            <div class="template-card-preview">
                <div class="template-card-preview-inner">
                    ${previewHtml}
                </div>
            </div>
            <div class="onboarding-template-card-name">${name}</div>
            <div class="onboarding-template-card-overlay">
                <button class="onboarding-template-action-btn preview-btn" type="button" aria-label="Preview template" title="Preview">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
                <button class="onboarding-template-action-btn select-btn" type="button" aria-label="Use template" title="Use this template">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
            </div>
        `;

        // Wire buttons
        const selectBtn = card.querySelector('.select-btn');
        const previewBtn = card.querySelector('.preview-btn');

        selectBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await selectTemplate(template);
        });

        previewBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openPreviewPopup(template);
        });

        // Clicking the card image also opens the preview popup
        card.addEventListener('click', () => openPreviewPopup(template));

        return card;
    }

    async function selectTemplate(template) {
        if (typeof window.insertFullTemplateIntoPreview === 'function') {
            // If no page exists yet, prompt for name and create page in DB before inserting template
            if (window.pageManagerInstance && window.pageManagerInstance.shouldPromptForPageName()) {
                await window.pageManagerInstance.promptForPageName();
            }
            // Signal exitOnboardingMode to keep the sidebar collapsed so no
            // open→close animation flashes when the template is inserted.
            window._collapseAfterOnboarding = true;
            hide(true);
            window.insertFullTemplateIntoPreview(template);
            if (!step1Complete) {
                setTimeout(() => markStepComplete(), 100);
            }
        } else {
            console.warn('insertFullTemplateIntoPreview not available');
        }
    }

    // === HOVER-SCROLL ===

    function attachHoverScroll(container) {
        // Prefer the globally-exposed version from app.js
        if (typeof window.attachTemplateCardHoverScroll === 'function') {
            // The global function targets .template-card — our cards also use .template-card-preview/.template-card-preview-inner
            const pseudoContainer = { querySelectorAll: () => container.querySelectorAll('.onboarding-template-card') };
            attachHoverScrollToCards(container.querySelectorAll('.onboarding-template-card'));
            return;
        }
        attachHoverScrollToCards(container.querySelectorAll('.onboarding-template-card'));
    }

    function attachHoverScrollToCards(cards) {
        cards.forEach(card => {
            const preview = card.querySelector('.template-card-preview');
            const inner   = card.querySelector('.template-card-preview-inner');
            if (!preview || !inner) return;

            let animId    = null;
            let startTime = null;

            function runTransformScroll(ts) {
                if (!startTime) startTime = ts;
                const elapsed     = ts - startTime;
                const progress    = Math.min(elapsed / SCROLL_DURATION_MS, 1);
                const easeProgress = 1 - Math.pow(1 - progress, 1.5);
                const previewH    = preview.clientHeight;
                const innerH      = inner.scrollHeight;
                const maxScroll   = Math.max(0, innerH - previewH);
                inner.style.transform = `translateY(${-maxScroll * easeProgress}px)`;
                if (progress < 1) animId = requestAnimationFrame(runTransformScroll);
            }

            function startScroll() {
                if (animId) cancelAnimationFrame(animId);
                startTime = null;
                animId = requestAnimationFrame(runTransformScroll);
            }

            function stopScroll() {
                if (animId) {
                    cancelAnimationFrame(animId);
                    animId = null;
                }
                inner.style.transform = '';
            }

            card.addEventListener('mouseenter', startScroll);
            card.addEventListener('mouseleave', stopScroll);
        });
    }

    // === PREVIEW POPUP (iframe + themes) ===

    let themeCssCache = null;

    function getFilteredTemplates() {
        const all = window.allTemplates;
        if (!Array.isArray(all)) return [];
        const valid = all.filter(t => t.id && !isNaN(Number(t.id)));
        if (activeCategories.size === 0) return valid;
        return valid.filter(t => activeCategories.has(t.category));
    }

    function cleanupIframe() {
        if (!popupIframe) return;
        popupIframe.onload = null;
        try {
            const doc = popupIframe.contentDocument;
            if (doc) {
                doc.open();
                doc.write('');
                doc.close();
            }
        } catch (e) { /* cross-origin guard */ }
        popupIframe.src = 'about:blank';
    }

    function openPreviewPopup(template) {
        if (!popup || !popupIframe) return;
        currentPopupTemplate = template;
        popupTemplateList = getFilteredTemplates();

        cleanupIframe();
        popupIframe.src = template.url;

        // Pre-select the template's default theme so the Themes panel shows it highlighted
        currentPopupThemeId = template.defaultTheme || null;
        initialPopupThemeId = currentPopupThemeId;
        buildPopupThemesList();
        updateNavButtons();

        // Scroll the themes list to make the active theme visible
        if (currentPopupThemeId && popupThemesList) {
            const activeItem = popupThemesList.querySelector(`.popup-theme-item[data-theme-id="${currentPopupThemeId}"]`);
            if (activeItem) {
                setTimeout(() => activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 50);
            }
        }

        popup.classList.add('show');
        document.body.style.overflow = 'hidden';

        // Always reset to desktop view when opening popup
        setDeviceMode('desktop');

        // Ensure Lucide icons in device bar are rendered (smartphone, tablet, monitor)
        const deviceBar = popup && popup.querySelector('.onboarding-preview-device-bar');
        if (deviceBar && typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
            lucide.createIcons({ nodes: [deviceBar] });
        }

        window.hideSidebarForPreview?.();

        popupIframe.onload = function() {
            if (currentPopupThemeId) {
                applyThemeToPopupIframe(currentPopupThemeId);
            }
        };
    }

    function closePreviewPopup() {
        if (!popup) return;
        popup.classList.remove('show');
        document.body.style.overflow = '';
        cleanupIframe();
        currentPopupTemplate = null;
        currentPopupThemeId = null;
        initialPopupThemeId = null;
        window.showSidebarAfterPreview?.();
    }

    function buildPopupThemesList() {
        if (!popupThemesList) return;
        popupThemesList.innerHTML = '';

        const allThemes = window.themes || [];
        if (!allThemes.length) return;

        allThemes.forEach(theme => {
            const item = document.createElement('div');
            item.className = 'popup-theme-item';
            item.dataset.themeId = theme.id;

            const card = document.createElement('div');
            card.className = 'popup-theme-card';
            if (theme.id === currentPopupThemeId) card.classList.add('active');

            const colors = (theme.colors || []).map(c =>
                '<div class="popup-theme-color" style="background-color:' + c + '"></div>'
            ).join('');
            card.innerHTML = colors;

            const name = document.createElement('div');
            name.className = 'popup-theme-name';
            name.textContent = theme.name || '';

            item.appendChild(card);
            item.appendChild(name);

            item.addEventListener('click', () => {
                currentPopupThemeId = theme.id;
                popupThemesList.querySelectorAll('.popup-theme-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                applyThemeToPopupIframe(theme.id);
            });

            popupThemesList.appendChild(item);
        });
    }

    /**
     * Fetches the wedding theme CSS rules from sections.css (cached) and
     * injects them + the theme class into the raw template iframe.
     */
    function applyThemeToPopupIframe(themeId) {
        if (!popupIframe) return;
        try {
            const doc = popupIframe.contentDocument;
            if (!doc || !doc.body) return;

            // Remove previous theme classes from body
            const body = doc.body;
            Array.from(body.classList).forEach(cls => {
                if (cls.startsWith('theme-') || cls.startsWith('custom-theme-')) {
                    body.classList.remove(cls);
                }
            });
            body.classList.add(themeId);

            // Also add to <html> for selectors that target :root
            const html = doc.documentElement;
            Array.from(html.classList).forEach(cls => {
                if (cls.startsWith('theme-') || cls.startsWith('custom-theme-')) {
                    html.classList.remove(cls);
                }
            });
            html.classList.add(themeId);

            injectThemeCss(doc);
        } catch (e) {
            // Fallback: postMessage for cross-origin iframes
            if (popupIframe.contentWindow) {
                popupIframe.contentWindow.postMessage({
                    type: 'SET_THEME', data: { theme: themeId }
                }, '*');
            }
        }
    }

    function injectThemeCss(doc) {
        if (doc.getElementById('popup-theme-css')) return;

        function doInject(css) {
            if (doc.getElementById('popup-theme-css')) return;
            const style = doc.createElement('style');
            style.id = 'popup-theme-css';
            style.textContent = css;
            doc.head.appendChild(style);
        }

        if (themeCssCache) {
            doInject(themeCssCache);
            return;
        }

        // Fetch sections.css and extract the wedding theme block
        const currentPath = window.location.pathname;
        const basePath = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);
        fetch(basePath + 'public/css/sections.css')
            .then(r => r.text())
            .then(css => {
                const startMarker = '/* 1 — Blush & Ivory';
                const idx = css.indexOf(startMarker);
                if (idx !== -1) {
                    themeCssCache = css.substring(idx);
                } else {
                    // Fallback: extract all .theme-wedding-* rules
                    const matches = css.match(/\.theme-wedding-[\s\S]*$/);
                    themeCssCache = matches ? matches[0] : css;
                }
                doInject(themeCssCache);
            })
            .catch(() => {});
    }

    function navigateTemplate(direction) {
        if (!currentPopupTemplate || !popupTemplateList.length) return;
        const idx = popupTemplateList.findIndex(t => String(t.id) === String(currentPopupTemplate.id));
        if (idx === -1) return;
        const newIdx = idx + direction;
        if (newIdx < 0 || newIdx >= popupTemplateList.length) return;
        openPreviewPopup(popupTemplateList[newIdx]);
    }

    function updateNavButtons() {
        if (!popupNavPrev || !popupNavNext || !currentPopupTemplate) return;
        const idx = popupTemplateList.findIndex(t => String(t.id) === String(currentPopupTemplate.id));
        popupNavPrev.style.display = idx > 0 ? '' : 'none';
        popupNavNext.style.display = idx < popupTemplateList.length - 1 ? '' : 'none';
    }

    function toggleThemesPanel() {
        if (!popupThemesCol) return;
        popupThemesCol.classList.toggle('collapsed');
    }

    function setDeviceMode(mode) {
        if (!popupIframeCol) return;
        currentDeviceMode = mode;

        popupIframeCol.classList.remove('device-mobile', 'device-tablet', 'device-desktop');
        if (mode !== 'desktop') {
            popupIframeCol.classList.add('device-' + mode);
        }

        if (popupDeviceBtns) {
            popupDeviceBtns.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.device === mode);
            });
        }
    }

    function setupPopupListeners() {
        if (popupCloseBtn) popupCloseBtn.addEventListener('click', closePreviewPopup);

        if (popupChooseBtn) {
            popupChooseBtn.addEventListener('click', async () => {
                if (!currentPopupTemplate) return;
                const chosenTemplate = currentPopupTemplate;
                const chosenTheme = currentPopupThemeId;
                // Apply theme before showing name modal
                if (chosenTheme && typeof window.applyThemeFromCommand === 'function') {
                    window.applyThemeFromCommand(chosenTheme, { keepPanelOpen: true });
                }
                // Name modal appears on top of the preview popup (z-index stacking).
                // Close the popup only after the name is entered and template inserted.
                await selectTemplate(chosenTemplate);
                closePreviewPopup();
            });
        }

        if (popupNavPrev) popupNavPrev.addEventListener('click', () => navigateTemplate(-1));
        if (popupNavNext) popupNavNext.addEventListener('click', () => navigateTemplate(1));
        if (popupThemesToggle) popupThemesToggle.addEventListener('click', toggleThemesPanel);
        if (popupThemesReopen) popupThemesReopen.addEventListener('click', toggleThemesPanel);

        const popupThemesResetBtn = document.getElementById('onboarding-preview-themes-reset');
        if (popupThemesResetBtn) {
            popupThemesResetBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!initialPopupThemeId || currentPopupThemeId === initialPopupThemeId) return;
                currentPopupThemeId = initialPopupThemeId;
                if (popupThemesList) {
                    popupThemesList.querySelectorAll('.popup-theme-card').forEach(card => {
                        card.classList.remove('active');
                        const item = card.closest('.popup-theme-item');
                        if (item && item.dataset.themeId === initialPopupThemeId) card.classList.add('active');
                    });
                }
                applyThemeToPopupIframe(initialPopupThemeId);
            });
        }

        if (popupDeviceBtns) {
            popupDeviceBtns.forEach(btn => {
                btn.addEventListener('click', () => setDeviceMode(btn.dataset.device));
            });
        }

        // Backdrop click
        const backdrop = popup.querySelector('.onboarding-preview-popup-backdrop');
        if (backdrop) backdrop.addEventListener('click', closePreviewPopup);

        // Keyboard: Escape, Arrow Left/Right
        document.addEventListener('keydown', (e) => {
            if (!popup.classList.contains('show')) return;
            if (e.key === 'Escape') closePreviewPopup();
            if (e.key === 'ArrowLeft') navigateTemplate(-1);
            if (e.key === 'ArrowRight') navigateTemplate(1);
        });
    }

    // === GALLERY FILTERING & SEARCH ===

    /**
     * Renders search results directly in the gallery area (onboarding mode).
     * Called by template-search.js when a query is active and no template has been chosen.
     */
    function renderSearchResultsInGallery(templates) {
        if (!galleryEl) return;

        onboardingSearchQuery = 'active'; // mark search as active (exact value handled by template-search.js)
        galleryEl.innerHTML = '';

        if (!templates || templates.length === 0) {
            galleryEl.innerHTML = `
                <div class="onboarding-gallery-error">
                    <p>No templates found for that search.</p>
                    <p style="font-size:0.8rem;opacity:0.7;margin-top:0.4rem;">
                        Try colors (e.g. "cream", "gold"), styles (e.g. "rustic", "luxe") or keywords.
                    </p>
                </div>`;
            return;
        }

        const valid = templates.filter(t => t.id && !isNaN(Number(t.id)));
        valid.forEach(template => {
            const card = createOnboardingCard(template);
            galleryEl.appendChild(card);
        });

        attachHoverScroll(galleryEl);

        if (overlay) overlay.scrollTop = 0;
    }

    /**
     * Restores the gallery to the current category selection when search is cleared.
     * Called by template-search.js when the sidebar search input is emptied in onboarding mode.
     */
    function clearSearch() {
        onboardingSearchQuery = '';
        applyFilters();
    }

    /**
     * Core render: applies active category filters and renders the gallery.
     * Called by toggleCategory(), clearSearch(), and initial renderGallery().
     */
    function applyFilters() {
        const allTemplates = window.allTemplates;
        if (!Array.isArray(allTemplates)) return;

        const filtered = activeCategories.size === 0
            ? allTemplates.filter(t => t.id && !isNaN(Number(t.id)))
            : allTemplates.filter(t => t.id && !isNaN(Number(t.id)) && activeCategories.has(t.category));

        if (!galleryEl) return;
        galleryEl.innerHTML = '';

        if (filtered.length === 0) {
            galleryEl.innerHTML = '<p class="onboarding-gallery-error">No templates in this category yet.</p>';
            return;
        }

        filtered.forEach(template => {
            const card = createOnboardingCard(template);
            galleryEl.appendChild(card);
        });

        attachHoverScroll(galleryEl);

        if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
            lucide.createIcons({ nodes: [galleryEl] });
        }

        if (overlay) overlay.scrollTop = 0;
    }

    /**
     * Legacy single-category filter — kept for backward-compat with sidebar click handler.
     * Now sets the single category as the only active one and re-renders.
     */
    function filterByCategory(key) {
        activeCategories.clear();
        if (key && key !== 'all') {
            activeCategories.add(key);
        }
        refreshCategoryUI();
        applyFilters();
    }

    // === ONBOARDING SEARCH ===

    /**
     * Wires the dedicated onboarding search input.
     * Routes to the shared template-search.js Fuse engine via the sidebar search input,
     * or falls back to a simple name/tag filter if the shared engine is unavailable.
     */
    function setupOnboardingSearch() {
        if (!searchInputEl) return;

        let searchTimeout = null;

        function syncAndTrigger(value) {
            // Mirror value into the sidebar search input so template-search.js picks it up
            const sidebarInput = document.getElementById('section-search-input');
            if (sidebarInput) {
                sidebarInput.value = value;
                sidebarInput.dispatchEvent(new Event('input', { bubbles: true }));
            } else {
                // Fallback: simple inline filter
                if (!value.trim()) {
                    onboardingSearchQuery = '';
                    applyFilters();
                } else {
                    onboardingSearchQuery = value.trim().toLowerCase();
                    const all = window.allTemplates || [];
                    const q   = onboardingSearchQuery;
                    const results = all.filter(t => {
                        if (!t.id || isNaN(Number(t.id))) return false;
                        const inName = (t.name || '').toLowerCase().includes(q);
                        const inCat  = (t.category || '').toLowerCase().includes(q);
                        const inTags = (t.tags || []).some(tg => tg.toLowerCase().includes(q));
                        return inName || inCat || inTags;
                    });
                    renderSearchResultsInGallery(results);
                }
            }
        }

        searchInputEl.addEventListener('input', (e) => {
            const val = e.target.value;
            if (searchClearEl) searchClearEl.style.display = val ? '' : 'none';
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => syncAndTrigger(val), 0);
        });

        searchInputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                searchInputEl.value = '';
                if (searchClearEl) searchClearEl.style.display = 'none';
                clearTimeout(searchTimeout);
                syncAndTrigger('');
            }
        });

        if (searchClearEl) {
            searchClearEl.style.display = 'none';
            searchClearEl.addEventListener('click', () => {
                searchInputEl.value = '';
                searchClearEl.style.display = 'none';
                clearTimeout(searchTimeout);
                syncAndTrigger('');
                searchInputEl.focus();
            });
        }
    }

    // === VISIBILITY MANAGEMENT ===

    function show() {
        console.log('Onboarding show() called');
        if (!overlay) { console.error('Cannot show: overlay element not found!'); return; }
        if (isVisible) { console.log('Already visible, skipping'); return; }

        overlay.classList.add('show');
        isVisible = true;
        // Navbar hidden via body.onboarding-visible (set by PHP on first paint, and re-applied here when returning to onboarding via "New Page")
        document.body.classList.add('onboarding-visible');

        // Activate sidebar onboarding mode (hides theme selector, disables hover panel)
        window.enterOnboardingMode?.();

        // Build the gallery the first time we show (deferred until templates are loaded)
        buildGallery();

        console.log('Onboarding shown');
    }

    function hide(immediate = false) {
        if (!overlay || !isVisible) return;

        // Restore normal sidebar behaviour
        window.exitOnboardingMode?.();

        document.body.classList.remove('onboarding-visible');

        if (immediate) {
            overlay.classList.remove('show');
            isVisible = false;
        } else {
            overlay.classList.add('fade-out');
            setTimeout(() => {
                overlay.classList.remove('show', 'fade-out');
                isVisible = false;
            }, 300);
        }

        console.log('Onboarding hidden');
    }

    function checkVisibility() {
        console.log('Onboarding checkVisibility called');

        // Hide loading overlay if still showing
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay && loadingOverlay.classList.contains('show')) {
            loadingOverlay.classList.remove('show');
        }

        const isEmpty = (typeof window.currentTemplateUrl === 'undefined' || !window.currentTemplateUrl);
        console.log('  - isEmpty (no template):', isEmpty);

        if (isEmpty && !isVisible) {
            show();
        } else if (!isEmpty && isVisible) {
            hide(true);
        } else if (!isEmpty && !isVisible) {
            // Existing page reload: template is already loaded but the onboarding
            // overlay was never shown in this session (show() was never called).
            // Keep sidebar collapsed by default (same behaviour as new template insert).
            window._collapseAfterOnboarding = true;
            window.exitOnboardingMode?.();
        }

        // Ensure navbar is visible when a template is present (e.g. restored draft)
        if (!isEmpty) {
            document.body.classList.remove('onboarding-visible');
        }
    }

    // === COMPLETION DETECTION ===

    function hookIntoTemplateInsert() {
        if (!window.__originalInsertFullTemplateIntoPreview) {
            window.__originalInsertFullTemplateIntoPreview = window.insertFullTemplateIntoPreview;
        }
        if (typeof window.__originalInsertFullTemplateIntoPreview !== 'function') return;

        window.insertFullTemplateIntoPreview = function(template) {
            const wasVisible = isVisible;
            if (wasVisible && !step1Complete) {
                hide(true);
            }
            const result = window.__originalInsertFullTemplateIntoPreview.apply(this, arguments);
            if (wasVisible && !step1Complete) {
                setTimeout(() => markStepComplete(), 100);
            }
            return result;
        };
    }

    // === STEP COMPLETION ===
    function markStepComplete() {
        step1Complete = true;
        triggerConfetti();
        console.log('Onboarding: template chosen, step complete');
    }

    // === CONFETTI ===
    function triggerConfetti() {
        if (typeof confetti === 'undefined') return;
        confetti({ particleCount: 100, spread: 70, origin: { x: 0.5, y: 0.5 }, colors: CONFETTI_COLORS_TEMPLATE, ticks: 200 });
    }

    // === PUBLIC API ===
    window.Onboarding = {
        show,
        hide,
        checkVisibility,
        filterByCategory,
        renderSearchResults: renderSearchResultsInGallery,
        clearSearch,
        reset: function() {
            step1Complete = false;
            hasBuiltGallery = false;
            activeCategories.clear();
            onboardingSearchQuery = '';
            if (galleryEl) galleryEl.innerHTML = '';
            if (categoryFiltersEl) categoryFiltersEl.innerHTML = '';
            if (searchInputEl) { searchInputEl.value = ''; }
            if (searchClearEl)  { searchClearEl.style.display = 'none'; }
            console.log('Onboarding reset');
        }
    };

    // Initialize when DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
