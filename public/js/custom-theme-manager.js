/**
 * Custom Theme Manager
 * Handles creation, storage, and management of user-custom themes
 */

// Custom theme storage
let customThemes = [];

/**
 * Load custom themes from localStorage
 */
function loadCustomThemes() {
    try {
        const saved = localStorage.getItem('customThemes');
        if (saved) {
            customThemes = JSON.parse(saved);
            // Inject CSS for each custom theme
            customThemes.forEach(theme => {
                injectCustomThemeCSS(theme);
            });
        }
    } catch (e) {
        console.error('Failed to load custom themes:', e);
        customThemes = [];
    }
}

/**
 * Save custom themes to localStorage
 */
function saveCustomThemes() {
    try {
        localStorage.setItem('customThemes', JSON.stringify(customThemes));
    } catch (e) {
        console.error('Failed to save custom themes:', e);
    }
}

/**
 * Inject CSS for custom theme
 * @param {Object} theme - Theme object with id, name, and variables
 */
function injectCustomThemeCSS(theme) {
    // Check if style already exists
    let styleEl = document.getElementById(`custom-theme-${theme.id}`);
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = `custom-theme-${theme.id}`;
        document.head.appendChild(styleEl);
    }
    
    // Generate CSS with opacity for primary-accent-soft
    const cssText = `
        .${theme.id} {
            --primary-bg: ${theme.variables['primary-bg']};
            --secondary-bg: ${theme.variables['secondary-bg']};
            --accent-bg: ${theme.variables['accent-bg']};
            --primary-text: ${theme.variables['primary-text']};
            --secondary-text: ${theme.variables['secondary-text']};
            --accent-text: ${theme.variables['accent-text']};
            --primary-accent: ${theme.variables['primary-accent']};
            --primary-accent-soft: ${hexToRGBA(theme.variables['primary-accent'], 0.1)};
            --secondary-accent: ${theme.variables['secondary-accent']};
            --border-color: ${theme.variables['border-color']};
            --shadow-color: ${hexToRGBA(theme.variables['primary-accent'], 0.12)};
            --gradient-1: linear-gradient(135deg, ${theme.variables['primary-bg']} 0%, ${theme.variables['secondary-bg']} 100%);
            --gradient-2: linear-gradient(135deg, ${theme.variables['primary-accent']} 0%, ${theme.variables['secondary-accent']} 100%);
            --features2-bg: linear-gradient(135deg, ${theme.variables['primary-accent']} 0%, ${theme.variables['secondary-accent']} 100%);
            --font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            --heading-font: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            --border-radius: 12px;
            --button-radius: 8px;
            --card-radius: 12px;
            --spacing-unit: 1.2rem;
            --shadow-sm: 0 2px 6px ${hexToRGBA(theme.variables['primary-accent'], 0.08)};
            --shadow-md: 0 8px 20px ${hexToRGBA(theme.variables['primary-accent'], 0.12)};
            --shadow-lg: 0 20px 40px ${hexToRGBA(theme.variables['primary-accent'], 0.15)};
        }
    `;
    styleEl.textContent = cssText;
}

/**
 * Helper to convert hex to rgba
 * @param {string} hex - Hex color code
 * @param {number} alpha - Alpha value (0-1)
 * @returns {string} RGBA color string
 */
function hexToRGBA(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Get all custom themes
 * @returns {Array} Array of custom theme objects
 */
function getCustomThemes() {
    return customThemes;
}

/**
 * Add a custom theme programmatically (e.g., from AI generation)
 * @param {Object} themeData - Theme object with name and variables
 * @param {Function} selectThemeCallback - Optional callback to select the theme
 * @param {Function} refreshGridCallback - Optional callback to refresh theme grid
 * @returns {string} The generated theme ID
 */
function addCustomTheme(themeData, selectThemeCallback = null, refreshGridCallback = null) {
    if (!themeData || !themeData.name || !themeData.variables) {
        throw new Error('Invalid theme data: name and variables are required');
    }
    
    // Generate unique theme ID
    const themeId = 'custom-theme-' + Date.now();
    
    // Create theme object
    const customTheme = {
        id: themeId,
        name: themeData.name,
        variables: themeData.variables,
        isCustom: true
    };
    
    // Add to custom themes array
    customThemes.push(customTheme);
    
    // Save to localStorage
    saveCustomThemes();
    
    // Inject CSS for this theme
    injectCustomThemeCSS(customTheme);
    
    // Refresh theme grid if callback provided
    if (refreshGridCallback) {
        refreshGridCallback();
    }
    
    // Apply the new theme if callback provided
    if (selectThemeCallback) {
        selectThemeCallback(themeId, true); // Keep panel open
    }
    
    return themeId;
}

/**
 * Add custom themes to theme grid
 * @param {HTMLElement} themeGrid - The theme grid container element
 * @param {Function} selectThemeCallback - Callback function to select a theme
 */
function populateCustomThemes(themeGrid, selectThemeCallback) {
    // Add custom themes
    customThemes.forEach(theme => {
        const themeItem = document.createElement('div');
        themeItem.className = 'theme-item';
        
        const themeCard = document.createElement('div');
        themeCard.className = 'theme-card';
        themeCard.dataset.theme = theme.id;
        
        // Check if this is the current theme
        if (typeof currentTheme !== 'undefined' && theme.id === currentTheme) {
            themeCard.classList.add('active');
        }
        
        // Create color palette from variables (show first 5 colors)
        const colorArray = [
            theme.variables['primary-bg'],
            theme.variables['secondary-bg'],
            theme.variables['primary-accent'],
            theme.variables['secondary-accent'],
            theme.variables['border-color']
        ];
        const colorPalette = colorArray.map(color => 
            `<div class="theme-preview-color" style="background-color: ${color}"></div>`
        ).join('');
        
        themeCard.innerHTML = `
            <div class="custom-theme-icon" data-tippy-content="Custom Theme">
                <i data-lucide="palette"></i>
            </div>
            <button class="custom-theme-menu-btn" data-theme-id="${theme.id}">
                <i data-lucide="more-vertical"></i>
            </button>
            <div class="custom-theme-menu" data-theme-id="${theme.id}">
                <button class="custom-theme-menu-item" data-action="edit">
                    <i data-lucide="edit-2"></i>
                    Edit
                </button>
                <button class="custom-theme-menu-item" data-action="clone">
                    <i data-lucide="copy"></i>
                    Clone
                </button>
                <button class="custom-theme-menu-item danger" data-action="delete">
                    <i data-lucide="trash-2"></i>
                    Delete
                </button>
            </div>
            <div class="theme-preview">
                ${colorPalette}
            </div>
        `;
        
        const themeName = document.createElement('div');
        themeName.className = 'theme-name';
        themeName.textContent = theme.name;
        
        // Menu button
        const menuBtn = themeCard.querySelector('.custom-theme-menu-btn');
        const menu = themeCard.querySelector('.custom-theme-menu');
        
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // Close all other menus
            document.querySelectorAll('.custom-theme-menu.show').forEach(m => {
                if (m !== menu) m.classList.remove('show');
            });
            
            // Toggle this menu
            menu.classList.toggle('show');
        });
        
        // Menu items
        const menuItems = menu.querySelectorAll('.custom-theme-menu-item');
        menuItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                menu.classList.remove('show');
                
                const action = item.dataset.action;
                
                if (action === 'edit') {
                    editCustomTheme(theme.id);
                } else if (action === 'clone') {
                    cloneCustomTheme(theme.id, selectThemeCallback);
                } else if (action === 'delete') {
                    deleteCustomTheme(theme.id, selectThemeCallback);
                }
            });
        });
        
        themeItem.addEventListener('click', (e) => {
            // Don't select theme if clicking on menu button or menu items
            if (!e.target.closest('.custom-theme-menu-btn') && !e.target.closest('.custom-theme-menu')) {
                selectThemeCallback(theme.id, true); // Keep panel open
            }
        });
        
        themeItem.appendChild(themeCard);
        themeItem.appendChild(themeName);
        themeGrid.appendChild(themeItem);
    });
    
    // Add "Create Custom" card
    const createItem = document.createElement('div');
    createItem.className = 'theme-item create-custom-item';
    
    const createCard = document.createElement('div');
    createCard.className = 'theme-card custom-theme-card';
    createCard.innerHTML = `
        <div class="theme-preview">
            <div class="theme-preview-color" style="background: linear-gradient(90deg, #f8f9fa 0%, #e9ecef 50%, #f8f9fa 100%)"></div>
        </div>
    `;
    
    const createName = document.createElement('div');
    createName.className = 'theme-name';
    createName.innerHTML = `<i data-lucide="plus"></i> Create Custom`;
    
    createItem.addEventListener('click', () => openCustomThemeModal());
    
    createItem.appendChild(createCard);
    createItem.appendChild(createName);
    themeGrid.appendChild(createItem);
    
    // Reinitialize icons
    if (typeof lucide !== 'undefined') {
        setTimeout(() => {
            lucide.createIcons();
            
            // Initialize tooltips for custom theme icons
            if (typeof tippy !== 'undefined') {
                const customIcons = document.querySelectorAll('.custom-theme-icon');
                customIcons.forEach(icon => {
                    if (!icon._tippy) {
                        tippy(icon, {
                            placement: 'top',
                            arrow: true,
                            theme: 'custom',
                            animation: 'scale',
                            duration: [200, 150]
                        });
                    }
                });
            }
        }, 50);
    }
}

/**
 * Open custom theme modal
 * @param {Object} themeData - Optional theme data for editing
 */
function openCustomThemeModal(themeData = null) {
    const modal = document.getElementById('custom-theme-modal');
    modal.classList.add('show');
    
    // Store the theme ID if editing
    modal.dataset.editingThemeId = themeData ? themeData.id : '';
    
    // Update modal title
    const modalTitle = modal.querySelector('.custom-theme-modal-header h2');
    if (modalTitle) {
        modalTitle.textContent = themeData ? 'Edit Custom Theme' : 'Create Custom Theme';
    }
    
    // Set form values
    document.getElementById('custom-theme-name').value = themeData ? themeData.name : '';
    
    // Generate color pickers with values
    generateColorPickers(themeData ? themeData.variables : null);
    
    // Reinitialize icons
    if (typeof lucide !== 'undefined') {
        setTimeout(() => lucide.createIcons(), 50);
    }
}

/**
 * Close custom theme modal
 */
function closeCustomThemeModal() {
    const modal = document.getElementById('custom-theme-modal');
    modal.classList.remove('show');
}

/**
 * Generate color picker inputs in the modal
 * @param {Object} values - Optional existing values for editing
 */
function generateColorPickers(values = null) {
    const colorPickerGrid = document.getElementById('color-picker-grid');
    
    // Define color variables to customize
    const colorVariables = [
        { key: 'primary-bg', label: 'Primary Background', default: '#ffffff' },
        { key: 'secondary-bg', label: 'Secondary Background', default: '#f8f9fa' },
        { key: 'accent-bg', label: 'Accent Background', default: '#f1f3f4' },
        { key: 'primary-text', label: 'Primary Text', default: '#2c3e50' },
        { key: 'secondary-text', label: 'Secondary Text', default: '#6c757d' },
        { key: 'accent-text', label: 'Accent Text', default: '#1a252f' },
        { key: 'primary-accent', label: 'Primary Accent', default: '#4285f4' },
        { key: 'secondary-accent', label: 'Secondary Accent', default: '#3367d6' },
        { key: 'border-color', label: 'Border Color', default: '#e9ecef' }
    ];
    
    colorPickerGrid.innerHTML = colorVariables.map(variable => {
        const value = values && values[variable.key] ? values[variable.key] : variable.default;
        return `
            <div class="color-picker-item">
                <label class="color-picker-label">${variable.label}</label>
                <div class="color-picker-wrapper">
                    <input 
                        type="color" 
                        class="color-picker-input" 
                        data-variable="${variable.key}"
                        value="${value}"
                    />
                    <input 
                        type="text" 
                        class="color-hex-input" 
                        data-variable="${variable.key}"
                        value="${value}"
                        maxlength="7"
                        placeholder="#000000"
                    />
                </div>
            </div>
        `;
    }).join('');
    
    // Sync color picker and hex input
    colorPickerGrid.querySelectorAll('.color-picker-input').forEach(colorInput => {
        const variable = colorInput.dataset.variable;
        const hexInput = colorPickerGrid.querySelector(`.color-hex-input[data-variable="${variable}"]`);
        
        // Color picker change updates hex input
        colorInput.addEventListener('input', (e) => {
            hexInput.value = e.target.value;
        });
        
        // Hex input change updates color picker
        hexInput.addEventListener('input', (e) => {
            let value = e.target.value.trim();
            // Auto-add # if missing
            if (value && !value.startsWith('#')) {
                value = '#' + value;
                e.target.value = value;
            }
            // Validate hex color
            if (/^#[0-9A-F]{6}$/i.test(value)) {
                colorInput.value = value;
            }
        });
    });
}

/**
 * Save custom theme
 * @param {Function} selectThemeCallback - Callback to select the new theme
 * @param {Function} refreshGridCallback - Callback to refresh theme grid
 */
function saveCustomTheme(selectThemeCallback, refreshGridCallback) {
    const themeName = document.getElementById('custom-theme-name').value.trim();
    const modal = document.getElementById('custom-theme-modal');
    const editingThemeId = modal.dataset.editingThemeId;
    const isEditing = editingThemeId && editingThemeId !== '';
    
    if (!themeName) {
        alert('Please enter a theme name');
        return;
    }
    
    // Collect all color values
    const variables = {};
    let isValid = true;
    
    try {
        document.querySelectorAll('.color-hex-input').forEach(input => {
            const variable = input.dataset.variable;
            const value = input.value.trim();
            
            // Validate hex color
            if (!/^#[0-9A-F]{6}$/i.test(value)) {
                alert(`Invalid color value for ${variable}: ${value}`);
                isValid = false;
                throw new Error('Invalid color');
            }
            
            variables[variable] = value;
        });
    } catch (e) {
        return;
    }
    
    if (!isValid) return;
    
    let themeId;
    let customTheme;
    
    if (isEditing) {
        // Update existing theme
        themeId = editingThemeId;
        const themeIndex = customThemes.findIndex(t => t.id === editingThemeId);
        
        if (themeIndex !== -1) {
            customTheme = {
                ...customThemes[themeIndex],
                name: themeName,
                variables: variables
            };
            customThemes[themeIndex] = customTheme;
        }
    } else {
        // Create new theme
        themeId = 'custom-theme-' + Date.now();
        customTheme = {
            id: themeId,
            name: themeName,
            variables: variables,
            isCustom: true
        };
        customThemes.push(customTheme);
    }
    
    // Save to localStorage
    saveCustomThemes();
    
    // Inject/update CSS for this theme
    injectCustomThemeCSS(customTheme);
    
    // Close modal
    closeCustomThemeModal();
    
    // Refresh theme grid
    if (refreshGridCallback) {
        refreshGridCallback();
    }
    
    // If editing and this theme is currently active, reapply it to show changes
    if (isEditing && typeof currentTheme !== 'undefined' && currentTheme === themeId) {
        if (selectThemeCallback) {
            selectThemeCallback(themeId);
        }
    } else if (!isEditing && selectThemeCallback) {
        // Apply the new theme
        selectThemeCallback(themeId);
    }
    
    // Show success message
    if (typeof showToast !== 'undefined') {
        const message = isEditing ? 'Custom theme updated successfully!' : 'Custom theme created successfully!';
        showToast(message, 'success');
    }
}

/**
 * Edit custom theme
 * @param {string} themeId - ID of the theme to edit
 */
function editCustomTheme(themeId) {
    const theme = customThemes.find(t => t.id === themeId);
    if (!theme) {
        console.error('Theme not found:', themeId);
        return;
    }
    
    // Open modal with existing theme data
    openCustomThemeModal(theme);
}

/**
 * Clone custom theme
 * @param {string} themeId - ID of the theme to clone
 * @param {Function} selectThemeCallback - Callback to select the new theme
 */
function cloneCustomTheme(themeId, selectThemeCallback) {
    const theme = customThemes.find(t => t.id === themeId);
    if (!theme) {
        console.error('Theme not found:', themeId);
        return;
    }
    
    // Create a clone with new ID and modified name
    const newThemeId = 'custom-theme-' + Date.now();
    const clonedTheme = {
        id: newThemeId,
        name: theme.name + ' (Copy)',
        variables: { ...theme.variables },
        isCustom: true
    };
    
    // Add to custom themes array
    customThemes.push(clonedTheme);
    
    // Save to localStorage
    saveCustomThemes();
    
    // Inject CSS for the cloned theme
    injectCustomThemeCSS(clonedTheme);
    
    // Refresh theme grid
    if (typeof populateThemeGrid !== 'undefined') {
        populateThemeGrid();
    }
    
    // Apply the cloned theme but keep panel open
    if (selectThemeCallback) {
        selectThemeCallback(newThemeId, true);
    }
    
    if (typeof showToast !== 'undefined') {
        showToast('Custom theme cloned successfully!', 'success');
    }
}

/**
 * Delete custom theme
 * @param {string} themeId - ID of the theme to delete
 * @param {Function} selectThemeCallback - Callback to select default theme if needed
 */
function deleteCustomTheme(themeId, selectThemeCallback) {
    if (!confirm('Are you sure you want to delete this custom theme?')) {
        return;
    }
    
    // Remove from array
    customThemes = customThemes.filter(t => t.id !== themeId);
    
    // Save to localStorage
    saveCustomThemes();
    
    // Remove CSS
    const styleEl = document.getElementById(`custom-theme-${themeId}`);
    if (styleEl) {
        styleEl.remove();
    }
    
    // If current theme was deleted, switch to default but keep panel open
    if (typeof currentTheme !== 'undefined' && currentTheme === themeId) {
        if (selectThemeCallback) {
            selectThemeCallback('theme-light-minimal', true);
        }
    }
    
    // Refresh theme grid
    if (typeof populateThemeGrid !== 'undefined') {
        populateThemeGrid();
    }
    
    if (typeof showToast !== 'undefined') {
        showToast('Custom theme deleted', 'success');
    }
}

/**
 * Initialize custom theme modal event listeners
 * Only runs if modal elements exist (i.e., in editor, not preview)
 */
let customThemeModalInitialized = false;
function initializeCustomThemeModal() {
    // Prevent multiple initializations
    if (customThemeModalInitialized) {
        console.log('Custom theme modal already initialized, skipping');
        return;
    }
    
    // Check if modal exists (only in editor page, not preview iframe)
    const customThemeModalEl = document.getElementById('custom-theme-modal');
    if (!customThemeModalEl) {
        // No modal in this context (probably preview iframe), skip initialization
        return;
    }
    
    customThemeModalInitialized = true;
    
    // Custom theme modal event listeners
    const closeCustomThemeModalBtn = document.getElementById('close-custom-theme-modal');
    const cancelCustomThemeBtn = document.getElementById('cancel-custom-theme');
    const saveCustomThemeBtn = document.getElementById('save-custom-theme');
    
    if (closeCustomThemeModalBtn) {
        closeCustomThemeModalBtn.addEventListener('click', closeCustomThemeModal);
    }
    
    if (cancelCustomThemeBtn) {
        cancelCustomThemeBtn.addEventListener('click', closeCustomThemeModal);
    }
    
    if (saveCustomThemeBtn) {
        saveCustomThemeBtn.addEventListener('click', () => {
            saveCustomTheme(
                typeof selectTheme !== 'undefined' ? selectTheme : null,
                typeof populateThemeGrid !== 'undefined' ? populateThemeGrid : null
            );
        });
    }
    
    // Close modal when clicking outside
    customThemeModalEl.addEventListener('click', (e) => {
        if (e.target === customThemeModalEl) {
            closeCustomThemeModal();
        }
    });
    
    // Close custom theme modal with ESC key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && customThemeModalEl.classList.contains('show')) {
            closeCustomThemeModal();
        }
    });
    
    // Close dropdown menus when clicking outside
    document.addEventListener('click', (e) => {
        // Check if click is outside any menu
        if (!e.target.closest('.custom-theme-menu') && !e.target.closest('.custom-theme-menu-btn')) {
            document.querySelectorAll('.custom-theme-menu.show').forEach(menu => {
                menu.classList.remove('show');
            });
        }
    });
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeCustomThemeModal);
} else {
    // DOM already loaded
    initializeCustomThemeModal();
}

