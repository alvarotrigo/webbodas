/**
 * navbar-section-sync.js
 *
 * Sincroniza los enlaces del navbar con las secciones presentes en el DOM.
 * Cuando se elimina una sección, oculta el enlace del navbar correspondiente.
 * Cuando se restaura una sección (undo), vuelve a mostrar el enlace.
 *
 * Funciona con las tres variantes de navbar de los templates de boda:
 *   - Classic/Minimal: <nav> con <a href="#id"> directos
 *   - Rustic:          <nav> con <a href="#id"> directos
 *   - Luxe:            <nav> con logo <a class="logo"> + <ul><li><a href="#id">
 */

(function () {
    'use strict';

    function sync() {
        const previewContent = document.getElementById('preview-content');
        if (!previewContent) return;

        const nav = previewContent.querySelector(':scope > nav');
        if (!nav) return;

        // Recopilar todos los IDs de secciones actualmente en el DOM
        const sectionIds = new Set(
            Array.from(
                previewContent.querySelectorAll(':scope > section[id], :scope > footer[id]')
            ).map(function (el) { return el.id; })
        );

        // Buscar todos los enlaces de navegación con href="#..."
        const navLinks = nav.querySelectorAll('a[href^="#"]');

        navLinks.forEach(function (link) {
            // Omitir el enlace del logo (tiene class="logo")
            if (link.classList.contains('logo')) return;

            const href = link.getAttribute('href');
            const targetId = href ? href.substring(1) : '';
            if (!targetId) return;

            // En la estructura <ul><li><a>, ocultar el <li> completo para no romper el layout.
            // En la estructura <a> directo, ocultar el propio enlace.
            const hideTarget = link.closest('li') || link;

            if (!sectionIds.has(targetId)) {
                // La sección no existe: ocultar el elemento de navegación
                hideTarget.style.display = 'none';
                hideTarget.setAttribute('data-nav-hidden', 'true');
            } else {
                // La sección existe: restaurar el elemento si estaba oculto por esta lógica
                if (hideTarget.hasAttribute('data-nav-hidden')) {
                    hideTarget.style.display = '';
                    hideTarget.removeAttribute('data-nav-hidden');
                }
            }
        });
    }

    window.navbarSectionSync = { sync: sync };
}());
