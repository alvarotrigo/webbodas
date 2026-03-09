<?php
/**
 * Subscribe Page - Server-side authentication check
 * Redirects to login if not authenticated (server-side, instant redirect)
 */

// Start session to check Clerk authentication
session_start();

// Check if user is authenticated via Clerk
// Clerk stores user info in session after authentication
$isAuthenticated = isset($_SESSION['clerk_user_id']) || isset($_COOKIE['__session']);

// Alternative: Check if Clerk session exists via HTTP-only cookie
// This is more reliable as Clerk uses HTTP-only cookies
if (!$isAuthenticated) {
    // Check for Clerk's session cookie (more reliable check)
    $hasClerkSession = isset($_COOKIE['__session']) || isset($_COOKIE['__clerk_db_jwt']);
    
    if (!$hasClerkSession) {
        // User is not authenticated - redirect to login
        $currentUrl = urlencode($_SERVER['REQUEST_URI']);
        // Get the base path (directory containing this script)
        $basePath = dirname($_SERVER['SCRIPT_NAME']);
        // Use absolute path to auth-wall.html
        $authUrl = rtrim($basePath, '/') . '/auth-wall.html?redirect=' . $currentUrl;
        header('Location: ' . $authUrl);
        exit;
    }
}

// If we reach here, user is authenticated (or has Clerk cookie)
// Continue to render the page
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Subscribe - ModernCo Editor Pro</title>
    
    <!-- Sentry Error Tracking -->
    <script
      src="https://browser.sentry-cdn.com/8.38.0/bundle.tracing.min.js"
      crossorigin="anonymous"
    ></script>
    <script src="./public/js/sentry-init.js"></script>
    
    <!-- Tailwind CSS -->
    <link rel="stylesheet" href="./dist/output.css">
    
    <!-- Lucide Icons -->
    <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js"></script>
    
    <!-- Google Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    
    <style>
        :root {
            --primary-bg: #ffffff;
            --secondary-bg: #f8f9fa;
            --accent-bg: #f1f3f4;
            --primary-text: #2c3e50;
            --secondary-text: #6c757d;
            --accent-text: #1a252f;
            --primary-accent: #667eea;
            --secondary-accent: #764ba2;
            --success-color: #10b981;
            --border-color: #e9ecef;
            --shadow-color: rgba(0, 0, 0, 0.08);
            --font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            font-family: var(--font-family);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
        }

        /* Header */
        .header {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            padding: 1rem 2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }

        .logo {
            font-size: 1.5rem;
            font-weight: 700;
            color: var(--primary-text);
        }

        .user-menu {
            position: relative;
        }

        .user-avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: linear-gradient(135deg, var(--primary-accent), var(--secondary-accent));
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s;
        }

        .user-avatar:hover {
            transform: scale(1.05);
        }

        .user-dropdown {
            display: none;
            position: absolute;
            top: 100%;
            right: 0;
            margin-top: 0.5rem;
            background: white;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
            min-width: 200px;
            z-index: 1000;
        }

        .user-dropdown.show {
            display: block;
        }

        .dropdown-item {
            padding: 0.75rem 1rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            color: var(--primary-text);
            text-decoration: none;
            transition: background 0.2s;
            cursor: pointer;
        }

        .dropdown-item:hover {
            background: var(--accent-bg);
        }

        .dropdown-divider {
            height: 1px;
            background: var(--border-color);
            margin: 0.5rem 0;
        }

        /* Main Container */
        .main-container {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 2rem;
        }

        .pricing-card {
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
            max-width: 900px;
            width: 100%;
            overflow: hidden;
        }

        .card-header {
            background: linear-gradient(135deg, var(--primary-accent) 0%, var(--secondary-accent) 100%);
            color: white;
            padding: 2rem;
            text-align: center;
        }

        .card-header h1 {
            font-size: 2.5rem;
            font-weight: 800;
            margin-bottom: 0.5rem;
        }

        .card-header p {
            font-size: 1.1rem;
            opacity: 0.95;
        }

        .card-body {
            padding: 3rem;
        }

        .pricing-info {
            text-align: center;
            margin-bottom: 3rem;
        }

        .price {
            font-size: 4rem;
            font-weight: 800;
            color: var(--primary-text);
            margin-bottom: 0.5rem;
        }

        .price span {
            font-size: 1.5rem;
            color: var(--secondary-text);
            font-weight: 400;
        }

        .price-description {
            color: var(--secondary-text);
            font-size: 1rem;
        }

        .cta-button {
            display: block;
            width: 100%;
            padding: 1.25rem 2rem;
            background: linear-gradient(135deg, var(--primary-accent), var(--secondary-accent));
            color: white;
            border: none;
            border-radius: 12px;
            font-size: 1.25rem;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.3s ease;
            margin-bottom: 2rem;
            text-decoration: none;
            text-align: center;
        }

        .cta-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
        }

        .cta-button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
        }

        .features-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1.5rem;
            margin-top: 2rem;
        }

        .feature-item {
            display: flex;
            align-items: flex-start;
            gap: 0.75rem;
        }

        .feature-icon {
            flex-shrink: 0;
            width: 24px;
            height: 24px;
            color: var(--success-color);
        }

        .feature-text {
            color: var(--primary-text);
            font-size: 0.95rem;
            line-height: 1.5;
        }

        .loading-spinner {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid rgba(255, 255, 255, 0.3);
            border-top-color: white;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
            margin-right: 0.5rem;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        .error-message {
            background: #fee;
            border: 1px solid #fcc;
            color: #c33;
            padding: 1rem;
            border-radius: 8px;
            margin-bottom: 1rem;
            display: none;
        }

        .error-message.show {
            display: block;
        }

        .success-message {
            background: #efe;
            border: 1px solid #cfc;
            color: #3c3;
            padding: 1rem;
            border-radius: 8px;
            margin-bottom: 1rem;
            display: none;
        }

        .success-message.show {
            display: block;
        }

        .testimonials {
            margin-top: 3rem;
            padding-top: 2rem;
            border-top: 1px solid var(--border-color);
        }

        .testimonial {
            display: flex;
            align-items: center;
            gap: 1rem;
            padding: 1rem;
            background: var(--accent-bg);
            border-radius: 8px;
            margin-bottom: 1rem;
        }

        .testimonial-avatar {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background: linear-gradient(135deg, var(--primary-accent), var(--secondary-accent));
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 600;
            flex-shrink: 0;
        }

        .testimonial-content {
            flex: 1;
        }

        .testimonial-text {
            color: var(--primary-text);
            font-size: 0.9rem;
            margin-bottom: 0.25rem;
        }

        .testimonial-author {
            color: var(--secondary-text);
            font-size: 0.8rem;
        }

        @media (max-width: 768px) {
            .card-header h1 {
                font-size: 2rem;
            }

            .price {
                font-size: 3rem;
            }

            .card-body {
                padding: 2rem;
            }

            .features-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <!-- Header -->
    <div class="header">
        <div class="logo">ModernCo Editor</div>
        <div class="user-menu">
            <div class="user-avatar" id="userAvatar" onclick="toggleUserMenu()">
                <span id="userInitials"></span>
            </div>
            <div class="user-dropdown" id="userDropdown">
                <div class="dropdown-item" onclick="goToEditor()">
                    <i data-lucide="layout" style="width: 18px; height: 18px;"></i>
                    <span>Go to Editor</span>
                </div>
                <div class="dropdown-divider"></div>
                <div class="dropdown-item" onclick="logout()">
                    <i data-lucide="log-out" style="width: 18px; height: 18px;"></i>
                    <span>Logout</span>
                </div>
            </div>
        </div>
    </div>

    <!-- Main Content -->
    <div class="main-container">
        <div class="pricing-card">
            <div class="card-header">
                <h1>Upgrade to Pro</h1>
                <p>Unlock unlimited access to all premium features</p>
            </div>

            <div class="card-body">
                <div id="errorMessage" class="error-message"></div>
                <div id="successMessage" class="success-message"></div>

                <div class="pricing-info">
                    <div class="price">
                        $99<span>/month</span>
                    </div>
                    <p class="price-description">Cancel anytime. No questions asked.</p>
                </div>

                <button class="cta-button" id="checkoutButton" onclick="handleCheckout()">
                    Start 3-day Trial for $1 →
                </button>

                <div class="features-grid">
                    <div class="feature-item">
                        <i data-lucide="check-circle" class="feature-icon"></i>
                        <div class="feature-text">
                            <strong>30 Articles</strong> a month generated and published on auto-pilot
                        </div>
                    </div>
                    <div class="feature-item">
                        <i data-lucide="check-circle" class="feature-icon"></i>
                        <div class="feature-text">
                            <strong>Unlimited Users</strong> in your Organization
                        </div>
                    </div>
                    <div class="feature-item">
                        <i data-lucide="check-circle" class="feature-icon"></i>
                        <div class="feature-text">
                            <strong>Auto Keyword Research</strong> made for you hands-free
                        </div>
                    </div>
                    <div class="feature-item">
                        <i data-lucide="check-circle" class="feature-icon"></i>
                        <div class="feature-text">
                            <strong>Integrates</strong> with WordPress, Webflow, Shopify, Framer
                        </div>
                    </div>
                    <div class="feature-item">
                        <i data-lucide="check-circle" class="feature-icon"></i>
                        <div class="feature-text">
                            <strong>High DR Backlinks</strong> built for you on auto-pilot
                        </div>
                    </div>
                    <div class="feature-item">
                        <i data-lucide="check-circle" class="feature-icon"></i>
                        <div class="feature-text">
                            <strong>AI Images</strong> generated in different styles
                        </div>
                    </div>
                    <div class="feature-item">
                        <i data-lucide="check-circle" class="feature-icon"></i>
                        <div class="feature-text">
                            <strong>YouTube videos</strong> integrated into articles
                        </div>
                    </div>
                    <div class="feature-item">
                        <i data-lucide="check-circle" class="feature-icon"></i>
                        <div class="feature-text">
                            <strong>Articles</strong> generated in 150+ languages
                        </div>
                    </div>
                    <div class="feature-item">
                        <i data-lucide="check-circle" class="feature-icon"></i>
                        <div class="feature-text">
                            <strong>Unlimited AI Rewrites</strong>
                        </div>
                    </div>
                    <div class="feature-item">
                        <i data-lucide="check-circle" class="feature-icon"></i>
                        <div class="feature-text">
                            <strong>Custom Features</strong> requests
                        </div>
                    </div>
                </div>

                <div class="testimonials">
                    <div class="testimonial">
                        <div class="testimonial-avatar">JD</div>
                        <div class="testimonial-content">
                            <div class="testimonial-text">"This tool is amazing! Saved me hours of work."</div>
                            <div class="testimonial-author">John Doe - Designer</div>
                        </div>
                    </div>
                    <div class="testimonial">
                        <div class="testimonial-avatar">SM</div>
                        <div class="testimonial-content">
                            <div class="testimonial-text">"Best investment for my business this year."</div>
                            <div class="testimonial-author">Sarah Miller - Entrepreneur</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Clerk Configuration -->
    <script src="clerk-config.js"></script>
    
    <!-- Clerk Script -->
    <script
        async
        crossorigin="anonymous"
        data-clerk-publishable-key="pk_test_am9pbnQtYmxvd2Zpc2gtNjUuY2xlcmsuYWNjb3VudHMuZGV2JA"
        src="https://welcomed-escargot-22.clerk.accounts.dev/npm/@clerk/clerk-js@5/dist/clerk.browser.js"
        type="text/javascript">
    </script>

    <script>
        // Initialize Lucide icons
        lucide.createIcons();

        // Global variables
        let currentUser = null;
        let clerkLoaded = false;

        // Check authentication on page load
        window.addEventListener('load', async function() {
            try {
                await Clerk.load();
                clerkLoaded = true;
                
                // Check if user is signed in
                if (Clerk.user) {
                    currentUser = Clerk.user;
                    setupUserInterface();
                    
                    // Check if user already has a subscription
                    await checkExistingSubscription();
                } else {
                    // PHP should have caught this, but as fallback redirect to login
                    console.warn('User not authenticated in Clerk, redirecting...');
                    window.location.href = 'auth-wall.html?redirect=' + 
                        encodeURIComponent(window.location.pathname);
                }
            } catch (error) {
                console.error('Error loading Clerk:', error);
                showError('Failed to load authentication system. Please refresh the page.');
            }
        });

        /**
         * Setup user interface with current user info
         */
        function setupUserInterface() {
            if (!currentUser) return;
            
            const email = currentUser.primaryEmailAddress?.emailAddress || '';
            const name = currentUser.fullName || email;
            
            // Set user initials in avatar
            const initials = getInitials(name);
            document.getElementById('userInitials').textContent = initials;
        }

        /**
         * Get initials from name
         */
        function getInitials(name) {
            if (!name) return '?';
            const parts = name.split(' ');
            if (parts.length >= 2) {
                return (parts[0][0] + parts[1][0]).toUpperCase();
            }
            return name.substring(0, 2).toUpperCase();
        }

        /**
         * Toggle user dropdown menu
         */
        function toggleUserMenu() {
            const dropdown = document.getElementById('userDropdown');
            dropdown.classList.toggle('show');
        }

        /**
         * Close dropdown when clicking outside
         */
        document.addEventListener('click', function(event) {
            const userMenu = document.querySelector('.user-menu');
            if (!userMenu.contains(event.target)) {
                document.getElementById('userDropdown').classList.remove('show');
            }
        });

        /**
         * Go to editor
         */
        function goToEditor() {
            const urlParams = new URLSearchParams(window.location.search);
            const returnUrl = urlParams.get('return') || 'app.php';
            window.location.href = decodeURIComponent(returnUrl);
        }

        /**
         * Handle logout
         */
        async function logout() {
            try {
                await Clerk.signOut();
                window.location.href = 'auth-wall.html';
            } catch (error) {
                console.error('Logout error:', error);
                showError('Failed to logout. Please try again.');
            }
        }

        /**
         * Check if user already has an active subscription
         */
        async function checkExistingSubscription() {
            try {
                const email = currentUser.primaryEmailAddress?.emailAddress;
                if (!email) return;

                const response = await fetch('api/check-subscription.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email })
                });

                const result = await response.json();
                
                if (result.has_subscription) {
                    // User already has a subscription, redirect back or to editor
                    const urlParams = new URLSearchParams(window.location.search);
                    const returnUrl = urlParams.get('return') || 'app.php';
                    
                    showSuccess('You already have an active subscription! Redirecting...');
                    setTimeout(() => {
                        window.location.href = decodeURIComponent(returnUrl);
                    }, 2000);
                }
            } catch (error) {
                console.error('Error checking subscription:', error);
                // Continue to show checkout page even if check fails
            }
        }

        /**
         * Handle checkout button click
         */
        async function handleCheckout() {
            if (!currentUser) {
                showError('Please log in first');
                return;
            }

            const button = document.getElementById('checkoutButton');
            const originalText = button.innerHTML;
            
            try {
                button.disabled = true;
                button.innerHTML = '<span class="loading-spinner"></span> Creating checkout...';

                const email = currentUser.primaryEmailAddress?.emailAddress;
                const name = currentUser.fullName || '';
                const clerkUserId = currentUser.id;

                // Create checkout session
                const response = await fetch('api/create-checkout.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        email,
                        name,
                        clerk_user_id: clerkUserId
                    })
                });

                const result = await response.json();

                if (result.success && result.checkout_url) {
                    // Redirect to LemonSqueezy checkout
                    window.location.href = result.checkout_url;
                } else {
                    throw new Error(result.error || 'Failed to create checkout');
                }
            } catch (error) {
                console.error('Checkout error:', error);
                showError('Failed to create checkout. Please try again or contact support.');
                button.disabled = false;
                button.innerHTML = originalText;
            }
        }

        /**
         * Show error message
         */
        function showError(message) {
            const errorEl = document.getElementById('errorMessage');
            errorEl.textContent = message;
            errorEl.classList.add('show');
            setTimeout(() => errorEl.classList.remove('show'), 5000);
        }

        /**
         * Show success message
         */
        function showSuccess(message) {
            const successEl = document.getElementById('successMessage');
            successEl.textContent = message;
            successEl.classList.add('show');
            setTimeout(() => successEl.classList.remove('show'), 5000);
        }
    </script>
</body>
</html>

