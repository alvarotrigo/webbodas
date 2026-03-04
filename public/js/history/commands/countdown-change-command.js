/**
 * CountdownChangeCommand
 * Command pattern for undo/redo of wedding date changes in countdown sections.
 * Follows the same structure as MapChangeCommand.
 */
class CountdownChangeCommand {
    /**
     * @param {Object} options
     * @param {string|number} options.sectionNumber
     * @param {string} options.countdownUid
     * @param {{ weddingDate: string }} options.beforeState
     * @param {{ weddingDate: string }} options.afterState
     * @param {string} [options.label]
     */
    constructor({ sectionNumber, countdownUid, beforeState, afterState, label = 'Event date changed' }) {
        this.sectionNumber = sectionNumber;
        this.countdownUid = countdownUid;
        this.beforeState = beforeState;
        this.afterState = afterState;
        this.label = label;
    }

    _applyState(state, shouldScroll = false) {
        const iframe = document.getElementById('preview-iframe');
        if (!iframe || !iframe.contentWindow) {
            console.warn('CountdownChangeCommand: Preview iframe not ready');
            return;
        }

        iframe.contentWindow.postMessage({
            type: 'APPLY_COUNTDOWN_STATE',
            data: {
                sectionNumber: this.sectionNumber,
                countdownUid: this.countdownUid,
                state,
                shouldScroll
            }
        }, '*');
    }

    execute() {
        this._applyState(this.afterState, false);
    }

    undo() {
        this._applyState(this.beforeState, true);
    }

    redo() {
        this._applyState(this.afterState, true);
    }
}

window.CountdownChangeCommand = CountdownChangeCommand;
