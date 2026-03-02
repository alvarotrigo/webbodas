class BackgroundChangeCommand {
    /**
     * @param {Object} options
     * @param {number|string} options.sectionNumber
     * @param {Object} options.beforeState
     * @param {Object} options.afterState
     * @param {string} [options.label]
     */
    constructor({ sectionNumber, beforeState, afterState, label = 'Background change' }) {
        this.sectionNumber = sectionNumber;
        this.beforeState = beforeState;
        this.afterState = afterState;
        this.label = label;
    }
    
    applyState(state, shouldScroll = false) {
        const iframe = document.getElementById('preview-iframe');
        if (!iframe || !iframe.contentWindow) {
            console.warn('BackgroundChangeCommand: preview iframe not ready');
            return;
        }
        
        iframe.contentWindow.postMessage({
            type: 'APPLY_BACKGROUND_STATE',
            data: {
                sectionNumber: this.sectionNumber,
                state,
                shouldScroll
            }
        }, '*');
    }
    
    execute() {
        // Don't scroll when initially executing (user just changed background)
        this.applyState(this.afterState, false);
    }
    
    undo() {
        // Scroll to section on undo so user can see what changed
        this.applyState(this.beforeState, true);
    }
    
    redo() {
        // Scroll to section on redo so user can see what changed
        this.applyState(this.afterState, true);
    }
}

window.BackgroundChangeCommand = BackgroundChangeCommand;

