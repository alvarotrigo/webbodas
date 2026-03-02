// Quill loading state flags
let quillLoadState = {
    loaded: false,
    loading: false,
    callbacks: []
};

// Inline Text Editor using Quill.js
class InlineEditor {
    constructor() {
        this.quill = null;
        this.currentElement = null;
        this.init();
    }

    init() {
        this.loadQuill();
        this.setupEventListeners();
    }

    loadQuill() {
        // Check if Quill is already loaded
        if (quillLoadState.loaded || window.Quill) {
            console.log('Quill already loaded, setting up editor');
            quillLoadState.loaded = true;
            this.setupQuill();
            return;
        }
        
        // Check if script is already being loaded
        if (quillLoadState.loading) {
            console.log('Quill already loading, queuing setup');
            quillLoadState.callbacks.push(() => this.setupQuill());
            return;
        }
        
        // Mark as loading
        quillLoadState.loading = true;
        
        // Load Quill CSS (only once)
        if (!document.querySelector('link[href*="quill"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://cdn.quilljs.com/1.3.6/quill.snow.css';
            document.head.appendChild(link);
        }

        // Load Quill JS
        const script = document.createElement('script');
        script.src = 'https://cdn.quilljs.com/1.3.6/quill.min.js';
        script.onload = () => {
            console.log('Quill loaded successfully');
            quillLoadState.loaded = true;
            quillLoadState.loading = false;
            
            // Setup this instance
            this.setupQuill();
            
            // Run any queued callbacks
            quillLoadState.callbacks.forEach(cb => cb());
            quillLoadState.callbacks = [];
        };
        script.onerror = () => {
            console.error('Failed to load Quill');
            quillLoadState.loading = false;
        };
        document.head.appendChild(script);
    }

    setupQuill() {
        // Create editor container
        const container = document.createElement('div');
        container.id = 'inline-editor';
        container.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 9999;
            display: none;
            align-items: center;
            justify-content: center;
        `;
        document.body.appendChild(container);

        // Initialize Quill
        this.quill = new Quill('#inline-editor', {
            theme: 'snow',
            modules: {
                toolbar: [
                    ['bold', 'italic', 'underline'],
                    [{ 'color': [] }, { 'background': [] }],
                    ['link'],
                    ['clean']
                ]
            },
            placeholder: 'Start editing...'
        });

        // Add close button
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '✕';
        closeBtn.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            width: 30px;
            height: 30px;
            border: none;
            background: #ef4444;
            color: white;
            border-radius: 50%;
            cursor: pointer;
            font-size: 16px;
            z-index: 10001;
        `;
        closeBtn.onclick = () => this.hideEditor();
        container.appendChild(closeBtn);
    }

    setupEventListeners() {
        // Listen for clicks on editable elements
        document.addEventListener('click', (e) => {
            if (this.isEditableElement(e.target)) {
                this.showEditor(e.target);
            }
        });

        // Listen for clicks outside to close
        document.addEventListener('click', (e) => {
            if (e.target.id === 'inline-editor' && this.quill) {
                this.hideEditor();
            }
        });
    }

    isEditableElement(element) {
        if (!element || element.closest('.section-menu')) return false;
        
        const editableTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'div'];
        return editableTags.includes(element.tagName.toLowerCase());
    }

    showEditor(element) {
        if (!this.quill) return;

        this.currentElement = element;
        const container = document.getElementById('inline-editor');
        
        // Set content
        this.quill.root.innerHTML = element.innerHTML;
        
        // Show editor
        container.style.display = 'flex';
        
        // Focus on editor
        this.quill.focus();
    }

    hideEditor() {
        if (!this.quill || !this.currentElement) return;

        // Save content back to element
        this.currentElement.innerHTML = this.quill.root.innerHTML;
        
        // Hide editor
        const container = document.getElementById('inline-editor');
        container.style.display = 'none';
        
        this.currentElement = null;
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Prevent multiple instantiations
    if (window.inlineEditor) {
        console.log('InlineEditor already initialized, skipping');
        return;
    }
    window.inlineEditor = new InlineEditor();
}); 