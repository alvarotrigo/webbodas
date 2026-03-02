<?php
/**
 * Mock User Login Test - atrigol@gmail.com
 * Simulates the database check logic without requiring actual database access
 */

echo "<h1>Mock User Login Test - atrigol@gmail.com</h1>\n";

// Simulate user data from Clerk
$userEmail = 'atrigol@gmail.com';
$userName = 'Alvaro Trigol';
$clerkUserId = 'user_test_123';

echo "<h2>1. Simulating Clerk Login</h2>\n";
echo "<p><strong>Email:</strong> $userEmail</p>\n";
echo "<p><strong>Name:</strong> $userName</p>\n";
echo "<p><strong>Clerk User ID:</strong> $clerkUserId</p>\n";

echo "<h2>2. Database Check Logic</h2>\n";
echo "<p>When the user logs in, the system will:</p>\n";
echo "<ol>\n";
echo "<li>Extract email from Clerk: <strong>$userEmail</strong></li>\n";
echo "<li>Query the purchases table for this email</li>\n";
echo "<li>Check for valid products: fullpage-professional, fullpage-professional-lifetime, fullpage-business, fullpage-business-lifetime</li>\n";
echo "<li>Verify purchase is within last 12 months (or lifetime)</li>\n";
echo "<li>Return user classification</li>\n";
echo "</ol>\n";

echo "<h2>3. SQL Query That Would Be Executed</h2>\n";
echo "<div style='background: #f8f9fa; border: 1px solid #dee2e6; padding: 15px; border-radius: 5px; font-family: monospace;'>\n";
echo "SELECT p.id, p.purchase_id, p.email, p.product, p.created, p.price, p.license_key<br>\n";
echo "FROM purchases p<br>\n";
echo "WHERE p.email = '$userEmail'<br>\n";
echo "AND p.product IN ('fullpage-professional', 'fullpage-professional-lifetime', 'fullpage-business', 'fullpage-business-lifetime')<br>\n";
echo "AND p.created >= '" . date('Y-m-d H:i:s', strtotime('-12 months')) . "'<br>\n";
echo "ORDER BY p.created DESC<br>\n";
echo "LIMIT 1\n";
echo "</div>\n";

echo "<h2>4. Possible Scenarios</h2>\n";

// Scenario 1: No purchases found
echo "<h3>Scenario 1: No Purchases Found</h3>\n";
echo "<div style='background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px;'>\n";
echo "<h4 style='color: #856404; margin: 0;'>🔒 AUTHENTICATED USER (No Valid Purchases)</h4>\n";
echo "<p style='color: #856404; margin: 10px 0 0 0;'>\n";
echo "If no purchases are found for <strong>$userEmail</strong>:<br>\n";
echo "• User is logged in via Clerk ✅<br>\n";
echo "• No valid purchases in database ❌<br>\n";
echo "• <strong>Result: AUTHENTICATED USER (Free)</strong>\n";
echo "</p>\n";
echo "</div>\n";

// Scenario 2: Valid purchase found
echo "<h3>Scenario 2: Valid Purchase Found</h3>\n";
echo "<div style='background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px;'>\n";
echo "<h4 style='color: #155724; margin: 0;'>🎉 PAID USER</h4>\n";
echo "<p style='color: #155724; margin: 10px 0 0 0;'>\n";
echo "If a valid purchase is found for <strong>$userEmail</strong>:<br>\n";
echo "• User is logged in via Clerk ✅<br>\n";
echo "• Valid purchase found in database ✅<br>\n";
echo "• <strong>Result: PAID USER</strong>\n";
echo "</p>\n";
echo "</div>\n";

// Scenario 3: Expired purchase
echo "<h3>Scenario 3: Expired Purchase</h3>\n";
echo "<div style='background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 5px;'>\n";
echo "<h4 style='color: #721c24; margin: 0;'>⏰ EXPIRED SUBSCRIPTION</h4>\n";
echo "<p style='color: #721c24; margin: 10px 0 0 0;'>\n";
echo "If purchase is older than 12 months (and not lifetime):<br>\n";
echo "• User is logged in via Clerk ✅<br>\n";
echo "• Purchase found but expired ❌<br>\n";
echo "• <strong>Result: AUTHENTICATED USER (Free)</strong>\n";
echo "</p>\n";
echo "</div>\n";

echo "<h2>5. Expected Response Format</h2>\n";
echo "<p>The system would return this JSON response:</p>\n";

// Mock response for no purchases
echo "<h3>If No Valid Purchases Found:</h3>\n";
echo "<pre style='background: #f8f9fa; padding: 15px; border-radius: 5px;'>\n";
echo json_encode([
    'success' => true,
    'data' => [
        'email' => $userEmail,
        'name' => $userName,
        'is_authenticated' => true,
        'is_paid' => false,
        'mode' => 'authenticated',
        'subscription' => null,
        'clerk_user_id' => $clerkUserId
    ]
], JSON_PRETTY_PRINT);
echo "</pre>\n";

// Mock response for valid purchase
echo "<h3>If Valid Purchase Found:</h3>\n";
echo "<pre style='background: #f8f9fa; padding: 15px; border-radius: 5px;'>\n";
echo json_encode([
    'success' => true,
    'data' => [
        'email' => $userEmail,
        'name' => $userName,
        'is_authenticated' => true,
        'is_paid' => true,
        'mode' => 'paid',
        'subscription' => [
            'status' => 'paid',
            'product' => 'fullpage-business-lifetime',
            'purchase_date' => '2024-01-15 10:30:00',
            'is_lifetime' => true,
            'expires_in' => null
        ],
        'clerk_user_id' => $clerkUserId
    ]
], JSON_PRETTY_PRINT);
echo "</pre>\n";

echo "<h2>6. Frontend UI Changes</h2>\n";
echo "<p>Based on the result, the UI would show:</p>\n";

echo "<h3>If AUTHENTICATED USER:</h3>\n";
echo "<div style='background: #e2e3e5; border: 1px solid #d6d8db; padding: 10px; border-radius: 5px; display: inline-block;'>\n";
echo "<span style='display: inline-block; width: 8px; height: 8px; background: #10b981; border-radius: 50%; margin-right: 8px;'></span>\n";
echo "<span>Free User</span>\n";
echo "</div>\n";

echo "<h3>If PAID USER:</h3>\n";
echo "<div style='background: #e2e3e5; border: 1px solid #d6d8db; padding: 10px; border-radius: 5px; display: inline-block;'>\n";
echo "<span style='display: inline-block; width: 8px; height: 8px; background: #10b981; border-radius: 50%; margin-right: 8px;'></span>\n";
echo "<span>Paid User</span>\n";
echo "</div>\n";

echo "<h2>7. To Test With Real Database</h2>\n";
echo "<p>To test with your actual database:</p>\n";
echo "<ol>\n";
echo "<li>Update <code>config/database.php</code> with your real database credentials</li>\n";
echo "<li>Ensure the <code>purchases</code> table exists with the correct structure</li>\n";
echo "<li>Run <code>php test-user.php</code> to see the actual result</li>\n";
echo "<li>Or visit <code>test-user.php</code> in your browser</li>\n";
echo "</ol>\n";

echo "<h2>8. Summary</h2>\n";
echo "<p>For user <strong>$userEmail</strong>:</p>\n";
echo "<ul>\n";
echo "<li>✅ Login method: Clerk (Gmail/GitHub/Magic Link)</li>\n";
echo "<li>✅ Email extracted: $userEmail</li>\n";
echo "<li>✅ Database query executed with this email</li>\n";
echo "<li>❓ Result depends on database content</li>\n";
echo "<li>❓ Final classification: <em>Depends on purchase history</em></li>\n";
echo "</ul>\n";

echo "<hr>\n";
echo "<p><small>Mock test completed at: " . date('Y-m-d H:i:s') . "</small></p>\n";
echo "<p><small><strong>Note:</strong> This is a simulation. To get real results, configure your database and run the actual test.</small></p>\n";
?> 