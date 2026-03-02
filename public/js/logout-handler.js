/**
 * Shared Logout Handler
 * Used by both app.php and pages.php to ensure consistent logout behavior
 * 
 * Simple flow:
 * 1. Clear client-side data (localStorage, Clerk session)
 * 2. Redirect to logout.php
 * 3. logout.php clears server session and redirects to auth-wall.html
 */
async function handleLogout() {
    // Close user menu if the function exists
    if (typeof closeUserMenu === 'function') {
        closeUserMenu();
    }
    
    console.log('Starting logout process...');

    // Clear local storage (all authentication-related data)
    const keysToRemove = [
        'editorMode',
        'isAuthenticated',
        'userEmail',
        'userName',
        'isPaid',
        'userAvatar'
    ];
    
    keysToRemove.forEach(key => {
        localStorage.removeItem(key);
    });
    
    console.log('Local storage cleared');

    // Detect base path first (we need it for the Clerk redirect)
    const pathname = window.location.pathname;
    let basePath = '';
    if (pathname.includes('/nine-screen-canvas-flow/')) {
        basePath = '/nine-screen-canvas-flow';
    }
    const logoutUrl = basePath + '/logout.php';
    
    // Sign out from Clerk AND tell it to redirect to logout.php
    // Clerk.signOut() auto-redirects, so we use that to our advantage
    try {
        if (typeof Clerk !== 'undefined' && typeof Clerk.signOut === 'function') {
            console.log('Signing out from Clerk with redirect to:', logoutUrl);
            // This will sign out AND redirect to logout.php
            await Clerk.signOut({ redirectUrl: logoutUrl });
            // Code below won't execute because Clerk redirects
        }
    } catch (error) {
        console.error('Clerk sign out error:', error);
    }

    // Fallback: if Clerk didn't redirect, do it manually
    console.log('Fallback redirect to:', logoutUrl);
    window.location.href = logoutUrl;
}

// Export for module usage if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { handleLogout };
}

