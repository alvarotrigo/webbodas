class SectionAddCommand {
    /**
     * @param {Object} params
     * @param {string|number} params.sectionNumber
     * @param {string} params.html
     * @param {number|null} [params.insertIndex=null]
     * @param {Object} [params.options]
     * @param {boolean|null} [params.options.selectionStateOnExecute=null]
     * @param {boolean|null} [params.options.selectionStateOnUndo=null]
     * @param {boolean} [params.options.skipScroll=false]
     * @param {Object} params.context
     */
    constructor({ sectionNumber, html, insertIndex = null, options = {}, context }) {
        this.sectionNumber = sectionNumber;
        this.html = html;
        this.insertIndex = insertIndex;
        this.context = context;
        this.selectionStateOnExecute = options.selectionStateOnExecute ?? null;
        this.selectionStateOnUndo = options.selectionStateOnUndo ?? null;
        this.skipScroll = options.skipScroll ?? false;
    }
    
    execute() {
        if (!this.context) return;
        if (typeof this.context.applySelectionState === 'function') {
            this.context.applySelectionState(this.sectionNumber, this.selectionStateOnExecute);
        }
        
        if (typeof this.context.addSection === 'function') {
            this.context.addSection({
                sectionNumber: this.sectionNumber,
                html: this.html,
                insertIndex: this.insertIndex,
                skipScroll: this.skipScroll
            });
        }
    }
    
    undo() {
        if (!this.context) return;
        if (typeof this.context.applySelectionState === 'function') {
            this.context.applySelectionState(this.sectionNumber, this.selectionStateOnUndo);
        }
        
        if (typeof this.context.removeSection === 'function') {
            this.context.removeSection({
                sectionNumber: this.sectionNumber
            });
        }
    }
}

window.SectionAddCommand = SectionAddCommand;

/**
 * Command for cloning sections with full HTML content
 */
class SectionCloneCommand {
    /**
     * @param {Object} params
     * @param {string|number} params.originalSectionNumber - The section that was cloned from
     * @param {string|number} params.newSectionNumber - The new cloned section's number
     * @param {string} params.html - Full HTML of the cloned section
     * @param {number} params.insertIndex - Where to insert the clone
     * @param {Object} params.context
     */
    constructor({ originalSectionNumber, newSectionNumber, html, insertIndex, context }) {
        this.originalSectionNumber = originalSectionNumber;
        this.newSectionNumber = newSectionNumber;
        this.html = html;
        this.insertIndex = insertIndex;
        this.context = context;
    }
    
    execute() {
        if (!this.context) return;
        
        // Add the cloned section to the iframe
        if (typeof this.context.addClonedSection === 'function') {
            this.context.addClonedSection({
                newSectionNumber: this.newSectionNumber,
                html: this.html,
                insertIndex: this.insertIndex
            });
        }
    }
    
    undo() {
        if (!this.context) return;
        
        // Remove the cloned section
        if (typeof this.context.removeSection === 'function') {
            this.context.removeSection({
                sectionNumber: this.newSectionNumber
            });
        }
    }
}

window.SectionCloneCommand = SectionCloneCommand;

/**
 * Command for removing sections (stores HTML for undo)
 */
class SectionRemoveCommand {
    /**
     * @param {Object} params
     * @param {string|number} params.sectionNumber - The section number to remove
     * @param {string} [params.sectionUid] - Section UID (to avoid stacking opacity command after remove)
     * @param {number} [params.restoreOpacity] - If we collapsed an opacity command, opacity to restore on undo (0-1)
     * @param {string} params.html - Full HTML of the section (for undo)
     * @param {number} params.removeIndex - Position where the section was removed from
     * @param {Object} params.context
     */
    constructor({ sectionNumber, sectionUid, restoreOpacity, html, removeIndex, context }) {
        this.sectionNumber = sectionNumber;
        this.sectionUid = sectionUid || null;
        this.restoreOpacity = restoreOpacity;
        this.html = html;
        this.removeIndex = removeIndex;
        this.context = context;
    }
    
    execute() {
        if (!this.context) return;
        
        // Remove the section from the iframe
        if (typeof this.context.removeSection === 'function') {
            this.context.removeSection({
                sectionNumber: this.sectionNumber
            });
        }
    }
    
    undo() {
        if (!this.context) return;
        
        // Re-add the section at its original position; pass restoreOpacity so iframe applies it when adding
        if (typeof this.context.addSection === 'function') {
            this.context.addSection({
                sectionNumber: this.sectionNumber,
                html: this.html,
                insertIndex: this.removeIndex,
                skipScroll: true,
                restoreOpacity: this.restoreOpacity,
                sectionUid: this.sectionUid
            });
        }
    }
}

window.SectionRemoveCommand = SectionRemoveCommand;

/**
 * Command for moving sections up or down
 */
class SectionMoveCommand {
    /**
     * @param {Object} params
     * @param {string|number} params.sectionNumber - The section number to move
     * @param {string} params.direction - 'up' or 'down'
     * @param {Object} params.context
     */
    constructor({ sectionNumber, direction, context }) {
        this.sectionNumber = sectionNumber;
        this.direction = direction;
        this.context = context;
    }
    
    execute() {
        if (!this.context) return;
        
        // Move the section in the specified direction
        if (typeof this.context.moveSection === 'function') {
            this.context.moveSection({
                sectionNumber: this.sectionNumber,
                direction: this.direction
            });
        }
    }
    
    undo() {
        if (!this.context) return;
        
        // Move in the opposite direction
        const oppositeDirection = this.direction === 'up' ? 'down' : 'up';
        
        if (typeof this.context.moveSection === 'function') {
            this.context.moveSection({
                sectionNumber: this.sectionNumber,
                direction: oppositeDirection
            });
        }
    }
}

window.SectionMoveCommand = SectionMoveCommand;

/**
 * Command for reordering sections via drag-and-drop
 * Moves a section from one index to another (can skip multiple positions)
 */
class SectionReorderCommand {
    /**
     * @param {Object} params
     * @param {number} params.fromIndex - Original position of the section
     * @param {number} params.toIndex - Target position for the section
     * @param {Object} params.context
     */
    constructor({ fromIndex, toIndex, context }) {
        this.fromIndex = fromIndex;
        this.toIndex = toIndex;
        this.context = context;
    }
    
    execute() {
        if (!this.context) return;
        
        // Reorder the section from fromIndex to toIndex
        if (typeof this.context.reorderSection === 'function') {
            this.context.reorderSection({
                fromIndex: this.fromIndex,
                toIndex: this.toIndex
            });
        }
    }
    
    undo() {
        if (!this.context) return;
        
        // Reorder back: from toIndex back to fromIndex
        if (typeof this.context.reorderSection === 'function') {
            this.context.reorderSection({
                fromIndex: this.toIndex,
                toIndex: this.fromIndex
            });
        }
    }
    
    // Implement redo to be explicit (same as execute)
    redo() {
        this.execute();
    }
}

window.SectionReorderCommand = SectionReorderCommand;