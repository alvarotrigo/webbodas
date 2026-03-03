// History Manager - Undo/Redo functionality for the editor
class HistoryManager {
    constructor(context) {
        // Extract context dependencies
        this.context = context;
        this.MAX_HISTORY = 10;
        
        // History state
        this.historyStack = [];
        this.historyIndex = -1;
        this.historyTimeout = null;
        this.isUndoing = false;
        this.isRestoring = false; // Track if restore is in progress
        this.historySaveInProgress = false;
        this.lastSavedStateHash = null;
        
        // Command-based history state (for operation-based undo/redo)
        this.commandStack = [];
        this.commandIndex = -1;
        
        // Initialize from localStorage if available
        // this.loadFromLocalStorage(); // DISABLED: Not saving to localStorage anymore
    }
    
    // Execute a command (Command Pattern)
    executeCommand(command) {
        if (!command || typeof command.execute !== 'function' || typeof command.undo !== 'function') {
            console.warn('HistoryManager: Invalid command provided', command);
            return;
        }
        
        // If we're not at the end of the stack, remove all redoable commands
        if (this.commandIndex < this.commandStack.length - 1) {
            this.commandStack = this.commandStack.slice(0, this.commandIndex + 1);
        }
        
        try {
            command.execute();
        } catch (error) {
            console.error('HistoryManager: Command execution failed', error);
            return;
        }
        
        this.commandStack.push(command);
        
        // Enforce max history size
        if (this.commandStack.length > this.MAX_HISTORY) {
            this.commandStack.shift();
        }
        
        this.commandIndex = this.commandStack.length - 1;
        this.updateButtons();
        
        if (typeof window.scheduleAutosave === 'function') {
            window.scheduleAutosave();
        }
    }
    
    hasCommandUndo() {
        return this.commandIndex >= 0;
    }
    
    hasCommandRedo() {
        return this.commandIndex < this.commandStack.length - 1;
    }
    
    // Save current state to history
    save() {
        // Don't save history during undo/redo operations, restoration, or when clearing draft
        if (this.isUndoing || this.context.isRestoring || this.context.isClearingDraft) {
            if (this.context.isDeveloperMode) {
                console.log('🚫 History: Save blocked', {
                    isUndoing: this.isUndoing,
                    isRestoring: this.context.isRestoring,
                    isClearingDraft: this.context.isClearingDraft
                });
            }
            return;
        }
        
        // Prevent concurrent history saves
        if (this.historySaveInProgress) {
            // If a save is already in progress, queue another save after it completes
            setTimeout(() => this.save(), 100);
            return;
        }
        
        this.historySaveInProgress = true;
        
        // Request current state from iframe
        const iframe = document.getElementById('preview-iframe');
        if (!iframe || !iframe.contentWindow) {
            this.historySaveInProgress = false;
            return;
        }
        
        // Generate unique request ID for this history request
        const requestId = 'history_' + Date.now() + '_' + Math.random();
        
        const handleResponse = (event) => {
            if (event.data.type === 'TEMPLATE_DATA' && event.data.requestId === requestId) {
                const { fullHtml, templateHeadHtml, theme, fullpageEnabled, animationsEnabled } = event.data.data;
                
                // Crear snapshot de historial con fullHtml y templateHeadHtml
                const snapshot = {
                    fullHtml: fullHtml || '',
                    templateHeadHtml: templateHeadHtml || '',
                    theme: theme || this.context.currentTheme,
                    fullpageEnabled: fullpageEnabled || false,
                    animationsEnabled: animationsEnabled || false,
                    fullpageSettings: this.context.fullpageSettings ? JSON.parse(JSON.stringify(this.context.fullpageSettings)) : null,
                    timestamp: Date.now()
                };
                
                // Hash del estado actual para detectar duplicados
                const stateHash = JSON.stringify({
                    fullHtml: snapshot.fullHtml,
                    theme: snapshot.theme,
                    fullpageEnabled: snapshot.fullpageEnabled,
                    animationsEnabled: snapshot.animationsEnabled,
                    fullpageSettings: snapshot.fullpageSettings
                });
                
                // Skip if this is the same state as the last saved one
                if (stateHash === this.lastSavedStateHash) {
                    if (this.context.isDeveloperMode) {
                        console.log('🔄 History: Skipping duplicate state (same as last saved)');
                    }
                    window.removeEventListener('message', handleResponse);
                    this.historySaveInProgress = false;
                    return;
                }
                
                // Update last saved state hash
                this.lastSavedStateHash = stateHash;
                
                // Remove any history after current index (if we're in the middle of history)
                if (this.historyIndex < this.historyStack.length - 1) {
                    this.historyStack = this.historyStack.slice(0, this.historyIndex + 1);
                    if (this.context.isDeveloperMode) {
                        console.log('✂️ History: Removed future states after index', this.historyIndex);
                    }
                }
                
                // Add new snapshot
                this.historyStack.push(snapshot);
                
                // Limit history size
                if (this.historyStack.length > this.MAX_HISTORY) {
                    this.historyStack.shift(); // Remove oldest
                    if (this.context.isDeveloperMode) {
                        console.log('📦 History: Max size reached, removed oldest entry');
                    }
                } else {
                    this.historyIndex++;
                }
                
                if (this.context.isDeveloperMode) {
                    console.log('💾 History: Saved new state', {
                        index: this.historyIndex,
                        totalEntries: this.historyStack.length,
                        canUndo: this.historyIndex > 0,
                        canRedo: this.historyIndex < this.historyStack.length - 1
                    });
                }
                
                // Update button states
                this.updateButtons();
                
                // Trigger autosave to save to database
                if (typeof window.scheduleAutosave === 'function') {
                    window.scheduleAutosave();
                }
                
                // Save to localStorage
                // this.saveToLocalStorage(); // DISABLED: Not saving to localStorage anymore
                
                // Remove listener
                window.removeEventListener('message', handleResponse);
                
                // Mark save as complete
                this.historySaveInProgress = false;
            }
        };
        
        // Listen for response
        window.addEventListener('message', handleResponse);
        
        // Solicitar datos completos del template al iframe para snapshot de historial
        iframe.contentWindow.postMessage({
            type: 'GET_TEMPLATE_DATA',
            data: {
                requestId: requestId,
                forHistory: true,
                fullpageEnabled: this.context.fullpageEnabled,
                animationsEnabled: this.context.animationsEnabled
            }
        }, '*');
        
        // Timeout after 3 seconds
        setTimeout(() => {
            window.removeEventListener('message', handleResponse);
            this.historySaveInProgress = false;
        }, 3000);
    }
    
    // Debounced save history for text edits
    saveDebounced() {
        // Clear any pending debounced save
        if (this.historyTimeout) {
            clearTimeout(this.historyTimeout);
        }
        
        // Set new debounced save
        this.historyTimeout = setTimeout(() => {
            if (this.context.isDeveloperMode) {
                console.log('⏱️ History: Debounced save triggered (500ms after last edit)');
            }
            this.save();
        }, 500);
    }
    
    // Undo - restore previous state
    undo() {
        // First, handle command-based undo if available
        if (this.hasCommandUndo()) {
            const command = this.commandStack[this.commandIndex];
            try {
                command.undo();
                this.commandIndex--;
                this.updateButtons();
                
                // Update outline to reflect undone changes
                if (typeof window.sectionOutline !== 'undefined') {
                    setTimeout(() => {
                        window.sectionOutline.refresh();
                    }, 100);
                }
            } catch (error) {
                console.error('HistoryManager: Command undo failed', error);
            }
            return;
        }
        
        // Prevent multiple undo operations from happening simultaneously
        if (this.isRestoring || this.isUndoing) {
            if (this.context.isDeveloperMode) {
                console.log('⛔ History: Undo blocked - restore already in progress', {
                    isRestoring: this.isRestoring,
                    isUndoing: this.isUndoing
                });
            }
            return;
        }
        
        if (this.context.isDeveloperMode) {
            console.log('⏪ History: Undo called', {
                currentIndex: this.historyIndex,
                totalEntries: this.historyStack.length,
                canUndo: this.historyIndex > 0,
                stackEntries: this.historyStack.map((s, i) => ({
                    index: i,
                    fullHtmlLength: s.fullHtml?.length || 0,
                    theme: s.theme
                }))
            });
        }
        
        if (this.historyIndex <= 0) {
            if (this.context.isDeveloperMode) {
                console.log('⛔ History: Cannot undo - already at first state', {
                    historyIndex: this.historyIndex,
                    stackLength: this.historyStack.length
                });
            }
            return; // No history to undo to
        }
        
        this.isUndoing = true;
        this.isRestoring = true;
        this.historyIndex--;
        const snapshot = this.historyStack[this.historyIndex];
        
        if (!snapshot) {
            if (this.context.isDeveloperMode) {
                console.error('❌ History: No snapshot found at index', this.historyIndex);
            }
            this.isUndoing = false;
            this.isRestoring = false;
            return;
        }
        
        if (this.context.isDeveloperMode) {
            console.log('⏪ History: Undo', {
                fromIndex: this.historyIndex + 1,
                toIndex: this.historyIndex,
                totalEntries: this.historyStack.length,
                canUndo: this.historyIndex > 0,
                canRedo: this.historyIndex < this.historyStack.length - 1,
                snapshot: snapshot ? 'found' : 'missing'
            });
        }
        
        // Actualizar hash del estado guardado para coincidir con el snapshot ANTES de restaurar
        const snapshotStateHash = JSON.stringify({
            fullHtml: snapshot.fullHtml || '',
            theme: snapshot.theme || this.context.currentTheme,
            fullpageEnabled: snapshot.fullpageEnabled || false,
            animationsEnabled: snapshot.animationsEnabled || false,
            fullpageSettings: snapshot.fullpageSettings || null
        });
        this.lastSavedStateHash = snapshotStateHash;
        
        // Restore the snapshot (this is async and will set isRestoring = false when done)
        this.restoreSnapshot(snapshot);
        
        // Keep isUndoing true until restore completes to prevent any saves during restore
        // Very short delay - we're doing instant HTML replacement now
        const estimatedRestoreTime = 150; // Just enough for TinyMCE init
        setTimeout(() => {
            this.isUndoing = false;
            this.updateButtons();
            // this.saveToLocalStorage(); // DISABLED: Not saving to localStorage anymore
        }, estimatedRestoreTime);
    }
    
    // Redo - restore next state
    redo() {
        // Handle command-based redo first
        if (this.hasCommandRedo()) {
            const command = this.commandStack[this.commandIndex + 1];
            try {
                // Use command's redo() method if available, otherwise fall back to execute()
                if (typeof command.redo === 'function') {
                    command.redo();
                } else {
                    command.execute();
                }
                this.commandIndex++;
                this.updateButtons();
                
                // Update outline to reflect redone changes
                if (typeof window.sectionOutline !== 'undefined') {
                    setTimeout(() => {
                        window.sectionOutline.refresh();
                    }, 100);
                }
            } catch (error) {
                console.error('HistoryManager: Command redo failed', error);
            }
            return;
        }
        
        // Prevent multiple redo operations from happening simultaneously
        if (this.isRestoring || this.isUndoing) {
            if (this.context.isDeveloperMode) {
                console.log('⛔ History: Redo blocked - restore already in progress', {
                    isRestoring: this.isRestoring,
                    isUndoing: this.isUndoing
                });
            }
            return;
        }
        
        if (this.historyIndex >= this.historyStack.length - 1) {
            if (this.context.isDeveloperMode) {
                console.log('⛔ History: Cannot redo - already at latest state');
            }
            return; // No history to redo to
        }
        
        this.isUndoing = true;
        this.isRestoring = true;
        this.historyIndex++;
        const snapshot = this.historyStack[this.historyIndex];
        
        if (this.context.isDeveloperMode) {
            console.log('⏩ History: Redo', {
                fromIndex: this.historyIndex - 1,
                toIndex: this.historyIndex,
                totalEntries: this.historyStack.length,
                canUndo: this.historyIndex > 0,
                canRedo: this.historyIndex < this.historyStack.length - 1
            });
        }
        
        // Actualizar hash del estado guardado para coincidir con el snapshot ANTES de restaurar
        const snapshotStateHash = JSON.stringify({
            fullHtml: snapshot.fullHtml || '',
            theme: snapshot.theme || this.context.currentTheme,
            fullpageEnabled: snapshot.fullpageEnabled || false,
            animationsEnabled: snapshot.animationsEnabled || false,
            fullpageSettings: snapshot.fullpageSettings || null
        });
        this.lastSavedStateHash = snapshotStateHash;
        
        // Restore the snapshot (this is async and will set isRestoring = false when done)
        this.restoreSnapshot(snapshot);
        
        // Keep isUndoing true until restore completes to prevent any saves during restore
        // Very short delay - we're doing instant HTML replacement now
        const estimatedRestoreTime = 150; // Just enough for TinyMCE init
        setTimeout(() => {
            this.isUndoing = false;
            this.updateButtons();
            // this.saveToLocalStorage(); // DISABLED: Not saving to localStorage anymore
        }, estimatedRestoreTime);
    }
    
    // Restore a history snapshot
    restoreSnapshot(snapshot) {
        // This is now controlled by isRestoring flag in HistoryManager
        // We don't check context.isRestoring here since we're managing it at the HistoryManager level
        
        // Update theme (but skip history save during restore)
        if (snapshot.theme && snapshot.theme !== this.context.currentTheme) {
            this.context.currentTheme = snapshot.theme;
            // Temporarily store the selectTheme function to call it without triggering save
            const originalSelectTheme = this.context.selectTheme;
            // We need to call selectTheme but prevent it from saving history
            // Since isUndoing is true and isRestoring is true, saveHistory should be blocked
            this.context.selectTheme(snapshot.theme);
        }
        
        // Update settings (toggles only affect full-screen preview, not editor view)
        if (snapshot.fullpageEnabled !== undefined) {
            this.context.fullpageEnabled = snapshot.fullpageEnabled;
            const fullpageToggle = document.getElementById('fullpage-toggle');
            if (fullpageToggle) {
                fullpageToggle.checked = this.context.fullpageEnabled;
            }
            // Note: No need to send to iframe - toggles don't affect editor view
        }
        
        if (snapshot.animationsEnabled !== undefined) {
            this.context.animationsEnabled = snapshot.animationsEnabled;
            const animationToggle = document.getElementById('animation-toggle');
            if (animationToggle) {
                animationToggle.checked = this.context.animationsEnabled;
            }
            // Note: No need to send to iframe - toggles don't affect editor view
        }
        
        // Restore fullpageSettings including navigation bullets color
        if (snapshot.fullpageSettings) {
            this.context.fullpageSettings = JSON.parse(JSON.stringify(snapshot.fullpageSettings));
            
            // Update UI elements for fullpage settings
            const navigationColor = document.getElementById('fullpage-navigation-color');
            const navigationColorValue = document.getElementById('fullpage-navigation-color-value');
            if (navigationColor && snapshot.fullpageSettings.navigationColor) {
                navigationColor.value = snapshot.fullpageSettings.navigationColor;
                if (navigationColorValue) {
                    navigationColorValue.textContent = snapshot.fullpageSettings.navigationColor;
                }
            }
            
            const navigation = document.getElementById('fullpage-navigation');
            if (navigation && snapshot.fullpageSettings.navigation !== undefined) {
                navigation.checked = snapshot.fullpageSettings.navigation;
            }
            
            const scrollSpeed = document.getElementById('fullpage-scroll-speed');
            const scrollSpeedValue = document.getElementById('fullpage-scroll-speed-value');
            if (scrollSpeed && snapshot.fullpageSettings.scrollSpeed !== undefined) {
                scrollSpeed.value = snapshot.fullpageSettings.scrollSpeed;
                if (scrollSpeedValue) {
                    scrollSpeedValue.textContent = snapshot.fullpageSettings.scrollSpeed + 'ms';
                }
            }
            
            const disableOnMobile = document.getElementById('fullpage-disable-mobile');
            if (disableOnMobile && snapshot.fullpageSettings.disableOnMobile !== undefined) {
                disableOnMobile.checked = snapshot.fullpageSettings.disableOnMobile;
            }
            
            const scrollBar = document.getElementById('fullpage-scrollbar');
            if (scrollBar && snapshot.fullpageSettings.scrollBar !== undefined) {
                scrollBar.checked = snapshot.fullpageSettings.scrollBar;
            }
            
            const motionFeel = document.getElementById('fullpage-motion-feel');
            if (motionFeel && snapshot.fullpageSettings.motionFeel !== undefined) {
                motionFeel.value = snapshot.fullpageSettings.motionFeel;
            }
        }
        
        const iframe = document.getElementById('preview-iframe');
        if (iframe && iframe.contentWindow) {
            // Restaurar el HTML completo del template directamente (incluyendo assets del head)
            iframe.contentWindow.postMessage({
                type: 'RESTORE_TEMPLATE',
                data: {
                    fullHtml: snapshot.fullHtml || '',
                    templateHeadHtml: snapshot.templateHeadHtml || '',
                    animationsEnabled: this.context.animationsEnabled
                }
            }, '*');

            this.context.updateSectionCounter();

            // Actualizar visibilidad del AI chat
            if (typeof window.AIChat !== 'undefined') {
                window.AIChat.updateVisibility();
            }

            // Actualizar el outline para reflejar el contenido restaurado
            if (typeof window.sectionOutline !== 'undefined') {
                setTimeout(() => {
                    window.sectionOutline.refresh();
                }, 150);
            }

            // Espera corta: reemplazo instantáneo de HTML
            setTimeout(() => {
                this.context.isRestoring = false;
                this.isRestoring = false;
            }, 100);
        } else {
            this.context.isRestoring = false;
            this.isRestoring = false;
        }
    }
    
    // Update undo/redo button states
    updateButtons() {
        const undoBtn = document.getElementById('undo-btn');
        const redoBtn = document.getElementById('redo-btn');
        
        if (undoBtn) {
            const canUndoSnapshots = this.historyIndex > 0;
            undoBtn.disabled = !(this.hasCommandUndo() || canUndoSnapshots);
        }
        
        if (redoBtn) {
            const canRedoSnapshots = this.historyIndex >= 0 && this.historyIndex < this.historyStack.length - 1;
            redoBtn.disabled = !(this.hasCommandRedo() || canRedoSnapshots);
        }
    }
    
    // Clear history
    clear() {
        this.historyStack = [];
        this.historyIndex = -1;
        this.lastSavedStateHash = null;
        this.commandStack = [];
        this.commandIndex = -1;
        // localStorage.removeItem('fp_editor_history'); // DISABLED: Not saving to localStorage anymore
        this.updateButtons();
    }
    
    // Save history to localStorage
    saveToLocalStorage() {
        try {
            const historyData = {
                stack: this.historyStack,
                index: this.historyIndex,
                timestamp: Date.now()
            };
            localStorage.setItem('fp_editor_history', JSON.stringify(historyData));
        } catch (e) {
            console.warn('Failed to save history to localStorage:', e);
        }
    }
    
    // Load history from localStorage
    loadFromLocalStorage() {
        try {
            const stored = localStorage.getItem('fp_editor_history');
            if (stored) {
                const historyData = JSON.parse(stored);
                // Only restore if less than 24 hours old
                const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
                if (historyData.timestamp && historyData.timestamp > oneDayAgo) {
                    this.historyStack = historyData.stack || [];
                    this.historyIndex = historyData.index !== undefined ? historyData.index : -1;
                    // Ensure index is valid
                    if (this.historyIndex >= this.historyStack.length) {
                        this.historyIndex = this.historyStack.length - 1;
                    }
                    
                    // Initialize last saved state hash from current state
                    if (this.historyStack.length > 0 && this.historyIndex >= 0) {
                        const currentSnapshot = this.historyStack[this.historyIndex];
                        this.lastSavedStateHash = JSON.stringify({
                            fullHtml: currentSnapshot.fullHtml || '',
                            theme: currentSnapshot.theme || this.context.currentTheme,
                            fullpageEnabled: currentSnapshot.fullpageEnabled || false,
                            animationsEnabled: currentSnapshot.animationsEnabled || false,
                            fullpageSettings: currentSnapshot.fullpageSettings || null
                        });
                    }
                    
                    if (this.context.isDeveloperMode) {
                        console.log('📂 History: Loaded from localStorage', {
                            totalEntries: this.historyStack.length,
                            currentIndex: this.historyIndex,
                            canUndo: this.historyIndex > 0,
                            canRedo: this.historyIndex < this.historyStack.length - 1
                        });
                    }
                    
                    this.updateButtons();
                    return true;
                }
            }
        } catch (e) {
            console.warn('Failed to load history from localStorage:', e);
        }
        return false;
    }
}

