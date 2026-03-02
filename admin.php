<?php
/**
 * Admin Panel
 * Dashboard for monitoring user signups, paid conversions, activity, and browsing user pages
 * Access restricted to admin email via Clerk auth + ADMIN_EMAIL env var
 */

// Start session early
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

require_once __DIR__ . '/includes/clerk-auth.php';
require_once __DIR__ . '/config/database.php';

/**
 * Asset helper function for cache busting
 */
function admin_asset(string $path): string
{
    if (preg_match('#^(https?:)?//#', $path)) {
        return $path;
    }

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

// SEO blocking - prevent indexing
header('X-Robots-Tag: noindex, nofollow');

// Handle Clerk handshake request
clerk_handle_handshake();

// Synchronise the PHP session with Clerk
$serverUserData = syncClerkSession();
if (!$serverUserData && isUserAuthenticated()) {
    $serverUserData = clerk_session_user_payload();
}

$isAuthenticated = $serverUserData['authenticated'] ?? false;
$userEmail       = $serverUserData['email'] ?? null;

// Check if user is admin
$adminEmail = getenv('ADMIN_EMAIL') ?: '';
$isAdmin = $isAuthenticated && $userEmail && ($userEmail === $adminEmail);

// Debug logging (remove after testing)
error_log("Admin access attempt:");
error_log("  - Is authenticated: " . ($isAuthenticated ? 'yes' : 'no'));
error_log("  - User email: " . ($userEmail ?: 'null'));
error_log("  - Admin email from .env: " . ($adminEmail ?: 'null'));
error_log("  - Emails match: " . ($userEmail === $adminEmail ? 'yes' : 'no'));
error_log("  - Is admin: " . ($isAdmin ? 'yes' : 'no'));

// Redirect to 403 if not admin (no hint that admin panel exists)
if (!$isAdmin) {
    http_response_code(403);
    header('Content-Type: text/plain');
    echo '403 Forbidden';
    exit;
}

// Get PDO connection for aggregate queries
$pdo = getDatabaseConnection();

// ===================================
// DASHBOARD KPI QUERIES
// ===================================

// Total users
$stmt = $pdo->query("SELECT COUNT(*) as count FROM users");
$totalUsers = (int) $stmt->fetch()['count'];

// Paid users
$stmt = $pdo->query("SELECT COUNT(*) as count FROM users WHERE is_pro = 1");
$paidUsers = (int) $stmt->fetch()['count'];

// Conversion rate
$conversionRate = $totalUsers > 0 ? round(($paidUsers / $totalUsers) * 100, 1) : 0;

// Total pages
$stmt = $pdo->query("SELECT COUNT(*) as count FROM user_pages");
$totalPages = (int) $stmt->fetch()['count'];

// Avg pages/user
$avgPagesPerUser = $totalUsers > 0 ? round($totalPages / $totalUsers, 1) : 0;

// Active users (7 days)
$stmt = $pdo->query("SELECT COUNT(*) as count FROM users WHERE last_login >= NOW() - INTERVAL 7 DAY");
$activeUsers7d = (int) $stmt->fetch()['count'];

// Active users (30 days)
$stmt = $pdo->query("SELECT COUNT(*) as count FROM users WHERE last_login >= NOW() - INTERVAL 30 DAY");
$activeUsers30d = (int) $stmt->fetch()['count'];

// ===================================
// CHART DATA QUERIES
// ===================================

// New users per day (last 30 days)
$stmt = $pdo->query("
    SELECT DATE(created_at) as date, COUNT(*) as count
    FROM users
    WHERE created_at >= CURDATE() - INTERVAL 30 DAY
    GROUP BY DATE(created_at)
    ORDER BY date ASC
");
$newUsersData = $stmt->fetchAll();

// Fill missing days with zero counts
$newUsersChartData = [];
$dateMap = [];
foreach ($newUsersData as $row) {
    $dateMap[$row['date']] = (int) $row['count'];
}

for ($i = 29; $i >= 0; $i--) {
    $date = date('Y-m-d', strtotime("-$i days"));
    $newUsersChartData[] = [
        'date' => $date,
        'count' => $dateMap[$date] ?? 0
    ];
}

// Pages created per day (last 30 days)
$stmt = $pdo->query("
    SELECT DATE(created_at) as date, COUNT(*) as count
    FROM user_pages
    WHERE created_at >= CURDATE() - INTERVAL 30 DAY
    GROUP BY DATE(created_at)
    ORDER BY date ASC
");
$pagesData = $stmt->fetchAll();

$pagesChartData = [];
$pagesDateMap = [];
foreach ($pagesData as $row) {
    $pagesDateMap[$row['date']] = (int) $row['count'];
}

for ($i = 29; $i >= 0; $i--) {
    $date = date('Y-m-d', strtotime("-$i days"));
    $pagesChartData[] = [
        'date' => $date,
        'count' => $pagesDateMap[$date] ?? 0
    ];
}

// Active users trend (last 30 days)
$stmt = $pdo->query("
    SELECT DATE(last_login) as date, COUNT(*) as count
    FROM users
    WHERE last_login >= CURDATE() - INTERVAL 30 DAY
    GROUP BY DATE(last_login)
    ORDER BY date ASC
");
$activeUsersData = $stmt->fetchAll();

$activeUsersChartData = [];
$activeDateMap = [];
foreach ($activeUsersData as $row) {
    $activeDateMap[$row['date']] = (int) $row['count'];
}

for ($i = 29; $i >= 0; $i--) {
    $date = date('Y-m-d', strtotime("-$i days"));
    $activeUsersChartData[] = [
        'date' => $date,
        'count' => $activeDateMap[$date] ?? 0
    ];
}

// Recent signups (last 10)
$stmt = $pdo->query("
    SELECT id, email, name, is_pro, created_at
    FROM users
    ORDER BY created_at DESC
    LIMIT 10
");
$recentSignups = $stmt->fetchAll();

// User data for display
$userName = $serverUserData['name'] ?? $userEmail;
$avatarUrl = $serverUserData['avatar_url'] ?? null;
$avatarInitial = $userName ? strtoupper(substr($userName, 0, 1)) : 'A';

?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex, nofollow">
    <title>Admin Panel - fullPage Studio</title>

    <!-- Tailwind CSS -->
    <link href="./dist/output.css" rel="stylesheet">

    <!-- Admin CSS -->
    <link rel="stylesheet" href="<?= admin_asset('./public/css/admin.css') ?>">

    <!-- ApexCharts -->
    <script src="https://cdn.jsdelivr.net/npm/apexcharts"></script>

    <!-- Clerk Configuration -->
    <script src="./clerk-config.js"></script>

    <!-- Clerk Script -->
    <script
        async
        crossorigin="anonymous"
        data-clerk-publishable-key="pk_test_d2VsY29tZWQtZXNjYXJnb3QtMjIuY2xlcmsuYWNjb3VudHMuZGV2JA"
        src="https://welcomed-escargot-22.clerk.accounts.dev/npm/@clerk/clerk-js@5/dist/clerk.browser.js"
        type="text/javascript">
    </script>
</head>
<body class="bg-gray-50">
    <!-- Header -->
    <div class="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between items-center h-16">
                <div>
                    <h1 class="text-xl font-semibold text-gray-900">Admin Panel</h1>
                </div>
                <div class="flex items-center gap-3">
                    <?php if ($avatarUrl): ?>
                        <img src="<?= htmlspecialchars($avatarUrl) ?>" alt="Avatar" class="w-8 h-8 rounded-full">
                    <?php else: ?>
                        <div class="w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-medium">
                            <?= htmlspecialchars($avatarInitial) ?>
                        </div>
                    <?php endif; ?>
                    <span class="text-sm text-gray-700"><?= htmlspecialchars($userName) ?></span>
                </div>
            </div>
        </div>
    </div>

    <!-- Tabs -->
    <div class="bg-white border-b border-gray-200">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex gap-2 py-4">
                <button id="tab-dashboard" class="admin-tab active" onclick="AdminPanel.switchTab('dashboard')">
                    Dashboard
                </button>
                <button id="tab-users" class="admin-tab" onclick="AdminPanel.switchTab('users')">
                    Users
                </button>
            </div>
        </div>
    </div>

    <!-- Dashboard Tab -->
    <div id="content-dashboard" class="admin-tab-content active">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <!-- KPI Cards -->
            <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
                <!-- Total Users -->
                <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
                    <div class="text-sm text-gray-500 mb-1">Total Users</div>
                    <div class="text-3xl font-bold text-gray-900"><?= number_format($totalUsers) ?></div>
                </div>

                <!-- Paid Users -->
                <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 cursor-pointer hover:shadow-md hover:border-green-300 transition-all" onclick="AdminPanel.filterByProStatus('pro')">
                    <div class="text-sm text-gray-500 mb-1">Paid Users</div>
                    <div class="text-3xl font-bold text-green-600"><?= number_format($paidUsers) ?></div>
                    <div class="text-xs text-gray-400 mt-1"><?= $conversionRate ?>% conversion</div>
                </div>

                <!-- Total Pages -->
                <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all" onclick="AdminPanel.showPagesDetail()">
                    <div class="text-sm text-gray-500 mb-1">Total Pages</div>
                    <div class="text-3xl font-bold text-blue-600"><?= number_format($totalPages) ?></div>
                    <div class="text-xs text-gray-400 mt-1"><?= $avgPagesPerUser ?> avg/user</div>
                </div>

                <!-- Active 7d -->
                <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 cursor-pointer hover:shadow-md hover:border-purple-300 transition-all" onclick="AdminPanel.showActive7dDetail()">
                    <div class="text-sm text-gray-500 mb-1">Active (7d)</div>
                    <div class="text-3xl font-bold text-purple-600"><?= number_format($activeUsers7d) ?></div>
                </div>

                <!-- Active 30d -->
                <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 cursor-pointer hover:shadow-md hover:border-indigo-300 transition-all" onclick="AdminPanel.showActive30dDetail()">
                    <div class="text-sm text-gray-500 mb-1">Active (30d)</div>
                    <div class="text-3xl font-bold text-indigo-600"><?= number_format($activeUsers30d) ?></div>
                </div>
            </div>

            <!-- Charts Grid -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <!-- New Users Chart -->
                <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h2 class="text-lg font-semibold text-gray-900 mb-4">New Users (Last 30 Days)</h2>
                    <div id="chart-new-users"></div>
                </div>

                <!-- Pages Created Chart -->
                <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h2 class="text-lg font-semibold text-gray-900 mb-4">Pages Created (Last 30 Days)</h2>
                    <div id="chart-pages-created"></div>
                </div>

                <!-- User Status Breakdown -->
                <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h2 class="text-lg font-semibold text-gray-900 mb-4">User Status Breakdown</h2>
                    <div id="chart-user-breakdown"></div>
                </div>

                <!-- Active Users Trend -->
                <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h2 class="text-lg font-semibold text-gray-900 mb-4">Daily Active Users (Last 30 Days)</h2>
                    <div id="chart-active-users"></div>
                </div>
            </div>

            <!-- Chart Data for JavaScript -->
            <script>
                window.adminChartData = {
                    newUsers: <?= json_encode($newUsersChartData) ?>,
                    pagesCreated: <?= json_encode($pagesChartData) ?>,
                    activeUsers: <?= json_encode($activeUsersChartData) ?>,
                    userBreakdown: {
                        free: <?= $totalUsers - $paidUsers ?>,
                        paid: <?= $paidUsers ?>
                    }
                };
            </script>

            <!-- Recent Signups -->
            <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div class="px-6 py-4 border-b border-gray-200">
                    <h2 class="text-lg font-semibold text-gray-900">Recent Signups</h2>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full">
                        <thead class="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            <?php foreach ($recentSignups as $signup): ?>
                                <tr class="hover:bg-gray-50 cursor-pointer" onclick="AdminPanel.openUserDetail(<?= $signup['id'] ?>)">
                                    <td class="px-6 py-4 text-sm text-gray-900"><?= htmlspecialchars($signup['email']) ?></td>
                                    <td class="px-6 py-4 text-sm text-gray-900"><?= htmlspecialchars($signup['name'] ?: '—') ?></td>
                                    <td class="px-6 py-4 text-sm">
                                        <?php if ($signup['is_pro']): ?>
                                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Pro</span>
                                        <?php else: ?>
                                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Free</span>
                                        <?php endif; ?>
                                    </td>
                                    <td class="px-6 py-4 text-sm text-gray-500" data-timestamp="<?= strtotime($signup['created_at']) ?>">
                                        <?= date('M j, Y', strtotime($signup['created_at'])) ?>
                                    </td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>

    <!-- Users Tab -->
    <div id="content-users" class="admin-tab-content">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <!-- Search and Filters -->
            <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                <div class="flex flex-col sm:flex-row gap-4">
                    <div class="flex-1">
                        <input
                            type="text"
                            id="user-search"
                            placeholder="Search by email or name..."
                            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                    </div>
                    <div class="flex gap-2">
                        <button class="filter-pill active" data-filter="all" onclick="AdminPanel.setFilter('all')">All</button>
                        <button class="filter-pill" data-filter="free" onclick="AdminPanel.setFilter('free')">Free</button>
                        <button class="filter-pill" data-filter="pro" onclick="AdminPanel.setFilter('pro')">Pro</button>
                    </div>
                </div>
            </div>

            <!-- Users Table -->
            <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="w-full">
                        <thead class="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pages</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Login</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                            </tr>
                        </thead>
                        <tbody id="users-table-body" class="bg-white divide-y divide-gray-200">
                            <tr>
                                <td colspan="6" class="px-6 py-8 text-center text-sm text-gray-500">
                                    Loading users...
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- Pagination -->
                <div class="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                    <div class="text-sm text-gray-500">
                        <span id="pagination-info">—</span>
                    </div>
                    <div class="flex gap-2">
                        <button id="prev-page" class="px-3 py-1 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed" onclick="AdminPanel.prevPage()" disabled>
                            Previous
                        </button>
                        <button id="next-page" class="px-3 py-1 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed" onclick="AdminPanel.nextPage()" disabled>
                            Next
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- User Detail Modal -->
    <div id="user-detail-modal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 hidden">
        <div class="bg-white rounded-xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 class="text-xl font-semibold text-gray-900">User Details</h2>
                <button onclick="AdminPanel.closeUserDetail()" class="text-gray-400 hover:text-gray-600">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
            <div id="user-detail-content" class="flex-1 min-h-0 overflow-y-auto p-6">
                <div class="text-center text-gray-500 py-8">Loading...</div>
            </div>
        </div>
    </div>

    <!-- Shared Logout Handler -->
    <script src="<?= admin_asset('./public/js/logout-handler.js') ?>"></script>

    <!-- Admin JS -->
    <script src="<?= admin_asset('./public/js/admin.js') ?>"></script>
</body>
</html>
