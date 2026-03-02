class ElementRemoveCommand {
    /**
     * @param {Object} options
     * @param {string|number} options.sectionNumber
     * @param {string} [options.sectionUid] - Unique section instance ID for precise targeting
     * @param {string} options.elementHtml - HTML of the removed element
     * @param {number} options.elementIndex - Position of element among siblings
     * @param {string} options.parentSelector - CSS selector to identify parent element
     * @param {string} [options.label]
     */
    constructor({ sectionNumber, sectionUid, elementHtml, elementIndex, parentSelector, label = 'Element removed' }) {
        this.sectionNumber = sectionNumber;
        this.sectionUid = sectionUid; // Unique ID to target correct section when same template used multiple times
        this.elementHtml = elementHtml;
        this.elementIndex = elementIndex;
        this.parentSelector = parentSelector;
        this.label = label;
    }
    
    execute() {
        // The element has already been removed by the user action
        // This is just for the command stack
        console.log('ElementRemoveCommand: execute (element already removed)');
    }
    
    undo() {
        // Restore the element
        console.log('ElementRemoveCommand: undo - restoring element');
        const iframe = document.getElementById('preview-iframe');
        if (!iframe || !iframe.contentWindow) {
            console.warn('ElementRemoveCommand: Preview iframe not ready');
            return;
        }
        
        iframe.contentWindow.postMessage({
            type: 'RESTORE_ELEMENT',
            data: {
                sectionNumber: this.sectionNumber,
                sectionUid: this.sectionUid,
                elementHtml: this.elementHtml,
                elementIndex: this.elementIndex,
                parentSelector: this.parentSelector,
                shouldScroll: true
            }
        }, '*');
    }
    
    redo() {
        // Remove the element again
        console.log('ElementRemoveCommand: redo - removing element again');
        const iframe = document.getElementById('preview-iframe');
        if (!iframe || !iframe.contentWindow) {
            console.warn('ElementRemoveCommand: Preview iframe not ready');
            return;
        }
        
        iframe.contentWindow.postMessage({
            type: 'REMOVE_ELEMENT',
            data: {
                sectionNumber: this.sectionNumber,
                sectionUid: this.sectionUid,
                parentSelector: this.parentSelector,
                elementIndex: this.elementIndex,
                shouldScroll: true
            }
        }, '*');
    }
}

window.ElementRemoveCommand = ElementRemoveCommand;


