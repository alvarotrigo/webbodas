<?php
require_once 'config/database.php';

$emails = [
    'ctaulborg@gmail.com',
    'dev@walkwest.com',
    'greg@mainelinesigns.com',
    'sales2@ecowitt.com'
];

foreach ($emails as $email) {
    try {
        $paidStatus = checkUserPaidStatus($email);
        $result = $paidStatus['is_paid'] ? 'Paid user' : 'Free user';
        echo "$email: $result\n";
    } catch (Exception $e) {
        echo "$email: Error - " . $e->getMessage() . "\n";
    }
}
?>