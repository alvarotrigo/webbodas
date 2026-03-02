<?php
/**
 * React Project Download Handler
 * Generates a complete React + Vite project from sections
 */

// Get POST data
$projectData = json_decode(file_get_contents('php://input'), true);

if (!$projectData || !isset($projectData['files'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid project data']);
    exit;
}

$files = $projectData['files'];
$projectName = $projectData['projectName'] ?? 'fpstudio-react-app';

/**
 * Recursively remove a directory and its contents
 */
function removeDirectory($dir) {
    if (!is_dir($dir)) {
        return;
    }
    
    $items = array_diff(scandir($dir), ['.', '..']);
    foreach ($items as $item) {
        $path = $dir . '/' . $item;
        is_dir($path) ? removeDirectory($path) : unlink($path);
    }
    rmdir($dir);
}

/**
 * Create directory recursively if it doesn't exist
 */
function ensureDirectory($path) {
    if (!is_dir($path)) {
        mkdir($path, 0755, true);
    }
}

try {
    // Create a temporary directory for the project
    $tempDir = sys_get_temp_dir() . '/' . $projectName . '-' . uniqid();
    ensureDirectory($tempDir);
    
    // Write all files to the temporary directory
    foreach ($files as $relativePath => $content) {
        $fullPath = $tempDir . '/' . $relativePath;
        
        // Ensure parent directory exists
        $dirPath = dirname($fullPath);
        ensureDirectory($dirPath);
        
        // Write the file
        file_put_contents($fullPath, $content);
    }
    
    // Create the zip file
    $zipFile = sys_get_temp_dir() . '/' . $projectName . '-' . uniqid() . '.zip';
    
    // Check if we're on Mac and ditto is available
    $isMac = (strpos(PHP_OS, 'Darwin') !== false);
    $dittoAvailable = false;
    
    if ($isMac) {
        exec('which ditto', $output, $returnCode);
        $dittoAvailable = ($returnCode === 0);
    }
    
    if ($isMac && $dittoAvailable) {
        // Use ditto to create a zip archive (Mac-specific, preserves metadata)
        $dittoCommand = "ditto -c -k --sequesterRsrc --keepParent " . escapeshellarg($tempDir) . " " . escapeshellarg($zipFile);
        exec($dittoCommand . " 2>&1", $output, $returnCode);
        
        if ($returnCode !== 0 || !file_exists($zipFile)) {
            throw new Exception("Failed to create zip file with ditto");
        }
    } else {
        // Fallback to PHP's ZipArchive
        $zip = new ZipArchive();
        if ($zip->open($zipFile, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            throw new Exception("Failed to create zip file");
        }
        
        // Add all files to the zip
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($tempDir, RecursiveDirectoryIterator::SKIP_DOTS),
            RecursiveIteratorIterator::SELF_FIRST
        );
        
        foreach ($iterator as $file) {
            $filePath = $file->getRealPath();
            $relativePath = $projectName . '/' . substr($filePath, strlen($tempDir) + 1);
            
            if ($file->isDir()) {
                $zip->addEmptyDir($relativePath);
            } else {
                $zip->addFile($filePath, $relativePath);
            }
        }
        
        $zip->close();
    }
    
    // Check if zip file was created successfully
    if (!file_exists($zipFile)) {
        throw new Exception("Zip file was not created");
    }
    
    $fileSize = filesize($zipFile);
    
    // Set proper headers for zip download
    header('Content-Type: application/zip');
    header('Content-Disposition: attachment; filename="' . $projectName . '.zip"');
    header('Content-Length: ' . $fileSize);
    header('Cache-Control: no-cache, must-revalidate');
    header('Pragma: no-cache');
    header('Expires: 0');
    
    // Clear any output buffers
    while (ob_get_level()) {
        ob_end_clean();
    }
    
    // Output the zip file
    readfile($zipFile);
    
    // Clean up temporary files
    unlink($zipFile);
    removeDirectory($tempDir);
    
} catch (Exception $e) {
    // Log error
    error_log("React project download error: " . $e->getMessage());
    error_log("Stack trace: " . $e->getTraceAsString());
    
    // Send error response
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'error' => 'Failed to generate React project',
        'message' => $e->getMessage()
    ]);
    
    // Clean up if needed
    if (isset($tempDir) && is_dir($tempDir)) {
        removeDirectory($tempDir);
    }
    if (isset($zipFile) && file_exists($zipFile)) {
        unlink($zipFile);
    }
}
?>

