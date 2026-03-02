<?php
/**
 * API endpoint to serve screenshot images as base64
 * This ensures screenshots are accessible even if the directory is not publicly accessible
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$projectRoot = dirname(__DIR__);
$screenshotsPath = $projectRoot . '/screenshots';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit();
}

if (!isset($_GET['id'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing id parameter']);
    exit();
}

$imageId = (int)$_GET['id'];
$imagePath = $screenshotsPath . '/' . $imageId . '.jpg';

if (!file_exists($imagePath)) {
    http_response_code(404);
    echo json_encode(['error' => 'Screenshot not found']);
    exit();
}

// Read image and convert to base64
$imageData = file_get_contents($imagePath);
$base64 = base64_encode($imageData);

echo json_encode([
    'success' => true,
    'image_id' => $imageId,
    'image_base64' => $base64
]);


