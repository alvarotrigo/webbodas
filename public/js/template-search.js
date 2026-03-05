/**
 * Template Search Functionality
 *
 * Reemplaza section-search.js para la versión Wedding Editor.
 * Busca templates por:
 *   1) Nombre de archivo: categoria, nombre, tags (parseados desde id del template)
 *   2) Color principal del template (via colorCategory + searchTerms de colores.json)
 *
 * Depende de:
 *   - window.allTemplates     → cargado en app.js tras loadTemplatesFromApi()
 *   - window.templateColors   → array de colores con searchTerms (de colores.json)
 *   - window.createTemplateCard          → función de app.js expuesta globalmente
 *   - window.attachTemplateCardHoverScroll → función de app.js expuesta globalmente
 *   - Fuse.js                 → ya cargado por section-search.js desde CDN
 */

(function () {
    'use strict';

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    function init() {
        waitForTemplates().then(() => {
            return loadFuseJS();
        }).then(() => {
            initializeTemplateSearch();
        }).catch((err) => {
            console.error('[TemplateSearch] Error al inicializar:', err);
        });
    }

    /**
     * Espera a que window.allTemplates esté disponible.
     */
    function waitForTemplates(maxAttempts = 80) {
        return new Promise((resolve) => {
            let attempts = 0;
            const check = () => {
                if (window.allTemplates && window.allTemplates.length > 0) {
                    resolve();
                } else if (attempts < maxAttempts) {
                    attempts++;
                    setTimeout(check, 150);
                } else {
                    console.warn('[TemplateSearch] allTemplates no disponible tras esperar.');
                    resolve();
                }
            };
            check();
        });
    }

    // Estado de carga de Fuse.js (reutiliza el ya cargado por section-search si existe)
    function loadFuseJS() {
        if (window.Fuse) return Promise.resolve();
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/fuse.js@6.6.2/dist/fuse.min.js';
            script.async = true;
            script.onload = resolve;
            script.onerror = () => reject(new Error('[TemplateSearch] No se pudo cargar Fuse.js'));
            document.head.appendChild(script);
        });
    }

    /**
     * Construye el mapa de colorCategory → searchTerms a partir de window.templateColors.
     * Incluye el id y name del color como términos adicionales.
     */
    function buildColorSearchMap(colors) {
        const map = {};
        if (!Array.isArray(colors)) return map;
        colors.forEach(color => {
            if (!color || !color.id) return;
            const terms = new Set();
            // id y name del color
            terms.add(color.id.toLowerCase());
            if (color.name) {
                color.name.toLowerCase().split(/[\s&,]+/).forEach(t => t && terms.add(t));
            }
            // searchTerms del JSON
            if (Array.isArray(color.searchTerms)) {
                color.searchTerms.forEach(t => t && terms.add(t.toLowerCase()));
            }
            // description como fallback
            if (color.description) {
                color.description.toLowerCase().split(/[,\s]+/).forEach(t => t.length > 3 && terms.add(t));
            }
            map[color.id] = Array.from(terms);
        });
        return map;
    }

    /**
     * Construye el array de datos indexables a partir de los templates.
     * Cada entrada tiene los campos que Fuse.js buscará.
     */
    function buildSearchableData(templates, colorSearchMap) {
        return templates.map(t => {
            const id = t.id || '';
            // Separar el filename en palabras individuales (por __ y -)
            const filenameWords = id
                .split('__')
                .join(' ')
                .split('-')
                .join(' ')
                .split('_')
                .join(' ')
                .toLowerCase()
                .split(/\s+/)
                .filter(Boolean);

            const colorTerms = (t.colorCategory && colorSearchMap[t.colorCategory])
                ? colorSearchMap[t.colorCategory]
                : [];

            return {
                id: t.id,
                name: t.name || '',
                category: t.category || '',
                tags: Array.isArray(t.tags) ? t.tags : [],
                filenameWords,
                colorSearchTerms: colorTerms,
                // Campo de texto plano para búsqueda combinada
                searchText: [
                    t.name || '',
                    t.category || '',
                    (t.tags || []).join(' '),
                    filenameWords.join(' '),
                    colorTerms.join(' ')
                ].filter(Boolean).join(' ').toLowerCase(),
                // Referencia original para renderizar
                _template: t,
            };
        });
    }

    function initializeTemplateSearch() {
        const searchInput = document.getElementById('section-search-input') || document.querySelector('.search-bar');
        const searchLoader = document.getElementById('search-loader');
        const categoryHoverPanel = document.getElementById('category-hover-panel');
        const sectionsGrid = document.getElementById('category-sections-grid');

        if (!searchInput || !categoryHoverPanel || !sectionsGrid) {
            console.warn('[TemplateSearch] Elementos del DOM no encontrados.');
            return;
        }

        const templates = window.allTemplates || [];
        const colorSearchMap = buildColorSearchMap(window.templateColors || []);
        const searchableData = buildSearchableData(templates, colorSearchMap);

        const fuseOptions = {
            keys: [
                { name: 'name',              weight: 0.4 },
                { name: 'category',          weight: 0.3 },
                { name: 'tags',              weight: 0.3 },
                { name: 'filenameWords',     weight: 0.25 },
                { name: 'colorSearchTerms',  weight: 0.35 },
                { name: 'searchText',        weight: 0.1 },
            ],
            includeScore: true,
            minMatchCharLength: 2,
            threshold: 0.35,
            ignoreLocation: true,
            shouldSort: true,
        };

        const fuse = new Fuse(searchableData, fuseOptions);

        let isSearchActive = false;
        let searchTimeout = null;

        function showLoader() {
            if (searchLoader) searchLoader.classList.add('active');
        }

        function hideLoader() {
            if (searchLoader) searchLoader.classList.remove('active');
        }

        function showTemplateSearchResults(matchedTemplates) {
            if (!matchedTemplates || matchedTemplates.length === 0) {
                showNoResults();
                return;
            }

            const headerTitle = categoryHoverPanel.querySelector('.category-hover-panel-title');
            if (headerTitle) {
                headerTitle.innerHTML = `
                    <i data-lucide="search"></i>
                    <span>Templates encontrados (${matchedTemplates.length})</span>
                `;
            }

            // Modo template para que el color-filter CSS sea visible y las cards se rendericen bien
            categoryHoverPanel.classList.add('template-mode');
            sectionsGrid.classList.remove('category-sections-grid');
            sectionsGrid.classList.add('template-cards-grid');
            sectionsGrid.classList.remove('template-preview-full-wrap');
            sectionsGrid.innerHTML = '';

            if (typeof window.createTemplateCard === 'function') {
                matchedTemplates.forEach(template => {
                    // styleKey 'all' asegura que el click handler de app.js encuentre el template
                    const cardHtml = window.createTemplateCard(template, 'all');
                    sectionsGrid.insertAdjacentHTML('beforeend', cardHtml);
                });
                if (typeof window.attachTemplateCardHoverScroll === 'function') {
                    window.attachTemplateCardHoverScroll(sectionsGrid);
                }
            }

            sectionsGrid.scrollTop = 0;

            if (typeof window.resetCurrentCategory === 'function') {
                window.resetCurrentCategory();
            }

            categoryHoverPanel.dataset.searchMode = 'true';
            categoryHoverPanel.classList.add('show');

            // Cerrar panel de tema si está abierto
            if (typeof closeThemePanel === 'function') {
                closeThemePanel();
            }

            if (window.lucide && window.lucide.createIcons) {
                window.lucide.createIcons();
            }
        }

        function showNoResults() {
            const headerTitle = categoryHoverPanel.querySelector('.category-hover-panel-title');
            if (headerTitle) {
                headerTitle.innerHTML = `
                    <i data-lucide="search"></i>
                    <span>Sin resultados</span>
                `;
            }

            categoryHoverPanel.classList.add('template-mode');
            sectionsGrid.classList.remove('category-sections-grid');
            sectionsGrid.classList.add('template-cards-grid');
            sectionsGrid.innerHTML = `
                <div style="padding: 3rem 1rem; text-align: center; color: var(--secondary-text, #666);">
                    <p style="font-size: 0.9rem; margin: 0;">No se encontraron templates con ese término.</p>
                    <p style="font-size: 0.8rem; margin-top: 0.5rem; opacity: 0.7;">Prueba con colores (ej: "rosa", "azul"), estilos (ej: "rustic", "luxe") o palabras clave.</p>
                </div>
            `;

            sectionsGrid.scrollTop = 0;

            if (typeof window.resetCurrentCategory === 'function') {
                window.resetCurrentCategory();
            }

            categoryHoverPanel.dataset.searchMode = 'true';
            categoryHoverPanel.classList.add('show');

            if (window.lucide && window.lucide.createIcons) {
                window.lucide.createIcons();
            }
        }

        function hideSearchPanel() {
            categoryHoverPanel.dataset.searchMode = 'false';
            categoryHoverPanel.classList.remove('show');
            categoryHoverPanel.classList.remove('template-mode');
            sectionsGrid.classList.remove('template-cards-grid');
            sectionsGrid.classList.add('category-sections-grid');
        }

        function performSearch(query) {
            const trimmedQuery = query.trim().toLowerCase();

            if (!trimmedQuery) {
                if (isSearchActive) {
                    hideSearchPanel();
                    hideLoader();
                    isSearchActive = false;
                }
                return;
            }

            isSearchActive = true;
            showLoader();

            // Búsqueda con Fuse.js
            const results = fuse.search(trimmedQuery);

            // Post-proceso: boost para coincidencias exactas en name o tags
            const processedResults = results.map(result => {
                const item = result.item;
                const nameLower = (item.name || '').toLowerCase();
                let score = result.score || 1;

                if (nameLower === trimmedQuery) {
                    score *= 0.1;
                } else if (nameLower.startsWith(trimmedQuery)) {
                    score *= 0.6;
                } else if (nameLower.includes(trimmedQuery)) {
                    score *= 0.8;
                }

                // Boost para coincidencia exacta en colorSearchTerms
                if (item.colorSearchTerms && item.colorSearchTerms.includes(trimmedQuery)) {
                    score *= 0.5;
                }

                // Boost para coincidencia exacta en filenameWords
                if (item.filenameWords && item.filenameWords.includes(trimmedQuery)) {
                    score *= 0.7;
                }

                return { ...result, score };
            });

            processedResults.sort((a, b) => (a.score || 1) - (b.score || 1));

            const matchedTemplates = processedResults.map(r => r.item._template);

            setTimeout(() => {
                hideLoader();
                showTemplateSearchResults(matchedTemplates);
            }, 100);
        }

        function debounceSearch(query) {
            clearTimeout(searchTimeout);
            showLoader();
            searchTimeout = setTimeout(() => {
                performSearch(query);
            }, 300);
        }

        // Escuchar el input
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value;
            if (query.trim()) {
                debounceSearch(query);
            } else {
                clearTimeout(searchTimeout);
                hideLoader();
                hideSearchPanel();
                isSearchActive = false;
            }
        });

        // Escape para limpiar
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                searchInput.value = '';
                clearTimeout(searchTimeout);
                hideLoader();
                hideSearchPanel();
                isSearchActive = false;
            }
        });

        // Botón de cierre del panel
        const closeButton = categoryHoverPanel.querySelector('.category-hover-panel-close');
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                hideSearchPanel();
                searchInput.value = '';
                isSearchActive = false;
                if (typeof hideCategoryPanel === 'function') {
                    hideCategoryPanel();
                }
            });
        }

        console.log('[TemplateSearch] Inicializado con', templates.length, 'templates.');
    }
})();
