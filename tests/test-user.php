<?php
/**
 * Test User Login Simulation
 * Simulates a login with atrigol@gmail.com and checks their paid status
 */

// Enable error reporting for testing
error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "<h1>User Login Test - atrigol@gmail.com</h1>\n";

try {
    // Include database configuration
    require_once 'config/database.php';
    
    // Simulate user data from Clerk
    $userEmail = 'atrigol@gmail.com';
    $userName = 'Alvaro Trigol';
    $clerkUserId = 'user_test_123';
    
    echo "<h2>1. Simulating Clerk Login</h2>\n";
    echo "<p><strong>Email:</strong> $userEmail</p>\n";
    echo "<p><strong>Name:</strong> $userName</p>\n";
    echo "<p><strong>Clerk User ID:</strong> $clerkUserId</p>\n";
    
    // Test database connection
    echo "<h2>2. Testing Database Connection</h2>\n";
    $pdo = getDatabaseConnection();
    echo "<p style='color: green;'>✓ Database connection successful!</p>\n";
    
    // Check if purchases table exists
    $stmt = $pdo->query("SHOW TABLES LIKE 'purchases'");
    if ($stmt->rowCount() == 0) {
        echo "<p style='color: red;'>✗ Purchases table not found!</p>\n";
        echo "<p>Please create the purchases table first.</p>\n";
        exit;
    }
    echo "<p style='color: green;'>✓ Purchases table exists!</p>\n";
    
    // Check for any purchases for this email
    echo "<h2>3. Checking All Purchases for $userEmail</h2>\n";
    $stmt = $pdo->prepare("SELECT * FROM purchases WHERE email = ? ORDER BY created DESC");
    $stmt->execute([$userEmail]);
    $allPurchases = $stmt->fetchAll();
    
    if (count($allPurchases) == 0) {
        echo "<p style='color: orange;'>⚠ No purchases found for this email</p>\n";
        echo "<p><strong>Result:</strong> This would be a <span style='color: red; font-weight: bold;'>FREE USER</span></p>\n";
    } else {
        echo "<p style='color: green;'>✓ Found " . count($allPurchases) . " purchase(s) for this email</p>\n";
        
        echo "<h3>All Purchases:</h3>\n";
        echo "<table border='1' style='border-collapse: collapse; width: 100%;'>\n";
        echo "<tr><th>ID</th><th>Product</th><th>Created</th><th>Price</th><th>License Key</th></tr>\n";
        
        foreach ($allPurchases as $purchase) {
            echo "<tr>";
            echo "<td>" . htmlspecialchars($purchase['id']) . "</td>";
            echo "<td>" . htmlspecialchars($purchase['product']) . "</td>";
            echo "<td>" . htmlspecialchars($purchase['created']) . "</td>";
            echo "<td>" . htmlspecialchars($purchase['price']) . "</td>";
            echo "<td>" . htmlspecialchars($purchase['license_key'] ?? 'N/A') . "</td>";
            echo "</tr>\n";
        }
        echo "</table>\n";
    }
    
    // Now test the actual paid status check function
    echo "<h2>4. Testing Paid Status Check Function</h2>\n";
    $paidStatus = checkUserPaidStatus($userEmail);
    
    echo "<h3>Paid Status Result:</h3>\n";
    echo "<pre>" . json_encode($paidStatus, JSON_PRETTY_PRINT) . "</pre>\n";
    
    // Determine user type
    echo "<h2>5. Final User Classification</h2>\n";
    
    if ($paidStatus['status'] === 'paid') {
        echo "<div style='background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px;'>\n";
        echo "<h3 style='color: #155724; margin: 0;'>🎉 PAID USER</h3>\n";
        echo "<p style='color: #155724; margin: 10px 0 0 0;'>\n";
        echo "<strong>Product:</strong> " . htmlspecialchars($paidStatus['product']) . "<br>\n";
        echo "<strong>Purchase Date:</strong> " . htmlspecialchars($paidStatus['purchase_date']) . "<br>\n";
        echo "<strong>Lifetime:</strong> " . ($paidStatus['is_lifetime'] ? 'Yes' : 'No') . "<br>\n";
        if (!$paidStatus['is_lifetime'] && isset($paidStatus['expires_in'])) {
            echo "<strong>Expires in:</strong> " . htmlspecialchars($paidStatus['expires_in']) . "\n";
        }
        echo "</p>\n";
        echo "</div>\n";
    } elseif ($paidStatus['status'] === 'free') {
        echo "<div style='background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px;'>\n";
        echo "<h3 style='color: #856404; margin: 0;'>🔒 AUTHENTICATED USER (No Valid Purchases)</h3>\n";
        echo "<p style='color: #856404; margin: 10px 0 0 0;'>\n";
        echo "User is logged in but doesn't have any valid paid subscriptions.\n";
        echo "</p>\n";
        echo "</div>\n";
    } else {
        echo "<div style='background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 5px;'>\n";
        echo "<h3 style='color: #721c24; margin: 0;'>❌ ERROR</h3>\n";
        echo "<p style='color: #721c24; margin: 10px 0 0 0;'>\n";
        echo "Error checking paid status: " . htmlspecialchars($paidStatus['message']) . "\n";
        echo "</p>\n";
        echo "</div>\n";
    }
    
    // Test the authentication handler simulation
    echo "<h2>6. Simulating Full Authentication Process</h2>\n";
    
    // Simulate the auth-handler.php process
    $authData = [
        'email' => $userEmail,
        'name' => $userName,
        'clerk_user_id' => $clerkUserId
    ];
    
    // Check paid status
    $paidStatus = checkUserPaidStatus($userEmail);
    
    // Simulate session initialization
    echo "<h3>Authentication Result:</h3>\n";
    echo "<div style='background: #e2e3e5; border: 1px solid #d6d8db; padding: 15px; border-radius: 5px;'>\n";
    echo "<p><strong>Email:</strong> " . htmlspecialchars($authData['email']) . "</p>\n";
    echo "<p><strong>Name:</strong> " . htmlspecialchars($authData['name']) . "</p>\n";
    echo "<p><strong>Is Authenticated:</strong> true</p>\n";
    echo "<p><strong>Is Paid:</strong> " . ($paidStatus['is_paid'] ? 'true' : 'false') . "</p>\n";
    echo "<p><strong>Editor Mode:</strong> " . ($paidStatus['is_paid'] ? 'paid' : 'authenticated') . "</p>\n";
    echo "</div>\n";
    
    echo "<h2>7. Summary</h2>\n";
    echo "<p>For user <strong>$userEmail</strong>:</p>\n";
    echo "<ul>\n";
    echo "<li>Login method: Clerk (Gmail/GitHub/Magic Link)</li>\n";
    echo "<li>Database check: " . ($paidStatus['status'] === 'paid' ? 'Valid purchases found' : 'No valid purchases') . "</li>\n";
    echo "<li>Final classification: <strong>" . ($paidStatus['is_paid'] ? 'PAID USER' : 'AUTHENTICATED USER') . "</strong></li>\n";
    echo "</ul>\n";
    
} catch (Exception $e) {
    echo "<h2>Error</h2>\n";
    echo "<p style='color: red;'>✗ " . htmlspecialchars($e->getMessage()) . "</p>\n";
    
    echo "<h3>Possible Issues:</h3>\n";
    echo "<ul>\n";
    echo "<li>Database not configured - check config/database.php</li>\n";
    echo "<li>Database server not running</li>\n";
    echo "<li>Purchases table doesn't exist</li>\n";
    echo "<li>Database credentials incorrect</li>\n";
    echo "</ul>\n";
}

echo "<hr>\n";
echo "<p><small>Test completed at: " . date('Y-m-d H:i:s') . "</small></p>\n";
?> 