class ThemeChangeCommand {
    /**
     * @param {Object} options
     * @param {string} options.beforeTheme
     * @param {string} options.afterTheme
     * @param {string} [options.label]
     */
    constructor({ beforeTheme, afterTheme, label = 'Theme updated' }) {
        this.beforeTheme = beforeTheme;
        this.afterTheme = afterTheme;
        this.label = label;
    }
    
    applyTheme(themeId) {
        if (window.applyThemeFromCommand && typeof window.applyThemeFromCommand === 'function') {
            window.applyThemeFromCommand(themeId);
        } else if (typeof selectTheme === 'function') {
            selectTheme(themeId, true);
        }
    }
    
    execute() {
        if (!this.afterTheme) return;
        this.applyTheme(this.afterTheme);
    }
    
    undo() {
        if (!this.beforeTheme) return;
        this.applyTheme(this.beforeTheme);
    }
}

window.ThemeChangeCommand = ThemeChangeCommand;


