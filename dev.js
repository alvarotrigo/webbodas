/**
 * Development utilities for faster section manipulation
 * Only loaded when ?developer=1 is present in URL
 */

(function() {
    'use strict';
    
    console.log('🔧 Developer mode enabled');
    
    let keyBuffer = '';
    let isCapturingNumber = false;
    let isAppendAllMode = false;
    
    // Listen for keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        // Ignore if user is typing in an input field
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }
        
        // Check if "i" key is pressed to start section insertion
        if (e.key.toLowerCase() === 'i' && !isCapturingNumber && !isAppendAllMode) {
            isCapturingNumber = true;
            keyBuffer = '';
            console.log('🔢 Capturing section number... (press numbers then Enter, or "a" then Enter to append all)');
            e.preventDefault();
            return;
        }
        
        // If we're capturing numbers
        if (isCapturingNumber) {
            // Check if it's the "a" key for append-all mode
            if (e.key.toLowerCase() === 'a' && keyBuffer === '') {
                isAppendAllMode = true;
                console.log('🚀 Append-all mode activated... (press Enter to confirm)');
                e.preventDefault();
                return;
            }
            
            // Check if it's a number key
            if (/^\d$/.test(e.key)) {
                keyBuffer += e.key;
                console.log(`Current buffer: ${keyBuffer}`);
                e.preventDefault();
                return;
            }
            
            // Check if Enter is pressed to confirm
            if (e.key === 'Enter') {
                e.preventDefault();
                if (isAppendAllMode) {
                    triggerAppendAllSections();
                } else if (keyBuffer) {
                    triggerSectionInsertion();
                }
                return;
            }
            
            // Check if Escape is pressed to cancel
            if (e.key === 'Escape') {
                e.preventDefault();
                console.log('❌ Section insertion cancelled');
                resetCapture();
                return;
            }
        }
    });
    
    function resetCapture() {
        isCapturingNumber = false;
        isAppendAllMode = false;
        keyBuffer = '';
    }
    
    function triggerSectionInsertion() {
        const sectionId = parseInt(keyBuffer, 10);
        
        if (isNaN(sectionId) || sectionId < 1) {
            console.error('❌ Invalid section number:', keyBuffer);
            resetCapture();
            return;
        }
        
        console.log(`✨ Inserting section ${sectionId}...`);
        
        // Ensure sections metadata is available (same source used by the editor)
        if (!window.sections || !Array.isArray(window.sections)) {
            console.error('❌ Sections metadata not available on window.sections');
            resetCapture();
            return;
        }
        
        const section = window.sections.find(s => s.id === sectionId);
        if (!section) {
            console.error(`❌ Section ${sectionId} not found in sections list`);
            resetCapture();
            return;
        }
        
        // Prefer the same flow as the editor: update selection + use addSectionToPreview,
        // but don't depend on the (now lazy-loaded) thumbnail DOM existing.
        if (typeof window.addSectionToPreview === 'function' && window.selectedSections) {
            window.selectedSections.add(sectionId);
            
            // Try to visually mark the item as selected if it's in the DOM, but don't require it
            const sectionItem = document.querySelector(
                `.section-item[data-section="${sectionId}"], .category-section-item[data-section="${sectionId}"]`
            );
            if (sectionItem) {
                sectionItem.classList.add('selected');
            }
            
            // Add to preview using the same source HTML from /sections
            window.addSectionToPreview(sectionId, {
                selectionStateOnExecute: true,
                selectionStateOnUndo: false
            });
            
            if (typeof window.updateSectionCounter === 'function') {
                window.updateSectionCounter();
            }
            if (window.AIChat && typeof window.AIChat.updateVisibility === 'function') {
                window.AIChat.updateVisibility();
            }
            
            console.log(`✅ Section ${sectionId} added successfully via dev shortcut`);
        } else {
            console.error('❌ addSectionToPreview or selectedSections not available');
        }
        
        resetCapture();
    }
    
    async function triggerAppendAllSections() {
        console.log('🚀 Appending all sections...');
        
        // Ensure sections metadata is available
        if (!window.sections || !Array.isArray(window.sections)) {
            console.error('❌ Sections metadata not available on window.sections');
            resetCapture();
            return;
        }
        
        if (typeof window.addSectionToPreview !== 'function' || !window.selectedSections) {
            console.error('❌ addSectionToPreview or selectedSections not available');
            resetCapture();
            return;
        }
        
        const totalSections = window.sections.length;
        console.log(`📦 Found ${totalSections} sections to append`);
        
        // Reset capture state before starting the async operation
        resetCapture();
        
        // Delay between each section insertion (in milliseconds)
        const DELAY_MS = 100;
        
        for (let i = 0; i < totalSections; i++) {
            const section = window.sections[i];
            const sectionId = section.id;
            
            console.log(`[${i + 1}/${totalSections}] Adding section ${sectionId} - ${section.name}`);
            
            // Add to selected sections
            window.selectedSections.add(sectionId);
            
            // Try to visually mark the item as selected if it's in the DOM
            const sectionItem = document.querySelector(
                `.section-item[data-section="${sectionId}"], .category-section-item[data-section="${sectionId}"]`
            );
            if (sectionItem) {
                sectionItem.classList.add('selected');
            }
            
            // Add to preview
            window.addSectionToPreview(sectionId, {
                selectionStateOnExecute: true,
                selectionStateOnUndo: false
            });
            
            // Update UI counters
            if (typeof window.updateSectionCounter === 'function') {
                window.updateSectionCounter();
            }
            if (window.AIChat && typeof window.AIChat.updateVisibility === 'function') {
                window.AIChat.updateVisibility();
            }
            
            // Wait before adding the next section (except for the last one)
            if (i < totalSections - 1) {
                await new Promise(resolve => setTimeout(resolve, DELAY_MS));
            }
        }
        
        console.log(`✅ All ${totalSections} sections appended successfully!`);
    }
    
    /**
     * Developer-only badge next to the user avatar indicating auth state.
     * Uses serverUserData when available and falls back to DOM inference.
     */
    function createDevAuthStatusBadge() {
        // Try to read authentication state from the server-provided data first
        let isAuthenticated = false;
        try {
            if (typeof serverUserData !== 'undefined' && serverUserData) {
                // `authenticated` comes from the PHP session / Clerk sync payload
                isAuthenticated = !!serverUserData.authenticated;
            }
        } catch (err) {
            console.warn('DEV: Unable to read serverUserData for auth badge', err);
        }
        
        // Fallback: infer from DOM (logged-in area vs. free-mode area)
        const clerkUserButton = document.getElementById('clerk-user-button');
        const freeModeDisplay = document.getElementById('free-mode-display');
        if (!isAuthenticated) {
            if (clerkUserButton && !freeModeDisplay) {
                isAuthenticated = true;
            } else if (!clerkUserButton && freeModeDisplay) {
                isAuthenticated = false;
            }
        }
        
        // Find the best container next to the avatar / user name
        const userContainer =
            document.getElementById('server-user-display') ||
            document.getElementById('free-mode-display') ||
            document.querySelector('.user-info');
        
        if (!userContainer) {
            console.warn('DEV: Could not find user container for auth status badge');
            return;
        }
        
        // Avoid duplicating the badge on hot reloads
        const existing = document.getElementById('dev-auth-status-badge');
        if (existing) {
            existing.remove();
        }
        
        const badge = document.createElement('span');
        badge.id = 'dev-auth-status-badge';
        badge.title = isAuthenticated
            ? 'Developer helper: server reports this session as authenticated'
            : 'Developer helper: server reports this session as NOT authenticated';
        badge.style.cssText = `
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 2px 8px;
            margin-left: 8px;
            border-radius: 999px;
            font-size: 10px;
            font-weight: 600;
            letter-spacing: 0.05em;
            text-transform: uppercase;
            border: 1px solid rgba(148, 163, 184, 0.6);
            background: ${isAuthenticated ? 'rgba(22, 163, 74, 0.12)' : 'rgba(239, 68, 68, 0.08)'};
            color: ${isAuthenticated ? '#166534' : '#b91c1c'};
        `;
        
        const dot = document.createElement('span');
        dot.style.cssText = `
            width: 6px;
            height: 6px;
            border-radius: 999px;
            background: ${isAuthenticated ? '#22c55e' : '#f97373'};
            box-shadow: 0 0 0 3px ${isAuthenticated ? 'rgba(34, 197, 94, 0.25)' : 'rgba(248, 113, 113, 0.25)'};
        `;
        
        const label = document.createElement('span');
        label.textContent = isAuthenticated ? 'LOGGED IN' : 'LOGGED OUT';
        
        badge.appendChild(dot);
        badge.appendChild(label);
        
        // Insert right after the avatar & user name block so it feels attached
        userContainer.appendChild(badge);
    }
    
    /**
     * Create a collapsible sidebar to display history actions in real-time
     */
    function createHistoryViewerSidebar() {
        const sidebar = document.createElement('div');
        sidebar.id = 'dev-history-sidebar';
        sidebar.className = 'collapsed';
        sidebar.style.cssText = `
            position: fixed;
            top: 0;
            right: 0;
            width: 400px;
            height: 100vh;
            background: #1e1e1e;
            color: #fff;
            box-shadow: -4px 0 20px rgba(0, 0, 0, 0.3);
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', monospace;
            display: flex;
            flex-direction: column;
            transform: translateX(400px);
            transition: transform 0.3s ease-in-out;
        `;
        
        // Header
        const header = document.createElement('div');
        header.style.cssText = `
            padding: 16px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-shrink: 0;
        `;
        header.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 18px;">📜</span>
                <span style="font-weight: 600; font-size: 14px;">History Viewer</span>
            </div>
            <button id="history-clear-btn" style="
                background: rgba(255, 255, 255, 0.2);
                border: none;
                color: white;
                padding: 4px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                font-weight: 500;
            ">Clear</button>
        `;
        
        // Stats bar
        const stats = document.createElement('div');
        stats.id = 'history-stats';
        stats.style.cssText = `
            padding: 12px 16px;
            background: #2d2d2d;
            font-size: 11px;
            display: flex;
            justify-content: space-between;
            border-bottom: 1px solid #3d3d3d;
            flex-shrink: 0;
        `;
        stats.innerHTML = `
            <span>Stack: <strong id="history-stack-size">0</strong></span>
            <span>Position: <strong id="history-position">0</strong></span>
            <span>Can Undo: <strong id="history-can-undo">No</strong></span>
            <span>Can Redo: <strong id="history-can-redo">No</strong></span>
        `;
        
        // History list
        const historyList = document.createElement('div');
        historyList.id = 'history-list';
        historyList.style.cssText = `
            flex: 1;
            overflow-y: auto;
            padding: 8px;
        `;
        
        // Toggle button
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'history-toggle-btn';
        toggleBtn.innerHTML = '📜';
        toggleBtn.style.cssText = `
            position: fixed;
            top: 50%;
            right: 0;
            transform: translateY(-50%);
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            width: 40px;
            height: 60px;
            border-radius: 8px 0 0 8px;
            cursor: pointer;
            z-index: 10001;
            font-size: 20px;
            box-shadow: -2px 2px 8px rgba(0, 0, 0, 0.2);
            transition: all 0.2s ease;
        `;
        
        toggleBtn.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-50%) translateX(-2px)';
        });
        
        toggleBtn.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(-50%)';
        });
        
        toggleBtn.addEventListener('click', toggleSidebar);
        
        // Assemble sidebar
        sidebar.appendChild(header);
        sidebar.appendChild(stats);
        sidebar.appendChild(historyList);
        document.body.appendChild(sidebar);
        document.body.appendChild(toggleBtn);
        
        // Add keyboard shortcut for toggle
        document.addEventListener('keydown', function(e) {
            if (e.key && e.key.toLowerCase() === 'h' && !e.target.matches('input, textarea') && !isCapturingNumber) {
                e.preventDefault();
                toggleSidebar();
            }
        });
        
        // Clear button functionality
        document.getElementById('history-clear-btn').addEventListener('click', function() {
            historyList.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">No history yet</div>';
        });
        
        // Listen for history events
        setupHistoryListeners();
        
        function toggleSidebar() {
            const isCollapsed = sidebar.classList.toggle('collapsed');
            sidebar.style.transform = isCollapsed ? 'translateX(400px)' : 'translateX(0)';
            toggleBtn.style.right = isCollapsed ? '0' : '400px';
        }
    }
    
    /**
     * Set up listeners for history manager events
     */
    function setupHistoryListeners() {
        const historyList = document.getElementById('history-list');
        let checkAttempts = 0;
        
        // Check if HistoryManager instance is available
        const checkHistoryManager = setInterval(() => {
            checkAttempts++;
            
            // Try to find the history manager instance
            // It could be window.historyManager or within the editor context
            let historyManager = window.historyManager || window.editorContext?.historyManager;
            
            // If not found directly, try to find it in the window object
            if (!historyManager) {
                for (const key in window) {
                    if (window[key] && typeof window[key] === 'object' && window[key].historyManager) {
                        historyManager = window[key].historyManager;
                        break;
                    }
                }
            }
            
            if (historyManager && typeof historyManager.executeCommand === 'function') {
                clearInterval(checkHistoryManager);
                console.log('✅ History Manager instance detected after', checkAttempts, 'attempts. Setting up listeners...');
                console.log('   - executeCommand:', typeof historyManager.executeCommand);
                console.log('   - save:', typeof historyManager.save);
                console.log('   - undo:', typeof historyManager.undo);
                console.log('   - redo:', typeof historyManager.redo);
                
                // Monkey patch the executeCommand method to capture all executions
                const originalExecuteCommand = historyManager.executeCommand.bind(historyManager);
                historyManager.executeCommand = function(command) {
                    console.log('📝 DEV: executeCommand called with', command);
                    const result = originalExecuteCommand(command);
                    addHistoryEntry('execute', command);
                    updateHistoryStats();
                    return result;
                };
                
                // Monkey patch the save method to capture snapshot saves
                const originalSave = historyManager.save.bind(historyManager);
                historyManager.save = function() {
                    console.log('💾 DEV: save() called');
                    const result = originalSave();
                    addHistoryEntry('save', { constructor: { name: 'SnapshotSave' }, description: 'State snapshot saved' });
                    updateHistoryStats();
                    return result;
                };
                
                // Monkey patch the saveDebounced method
                if (historyManager.saveDebounced) {
                    const originalSaveDebounced = historyManager.saveDebounced.bind(historyManager);
                    historyManager.saveDebounced = function() {
                        console.log('⏱️ DEV: saveDebounced() called');
                        return originalSaveDebounced();
                    };
                }
                
                // Monkey patch the undo method
                const originalUndo = historyManager.undo.bind(historyManager);
                historyManager.undo = function() {
                    console.log('⏪ DEV: undo() called');
                    const result = originalUndo();
                    addHistoryEntry('undo', { constructor: { name: 'UndoCommand' } });
                    updateHistoryStats();
                    return result;
                };
                
                // Monkey patch the redo method
                const originalRedo = historyManager.redo.bind(historyManager);
                historyManager.redo = function() {
                    console.log('⏩ DEV: redo() called');
                    const result = originalRedo();
                    addHistoryEntry('redo', { constructor: { name: 'RedoCommand' } });
                    updateHistoryStats();
                    return result;
                };
                
                // Store reference for stats updates
                window._devHistoryManager = historyManager;
                
                // Initial stats update
                updateHistoryStats();
            } else if (checkAttempts % 10 === 0) {
                console.log(`🔍 Still looking for HistoryManager... (attempt ${checkAttempts})`);
            }
        }, 100);
        
        // Stop checking after 10 seconds
        setTimeout(() => {
            clearInterval(checkHistoryManager);
            if (!window._devHistoryManager) {
                console.warn('⚠️ History Manager not found after 10 seconds');
            }
        }, 10000);
        
        function addHistoryEntry(action, command) {
            // Remove "No history yet" message if present
            if (historyList.querySelector('[style*="No history yet"]')) {
                historyList.innerHTML = '';
            }
            
            const entry = document.createElement('div');
            const timestamp = new Date().toLocaleTimeString();
            const commandName = command.constructor?.name || command.type || 'Unknown';
            
            let icon = '📝';
            let actionColor = '#4a9eff';
            
            if (action === 'execute') {
                icon = '✅';
                actionColor = '#4ade80';
            } else if (action === 'save') {
                icon = '💾';
                actionColor = '#60a5fa';
            } else if (action === 'undo') {
                icon = '↩️';
                actionColor = '#fb923c';
            } else if (action === 'redo') {
                icon = '↪️';
                actionColor = '#a78bfa';
            }
            
            entry.style.cssText = `
                background: #2d2d2d;
                border-left: 3px solid ${actionColor};
                padding: 10px 12px;
                margin-bottom: 8px;
                border-radius: 4px;
                font-size: 12px;
                animation: slideIn 0.2s ease;
            `;
            
            entry.innerHTML = `
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span style="color: ${actionColor}; font-weight: 600;">${icon} ${action.toUpperCase()}</span>
                    <span style="color: #888; font-size: 10px;">${timestamp}</span>
                </div>
                <div style="color: #ccc; font-family: monospace; font-size: 11px;">
                    ${commandName}
                </div>
                ${command.description ? `<div style="color: #888; font-size: 10px; margin-top: 4px;">${command.description}</div>` : ''}
            `;
            
            // Add to top of list
            historyList.insertBefore(entry, historyList.firstChild);
            
            // Limit to 50 entries
            while (historyList.children.length > 50) {
                historyList.removeChild(historyList.lastChild);
            }
        }
        
        function updateHistoryStats() {
            const historyManager = window._devHistoryManager;
            if (!historyManager) return;
            
            // Get command stack stats
            const commandStackSize = historyManager.commandStack?.length || 0;
            const commandIndex = historyManager.commandIndex !== undefined ? historyManager.commandIndex : -1;
            
            // Get snapshot stack stats
            const snapshotStackSize = historyManager.historyStack?.length || 0;
            const snapshotIndex = historyManager.historyIndex !== undefined ? historyManager.historyIndex : -1;
            
            // Total stack size is commands + snapshots
            const totalStackSize = commandStackSize + snapshotStackSize;
            const totalPosition = commandIndex >= 0 ? commandIndex + 1 : snapshotIndex + 1;
            
            const canUndo = historyManager.hasCommandUndo ? historyManager.hasCommandUndo() : (snapshotIndex > 0);
            const canRedo = historyManager.hasCommandRedo ? historyManager.hasCommandRedo() : (snapshotIndex < snapshotStackSize - 1);
            
            const stackSizeEl = document.getElementById('history-stack-size');
            const positionEl = document.getElementById('history-position');
            const canUndoEl = document.getElementById('history-can-undo');
            const canRedoEl = document.getElementById('history-can-redo');
            
            if (stackSizeEl) stackSizeEl.textContent = totalStackSize;
            if (positionEl) positionEl.textContent = totalPosition;
            if (canUndoEl) {
                canUndoEl.textContent = canUndo ? 'Yes' : 'No';
                canUndoEl.style.color = canUndo ? '#4ade80' : '#ef4444';
            }
            if (canRedoEl) {
                canRedoEl.textContent = canRedo ? 'Yes' : 'No';
                canRedoEl.style.color = canRedo ? '#4ade80' : '#ef4444';
            }
        }
        
        // Add animation style
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from {
                    opacity: 0;
                    transform: translateX(-10px);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Add visual indicator for developer mode
    const devIndicator = document.createElement('div');
    devIndicator.innerHTML = '🔧 DEV MODE';
    devIndicator.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 600;
        z-index: 9999;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        pointer-events: none;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    `;
    document.body.appendChild(devIndicator);
    
    // Show authentication status next to the user avatar (developer-only)
    createDevAuthStatusBadge();
    
    // Create History Viewer Sidebar
    createHistoryViewerSidebar();
    
    // Log available keyboard shortcuts
    console.log(`
╔════════════════════════════════════════════╗
║      DEVELOPER KEYBOARD SHORTCUTS         ║
╠════════════════════════════════════════════╣
║  i + [number] + Enter  → Add section       ║
║  i + a + Enter         → Append ALL        ║
║  Escape                → Cancel input      ║
║  h                     → Toggle History    ║
╚════════════════════════════════════════════╝

Examples:
• Press "i", then "3", then "8", then Enter → Add section #38
• Press "i", then "a", then Enter → Append all sections
    `);
    
})();

