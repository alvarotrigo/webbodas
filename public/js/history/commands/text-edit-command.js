/**
 * Command for text editing via TinyMCE
 * Stores only the changed element's content for efficient undo/redo
 */
class TextEditCommand {
    /**
     * @param {Object} params
     * @param {string|number} params.sectionNumber - The section containing the edited element
     * @param {string} params.elementId - The unique ID of the edited element
     * @param {string} params.beforeContent - Content before the edit
     * @param {string} params.afterContent - Content after the edit
     * @param {Object} [params.context] - Context for applying changes
     */
    constructor({ sectionNumber, elementId, beforeContent, afterContent, context }) {
        this.sectionNumber = sectionNumber;
        this.elementId = elementId;
        this.beforeContent = beforeContent;
        this.afterContent = afterContent;
        this.context = context;
    }
    
    /**
     * Apply a specific content state to the element
     * @param {string} content - The content to apply
     * @param {boolean} shouldScroll - Whether to scroll to the section
     */
    applyContent(content, shouldScroll = false) {
        const iframe = document.getElementById('preview-iframe');
        if (!iframe || !iframe.contentWindow) {
            console.warn('TextEditCommand: Preview iframe not ready');
            return;
        }
        
        iframe.contentWindow.postMessage({
            type: 'APPLY_TEXT_STATE',
            data: {
                sectionNumber: this.sectionNumber,
                elementId: this.elementId,
                content: content,
                shouldScroll: shouldScroll
            }
        }, '*');
    }
    
    execute() {
        // Don't scroll when initially executing (user just finished editing)
        this.applyContent(this.afterContent, false);
    }
    
    undo() {
        // Scroll to section on undo so user can see what changed
        this.applyContent(this.beforeContent, true);
    }
    
    redo() {
        // Scroll to section on redo so user can see what changed
        this.applyContent(this.afterContent, true);
    }
}

window.TextEditCommand = TextEditCommand;

