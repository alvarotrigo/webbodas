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
    let isVisible = false;
    let hasBuiltGallery = false;
    let step1Complete = false;
    let activeCategoryKey = 'all';

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
    let currentPopupTemplate = null;
    let currentPopupThemeId = null;
    let popupTemplateList = [];

    // === INITIALIZATION ===
    function init() {
        console.log('Onboarding initializing...');

        overlay    = document.getElementById('onboarding-overlay');
        galleryEl  = document.getElementById('onboarding-template-gallery');

        if (!overlay) {
            console.warn('Onboarding overlay not found');
            return;
        }

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

        // Render using the current active category filter
        filterByCategory(activeCategoryKey);

        // Mark the default category as active in the sidebar
        window.setActiveSidebarCategory?.(activeCategoryKey);
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

        selectBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            selectTemplate(template);
        });

        previewBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openPreviewPopup(template);
        });

        // Clicking the card image also opens the preview popup
        card.addEventListener('click', () => openPreviewPopup(template));

        return card;
    }

    function selectTemplate(template) {
        if (typeof window.insertFullTemplateIntoPreview === 'function') {
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
        return activeCategoryKey === 'all'
            ? all.filter(t => t.id && !isNaN(Number(t.id)))
            : all.filter(t => t.id && !isNaN(Number(t.id)) && t.category === activeCategoryKey);
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

        currentPopupThemeId = window.currentTheme || null;
        buildPopupThemesList();
        updateNavButtons();

        popup.classList.add('show');
        document.body.style.overflow = 'hidden';

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

    function setupPopupListeners() {
        if (popupCloseBtn) popupCloseBtn.addEventListener('click', closePreviewPopup);

        if (popupChooseBtn) {
            popupChooseBtn.addEventListener('click', () => {
                if (!currentPopupTemplate) return;
                const chosenTemplate = currentPopupTemplate;
                const chosenTheme = currentPopupThemeId;
                closePreviewPopup();
                if (chosenTheme && typeof window.applyThemeFromCommand === 'function') {
                    window.applyThemeFromCommand(chosenTheme, { keepPanelOpen: true });
                }
                selectTemplate(chosenTemplate);
            });
        }

        if (popupNavPrev) popupNavPrev.addEventListener('click', () => navigateTemplate(-1));
        if (popupNavNext) popupNavNext.addEventListener('click', () => navigateTemplate(1));
        if (popupThemesToggle) popupThemesToggle.addEventListener('click', toggleThemesPanel);
        if (popupThemesReopen) popupThemesReopen.addEventListener('click', toggleThemesPanel);

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

        // Clear category active state — search has no selected category
        document.querySelectorAll('#category-list .category-item').forEach(el => el.classList.remove('onboarding-active'));

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
     * Restores the gallery to the last active category.
     * Called when the search input is cleared in onboarding mode.
     */
    function clearSearch() {
        filterByCategory(activeCategoryKey);
        window.setActiveSidebarCategory?.(activeCategoryKey);
    }

    /**
     * Filters the onboarding gallery to show only templates from the given category.
     * Called by sidebar category click when in onboarding mode.
     */
    function filterByCategory(key) {
        activeCategoryKey = key;

        const allTemplates = window.allTemplates;
        if (!Array.isArray(allTemplates)) return;

        const filtered = key === 'all'
            ? allTemplates.filter(t => t.id && !isNaN(Number(t.id)))
            : allTemplates.filter(t => t.id && !isNaN(Number(t.id)) && t.category === key);

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

        // Scroll gallery back to top when category changes
        if (overlay) overlay.scrollTop = 0;
    }

    // === VISIBILITY MANAGEMENT ===

    function show() {
        console.log('Onboarding show() called');
        if (!overlay) { console.error('Cannot show: overlay element not found!'); return; }
        if (isVisible) { console.log('Already visible, skipping'); return; }

        overlay.classList.add('show');
        isVisible = true;

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
            activeCategoryKey = 'all';
            if (galleryEl) galleryEl.innerHTML = '';
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
