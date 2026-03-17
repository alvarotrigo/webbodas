class InlineEmojiChangeCommand {
    /**
     * @param {Object} options
     * @param {string|number} options.sectionNumber
     * @param {string} options.emojiUid
     * @param {Object} options.beforeState
     * @param {Object} options.afterState
     * @param {string} [options.label]
     */
    constructor({ sectionNumber, emojiUid, beforeState, afterState, label = 'Emoji changed' }) {
        this.sectionNumber = sectionNumber;
        this.emojiUid = emojiUid;
        this.beforeState = beforeState;
        this.afterState = afterState;
        this.label = label;
    }

    applyState(state, shouldScroll = false) {
        const iframe = document.getElementById('preview-iframe');
        if (!iframe || !iframe.contentWindow) {
            console.warn('InlineEmojiChangeCommand: Preview iframe not ready');
            return;
        }

        iframe.contentWindow.postMessage({
            type: 'APPLY_INLINE_EMOJI_STATE',
            data: {
                sectionNumber: this.sectionNumber,
                emojiUid: this.emojiUid,
                state,
                beforeState: this.beforeState,
                afterState: this.afterState,
                shouldScroll
            }
        }, '*');
    }

    execute() {
        this.applyState(this.afterState, false);
    }

    undo() {
        this.applyState(this.beforeState, true);
    }

    redo() {
        this.applyState(this.afterState, true);
    }
}

window.InlineEmojiChangeCommand = InlineEmojiChangeCommand;
