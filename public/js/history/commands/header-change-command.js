/**
 * Header Change Command - Undo/Redo support for header content and config changes
 * Captures full header state (layout, config, content) before and after changes
 */
class HeaderChangeCommand {
    constructor({ beforeState, afterState, context }) {
        this.beforeState = beforeState;  // deep copy of headerState
        this.afterState = afterState;    // deep copy of headerState
        this.context = context || {};    // { action: 'edit-logo' | 'edit-menu' | 'edit-actions' | 'style-change' | 'layout-change' | 'remove' }
    }

    execute() {
        this._apply(this.afterState);
    }

    undo() {
        this._apply(this.beforeState);
    }

    redo() {
        this._apply(this.afterState);
    }

    _apply(state) {
        if (!window.HeaderModal) return;

        // If state is null/empty, remove header
        if (!state || !state.layoutId) {
            window.HeaderModal.remove();
            return;
        }

        // Restore full state
        window.HeaderModal.restore(state);

        // Rebuild header HTML from restored state
        const iframe = document.getElementById('preview-iframe');
        if (!iframe || !iframe.contentWindow) return;

        // Get the current page theme
        const themePanel = document.getElementById('theme-panel');
        let themeClass = '';
        if (themePanel) {
            const themeNameEl = document.getElementById('current-theme-name');
            if (themeNameEl) {
                const themeName = themeNameEl.textContent.toLowerCase();
                themeClass = `theme-${themeName}`;
            }
        }

        // Generate HTML from state
        const html = this._buildNavHtml(state);

        // Send to iframe
        iframe.contentWindow.postMessage({
            type: 'SET_HEADER',
            data: { html, themeClass }
        }, '*');

        // Apply CTA settings
        setTimeout(() => {
            iframe.contentWindow.postMessage({
                type: 'UPDATE_HEADER_CTA',
                data: {
                    ctaType: state.config.ctaType,
                    ctaStyle: state.config.ctaStyle
                }
            }, '*');
        }, 50);

        // Sync sidebar controls if header panel is open
        const panel = document.getElementById('header-panel');
        if (panel && panel.classList.contains('show')) {
            // Force refresh of step 2 controls
            setTimeout(() => {
                if (window.HeaderModal && window.HeaderModal._syncControls) {
                    window.HeaderModal._syncControls();
                }
            }, 100);
        }
    }

    _buildNavHtml(state) {
        // This is a simplified version - ideally we'd reuse the builder from header-modal.js
        // For now, we'll just trigger a rebuild via the HeaderModal API
        // The actual HTML generation happens in header-modal.js

        // Create a temporary function to access private builders
        const temp = document.createElement('div');
        temp.innerHTML = this._getLayoutTemplate(state);
        const nav = temp.querySelector('nav');

        if (!nav) return '';

        // Apply config classes
        const CLASS_PREFIXES = {
            background: 'nav-bg-',
            corners: 'nav-corners-',
            theme: 'nav-theme-',
            shadow: 'nav-shadow-'
        };

        Object.keys(CLASS_PREFIXES).forEach(key => {
            const prefix = CLASS_PREFIXES[key];
            Array.from(nav.classList)
                .filter(cls => cls.startsWith(prefix))
                .forEach(cls => nav.classList.remove(cls));
            nav.classList.add(prefix + state.config[key]);
        });

        return nav.outerHTML;
    }

    _getLayoutTemplate(state) {
        // Delegate to HeaderModal to generate HTML
        // This is a workaround since we can't access private functions
        // The proper solution would be to expose a public API in HeaderModal
        if (window.HeaderModal && window.HeaderModal.getConfig) {
            const currentConfig = window.HeaderModal.getConfig();

            // Temporarily set state, get HTML, restore
            const originalState = JSON.parse(JSON.stringify(currentConfig));
            window.HeaderModal.restore(state);

            // Trigger rebuild to get HTML
            // We'll need to expose this via the HeaderModal API
            const html = ''; // TODO: get HTML from HeaderModal

            window.HeaderModal.restore(originalState);
            return html;
        }

        return '';
    }

    getLabel() {
        const action = this.context.action || 'header-change';
        const labels = {
            'edit-logo': 'Edit logo',
            'edit-menu': 'Edit menu',
            'edit-actions': 'Edit actions',
            'style-change': 'Header style',
            'layout-change': 'Header layout',
            'remove': 'Remove header',
            'add': 'Add header'
        };
        return labels[action] || 'Header change';
    }
}

// Export for use in app.js
if (typeof window !== 'undefined') {
    window.HeaderChangeCommand = HeaderChangeCommand;
}
