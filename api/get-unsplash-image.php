<?php
/**
 * Get Unsplash Image API
 * Searches Unsplash and returns optimized image URL
 */

// Enable error reporting for debugging (disable in production)
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/../debug/php_errors.log');

// Enable CORS for cross-origin requests
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Load environment variables from .env file
function loadEnv($path) {
    if (!file_exists($path)) {
        return false;
    }
    
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || strpos($line, '#') === 0 || strpos($line, '=') === false) {
            continue;
        }

        list($name, $value) = explode('=', $line, 2);
        $name = trim($name);
        $value = trim($value);
        
        if (!array_key_exists($name, $_SERVER) && !array_key_exists($name, $_ENV)) {
            putenv(sprintf('%s=%s', $name, $value));
            $_ENV[$name] = $value;
            $_SERVER[$name] = $value;
        }
    }
    return true;
}

// Try to load .env file from project root
$envPath = __DIR__ . '/../.env';
$envLoaded = loadEnv($envPath);

// Get Unsplash API key from environment (try all possible variations)
$unsplashAccessKey = getenv('UNSPLASH_API_ACCESS_KEY') 
    ?: ($_ENV['UNSPLASH_API_ACCESS_KEY'] ?? '')
    ?: getenv('UNSPLASH_ACCESS_KEY')
    ?: ($_ENV['UNSPLASH_ACCESS_KEY'] ?? '')
    ?: getenv('UNSPLASH_API_KEY')
    ?: ($_ENV['UNSPLASH_API_KEY'] ?? '');

if (empty($unsplashAccessKey)) {
    http_response_code(500);
    $errorMsg = 'Unsplash API key not configured. ';
    
    if (!$envLoaded) {
        $errorMsg .= 'Could not load .env file from: ' . $envPath . '. ';
    }
    
    $errorMsg .= 'Please set UNSPLASH_API_ACCESS_KEY in your .env file.';
    $errorMsg .= ' Get your free API key from: https://unsplash.com/developers';
    
    echo json_encode([
        'error' => $errorMsg,
        'debug' => [
            'env_file_exists' => file_exists($envPath),
            'env_file_path' => $envPath,
            'env_loaded' => $envLoaded,
            'checked_vars' => [
                'UNSPLASH_API_ACCESS_KEY (getenv)' => getenv('UNSPLASH_API_ACCESS_KEY') !== false ? 'set' : 'not set',
                'UNSPLASH_API_ACCESS_KEY ($_ENV)' => isset($_ENV['UNSPLASH_API_ACCESS_KEY']) ? 'set' : 'not set',
                'UNSPLASH_ACCESS_KEY (getenv)' => getenv('UNSPLASH_ACCESS_KEY') !== false ? 'set' : 'not set',
                'UNSPLASH_ACCESS_KEY ($_ENV)' => isset($_ENV['UNSPLASH_ACCESS_KEY']) ? 'set' : 'not set',
                'UNSPLASH_API_KEY (getenv)' => getenv('UNSPLASH_API_KEY') !== false ? 'set' : 'not set',
                'UNSPLASH_API_KEY ($_ENV)' => isset($_ENV['UNSPLASH_API_KEY']) ? 'set' : 'not set'
            ]
        ]
    ], JSON_PRETTY_PRINT);
    exit();
}

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
        exit();
    }

    // Get JSON input
    $input = json_decode(file_get_contents('php://input'), true);

    if (!isset($input['query']) || !isset($input['width']) || !isset($input['height'])) {
        http_response_code(400);
        echo json_encode([
            'error' => 'Missing required fields',
            'required' => ['query', 'width', 'height']
        ]);
        exit();
    }

    $query = $input['query'];
    $width = (int)$input['width'];
    $height = (int)$input['height'];
    $aspectRatio = isset($input['aspectRatio']) ? (float)$input['aspectRatio'] : null;

    // Determine orientation based on aspect ratio
    $orientation = null;
    if ($aspectRatio !== null) {
        if ($aspectRatio > 1.2) {
            $orientation = 'landscape';
        } elseif ($aspectRatio < 0.8) {
            $orientation = 'portrait';
        } else {
            $orientation = 'squarish';
        }
    }

    // Search Unsplash API
    $searchParams = [
        'query' => $query,
        'per_page' => 10
    ];
    
    if ($orientation) {
        $searchParams['orientation'] = $orientation;
    }

    $searchUrl = 'https://api.unsplash.com/search/photos?' . http_build_query($searchParams);

    $ch = curl_init($searchUrl);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: Client-ID ' . $unsplashAccessKey
        ],
        CURLOPT_TIMEOUT => 10, // 10 second timeout for the entire request
        CURLOPT_CONNECTTIMEOUT => 5 // 5 second timeout for connection
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($curlError) {
        error_log("Unsplash API cURL error: " . $curlError);
        throw new Exception('Failed to connect to Unsplash API: ' . $curlError);
    }

    if ($httpCode !== 200) {
        error_log("Unsplash API HTTP error: " . $httpCode . " - " . $response);
        throw new Exception('Unsplash API returned an error: HTTP ' . $httpCode);
    }

    $data = json_decode($response, true);

    if (!isset($data['results']) || empty($data['results'])) {
        http_response_code(404);
        echo json_encode([
            'error' => 'No images found for query: ' . $query
        ]);
        exit();
    }

    // Pick a random image from top 5 results (for variety)
    $topResults = array_slice($data['results'], 0, 5);
    $image = $topResults[array_rand($topResults)];

    // Build optimized Unsplash URL with dimensions
    // Using Unsplash's CDN with w and h parameters for optimal sizing
    $imageUrl = $image['urls']['raw'] . '&w=' . $width . '&h=' . $height . '&fit=crop&auto=format';

    echo json_encode([
        'success' => true,
        'imageUrl' => $imageUrl,
        'unsplashId' => $image['id'],
        'photographer' => $image['user']['name'] ?? 'Unknown',
        'photographerUrl' => $image['user']['links']['html'] ?? null,
        'description' => $image['description'] ?? null
    ]);

} catch (Exception $e) {
    error_log("Error in get-unsplash-image.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'error' => 'Internal server error',
        'message' => $e->getMessage()
    ]);
}
?>

