class ImageChangeCommand {
    /**
     * @param {Object} options
     * @param {string|number} options.sectionNumber
     * @param {string} options.imageUid
     * @param {Object} options.beforeState
     * @param {Object} options.afterState
     * @param {string} [options.label]
     */
    constructor({ sectionNumber, imageUid, beforeState, afterState, label = 'Image updated' }) {
        this.sectionNumber = sectionNumber;
        this.imageUid = imageUid;
        this.beforeState = beforeState;
        this.afterState = afterState;
        this.label = label;
    }
    
    applyState(state, shouldScroll = false) {
        const iframe = document.getElementById('preview-iframe');
        if (!iframe || !iframe.contentWindow) {
            console.warn('ImageChangeCommand: Preview iframe not ready');
            return;
        }
        
        // Send both before and after states to help identify the image
        // when the section has been restored (beforeState helps find the current image)
        iframe.contentWindow.postMessage({
            type: 'APPLY_IMAGE_STATE',
            data: {
                sectionNumber: this.sectionNumber,
                imageUid: this.imageUid,
                state,
                beforeState: this.beforeState,
                afterState: this.afterState,
                shouldScroll
            }
        }, '*');
    }
    
    execute() {
        // Don't scroll when initially executing (user just finished changing image)
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

window.ImageChangeCommand = ImageChangeCommand;

