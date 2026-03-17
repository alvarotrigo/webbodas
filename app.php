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

// Simulate PRO user when ?pro=1 is in the URL (for development/testing)
if (!empty($_GET['pro']) && $_GET['pro'] === '1' && $serverUserData) {
    $serverUserData['is_paid'] = true;
    $serverUserData['mode'] = 'paid';
    $isPaid = true;
    $_SESSION['simulate_pro'] = true; // So api/pages.php and other APIs treat this session as Pro
} elseif (isset($_GET['pro']) && $_GET['pro'] !== '1') {
    $_SESSION['simulate_pro'] = false; // Explicitly turn off simulation
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

// Topbar published indicator (green icon + domain when page is published)
$topbarPublishedUrl = null;
$topbarPublishedDisplay = null;
if ($preloadedPageData && !empty($preloadedPageData['page']['is_public']) && !empty($preloadedPageData['page']['share_slug'])) {
    $shareBaseDomain = getenv('SHARE_BASE_DOMAIN') ?: 'yeslovey.com';
    $slug = trim((string) $preloadedPageData['page']['share_slug']);
    // Custom domain: share_slug is already the full domain (e.g. "mi-boda.com")
    if (strpos($slug, '.') !== false) {
        $topbarPublishedDisplay = $slug;
    } else {
        $topbarPublishedDisplay = $slug . '.' . $shareBaseDomain;
    }
    $topbarPublishedUrl = 'https://' . $topbarPublishedDisplay;
}

// Hide navbar (title + buttons) until a template is present — class on body from first paint to avoid flash
$hideNavbarUntilTemplate = false;
if ($isAuthenticated) {
    if (!$pageIdFromUrl) {
        $hideNavbarUntilTemplate = true;
    } elseif ($preloadedPageData && !empty($preloadedPageData['page']['data'])) {
        $raw = $preloadedPageData['page']['data'];
        $data = is_string($raw) ? json_decode($raw, true) : $raw;
        $hasTemplate = is_array($data) && (!empty($data['fullHtml']) || !empty($data['templateUrl'] ?? ''));
        $hideNavbarUntilTemplate = !$hasTemplate;
    } else {
        $hideNavbarUntilTemplate = true;
    }
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
        data-clerk-publishable-key="pk_test_am9pbnQtYmxvd2Zpc2gtNjUuY2xlcmsuYWNjb3VudHMuZGV2JA"
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

    <!-- [DISABLED_FOR_WEDDING_VERSION]: Color filter functionality removed.
    <link rel="stylesheet" href="<?= editor_asset('public/css/color-filter.css') ?>">
    -->

    <!-- Progressive Image Loader - Prevents connection limit issues -->
    <script src="<?= editor_asset('public/js/progressive-image-loader.js') ?>"></script>
    
    <!-- History Manager -->
    <script src="<?= editor_asset('public/js/history-manager.js') ?>"></script>
    <script src="<?= editor_asset('public/js/history/commands/background-change-command.js') ?>"></script>
    <script src="<?= editor_asset('public/js/history/commands/image-change-command.js') ?>"></script>
    <script src="<?= editor_asset('public/js/history/commands/inline-video-change-command.js') ?>"></script>
    <script src="<?= editor_asset('public/js/history/commands/inline-svg-change-command.js') ?>"></script>
    <script src="<?= editor_asset('public/js/history/commands/inline-emoji-change-command.js') ?>"></script>
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
<body<?php echo $hideNavbarUntilTemplate ? ' class="onboarding-visible"' : ''; ?>>
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
        <!-- Left Section: Your Pages button + Page Name -->
        <div class="top-bar-left">
            <?php if ($isAuthenticated): ?>
            <!-- Your Pages: link to pages list (pages.php); same look as onboarding button -->
            <a href="pages.php" id="view-pages-btn" class="view-pages-btn" data-tippy-content="Your Pages" aria-label="Your Pages">
                <i data-lucide="files" class="view-pages-icon"></i>
                <span class="view-pages-label">Your Pages</span>
            </a>
            <!-- Vertical separator between Your Pages and page title -->
            <div class="top-bar-separator" aria-hidden="true"></div>
            <!-- [DISABLED_FOR_WEDDING_VERSION]: Pages sidebar and its toggle removed; user opens pages via "Your Pages" link to pages.php only. -->
            <!-- <button type="button" id="topbar-files-btn" class="topbar-files-btn" data-tippy-content="Your Pages" aria-label="Open pages sidebar" style="display: none;">
                <i data-lucide="files" class="topbar-files-icon"></i>
            </button> -->
            <!-- Page Name Display with Back Button -->
            <div class="top-bar-page-block">
                <div class="top-bar-page-name-row flex items-center gap-2">
                    <!-- Published indicator: green dot. Tooltip shows URL; click opens site in new tab. -->
                    <a href="<?php echo $topbarPublishedUrl ? htmlspecialchars($topbarPublishedUrl, ENT_QUOTES, 'UTF-8') : '#'; ?>" target="_blank" rel="noopener" id="topbar-published-link" class="topbar-published-dot-link" style="display: <?php echo ($topbarPublishedUrl !== null) ? 'inline-flex' : 'none'; ?>;" title="<?php echo $topbarPublishedDisplay ? htmlspecialchars($topbarPublishedDisplay, ENT_QUOTES, 'UTF-8') : ''; ?>" data-tippy-content="<?php echo $topbarPublishedDisplay ? htmlspecialchars($topbarPublishedDisplay, ENT_QUOTES, 'UTF-8') : ''; ?>" aria-label="Open published website"><span class="topbar-published-dot" aria-hidden="true"></span></a>
                    <div class="page-name-container flex items-center gap-2">
                        <!-- [DISABLED_FOR_WEDDING_VERSION]: Back arrow to pages.php removed - pages.php is no longer part of the user flow.
                        <a href="./pages.php" class="back-arrow-btn" data-tippy-content="Back to pages">
                            <i data-lucide="arrow-left" class="w-5 h-5" style="color: #9333ea;"></i>
                        </a>
                        <div class="page-name-separator" style="width: 1px; height: 20px; background: #e5e5e7;"></div>
                        -->
                        <span class="page-name-text" id="page-name-display" contenteditable="false" role="textbox" tabindex="0" title="<?php echo htmlspecialchars($initialPageTitle, ENT_QUOTES, 'UTF-8'); ?>" data-tippy-content="Edit page title">
                            <?php echo htmlspecialchars($initialPageTitle, ENT_QUOTES, 'UTF-8'); ?>
                        </span>
                        <!-- [DISABLED_FOR_WEDDING_VERSION]: View Website icon removed from topbar.
                        <a id="topbar-view-website-link" href="#" target="_blank" rel="noopener" class="topbar-view-website-icon" style="display: none;" data-tippy-content="View your published website" aria-label="View your published website">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        </a>
                        -->
                        <!-- [DISABLED_FOR_WEDDING_VERSION]: Trash icon replaced by View Your Pages button. The delete action is now available inside the left sidebar pages list.
                        <button type="button" id="delete-page-btn" class="delete-page-btn" aria-label="Delete page" data-tippy-content="Delete page" style="display: none;">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                        -->
                    </div>
                </div>
            </div>

            <!-- Undo/Redo: to the right of page title, left of Saved -->
            <div class="top-bar-card flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                <button id="undo-btn" class="history-btn" data-tippy-content="Undo (Ctrl+Z)" disabled>
                    <i data-lucide="undo-2" class="w-4 h-4"></i>
                </button>
                <button id="redo-btn" class="history-btn" data-tippy-content="Redo (Ctrl+Shift+Z)" disabled>
                    <i data-lucide="redo-2" class="w-4 h-4"></i>
                </button>
            </div>

            <!-- [DISABLED_FOR_WEDDING_VERSION]: Change Template button replaced by View Your Pages button.
            <button id="change-template-btn" class="change-template-btn" style="display:none;" data-tippy-content="Choose a new template">
                <i data-lucide="layout-template" class="w-4 h-4"></i>
                <span>Change Template</span>
            </button>
            -->


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

        <!-- Center Section: Theme Selector + Viewport Buttons -->
        <div class="top-bar-center">
            <!-- Theme Selector Button (compact, no text) -->
            <button id="topbar-theme-btn" class="topbar-theme-btn" data-tippy-content="Change theme" disabled>
                <div class="topbar-theme-preview" id="topbar-theme-preview">
                    <!-- Color swatches updated by JS -->
                </div>
            </button>

            <div class="top-bar-card flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                <button class="viewport-btn" data-viewport="mobile" data-tippy-content="Mobile view" disabled>
                    <i data-lucide="smartphone" class="w-4 h-4"></i>
                </button>
                <button class="viewport-btn" data-viewport="tablet" data-tippy-content="Tablet view" disabled>
                    <i data-lucide="tablet" class="w-4 h-4"></i>
                </button>
                <button class="viewport-btn active" data-viewport="desktop" data-tippy-content="Desktop view" disabled>
                    <i data-lucide="monitor" class="w-4 h-4"></i>
                </button>
            </div>
        </div>

        <!-- Right Section: Other Buttons and User Info -->
        <div class="top-bar-right flex items-center gap-4">
            <!-- <button id="clear-all" class="clear-button flex items-center">
                <i data-lucide="trash-2" class="w-4 h-4 mr-2"></i>
                Clear All
            </button> -->
            <button id="preview-fullscreen" class="preview-fullscreen-btn" data-tippy-content="Preview" disabled>
                <i data-lucide="eye"></i>
            </button>
            <button id="share-page" class="share-btn" data-tippy-content="Share page" disabled style="<?php echo ($topbarPublishedUrl !== null) ? 'display: none;' : ''; ?>">
                <i data-lucide="share-2" class="share-icon"></i>
                <svg class="share-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
            </button>
            <?php if ($isAuthenticated): ?>
            <a href="#" id="rsvp-dashboard-btn" class="topbar-rsvp-btn topbar-guests-btn" data-tippy-content="List of Guest" style="display: none; text-decoration: none;" aria-label="List of Guest">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </a>
            <?php endif; ?>
            <div class="publish-dropdown-wrap" id="publish-dropdown-wrap">
                <button id="download-page" class="download-btn publish-btn" data-tippy-content="Publish page" disabled>
                    <i data-lucide="upload-cloud"></i> <span class="publish-btn-label text-sm pl-2">Publish</span>
                </button>
                <button type="button" id="publish-options-trigger" class="publish-options-chevron" aria-label="Options" data-tippy-content="Options" style="display: none;" aria-haspopup="true" aria-expanded="false">
                    <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                <div class="publish-options-menu" id="publish-options-menu" role="menu" aria-hidden="true">
                    <button type="button" class="publish-options-menu-item" data-publish-action="unpublish" role="menuitem">
                        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
                        <span>Unpublish</span>
                    </button>
                    <button type="button" class="publish-options-menu-item" data-publish-action="copy-link" role="menuitem">
                        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                        <span>Copy Link</span>
                    </button>
                    <button type="button" class="publish-options-menu-item" data-publish-action="change-domain" role="menuitem">
                        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
                        <span>Change Domain</span>
                    </button>
                </div>
            </div>

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


    <!-- [DISABLED_FOR_WEDDING_VERSION]: Pages sidebar and toggle-sidebar removed; pages are managed via "Your Pages" link to pages.php only. -->
    <!-- <div class="sidebar" id="pages-sidebar">

        <button class="sidebar-toggle" id="toggle-sidebar" aria-label="Pages" data-tippy-content="Pages" data-tippy-placement="right">
            <i data-lucide="files"></i>
        </button>

        <div class="sidebar-content">

            <div class="pages-sidebar-panel" id="pages-sidebar-panel">
                <div class="pages-sidebar-header">
                    <div class="pages-sidebar-title">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15.5 2H8.6c-.4 0-.8.2-1.1.5-.3.3-.5.7-.5 1.1v12.8c0 .4.2.8.5 1.1.3.3.7.5 1.1.5h9.8c.4 0 .8-.2 1.1-.5.3-.3.5-.7.5-1.1V6.5L15.5 2z"/><polyline points="15 2 15 7 20 7"/><line x1="10" y1="12" x2="16" y2="12"/><line x1="10" y1="16" x2="16" y2="16"/><line x1="10" y1="8" x2="12" y2="8"/></svg>
                        Your Pages
                    </div>
                    <button class="pages-sidebar-close" id="pages-sidebar-close" aria-label="Close pages sidebar">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
                <div class="pages-list" id="pages-list">
                </div>
            </div>

            <div id="current-theme-preview" style="display:none;"></div>
            <span id="current-theme-name" style="display:none;"></span>

        </div>
    </div> -->

    <!-- Hidden elements for JS compatibility (updateCurrentThemeButton uses these IDs) -->
    <div id="current-theme-preview" style="display:none;"></div>
    <span id="current-theme-name" style="display:none;"></span>

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

    <!-- Page Preview Hover Panel (second sidebar for page previews from sidebar list) -->
    <div class="page-preview-hover-panel" id="page-preview-hover-panel">
        <div class="page-preview-hover-header">
            <span class="page-preview-hover-title" id="page-preview-hover-title">Preview</span>
            <button type="button" class="page-preview-hover-close" id="page-preview-hover-close" aria-label="Close preview">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        </div>
        <div class="page-preview-hover-body">
            <iframe id="page-preview-hover-iframe" class="page-preview-hover-iframe" src="about:blank" title="Page preview"></iframe>
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
        <!-- [DISABLED_FOR_WEDDING_VERSION]: Color filter container removed.
        <div id="color-filter-container" class="panel-color-filter"></div>
        -->
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
                <div class="onboarding-container onboarding-container--gallery">
                    <h2 class="onboarding-title">Choose your Wedding template</h2>
                    <p class="onboarding-subtitle">Choose a template to start your wedding website. You will be able to remove sections and change the theme.</p>

                    <!-- Onboarding: category pills (left) + search (right) in one row -->
                    <div class="onboarding-filters-row">
                        <div class="onboarding-category-filters" id="onboarding-category-filters"></div>
                        <div class="onboarding-search-wrap">
                            <svg class="onboarding-search-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            <input type="text" id="onboarding-search-input" class="onboarding-search-input" placeholder="Search templates..." autocomplete="off" spellcheck="false">
                            <button id="onboarding-search-clear" class="onboarding-search-clear" aria-label="Clear search">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </div>
                    </div>

                    <!-- Template gallery grid (populated by onboarding.js) -->
                    <div class="onboarding-template-gallery" id="onboarding-template-gallery">
                        <!-- Cards will be injected here by onboarding.js -->
                        <div class="onboarding-gallery-loading">
                            <svg class="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
                                <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/>
                            </svg>
                            <p>Loading templates...</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Onboarding Preview Popup (iframe + theme sidebar) -->
            <div id="onboarding-preview-popup" class="onboarding-preview-popup">
                <div class="onboarding-preview-popup-backdrop"></div>

                <div class="onboarding-preview-popup-card">
                    <!-- Close button -->
                    <button class="onboarding-preview-popup-close" id="onboarding-preview-popup-close" aria-label="Close">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>

                    <!-- Device view toggle bar (same style as top-bar viewport buttons) -->
                    <div class="onboarding-preview-device-bar top-bar-card flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                        <button class="viewport-btn onboarding-preview-device-btn" id="opd-mobile" data-device="mobile" aria-label="Mobile view" title="Mobile view">
                            <i data-lucide="smartphone" class="w-4 h-4"></i>
                        </button>
                        <button class="viewport-btn onboarding-preview-device-btn" id="opd-tablet" data-device="tablet" aria-label="Tablet view" title="Tablet view">
                            <i data-lucide="tablet" class="w-4 h-4"></i>
                        </button>
                        <button class="viewport-btn onboarding-preview-device-btn active" id="opd-desktop" data-device="desktop" aria-label="Desktop view" title="Desktop view">
                            <i data-lucide="monitor" class="w-4 h-4"></i>
                        </button>
                    </div>

                    <!-- Navigation arrows (attached to card left/right edges) -->
                    <button class="onboarding-preview-nav onboarding-preview-nav--prev" id="onboarding-preview-nav-prev" aria-label="Previous template">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                    </button>
                    <button class="onboarding-preview-nav onboarding-preview-nav--next" id="onboarding-preview-nav-next" aria-label="Next template">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>

                    <!-- Two-column body -->
                    <div class="onboarding-preview-popup-body">
                        <!-- Left: full template iframe (read-only, no editor) -->
                        <div class="onboarding-preview-popup-iframe-col" id="onboarding-preview-iframe-col">
                            <div class="onboarding-preview-iframe-wrapper">
                                <iframe id="onboarding-preview-iframe" class="onboarding-preview-iframe" src="about:blank" title="Template preview"></iframe>
                            </div>
                        </div>

                        <!-- Right: theme sidebar (collapsible) -->
                        <div class="onboarding-preview-popup-themes-col" id="onboarding-preview-themes-col">
                            <!-- Re-open button (visible only when collapsed) -->
                            <button class="onboarding-preview-themes-reopen" id="onboarding-preview-themes-reopen" aria-label="Show themes" title="Show themes">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
                            </button>
                            <div class="onboarding-preview-themes-inner">
                                <div class="onboarding-preview-themes-header">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
                                    <span>Themes</span>
                                    <button type="button" class="theme-panel-reset-badge onboarding-preview-themes-reset" id="onboarding-preview-themes-reset" aria-label="Reset to default theme" title="Reset to default theme">Reset</button>
                                    <button class="onboarding-preview-themes-toggle" id="onboarding-preview-themes-toggle" aria-label="Toggle themes panel" title="Hide themes">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l10 0"/><path d="M4 12l4 4"/><path d="M4 12l4 -4"/><path d="M20 4l0 16"/></svg>
                                    </button>
                                </div>
                                <div class="onboarding-preview-themes-list" id="onboarding-preview-themes-list">
                                    <!-- Theme cards injected by JS -->
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Choose button (straddles bottom edge) -->
                    <div class="onboarding-preview-popup-footer">
                        <button class="onboarding-preview-choose-btn" id="onboarding-preview-choose-btn">Choose</button>
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
                        <button type="button" class="theme-panel-reset-badge" id="theme-panel-reset" aria-label="Reset to default theme" title="Reset to default theme">Reset</button>
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

    <!-- Delete Page Confirmation Modal -->
    <div id="delete-page-modal" class="delete-page-modal">
        <div class="delete-page-modal-content">
            <h2 class="delete-page-modal-title">Delete page?</h2>
            <p class="delete-page-modal-message">This page will be permanently deleted. This action cannot be undone.</p>
            <div class="delete-page-modal-actions">
                <button type="button" id="delete-page-modal-cancel" class="delete-page-modal-btn delete-page-modal-cancel">Cancel</button>
                <button type="button" id="delete-page-modal-confirm" class="delete-page-modal-btn delete-page-modal-confirm">Delete</button>
            </div>
        </div>
    </div>

    <!-- Unpublish Website Confirmation Modal (same look as delete-page-modal) -->
    <div id="unpublish-website-modal" class="delete-page-modal">
        <div class="delete-page-modal-content">
            <h2 class="delete-page-modal-title">Unpublish Website?</h2>
            <p class="delete-page-modal-message" id="unpublish-website-modal-message"></p>
            <div class="delete-page-modal-actions">
                <button type="button" id="unpublish-website-modal-cancel" class="delete-page-modal-btn delete-page-modal-cancel">Cancel</button>
                <button type="button" id="unpublish-website-modal-confirm" class="delete-page-modal-btn delete-page-modal-confirm">Unpublish</button>
            </div>
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

    <!-- [DISABLED_FOR_WEDDING_VERSION]: Color filter script removed.
    <script src="<?= editor_asset('public/js/color-filter.js') ?>"></script>
    -->

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
    <script type="text/javascript">window.$crisp=[];window.CRISP_WEBSITE_ID="d4ebad7e-2de5-4f33-b155-d5bcf5601cc0";(function(){d=document;s=d.createElement("script");s.src="https://client.crisp.chat/l.js";s.async=1;d.getElementsByTagName("head")[0].appendChild(s);})();</script>

    <!-- RSVP Dashboard (Guests) button: show when page has a form. Kept visible after unpublish so user can still access guest list. -->
    <!-- Also initializes "View Website" button mode if page is already published -->
    <script>
    (function () {
        var preloaded = <?= $preloadedPageDataJson ?>;

        function showRsvpBtn(pageId) {
            var btn = document.getElementById('rsvp-dashboard-btn');
            if (!btn || !pageId) return;
            btn.href = 'rsvp.php?page=' + encodeURIComponent(pageId);
            btn.style.display = 'flex';
        }

        // Show Guests button if page has a form (current or past); keep visible even when unpublished
        if (preloaded && preloaded.page && preloaded.page.id) {
            var pageHasForm = preloaded.page.data && preloaded.page.data.fullHtml &&
                preloaded.page.data.fullHtml.indexOf('<form') !== -1;
            if (pageHasForm) {
                showRsvpBtn(preloaded.page.id);
            }
        }

        // Switch Publish button to the correct initial state on page load:
        // - "Published!" (green)       → published, no pending changes
        // - "Publish Changes" (blue)   → published, has_unpublished_changes=1
        // - "Publish" (blue)           → not yet published
        function initViewWebsiteBtn() {
            if (window.downloadOptionsHandler && typeof window.downloadOptionsHandler.setViewWebsiteMode === 'function') {
                var page = preloaded && preloaded.page;
                if (page && page.is_public && page.share_slug) {
                    if (page.has_unpublished_changes) {
                        window.downloadOptionsHandler.setPublishChangesMode(page.share_slug);
                    } else {
                        window.downloadOptionsHandler.setViewWebsiteMode(page.share_slug);
                    }
                } else {
                    // Reset to Publish mode; preserve slug for reactivation if it exists
                    var prevSlug = (page && page.share_slug) ? page.share_slug : null;
                    window.downloadOptionsHandler.setPublishMode(prevSlug);
                    // Also hide topbar published indicator since this page is not published
                    var topbarLink = document.getElementById('topbar-published-link');
                    if (topbarLink) { topbarLink.style.display = 'none'; topbarLink.href = '#'; }
                }
            } else {
                setTimeout(initViewWebsiteBtn, 250);
            }
        }

        // Also show button after a successful publish
        var origShowSuccess = null;
        function patchPublishSuccess() {
            if (window.downloadOptionsHandler && window.downloadOptionsHandler.showSuccessMessage && !origShowSuccess) {
                origShowSuccess = window.downloadOptionsHandler.showSuccessMessage.bind(window.downloadOptionsHandler);
                window.downloadOptionsHandler.showSuccessMessage = function (shareUrl) {
                    origShowSuccess(shareUrl);
                    var pm = window.pageManagerInstance;
                    if (pm && pm.currentPageId) {
                        showRsvpBtn(pm.currentPageId);
                    }
                    // Show published indicator in topbar (green dot + domain)
                    var link = document.getElementById('topbar-published-link');
                    if (link && shareUrl) {
                        var domainDisplay = shareUrl.replace(/^https:\/\//, '');
                        link.style.display = 'inline-flex';
                        link.href = shareUrl;
                        link.title = domainDisplay;
                        link.setAttribute('data-tippy-content', domainDisplay);
                    }
                };
            }
        }

        // Initialize once DOM and handler are ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function () {
                setTimeout(initViewWebsiteBtn, 400);
                setTimeout(patchPublishSuccess, 500);
            });
        } else {
            setTimeout(initViewWebsiteBtn, 400);
            setTimeout(patchPublishSuccess, 500);
        }
    })();
    </script>
    
</body>
</html> 
