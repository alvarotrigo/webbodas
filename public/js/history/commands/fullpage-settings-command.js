class FullpageSettingsCommand {
    /**
     * @param {Object} options
     * @param {string} options.settingKey - Which setting changed (scrollSpeed, navigation, navigationColor, etc.)
     * @param {any} options.beforeValue - Value before change
     * @param {any} options.afterValue - Value after change
     * @param {string} [options.label] - Custom label for the command
     */
    constructor({ settingKey, beforeValue, afterValue, label = null }) {
        this.settingKey = settingKey;
        this.beforeValue = beforeValue;
        this.afterValue = afterValue;
        this.label = label || `FullPage ${settingKey} change`;
    }
    
    applyValue(value) {
        // Get the UI element for this setting
        let element = null;
        let displayElement = null;
        
        switch (this.settingKey) {
            case 'scrollSpeed':
                element = document.getElementById('fullpage-scroll-speed');
                displayElement = document.getElementById('fullpage-scroll-speed-value');
                if (element) element.value = value;
                if (displayElement) displayElement.textContent = value + ' ms';
                break;
                
            case 'navigation':
                element = document.getElementById('fullpage-navigation');
                if (element) element.checked = value;
                // Update navigation color visibility
                const navigationColorRow = document.getElementById('fullpage-navigation-color-row');
                if (navigationColorRow) {
                    if (value) {
                        navigationColorRow.style.display = '';
                    } else {
                        navigationColorRow.style.display = 'none';
                    }
                }
                break;
                
            case 'navigationColor':
                element = document.getElementById('fullpage-navigation-color');
                displayElement = document.getElementById('fullpage-navigation-color-value');
                if (element) element.value = value;
                if (displayElement) displayElement.textContent = value;
                break;
                
            case 'disableOnMobile':
                element = document.getElementById('fullpage-disable-mobile');
                if (element) element.checked = value;
                break;
                
            case 'scrollBar':
                element = document.getElementById('fullpage-scrollbar');
                if (element) element.checked = value;
                break;
                
            case 'motionFeel':
                element = document.getElementById('fullpage-motion-feel');
                if (element) element.value = value;
                break;
        }
        
        // Update the global fullpageSettings object
        if (window.fullpageSettings) {
            window.fullpageSettings[this.settingKey] = value;
        }
        
        // Trigger fullpage settings update
        if (typeof window.updateFullpageSettings === 'function') {
            window.updateFullpageSettings();
        }
        
        // Schedule preview update if needed
        if (typeof window.scheduleFullpagePreviewUpdate === 'function') {
            window.scheduleFullpagePreviewUpdate();
        }
    }
    
    execute() {
        this.applyValue(this.afterValue);
    }
    
    undo() {
        this.applyValue(this.beforeValue);
    }
    
    redo() {
        this.applyValue(this.afterValue);
    }
}

window.FullpageSettingsCommand = FullpageSettingsCommand;
