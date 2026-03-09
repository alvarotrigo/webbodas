<?php
/**
 * RSVP Dashboard
 * Private dashboard showing form submissions for a published wedding website.
 * Requires Clerk authentication or a valid dashboard_access_token.
 */

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

require_once __DIR__ . '/includes/clerk-auth.php';
require_once __DIR__ . '/config/polar.php';

clerk_handle_handshake();

$serverUserData = syncClerkSession();
if (!$serverUserData && isUserAuthenticated()) {
    $serverUserData = clerk_session_user_payload();
}

$isAuthenticated = $serverUserData['authenticated'] ?? false;
$userEmail       = $serverUserData['email'] ?? null;
$userName        = $serverUserData['name'] ?? null;
$isPaid          = $serverUserData['is_paid'] ?? false;
$clerkUserId     = $serverUserData['clerk_user_id'] ?? ($_SESSION['clerk_user_id'] ?? null);

$avatarUrl = $serverUserData['avatar_url']
    ?? ($serverUserData['avatar'] ?? null)
    ?? ($serverUserData['image_url'] ?? null)
    ?? ($serverUserData['profile_image_url'] ?? null);
if (!is_string($avatarUrl) || trim($avatarUrl) === '') $avatarUrl = null;

$displayName  = $userName ?: $userEmail ?: 'Account';
$userInitial  = mb_strtoupper(mb_substr($displayName, 0, 1, 'UTF-8'), 'UTF-8') ?: '?';

// Allow access via dashboard_access_token (shared link for partner)
$accessToken  = trim($_GET['access_token'] ?? '');
$hasAccessToken = false;

if (!$isAuthenticated && $accessToken) {
    // Validate the token against the DB
    require_once __DIR__ . '/config/mysql-client.php';
    $pdo = getDatabaseConnection();
    $stmt = $pdo->prepare(
        "SELECT id FROM dashboard_access_links
         WHERE access_token = ? AND is_active = 1
           AND (expires_at IS NULL OR expires_at > NOW())
         LIMIT 1"
    );
    $stmt->execute([$accessToken]);
    $hasAccessToken = (bool)$stmt->fetch();
}

if (!$isAuthenticated && !$hasAccessToken) {
    $currentUrl = $_SERVER['REQUEST_URI'] ?? '/rsvp';
    header('Location: auth-wall.html?redirect=' . urlencode($currentUrl));
    exit;
}

/**
 * Asset helper (same as app.php / pages.php)
 */
function editor_asset(string $path): string
{
    if (preg_match('#^(https?:)?//#', $path)) return $path;
    $isProduction = ($_ENV['APP_ENV'] ?? getenv('APP_ENV')) === 'production';
    static $manifest = null;
    if ($isProduction) {
        if ($manifest === null) {
            $manifestPath = __DIR__ . '/public/dist/rev-manifest.json';
            $manifest = file_exists($manifestPath) ? (json_decode(file_get_contents($manifestPath), true) ?? []) : [];
        }
        $lookupPath = ltrim(preg_replace('#^public/#', '', ltrim($path, './')), '/');
        if (isset($manifest[$lookupPath])) return './public/dist/' . $manifest[$lookupPath];
    }
    $relativePath = ltrim($path, './');
    $fullPath = __DIR__ . '/' . ltrim($relativePath, '/');
    if (!file_exists($fullPath)) return $path;
    $sep = strpos($path, '?') === false ? '?v=' : '&v=';
    return $path . $sep . filemtime($fullPath);
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RSVP Dashboard</title>

    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">

    <!-- App base CSS (design tokens + user menu) -->
    <link rel="stylesheet" href="<?= editor_asset('public/css/app.css') ?>">

    <!-- RSVP Dashboard CSS -->
    <link rel="stylesheet" href="<?= editor_asset('public/css/rsvp.css') ?>">

    <!-- Lucide icons -->
    <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>
</head>
<body>

<!-- ================================================================
     TOP BAR
================================================================ -->
<div class="rsvp-top-bar">
    <!-- Left: back + page title -->
    <div class="rsvp-top-bar-left">
        <a href="./pages.php" class="rsvp-back-btn" title="Back to pages">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </a>
        <div class="rsvp-top-bar-separator"></div>
        <span id="rsvp-page-title" class="rsvp-page-title">RSVP Dashboard</span>
        <span id="form-status-badge" class="rsvp-form-status-badge open" style="margin-left:8px;">
            <span class="rsvp-form-status-dot"></span>Form open
        </span>
        <!-- Lock icon — toggles the form open/closed directly -->
        <button id="rsvp-toggle-form-btn" class="rsvp-lock-btn" title="Open or close the RSVP form">
            <!-- Icon swapped by rsvp.js via updateFormStatusBadge() -->
            <!-- Open lock (default, shown when form is open) -->
            <svg class="lock-icon-open" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
            <!-- Closed lock (shown when form is closed) -->
            <svg class="lock-icon-closed" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:none;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </button>
    </div>

    <!-- Center: actions -->
    <div class="rsvp-top-bar-center">

        <!-- Share private link -->
        <button id="rsvp-share-btn" class="rsvp-btn" title="Share dashboard with your partner">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            <span>Share access</span>
        </button>

        <!-- Export CSV -->
        <button id="rsvp-export-btn" class="rsvp-btn" title="Download as CSV (Excel / Google Sheets)">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span>Export CSV</span>
        </button>

        <!-- Manage guest groups -->
        <button id="rsvp-groups-btn" class="rsvp-btn" title="Manage guest groups">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
            <span>Groups</span>
        </button>
    </div>

    <!-- Right: user menu -->
    <div class="rsvp-top-bar-right">
        <?php if ($isAuthenticated): ?>
        <div class="user-info flex items-center gap-2">
            <div id="clerk-user-button" style="position:relative;">
                <div
                    class="flex items-center gap-2 p-2 rounded-lg"
                    id="server-user-display"
                    role="button"
                    tabindex="0"
                    aria-haspopup="true"
                    aria-expanded="false"
                    style="cursor:pointer;"
                >
                    <div class="user-avatar<?= $avatarUrl ? ' has-image' : '' ?>" data-role="user-avatar-wrapper">
                        <?php if ($avatarUrl): ?>
                            <img src="<?= htmlspecialchars($avatarUrl, ENT_QUOTES, 'UTF-8') ?>" alt="Avatar" loading="lazy" data-role="user-avatar-img">
                        <?php else: ?>
                            <span class="user-avatar-initial"><?= htmlspecialchars($userInitial, ENT_QUOTES, 'UTF-8') ?></span>
                        <?php endif; ?>
                    </div>
                    <span class="text-sm text-gray-700" data-role="user-name">
                        <?= htmlspecialchars($displayName) ?>
                    </span>
                </div>

                <div class="user-dropdown" id="server-user-dropdown" role="menu" aria-hidden="true">
                    <button class="user-dropdown-item" type="button" data-menu-action="manage" role="menuitem">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/></svg>
                        Manage Account
                    </button>
                    <button class="user-dropdown-item" type="button" data-menu-action="darkmode" role="menuitem">
                        <span class="dark-mode-icon-wrapper" style="position:relative;display:inline-block;width:16px;height:16px;margin-right:8px;">
                            <svg class="icon-sun" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="position:absolute;top:0;left:0;"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                            <svg class="icon-moon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="position:absolute;top:0;left:0;"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                        </span>
                        <span id="dark-mode-text">Modo Boda</span>
                    </button>
                    <?php if (!$isPaid): ?>
                    <button class="user-dropdown-item" type="button" data-menu-action="upgrade" role="menuitem">
                        <svg xmlns="http://www.w3.org/2000/svg" style="color:#ffde00;" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z"/><path d="M5 21h14"/></svg>
                        Upgrade
                    </button>
                    <?php endif; ?>
                    <button class="user-dropdown-item user-dropdown-item-danger" type="button" data-menu-action="logout" role="menuitem">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/></svg>
                        Logout
                    </button>
                </div>
                <?php if ($isPaid): ?>
                <span class="pro-badge">PRO</span>
                <?php endif; ?>
            </div>
        </div>
        <?php endif; ?>
    </div>
</div>

<!-- ================================================================
     MAIN LAYOUT
================================================================ -->
<div class="rsvp-layout">
    <div class="rsvp-main">

        <!-- Global error -->
        <div id="rsvp-global-error" style="display:none;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px 20px;color:#c0392b;font-size:14px;margin-bottom:16px;"></div>

        <!-- Loading state -->
        <div id="rsvp-loading" class="rsvp-loading">
            <div class="rsvp-spinner"></div>
            <span>Loading responses…</span>
        </div>

        <!-- Main content (shown after load) -->
        <div id="rsvp-content" style="display:none;">

            <!-- Stats row -->
            <div class="rsvp-stats">
                <div class="rsvp-stat-card">
                    <span id="stat-total" class="rsvp-stat-value">—</span>
                    <span class="rsvp-stat-label">Responses</span>
                </div>
                <div class="rsvp-stat-card">
                    <span id="stat-attending" class="rsvp-stat-value">—</span>
                    <span class="rsvp-stat-label">Attending</span>
                </div>
                <div class="rsvp-stat-card">
                    <span id="stat-declining" class="rsvp-stat-value">—</span>
                    <span class="rsvp-stat-label">Declining</span>
                </div>
                <div class="rsvp-stat-card">
                    <span id="stat-guests" class="rsvp-stat-value">—</span>
                    <span class="rsvp-stat-label">Total guests</span>
                </div>
            </div>

            <!-- Toolbar -->
            <div class="rsvp-toolbar">
                <div class="rsvp-search-wrap">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input id="rsvp-search" type="text" class="rsvp-search" placeholder="Search responses…" autocomplete="off">
                </div>
                <!-- Group filter pills — rendered by rsvp.js -->
                <div id="rsvp-group-filter" class="rsvp-group-filter-wrap" style="display:none;"></div>
                <span id="rsvp-count-label" class="rsvp-count-label"></span>
            </div>

            <!-- Table -->
            <div id="rsvp-table-wrap" class="rsvp-table-wrap">
                <!-- Populated by rsvp.js -->
            </div>

        </div><!-- /#rsvp-content -->
    </div>
</div>

<!-- ================================================================
     MODAL: Toggle form open/close
================================================================ -->
<div id="modal-toggle-form" class="rsvp-modal-overlay" role="dialog" aria-modal="true">
    <div class="rsvp-modal">
        <h2 class="rsvp-modal-title">RSVP Form Status</h2>
        <p id="toggle-form-status-text" class="rsvp-modal-subtitle"></p>

        <label for="form-closed-message-input">Message shown when form is closed</label>
        <textarea id="form-closed-message-input" rows="3" placeholder="We are no longer accepting RSVPs. Thank you!"></textarea>

        <div class="rsvp-modal-actions">
            <button class="rsvp-btn" data-modal-close type="button">Cancel</button>
            <button id="toggle-form-confirm-btn" class="rsvp-btn rsvp-btn-danger" type="button">Close the form</button>
        </div>
    </div>
</div>

<!-- ================================================================
     MODAL: Share access link
================================================================ -->
<div id="modal-share-link" class="rsvp-modal-overlay" role="dialog" aria-modal="true">
    <div class="rsvp-modal">
        <h2 class="rsvp-modal-title">Share dashboard access</h2>
        <p class="rsvp-modal-subtitle">Generate a private link so your partner can view RSVP responses without needing an account.</p>

        <label for="share-email-input">Recipient email (optional, for reference)</label>
        <input type="email" id="share-email-input" placeholder="partner@email.com">

        <div class="rsvp-modal-link-result" id="share-link-result"></div>

        <div class="rsvp-modal-actions">
            <button class="rsvp-btn" data-modal-close type="button">Close</button>
            <button id="share-link-copy-btn" class="rsvp-btn" style="display:none;" type="button">Copy link</button>
            <button id="share-link-generate-btn" class="rsvp-btn rsvp-btn-primary" type="button">Generate link</button>
        </div>
    </div>
</div>

<!-- ================================================================
     MODAL: Manage guest groups
================================================================ -->
<div id="modal-manage-groups" class="rsvp-modal-overlay" role="dialog" aria-modal="true">
    <div class="rsvp-modal rsvp-modal-wide">
        <h2 class="rsvp-modal-title">Guest Groups</h2>
        <p class="rsvp-modal-subtitle">Create custom labels to organize your guests (e.g. "Bride's Family", "University Friends", "Work").</p>

        <!-- Existing groups list -->
        <div id="groups-list" class="rsvp-groups-list">
            <!-- Populated by rsvp.js -->
        </div>

        <!-- Add new group form -->
        <div class="rsvp-groups-add-form">
            <label for="new-group-name">New group name</label>
            <div class="rsvp-groups-add-row">
                <input type="text" id="new-group-name" placeholder="e.g. Bride's Family" maxlength="100" autocomplete="off">
                <button id="add-group-btn" class="rsvp-btn rsvp-btn-primary" type="button">Add group</button>
            </div>
            <!-- Color swatches -->
            <div class="rsvp-color-swatches" id="group-color-swatches"></div>
        </div>

        <div class="rsvp-modal-actions">
            <button class="rsvp-btn" data-modal-close type="button">Close</button>
        </div>
    </div>
</div>

<!-- Toast notification -->
<div id="rsvp-toast" class="rsvp-toast" role="status" aria-live="polite"></div>

<!-- ================================================================
     Scripts
================================================================ -->
<!-- Logout handler (reuse from app.php) -->
<script src="<?= editor_asset('public/js/logout-handler.js') ?>"></script>

<!-- RSVP Dashboard logic -->
<script src="<?= editor_asset('public/js/rsvp.js') ?>"></script>

<?php if ($isAuthenticated): ?>
<!-- Clerk JS for user management -->
<script>
    var PUBLISHABLE_KEY = <?= json_encode(getenv('CLERK_PUBLISHABLE_KEY') ?: '') ?>;
    if (PUBLISHABLE_KEY) {
        var s = document.createElement('script');
        s.async = true;
        s.crossOrigin = 'anonymous';
        s.src = 'https://cdn.jsdelivr.net/npm/@clerk/clerk-js@latest/dist/clerk.browser.js';
        s.setAttribute('data-clerk-publishable-key', PUBLISHABLE_KEY);
        s.onload = function () {
            if (window.Clerk) window.Clerk.load();
        };
        document.head.appendChild(s);
    }
</script>
<?php endif; ?>

</body>
</html>
