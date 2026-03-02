// Simple Inline Text Editor
class SimpleEditor {
    constructor() {
        this.currentElement = null;
        this.toolbar = null;
        this.init();
    }

    init() {
        this.createToolbar();
        this.setupEventListeners();
        this.makeElementsEditable();
    }

    createToolbar() {
        // Create floating toolbar
        this.toolbar = document.createElement('div');
        this.toolbar.className = 'floating-toolbar';
        this.toolbar.innerHTML = `
            <button onclick="window.simpleEditor.formatText('bold')" title="Bold (Ctrl+B)">
                <strong>B</strong>
            </button>
            <button onclick="window.simpleEditor.formatText('italic')" title="Italic (Ctrl+I)">
                <em>I</em>
            </button>
            <button onclick="window.simpleEditor.formatText('underline')" title="Underline (Ctrl+U)">
                <u>U</u>
            </button>
            <span class="separator">|</span>
            <button onclick="window.simpleEditor.addLink()" title="Add Link">
                🔗
            </button>
            <button onclick="window.simpleEditor.changeColor()" title="Text Color">
                🎨
            </button>
            <span class="separator">|</span>
            <button onclick="window.simpleEditor.clearFormat()" title="Clear Format">
                🗑️
            </button>
        `;
        document.body.appendChild(this.toolbar);
    }

    setupEventListeners() {
        // Listen for clicks on editable elements
        document.addEventListener('click', (e) => {
            // Don't start editing if clicking on toolbar or menu
            if (e.target.closest('.floating-toolbar') || e.target.closest('.section-menu')) {
                return;
            }
            
            if (this.isEditableElement(e.target)) {
                this.startEditing(e.target);
            } else {
                // Click outside - stop editing
                this.stopEditing();
            }
        });

        // Listen for new sections being added
        window.addEventListener('message', (event) => {
            if (event.data.type === 'ADD_SECTION') {
                console.log('New section added, making elements editable...');
                setTimeout(() => {
                    this.makeElementsEditable();
                }, 200);
            }
        });
    }

    isEditableElement(element) {
        if (!element || element.closest('.section-menu')) return false;
        
        const editableTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'a', 'button'];
        return editableTags.includes(element.tagName.toLowerCase());
    }

    makeElementsEditable() {
        const elements = document.querySelectorAll('section h1, section h2, section h3, section h4, section h5, section h6, section p, section a, section button');
        elements.forEach(element => {
            if (!element.closest('.section-menu') && !element.closest('.floating-toolbar')) {
                element.style.cursor = 'pointer';
                element.addEventListener('mouseenter', () => {
                    if (!this.currentElement) {
                        element.style.outline = '1px dashed #3b82f6';
                    }
                });
                element.addEventListener('mouseleave', () => {
                    if (!this.currentElement) {
                        element.style.outline = '';
                    }
                });
            }
        });
    }

    startEditing(element) {
        // Always stop any previous editing session first
        this.stopEditing();

        this.currentElement = element;
        
        // Make element editable
        element.contentEditable = true;
        element.focus();

        // Add visual feedback
        element.style.outline = '2px solid #3b82f6';
        element.style.outlineOffset = '2px';
        element.style.borderRadius = '4px';

        // Show floating toolbar
        this.showToolbar(element);
    }

    stopEditing() {
        if (!this.currentElement) return;

        // Remove visual feedback
        this.currentElement.style.outline = '';
        this.currentElement.style.outlineOffset = '';
        this.currentElement.style.borderRadius = '';

        // Make non-editable
        this.currentElement.contentEditable = false;

        // Hide toolbar
        this.hideToolbar();

        this.currentElement = null;
    }

    showToolbar(element) {
        // Position toolbar
        const rect = element.getBoundingClientRect();
        this.toolbar.style.cssText = `
            position: fixed;
            top: ${rect.top - 50}px;
            left: ${rect.left}px;
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
            padding: 8px;
            z-index: 10000;
            display: flex;
            gap: 4px;
            align-items: center;
        `;
        this.toolbar.style.display = 'flex';
    }

    hideToolbar() {
        if (this.toolbar) {
            this.toolbar.style.display = 'none';
        }
    }

    formatText(command) {
        if (!this.currentElement) return;
        
        document.execCommand(command, false, null);
        this.currentElement.focus();
    }

    addLink() {
        if (!this.currentElement) return;
        
        const url = prompt('Enter URL:');
        if (url) {
            document.execCommand('createLink', false, url);
        }
        this.currentElement.focus();
    }

    changeColor() {
        if (!this.currentElement) return;
        
        const color = prompt('Enter color (e.g., #ff0000, red):');
        if (color) {
            document.execCommand('foreColor', false, color);
        }
        this.currentElement.focus();
    }

    clearFormat() {
        if (!this.currentElement) return;
        
        document.execCommand('removeFormat', false, null);
        this.currentElement.focus();
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.simpleEditor = new SimpleEditor();
});

// Add keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (document.activeElement && document.activeElement.contentEditable === 'true') {
        switch (e.key) {
            case 'b':
                if (e.ctrlKey) {
                    e.preventDefault();
                    window.simpleEditor.formatText('bold');
                }
                break;
            case 'i':
                if (e.ctrlKey) {
                    e.preventDefault();
                    window.simpleEditor.formatText('italic');
                }
                break;
            case 'u':
                if (e.ctrlKey) {
                    e.preventDefault();
                    window.simpleEditor.formatText('underline');
                }
                break;
            case 'Escape':
                window.simpleEditor.stopEditing();
                break;
        }
    }
}); 