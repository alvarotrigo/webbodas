/**
 * Inline Countdown Editor
 * Allows users to change the wedding event date in countdown sections.
 * - Hover indicator button on .countdown-section elements
 * - Popup modal with date and time pickers
 * - Integrates with HistoryManager via COMMAND_COUNTDOWN_CHANGE / APPLY_COUNTDOWN_STATE messages
 * - Persists the date via data-wedding-date attribute on the section element
 */

class InlineCountdownEditor {
    constructor() {
        this.init();
    }

    init() {
        console.log('📅 Countdown Editor: Initializing');
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this._setup());
        } else {
            this._setup();
        }
    }

    _setup() {
        this.initAllCountdowns();
        this.setupMessageListeners();
        this.setupMutationObserver();
    }

    // ─── Section initialization ────────────────────────────────────────────────

    initAllCountdowns() {
        document.querySelectorAll('section.countdown-section').forEach(section => {
            this.initCountdownSection(section);
        });
    }

    initCountdownSection(section) {
        if (section.hasAttribute('data-countdown-editor-initialized')) return;

        // Must contain at least one .countdown-item to qualify
        const firstItem = section.querySelector('.countdown-item');
        if (!firstItem) return;

        // Avoid duplicate button (e.g. after re-init or clone)
        const container = firstItem.parentElement;
        if (!container || container.querySelector('.countdown-edit-btn')) return;

        section.setAttribute('data-countdown-editor-initialized', 'true');

        // Assign a unique UID for undo/redo tracking
        if (!section.hasAttribute('data-countdown-uid')) {
            section.setAttribute(
                'data-countdown-uid',
                'countdown-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
            );
        }

        // Add class for CSS (container hosts the last-item positioning context)
        container.classList.add('countdown-edit-container');

        // Prevent TinyMCE from making number/label spans editable
        section.querySelectorAll('.countdown-item .number, .countdown-item .label, #days, #hours, #minutes, #seconds').forEach(el => {
            el.setAttribute('contenteditable', 'false');
            el.setAttribute('data-mce-bogus', 'all');
        });

        const lastItem = container.querySelector('.countdown-item:last-of-type');
        if (!lastItem) return;

        // Build the edit button; placed inside last countdown-item so it sits right next to it
        const editBtn = document.createElement('button');
        editBtn.className = 'countdown-edit-btn';
        editBtn.setAttribute('type', 'button');
        editBtn.setAttribute('aria-label', 'Change event date');
        editBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            <span>Edit Date</span>
        `;
        lastItem.appendChild(editBtn);

        const openHandler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!document.body.classList.contains('fullscreen-mode')) {
                this.openModal(section, container);
            }
        };

        editBtn.addEventListener('click', openHandler);
    }

    // ─── Modal ─────────────────────────────────────────────────────────────────

    openModal(section, container) {
        console.log('📅 Countdown Editor: Opening modal');

        const currentDate = this._getCurrentDate(section);
        const { dateStr, timeStr } = this._splitDatetime(currentDate);

        // Build overlay
        const overlay = document.createElement('div');
        overlay.className = 'countdown-edit-modal-overlay modal-overlay';

        // Build modal
        const modal = document.createElement('div');
        modal.className = 'countdown-edit-modal fp-ui-theme';

        modal.innerHTML = `
            <h2>
                Edit Event Date
                <button type="button" class="close-btn" aria-label="Close">&times;</button>
            </h2>

            <div class="countdown-modal-body">
                <div class="countdown-modal-field">
                    <label for="countdown-date-input">Date</label>
                    <input
                        type="date"
                        id="countdown-date-input"
                        class="countdown-modal-input"
                        value="${dateStr}"
                    />
                </div>
                <div class="countdown-modal-field">
                    <label for="countdown-time-input">Time</label>
                    <input
                        type="time"
                        id="countdown-time-input"
                        class="countdown-modal-input"
                        value="${timeStr}"
                    />
                </div>
            </div>

            <div class="countdown-modal-actions">
                <button type="button" class="countdown-modal-btn cancel">Cancel</button>
                <button type="button" class="countdown-modal-btn apply">Apply</button>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // ── Element refs ──────────────────────────────────────────────────────
        const dateInput  = modal.querySelector('#countdown-date-input');
        const timeInput  = modal.querySelector('#countdown-time-input');
        const applyBtn   = modal.querySelector('.countdown-modal-btn.apply');
        const cancelBtn  = modal.querySelector('.countdown-modal-btn.cancel');
        const closeBtn   = modal.querySelector('.close-btn');

        // ── Helpers ───────────────────────────────────────────────────────────

        const closeModal = () => {
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            document.removeEventListener('keydown', handleEscKey);
        };

        // ── Event listeners ───────────────────────────────────────────────────

        applyBtn.addEventListener('click', () => {
            const date = dateInput.value;
            const time = timeInput.value || '00:00';
            if (!date) return;

            const newDatetime = `${date}T${time}:00`;
            this.applyCountdownChange(section, newDatetime);
            closeModal();
        });

        cancelBtn.addEventListener('click', closeModal);
        closeBtn.addEventListener('click', closeModal);

        // Close on backdrop click
        let mouseDownTarget = null;
        overlay.addEventListener('mousedown', (e) => { mouseDownTarget = e.target; });
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay && mouseDownTarget === overlay) closeModal();
            mouseDownTarget = null;
        });
        modal.addEventListener('click', (e) => e.stopPropagation());

        const handleEscKey = (e) => {
            if (e.key === 'Escape' || e.key === 'Esc') closeModal();
        };
        document.addEventListener('keydown', handleEscKey);

        // Focus date input
        setTimeout(() => dateInput.focus(), 100);
    }

    // ─── Apply change ──────────────────────────────────────────────────────────

    applyCountdownChange(section, newDatetime) {
        const wrapper = section.closest('.section');
        const sectionNumber = wrapper ? wrapper.getAttribute('data-section') : null;
        const countdownUid = this._getCountdownUid(section);

        const beforeState = { weddingDate: section.getAttribute('data-wedding-date') || this._getCurrentDate(section) };

        // Update the data attribute so the interval picks up the new date
        section.setAttribute('data-wedding-date', newDatetime);

        // Immediately update the display without waiting for the next interval tick
        this._updateCountdownDisplay(section, newDatetime);

        const afterState = { weddingDate: newDatetime };

        // Emit command to parent for undo/redo
        if (sectionNumber && window.parent && window.parent !== window) {
            window.parent.postMessage({
                type: 'COMMAND_COUNTDOWN_CHANGE',
                data: {
                    sectionNumber,
                    countdownUid,
                    beforeState,
                    afterState,
                    label: 'Event date changed'
                }
            }, '*');
        }

        console.log('📅 Countdown Editor: Date updated to', newDatetime);
    }

    // ─── Undo / Redo state application ────────────────────────────────────────

    applyState(sectionNumber, countdownUid, state, shouldScroll = false) {
        const wrapper = document.querySelector(`.section[data-section="${sectionNumber}"]`);
        if (!wrapper) {
            console.warn(`📅 Countdown Editor: Section ${sectionNumber} not found`);
            return;
        }

        const section = wrapper.querySelector(`.countdown-section[data-countdown-uid="${countdownUid}"]`);
        if (!section) {
            console.warn(`📅 Countdown Editor: Countdown with uid "${countdownUid}" not found`);
            return;
        }

        section.setAttribute('data-wedding-date', state.weddingDate);
        this._updateCountdownDisplay(section, state.weddingDate);

        if (shouldScroll) {
            wrapper.scrollIntoView({ behavior: 'auto', block: 'center' });
        }

        console.log('📅 Countdown Editor: State applied (undo/redo)', state.weddingDate);
    }

    // ─── Helpers ───────────────────────────────────────────────────────────────

    _getCountdownUid(section) {
        let uid = section.getAttribute('data-countdown-uid');
        if (!uid) {
            uid = 'countdown-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
            section.setAttribute('data-countdown-uid', uid);
        }
        return uid;
    }

    /**
     * Returns the current wedding date for a section.
     * Priority: data-wedding-date attribute > script tag extraction > fallback.
     */
    _getCurrentDate(section) {
        // 1. Check data attribute (set by editor or template modification)
        const attr = section.getAttribute('data-wedding-date');
        if (attr) return attr;

        // 2. Try to extract from inline script (template may have hardcoded date)
        const extracted = this._extractDateFromScripts();
        if (extracted) return extracted;

        // 3. Default: one year from today at noon
        const fallback = new Date();
        fallback.setFullYear(fallback.getFullYear() + 1);
        fallback.setHours(12, 0, 0, 0);
        return fallback.toISOString().slice(0, 19);
    }

    /**
     * Attempts to extract the wedding date from any inline script on the page.
     * Looks for patterns like new Date('2026-09-21T16:30:00')
     */
    _extractDateFromScripts() {
        const scripts = document.querySelectorAll('script:not([src])');
        for (const script of scripts) {
            const match = script.textContent.match(/new\s+Date\(['"](\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})['"]\)/);
            if (match) return match[1];
        }
        return null;
    }

    /**
     * Splits an ISO datetime string into date and time parts for input[type=date/time].
     * @param {string} datetime - e.g. "2026-09-21T16:30:00"
     * @returns {{ dateStr: string, timeStr: string }}
     */
    _splitDatetime(datetime) {
        if (!datetime) return { dateStr: '', timeStr: '12:00' };
        const [dateStr, timePart = '12:00:00'] = datetime.split('T');
        const timeStr = timePart.slice(0, 5); // "HH:MM"
        return { dateStr, timeStr };
    }

    /**
     * Immediately recalculates and updates the countdown DOM elements.
     * @param {Element} section - The .countdown-section element
     * @param {string} dateStr  - ISO datetime string "YYYY-MM-DDTHH:MM:SS"
     */
    _updateCountdownDisplay(section, dateStr) {
        const wedding = new Date(dateStr);
        const now = new Date();
        const diff = wedding - now;

        const daysEl    = section.querySelector('#days');
        const hoursEl   = section.querySelector('#hours');
        const minutesEl = section.querySelector('#minutes');
        const secondsEl = section.querySelector('#seconds');

        if (diff <= 0) {
            if (daysEl)    daysEl.textContent    = '000';
            if (hoursEl)   hoursEl.textContent   = '00';
            if (minutesEl) minutesEl.textContent = '00';
            if (secondsEl) secondsEl.textContent = '00';
            return;
        }

        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);

        if (daysEl)    daysEl.textContent    = String(d).padStart(3, '0');
        if (hoursEl)   hoursEl.textContent   = String(h).padStart(2, '0');
        if (minutesEl) minutesEl.textContent = String(m).padStart(2, '0');
        if (secondsEl) secondsEl.textContent = String(s).padStart(2, '0');
    }

    // ─── Message listeners (for undo/redo from parent) ─────────────────────────

    setupMessageListeners() {
        window.addEventListener('message', (event) => {
            if (event.data.type === 'APPLY_COUNTDOWN_STATE') {
                const { sectionNumber, countdownUid, state, shouldScroll } = event.data.data;
                this.applyState(sectionNumber, countdownUid, state, shouldScroll);
            }
        });
    }

    // ─── MutationObserver (for dynamically added sections) ────────────────────

    setupMutationObserver() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType !== Node.ELEMENT_NODE) return;
                    // Direct match
                    if (node.classList && node.classList.contains('countdown-section')) {
                        this.initCountdownSection(node);
                    }
                    // Descendants
                    if (node.querySelectorAll) {
                        node.querySelectorAll('section.countdown-section').forEach(s => this.initCountdownSection(s));
                    }
                });
            });
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }
}

// ─── Singleton initialization ──────────────────────────────────────────────────

if (!window.inlineCountdownEditor) {
    window.inlineCountdownEditor = new InlineCountdownEditor();
    console.log('📅 Countdown Editor: Initialized');
} else {
    console.log('📅 Countdown Editor: Already initialized, skipping');
}
