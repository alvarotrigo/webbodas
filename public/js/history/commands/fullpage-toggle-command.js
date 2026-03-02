class FullpageToggleCommand {
    /**
     * @param {Object} options
     * @param {boolean} options.beforeEnabled - Was fullpage enabled before
     * @param {boolean} options.afterEnabled - Is fullpage enabled after
     */
    constructor({ beforeEnabled, afterEnabled }) {
        this.beforeEnabled = beforeEnabled;
        this.afterEnabled = afterEnabled;
        this.label = afterEnabled ? 'Enable FullPage.js' : 'Disable FullPage.js';
    }
    
    applyState(enabled) {
        // Update the global fullpageEnabled variable
        if (typeof window.fullpageEnabled !== 'undefined') {
            window.fullpageEnabled = enabled;
        }

        // Update the toggle checkbox UI
        const fullpageToggle = document.getElementById('fullpage-toggle');
        if (fullpageToggle) {
            fullpageToggle.checked = enabled;
        }

        // Show/hide advanced settings button
        const advancedSettings = document.getElementById('fullpage-advanced-settings');
        if (advancedSettings) {
            if (enabled) {
                advancedSettings.classList.remove('hidden');
            } else {
                advancedSettings.classList.add('hidden');
                // Close modal if open
                const advancedModal = document.getElementById('fullpage-advanced-modal');
                if (advancedModal) {
                    advancedModal.classList.remove('show');
                }
            }
        }

        // Schedule autosave
        if (typeof window.scheduleAutosave === 'function') {
            window.scheduleAutosave();
        }
    }
    
    execute() {
        this.applyState(this.afterEnabled);
    }
    
    undo() {
        this.applyState(this.beforeEnabled);
    }
    
    redo() {
        this.applyState(this.afterEnabled);
    }
}

window.FullpageToggleCommand = FullpageToggleCommand;
