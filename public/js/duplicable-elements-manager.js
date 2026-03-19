/**
 * Duplicable Elements Manager
 * Handles duplication of elements with data-fp-duplicable-right or data-fp-duplicable-down.
 * - Shows a circle with + sign: to the right (vertically centered) or below (horizontally centered)
 * - On click: clones the element and inserts it as next sibling (right = after, down = after in DOM)
 * - Integrates with history manager for undo/redo
 */

class DuplicableElementsManager {
    constructor() {
        this.overlayContainer = null;
        this.indicator = null;
        this.activeElement = null;
        this.placement = null; // 'right' | 'down'
        this.duplicableElements = new Set();
        this.lastMouseX = 0;
        this.lastMouseY = 0;

        this.createOverlayContainer();
        this.createIndicator();
        this.setupMouseTracking();
        this.setupScrollHandler();
    }

    createOverlayContainer() {
        const createContainer = () => {
            const existing = document.getElementById('duplicable-indicators-overlay');
            if (existing) {
                this.overlayContainer = existing;
                return;
            }
            this.overlayContainer = document.createElement('div');
            this.overlayContainer.id = 'duplicable-indicators-overlay';
            this.overlayContainer.style.position = 'fixed';
            this.overlayContainer.style.top = '0';
            this.overlayContainer.style.left = '0';
            this.overlayContainer.style.width = '100%';
            this.overlayContainer.style.height = '100%';
            this.overlayContainer.style.pointerEvents = 'none';
            this.overlayContainer.style.zIndex = '9999';
            document.body.appendChild(this.overlayContainer);
        };
        if (document.body) {
            createContainer();
        } else {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', createContainer);
            } else {
                setTimeout(createContainer, 0);
            }
        }
    }

    createIndicator() {
        const create = () => {
            if (!this.overlayContainer) {
                setTimeout(create, 100);
                return;
            }
            this.indicator = document.createElement('div');
            this.indicator.className = 'duplicable-indicator';
            this.indicator.innerHTML = `
                <div class="duplicable-indicator-content" title="Duplicate">
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                </div>
            `;
            this.indicator.style.position = 'fixed';
            this.indicator.style.opacity = '0';
            this.indicator.style.pointerEvents = 'auto';
            this.indicator.style.transition = 'opacity 0.15s ease, transform 0.15s ease';

            this.indicator.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.handleIndicatorClick();
            });
            this.indicator.addEventListener('mouseleave', () => {
                this.hideIndicator();
            });
            this.overlayContainer.appendChild(this.indicator);
        };
        create();
    }

    setupMouseTracking() {
        window.addEventListener('mousemove', (e) => {
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
        }, { passive: true });
    }

    /**
     * Update indicator position to stay fixed relative to the active element (e.g. on scroll).
     */
    updateIndicatorPosition() {
        if (!this.activeElement || !this.indicator || !this.placement) return;
        const rect = this.activeElement.getBoundingClientRect();
        const size = 38;
        const isRight = this.placement === 'right';
        if (isRight) {
            this.indicator.style.left = `${rect.right - size / 2}px`;
            this.indicator.style.top = `${rect.top + rect.height / 2 - size / 2}px`;
            this.indicator.style.right = 'auto';
            this.indicator.style.bottom = 'auto';
        } else {
            this.indicator.style.top = `${rect.bottom - size / 2}px`;
            this.indicator.style.left = `${rect.left + rect.width / 2 - size / 2}px`;
            this.indicator.style.right = 'auto';
            this.indicator.style.bottom = 'auto';
        }
    }

    setupScrollHandler() {
        let scrollPending = false;
        window.addEventListener('scroll', () => {
            if (!this.activeElement || parseFloat(this.indicator?.style.opacity || '0') === 0) return;
            if (scrollPending) return;
            scrollPending = true;
            requestAnimationFrame(() => {
                scrollPending = false;
                if (!this.activeElement) return;
                const rect = this.activeElement.getBoundingClientRect();
                const isMouseOverElement = (
                    this.lastMouseX >= rect.left && this.lastMouseX <= rect.right &&
                    this.lastMouseY >= rect.top && this.lastMouseY <= rect.bottom
                );
                // Keep indicator position in sync with element (so it stays fixed relative to the element on scroll)
                this.updateIndicatorPosition();
                if (!isMouseOverElement) this.hideIndicator();
            });
        }, { passive: true, capture: true });
    }

    initForSection(sectionElement) {
        if (!sectionElement) return;
        if (sectionElement.hasAttribute('data-duplicable-initialized')) return;

        sectionElement.setAttribute('data-duplicable-initialized', 'true');

        const rightElements = sectionElement.querySelectorAll('[data-fp-duplicable-right]');
        const downElements = sectionElement.querySelectorAll('[data-fp-duplicable-down]');
        const all = new Set([...rightElements, ...downElements]);

        all.forEach(el => this.attachListeners(el));
    }

    attachListeners(element) {
        if (this.duplicableElements.has(element)) return;

        const handleMouseEnter = () => this.handleMouseEnter(element);
        const handleMouseLeave = () => this.handleMouseLeave(element);

        element.addEventListener('mouseenter', handleMouseEnter);
        element.addEventListener('mouseleave', handleMouseLeave);
        this.duplicableElements.add(element);
        element._duplicableHandlers = { mouseenter: handleMouseEnter, mouseleave: handleMouseLeave };
    }

    handleMouseEnter(element) {
        if (document.body.classList.contains('fullscreen-mode')) return;
        if (this.activeElement && this.activeElement !== element) {
            this.activeElement.classList.remove('duplicable-element-active');
        }

        const rect = element.getBoundingClientRect();
        const size = 38;
        const isRight = element.hasAttribute('data-fp-duplicable-right');
        // Position circle at the element border (half overlapping) so it sits on the blue outline
        if (isRight) {
            this.placement = 'right';
            this.indicator.style.left = `${rect.right - size / 2}px`;
            this.indicator.style.top = `${rect.top + rect.height / 2 - size / 2}px`;
            this.indicator.style.right = 'auto';
            this.indicator.style.bottom = 'auto';
        } else {
            this.placement = 'down';
            this.indicator.style.top = `${rect.bottom - size / 2}px`;
            this.indicator.style.left = `${rect.left + rect.width / 2 - size / 2}px`;
            this.indicator.style.right = 'auto';
            this.indicator.style.bottom = 'auto';
        }

        this.indicator.style.opacity = '1';
        this.indicator.style.transform = 'scale(1)';
        element.classList.add('duplicable-element-active');
        this.activeElement = element;
    }

    handleMouseLeave(element) {
        setTimeout(() => {
            if (!this.indicator.matches(':hover') && this.activeElement === element) {
                this.hideIndicator();
            }
        }, 100);
    }

    hideIndicator() {
        this.indicator.style.opacity = '0';
        this.indicator.style.transform = 'scale(0.9)';
        if (this.activeElement) {
            this.activeElement.classList.remove('duplicable-element-active');
            this.activeElement = null;
        }
        this.placement = null;
    }

    handleIndicatorClick() {
        if (this.activeElement) {
            this.duplicateElement(this.activeElement);
            this.hideIndicator();
        }
    }

    getParentSelector(parent) {
        if (parent.id) return `#${parent.id}`;
        if (parent.className) {
            const classes = parent.className.trim().split(/\s+/).filter(c => c);
            if (classes.length > 0) {
                const escaped = classes.map(c => c.replace(/[:.[\]/]/g, '\\$&'));
                return '.' + escaped.join('.');
            }
        }
        return parent.tagName.toLowerCase();
    }

    duplicateElement(element) {
        const section = element.closest('.section');
        const sectionNumber = section ? section.getAttribute('data-section') : null;
        const sectionUid = section ? section.getAttribute('data-section-uid') : null;
        const parent = element.parentElement;
        if (!parent) return;

        const clone = element.classList.contains('form-group')
            ? this.createGenericFormGroupElement(element)
            : element.cloneNode(true);
        const insertIndex = Array.from(parent.children).indexOf(element) + 1;

        if (insertIndex >= parent.children.length) {
            parent.appendChild(clone);
        } else {
            parent.insertBefore(clone, parent.children[insertIndex]);
        }

        // After insertion, assign a unique name/id to cloned form fields
        this.assignUniqueFormFieldName(clone);

        const cloneHtml = clone.outerHTML;

        this.attachListeners(clone);
        if (window.removableElementsManager && (clone.hasAttribute('data-fp-dynamic') || clone.hasAttribute('data-fp-dynamic-item'))) {
            window.removableElementsManager.addIndicatorToElement(clone);
        }
        // Ensure newly inserted generic form-group labels become inline-editable via TinyMCE.
        if (window.tinyMCEEditor && typeof window.tinyMCEEditor.initEditor === 'function') {
            setTimeout(() => {
                try { window.tinyMCEEditor.initEditor(); } catch (e) { /* noop */ }
            }, 10);
        }

        if (window.parent && window.parent.postMessage) {
            window.parent.postMessage({
                type: 'ELEMENT_DUPLICATED',
                data: {
                    sectionNumber,
                    sectionUid,
                    parentSelector: this.getParentSelector(parent),
                    insertIndex,
                    cloneHtml
                }
            }, '*');
        }
    }

    createGenericFormGroupElement(sourceElement) {
        const group = document.createElement('div');
        group.className = sourceElement.className || 'form-group reveal';

        if (!group.classList.contains('form-group')) group.classList.add('form-group');
        if (!group.classList.contains('reveal')) group.classList.add('reveal');

        // Preserve dynamic/duplicable behavior so remove/duplicate indicators keep working.
        const preservedAttrs = ['data-fp-dynamic', 'data-fp-dynamic-item', 'data-fp-duplicable-down', 'data-fp-duplicable-right'];
        preservedAttrs.forEach((attr) => {
            if (sourceElement.hasAttribute(attr)) {
                const val = sourceElement.getAttribute(attr);
                if (val === null || val === '') group.setAttribute(attr, '');
                else group.setAttribute(attr, val);
            }
        });

        const label = document.createElement('label');
        label.setAttribute('for', 'new-field');
        label.textContent = 'Write new title';

        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'new-field';
        input.name = 'new-field';
        input.required = true;
        input.placeholder = 'Write New Placeholder';

        group.appendChild(label);
        group.appendChild(input);
        return group;
    }

    assignUniqueFormFieldName(clone) {
        const form = clone.closest('form');
        if (!form) return;

        // Drop TinyMCE hidden clones inside this group so the real control gets the new name
        clone.querySelectorAll('input[type="hidden"]').forEach((h) => {
            const n = (h.name || '') + (h.id || '');
            if (/tinymce/i.test(n) || /^mce/i.test(h.name || '') || /^mce/i.test(h.id || '')) {
                h.remove();
            }
        });

        const field = this.getPrimaryFormFieldInGroup(clone);
        if (!field) return;

        const fieldsWithName = (form, name) =>
            Array.from(form.querySelectorAll('input, select, textarea')).filter((el) => el.name === name);
        const fieldsWithId = (form, id) =>
            Array.from(form.querySelectorAll('[id]')).filter((el) => el.id === id);

        // Redo / reload: already the only owner of name+id — only fix label[for]
        if (field.name && field.id === field.name &&
            fieldsWithName(form, field.name).filter((el) => el !== field).length === 0 &&
            fieldsWithId(form, field.id).filter((el) => el !== field).length === 0) {
            const labelOnly = clone.querySelector('label[for]');
            if (labelOnly && labelOnly.getAttribute('for') !== field.id) {
                labelOnly.setAttribute('for', field.id);
            }
            return;
        }

        const raw = String(field.name || field.id || 'field').trim() || 'field';
        const baseName = raw.replace(/-\d+$/, '');

        let suffix = 2;
        let newName;
        for (;;) {
            newName = baseName + '-' + suffix;
            const nameClash = fieldsWithName(form, newName).some((el) => el !== field);
            const idClash = fieldsWithId(form, newName).some((el) => el !== field);
            if (!nameClash && !idClash) break;
            suffix++;
        }

        field.name = newName;
        field.id = newName;

        const label = clone.querySelector('label[for]');
        if (label) label.setAttribute('for', newName);
    }

    /**
     * Skip TinyMCE hidden inputs — they must not receive the duplicated field name.
     */
    getPrimaryFormFieldInGroup(formGroup) {
        if (!formGroup) return null;
        const fields = formGroup.querySelectorAll('input, select, textarea');
        for (let i = 0; i < fields.length; i++) {
            const el = fields[i];
            if (el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') return el;
            const t = (el.type || '').toLowerCase();
            if (t === 'hidden' || t === 'submit' || t === 'button' || t === 'image' || t === 'reset') continue;
            const nm = (el.name || '') + (el.id || '');
            if (/tinymce/i.test(nm) || /^mce/i.test(el.name || '') || /^mce/i.test(el.id || '')) continue;
            return el;
        }
        return formGroup.querySelector('select, textarea') || formGroup.querySelector('input');
    }

    addIndicatorToElement(element) {
        if (!element) return;
        const isDuplicable = element.hasAttribute('data-fp-duplicable-right') ||
            element.hasAttribute('data-fp-duplicable-down');
        if (!isDuplicable) return;
        this.attachListeners(element);
    }

    async initializeExistingSections() {
        if (document.readyState === 'loading') {
            await new Promise(r => document.addEventListener('DOMContentLoaded', r));
        }
        document.querySelectorAll('.section').forEach(section => {
            section.removeAttribute('data-duplicable-initialized');
            this.initForSection(section);
        });
    }

    reinitializeSection(sectionElement) {
        if (!sectionElement) return;
        sectionElement.removeAttribute('data-duplicable-initialized');
        this.initForSection(sectionElement);
    }

    destroy() {
        this.duplicableElements.forEach(el => {
            if (el._duplicableHandlers) {
                el.removeEventListener('mouseenter', el._duplicableHandlers.mouseenter);
                el.removeEventListener('mouseleave', el._duplicableHandlers.mouseleave);
                delete el._duplicableHandlers;
            }
            el.classList.remove('duplicable-element-active');
        });
        this.duplicableElements.clear();
        if (this.indicator) { this.indicator.remove(); this.indicator = null; }
        if (this.overlayContainer) { this.overlayContainer.remove(); this.overlayContainer = null; }
        document.querySelectorAll('.section[data-duplicable-initialized]').forEach(s => s.removeAttribute('data-duplicable-initialized'));
        this.activeElement = null;
    }
}

const duplicableStyle = document.createElement('style');
duplicableStyle.textContent = `
    .duplicable-indicator {
        position: fixed;
        width: 38px;
        height: 38px;
        border-radius: 50%;
        background-color: #fff;
        border: 2px solid #e5e7eb;
        box-shadow: 0 2px 8px rgba(0,0,0,0.12);
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: auto;
        z-index: 10000;
        cursor: pointer;
        color: #374151;
    }
    .duplicable-indicator:hover {
        background-color: #f9fafb;
        border-color: #3b82f6;
        color: #2563eb;
        box-shadow: 0 2px 12px rgba(59,130,246,0.25);
    }
    .duplicable-indicator:active {
        transform: scale(0.95);
    }
    .duplicable-indicator-content { display: flex; align-items: center; justify-content: center; }
    .duplicable-element-active {
        outline: 2px solid #93c5fd !important;
        outline-offset: 2px !important;
        transition-property: opacity, transform, background, background-color, color, border, border-color, box-shadow, filter, backdrop-filter !important;
    }
`;
document.head.appendChild(duplicableStyle);

if (!window.duplicableElementsManager) {
    window.duplicableElementsManager = new DuplicableElementsManager();
}
window.DuplicableElementsManager = DuplicableElementsManager;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DuplicableElementsManager;
}
