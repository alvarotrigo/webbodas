// User data is injected by pages.php in a separate script tag
// Variables available: serverUserData, phpUserId, phpUserPagesCount, phpIsAuthenticated, phpClerkUserId

// Debug logging
console.log('=== Pages.php Authentication Debug ===');
console.log('serverUserData:', serverUserData);
console.log('Type:', typeof serverUserData);
console.log('Is null?', serverUserData === null);
console.log('authenticated:', serverUserData?.authenticated);
console.log('clerk_user_id:', serverUserData?.clerk_user_id);
console.log('email:', serverUserData?.email);
console.log('PHP userId:', phpUserId);
console.log('PHP userPages count:', phpUserPagesCount);
console.log('PHP isAuthenticated:', phpIsAuthenticated);
console.log('PHP clerkUserId:', phpClerkUserId);
console.log('=====================================');

const clerkUserId = serverUserData?.clerk_user_id;
const isAuthenticated = serverUserData?.authenticated ?? false;

// Check if we're about to redirect to Stripe checkout (keep loading state visible)
const _pendingPlan = new URLSearchParams(window.location.search).get('plan');
const _isPlanRedirect = _pendingPlan && (_pendingPlan === 'pro' || _pendingPlan === 'annual' || _pendingPlan === 'lifetime') && serverUserData && serverUserData.authenticated;

if (_isPlanRedirect) {
    // Add "Redirecting to checkout" message to the existing loading overlay
    const overlay = document.querySelector('.auth-loading-overlay');
    if (overlay) {
        overlay.style.flexDirection = 'column';
        const msg = document.createElement('p');
        msg.textContent = 'Redirecting to checkout...';
        msg.style.cssText = 'color:#86868b;font-size:16px;margin-top:8px;';
        overlay.appendChild(msg);
    }
} else {
    // Remove loading state normally
    document.body.classList.remove('auth-loading');
}

let currentEditingPageId = null;
let currentOpenMenu = null;
let userMenuVisible = false;
let userMenuDocumentListenerAttached = false;

// User menu functions
function closeUserMenu() {
    const dropdown = document.getElementById('server-user-dropdown');
    const trigger = document.getElementById('server-user-display');
    if (dropdown) {
        dropdown.classList.remove('show');
        dropdown.setAttribute('aria-hidden', 'true');
    }
    if (trigger) {
        trigger.setAttribute('aria-expanded', 'false');
    }
    userMenuVisible = false;
}

function openUserMenu() {
    const dropdown = document.getElementById('server-user-dropdown');
    const trigger = document.getElementById('server-user-display');
    if (!dropdown || !trigger) {
        userMenuVisible = false;
        return;
    }

    dropdown.classList.add('show');
    dropdown.setAttribute('aria-hidden', 'false');
    trigger.setAttribute('aria-expanded', 'true');
    userMenuVisible = true;
}

function toggleUserMenu(forceState) {
    if (forceState === true) {
        openUserMenu();
        return;
    }
    if (forceState === false) {
        closeUserMenu();
        return;
    }
    if (userMenuVisible) {
        closeUserMenu();
    } else {
        openUserMenu();
    }
}

function openClerkProfile() {
    if (typeof Clerk === 'undefined') {
        console.warn('Clerk is not available. Cannot open profile.');
        return;
    }

    // Always wait for Clerk.load() before openUserProfile so that ClerkJS components
    // (modal/iframe) are ready; otherwise Clerk throws "ClerkJS components are not ready yet".
    if (typeof Clerk.load === 'function') {
        Clerk.load()
            .then(() => {
                if (typeof Clerk.openUserProfile === 'function') {
                    Clerk.openUserProfile();
                } else {
                    console.warn('Clerk profile became available but openUserProfile is missing.');
                }
            })
            .catch((error) => {
                console.error('Unable to load Clerk to open the profile:', error);
            });
        return;
    }

    if (typeof Clerk.openUserProfile === 'function') {
        Clerk.openUserProfile();
        return;
    }

    console.warn('Clerk is not available. Cannot open profile.');
}

// handleLogout is now defined in public/js/logout-handler.js (shared with app.php)

// Show upgrade modal (using on-demand component)
async function showUpgradeModal() {
    if (typeof upgradeModal !== 'undefined') {
        await upgradeModal.show();
    } else {
        console.error('Upgrade modal component not loaded');
    }
}

function attachServerUserMenuHandlers() {
    const display = document.getElementById('server-user-display');
    const dropdown = document.getElementById('server-user-dropdown');
    if (!display || !dropdown || display.dataset.menuAttached === 'true') {
        return;
    }

    display.dataset.menuAttached = 'true';

    display.addEventListener('click', (event) => {
        event.preventDefault();
        toggleUserMenu();
    });

    display.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggleUserMenu();
        } else if (event.key === 'Escape') {
            event.preventDefault();
            closeUserMenu();
        }
    });

    dropdown.querySelectorAll('[data-menu-action]').forEach((button) => {
        button.addEventListener('click', (event) => {
            const action = event.currentTarget.dataset.menuAction;
            if (action === 'manage') {
                closeUserMenu();
                openClerkProfile();
            } else if (action === 'logout') {
                handleLogout();
            } else if (action === 'upgrade') {
                closeUserMenu();
                // [DISABLED_FOR_WEDDING_VERSION]: Upgrade modal on menu button removed — modal only
                // appears during onboarding (when user has no pages).
                // showUpgradeModal();
            }
        });
    });

    dropdown.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            closeUserMenu();
            display.focus();
        }
    });

    if (!userMenuDocumentListenerAttached) {
        document.addEventListener('click', (event) => {
            const trigger = document.getElementById('server-user-display');
            const menu = document.getElementById('server-user-dropdown');
            if (!trigger || !menu) {
                return;
            }

            if (userMenuVisible && !trigger.contains(event.target) && !menu.contains(event.target)) {
                closeUserMenu();
            }
        });
        userMenuDocumentListenerAttached = true;
    }

    closeUserMenu();
}

// Initialize user menu
attachServerUserMenuHandlers();

// Auto-redirect to Stripe checkout when coming from landing page pricing (?plan=pro, ?plan=annual, or ?plan=lifetime)
(function() {
    if (!_isPlanRedirect) return;

    // Clean the URL so refreshing doesn't re-trigger
    window.history.replaceState({}, '', window.location.pathname);

    const user = {
        email: serverUserData.email,
        name: serverUserData.name || '',
        id: serverUserData.clerk_user_id
    };

    if (!user.email || !user.id) {
        document.body.classList.remove('auth-loading');
        return;
    }

    function hideLoaderAndFallback() {
        document.body.classList.remove('auth-loading');
        // [DISABLED_FOR_WEDDING_VERSION]: Upgrade modal as Polar checkout fallback removed — modal
        // only appears during onboarding (when user has no pages).
        // showUpgradeModal();
    }

    fetch('api/stripe-create-checkout.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: user.email,
            name: user.name,
            clerk_user_id: user.id,
            return_url: window.location.href
        })
    })
    .then(r => r.json())
    .then(result => {
        if (result.success && result.checkout_url) {
            window.location.href = result.checkout_url;
        } else {
            console.error('Checkout error:', result.error);
            hideLoaderAndFallback();
        }
    })
    .catch(err => {
        console.error('Stripe checkout error:', err);
        hideLoaderAndFallback();
    });
})();

// Toggle page action menu
function togglePageMenu(pageId) {
    const menu = document.getElementById(`menu-${pageId}`);
    const button = menu.previousElementSibling; // The button is right before the dropdown
    
    // Close any other open menus
    if (currentOpenMenu && currentOpenMenu !== menu) {
        currentOpenMenu.classList.remove('active');
        const oldButton = currentOpenMenu.previousElementSibling;
        if (oldButton) oldButton.classList.remove('active');
    }
    
    // Toggle current menu
    const isOpening = !menu.classList.contains('active');
    menu.classList.toggle('active');
    button.classList.toggle('active', isOpening);
    currentOpenMenu = isOpening ? menu : null;
}

// Close menu when clicking outside
document.addEventListener('click', (e) => {
    if (currentOpenMenu && !e.target.closest('.page-preview')) {
        currentOpenMenu.classList.remove('active');
        const button = currentOpenMenu.previousElementSibling;
        if (button) button.classList.remove('active');
        currentOpenMenu = null;
    }
});

// Free user can only have 1 page; block create and show Upgrade to Pro.
// Pro user: go to app.php without creating a page; theme and page name are chosen in the editor.
function createNewPage() {
    const isPaid = serverUserData && (serverUserData.is_paid === true || serverUserData.is_paid === 'true');
    if (!isPaid && phpUserPagesCount >= 1) {
        if (typeof showUpgradeModal === 'function') {
            showUpgradeModal();
        } else {
            alert('Upgrade to Pro to create more than one webpage. You can delete your current page to create a new one.');
        }
        return;
    }
    // Pro user: redirect to app.php (no page created yet; user picks theme then page name there)
    if (isPaid) {
        window.location.href = './app.php';
        return;
    }
    document.getElementById('pageTitle').value = '';
    document.getElementById('newPageModal').classList.add('active');
    setTimeout(() => {
        document.getElementById('pageTitle').focus();
    }, 100);
}

// Close new page modal
function closeNewPageModal() {
    document.getElementById('newPageModal').classList.remove('active');
}

// Submit new page
async function submitNewPage() {
    const title = document.getElementById('pageTitle').value.trim() || 'Untitled Page';

    try {
        const response = await fetch('./api/pages.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'create',
                title: title,
                data: {
                    sections: [],
                    theme: {},
                    fullpageEnabled: true,
                    animationsEnabled: true
                },
                clerk_user_id: clerkUserId
            })
        });

        const result = await response.json();

        if (result.success) {
            closeNewPageModal();
            window.location.href = `./app.php?page=${result.page.id}`;
        } else {
            const msg = result.error || 'Failed to create page';
            if (typeof showUpgradeModal === 'function' && result.error && result.error.indexOf('Upgrade') !== -1) {
                showUpgradeModal();
            } else {
                alert(msg);
            }
        }
    } catch (error) {
        console.error('Error creating page:', error);
        alert('Failed to create page');
    }
}

// Add Enter key handler for new page modal
document.getElementById('pageTitle').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        submitNewPage();
    }
});

// Add Enter key handler for edit title modal
document.getElementById('editPageTitle').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        submitEditTitle();
    }
});

// Edit page (open in editor)
function editPage(pageId) {
    window.location.href = `./app.php?page=${pageId}`;
}

// Edit page title
function editPageTitle(pageId, currentTitle) {
    // Close menu
    if (currentOpenMenu) {
        currentOpenMenu.classList.remove('active');
        const button = currentOpenMenu.previousElementSibling;
        if (button) button.classList.remove('active');
        currentOpenMenu = null;
    }

    currentEditingPageId = pageId;
    document.getElementById('editPageTitle').value = currentTitle;
    document.getElementById('editTitleModal').classList.add('active');
    // Focus the input after modal is shown
    setTimeout(() => {
        document.getElementById('editPageTitle').focus();
    }, 100);
}

// Close edit title modal
function closeEditTitleModal() {
    currentEditingPageId = null;
    document.getElementById('editTitleModal').classList.remove('active');
}

// Submit edit title
async function submitEditTitle() {
    if (!currentEditingPageId) return;

    const newTitle = document.getElementById('editPageTitle').value.trim() || 'Untitled Page';

    try {
        const response = await fetch('./api/pages.php', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                id: currentEditingPageId,
                title: newTitle,
                clerk_user_id: clerkUserId
            })
        });

        const result = await response.json();

        if (result.success) {
            closeEditTitleModal();
            // Reload page to show updated title
            window.location.reload();
        } else {
            alert('Failed to update page title: ' + result.error);
        }
    } catch (error) {
        console.error('Error updating page title:', error);
        alert('Failed to update page title');
    }
}

// Clone page
async function clonePage(pageId) {
    // Close menu
    if (currentOpenMenu) {
        currentOpenMenu.classList.remove('active');
        const button = currentOpenMenu.previousElementSibling;
        if (button) button.classList.remove('active');
        currentOpenMenu = null;
    }
    
    if (!confirm('Clone this page?')) return;

    try {
        const response = await fetch('./api/pages.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'clone',
                id: pageId,
                clerk_user_id: clerkUserId
            })
        });

        const result = await response.json();

        if (result.success) {
            // Reload page to show cloned page
            window.location.reload();
        } else {
            alert('Failed to clone page: ' + result.error);
        }
    } catch (error) {
        console.error('Error cloning page:', error);
        alert('Failed to clone page');
    }
}

// ============================================================
// Payment result handler (Stripe success / error redirect)
// ============================================================
(function handlePaymentResult() {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');

    if (!payment) return;

    // Clean URL immediately so refresh doesn't re-trigger
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, '', cleanUrl);

    if (payment === 'success') {
        // Load confetti only when needed, fire, then remove script
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.2/dist/confetti.browser.min.js';
        script.onload = function () {
            const colors = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#f43f5e'];
            confetti({ particleCount: 80, spread: 60, origin: { x: 0.15, y: 0.5 }, colors, ticks: 250, angle: 60 });
            confetti({ particleCount: 80, spread: 60, origin: { x: 0.85, y: 0.5 }, colors, ticks: 250, angle: 120 });
            setTimeout(() => {
                confetti({ particleCount: 50, spread: 80, origin: { x: 0.25, y: 0.4 }, colors, ticks: 200, angle: 55 });
                confetti({ particleCount: 50, spread: 80, origin: { x: 0.75, y: 0.4 }, colors, ticks: 200, angle: 125 });
                // Remove script from DOM after firing
                script.remove();
            }, 400);
        };
        document.head.appendChild(script);

        // Toast – top center
        const toast = document.createElement('div');
        toast.id = 'payment-success-toast';
        toast.innerHTML = `
            <span style="font-size:1.3rem;">🎉</span>
            <span>Pro Level Unlocked!</span>
        `;
        Object.assign(toast.style, {
            position: 'fixed',
            top: '28px',
            left: '50%',
            transform: 'translateX(-50%) translateY(-80px)',
            background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
            color: '#fff',
            padding: '14px 32px',
            borderRadius: '50px',
            fontWeight: '700',
            fontSize: '1.05rem',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 8px 32px rgba(99,102,241,0.35)',
            zIndex: '99999',
            transition: 'transform 0.45s cubic-bezier(0.34,1.56,0.64,1), opacity 0.45s ease',
            opacity: '0',
            whiteSpace: 'nowrap',
        });
        document.body.appendChild(toast);

        // Animate in
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                toast.style.transform = 'translateX(-50%) translateY(0)';
                toast.style.opacity = '1';
            });
        });

        // Animate out and remove after 4 s
        setTimeout(() => {
            toast.style.transform = 'translateX(-50%) translateY(-80px)';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 500);
        }, 4000);

    } else if (payment === 'error') {
        const overlay = document.createElement('div');
        overlay.id = 'payment-error-modal';
        overlay.innerHTML = `
            <div id="payment-error-box">
                <div style="font-size:3rem;margin-bottom:12px;">⚠️</div>
                <h2 style="margin:0 0 8px;font-size:1.2rem;font-weight:700;color:#991b1b;">Payment Error</h2>
                <p style="margin:0 0 20px;color:#7f1d1d;font-size:0.95rem;">Unexpected error. Review your payment details or try again later.</p>
                <button id="payment-error-close" style="padding:10px 28px;background:#dc2626;color:#fff;border:none;border-radius:8px;font-weight:600;font-size:0.95rem;cursor:pointer;">OK</button>
            </div>
        `;
        Object.assign(overlay.style, {
            position: 'fixed',
            inset: '0',
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: '99999',
        });
        Object.assign(overlay.querySelector('#payment-error-box').style, {
            background: '#fff',
            borderRadius: '16px',
            padding: '36px 40px',
            textAlign: 'center',
            maxWidth: '360px',
            width: '90%',
            boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
            border: '2px solid #fca5a5',
        });
        document.body.appendChild(overlay);
        document.getElementById('payment-error-close').addEventListener('click', () => overlay.remove());
    }
})();

// Delete page
async function deletePage(pageId, title) {
    // Close menu
    if (currentOpenMenu) {
        currentOpenMenu.classList.remove('active');
        const button = currentOpenMenu.previousElementSibling;
        if (button) button.classList.remove('active');
        currentOpenMenu = null;
    }
    
    if (!confirm(`Are you sure you want to delete "${title}"? This action cannot be undone.`)) return;

    try {
        const response = await fetch('./api/pages.php', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                id: pageId,
                clerk_user_id: clerkUserId
            })
        });

        const result = await response.json();

        if (result.success) {
            // Reload page to remove deleted page
            window.location.reload();
        } else {
            alert('Failed to delete page: ' + result.error);
        }
    } catch (error) {
        console.error('Error deleting page:', error);
        alert('Failed to delete page');
    }
}