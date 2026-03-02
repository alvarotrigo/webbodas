<?php
/**
 * GitHub Push Handler
 * Pushes files to a GitHub repository using the GitHub API
 * PROTECTED: Requires pro/paid subscription
 */

session_start();
header('Content-Type: application/json');

// Include required files for subscription check
require_once '../config/database.php';
require_once '../config/lemonsqueezy.php';
require_once '../includes/clerk-auth.php';

// Sync Clerk session
clerk_handle_handshake();
$serverUserData = syncClerkSession();

// Check if user has pro/paid subscription
$userEmail = $_SESSION['user_email'] ?? null;

if (!$userEmail) {
    http_response_code(403);
    echo json_encode([
        'success' => false,
        'error' => 'User not authenticated. Please log in first.',
        'requiresUpgrade' => true
    ]);
    exit;
}

// Check subscription status
$subscriptionStatus = checkUserPaidStatusAllSources($userEmail);

if (!$subscriptionStatus['is_paid']) {
    http_response_code(403);
    echo json_encode([
        'success' => false,
        'error' => 'GitHub Export is a Pro feature. Please upgrade to continue.',
        'requiresUpgrade' => true,
        'feature' => 'github_export'
    ]);
    exit;
}

// Check GitHub authentication
if (!isset($_SESSION['github_access_token']) || empty($_SESSION['github_access_token'])) {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'error' => 'Not authenticated with GitHub'
    ]);
    exit;
}

$accessToken = $_SESSION['github_access_token'];

// Get POST data
$input = json_decode(file_get_contents('php://input'), true);

if (!$input || !isset($input['repoName']) || !isset($input['files'])) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'Invalid input data. Repository name and files required.'
    ]);
    exit;
}

$repoName = $input['repoName']; // e.g., "username/repo-name"
$branch = $input['branch'] ?? 'main';
$files = $input['files'];
$isPrivate = $input['isPrivate'] ?? false;
$commitMessage = $input['commitMessage'] ?? 'Deploy from FPStudio';

/**
 * Make a GitHub API request
 */
function githubApiRequest($endpoint, $accessToken, $method = 'GET', $data = null) {
    $url = 'https://api.github.com' . $endpoint;
    
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $accessToken,
        'User-Agent: FPStudio',
        'Accept: application/vnd.github.v3+json',
        'Content-Type: application/json'
    ]);
    
    if ($method !== 'GET') {
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    }
    
    if ($data !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    }
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    
    $result = json_decode($response, true);
    
    return [
        'success' => ($httpCode >= 200 && $httpCode < 300),
        'httpCode' => $httpCode,
        'data' => $result
    ];
}

try {
    error_log('=== GITHUB PUSH DEBUG ===');
    error_log('Repository: ' . $repoName);
    error_log('Branch: ' . $branch);
    error_log('Files count: ' . count($files));
    error_log('File paths: ' . implode(', ', array_keys($files)));
    
    // Parse repository name
    $repoParts = explode('/', $repoName);
    if (count($repoParts) !== 2) {
        throw new Exception('Invalid repository name format. Use: username/repo-name');
    }
    
    $owner = $repoParts[0];
    $repo = $repoParts[1];
    
    // Check if repository exists
    $repoCheckResult = githubApiRequest("/repos/$owner/$repo", $accessToken, 'GET', null);
    
    $repoExists = $repoCheckResult['success'];
    
    // If repository doesn't exist, create it
    if (!$repoExists) {
        $createRepoData = [
            'name' => $repo,
            'description' => 'Website created with FPStudio',
            'private' => $isPrivate,
            'auto_init' => true
        ];
        
        error_log('Creating repository as ' . ($isPrivate ? 'PRIVATE' : 'PUBLIC'));
        
        $createResult = githubApiRequest('/user/repos', $accessToken, 'POST', $createRepoData);
        
        if (!$createResult['success']) {
            throw new Exception('Failed to create repository: ' . ($createResult['data']['message'] ?? 'Unknown error'));
        }
        
        // Wait a moment for the repository to be fully initialized
        sleep(2);
    }
    
    // Get the current reference for the branch
    $refResult = githubApiRequest("/repos/$owner/$repo/git/ref/heads/$branch", $accessToken, 'GET', null);
    
    // If branch doesn't exist, create it from main/master
    if (!$refResult['success']) {
        // Try to get default branch
        $repoInfo = githubApiRequest("/repos/$owner/$repo", $accessToken, 'GET', null);
        $defaultBranch = $repoInfo['data']['default_branch'] ?? 'main';
        
        // Get the SHA of the default branch
        $defaultRefResult = githubApiRequest("/repos/$owner/$repo/git/ref/heads/$defaultBranch", $accessToken, 'GET', null);
        
        if ($defaultRefResult['success']) {
            $sha = $defaultRefResult['data']['object']['sha'];
            
            // Create new branch
            $createBranchResult = githubApiRequest(
                "/repos/$owner/$repo/git/refs",
                $accessToken,
                'POST',
                [
                    'ref' => "refs/heads/$branch",
                    'sha' => $sha
                ]
            );
            
            if (!$createBranchResult['success']) {
                throw new Exception('Failed to create branch');
            }
            
            $refResult = githubApiRequest("/repos/$owner/$repo/git/ref/heads/$branch", $accessToken, 'GET', null);
        }
    }
    
    if (!$refResult['success']) {
        throw new Exception('Failed to get branch reference');
    }
    
    $currentSha = $refResult['data']['object']['sha'];
    
    // Get the current commit
    $commitResult = githubApiRequest("/repos/$owner/$repo/git/commits/$currentSha", $accessToken, 'GET', null);
    
    if (!$commitResult['success']) {
        throw new Exception('Failed to get current commit');
    }
    
    $baseTreeSha = $commitResult['data']['tree']['sha'];
    
    // Create blobs for each file
    $treeItems = [];
    
    foreach ($files as $path => $content) {
        // Create blob
        $blobResult = githubApiRequest(
            "/repos/$owner/$repo/git/blobs",
            $accessToken,
            'POST',
            [
                'content' => $content,
                'encoding' => 'utf-8'
            ]
        );
        
        if (!$blobResult['success']) {
            error_log("Failed to create blob for $path: " . json_encode($blobResult));
            continue;
        }
        
        $treeItems[] = [
            'path' => $path,
            'mode' => '100644',
            'type' => 'blob',
            'sha' => $blobResult['data']['sha']
        ];
    }
    
    // Create a new tree
    $treeResult = githubApiRequest(
        "/repos/$owner/$repo/git/trees",
        $accessToken,
        'POST',
        [
            'base_tree' => $baseTreeSha,
            'tree' => $treeItems
        ]
    );
    
    if (!$treeResult['success']) {
        throw new Exception('Failed to create tree: ' . json_encode($treeResult['data']));
    }
    
    $newTreeSha = $treeResult['data']['sha'];
    
    // Create a new commit
    $newCommitResult = githubApiRequest(
        "/repos/$owner/$repo/git/commits",
        $accessToken,
        'POST',
        [
            'message' => $commitMessage,
            'tree' => $newTreeSha,
            'parents' => [$currentSha]
        ]
    );
    
    if (!$newCommitResult['success']) {
        throw new Exception('Failed to create commit: ' . json_encode($newCommitResult['data']));
    }
    
    $newCommitSha = $newCommitResult['data']['sha'];
    
    // Update the reference
    $updateRefResult = githubApiRequest(
        "/repos/$owner/$repo/git/refs/heads/$branch",
        $accessToken,
        'PATCH',
        [
            'sha' => $newCommitSha,
            'force' => false
        ]
    );
    
    if (!$updateRefResult['success']) {
        throw new Exception('Failed to update reference: ' . json_encode($updateRefResult['data']));
    }
    
    echo json_encode([
        'success' => true,
        'message' => 'Successfully pushed to GitHub',
        'repoUrl' => "https://github.com/$owner/$repo",
        'commitSha' => $newCommitSha,
        'branch' => $branch
    ]);
    
} catch (Exception $e) {
    error_log('GitHub push error: ' . $e->getMessage());
    
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?>

