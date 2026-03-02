/**
 * Onboarding Component (template-first / Wedding paradigm)
 * Single-step onboarding: choose template. Shown when no template is loaded.
 */
(function() {
    'use strict';

    console.log('Onboarding.js loaded');

    // === CONSTANTS ===
    const CONFETTI_COLORS_TEMPLATE = ['#10b981', '#34d399', '#6ee7b7']; // Green for template chosen

    // === STATE ===
    let overlay = null;
    let step1Element = null;
    let isVisible = false;
    let hasEverShown = false;
    let step1Complete = false;

    // === INITIALIZATION ===
    function init() {
        console.log('Onboarding initializing...');

        overlay = document.getElementById('onboarding-overlay');
        if (!overlay) {
            console.warn('Onboarding overlay not found');
            return;
        }

        step1Element = overlay.querySelector('[data-step="1"]');
        if (!step1Element) {
            console.warn('Onboarding step element not found');
            return;
        }

        setupEventListeners();
        hookIntoTemplateInsert();

        console.log('Onboarding initialized');
    }

    // === EVENT LISTENERS ===
    function setupEventListeners() {
        // Single step: click opens template selector (first style panel)
        step1Element.addEventListener('click', () => {
            if (typeof showStylePanel === 'function') {
                var firstStyleKey = 'minimal';
                if (typeof templateStyles !== 'undefined' && Object.keys(templateStyles).length) {
                    firstStyleKey = Object.keys(templateStyles)[0];
                }
                showStylePanel(firstStyleKey);
            } else {
                console.warn('showStylePanel function not found');
            }
        });
    }

    // === VISIBILITY MANAGEMENT ===
    function show() {
        console.log('Onboarding show() called');
        console.log('  - overlay exists:', !!overlay);
        console.log('  - isVisible:', isVisible);

        if (!overlay) {
            console.error('  - Cannot show: overlay element not found!');
            return;
        }

        if (isVisible) {
            console.log('  - Already visible, skipping');
            return;
        }

        overlay.classList.add('show');
        isVisible = true;
        hasEverShown = true;

        console.log('  - Onboarding shown successfully, classes:', overlay.className);
    }

    function hide(immediate = false) {
        if (!overlay || !isVisible) return;

        if (immediate) {
            overlay.classList.remove('show');
            isVisible = false;
        } else {
            // Fade out animation
            overlay.classList.add('fade-out');
            setTimeout(() => {
                overlay.classList.remove('show', 'fade-out');
                isVisible = false;
            }, 300);
        }

        console.log('Onboarding hidden');
    }

    function checkVisibility() {
        console.log('Onboarding checkVisibility called');
        console.log('  - isVisible:', isVisible);
        console.log('  - currentTemplateUrl:', typeof window.currentTemplateUrl !== 'undefined' ? window.currentTemplateUrl : 'undefined');

        // Hide loading overlay (if it's still showing)
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay && loadingOverlay.classList.contains('show')) {
            loadingOverlay.classList.remove('show');
            console.log('  - Loading overlay hidden');
        }

        // Template-first paradigm: page is empty when no template is loaded
        const isEmpty = (typeof window.currentTemplateUrl === 'undefined' || !window.currentTemplateUrl);
        console.log('  - isEmpty (no template):', isEmpty);

        if (isEmpty && !isVisible) {
            console.log('  - Showing onboarding (no template, not visible yet)');
            show();
        } else if (!isEmpty && isVisible) {
            console.log('  - Hiding onboarding (template loaded)');
            hide(true);
        } else {
            console.log('  - No action taken (isEmpty:', isEmpty, 'isVisible:', isVisible, ')');
        }
    }

    // === COMPLETION DETECTION ===

    // Hook into template insertion: when user picks a template, hide onboarding and show confetti
    function hookIntoTemplateInsert() {
        if (!window.__originalInsertFullTemplateIntoPreview) {
            window.__originalInsertFullTemplateIntoPreview = window.insertFullTemplateIntoPreview;
        }
        if (typeof window.__originalInsertFullTemplateIntoPreview !== 'function') return;

        window.insertFullTemplateIntoPreview = function(template) {
            const wasVisible = isVisible;
            if (wasVisible && !step1Complete) {
                hide(true);
            }
            const result = window.__originalInsertFullTemplateIntoPreview.apply(this, arguments);
            if (wasVisible && !step1Complete) {
                setTimeout(function() {
                    markStepComplete(1, true);
                }, 100);
            }
            return result;
        };
    }

    // === STEP COMPLETION ===
    function markStepComplete(stepNumber, showConfetti) {
        if (stepNumber !== 1 || !step1Element) return;
        step1Element.classList.add('completed');
        step1Complete = true;
        if (showConfetti) triggerConfetti();
        console.log('Onboarding step 1 (choose template) completed');
    }

    // === CONFETTI ===
    function triggerConfetti() {
        if (typeof confetti === 'undefined') return;
        var origin = { x: 0.5, y: 0.5 };
        if (step1Element && isVisible) {
            var rect = step1Element.getBoundingClientRect();
            origin = { x: (rect.left + rect.width / 2) / window.innerWidth, y: (rect.top + rect.height / 2) / window.innerHeight };
        }
        confetti({ particleCount: 100, spread: 70, origin: origin, colors: CONFETTI_COLORS_TEMPLATE, ticks: 200 });
    }

    // === PUBLIC API ===
    window.Onboarding = {
        show,
        hide,
        checkVisibility,
        reset: function() {
            step1Complete = false;
            if (step1Element) step1Element.classList.remove('completed');
            console.log('Onboarding reset');
        }
    };

    // Initialize when DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
