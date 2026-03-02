class OpacityChangeCommand {
    /**
     * @param {Object} options
     * @param {string} options.sectionUid - Unique ID of the section
     * @param {number} options.beforeOpacity - Opacity before change (0-1)
     * @param {number} options.afterOpacity - Opacity after change (0-1)
     * @param {string} [options.label]
     */
    constructor({ sectionUid, beforeOpacity, afterOpacity, label = 'Overlay opacity change' }) {
        this.sectionUid = sectionUid;
        this.beforeOpacity = beforeOpacity;
        this.afterOpacity = afterOpacity;
        this.label = label;
    }
    
    applyOpacity(opacity, shouldScroll = false) {
        const iframe = document.getElementById('preview-iframe');
        if (!iframe || !iframe.contentWindow) {
            console.warn('OpacityChangeCommand: preview iframe not ready');
            return;
        }
        
        iframe.contentWindow.postMessage({
            type: 'APPLY_OPACITY_STATE',
            data: {
                sectionUid: this.sectionUid,
                opacity,
                shouldScroll
            }
        }, '*');
    }
    
    execute() {
        // Don't scroll when initially executing (user just changed opacity)
        this.applyOpacity(this.afterOpacity, false);
    }
    
    undo() {
        // Scroll to section on undo so user can see what changed
        this.applyOpacity(this.beforeOpacity, true);
    }
    
    redo() {
        // Scroll to section on redo so user can see what changed
        this.applyOpacity(this.afterOpacity, true);
    }
}

window.OpacityChangeCommand = OpacityChangeCommand;
