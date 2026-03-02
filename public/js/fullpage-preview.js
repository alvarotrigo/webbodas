/**
 * FullPage.js Settings Preview
 * Handles the preview animation for scroll speed and motion feel settings
 */

(function() {
    'use strict';

    let hasPlayedPreview = false;
    let previewTimeout;

    /**
     * Get easing function for motion feel
     */
    function getEasingForMotionFeel(motionFeel) {
        const easingMap = {
            'smooth': 'cubic-bezier(0.25, 0.1, 0.25, 1)', // ease
            'snappy': 'cubic-bezier(0.25, 0.46, 0.45, 0.94)', // easeOutQuad
            'relaxed': 'cubic-bezier(0.42, 0, 0.58, 1)' // easeInOut
        };
        return easingMap[motionFeel] || easingMap['smooth'];
    }

    /**
     * Play the preview animation
     */
    function playPreview() {
        const section = document.getElementById('fullpage-preview-section');
        const track = document.getElementById('fullpage-preview-track');
        const previewPlayBtn = document.getElementById('fullpage-preview-play-btn');
        const scrollSpeed = parseInt(document.getElementById('fullpage-scroll-speed')?.value || '700', 10);
        const motionFeel = document.getElementById('fullpage-motion-feel')?.value || 'smooth';
        
        if (!section || !track) return;
        
        // Calculate track width and max translate
        const trackWidth = track.offsetWidth;
        const sectionWidth = 80;
        const maxTranslateX = Math.max(0, trackWidth - sectionWidth);
        
        // If track is too small, don't animate
        if (maxTranslateX <= 0) return;
        
        // Disable play button during animation
        if (previewPlayBtn) {
            previewPlayBtn.disabled = true;
        }
        
        // Stop any ongoing animation
        section.style.transition = 'none';
        section.style.transform = 'translate3d(0, -50%, 0)';
        
        // Force reflow to ensure reset is applied
        void section.offsetWidth;
        
        // Get easing function
        const easing = getEasingForMotionFeel(motionFeel);
        
        // Start animation
        section.style.transition = `transform ${scrollSpeed}ms ${easing}`;
        section.style.transform = `translate3d(${maxTranslateX}px, -50%, 0)`;
        
        // Reset after animation completes and re-enable button
        setTimeout(() => {
            section.style.transition = 'none';
            section.style.transform = 'translate3d(0, -50%, 0)';
            
            // Re-enable play button
            if (previewPlayBtn) {
                previewPlayBtn.disabled = false;
            }
        }, scrollSpeed + 100); // Add buffer to ensure animation completes
    }

    /**
     * Schedule preview update with debounce
     */
    function schedulePreviewUpdate() {
        clearTimeout(previewTimeout);
        // Auto-play preview when settings change
        previewTimeout = setTimeout(() => {
            playPreview();
            // Mark as played so future updates work smoothly
            hasPlayedPreview = true;
        }, 300);
    }

    /**
     * Initialize the preview functionality
     */
    function initFullpagePreview() {
        // Set up preview play button
        const previewPlayBtn = document.getElementById('fullpage-preview-play-btn');
        
        if (previewPlayBtn) {
            previewPlayBtn.addEventListener('click', function() {
                hasPlayedPreview = true;
                playPreview();
            });
        }

        // Watch for modal opening to auto-play preview
        const modal = document.getElementById('fullpage-advanced-modal');
        if (modal) {
            const observer = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                        if (modal.classList.contains('show')) {
                            // Modal just opened, play preview after a short delay
                            setTimeout(() => {
                                playPreview();
                                hasPlayedPreview = true;
                            }, 100);
                        }
                    }
                });
            });
            observer.observe(modal, { attributes: true });
        }

        // Expose schedulePreviewUpdate globally so it can be called from app.php
        window.scheduleFullpagePreviewUpdate = schedulePreviewUpdate;
        
        // Also expose playPreview for direct calls if needed
        window.playFullpagePreview = playPreview;
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initFullpagePreview);
    } else {
        initFullpagePreview();
    }
})();

