/**
 * MapChangeCommand
 * Command pattern for undo/redo of map location changes.
 * Follows the same structure as InlineSVGChangeCommand.
 */
class MapChangeCommand {
    /**
     * @param {Object} options
     * @param {string|number} options.sectionNumber
     * @param {string} options.mapUid
     * @param {{ src: string }} options.beforeState
     * @param {{ src: string }} options.afterState
     * @param {string} [options.label]
     */
    constructor({ sectionNumber, mapUid, beforeState, afterState, label = 'Location changed' }) {
        this.sectionNumber = sectionNumber;
        this.mapUid = mapUid;
        this.beforeState = beforeState;
        this.afterState = afterState;
        this.label = label;
    }

    _applyState(state, shouldScroll = false) {
        const iframe = document.getElementById('preview-iframe');
        if (!iframe || !iframe.contentWindow) {
            console.warn('MapChangeCommand: Preview iframe not ready');
            return;
        }

        iframe.contentWindow.postMessage({
            type: 'APPLY_MAP_STATE',
            data: {
                sectionNumber: this.sectionNumber,
                mapUid: this.mapUid,
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

window.MapChangeCommand = MapChangeCommand;
