# Authentication Setup Guide

This guide will help you set up Clerk authentication for the ModernCo Editor.

## Prerequisites

1. A Clerk account (free tier available at [clerk.com](https://clerk.com))
2. Node.js and npm installed
3. The ModernCo Editor project

## Step 1: Create a Clerk Application

1. Go to [clerk.com](https://clerk.com) and sign up for a free account
2. Create a new application
3. Choose "JavaScript" as your framework
4. Note down your **Publishable Key** and **Frontend API URL**

## Step 2: Configure Authentication Methods

In your Clerk Dashboard:

### Enable Google OAuth
1. Go to **User & Authentication** > **Social Connections**
2. Enable **Google**
3. Add your Google OAuth credentials (Client ID and Secret)

### Enable GitHub OAuth
1. Go to **User & Authentication** > **Social Connections**
2. Enable **GitHub**
3. Add your GitHub OAuth credentials (Client ID and Secret)

### Enable Magic Links
1. Go to **User & Authentication** > **Email, Phone, Username**
2. Enable **Email address**
3. Configure your email provider settings

## Step 3: Update Configuration

1. Open `clerk-config.js`
2. Replace the placeholder values with your actual Clerk credentials:

```javascript
const CLERK_CONFIG = {
    publishableKey: 'pk_test_YOUR_ACTUAL_PUBLISHABLE_KEY',
    frontendApiUrl: 'https://YOUR_ACTUAL_FRONTEND_API_URL',
    redirectUrls: [
        'http://localhost:3000',
        'http://localhost:5173',
        'http://localhost:8080',
        'https://yourdomain.com'
    ]
};
```

## Step 4: Configure Redirect URLs

In your Clerk Dashboard:

1. Go to **Paths**
2. Add the following redirect URLs:
   - `http://localhost/nine-screen-canvas-flow/auth-wall.html`
   - `http://localhost/nine-screen-canvas-flow/app.php`
   - `https://yourdomain.com/auth-wall.html` (replace with your actual domain)

## Step 5: Test the Authentication

1. Make sure Apache is running and your project is accessible at:
   ```
   http://localhost/nine-screen-canvas-flow/
   ```

2. Navigate to `http://localhost/nine-screen-canvas-flow/auth-wall.html`

3. Test all authentication methods:
   - Google sign-in
   - GitHub sign-in
   - Magic link sign-in
   - Try for free (no authentication)

## How It Works

### Authentication Flow

1. **Entry Point**: Users start at `auth-wall.html`
2. **Authentication Options**: 
   - Google OAuth
   - GitHub OAuth
   - Magic Link
   - Try for Free (no login required)
3. **Editor Access**: After authentication (or choosing free mode), users are redirected to `app.php`
4. **Session Management**: Authentication state is stored in localStorage

### User Modes

- **Free Mode**: Users can try the editor without authentication
- **Authenticated Mode**: Users who signed in get additional features and tracking

### Features

- **Real-time Authentication Status**: Shows if user is authenticated or in free mode
- **User Menu**: Dropdown with user info and sign-out options
- **Session Persistence**: Authentication state persists across browser sessions
- **Graceful Fallback**: If authentication fails, users can still try for free

## File Structure

```
├── auth-wall.html          # Authentication entry point
├── app.php           # Main editor with auth integration
├── clerk-config.js        # Clerk configuration
├── preview.html           # Preview iframe
└── sections/             # Section templates
```

## Customization

### Styling
- Modify CSS variables in `auth-wall.html` for custom styling
- Update the theme colors and layout as needed

### Authentication Methods
- Add more OAuth providers in Clerk Dashboard
- Update the auth-wall.html to include new providers

### User Experience
- Customize the authentication flow
- Add additional user information display
- Implement premium features for authenticated users

## Troubleshooting

### Common Issues

1. **Clerk not loading**: Check your publishable key and frontend API URL
2. **OAuth not working**: Verify your OAuth credentials in Clerk Dashboard
3. **Redirect errors**: Ensure redirect URLs are properly configured
4. **Magic link not sending**: Check your email provider settings

### Debug Mode

Enable console logging by adding this to your browser console:
```javascript
localStorage.setItem('debug', 'true');
```

## Security Considerations

1. **HTTPS**: Always use HTTPS in production
2. **Environment Variables**: Store sensitive keys in environment variables
3. **CORS**: Configure CORS properly for your domain
4. **Session Management**: Implement proper session timeout

## Free Tier Limitations

Clerk's free tier includes:
- 5,000 monthly active users
- Basic authentication methods
- Standard security features

For production use, consider upgrading to a paid plan.

## Support

- [Clerk Documentation](https://clerk.com/docs)
- [Clerk Community](https://clerk.com/community)
- [Clerk Support](https://clerk.com/support) 