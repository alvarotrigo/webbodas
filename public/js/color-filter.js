/**
 * color-filter.js
 *
 * Módulo de filtrado de templates por color predominante.
 * Renderiza una fila de 12 círculos de colores dentro del category-hover-panel,
 * encima del grid de templates. Solo visible en template-mode (CSS lo gestiona
 * via .category-hover-panel.template-mode .panel-color-filter).
 * Soporta selección múltiple y botón de limpiar.
 *
 * Uso:
 *   window.ColorFilter.init('color-filter-container', coloresArray, callbackFn);
 *
 * El callbackFn recibe un array de ids de colores seleccionados (puede estar vacío).
 */

window.ColorFilter = (function () {
    'use strict';

    /** @type {Set<string>} Ids de colores actualmente seleccionados */
    let _selectedColors = new Set();

    /** @type {Function|null} Callback invocado al cambiar la selección */
    let _onFilterChange = null;

    /** @type {HTMLElement|null} Elemento botón limpiar */
    let _clearBtn = null;

    // ----------------------------------------------------------------
    // Renderizado de la UI
    // ----------------------------------------------------------------

    /**
     * Inicializa y renderiza el filtro de color en el elemento indicado.
     *
     * @param {string}   containerId      Id del elemento contenedor en el DOM
     * @param {Array}    colors           Array de objetos {id, name, hex, description} desde colores.json
     * @param {Function} onFilterChange   Callback(selectedColorIds: string[]) llamado al cambiar selección
     */
    function init(containerId, colors, onFilterChange) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.warn('[ColorFilter] Contenedor no encontrado:', containerId);
            return;
        }
        if (!Array.isArray(colors) || colors.length === 0) {
            console.warn('[ColorFilter] Array de colores vacío o inválido.');
            return;
        }

        _onFilterChange = typeof onFilterChange === 'function' ? onFilterChange : null;
        _selectedColors = new Set();

        container.innerHTML = '';
        // Preservar la clase panel-color-filter (controla visibilidad via CSS) y añadir color-filter-container
        container.className = 'panel-color-filter color-filter-container';

        // Cabecera: solo botón limpiar (sin título)
        const header = document.createElement('div');
        header.className = 'color-filter-header';

        _clearBtn = document.createElement('button');
        _clearBtn.className = 'color-filter-clear';
        _clearBtn.type = 'button';
        _clearBtn.style.display = 'none';
        _clearBtn.setAttribute('aria-label', 'Reset color filter');
        _clearBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="2.5"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
            Reset
        `;
        _clearBtn.addEventListener('click', clearFilter);
        header.appendChild(_clearBtn);

        container.appendChild(header);

        // Grid de círculos (1 fila × 12 columnas)
        const grid = document.createElement('div');
        grid.className = 'color-filter-grid';

        colors.slice(0, 12).forEach(function (color) {
            if (!color || !color.id || !color.hex) return;

            const circle = document.createElement('button');
            circle.type = 'button';
            circle.className = 'color-filter-circle';
            circle.dataset.colorId = color.id;
            circle.title = color.name || color.id;
            circle.setAttribute('aria-label', color.name || color.id);
            circle.setAttribute('aria-pressed', 'false');
            circle.style.backgroundColor = color.hex;

            circle.addEventListener('click', function () {
                toggleColor(color.id, circle);
            });

            grid.appendChild(circle);
        });

        container.appendChild(grid);
    }

    // ----------------------------------------------------------------
    // Lógica de selección
    // ----------------------------------------------------------------

    /**
     * Alterna la selección de un color.
     *
     * @param {string}      colorId  Id del color
     * @param {HTMLElement} circle   Elemento círculo del DOM
     */
    function toggleColor(colorId, circle) {
        if (_selectedColors.has(colorId)) {
            _selectedColors.delete(colorId);
            circle.classList.remove('active');
            circle.setAttribute('aria-pressed', 'false');
        } else {
            _selectedColors.add(colorId);
            circle.classList.add('active');
            circle.setAttribute('aria-pressed', 'true');
        }
        _updateClearButton();
        _notify();
    }

    /**
     * Limpia todos los filtros activos y notifica el cambio.
     */
    function clearFilter() {
        _selectedColors.clear();

        const circles = document.querySelectorAll('.color-filter-circle.active');
        circles.forEach(function (c) {
            c.classList.remove('active');
            c.setAttribute('aria-pressed', 'false');
        });

        _updateClearButton();
        _notify();
    }

    /**
     * Limpia el estado visual del filtro sin disparar el callback.
     * Usado al cambiar de categoría para resetear sin re-renderizar el panel.
     */
    function clearFilterSilent() {
        _selectedColors.clear();

        const circles = document.querySelectorAll('.color-filter-circle.active');
        circles.forEach(function (c) {
            c.classList.remove('active');
            c.setAttribute('aria-pressed', 'false');
        });

        _updateClearButton();
        // Sin _notify() — no dispara el callback
    }

    /**
     * Devuelve el array de ids de colores actualmente seleccionados.
     *
     * @returns {string[]}
     */
    function getSelectedColors() {
        return Array.from(_selectedColors);
    }

    // ----------------------------------------------------------------
    // Helpers internos
    // ----------------------------------------------------------------

    function _updateClearButton() {
        if (!_clearBtn) return;
        _clearBtn.style.display = _selectedColors.size > 0 ? '' : 'none';
    }

    function _notify() {
        if (typeof _onFilterChange === 'function') {
            _onFilterChange(Array.from(_selectedColors));
        }
    }

    // ----------------------------------------------------------------
    // API pública
    // ----------------------------------------------------------------

    return {
        init: init,
        clearFilter: clearFilter,
        clearFilterSilent: clearFilterSilent,
        getSelectedColors: getSelectedColors,
    };
}());
