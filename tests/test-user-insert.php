<?php
/**
 * Test script to manually test user insertion
 */

require_once __DIR__ . '/config/lemonsqueezy.php';

echo "=== Testing User Insertion ===\n\n";

// Test data
$clerkUserId = 'test_user_' . time();
$email = 'test@example.com';
$name = 'Test User';

echo "Test data:\n";
echo "  clerk_user_id: {$clerkUserId}\n";
echo "  email: {$email}\n";
echo "  name: {$name}\n\n";

try {
    echo "Calling createOrUpdateUser...\n";
    $result = createOrUpdateUser($clerkUserId, $email, $name, false, null, null);
    
    echo "✓ Success!\n";
    echo "Result: " . json_encode($result, JSON_PRETTY_PRINT) . "\n\n";
    
    // Verify it was created
    echo "Verifying user was created...\n";
    $supabase = getSupabaseClient();
    $users = $supabase->select(
        'users',
        '*',
        ['clerk_user_id' => $clerkUserId]
    );
    
    if (!empty($users)) {
        echo "✓ User found in database:\n";
        print_r($users[0]);
    } else {
        echo "✗ User NOT found in database!\n";
    }
    
} catch (Exception $e) {
    echo "✗ Error: " . $e->getMessage() . "\n";
    echo "Stack trace:\n" . $e->getTraceAsString() . "\n";
}
?>
