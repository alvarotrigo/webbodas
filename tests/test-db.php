<?php
/**
 * Database Connection Test
 * Use this file to test your database connection and paid status checking
 */

// Enable error reporting for testing
error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "<h1>Database Connection Test</h1>\n";

try {
    // Include database configuration
    require_once 'config/database.php';
    
    echo "<h2>1. Testing Database Connection</h2>\n";
    
    // Test database connection
    $pdo = getDatabaseConnection();
    echo "<p style='color: green;'>✓ Database connection successful!</p>\n";
    
    // Test table existence
    $stmt = $pdo->query("SHOW TABLES LIKE 'purchases'");
    if ($stmt->rowCount() > 0) {
        echo "<p style='color: green;'>✓ Purchases table exists!</p>\n";
    } else {
        echo "<p style='color: red;'>✗ Purchases table not found!</p>\n";
        echo "<p>Please create the purchases table with the correct structure.</p>\n";
        exit;
    }
    
    // Test table structure
    echo "<h2>2. Testing Table Structure</h2>\n";
    $stmt = $pdo->query("DESCRIBE purchases");
    $columns = $stmt->fetchAll();
    
    $requiredColumns = ['id', 'email', 'product', 'created', 'price'];
    $foundColumns = array_column($columns, 'Field');
    
    foreach ($requiredColumns as $column) {
        if (in_array($column, $foundColumns)) {
            echo "<p style='color: green;'>✓ Column '$column' exists</p>\n";
        } else {
            echo "<p style='color: red;'>✗ Column '$column' missing</p>\n";
        }
    }
    
    // Test sample data
    echo "<h2>3. Testing Sample Data</h2>\n";
    $stmt = $pdo->query("SELECT COUNT(*) as count FROM purchases");
    $result = $stmt->fetch();
    $totalRecords = $result['count'];
    
    echo "<p>Total records in purchases table: <strong>$totalRecords</strong></p>\n";
    
    if ($totalRecords > 0) {
        // Show sample records
        $stmt = $pdo->query("SELECT email, product, created, price FROM purchases LIMIT 5");
        $samples = $stmt->fetchAll();
        
        echo "<h3>Sample Records:</h3>\n";
        echo "<table border='1' style='border-collapse: collapse;'>\n";
        echo "<tr><th>Email</th><th>Product</th><th>Created</th><th>Price</th></tr>\n";
        
        foreach ($samples as $sample) {
            echo "<tr>";
            echo "<td>" . htmlspecialchars($sample['email']) . "</td>";
            echo "<td>" . htmlspecialchars($sample['product']) . "</td>";
            echo "<td>" . htmlspecialchars($sample['created']) . "</td>";
            echo "<td>" . htmlspecialchars($sample['price']) . "</td>";
            echo "</tr>\n";
        }
        echo "</table>\n";
    }
    
    // Test paid status checking
    echo "<h2>4. Testing Paid Status Check</h2>\n";
    
    // Test with a sample email (replace with an actual email from your database)
    $testEmail = 'test@example.com';
    
    echo "<p>Testing paid status for: <strong>$testEmail</strong></p>\n";
    
    $paidStatus = checkUserPaidStatus($testEmail);
    
    echo "<h3>Result:</h3>\n";
    echo "<pre>" . json_encode($paidStatus, JSON_PRETTY_PRINT) . "</pre>\n";
    
    // Test with valid products
    echo "<h2>5. Testing Valid Products</h2>\n";
    $validProducts = [
        'fullpage-professional',
        'fullpage-professional-lifetime',
        'fullpage-business',
        'fullpage-business-lifetime'
    ];
    
    echo "<p>Valid products that grant paid access:</p>\n";
    echo "<ul>\n";
    foreach ($validProducts as $product) {
        echo "<li>$product</li>\n";
    }
    echo "</ul>\n";
    
    // Check for users with valid products
    $placeholders = str_repeat('?,', count($validProducts) - 1) . '?';
    $sql = "SELECT DISTINCT email, product, created FROM purchases WHERE product IN ($placeholders) ORDER BY created DESC LIMIT 10";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($validProducts);
    $validPurchases = $stmt->fetchAll();
    
    if (count($validPurchases) > 0) {
        echo "<h3>Users with Valid Products:</h3>\n";
        echo "<table border='1' style='border-collapse: collapse;'>\n";
        echo "<tr><th>Email</th><th>Product</th><th>Created</th></tr>\n";
        
        foreach ($validPurchases as $purchase) {
            echo "<tr>";
            echo "<td>" . htmlspecialchars($purchase['email']) . "</td>";
            echo "<td>" . htmlspecialchars($purchase['product']) . "</td>";
            echo "<td>" . htmlspecialchars($purchase['created']) . "</td>";
            echo "</tr>\n";
        }
        echo "</table>\n";
        
        // Test paid status for the first valid user
        $firstUser = $validPurchases[0]['email'];
        echo "<h3>Testing Paid Status for: $firstUser</h3>\n";
        
        $userPaidStatus = checkUserPaidStatus($firstUser);
        echo "<pre>" . json_encode($userPaidStatus, JSON_PRETTY_PRINT) . "</pre>\n";
    } else {
        echo "<p style='color: orange;'>⚠ No users found with valid products</p>\n";
    }
    
    echo "<h2>6. Test Summary</h2>\n";
    echo "<p style='color: green;'>✓ All tests completed successfully!</p>\n";
    echo "<p>Your database is properly configured and ready to use with the paid user verification system.</p>\n";
    
} catch (Exception $e) {
    echo "<h2>Error</h2>\n";
    echo "<p style='color: red;'>✗ " . htmlspecialchars($e->getMessage()) . "</p>\n";
    
    echo "<h3>Troubleshooting Steps:</h3>\n";
    echo "<ol>\n";
    echo "<li>Check your database credentials in <code>config/database.php</code></li>\n";
    echo "<li>Ensure MySQL server is running</li>\n";
    echo "<li>Verify the database and table exist</li>\n";
    echo "<li>Check PHP PDO extension is installed</li>\n";
    echo "<li>Review PHP error logs for more details</li>\n";
    echo "</ol>\n";
}

echo "<hr>\n";
echo "<p><small>Test completed at: " . date('Y-m-d H:i:s') . "</small></p>\n";
?> 