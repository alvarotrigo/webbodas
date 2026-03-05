<?php


/**
 * Editor with Server-Side Clerk Authentication
 * Checks authentication server-side to show user avatar immediately
 */

// Start session early so helper utilities can reuse it.
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

require_once __DIR__ . '/includes/clerk-auth.php';
require_once __DIR__ . '/config/polar.php';

// Handle Clerk handshake request (sets cookies then redirects without the handshake param).
clerk_handle_handshake();

// Synchronise the PHP session with Clerk (if the user already has a valid
// Clerk session cookie this will populate the session immediately).
$serverUserData = syncClerkSession();

// Fallback to existing session state when Clerk sync is not available.
if (!$serverUserData && isUserAuthenticated()) {
    $serverUserData = clerk_session_user_payload();
}

$isAuthenticated = $serverUserData['authenticated'] ?? false;
$editorMode      = $serverUserData['mode'] ?? 'free';
$userEmail       = $serverUserData['email'] ?? null;
$userName        = $serverUserData['name'] ?? null;
$isPaid          = $serverUserData['is_paid'] ?? false;
$avatarUrl       = $serverUserData['avatar_url']
    ?? ($serverUserData['avatar'] ?? null)
    ?? ($serverUserData['image_url'] ?? null)
    ?? ($serverUserData['profile_image_url'] ?? null);
if (is_string($avatarUrl)) {
    $avatarUrl = trim($avatarUrl);
    if ($avatarUrl === '') {
        $avatarUrl = null;
    }
} else {
    $avatarUrl = null;
}
$initialSource   = $userName ?: $userEmail;
if (function_exists('mb_substr')) {
    $userInitial = $initialSource ? mb_strtoupper(mb_substr($initialSource, 0, 1)) : '?';
} else {
    $userInitial = $initialSource ? strtoupper(substr($initialSource, 0, 1)) : '?';
}

// Redirect to auth wall if user is not authenticated
if (!$isAuthenticated) {
    // Store the current URL so we can redirect back after login
    $currentUrl = $_SERVER['REQUEST_URI'] ?? '/app.php';
    $redirectUrl = 'auth-wall.html?redirect=' . urlencode($currentUrl);
    header('Location: ' . $redirectUrl);
    exit;
}

$displayName = $userName ?: $userEmail;
if ($displayName) {
    if (function_exists('mb_substr')) {
        $avatarInitial = mb_strtoupper(mb_substr($displayName, 0, 1, 'UTF-8'), 'UTF-8');
    } else {
        $avatarInitial = strtoupper(substr($displayName, 0, 1));
    }
} else {
    $avatarInitial = '?';
}

// Pass user data to JavaScript immediately
$userDataJson = $serverUserData ? json_encode($serverUserData) : 'null';

// Determine fullPage.js license key based on user's paid status
$fullpageLicenseKey = getenv('FULLPAGE_LICENSE_KEY') ?: 'YOUR_LICENSE_KEY';
if (!$isPaid) {
    // For non-paid users, use placeholder
    $fullpageLicenseKey = 'YOUR_LICENSE_KEY';
}

// Pre-load page data if page parameter is present
$preloadedPageData = null;
$pageIdFromUrl = $_GET['page'] ?? null;

if ($pageIdFromUrl && $isAuthenticated && isset($serverUserData['clerk_user_id'])) {
    try {
        // Include required files for database access
        require_once __DIR__ . '/config/mysql-client.php';
        
        // Initialize MySQL client (replaces Supabase)
        $supabase = getMySQLClient(); // Same variable name for compatibility
        
        // Get user ID from clerk_user_id (reuse logic from api/pages.php)
        $clerkUserId = $serverUserData['clerk_user_id'];
        $userId = null;
        
        // Get user ID from database
        $userResult = $supabase->select('users', 'id', ['clerk_user_id' => $clerkUserId]);
        if (!empty($userResult) && isset($userResult[0]['id'])) {
            $userId = $userResult[0]['id'];
        }
        
        // If user exists, fetch the page
        if ($userId) {
            $pages = $supabase->select(
                'user_pages',
                '*',
                [
                    'id' => $pageIdFromUrl,
                    'user_id' => $userId
                ]
            );
            
            if (!empty($pages)) {
                $preloadedPageData = [
                    'success' => true,
                    'page' => $pages[0]
                ];
            }
        }
    } catch (Exception $e) {
        error_log("Error pre-loading page data in app.php: " . $e->getMessage());
        // Continue without pre-loaded data - JavaScript will handle the error
    }
}

// Pass pre-loaded page data to JavaScript
$preloadedPageDataJson = $preloadedPageData ? json_encode($preloadedPageData) : 'null';

// Get initial page title for display
$initialPageTitle = 'Untitled Page';
if ($preloadedPageData && isset($preloadedPageData['page']['title'])) {
    $initialPageTitle = $preloadedPageData['page']['title'];
}

function editor_asset(string $path): string
{
    // Return external URLs as-is
    if (preg_match('#^(https?:)?//#', $path)) {
        return $path;
    }

    // Detect environment - production uses minified assets
    $isProduction = ($_ENV['APP_ENV'] ?? getenv('APP_ENV')) === 'production';
    
    static $manifest = null;
    
    // PRODUCTION: Use rev-manifest with minified/hashed files
    if ($isProduction) {
        if ($manifest === null) {
            $manifestPath = __DIR__ . '/public/dist/rev-manifest.json';
            if (file_exists($manifestPath)) {
                $manifestContent = file_get_contents($manifestPath);
                $manifest = json_decode($manifestContent, true) ?? [];
            } else {
                $manifest = [];
            }
        }
        
        // Normalize path for manifest lookup (remove leading ./ and public/)
        $lookupPath = $path;
        if (strncmp($lookupPath, './', 2) === 0) {
            $lookupPath = substr($lookupPath, 2);
        }
        $lookupPath = ltrim($lookupPath, '/');
        
        // Remove 'public/' prefix if present
        $lookupPath = preg_replace('#^public/#', '', $lookupPath);
        
        // Check manifest for hashed version
        if (isset($manifest[$lookupPath])) {
            return './public/dist/' . $manifest[$lookupPath];
        }
        
        // Fallback if not in manifest (shouldn't happen in production)
        error_log("Asset not found in manifest: $lookupPath");
    }
    
    // DEVELOPMENT: Use original files with filemtime for cache busting
    $relativePath = $path;
    
    if (strncmp($relativePath, './', 2) === 0) {
        $relativePath = substr($relativePath, 2);
    }
    
    $relativePath = ltrim($relativePath, '/');
    
    $fullPath = __DIR__ . '/' . $relativePath;
    
    if (!file_exists($fullPath)) {
        return $path;
    }
    
    $version = filemtime($fullPath);
    $separator = strpos($path, '?') === false ? '?v=' : '&v=';
    
    return $path . $separator . $version;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Website Editor - ModernCo</title>
    
    <!-- Sentry Error Tracking - Full Browser Bundle -->
    <script
      src="https://browser.sentry-cdn.com/8.38.0/bundle.tracing.min.js"
      crossorigin="anonymous"
    ></script>
    <script src="<?= editor_asset('./public/js/sentry-init.js') ?>"></script>
    
    <!-- Tailwind CSS -->
    <link rel="stylesheet" href="<?= editor_asset('./dist/output.css') ?>">
    
    <!-- Lucide Icons -->
    <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js"></script>

    <!-- Canvas Confetti for gamified onboarding -->
    <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.2/dist/confetti.browser.min.js"></script>

    <!-- Tippy.js for tooltips -->
    <script src="https://unpkg.com/@popperjs/core@2"></script>
    <script src="https://unpkg.com/tippy.js@6"></script>
    
    <!-- Clerk Configuration -->
    <script src="<?= editor_asset('clerk-config.js') ?>"></script>
    
    <!-- Clerk Script -->
    <script
        async
        crossorigin="anonymous"
        data-clerk-publishable-key="pk_test_d2VsY29tZWQtZXNjYXJnb3QtMjIuY2xlcmsuYWNjb3VudHMuZGV2JA"
        src="https://welcomed-escargot-22.clerk.accounts.dev/npm/@clerk/clerk-js@5/dist/clerk.browser.js"
        type="text/javascript">
    </script>
    
    <!-- Google Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    
    <!-- Preconnect to Unsplash to establish connection early -->
    <link rel="preconnect" href="https://images.unsplash.com" crossorigin>
    
    <!-- Sections CSS -->
    <link rel="stylesheet" href="<?= editor_asset('public/css/sections.css') ?>">
    <link rel="stylesheet" href="<?= editor_asset('public/css/thumbnails-bgs.css') ?>">

    <!-- Preload ONLY first few visible thumbnail background images -->
    <!-- Preloading all images causes browser connection limit issues (6-8 per domain) -->
    <!-- This blocks ALL images from loading when too many are queued -->
    <?php
    $thumbnailsCssPath = __DIR__ . '/public/css/thumbnails-bgs.css';
    if (file_exists($thumbnailsCssPath)) {
        $cssContent = file_get_contents($thumbnailsCssPath);
        // Extract all image URLs from the CSS file
        preg_match_all('/url\([\'"]?([^\'"\)]+)[\'"]?\)/i', $cssContent, $matches);
        if (!empty($matches[1])) {
            // Remove duplicates and LIMIT to first 6 images to avoid connection saturation
            $uniqueUrls = array_unique($matches[1]);
            $limitedUrls = array_slice($uniqueUrls, 0, 6); // Only preload first 6 images
            foreach ($limitedUrls as $imageUrl) {
                echo "    <link rel=\"preload\" as=\"image\" href=\"" . htmlspecialchars($imageUrl, ENT_QUOTES, 'UTF-8') . "\">\n";
            }
        }
    }
    ?>

    <!-- Viewport Animations CSS -->
    <link rel="stylesheet" href="<?= editor_asset('public/css/viewport-animations.css') ?>">

    
    <!-- Section Outline Sidebar CSS -->
    <link rel="stylesheet" href="<?= editor_asset('public/css/section-outline.css') ?>">

    <!-- Editor CSS -->
    <link rel="stylesheet" href="<?= editor_asset('public/css/editor.css') ?>">
    
    <!-- FullPage Settings CSS -->
    <link rel="stylesheet" href="<?= editor_asset('public/css/fullpage-settings.css') ?>">

    <!-- Header Nav & Modal CSS -->
    <link rel="stylesheet" href="<?= editor_asset('public/css/header-nav.css') ?>">
    <link rel="stylesheet" href="<?= editor_asset('public/css/header-modal.css') ?>">

    <!-- App CSS -->
    <link rel="stylesheet" href="<?= editor_asset('public/css/app.css') ?>">

    <!-- Template Browser CSS -->
    <link rel="stylesheet" href="<?= editor_asset('public/css/template-browser.css') ?>">

    <!-- Color Filter CSS -->
    <link rel="stylesheet" href="<?= editor_asset('public/css/color-filter.css') ?>">

    <!-- Progressive Image Loader - Prevents connection limit issues -->
    <script src="<?= editor_asset('public/js/progressive-image-loader.js') ?>"></script>
    
    <!-- History Manager -->
    <script src="<?= editor_asset('public/js/history-manager.js') ?>"></script>
    <script src="<?= editor_asset('public/js/history/commands/background-change-command.js') ?>"></script>
    <script src="<?= editor_asset('public/js/history/commands/image-change-command.js') ?>"></script>
    <script src="<?= editor_asset('public/js/history/commands/inline-video-change-command.js') ?>"></script>
    <script src="<?= editor_asset('public/js/history/commands/inline-svg-change-command.js') ?>"></script>
    <script src="<?= editor_asset('public/js/history/commands/map-change-command.js') ?>"></script>
    <script src="<?= editor_asset('public/js/history/commands/countdown-change-command.js') ?>"></script>
    <script src="<?= editor_asset('public/js/history/commands/theme-change-command.js') ?>"></script>
    <script src="<?= editor_asset('public/js/history/commands/text-edit-command.js') ?>"></script>
    <script src="<?= editor_asset('public/js/history/commands/opacity-change-command.js') ?>"></script>
    <script src="<?= editor_asset('public/js/history/commands/fullpage-toggle-command.js') ?>"></script>
    <script src="<?= editor_asset('public/js/history/commands/fullpage-settings-command.js') ?>"></script>
    <script src="<?= editor_asset('public/js/history/commands/element-remove-command.js') ?>"></script>
    <script src="<?= editor_asset('public/js/history/commands/section-commands.js') ?>"></script>
    <script src="<?= editor_asset('public/js/history/commands/header-change-command.js') ?>"></script>

    <!-- Page Manager -->
    <script src="<?= editor_asset('public/js/page-manager.js') ?>"></script>

    <!-- Header Modal -->
    <script src="<?= editor_asset('public/js/header-modal.js') ?>"></script>

    <!-- Custom Theme Manager -->
    <script src="<?= editor_asset('public/js/custom-theme-manager.js') ?>"></script>
    
    <!-- Viewport Animations Manager -->
    <script src="<?= editor_asset('public/js/viewport-animations.js') ?>"></script>

    <!-- React Export Download Handler -->
    <script src="<?= editor_asset('public/js/download-options-handler.js') ?>"></script>

    <!-- Editor Paywall Protection -->
    <script src="<?= editor_asset('public/js/editor-paywall.js') ?>"></script>

    <!-- AI Chat Component - TEMPORARILY DISABLED -->
    <!-- <script src="<?= editor_asset('public/js/ai-chat.js') ?>"></script> -->
    <!-- <script src="<?= editor_asset('public/js/ai-image-replacer.js') ?>"></script> -->

    <!-- FullPage Preview -->
    <script src="<?= editor_asset('public/js/fullpage-preview.js') ?>"></script>

    <!-- Cloudinary Upload Widget -->
    <script src="https://upload-widget.cloudinary.com/global/all.js" async></script>

</head>
<body>
    <?php if (isPolarTestMode()): ?>
    <!-- Polar Test Mode Banner -->
    <div id="polar-test-mode-banner">
        <div style="display: flex; align-items: center; gap: 8px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            <span><strong>POLAR TEST MODE:</strong>
        </div>
    </div>
    <?php endif; ?>
    <!-- Top Bar -->
    <div class="top-bar">
        <!-- Left Section: Page Name -->
        <div class="top-bar-left">
            <?php if ($isAuthenticated): ?>
            <!-- Page Name Display with Back Button -->
            <div class="page-name-container flex items-center gap-2">
                <a href="./pages.php" class="back-arrow-btn" data-tippy-content="Back to pages">
                    <i data-lucide="arrow-left" class="w-5 h-5" style="color: #9333ea;"></i>
                </a>
                <div class="page-name-separator" style="width: 1px; height: 20px; background: #e5e5e7;"></div>
                <span class="page-name-text" id="page-name-display" contenteditable="false" role="textbox" tabindex="0" title="<?php echo htmlspecialchars($initialPageTitle, ENT_QUOTES, 'UTF-8'); ?>" data-tippy-content="Edit page title">
                    <?php echo htmlspecialchars($initialPageTitle, ENT_QUOTES, 'UTF-8'); ?>
                </span>
            </div>

            <!-- Save Indicator -->
            <div class="save-indicator" id="save-indicator">
                <svg class="save-spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                <svg class="save-checkmark" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
                <svg class="save-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-cloud-upload-icon lucide-cloud-upload"><path d="M12 13v8"/><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="m8 17 4-4 4 4"/></svg>
                <span class="save-indicator-text">Changes saved</span>
            </div>
            <?php endif; ?>
        </div>

        <!-- Center Section: Viewport Buttons -->
        <div class="top-bar-center">
            <div class="top-bar-card flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                <button class="viewport-btn" data-viewport="mobile" data-tippy-content="Mobile view">
                    <i data-lucide="smartphone" class="w-4 h-4"></i>
                </button>
                <button class="viewport-btn" data-viewport="tablet" data-tippy-content="Tablet view">
                    <i data-lucide="tablet" class="w-4 h-4"></i>
                </button>
                <button class="viewport-btn active" data-viewport="desktop" data-tippy-content="Desktop view">
                    <i data-lucide="monitor" class="w-4 h-4"></i>
                </button>
            </div>
        </div>

        <!-- Right Section: Other Buttons and User Info -->
        <div class="top-bar-right flex items-center gap-4">
            <div class="top-bar-card flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                <button id="undo-btn" class="history-btn" data-tippy-content="Undo (Ctrl+Z)" disabled>
                    <i data-lucide="undo-2" class="w-4 h-4"></i>
                </button>
                <button id="redo-btn" class="history-btn" data-tippy-content="Redo (Ctrl+Shift+Z)" disabled>
                    <i data-lucide="redo-2" class="w-4 h-4"></i>
                </button>
            </div>
            <!-- <button id="clear-all" class="clear-button flex items-center">
                <i data-lucide="trash-2" class="w-4 h-4 mr-2"></i>
                Clear All
            </button> -->
            <button id="preview-fullscreen" class="preview-fullscreen-btn" data-tippy-content="Preview" disabled>
                <i data-lucide="eye"></i>
            </button>
            <button id="share-page" class="share-btn" data-tippy-content="Share page" disabled>
                <i data-lucide="share-2" class="share-icon"></i>
                <svg class="share-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
            </button>
            <button id="download-page" class="download-btn publish-btn" data-tippy-content="Publish page" disabled>
                <i data-lucide="upload-cloud"></i> <span class="text-sm pl-2">Publish</span>
            </button>

            <?php if ($isAuthenticated): ?>
            <!-- Back to Pages Button -->
            <!-- <a href="./pages.php" class="top-bar-card back-to-pages-btn flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors" data-tippy-content="Back to all pages">
                <i data-lucide="grid-2x2" class="w-4 h-4"></i>
                <span class="text-sm">Pages</span>
            </a> -->
            <?php endif; ?>

            <!-- User Info -->
            <div class="user-info flex items-center gap-2">
                <?php if ($isAuthenticated): ?>
                    <!-- Logged in user display -->
                    <div id="clerk-user-button" style="position: relative;">
                        <div
                            class="flex items-center gap-2 p-2 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2"
                            id="server-user-display"
                            role="button"
                            tabindex="0"
                            aria-haspopup="true"
                            aria-expanded="false"
                            style="cursor: pointer;"
                        >
                            <div class="user-avatar<?php echo $avatarUrl ? ' has-image' : ''; ?>" data-role="user-avatar-wrapper">
                                <?php if ($avatarUrl): ?>
                                    <img
                                        src="<?php echo htmlspecialchars($avatarUrl, ENT_QUOTES, 'UTF-8'); ?>"
                                        alt="<?php echo htmlspecialchars(($userName ?: $userEmail ?: 'Account') . ' avatar', ENT_QUOTES, 'UTF-8'); ?>"
                                        data-role="user-avatar-img"
                                        loading="lazy"
                                    >
                                <?php else: ?>
                                    <span class="user-avatar-initial" data-role="user-avatar-initial">
                                        <?php echo htmlspecialchars($userInitial, ENT_QUOTES, 'UTF-8'); ?>
                                    </span>
                                <?php endif; ?>
                            </div>
                            <span class="text-sm text-gray-700" data-role="user-name">
                                <?php echo htmlspecialchars($userName ?: $userEmail ?: 'Account'); ?>
                            </span>
                        </div>
                        <div class="user-dropdown" id="server-user-dropdown" role="menu" aria-hidden="true">
                            <button class="user-dropdown-item" type="button" data-menu-action="manage" role="menuitem">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-settings-icon lucide-settings"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/></svg>
                                Manage Account
                            </button>
                            <button class="user-dropdown-item" type="button" data-menu-action="darkmode" role="menuitem">
                                <span class="dark-mode-icon-wrapper" style="position: relative; display: inline-block; width: 16px; height: 16px; margin-right: 8px;">
                                    <svg class="icon-sun" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="position: absolute; top: 0; left: 0;">
                                        <circle cx="12" cy="12" r="5"></circle>
                                        <line x1="12" y1="1" x2="12" y2="3"></line>
                                        <line x1="12" y1="21" x2="12" y2="23"></line>
                                        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                                        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                                        <line x1="1" y1="12" x2="3" y2="12"></line>
                                        <line x1="21" y1="12" x2="23" y2="12"></line>
                                        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                                        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                                    </svg>
                                    <svg class="icon-moon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="position: absolute; top: 0; left: 0;">
                                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                                    </svg>
                                </span>
                                <span id="dark-mode-text">Modo Boda</span>
                            </button>
                            <?php if (!$isPaid): ?>
                            <button class="user-dropdown-item" type="button" data-menu-action="upgrade" role="menuitem">
                                <svg xmlns="http://www.w3.org/2000/svg" style="color: #ffde00;" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-crown-icon lucide-crown"><path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z"/><path d="M5 21h14"/></svg>
                                Upgrade
                            </button>
                            <?php endif; ?>
                            <button class="user-dropdown-item user-dropdown-item-danger" type="button" data-menu-action="logout" role="menuitem">   
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-log-out-icon lucide-log-out"><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/></svg>
                                Logout
                            </button>
                        </div>
                        <?php if ($isPaid): ?>
                            <span class="pro-badge" id="clerk-pro-badge">PRO</span>
                        <?php endif; ?>
                    </div>
                <?php else: ?>
                    <!-- Free mode display -->
                    <div class="user-status flex items-center gap-1" id="free-mode-display">
                        <div class="status-indicator" id="status-indicator"></div>
                        <span class="text-sm" id="user-mode">Free Mode</span>
                    </div>
                <?php endif; ?>
            </div>
        </div>
    </div>


    <!-- Left Sidebar -->
    <div class="sidebar">
        <div class="sidebar-content">
            <?php /* Temas deshabilitados de momento - no ofrecemos selector de temas
            <div class="theme-selector-section">
                <h3 class="text-sm font-semibold text-accent-text mb-2">Theme</h3>
                <button class="theme-selector-button" id="theme-selector-button">
                    <div class="theme-selector-preview" id="current-theme-preview">
                    </div>
                    <div class="theme-selector-info">
                        <span class="theme-selector-name" id="current-theme-name">Select Theme</span>
                        <i data-lucide="chevron-right" class="theme-selector-icon"></i>
                    </div>
                </button>
            </div>
            */ ?>

            <?php if (isset($_GET['developer']) && $_GET['developer'] === '1'): ?>
            <div class="header-selector-section">
                <h3 class="text-sm font-semibold text-accent-text mb-2">Header</h3>
                <button class="header-selector-button" id="header-selector-button">
                    <div class="header-selector-info">
                        <i data-lucide="navigation" class="w-4 h-4"></i>
                        <span id="current-header-name">Add Header</span>
                        <i data-lucide="chevron-right" class="w-4 h-4 ml-auto"></i>
                    </div>
                </button>
            </div>
            <?php endif; ?>

            <?php /* Panel Animations oculto para simplificar editor (animaciones ON por defecto, backgrounds OFF). Para reactivar, descomentar el bloque y en app.js volver defaults a false/false.
            <div class="animation-toggle-section">
                <h3 class="text-sm font-semibold text-accent-text mb-4">Animations</h3>
                <div class="side-option-card flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span class="text-sm text-gray-700">Enable animations</span>
                    <label class="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" id="animation-toggle" class="sr-only peer">
                        <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                </div>
                <div class="side-option-card flex items-center justify-between p-3 bg-gray-50 rounded-lg mt-2">
                    <span class="text-sm text-gray-700">Animate backgrounds</span>
                    <label class="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" id="animate-backgrounds-toggle" class="sr-only peer">
                        <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                </div>
            </div>
            */ ?>

            <?php /* [DISABLED_FOR_WEDDING_VERSION]: Sección Display con toggle "Enable fullscreen transition" oculta; la versión bodas no usa transición fullscreen.
            <div class="fullpage-toggle-section">
                <h3 class="text-sm font-semibold text-accent-text mb-4">Display</h3>
                <div class="side-option-card flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span class="text-sm text-gray-700">Enable fullscreen transition</span>
                    <label class="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" id="fullpage-toggle" class="sr-only peer">
                        <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                </div>
                (Advanced Settings oculto: ver bloque anterior en el archivo para reactivar)
                <div id="fullpage-advanced-settings" class="hidden mt-3">
                    <button id="fullpage-advanced-settings-btn" class="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
                        <i data-lucide="settings" class="w-4 h-4"></i>
                        <span>Advanced settings</span>
                    </button>
                </div>
            </div>
            */ ?>
            
            <?php /* FullPage.js Advanced Settings Modal - oculto para simplificar editor. Para reactivar, descomentar.
            <div id="fullpage-advanced-modal" class="fullpage-advanced-modal modal-overlay">
                <div class="fullpage-advanced-modal-content">
                    <div class="fullpage-advanced-modal-header">
                        <h3 class="fullpage-advanced-modal-title">FullPage.js Advanced Settings</h3>
                        <button id="fullpage-advanced-modal-close" class="fullpage-advanced-modal-close">
                            <i data-lucide="x"></i>
                        </button>
                    </div>
                    <div class="fullpage-advanced-modal-body">
                        <!-- Scroll Speed -->
                        <div class="fullpage-setting-row">
                            <div class="flex items-center gap-2">
                                <label for="fullpage-scroll-speed" class="fullpage-setting-label">Scroll speed</label>
                                <i data-lucide="help-circle" class="w-4 h-4 cursor-help fullpage-help-icon" data-tippy-content="Speed of scrolling between sections. Lower = faster."></i>
                            </div>
                            <div class="fullpage-setting-controls">
                                <input type="range" id="fullpage-scroll-speed" value="700" min="100" max="3000" step="1" class="fullpage-range-slider">
                                <span class="fullpage-setting-value" id="fullpage-scroll-speed-value">700 ms</span>
                            </div>
                        </div>
                        
                        <!-- Navigation Bullets -->
                        <div class="fullpage-setting-row">
                            <div class="flex items-center gap-2">
                                <label for="fullpage-navigation" class="fullpage-setting-label">Navigation bullets</label>
                                <i data-lucide="help-circle" class="w-4 h-4 cursor-help fullpage-help-icon" data-tippy-content="Shows navigation dots to jump between sections."></i>
                            </div>
                            <label class="fullpage-toggle-switch">
                                <input type="checkbox" id="fullpage-navigation" class="sr-only peer" checked>
                                <div class="fullpage-toggle-slider"></div>
                            </label>
                        </div>
                        
                        <!-- Navigation Bullets Color -->
                        <div class="fullpage-setting-row" id="fullpage-navigation-color-row">
                            <div class="flex items-center gap-2">
                                <label for="fullpage-navigation-color" class="fullpage-setting-label">Bullets color</label>
                                <i data-lucide="help-circle" class="w-4 h-4 cursor-help fullpage-help-icon" data-tippy-content="Color of the navigation bullets."></i>
                            </div>
                            <div class="fullpage-setting-controls">
                                <input type="color" id="fullpage-navigation-color" value="#333333" class="fullpage-color-picker">
                                <span class="fullpage-setting-value" id="fullpage-navigation-color-value">#333333</span>
                                <button type="button" id="fullpage-navigation-color-reset" class="ml-1 p-0.5 text-gray-500 hover:text-gray-700 transition-colors" data-tippy-content="Reset">
                                    <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
                                </button>
                            </div>
                        </div>
                        
                        <!-- Disable on Mobile -->
                        <div class="fullpage-setting-row">
                            <div class="flex items-center gap-2">
                                <label for="fullpage-disable-mobile" class="fullpage-setting-label">Disable on mobile</label>
                                <i data-lucide="help-circle" class="w-4 h-4 cursor-help fullpage-help-icon" data-tippy-content="Disables fullPage scrolling on mobile devices."></i>
                            </div>
                            <label class="fullpage-toggle-switch">
                                <input type="checkbox" id="fullpage-disable-mobile" class="sr-only peer">
                                <div class="fullpage-toggle-slider"></div>
                            </label>
                        </div>
                        
                        <!-- Use Scroll Bar -->
                        <div class="fullpage-setting-row">
                            <div class="flex items-center gap-2">
                                <label for="fullpage-scrollbar" class="fullpage-setting-label">Use scroll bar</label>
                                <i data-lucide="help-circle" class="w-4 h-4 cursor-help fullpage-help-icon" data-tippy-content="Shows a visible scrollbar on the page."></i>
                            </div>
                            <label class="fullpage-toggle-switch">
                                <input type="checkbox" id="fullpage-scrollbar" class="sr-only peer">
                                <div class="fullpage-toggle-slider"></div>
                            </label>
                        </div>
                        
                        <!-- Motion Feel -->
                        <div class="fullpage-setting-row">
                            <div class="flex items-center gap-2">
                                <label for="fullpage-motion-feel" class="fullpage-setting-label">Motion feel</label>
                                <i data-lucide="help-circle" class="w-4 h-4 cursor-help fullpage-help-icon" data-tippy-content="Animation style: Smooth, Snappy, or Relaxed."></i>
                            </div>
                            <select id="fullpage-motion-feel" class="fullpage-select">
                                <option value="smooth" selected>Smooth</option>
                                <option value="snappy">Snappy</option>
                                <option value="relaxed">Relaxed</option>
                            </select>
                        </div>
                        
                        <!-- Combined Preview -->
                        <div class="fullpage-preview-container">
                            <div class="fullpage-preview-header">
                                <div class="fullpage-preview-label">Preview</div>
                                <button class="fullpage-preview-play-btn" id="fullpage-preview-play-btn" type="button">
                                    <i data-lucide="play" class="w-4 h-4"></i>
                                    <span>Play</span>
                                </button>
                            </div>
                            <div class="fullpage-preview-track" id="fullpage-preview-track">
                                <div class="fullpage-preview-section" id="fullpage-preview-section">
                                    <div class="fullpage-preview-section-content"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            */ ?>

            <div class="mb-4 category-list-wrapper">
                
                <div class="search-bar-wrapper">
                    <input type="text" class="search-bar" placeholder="Search templates" id="section-search-input">
                    <div class="search-loader" id="search-loader"></div>
                </div>
                <!-- <h3 class="text-sm font-semibold text-accent-text mb-4">Categories</h3>  -->
                <div class="category-list" id="category-list">
                    <!-- Categories will be loaded here -->
                </div>
            </div>

        </div>
    </div>

    <!-- Independent Toggle Button -->
    <button class="sidebar-toggle" id="toggle-sidebar">
        <i data-lucide="chevron-left"></i>
    </button>

    <!-- Header Panel (Independent, replaces sidebar) -->
    <div class="header-panel" id="header-panel">
        <div class="header-panel-wrapper">
            <div class="header-panel-header">
                <div class="header-panel-title">
                    <button class="header-panel-back" id="header-panel-back" style="display: none;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"></path><path d="M19 12H5"></path></svg>
                    </button>
                    <i data-lucide="navigation" id="header-panel-icon"></i>
                    <span id="header-panel-title-text">Header</span>
                </div>
                <button class="header-panel-close" id="header-panel-close">
                    <i data-lucide="x"></i>
                </button>
            </div>
            <div class="header-panel-content">
                <!-- Step 1: Layout selection -->
                <div id="header-step-1">
                    <div class="header-layout-grid">
                        <div class="header-layout-item" data-layout="1">
                            <p class="header-layout-card-name">Standard</p>
                            <div class="header-layout-card">
                                <div class="header-layout-preview"></div>
                            </div>
                        </div>
                        <div class="header-layout-item" data-layout="2">
                            <p class="header-layout-card-name">Centered</p>
                            <div class="header-layout-card">
                                <div class="header-layout-preview"></div>
                            </div>
                        </div>
                        <div class="header-layout-item" data-layout="4">
                            <p class="header-layout-card-name">Minimal</p>
                            <div class="header-layout-card">
                                <div class="header-layout-preview"></div>
                            </div>
                        </div>
                        <div class="header-layout-item" data-layout="5">
                            <p class="header-layout-card-name">Split</p>
                            <div class="header-layout-card">
                                <div class="header-layout-preview"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Step 2: Customization -->
                <div id="header-step-2" class="header-step-2">
                    <!-- Layout Switcher (compact) -->
                    <div class="header-control-group">
                        <span class="header-control-label">Layout</span>
                        <div class="header-segment-group">
                            <button class="header-segment-btn" data-layout-switch="1">Standard</button>
                            <button class="header-segment-btn" data-layout-switch="2">Centered</button>
                            <button class="header-segment-btn" data-layout-switch="4">Minimal</button>
                            <button class="header-segment-btn" data-layout-switch="5">Split</button>
                        </div>
                    </div>

                    <!-- Background -->
                    <div class="header-control-group">
                        <span class="header-control-label">Background</span>
                        <div class="header-option-grid">
                            <button class="header-option-btn active" data-header-group="background" data-header-value="solid">
                                <div class="header-option-preview">
                                    <div class="header-preview-solid"></div>
                                </div>
                                <span class="header-option-label">Solid</span>
                            </button>
                            <button class="header-option-btn" data-header-group="background" data-header-value="transparent">
                                <div class="header-option-preview">
                                    <div class="header-preview-transparent"></div>
                                </div>
                                <span class="header-option-label">Transparent</span>
                            </button>
                            <button class="header-option-btn" data-header-group="background" data-header-value="glass">
                                <div class="header-option-preview">
                                    <div class="header-preview-glass">
                                        <div class="header-glass-shine"></div>
                                        <div class="header-glass-highlight"></div>
                                    </div>
                                </div>
                                <span class="header-option-label">Glass</span>
                            </button>
                        </div>
                    </div>

                    <!-- Corners -->
                    <div class="header-control-group">
                        <span class="header-control-label">Corners</span>
                        <div class="header-option-grid">
                            <button class="header-option-btn" data-header-group="corners" data-header-value="sharp">
                                <div class="header-option-preview header-preview-center">
                                    <div class="header-corner-shape header-corner-sharp"></div>
                                </div>
                                <span class="header-option-label">Sharp</span>
                            </button>
                            <button class="header-option-btn active" data-header-group="corners" data-header-value="rounded">
                                <div class="header-option-preview header-preview-center">
                                    <div class="header-corner-shape header-corner-rounded"></div>
                                </div>
                                <span class="header-option-label">Rounded</span>
                            </button>
                            <button class="header-option-btn" data-header-group="corners" data-header-value="pill">
                                <div class="header-option-preview header-preview-center">
                                    <div class="header-corner-shape header-corner-pill"></div>
                                </div>
                                <span class="header-option-label">Pill</span>
                            </button>
                        </div>
                    </div>

                    <!-- Theme -->
                    <div class="header-control-group">
                        <span class="header-control-label">Theme</span>
                        <div class="header-segment-group">
                            <button class="header-segment-btn active" data-header-group="theme" data-header-value="light">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
                                Light
                            </button>
                            <button class="header-segment-btn" data-header-group="theme" data-header-value="dark">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
                                Dark
                            </button>
                            <button class="header-segment-btn" data-header-group="theme" data-header-value="accent">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/></svg>
                                Accent
                            </button>
                        </div>
                    </div>

                    <!-- Advanced accordion -->
                    <button class="header-advanced-toggle" id="header-advanced-toggle">
                        <span>Advanced</span>
                        <svg class="header-advanced-chevron" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>
                    </button>
                    <div class="header-advanced-content" id="header-advanced-content">
                        <!-- Shadow -->
                        <div class="header-control-group">
                            <span class="header-control-label header-control-label-muted">Shadow</span>
                            <div class="header-segment-group">
                                <button class="header-segment-btn active" data-header-group="shadow" data-header-value="none">None</button>
                                <button class="header-segment-btn" data-header-group="shadow" data-header-value="subtle">Subtle</button>
                                <button class="header-segment-btn" data-header-group="shadow" data-header-value="medium">Medium</button>
                            </div>
                        </div>

                        <!-- Actions -->
                        <div class="header-control-group" id="header-cta-type-group">
                            <span class="header-control-label header-control-label-muted">Actions</span>
                            <div class="header-option-grid header-option-grid-4">
                                <button class="header-option-btn active" data-header-group="cta-type" data-header-value="2-buttons">
                                    <div class="header-option-preview header-preview-center">
                                        <div class="header-actions-preview">
                                            <div class="header-action-btn-preview header-action-btn-filled"></div>
                                            <div class="header-action-btn-preview header-action-btn-outlined"></div>
                                        </div>
                                    </div>
                                    <span class="header-option-label">2 Buttons</span>
                                </button>
                                <button class="header-option-btn" data-header-group="cta-type" data-header-value="button">
                                    <div class="header-option-preview header-preview-center">
                                        <div class="header-actions-preview">
                                            <div class="header-action-btn-preview header-action-btn-filled header-action-btn-wide"></div>
                                        </div>
                                    </div>
                                    <span class="header-option-label">1 Button</span>
                                </button>
                                <button class="header-option-btn" data-header-group="cta-type" data-header-value="icons">
                                    <div class="header-option-preview header-preview-center">
                                        <div class="header-actions-preview">
                                            <div class="header-action-icon-preview"></div>
                                            <div class="header-action-icon-preview"></div>
                                        </div>
                                    </div>
                                    <span class="header-option-label">Icons</span>
                                </button>
                                <button class="header-option-btn" data-header-group="cta-type" data-header-value="none">
                                    <div class="header-option-preview header-preview-center">
                                        <div class="header-actions-preview">
                                            <div class="header-action-none-preview"></div>
                                        </div>
                                    </div>
                                    <span class="header-option-label">None</span>
                                </button>
                            </div>
                        </div>

                        <!-- CTA Style -->
                        <div class="header-control-group" id="header-cta-style-group">
                            <span class="header-control-label header-control-label-muted">CTA Style</span>
                            <div class="header-segment-group">
                                <button class="header-segment-btn active" data-header-group="cta-style" data-header-value="auto">Auto</button>
                                <button class="header-segment-btn" data-header-group="cta-style" data-header-value="text">Text</button>
                                <button class="header-segment-btn" data-header-group="cta-style" data-header-value="outline">Outline</button>
                                <button class="header-segment-btn" data-header-group="cta-style" data-header-value="solid">Solid</button>
                            </div>
                        </div>
                    </div>

                    <!-- Remove Header -->
                    <button class="header-remove-btn" id="header-remove-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                        Remove Header
                    </button>
                </div>

                <!-- Sub-Panel: Logo Editing -->
                <div id="header-sub-logo" class="header-sub-panel" style="display: none;">
                    <div class="header-sub-panel-header">
                        <button class="header-sub-panel-back">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                        </button>
                        <span class="header-sub-panel-title">Edit Logo</span>
                    </div>

                    <!-- Logo Type Toggle -->
                    <div class="header-control-group">
                        <span class="header-control-label">Logo Type</span>
                        <div class="header-segment-group">
                            <button class="header-segment-btn active" id="logo-type-text">Text</button>
                            <button class="header-segment-btn" id="logo-type-image">Image</button>
                        </div>
                    </div>

                    <!-- Text Input (shown when type = text) -->
                    <div class="header-control-group" id="logo-text-group">
                        <span class="header-control-label">Logo Text</span>
                        <input type="text" class="header-input-field" id="logo-text-input" placeholder="Brand" maxlength="50">
                    </div>

                    <!-- Image Upload (shown when type = image) -->
                    <div class="header-control-group" id="logo-image-group" style="display: none;">
                        <span class="header-control-label">Logo Image</span>
                        <div class="header-logo-upload-area" id="logo-upload-area">
                            <div class="header-logo-upload-placeholder" id="logo-upload-placeholder">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                                <span>Click to upload logo</span>
                            </div>
                            <img id="logo-image-preview" class="header-logo-image-preview" style="display: none;" />
                        </div>
                    </div>
                </div>

                <!-- Sub-Panel: Menu Editing -->
                <div id="header-sub-menu" class="header-sub-panel" style="display: none;">
                    <div class="header-sub-panel-header">
                        <button class="header-sub-panel-back">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                        </button>
                        <span class="header-sub-panel-title">Edit Menu</span>
                    </div>

                    <div id="menu-items-container" class="header-menu-items-container">
                        <!-- Menu items will be rendered here dynamically -->
                    </div>

                    <button class="header-add-item-btn" id="add-menu-item-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                        Add Menu Item
                    </button>
                </div>

                <!-- Sub-Panel: Actions Editing -->
                <div id="header-sub-actions" class="header-sub-panel" style="display: none;">
                    <div class="header-sub-panel-header">
                        <button class="header-sub-panel-back">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                        </button>
                        <span class="header-sub-panel-title">Edit Actions</span>
                    </div>

                    <div id="actions-items-container" class="header-actions-items-container">
                        <!-- Action items will be rendered here dynamically -->
                    </div>

                    <div class="header-content-note" id="actions-note" style="display: none;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                        <span>Action content is controlled by the "Actions" setting in the style controls.</span>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Category Hover Panel (Inside Editor Layout) -->
    <div class="category-hover-panel" id="category-hover-panel">
        <div class="category-hover-panel-header">
            <div class="category-hover-panel-header-top">
                <div class="category-hover-panel-title">
                    <i data-lucide="layout"></i>
                    <span>Content</span>
                </div>
                <button class="category-hover-panel-close">
                    <i data-lucide="x"></i>
                </button>
            </div>
            <div class="category-hover-panel-header-bottom" id="category-panel-tabs">
                <div class="category-hover-panel-tabs">
                    <button class="category-tab active" data-tab="background">Background Image</button>
                    <button class="category-tab" data-tab="white">Theme Color</button>
                </div>
            </div>
        </div>
        <!-- Filtro de templates por color (solo visible en template-mode) -->
        <div id="color-filter-container" class="panel-color-filter"></div>
        <div class="category-sections-grid theme-light-minimal" id="category-sections-grid">
            <!-- Sections will be lazy loaded here -->
        </div>
    </div>
    
    <div class="editor-layout">


        <!-- Main Area -->
        <div class="main-area">
            <!-- iframe src is set dynamically in JavaScript to avoid double-loading -->
            <iframe id="preview-iframe" frameborder="0"></iframe>

            <!-- AI Chat Form (shown when preview is empty) -->
            <!-- TEMPORARILY DISABLED
            <div id="ai-chat-form" class="ai-chat-form">
                <div class="ai-chat-container">
                    <h2 class="ai-chat-title">What website do you want to build?</h2>
                    <form class="ai-chat-form-inner">
                        <div class="ai-chat-input-wrapper">
                            <textarea
                                id="ai-chat-input"
                                class="ai-chat-input"
                                placeholder="Pregunta lo que quieras"
                                rows="1"
                            ></textarea>
                            <button type="submit" id="ai-chat-submit" class="ai-chat-submit-button" aria-label="Send">
                                <i data-lucide="send" class="ai-chat-icon"></i>
                            </button>
                            <button type="button" id="ai-chat-stop" class="ai-chat-stop-button hidden" aria-label="Stop">
                                <i data-lucide="square" class="ai-chat-icon"></i>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
            -->

            <!-- Loading Overlay (shown while checking for sections) -->
            <div id="loading-overlay" class="loading-overlay show">
                <div class="loading-container">
                    <svg class="loading-spinner" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                    <p class="loading-text">Loading...</p>
                </div>
            </div>

            <!-- Onboarding Overlay (template-first: shown when no template is loaded) -->
            <div id="onboarding-overlay" class="onboarding-overlay">
                <div class="onboarding-container">
                    <h2 class="onboarding-title">¡Elige tu plantilla!</h2>
                    <p class="onboarding-subtitle">Elige una plantilla para empezar tu web de bodas</p>

                    <div class="onboarding-steps">
                        <!-- Single step: Choose template (Wedding / template-first paradigm) -->
                        <div class="onboarding-step" data-step="1">
                            <div class="onboarding-step-icon">📄</div>
                            <h3 class="onboarding-step-title">Elegir plantilla</h3>
                            <p class="onboarding-step-desc">Selecciona el diseño que más te guste</p>
                            <div class="onboarding-step-checkmark">
                                <i data-lucide="check"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Theme Panel (Inside Editor Layout) -->
        <div class="theme-panel" id="theme-panel">
            <div class="theme-panel-wrapper">
                <div class="theme-panel-header">
                    <div class="theme-panel-title">
                        <i data-lucide="palette"></i>
                        <span>Themes</span>
                    </div>
                    <button class="theme-panel-close" id="close-theme-panel">
                        <i data-lucide="x"></i>
                    </button>
                </div>
                <div class="theme-panel-content">
                    <div class="theme-grid" id="theme-grid">
                        <!-- Themes will be loaded here -->
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Close Full-screen Button (hidden by default) -->
    <button id="close-fullscreen" class="close-fullscreen-btn" style="display: none;">
        <i data-lucide="x"></i>
    </button>

    <!-- Upgrade Modal is now loaded on demand via upgrade-modal.js -->

    <!-- Page Name Modal -->
    <div id="page-name-modal" class="page-name-modal">
        <div class="page-name-modal-content">
            <button class="page-name-modal-close" id="close-page-name-modal">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
            
            <h2 class="page-name-modal-title">New Page</h2>
            
            <div class="page-name-form">
                <label for="page-name-input" class="page-name-label">Name</label>
                <input 
                    type="text" 
                    id="page-name-input" 
                    class="page-name-input" 
                    placeholder="Enter page name"
                    maxlength="255"
                />
            </div>

            <button class="page-name-save-btn" id="save-page-name">
                Save
            </button>
        </div>
    </div>

    <!-- Custom Theme Modal -->
    <div id="custom-theme-modal" class="custom-theme-modal modal-overlay">
        <div class="custom-theme-modal-content">
            <button class="custom-theme-modal-close" id="close-custom-theme-modal">
                <i data-lucide="x"></i>
            </button>
            
            <div class="custom-theme-modal-header">
                <h2>Create Custom Theme</h2>
                <p>Customize your theme colors to match your brand</p>
            </div>
            
            <div>
                <label for="custom-theme-name" class="color-picker-label">Theme Name</label>
                <input 
                    type="text" 
                    id="custom-theme-name" 
                    class="theme-name-input" 
                    placeholder="Enter theme name (e.g., My Brand Theme)"
                    maxlength="30"
                />
            </div>

            <div class="color-picker-grid" id="color-picker-grid">
                <!-- Color pickers will be generated here -->
            </div>

            <div class="custom-theme-actions">
                <button class="custom-theme-btn custom-theme-btn-cancel" id="cancel-custom-theme">
                    Cancel
                </button>
                <button class="custom-theme-btn custom-theme-btn-save" id="save-custom-theme">
                    Save Theme
                </button>
            </div>
        </div>
    </div>

    <!-- Shared Logout Handler -->
    <script src="<?php echo editor_asset('public/js/logout-handler.js'); ?>"></script>

    <script>
         // Server-provided user data (available immediately, no waiting for Clerk.js)
        window.serverUserData = <?php echo $userDataJson ?: 'null'; ?>;
        const serverUserData = window.serverUserData; // Keep const for backward compatibility
        // Pre-loaded page data (if page parameter was in URL)
        const preloadedPageData = <?php echo $preloadedPageDataJson ?? 'null'; ?>;

        // Global variables (declare before use)
        let isDeveloperMode = <?php echo (isset($_GET['developer']) && $_GET['developer'] === '1') ? 'true' : 'false'; ?>; // ?developer=1 shows full-templates category

        // fullPage.js license key
        // Get your license at: https://alvarotrigo.com/fullPage/pricing
        window.FULLPAGE_LICENSE_KEY = '<?php echo $fullpageLicenseKey; ?>';

    </script>

    <!-- Template Loader (load before app.js) -->
    <script src="<?= editor_asset('public/js/template-loader.js') ?>"></script>

    <!-- Color Filter (must load before app.js) -->
    <script src="<?= editor_asset('public/js/color-filter.js') ?>"></script>

    <script src="<?= editor_asset('public/js/app.js') ?>"></script>

    <!-- Share Page Module -->
    <script src="<?= editor_asset('public/js/share.js') ?>"></script>

    <!-- Onboarding Component -->
    <script defer src="<?= editor_asset('public/js/onboarding.js') ?>"></script>

    <!-- Upgrade Modal Component (loaded on demand) -->
    <script src="<?= editor_asset('public/js/upgrade-modal.js') ?>"></script>

    <!-- [DISABLED_FOR_WEDDING_VERSION]: Búsqueda de secciones reemplazada por búsqueda de templates -->
    <!-- <script src="<?= editor_asset('public/js/section-search.js') ?>" async></script> -->

    <!-- Template Search Functionality (Wedding Version) -->
    <script src="<?= editor_asset('public/js/template-search.js') ?>" async></script>

    <!-- html5sortable Library for drag-and-drop -->
    <script src="https://cdn.jsdelivr.net/npm/html5sortable@0.13.3/dist/html5sortable.min.js"></script>

    <!-- Section Outline Sidebar (loaded asynchronously) -->
    <script src="<?= editor_asset('public/js/section-outline.js') ?>" async></script>

    <!-- Crisp Chat -->
    <script type="text/javascript">window.$crisp=[];window.CRISP_WEBSITE_ID="89bf80cc-90a6-4d14-acc3-d0a68bddeffc";(function(){d=document;s=d.createElement("script");s.src="https://client.crisp.chat/l.js";s.async=1;d.getElementsByTagName("head")[0].appendChild(s);})();</script>
    
</body>
</html> 
