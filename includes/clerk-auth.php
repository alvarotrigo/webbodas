<?php
/**
 * Clerk Authentication Helper
 *
 * Synchronises PHP sessions with Clerk authentication so that server-rendered
 * pages can access the logged-in user immediately (without waiting for the
 * browser SDK).
 *
 * The helper verifies the Clerk session token that is stored in the `__session`
 * cookie. When the token is valid we fetch the Clerk user profile, update the
 * local PHP session (so existing helpers keep working) and return a simplified
 * array that can be embedded straight into templates.
 *
 * Expected environment variables:
 *  - CLERK_SECRET_KEY              (required to verify sessions)
 *  - CLERK_API_BASE_URL            (optional, defaults to https://api.clerk.com)
 *
 * Optionally you can provide a `.env` file at the project root with the same
 * keys. This helper will fall back to that file if the variables are not
 * already set in the environment.
 */

declare(strict_types=1);

// Configure error logging
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/../errors.txt');

// Ensure session utilities and paid-status helpers are available.
require_once __DIR__ . '/session-manager.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/lemonsqueezy.php';
require_once __DIR__ . '/../vendor/autoload.php';


use Clerk\Backend;
use Clerk\Backend\Helpers\Jwks\AuthenticateRequest;
use Clerk\Backend\Helpers\Jwks\AuthenticateRequestOptions;
use GuzzleHttp\Psr7\ServerRequest;

if (!function_exists('str_starts_with')) {
    /**
     * Polyfill for PHP < 8.0.
     *
     * @codeCoverageIgnore
     */
    function str_starts_with(string $haystack, string $needle): bool
    {
        if ($needle === '') {
            return true;
        }

        return substr($haystack, 0, strlen($needle)) === $needle;
    }
}

/**
 * Load environment variables from a local .env file (if present) so that the
 * helper can work in local environments without additional configuration.
 */
function clerk_load_dotenv(): void
{
    static $loaded = false;

    if ($loaded) {
        return;
    }

    $envPath = dirname(__DIR__) . '/.env';

    if (!file_exists($envPath)) {
        $loaded = true;
        return;
    }

    $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);

    if ($lines === false) {
        $loaded = true;
        return;
    }

    foreach ($lines as $line) {
        $line = trim($line);

        if ($line === '' || str_starts_with($line, '#')) {
            continue;
        }

        [$key, $value] = array_map('trim', explode('=', $line, 2) + ['', '']);

        if ($key !== '' && getenv($key) === false) {
            putenv(sprintf('%s=%s', $key, $value));
        }
    }

    $loaded = true;
}

/**
 * Fetch a Clerk-related environment variable (with optional default).
 */
function clerk_env(string $key, ?string $default = null): ?string
{
    clerk_load_dotenv();

    $value = getenv($key);

    if ($value === false) {
        return $default;
    }

    $trimmed = trim($value);

    return $trimmed === '' ? $default : $trimmed;
}

/**
 * Determine the base API URL for Clerk requests.
 */
function clerk_api_base_url(): string
{
    $baseUrl = clerk_env('CLERK_API_BASE_URL');
    if ($baseUrl) {
        return rtrim($baseUrl, '/');
    }

    $frontendApi = clerk_env('CLERK_FRONTEND_API_URL');
    if ($frontendApi) {
        return rtrim($frontendApi, '/');
    }

    return 'https://api.clerk.com';
}

/**
 * Convert mixed data (object/array) into a plain PHP array recursively.
 *
 * @param mixed $value
 */
function clerk_normalize_mixed(mixed $value): mixed
{
    if (is_array($value)) {
        $normalized = [];
        foreach ($value as $k => $v) {
            $normalized[$k] = clerk_normalize_mixed($v);
        }
        return $normalized;
    }

    if (is_object($value)) {
        if ($value instanceof \JsonSerializable) {
            $value = $value->jsonSerialize();
        } else {
            $value = json_decode(json_encode($value), true);
        }

        if (!is_array($value)) {
            return $value;
        }

        return clerk_normalize_mixed($value);
    }

    return $value;
}

/**
 * Retrieve a value from mixed data supporting both camelCase and snake_case keys.
 *
 * @param array<string, mixed> $data
 */
function clerk_data_get(array $data, string $camelKey): mixed
{
    if (array_key_exists($camelKey, $data)) {
        return $data[$camelKey];
    }

    $snakeKey = strtolower(preg_replace('/(?<!^)[A-Z]/', '_$0', $camelKey));
    return $data[$snakeKey] ?? null;
}

/**
 * Normalize user data (from SDK or REST API) into a consistent associative array.
 *
 * @param mixed $user
 * @return array<string, mixed>|null
 */
function clerk_normalize_user(mixed $user): ?array
{
    $userArray = clerk_normalize_mixed($user);
    if (!is_array($userArray)) {
        return null;
    }

    $emailAddresses = clerk_data_get($userArray, 'emailAddresses') ?? [];
    if (!is_array($emailAddresses)) {
        $emailAddresses = [];
    }

    $normalizedEmails = [];
    foreach ($emailAddresses as $emailEntry) {
        $entry = clerk_normalize_mixed($emailEntry);
        if (!is_array($entry)) {
            continue;
        }

        $normalizedEmails[] = [
            'id'            => clerk_data_get($entry, 'id'),
            'email_address' => clerk_data_get($entry, 'emailAddress'),
        ];
    }

    return [
        'id'                         => clerk_data_get($userArray, 'id'),
        'first_name'                 => clerk_data_get($userArray, 'firstName'),
        'last_name'                  => clerk_data_get($userArray, 'lastName'),
        'username'                   => clerk_data_get($userArray, 'username'),
        'primary_email_address_id'   => clerk_data_get($userArray, 'primaryEmailAddressId'),
        'email_addresses'            => $normalizedEmails,
        'image_url'                  => clerk_data_get($userArray, 'imageUrl'),
        'profile_image_url'          => clerk_data_get($userArray, 'profileImageUrl'),
    ];
}

/**
 * Fetch user data via Clerk REST API as a fallback when the SDK cannot deserialize.
 *
 * @return array<string, mixed>|null
 */
function clerk_fetch_user_via_rest(string $userId, string $secretKey): ?array
{
    $baseUrl = clerk_api_base_url();
    $url     = $baseUrl . '/v1/users/' . rawurlencode($userId);

    $headers = [
        'Authorization: Bearer ' . $secretKey,
        'Content-Type: application/json',
    ];

    $curl = curl_init($url);
    if ($curl === false) {
        return null;
    }

    curl_setopt_array($curl, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => $headers,
    ]);

    $response = curl_exec($curl);
    $status   = curl_getinfo($curl, CURLINFO_HTTP_CODE);

    if ($response === false || $status < 200 || $status >= 300) {
        return null;
    }

    $data = json_decode($response, true);
    if (!is_array($data)) {
        return null;
    }

    return clerk_normalize_mixed($data);
}

/**
 * Decode a base64url encoded string.
 */
function clerk_base64url_decode(string $value): string
{
    $remainder = strlen($value) % 4;
    if ($remainder) {
        $value .= str_repeat('=', 4 - $remainder);
    }
    return base64_decode(strtr($value, '-_', '+/')) ?: '';
}

/**
 * Handle Clerk handshake requests by setting cookies from the handshake payload.
 */
function clerk_handle_handshake(): void
{
    if (!isset($_GET['__clerk_handshake'])) {
        return;
    }

    $handshakeToken = (string) $_GET['__clerk_handshake'];
    $parts          = explode('.', $handshakeToken);

    if (count($parts) < 2) {
        return;
    }

    $payloadJson = clerk_base64url_decode($parts[1]);
    $payload     = json_decode($payloadJson, true);

    if (!is_array($payload) || empty($payload['handshake']) || !is_array($payload['handshake'])) {
        return;
    }

    foreach ($payload['handshake'] as $cookieString) {
        if (!is_string($cookieString) || trim($cookieString) === '') {
            continue;
        }
        header('Set-Cookie: ' . trim($cookieString), false);
    }

    $query = $_GET;
    unset($query['__clerk_handshake']);

    $path      = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH) ?: '/';
    $redirect  = $path;
    if (!empty($query)) {
        $redirect .= '?' . http_build_query($query);
    }

    header('Location: ' . $redirect);
    exit;
}

/**
 * Build the data structure that templates expect from the current PHP session.
 */
function clerk_session_user_payload(): ?array
{
    if (!validateSession()) {
        return null;
    }

    if (!isUserAuthenticated()) {
        return null;
    }

    $avatarUrl = $_SESSION['clerk_avatar'] ?? $_SESSION['user_avatar'] ?? null;

    return [
        'authenticated'        => true,
        'email'                => getCurrentUserEmail(),
        'name'                 => getCurrentUserName(),
        'is_paid'              => isUserPaid(),
        'mode'                 => getUserMode(),
        'clerk_user_id'        => $_SESSION['clerk_user_id'] ?? null,
        'clerk_session'        => $_SESSION['clerk_session_id'] ?? null,
        'avatar_url'           => $avatarUrl,
    ];
}

/**
 * Verify the Clerk session token and return the associated user data. When a
 * valid session is found, the PHP session is updated and a payload is returned.
 */
function syncClerkSession(): ?array
{
    $existing = clerk_session_user_payload();
    
    // Check if we should force a refresh of the paid status
    // Refresh every 5 minutes to ensure subscription status is up-to-date
    $lastSync = $_SESSION['clerk_last_sync'] ?? 0;
    $syncInterval = 300; // 5 minutes in seconds
    $shouldRefresh = (time() - $lastSync) > $syncInterval;
    
    // If we have existing data with avatar, but it's time to refresh paid status
    if ($existing && !empty($existing['avatar_url']) && !$shouldRefresh) {
        return $existing;
    }
    
    // If we have existing data but need to refresh, check paid status only
    if ($existing && $shouldRefresh && !empty($existing['email'])) {
        error_log("syncClerkSession - Refreshing paid status for: " . $existing['email']);
        $paidStatus = checkUserPaidStatusAllSources($existing['email']);
        $isPaid = (bool) ($paidStatus['is_paid'] ?? false);
        
        // Update session with new paid status
        $_SESSION['is_paid'] = $isPaid;
        $_SESSION['mode'] = $isPaid ? 'paid' : 'authenticated';
        $_SESSION['subscription_details'] = (($paidStatus['status'] ?? null) === 'paid') ? $paidStatus : null;
        $_SESSION['clerk_last_sync'] = time();
        
        // Update and return refreshed data
        $existing['is_paid'] = $isPaid;
        $existing['mode'] = $isPaid ? 'paid' : 'authenticated';
        
        error_log("syncClerkSession - Paid status refreshed: is_paid=" . ($isPaid ? 'true' : 'false'));
        
        return $existing;
    }

    $secretKey = clerk_env('CLERK_SECRET_KEY');
    if (!$secretKey) {
        return $existing;
    }

    try {
        $psrRequest = ServerRequest::fromGlobals();
    } catch (\Throwable $e) {
        return $existing;
    }

    $authorizedParties = [];
    if (!empty($_SERVER['HTTP_HOST'])) {
        $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $host = $_SERVER['HTTP_HOST'];
        $authorizedParties[] = sprintf('%s://%s', $scheme, $host);
        if (strpos($host, ':') !== false) {
            $hostWithoutPort = explode(':', $host)[0];
            $authorizedParties[] = sprintf('%s://%s', $scheme, $hostWithoutPort);
        }
    }

    try {
        $options = new AuthenticateRequestOptions(
            secretKey: $secretKey,
            authorizedParties: null
        );
        
        $requestState = AuthenticateRequest::authenticateRequest($psrRequest, $options);
        
        if (! $requestState->isAuthenticated() && !empty($authorizedParties)) {
            $options = new AuthenticateRequestOptions(
                secretKey: $secretKey,
                authorizedParties: $authorizedParties
            );
            $requestState = AuthenticateRequest::authenticateRequest($psrRequest, $options);
        }
    } catch (\Throwable $e) {
        return $existing;
    }

    if (! $requestState->isAuthenticated()) {
        return $existing;
    }

    try {
        $authObject = $requestState->toAuth();
    } catch (\Throwable $e) {
        return $existing;
    }

    $userId = $authObject->sub ?? null;
    if (!$userId) {
        return $existing;
    }

    $normalizedUser = null;

    try {
        static $sdk = null;
        if ($sdk === null) {
            $sdk = Backend\ClerkBackend::builder()
                ->setSecurity($secretKey)
                ->build();
        }
        $userResponse = $sdk->users->get($userId);
        $user = $userResponse->user ?? null;
        if ($user) {
            $normalizedUser = clerk_normalize_user($user);
        }
    } catch (\Throwable $e) {
        $normalizedUser = null;
    }

    if (!$normalizedUser) {
        $restUser = clerk_fetch_user_via_rest($userId, $secretKey);
        if ($restUser) {
            $normalizedUser = clerk_normalize_user($restUser);
        }
    }

    if (!$normalizedUser) {
        return $existing;
    }

    $primaryEmail = null;
    $primaryEmailId = $normalizedUser['primary_email_address_id'] ?? null;
    $emailAddresses = $normalizedUser['email_addresses'] ?? [];

    if ($primaryEmailId && !empty($emailAddresses)) {
        foreach ($emailAddresses as $emailEntry) {
            if (($emailEntry['id'] ?? null) === $primaryEmailId) {
                $primaryEmail = $emailEntry['email_address'] ?? null;
                break;
            }
        }
    }

    if (!$primaryEmail && !empty($emailAddresses)) {
        $firstEmail = $emailAddresses[0]['email_address'] ?? null;
        if ($firstEmail) {
            $primaryEmail = $firstEmail;
        }
    }

    $firstName = $normalizedUser['first_name'] ?? '';
    $lastName  = $normalizedUser['last_name'] ?? '';
    $username  = $normalizedUser['username'] ?? '';

    $nameParts = array_filter([$firstName, $lastName]);
    $fullName  = trim(implode(' ', $nameParts));
    if ($fullName === '' && $username !== '') {
        $fullName = (string) $username;
    }
    if ($fullName === '' && $primaryEmail) {
        $fullName = $primaryEmail;
    }

    $avatarUrl = $normalizedUser['image_url'] ?? $normalizedUser['profile_image_url'] ?? null;
    if ($avatarUrl && !filter_var($avatarUrl, FILTER_VALIDATE_URL)) {
        $avatarUrl = null;
    }

    $paidStatus = $primaryEmail ? checkUserPaidStatusAllSources($primaryEmail) : ['is_paid' => false];
    $isPaid     = (bool) ($paidStatus['is_paid'] ?? false);
    $mode       = $isPaid ? 'paid' : 'authenticated';
    $details    = (($paidStatus['status'] ?? null) === 'paid') ? $paidStatus : null;

    initializeUserSession($primaryEmail, $fullName ?: ($primaryEmail ?? null), $isPaid, $details, $avatarUrl, $userId);

    // Create or update user in users table (tracks all logged-in users)
    if ($userId && $primaryEmail) {
        try {
            $proStatusSource = null;
            $subscriptionId = null;
            
            if ($isPaid) {
                $proStatusSource = $paidStatus['source'] ?? 'lemonsqueezy';
                $subscriptionId = $paidStatus['subscription_id'] ?? null;
            }
            
            error_log("syncClerkSession - Creating/updating user: clerk_user_id={$userId}, email={$primaryEmail}, is_pro=" . ($isPaid ? 'true' : 'false'));
            
            createOrUpdateUser(
                $userId,
                $primaryEmail,
                $fullName ?: null,
                $isPaid,
                $proStatusSource,
                $subscriptionId
            );
            
            error_log("syncClerkSession - User created/updated successfully: {$userId}");
        } catch (Exception $e) {
            // Log error but don't fail authentication
            error_log("Error creating/updating user record in syncClerkSession: " . $e->getMessage());
            error_log("Stack trace: " . $e->getTraceAsString());
        }
    } else {
        error_log("syncClerkSession - Skipping user creation: userId=" . ($userId ?? 'NULL') . ", email=" . ($primaryEmail ?? 'NULL'));
    }

    $_SESSION['clerk_user_id']    = $userId;
    $_SESSION['clerk_session_id'] = property_exists($authObject, 'sid') ? ($authObject->sid ?? null) : null;
    $_SESSION['clerk_last_sync']  = time();
    $_SESSION['clerk_avatar']     = $avatarUrl;
    $_SESSION['user_avatar']      = $avatarUrl;

    return [
        'authenticated'         => true,
        'email'                 => $primaryEmail,
        'name'                  => $fullName ?: $primaryEmail,
        'is_paid'               => $isPaid,
        'mode'                  => $mode,
        'clerk_user_id'         => $userId,
        'avatar_url'            => $avatarUrl,
        'clerk_session'         => $_SESSION['clerk_session_id'] ?? null,
    ];
}