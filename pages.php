<?php
/**
 * User Pages Dashboard
 * Displays all user pages with preview, create, edit, delete, and clone functionality
 */

// Start session early
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

require_once __DIR__ . '/includes/clerk-auth.php';
require_once __DIR__ . '/config/polar.php';

/**
 * Asset helper function for cache busting and production minified assets
 */
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

// Handle Clerk handshake request
clerk_handle_handshake();

// Synchronise the PHP session with Clerk
$serverUserData = syncClerkSession();
// Fallback to existing session state
if (!$serverUserData && isUserAuthenticated()) {
    $serverUserData = clerk_session_user_payload();
}

// Debug: log what we got
error_log("pages.php - serverUserData: " . json_encode($serverUserData));
error_log("pages.php - SESSION clerk_user_id: " . ($_SESSION['clerk_user_id'] ?? 'NOT SET'));
error_log("pages.php - Full SESSION keys: " . implode(', ', array_keys($_SESSION ?? [])));

$isAuthenticated = $serverUserData['authenticated'] ?? false;
$userEmail       = $serverUserData['email'] ?? null;
$userName        = $serverUserData['name'] ?? null;
$clerkUserId     = $serverUserData['clerk_user_id'] ?? null;
$isPaid          = $serverUserData['is_paid'] ?? false;

// Fallback: try to get clerk_user_id directly from session if not in serverUserData
if (!$clerkUserId && isset($_SESSION['clerk_user_id'])) {
    $clerkUserId = $_SESSION['clerk_user_id'];
    error_log("pages.php - Got clerk_user_id from direct session access: " . $clerkUserId);
}

// Final fallback: if we have email but no clerk_user_id, look it up from database
if (!$clerkUserId && $userEmail) {
    error_log("pages.php - No clerk_user_id in session, looking up by email: " . $userEmail);
    require_once __DIR__ . '/config/mysql-client.php';
    $tempSupabase = getMySQLClient();
    try {
        $result = $tempSupabase->select('users', 'clerk_user_id', ['email' => $userEmail]);
        if (!empty($result) && isset($result[0]['clerk_user_id'])) {
            $clerkUserId = $result[0]['clerk_user_id'];
            // Update session with the clerk_user_id
            $_SESSION['clerk_user_id'] = $clerkUserId;
            error_log("pages.php - Found and cached clerk_user_id: " . $clerkUserId);
        } else {
            error_log("pages.php - No user found in database with email: " . $userEmail);
        }
    } catch (Exception $e) {
        error_log("pages.php - Error looking up clerk_user_id by email: " . $e->getMessage());
    }
}

$avatarUrl       = $serverUserData['avatar_url']
    ?? ($serverUserData['avatar'] ?? null)
    ?? ($serverUserData['image_url'] ?? null)
    ?? ($serverUserData['profile_image_url'] ?? null);

// Load user pages if authenticated
require_once __DIR__ . '/config/mysql-client.php';
$supabase = getMySQLClient(); // Same variable name for compatibility

// Get user ID from clerk_user_id
function getUserIdFromClerkId($clerkUserId, $supabase) {
    try {
        $result = $supabase->select('users', 'id', ['clerk_user_id' => $clerkUserId]);
        if (!empty($result) && isset($result[0]['id'])) {
            return $result[0]['id'];
        }
        return null;
    } catch (Exception $e) {
        error_log("Error getting user ID: " . $e->getMessage());
        return null;
    }
}

$userId = null;
$userPages = [];

if ($isAuthenticated && $clerkUserId) {
    error_log("pages.php - Looking up user_id for clerk_user_id: " . $clerkUserId);
    $userId = getUserIdFromClerkId($clerkUserId, $supabase);
    error_log("pages.php - Found user_id: " . ($userId ? $userId : 'NULL'));
    
    if ($userId) {
        try {
            error_log("pages.php - Querying user_pages for user_id: " . $userId);
            error_log("pages.php - Using MySQL client: " . get_class($supabase));
            
            // Try querying without ORDER BY first to avoid memory issues, then sort in PHP if needed
            $userPages = $supabase->select(
                'user_pages',
                'id,title,data,thumbnail_url,is_favorite,is_public,last_accessed,created_at,updated_at',
                [
                    'user_id' => $userId,
                    'order' => 'last_accessed.desc',
                    'limit' => 100 // Limit to prevent memory issues
                ]
            );
            
            error_log("pages.php - Query returned " . count($userPages) . " pages");
            
            // Debug: log structure of first page if available
            if (!empty($userPages)) {
                error_log("pages.php - First page structure: " . json_encode(array_keys($userPages[0])));
                error_log("pages.php - First page has 'data' key: " . (isset($userPages[0]['data']) ? 'YES' : 'NO'));
                if (isset($userPages[0]['data'])) {
                    error_log("pages.php - First page data type: " . gettype($userPages[0]['data']));
                    error_log("pages.php - First page data is empty: " . (empty($userPages[0]['data']) ? 'YES' : 'NO'));
                }
            } else {
                error_log("pages.php - No pages found for user_id: " . $userId);
            }
            
        } catch (Exception $e) {
            error_log("pages.php - Error loading pages: " . $e->getMessage());
            error_log("pages.php - Error trace: " . $e->getTraceAsString());
            $userPages = [];
        }
    }
} else {
    error_log("pages.php - Not authenticated or no clerk_user_id. isAuthenticated: " . ($isAuthenticated ? 'true' : 'false') . ", clerkUserId: " . ($clerkUserId ?: 'NULL'));
}

// Redirect to signin if not authenticated
if (!$isAuthenticated || !$clerkUserId) {
    error_log("pages.php - User not authenticated, redirecting to signin");
    
    // Detect base path (works for both local and production)
    $basePath = '';
    $scriptName = $_SERVER['SCRIPT_NAME'] ?? '';
    if (strpos($scriptName, '/nine-screen-canvas-flow/') !== false) {
        // Local development
        $basePath = '/nine-screen-canvas-flow';
    }
    
    header('Location: ' . $basePath . '/signin/');
    exit;
}

// If user has no pages, redirect to app.php to create their first page
// Only redirect if not already coming from a specific action (like editing a page)
if (empty($userPages) && !isset($_GET['page']) && !isset($_GET['action'])) {
    error_log("pages.php - User has no pages, redirecting to app.php");
    
    // Detect base path (works for both local and production)
    $basePath = '';
    $scriptName = $_SERVER['SCRIPT_NAME'] ?? '';
    if (strpos($scriptName, '/nine-screen-canvas-flow/') !== false) {
        // Local development
        $basePath = '/nine-screen-canvas-flow';
    }
    
    header('Location: ' . $basePath . '/app.php');
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

/**
 * Render preview HTML for the first section of a page (or placeholder for template-only pages).
 */
function renderPagePreview($pageData) {
    if (empty($pageData)) {
        return '<span class="page-preview-placeholder">No sections</span>';
    }
    
    if (is_string($pageData)) {
        $pageData = json_decode($pageData, true);
    }
    
    if (!$pageData) {
        return '<span class="page-preview-placeholder">No sections</span>';
    }

    // Template-first: page has template but sections not yet synced — show template preview image or placeholder
    if (!empty($pageData['templateUrl']) && (empty($pageData['sections']) || !is_array($pageData['sections']))) {
        $templateUrl = $pageData['templateUrl'];
        $templateId = (strpos($templateUrl, '/index.html') !== false)
            ? basename(dirname($templateUrl))
            : basename($templateUrl, '.html');
        $previewPath = __DIR__ . '/templates/previews/hero_previews/' . $templateId . '.jpg';
        $previewSrc = 'templates/previews/hero_previews/' . $templateId . '.jpg';
        if ($templateId !== '' && file_exists($previewPath)) {
            $previewSrcEsc = htmlspecialchars($previewSrc, ENT_QUOTES, 'UTF-8');
            return '<div class="page-preview-placeholder page-preview-placeholder--template">'
                . '<img src="' . $previewSrcEsc . '" alt="Preview plantilla" class="page-preview-template-img" loading="lazy" '
                . 'onerror="this.style.display=\'none\'; var s=this.nextElementSibling; if(s) s.classList.add(\'visible\');">'
                . '<span class="page-preview-placeholder-text page-preview-placeholder-text--fallback">Página con plantilla</span>'
                . '</div>';
        }
        return '<div class="page-preview-placeholder page-preview-placeholder--template"><span class="page-preview-placeholder-text">Página con plantilla</span></div>';
    }
    
    if (!isset($pageData['sections']) || empty($pageData['sections'])) {
        return '<span class="page-preview-placeholder">No sections</span>';
    }
    
    $firstSection = $pageData['sections'][0];
    
    if (is_array($firstSection)) {
        if (isset($firstSection['html'])) {
            $firstSection = $firstSection['html'];
        } else {
            return '<span class="page-preview-placeholder">Invalid section format</span>';
        }
    }
    
    if (!is_string($firstSection) || trim($firstSection) === '') {
        return '<span class="page-preview-placeholder">Invalid section format</span>';
    }
    
    $doc = new DOMDocument();
    libxml_use_internal_errors(true);
    $doc->loadHTML('<?xml encoding="utf-8" ?>' . $firstSection, LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
    libxml_clear_errors();
    
    $xpath = new DOMXPath($doc);
    $sectionNodes = $xpath->query("//*[contains(@class, 'section')]");
    if ($sectionNodes->length === 0) {
        $sectionNodes = $doc->getElementsByTagName('section');
    }
    if ($sectionNodes->length === 0) {
        $sectionNodes = $doc->getElementsByTagName('footer');
    }
    
    if ($sectionNodes->length === 0) {
        return '<span class="page-preview-placeholder">Invalid section</span>';
    }
    
    $sectionNode = $sectionNodes->item(0);
    
    // Remove unwanted elements
    $elementsToRemove = $xpath->query(
        ".//*[contains(@class, 'section-menu') or contains(@class, 'edit-text-button') or " .
        "contains(@class, 'image-edit-button') or contains(@class, 'remove-element-button') or " .
        "contains(@class, 'fp-watermark')]",
        $sectionNode
    );
    
    foreach ($elementsToRemove as $element) {
        $element->parentNode->removeChild($element);
    }
    
    // Remove height style attribute
    if ($sectionNode->hasAttribute('style')) {
        $style = $sectionNode->getAttribute('style');
        $style = preg_replace('/height\s*:[^;]+;?/', '', $style);
        if (trim($style)) {
            $sectionNode->setAttribute('style', $style);
        } else {
            $sectionNode->removeAttribute('style');
        }
    }
    
    $cleanedHtml = $doc->saveHTML($sectionNode);
    if (trim($cleanedHtml) === '' || strlen($cleanedHtml) < 50) {
        return '<span class="page-preview-placeholder">Invalid section</span>';
    }

    // Apply theme class if present
    $themeClass = '';
    if (isset($pageData['theme']) && !empty($pageData['theme'])) {
        $themeClass = ' ' . htmlspecialchars($pageData['theme']);
    }
    // Template-first: add class so preview uses smaller scale (avoids "zoom of hero" look)
    $templateClass = (!empty($pageData['templateUrl'])) ? ' page-preview-content--template' : '';
    // Minimal template CSS vars so hero section colors (--blush, --charcoal, --font-body) resolve in card preview
    $templateVarsStyle = (!empty($pageData['templateUrl'])) ? '<style>.page-preview-content--template{--blush:#F8EDE3;--charcoal:#2C2C2C;--font-body:\'DM Sans\',\'Helvetica Neue\',sans-serif;--font-display:\'Playfair Display\',Georgia,serif;--blush-deep:#F0DAC8;--sage-light:#B8D4B8;}</style>' : '';
    $previewHtml = $templateVarsStyle . '<div class="page-preview-content' . $themeClass . $templateClass . '">' . $cleanedHtml . '</div>';
    return $previewHtml;
}

// Pass user data to JavaScript
$userDataJson = json_encode($serverUserData);
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Pages - YesLovey</title>
    
    <!-- Tailwind CSS -->
    <link href="./dist/output.css" rel="stylesheet">
    
    <!-- Sections CSS for preview rendering -->
    <link href="./public/css/sections.css" rel="stylesheet">

    <!-- Clerk Configuration -->
    <script src="./clerk-config.js"></script>
    
    <!-- Clerk Script -->
    <script
        async
        crossorigin="anonymous"
        data-clerk-publishable-key="pk_test_am9pbnQtYmxvd2Zpc2gtNjUuY2xlcmsuYWNjb3VudHMuZGV2JAlcmsuYWNjb3VudHMuZGV2JA"
        src="https://welcomed-escargot-22.clerk.accounts.dev/npm/@clerk/clerk-js@5/dist/clerk.browser.js"
        type="text/javascript">
    </script>
    
     <!-- Pages CSS -->
     <link rel="stylesheet" href="<?= editor_asset('./public/css/pages.css') ?>">
</head>
<body class="auth-loading">
    <?php if (isPolarTestMode()): ?>
    <!-- Polar Test Mode Banner -->
    <div id="polar-test-mode-banner">
        <div style="display: flex; align-items: center; gap: 8px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            <span><strong>POLAR TEST MODE:</strong> Changes you make here don't affect your live account • Payments are not processed</span>
        </div>
    </div>
    <style>
        /* Adjust body padding when test mode banner is visible */
        body {
            padding-top: 44px !important;
        }
        
        .header {
            top: 44px !important;
        }
    </style>
    <?php endif; ?>
    <!-- Auth Loading Overlay -->
    <div class="auth-loading-overlay">
        <div class="loading-spinner"></div>
    </div>
    
    <!-- Header -->
    <div class="header">
        <a href="/" class="logo">
            YesLovey <span class="logo-beta">Beta</span>
        </a>
        <div class="user-menu">
            <!-- User Info -->
            <div class="user-info flex items-center gap-2">
                <!-- Logged in user display -->
                <div id="clerk-user-button" style="position: relative;">
                    <div
                        class="flex items-center gap-2 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2"
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
                                    alt="<?php echo htmlspecialchars(($displayName ?: 'Account') . ' avatar', ENT_QUOTES, 'UTF-8'); ?>"
                                    data-role="user-avatar-img"
                                    loading="lazy"
                                >
                            <?php else: ?>
                                <span class="user-avatar-initial" data-role="user-avatar-initial">
                                    <?php echo htmlspecialchars($avatarInitial, ENT_QUOTES, 'UTF-8'); ?>
                                </span>
                            <?php endif; ?>
                        </div>
                        <span class="text-sm text-gray-700" data-role="user-name">
                            <?php echo htmlspecialchars($displayName ?: 'Account'); ?>
                        </span>
                    </div>
                    <div class="user-dropdown" id="server-user-dropdown" role="menu" aria-hidden="true">
                        <button class="user-dropdown-item" type="button" data-menu-action="manage" role="menuitem">
                            Manage Account
                        </button>
                        <?php if (!$isPaid): ?>
                        <button class="user-dropdown-item" type="button" data-menu-action="upgrade" role="menuitem">
                            Upgrade
                        </button>
                        <?php endif; ?>
                        <button class="user-dropdown-item user-dropdown-item-danger" type="button" data-menu-action="logout" role="menuitem">
                            Logout
                        </button>
                    </div>
                    <?php if ($isPaid): ?>
                        <span class="pro-badge" id="clerk-pro-badge">PRO</span>
                    <?php endif; ?>
                </div>
            </div>
        </div>
    </div>

    <!-- Main Container -->
    <div class="container">
        <div class="page-header">
            <h1 class="page-title">Your Wedding Websites</h1>
            <p class="page-subtitle">Create and manage your websites</p>
        </div>

        <?php if (empty($userPages)): ?>
            <!-- Empty State -->
            <div class="empty-state">
                <div class="empty-state-icon">📄</div>
                <h2 class="empty-state-title">No webpages yet</h2>
                <p class="empty-state-text">Create your first webpage to get started</p>
                <button class="btn btn-primary" onclick="createNewPage()">Create Your First Webpage</button>
            </div>
        <?php else: ?>
            <!-- Pages Grid -->
            <div class="pages-grid">
                <!-- New Page Card -->
                <div class="page-card new-page" onclick="createNewPage()">
                    <div class="new-page-content">
                        <div class="new-page-icon">+</div>
                        <div class="new-page-text">new webpage</div>
                    </div>
                </div>

                <!-- Existing Page Cards -->
                <?php foreach ($userPages as $page): ?>
                    <?php
                    $pageId = htmlspecialchars($page['id'] ?? '');
                    $pageTitle = htmlspecialchars($page['title'] ?? 'Untitled');
                    $lastAccessed = isset($page['last_accessed']) && $page['last_accessed']
                        ? date('d/m/Y', strtotime($page['last_accessed'])) 
                        : 'Never';
                    // Handle missing data field - decode JSON if string (MySQL may return data as JSON string)
                    $pageData = $page['data'] ?? [];
                    if (is_string($pageData)) {
                        $pageData = json_decode($pageData, true) ?? [];
                    }
                    if (!is_array($pageData)) {
                        error_log("pages.php - Page {$pageId} has invalid data field, using empty array");
                        $pageData = [];
                    }
                    $previewHtml = renderPagePreview($pageData);
                    ?>
                    <div class="page-card" onclick="editPage('<?php echo $pageId; ?>')">
                        <div class="page-preview">
                            <?php echo $previewHtml; ?>
                            <button class="page-action-menu-btn" onclick="event.stopPropagation(); togglePageMenu('<?php echo $pageId; ?>')" aria-label="Page options">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="12" cy="12" r="1"/>
                                    <circle cx="12" cy="5" r="1"/>
                                    <circle cx="12" cy="19" r="1"/>
                                </svg>
                            </button>
                            <div class="page-action-dropdown" id="menu-<?php echo $pageId; ?>">
                                <button class="page-action-dropdown-item" onclick="event.stopPropagation(); editPageTitle('<?php echo $pageId; ?>', '<?php echo $pageTitle; ?>')">
                                    Edit Title
                                </button>
                                <button class="page-action-dropdown-item" onclick="event.stopPropagation(); clonePage('<?php echo $pageId; ?>')">
                                    Clone
                                </button>
                                <button class="page-action-dropdown-item danger" onclick="event.stopPropagation(); deletePage('<?php echo $pageId; ?>', '<?php echo $pageTitle; ?>')">
                                    Delete
                                </button>
                            </div>
                        </div>
                        <div class="page-info">
                            <div class="page-title-text"><?php echo $pageTitle; ?></div>
                            <div class="page-meta">Last edited: <?php echo $lastAccessed; ?></div>
                        </div>
                    </div>
                <?php endforeach; ?>
            </div>
        <?php endif; ?>
    </div>

    <!-- New Page Modal -->
    <div id="newPageModal" class="modal">
        <div class="modal-content">
            <h2 class="modal-title">Create New Page</h2>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label" for="pageTitle">Page Name</label>
                    <input type="text" id="pageTitle" class="form-input" placeholder="Enter page name" autofocus>
                </div>
            </div>
            <div class="modal-actions">
                <button class="btn btn-secondary" onclick="closeNewPageModal()">Cancel</button>
                <button class="btn btn-primary" onclick="submitNewPage()">Create Page</button>
            </div>
        </div>
    </div>

    <!-- Edit Page Title Modal -->
    <div id="editTitleModal" class="modal">
        <div class="modal-content">
            <h2 class="modal-title">Edit Page Title</h2>
            <div class="modal-body">
                <div class="form-group">
                    <input type="text" id="editPageTitle" class="form-input" placeholder="Enter page name">
                </div>
            </div>
            <div class="modal-actions">
                <button class="btn btn-secondary" onclick="closeEditTitleModal()">Cancel</button>
                <button class="btn btn-primary" onclick="submitEditTitle()">Save</button>
            </div>
        </div>
    </div>

    <!-- Shared Logout Handler -->
    <script src="<?= editor_asset('./public/js/logout-handler.js') ?>"></script>

    <!-- Upgrade Modal Component (loaded on demand) -->
    <script src="<?= editor_asset('./public/js/upgrade-modal.js') ?>"></script>

    <!-- Inject PHP data for pages.js -->
    <script>
        // User data from PHP
        const serverUserData = <?php echo $userDataJson; ?>;
        const phpUserId = <?php echo json_encode($userId); ?>;
        const phpUserPagesCount = <?php echo count($userPages); ?>;
        const phpIsAuthenticated = <?php echo $isAuthenticated ? 'true' : 'false'; ?>;
        const phpClerkUserId = <?php echo json_encode($clerkUserId); ?>;
    </script>

    <!-- Pages -->
    <script src="<?= editor_asset('./public/js/pages.js') ?>"></script>

   <!-- Crisp Chat -->
   <script type="text/javascript">window.$crisp=[];window.CRISP_WEBSITE_ID="89bf80cc-90a6-4d14-acc3-d0a68bddeffc";(function(){d=document;s=d.createElement("script");s.src="https://client.crisp.chat/l.js";s.async=1;d.getElementsByTagName("head")[0].appendChild(s);})();</script>
    
</body>
</html>

