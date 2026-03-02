# GitHub Export Feature

The GitHub Export feature allows users to export their projects directly to a GitHub repository. Users can choose between HTML or React formats and push directly to their GitHub repositories without needing to download and manually upload files.

## Table of Contents

1. [Features](#features)
2. [Setup Instructions](#setup-instructions)
3. [How It Works](#how-it-works)
4. [User Flow](#user-flow)
5. [API Endpoints](#api-endpoints)
6. [Troubleshooting](#troubleshooting)

## Features

- **Direct GitHub Integration**: Push projects directly to GitHub repositories
- **Multiple Export Formats**: Choose between HTML + CSS or React + Vite
- **Auto Repository Creation**: Automatically creates repositories if they don't exist
- **Branch Selection**: Push to main, master, or gh-pages branches
- **OAuth Authentication**: Secure GitHub authentication using OAuth 2.0
- **User-Friendly UI**: Beautiful modal interface for GitHub export options

## Setup Instructions

### 1. Create a GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in the application details:
   - **Application name**: FPStudio (or your app name)
   - **Homepage URL**: Your application URL (e.g., `http://localhost:8000` or `https://yourdomain.com`)
   - **Authorization callback URL**: `http://localhost:8000/api/github-oauth.php` (or your production URL)
4. Click "Register application"
5. Copy the **Client ID** and **Client Secret**

### 2. Configure Environment Variables

Add the following to your `.env` file:

```env
# GitHub OAuth Configuration
GITHUB_CLIENT_ID=your_client_id_here
GITHUB_CLIENT_SECRET=your_client_secret_here
GITHUB_REDIRECT_URI=http://localhost:8000/api/github-oauth.php
```

**Important Notes:**
- For production, update `GITHUB_REDIRECT_URI` to your production URL
- Never commit your `.env` file to version control
- Keep your Client Secret secure

### 3. Session Configuration

Make sure your PHP session is properly configured. The GitHub authentication uses PHP sessions to store the access token.

```php
// This is already handled in the API files
session_start();
```

## How It Works

### Architecture Overview

```
┌─────────────────┐
│   User clicks   │
│  "GitHub" btn   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│  GitHub Export Modal    │
│  - Select format        │
│  - Authenticate GitHub  │
│  - Choose repository    │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  GitHub OAuth Flow      │
│  (github-oauth.php)     │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Generate Project Files │
│  (HTML or React)        │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Push to GitHub         │
│  (github-push.php)      │
└─────────────────────────┘
```

### Authentication Flow

1. User clicks "Connect GitHub"
2. OAuth popup opens to `api/github-oauth.php`
3. User is redirected to GitHub for authorization
4. GitHub redirects back with an authorization code
5. Server exchanges code for access token
6. Access token is stored in PHP session
7. Popup closes and parent window is notified

### Push Flow

1. User selects format (HTML or React) and enters repository name
2. Application generates project files based on format
3. Application calls `github-push.php` with files and repository info
4. Server creates/updates repository using GitHub API
5. Files are committed and pushed to the specified branch
6. Success message with repository link is displayed

## User Flow

### Step 1: Open Export Options

Click the download button in the editor to open the export options modal.

### Step 2: Choose GitHub Export

Select the "GitHub" option from the three available export formats.

### Step 3: Authenticate

Click "Connect GitHub" to authenticate with your GitHub account. A popup will open for OAuth authentication.

### Step 4: Configure Export

- **Format**: Choose between HTML + CSS or React + Vite
- **Repository**: Enter the repository name in the format `username/repo-name`
- **Branch**: Select the target branch (main, master, or gh-pages)

### Step 5: Push to GitHub

Click "Push to GitHub" to start the export process. The application will:
1. Generate the project files
2. Create the repository if it doesn't exist
3. Push all files to the specified branch
4. Display a success message with a link to your repository

## API Endpoints

### 1. `api/github-oauth.php`

**Purpose**: Handles GitHub OAuth authentication flow

**Methods**: GET

**Query Parameters**:
- `code` (optional): Authorization code from GitHub callback

**Response**: HTML page or redirect to GitHub OAuth

**Session Variables Set**:
- `github_access_token`: The OAuth access token
- `github_username`: User's GitHub username
- `github_user_id`: User's GitHub ID

---

### 2. `api/github-auth-status.php`

**Purpose**: Check current GitHub authentication status

**Method**: GET

**Response**:
```json
{
  "authenticated": true,
  "username": "johndoe",
  "userId": "12345"
}
```

---

### 3. `api/github-disconnect.php`

**Purpose**: Disconnect GitHub account (clear session)

**Method**: POST

**Response**:
```json
{
  "success": true,
  "message": "Successfully disconnected from GitHub"
}
```

---

### 4. `api/github-push.php`

**Purpose**: Push files to a GitHub repository

**Method**: POST

**Request Body**:
```json
{
  "repoName": "username/repo-name",
  "branch": "main",
  "files": {
    "index.html": "<html>...</html>",
    "styles.css": "body { ... }",
    "README.md": "# My Project"
  },
  "commitMessage": "Deploy from FPStudio"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Successfully pushed to GitHub",
  "repoUrl": "https://github.com/username/repo-name",
  "commitSha": "abc123...",
  "branch": "main"
}
```

**Features**:
- Automatically creates repository if it doesn't exist
- Creates branch if it doesn't exist
- Uses GitHub's blob/tree/commit API for reliable pushes
- Handles both new and existing repositories

---

### 5. `api/generate-html-project.php`

**Purpose**: Generate HTML + CSS project files

**Method**: POST

**Request Body**:
```json
{
  "sections": [
    {
      "html": "<section>...</section>"
    }
  ],
  "theme": "theme-light-minimal",
  "projectName": "my-website"
}
```

**Response**:
```json
{
  "success": true,
  "files": {
    "index.html": "<!DOCTYPE html>...",
    "styles.css": "/* CSS content */",
    "README.md": "# Project README"
  },
  "projectName": "my-website"
}
```

---

## Troubleshooting

### Issue: "GitHub OAuth is not configured"

**Solution**: Make sure you've added the GitHub OAuth credentials to your `.env` file:
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_REDIRECT_URI`

---

### Issue: "Not authenticated with GitHub"

**Solution**: Click "Connect GitHub" in the GitHub export modal to authenticate.

---

### Issue: "Failed to create repository"

**Possible Causes**:
1. Repository name is invalid (should be `username/repo-name`)
2. User doesn't have permission to create repositories
3. Repository already exists under a different account

**Solution**: 
- Verify the repository name format
- Check GitHub permissions
- Try a different repository name

---

### Issue: "Failed to push to GitHub"

**Possible Causes**:
1. Invalid access token (session expired)
2. Insufficient permissions
3. Branch is protected
4. Network issues

**Solution**:
- Disconnect and reconnect GitHub
- Check repository settings for branch protection
- Verify network connectivity

---

### Issue: OAuth popup blocked

**Solution**: Allow popups for your domain in browser settings.

---

### Issue: Session expires after a while

**Solution**: This is expected behavior for security. Simply reconnect to GitHub when needed.

---

## Security Considerations

1. **Access Token Storage**: Access tokens are stored in PHP sessions, not in databases or client-side storage
2. **Token Expiration**: GitHub tokens don't expire by default, but can be revoked by the user at any time
3. **Scope Permissions**: The OAuth app requests `repo` and `user` scopes:
   - `repo`: Full control of private and public repositories
   - `user`: Read user profile information
4. **HTTPS**: Use HTTPS in production to protect tokens in transit
5. **Session Security**: Configure PHP sessions with secure flags in production

## Production Deployment

### Update OAuth Callback URL

1. Go to your GitHub OAuth app settings
2. Update the "Authorization callback URL" to your production URL
3. Update `GITHUB_REDIRECT_URI` in your production `.env` file

Example:
```env
GITHUB_REDIRECT_URI=https://yourdomain.com/api/github-oauth.php
```

### Session Configuration

Add to your PHP configuration for production:

```php
session_start([
    'cookie_secure' => true,      // Only send over HTTPS
    'cookie_httponly' => true,    // Not accessible via JavaScript
    'cookie_samesite' => 'Lax',   // CSRF protection
    'use_strict_mode' => true     // Reject uninitialized session IDs
]);
```

## Rate Limits

GitHub API has rate limits:
- **Authenticated requests**: 5,000 requests per hour
- **Unauthenticated requests**: 60 requests per hour

The GitHub export feature uses authenticated requests, so you should have plenty of room for normal usage.

## Future Enhancements

Potential improvements for the GitHub export feature:

1. **Repository Browser**: Browse existing repositories instead of typing the name
2. **Deployment Status**: Show GitHub Pages deployment status
3. **Auto Deploy**: Automatically enable GitHub Pages after push
4. **Commit History**: View previous exports and commits
5. **Collaborator Management**: Add collaborators to repositories
6. **Private Repositories**: Option to create private repositories (requires different OAuth app setup)
7. **Multiple Accounts**: Support multiple GitHub accounts
8. **Organization Repositories**: Push to organization repositories
9. **Webhooks**: Set up webhooks for continuous deployment
10. **Git History**: Maintain proper git history instead of force pushing

## Support

For issues or questions:
1. Check this documentation
2. Review the [Troubleshooting](#troubleshooting) section
3. Check GitHub OAuth app settings
4. Review PHP error logs
5. Test with a simple repository first

## License

This feature is part of FPStudio.


