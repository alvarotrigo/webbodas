/**
 * Command for duplicating an element (undo = remove clone, redo = insert clone again).
 */
class ElementDuplicateCommand {
    /**
     * @param {Object} options
     * @param {string|number} options.sectionNumber
     * @param {string} [options.sectionUid]
     * @param {string} options.parentSelector
     * @param {number} options.insertIndex - Index of the duplicated element in parent
     * @param {string} options.cloneHtml
     * @param {string} [options.label]
     */
    constructor({ sectionNumber, sectionUid, parentSelector, insertIndex, cloneHtml, label = 'Duplicate element' }) {
        this.sectionNumber = sectionNumber;
        this.sectionUid = sectionUid;
        this.parentSelector = parentSelector;
        this.insertIndex = insertIndex;
        this.cloneHtml = cloneHtml;
        this.label = label;
    }

    execute() {
        // Duplication already performed in iframe when user clicked +
        console.log('ElementDuplicateCommand: execute (duplicate already applied)');
    }

    undo() {
        const iframe = document.getElementById('preview-iframe');
        if (!iframe || !iframe.contentWindow) return;
        iframe.contentWindow.postMessage({
            type: 'REMOVE_ELEMENT',
            data: {
                sectionNumber: this.sectionNumber,
                sectionUid: this.sectionUid,
                parentSelector: this.parentSelector,
                elementIndex: this.insertIndex,
                shouldScroll: true
            }
        }, '*');
    }

    redo() {
        const iframe = document.getElementById('preview-iframe');
        if (!iframe || !iframe.contentWindow) return;
        iframe.contentWindow.postMessage({
            type: 'INSERT_DUPLICATE_ELEMENT',
            data: {
                sectionNumber: this.sectionNumber,
                sectionUid: this.sectionUid,
                parentSelector: this.parentSelector,
                insertIndex: this.insertIndex,
                cloneHtml: this.cloneHtml,
                shouldScroll: true
            }
        }, '*');
    }
}

window.ElementDuplicateCommand = ElementDuplicateCommand;
