<?php
// Test zip creation functionality

// Create a temporary directory for the files
$tempDir = sys_get_temp_dir() . '/test-zip-' . uniqid();
mkdir($tempDir);

// Create subdirectories
mkdir($tempDir . '/dist');

// Create test files
file_put_contents($tempDir . '/index.html', '<!DOCTYPE html><html><head><title>Test</title></head><body><h1>Test</h1></body></html>');
file_put_contents($tempDir . '/dist/styles.css', 'body { color: red; }');

echo "Created test files in: $tempDir\n";

// Try using ditto command (Mac-specific) for better compatibility
$zipFile = $tempDir . '.zip';

// Check if we're on Mac and ditto is available
$isMac = (strpos(PHP_OS, 'Darwin') !== false);
$dittoAvailable = false;

if ($isMac) {
    exec('which ditto', $output, $returnCode);
    $dittoAvailable = ($returnCode === 0);
}

echo "isMac: " . ($isMac ? 'true' : 'false') . "\n";
echo "dittoAvailable: " . ($dittoAvailable ? 'true' : 'false') . "\n";

if ($isMac && $dittoAvailable) {
    // Use ditto to create a zip archive (Mac-specific)
    $dittoCommand = "ditto -c -k --sequesterRsrc --keepParent " . escapeshellarg($tempDir) . " " . escapeshellarg($zipFile);
    echo "Running command: $dittoCommand\n";
    exec($dittoCommand . " 2>&1", $output, $returnCode);
    
    echo "Return code: $returnCode\n";
    echo "Output: " . implode("\n", $output) . "\n";
    
    if ($returnCode === 0 && file_exists($zipFile)) {
        $fileSize = filesize($zipFile);
        echo "SUCCESS: Zip file created! Size: $fileSize bytes\n";
        
        // Clean up
        unlink($zipFile);
    } else {
        echo "FAILED: Could not create zip file\n";
    }
} else {
    echo "Not on Mac or ditto not available\n";
}

// Clean up temp directory
rmdir($tempDir . '/dist');
rmdir($tempDir);

echo "Test completed.\n";
?>


