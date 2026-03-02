<?php
/**
 * GitHub OAuth Handler
 * Handles GitHub OAuth authentication flow
 * PROTECTED: Requires pro/paid subscription
 */

session_start();

// Include required files for subscription check
require_once '../config/database.php';
require_once '../config/lemonsqueezy.php';
require_once '../includes/clerk-auth.php';

// Handle Clerk handshake and sync session
clerk_handle_handshake();
$serverUserData = syncClerkSession();

// Check if user has pro/paid subscription
$userEmail = $_SESSION['user_email'] ?? null;

if (!$userEmail) {
    die('
<!DOCTYPE html>
<html>
<head>
    <title>Authentication Required</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        .container {
            text-align: center;
            padding: 2rem;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 1rem;
            backdrop-filter: blur(10px);
            max-width: 400px;
        }
        .error-icon {
            font-size: 4rem;
            margin-bottom: 1rem;
        }
        h1 {
            margin: 0 0 0.5rem 0;
            font-size: 1.5rem;
        }
        p {
            margin: 0;
            opacity: 0.9;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="error-icon">🔒</div>
        <h1>Authentication Required</h1>
        <p>Please log in to use GitHub Export.</p>
    </div>
    <script>
        setTimeout(() => {
            window.close();
        }, 2000);
    </script>
</body>
</html>
    ');
}

// Check subscription status
$subscriptionStatus = checkUserPaidStatusAllSources($userEmail);

// Debug logging
error_log('GitHub OAuth - User Email: ' . ($userEmail ?? 'NULL'));
error_log('GitHub OAuth - Subscription Status: ' . print_r($subscriptionStatus, true));
error_log('GitHub OAuth - is_paid value: ' . var_export($subscriptionStatus['is_paid'] ?? 'NOT_SET', true));
error_log('GitHub OAuth - is_paid type: ' . gettype($subscriptionStatus['is_paid'] ?? null));

// More robust check that handles both boolean and integer values
$isPaid = !empty($subscriptionStatus['is_paid']) || 
          ($subscriptionStatus['status'] ?? '') === 'paid' || 
          ($subscriptionStatus['status'] ?? '') === 'active';

if (!$isPaid) {
    die('
<!DOCTYPE html>
<html>
<head>
    <title>Pro Feature</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        .container {
            text-align: center;
            padding: 2rem;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 1rem;
            backdrop-filter: blur(10px);
            max-width: 400px;
        }
        .error-icon {
            font-size: 4rem;
            margin-bottom: 1rem;
        }
        h1 {
            margin: 0 0 0.5rem 0;
            font-size: 1.5rem;
        }
        p {
            margin: 0;
            opacity: 0.9;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="error-icon">⭐</div>
        <h1>Pro Feature</h1>
        <p>GitHub Export is available for Pro users. Please upgrade to continue.</p>
    </div>
    <script>
        setTimeout(() => {
            window.close();
        }, 3000);
    </script>
</body>
</html>
    ');
}

// Load environment variables
if (file_exists(__DIR__ . '/../.env')) {
    $envContent = file_get_contents(__DIR__ . '/../.env');
    $lines = explode("\n", $envContent);
    foreach ($lines as $line) {
        $line = trim($line);
        if (empty($line) || strpos($line, '#') === 0) {
            continue;
        }
        if (strpos($line, '=') !== false) {
            list($key, $value) = explode('=', $line, 2);
            $key = trim($key);
            $value = trim($value);
            // Remove quotes if present
            $value = trim($value, '"\'');
            $_ENV[$key] = $value;
        }
    }
}

// GitHub OAuth configuration
$clientId = $_ENV['GITHUB_CLIENT_ID'] ?? '';
$clientSecret = $_ENV['GITHUB_CLIENT_SECRET'] ?? '';
$redirectUri = $_ENV['GITHUB_REDIRECT_URI'] ?? '';

if (empty($clientId) || empty($clientSecret) || empty($redirectUri)) {
    die('GitHub OAuth is not configured. Please add GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, and GITHUB_REDIRECT_URI to your .env file.');
}

// Check if this is a callback with authorization code
if (isset($_GET['code'])) {
    $code = $_GET['code'];
    
    // Exchange code for access token
    $tokenUrl = 'https://github.com/login/oauth/access_token';
    $tokenData = [
        'client_id' => $clientId,
        'client_secret' => $clientSecret,
        'code' => $code,
        'redirect_uri' => $redirectUri
    ];
    
    $ch = curl_init($tokenUrl);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($tokenData));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Accept: application/json'
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    
    if ($httpCode === 200) {
        $result = json_decode($response, true);
        
        if (isset($result['access_token'])) {
            // Get user info
            $userInfoUrl = 'https://api.github.com/user';
            $ch = curl_init($userInfoUrl);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Authorization: Bearer ' . $result['access_token'],
                'User-Agent: FPStudio'
            ]);
            
            $userResponse = curl_exec($ch);
            
            $userInfo = json_decode($userResponse, true);
            
            // Store access token and user info in session
            $_SESSION['github_access_token'] = $result['access_token'];
            $_SESSION['github_username'] = $userInfo['login'] ?? '';
            $_SESSION['github_user_id'] = $userInfo['id'] ?? '';
            
            // Close the popup window and refresh parent
            echo '<!DOCTYPE html>
<html>
<head>
    <title>GitHub Authentication Successful</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        .container {
            text-align: center;
            padding: 2rem;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 1rem;
            backdrop-filter: blur(10px);
        }
        .success-icon {
            font-size: 4rem;
            margin-bottom: 1rem;
        }
        h1 {
            margin: 0 0 0.5rem 0;
            font-size: 1.5rem;
        }
        p {
            margin: 0;
            opacity: 0.9;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="success-icon">✓</div>
        <h1>Successfully Connected!</h1>
        <p>This window will close automatically...</p>
    </div>
    <script>
        setTimeout(() => {
            window.close();
        }, 1500);
    </script>
</body>
</html>';
            exit;
        }
    }
    
    die('Failed to authenticate with GitHub. Please try again.');
}

// Redirect to GitHub OAuth page
$state = bin2hex(random_bytes(16));
$_SESSION['github_oauth_state'] = $state;

$authUrl = 'https://github.com/login/oauth/authorize?' . http_build_query([
    'client_id' => $clientId,
    'redirect_uri' => $redirectUri,
    'scope' => 'repo user',
    'state' => $state
]);

header('Location: ' . $authUrl);
exit;
?>

