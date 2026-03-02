/**
 * Share Page Module
 * Handles sharing a page via persistent share tokens (user_pages.share_token).
 * The share link is permanent — always shows the latest saved version.
 *
 * Depends on globals: pageManagerInstance, serverUserData, showToast, selectedSections
 */

(function () {
    'use strict';

    // ---- helpers ----

    function clearShareLoading() {
        const shareBtn = document.getElementById('share-page');
        if (shareBtn) {
            shareBtn.classList.remove('loading');
            if (window.selectedSections && window.selectedSections.size > 0) {
                shareBtn.disabled = false;
            }
        }
    }

    function fallbackCopyToClipboard(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            document.execCommand('copy');
            showToast('Link Copied!', 'Share link has been copied to your clipboard.', {});
        } catch (err) {
            prompt('Copy this link to share:', text);
        }

        document.body.removeChild(textArea);
    }

    function copyToClipboard(url) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(function () {
                showToast('Link Copied!', 'Share link has been copied to your clipboard.', {});
            }).catch(function () {
                fallbackCopyToClipboard(url);
            });
        } else {
            fallbackCopyToClipboard(url);
        }
    }

    // ---- main share flow ----

    function sharePage() {
        var pageId = pageManagerInstance && pageManagerInstance.currentPageId;
        var clerkUserId = window.serverUserData && window.serverUserData.clerk_user_id;

        if (!pageId || !clerkUserId) {
            showToast('Share Failed', 'Please save your page first.', {});
            return;
        }

        var shareBtn = document.getElementById('share-page');

        // Set loading state
        if (shareBtn) {
            shareBtn.classList.add('loading');
            shareBtn.disabled = true;
        }

        var startTime = Date.now();

        var clearLoadingWithMinTime = function () {
            var elapsed = Date.now() - startTime;
            var minDisplayTime = 340;
            var remaining = Math.max(0, minDisplayTime - elapsed);
            setTimeout(clearShareLoading, remaining);
        };

        fetch('api/pages.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'share',
                id: pageId,
                clerk_user_id: clerkUserId
            })
        })
        .then(function (res) { return res.json(); })
        .then(function (result) {
            if (!result.success || !result.share_token) {
                throw new Error(result.error || 'Failed to generate share link');
            }

            var basePath = window.location.pathname.substring(
                0,
                window.location.pathname.lastIndexOf('/') + 1
            );
            var shareUrl = window.location.origin + basePath + 'shared.html?token=' + result.share_token;

            copyToClipboard(shareUrl);
            clearLoadingWithMinTime();
        })
        .catch(function (error) {
            console.error('Share failed:', error);
            showToast('Share Failed', 'Unable to generate share link. Please try again.', {});
            clearLoadingWithMinTime();
        });
    }

    // ---- init ----

    var shareBtn = document.getElementById('share-page');
    if (shareBtn) {
        shareBtn.addEventListener('click', sharePage);
    }
})();
