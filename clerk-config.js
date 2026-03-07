// Clerk Configuration
// Replace these values with your actual Clerk credentials from the Clerk Dashboard

const CLERK_CONFIG = {
    // Your Clerk Publishable Key (found in Clerk Dashboard > API Keys)
    publishableKey: 'pk_test_am9pbnQtYmxvd2Zpc2gtNjUuY2xlcmsuYWNjb3VudHMuZGV2JA',
    
    // Your Clerk Frontend API URL (found in Clerk Dashboard > API Keys)
    frontendApiUrl: 'https://welcomed-escargot-22.clerk.accounts.dev',
    
    // Allowed redirect URLs (configure in Clerk Dashboard > Paths)
    redirectUrls: [
        'http://localhost/nine-screen-canvas-flow/pages.php',
        'http://localhost/nine-screen-canvas-flow/app.php',
        'http://localhost/nine-screen-canvas-flow/auth-wall.html',
        'http://localhost/nine-screen-canvas-flow',
        'http://localhost',
        'http://localhost:3000',
        'http://localhost:5173',
        'http://localhost:8080',
        'https://yourdomain.com'
    ]
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CLERK_CONFIG;
} else {
    // @ts-ignore
    window.CLERK_CONFIG = CLERK_CONFIG;
} 