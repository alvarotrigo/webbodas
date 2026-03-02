class InlineSVGChangeCommand {
    /**
     * @param {Object} options
     * @param {string|number} options.sectionNumber
     * @param {string} options.svgUid
     * @param {Object} options.beforeState
     * @param {Object} options.afterState
     * @param {string} [options.label]
     */
    constructor({ sectionNumber, svgUid, beforeState, afterState, label = 'Icon changed' }) {
        this.sectionNumber = sectionNumber;
        this.svgUid = svgUid;
        this.beforeState = beforeState;
        this.afterState = afterState;
        this.label = label;
    }
    
    applyState(state, shouldScroll = false) {
        const iframe = document.getElementById('preview-iframe');
        if (!iframe || !iframe.contentWindow) {
            console.warn('InlineSVGChangeCommand: Preview iframe not ready');
            return;
        }
        
        // Send message to iframe to apply SVG state
        iframe.contentWindow.postMessage({
            type: 'APPLY_INLINE_SVG_STATE',
            data: {
                sectionNumber: this.sectionNumber,
                svgUid: this.svgUid,
                state,
                beforeState: this.beforeState,
                afterState: this.afterState,
                shouldScroll
            }
        }, '*');
    }
    
    execute() {
        // Don't scroll when initially executing (user just finished changing icon)
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

window.InlineSVGChangeCommand = InlineSVGChangeCommand;
