class InlineVideoChangeCommand {
    /**
     * @param {Object} options
     * @param {string|number} options.sectionNumber
     * @param {string} options.videoUid
     * @param {Object} options.beforeState
     * @param {Object} options.afterState
     * @param {string} [options.label]
     */
    constructor({ sectionNumber, videoUid, beforeState, afterState, label = 'Video updated' }) {
        this.sectionNumber = sectionNumber;
        this.videoUid = videoUid;
        this.beforeState = beforeState;
        this.afterState = afterState;
        this.label = label;
    }
    
    applyState(state, shouldScroll = false) {
        const iframe = document.getElementById('preview-iframe');
        if (!iframe || !iframe.contentWindow) {
            console.warn('InlineVideoChangeCommand: Preview iframe not ready');
            return;
        }
        
        // Send message to iframe to apply video state
        iframe.contentWindow.postMessage({
            type: 'APPLY_INLINE_VIDEO_STATE',
            data: {
                sectionNumber: this.sectionNumber,
                videoUid: this.videoUid,
                state,
                beforeState: this.beforeState,
                afterState: this.afterState,
                shouldScroll
            }
        }, '*');
    }
    
    execute() {
        // Don't scroll when initially executing (user just finished changing video)
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

window.InlineVideoChangeCommand = InlineVideoChangeCommand;

