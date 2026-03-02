# Sentry Error Tracking and Logging Setup

This document explains how Sentry is integrated into the application for error tracking and logging.

## Overview

Sentry is configured to track errors, log critical events, and provide detailed debugging information for your front-end application. It's integrated into the following pages:

- `index.html` - Main landing page
- `app.php` - Website editor
- `preview.html` - Preview functionality
- `auth-wall.html` - Authentication wall

## Files

### Core Sentry Files

1. **Sentry SDK Script** - Added to the `<head>` of each HTML file:
```html
<script
  src="https://js.sentry-cdn.com/e653ba09396f22997f7db6c50cbb270e.min.js"
  crossorigin="anonymous"
></script>
```

2. **Sentry Initialization Script** - `public/js/sentry-init.js`
   - Configures Sentry with proper settings
   - Sets up user context from Clerk authentication
   - Adds global error handlers
   - Provides logging utilities

## Features

### Automatic Error Tracking

Sentry automatically captures:
- **JavaScript errors** - All uncaught exceptions
- **Unhandled promise rejections** - Async errors
- **Network errors** - Failed API calls
- **Console errors** - Critical console.error() calls

### User Context Integration

When users authenticate with Clerk, Sentry automatically tracks:
- User ID
- Email address
- Username

### Breadcrumbs

Sentry automatically logs breadcrumbs for:
- Page visibility changes
- Network status changes (online/offline)
- User interactions
- Custom events

### Environment Detection

Sentry automatically detects and tags:
- **Environment**: `development` (localhost) or `production`
- **Page**: Current page path
- **Browser**: User agent, language, platform
- **Screen**: Screen resolution and viewport size

## Usage

### Basic Logging

The `SentryLogger` utility provides methods for logging different severity levels:

#### Info Logging
```javascript
SentryLogger.info('User clicked on section', {
  sectionId: 'hero-section',
  timestamp: Date.now()
});
```

#### Warning Logging
```javascript
SentryLogger.warn('API response slow', {
  endpoint: '/api/save',
  duration: 5000
});
```

#### Error Logging
```javascript
try {
  // Some code that might fail
  await saveUserData();
} catch (error) {
  SentryLogger.error('Failed to save user data', error, {
    userId: user.id,
    attemptNumber: 3
  });
}
```

#### Critical Error Logging
```javascript
SentryLogger.critical('Database connection lost', error, {
  impact: 'high',
  affectedUsers: 'all',
  service: 'main-api'
});
```

### Tracking User Actions

Track important user actions for debugging:

```javascript
SentryLogger.track('Section Added', {
  sectionType: 'fp-theme-hero',
  position: 2,
  theme: 'dark-modern'
});

SentryLogger.track('Image Uploaded', {
  size: file.size,
  type: file.type,
  cloudinaryId: result.public_id
});

SentryLogger.track('Theme Changed', {
  from: 'light-minimal',
  to: 'dark-modern'
});
```

### Custom Context

Add custom context to all subsequent errors:

```javascript
// Add project context
SentryLogger.setContext('project', {
  id: projectId,
  name: projectName,
  created: createdDate
});

// Add feature context
SentryLogger.setContext('feature', {
  name: 'image-editor',
  version: '2.0',
  enabled: true
});
```

### Manual Breadcrumbs

Add custom breadcrumbs for debugging:

```javascript
SentryLogger.addBreadcrumb(
  'api-call',
  'Fetching user sections',
  'info',
  { endpoint: '/api/sections', method: 'GET' }
);
```

### User Management

#### Set User Context
```javascript
// After user logs in
SentryLogger.setUser({
  id: user.id,
  email: user.email,
  username: user.username
});
```

#### Clear User Context
```javascript
// On logout
SentryLogger.clearUser();
```

## Integration Examples

### In the Editor (app.php)

```javascript
// Track section additions
function addSection(sectionId) {
  try {
    SentryLogger.track('Section Added', { sectionId });
    // ... your section addition code
  } catch (error) {
    SentryLogger.error('Failed to add section', error, { sectionId });
    throw error;
  }
}

// Track image uploads
async function uploadImage(file) {
  try {
    SentryLogger.info('Starting image upload', { 
      filename: file.name,
      size: file.size 
    });
    
    const result = await cloudinaryUpload(file);
    
    SentryLogger.track('Image Uploaded Successfully', {
      cloudinaryId: result.public_id,
      url: result.secure_url
    });
    
    return result;
  } catch (error) {
    SentryLogger.error('Image upload failed', error, {
      filename: file.name,
      size: file.size
    });
    throw error;
  }
}

// Track critical save failures
async function saveProject() {
  try {
    await api.save(projectData);
  } catch (error) {
    SentryLogger.critical('Failed to save project', error, {
      projectId: project.id,
      hasUnsavedChanges: true,
      lastSaved: project.lastSaved
    });
    throw error;
  }
}
```

### In API Calls

```javascript
async function fetchData(endpoint) {
  SentryLogger.addBreadcrumb('api', `Fetching ${endpoint}`, 'info', { endpoint });
  
  try {
    const response = await fetch(endpoint);
    
    if (!response.ok) {
      SentryLogger.warn(`API error: ${response.status}`, {
        endpoint,
        status: response.status,
        statusText: response.statusText
      });
    }
    
    return await response.json();
  } catch (error) {
    SentryLogger.error('Network request failed', error, { endpoint });
    throw error;
  }
}
```

### In Theme System

```javascript
function changeTheme(newTheme) {
  const oldTheme = currentTheme;
  
  try {
    SentryLogger.track('Theme Change Started', {
      from: oldTheme,
      to: newTheme
    });
    
    // ... theme change logic
    
    SentryLogger.info('Theme changed successfully', {
      theme: newTheme
    });
  } catch (error) {
    SentryLogger.error('Theme change failed', error, {
      from: oldTheme,
      to: newTheme,
      fallback: true
    });
    // Revert to old theme
    revertTheme(oldTheme);
  }
}
```

## Testing

### Test Error Tracking

Open the browser console and run:

```javascript
// Test basic error
SentryDebug.testError();

// Test critical error
SentryDebug.testCritical();

// Check Sentry configuration
SentryDebug.showConfig();
```

After running these commands, check your [Sentry Dashboard](https://sentry.io) to verify errors are being captured.

### Manual Testing

You can also manually test error capture:

```javascript
// Test exception capture
try {
  throw new Error('Manual test error');
} catch (e) {
  SentryLogger.error('Manual test', e, { test: true });
}

// Test warning
SentryLogger.warn('This is a test warning', { severity: 'low' });

// Test tracking
SentryLogger.track('Test Event', { action: 'manual-test' });
```

## Best Practices

### 1. **Use Appropriate Severity Levels**
- `info()` - Normal operations, successful actions
- `warn()` - Recoverable issues, degraded performance
- `error()` - Failed operations, caught exceptions
- `critical()` - System-critical failures, data loss

### 2. **Provide Context**
Always include relevant context with your logs:
```javascript
// Bad
SentryLogger.error('Save failed', error);

// Good
SentryLogger.error('Save failed', error, {
  userId: user.id,
  projectId: project.id,
  sectionCount: sections.length,
  attemptNumber: retryCount
});
```

### 3. **Track Important User Actions**
Track actions that help you understand user behavior:
```javascript
SentryLogger.track('Export Initiated', {
  format: 'html',
  sectionCount: 9,
  theme: currentTheme
});
```

### 4. **Use Breadcrumbs for Flow**
Add breadcrumbs to understand the sequence of events:
```javascript
SentryLogger.addBreadcrumb('navigation', 'Opened editor', 'info');
SentryLogger.addBreadcrumb('ui-action', 'Selected section', 'info', { id: 'hero' });
SentryLogger.addBreadcrumb('api-call', 'Saved changes', 'info');
```

### 5. **Don't Log Sensitive Data**
Never log:
- Passwords
- API keys
- Personal information (unless already anonymized)
- Credit card numbers
- Session tokens

### 6. **Clean Up User Context on Logout**
```javascript
function handleLogout() {
  SentryLogger.clearUser();
  // ... rest of logout logic
}
```

## Dashboard Access

Access your Sentry dashboard at: [https://sentry.io](https://sentry.io)

You can view:
- **Issues** - All captured errors and exceptions
- **Performance** - Performance monitoring data
- **Releases** - Track errors by release version
- **Users** - See which users are affected
- **Breadcrumbs** - Detailed event timeline leading to errors

## Configuration

The Sentry configuration is automatically set based on:
- **Project**: Defined by your Sentry DSN in the loader script
- **Environment**: Automatically detected (localhost = development, otherwise production)
- **User**: Automatically set from Clerk authentication

## Troubleshooting

### Sentry Not Loading

If you see warnings in the console about Sentry not loading:

1. Check your network connection
2. Verify the Sentry CDN URL is correct
3. Check browser console for any CSP (Content Security Policy) issues

### Errors Not Appearing in Dashboard

1. Verify you're looking at the correct project in Sentry
2. Check that the environment filter matches (development/production)
3. Run `SentryDebug.testError()` in the console to test connectivity
4. Check browser console for any Sentry initialization errors

### User Context Not Set

If user context isn't being captured:

1. Verify Clerk is loaded before Sentry tries to set user context
2. Check that `window.Clerk.user` exists after authentication
3. Manually set user context after login:
   ```javascript
   SentryLogger.setUser({
     id: user.id,
     email: user.email
   });
   ```

## Support

For Sentry-specific issues:
- [Sentry Documentation](https://docs.sentry.io/)
- [Sentry JavaScript SDK](https://docs.sentry.io/platforms/javascript/)
- [Sentry Support](https://sentry.io/support/)

For implementation questions, check the `public/js/sentry-init.js` file for the complete implementation.

