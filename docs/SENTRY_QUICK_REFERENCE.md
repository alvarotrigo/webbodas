# Sentry Quick Reference Guide

## 🎯 Quick Start

Sentry is now integrated and ready to use! Just open your browser console and test it:

```javascript
// Test error tracking
SentryDebug.testError();

// Check configuration
SentryDebug.showConfig();
```

## 📝 Logging Methods

### Information
```javascript
SentryLogger.info('User action completed', { action: 'save' });
```

### Warning
```javascript
SentryLogger.warn('Slow API response', { duration: 3000 });
```

### Error
```javascript
SentryLogger.error('Failed to save', error, { projectId: 123 });
```

### Critical
```javascript
SentryLogger.critical('Database down', error, { impact: 'high' });
```

## 🎬 Track User Actions

```javascript
SentryLogger.track('Button Clicked', { 
  button: 'export',
  format: 'html' 
});
```

## 👤 User Context

```javascript
// Set user (done automatically with Clerk)
SentryLogger.setUser({ id: '123', email: 'user@example.com' });

// Clear user on logout
SentryLogger.clearUser();
```

## 🍞 Breadcrumbs

```javascript
SentryLogger.addBreadcrumb(
  'api',
  'Fetching data',
  'info',
  { endpoint: '/api/save' }
);
```

## 📊 What's Integrated

✅ **index.html** - Main page  
✅ **app.php** - Editor  
✅ **preview.html** - Preview page  
✅ **auth-wall.html** - Auth page  

## 🔧 Files Created

- `public/js/sentry-init.js` - Initialization & utilities
- `public/js/sentry-examples.js` - Integration examples
- `README_SENTRY_SETUP.md` - Complete documentation
- `SENTRY_QUICK_REFERENCE.md` - This file

## 📖 Full Documentation

See `README_SENTRY_SETUP.md` for:
- Complete usage guide
- Integration examples
- Best practices
- Troubleshooting

## 🧪 Testing

1. Open any page with Sentry integrated
2. Open browser console
3. Run: `SentryDebug.testError()`
4. Check your [Sentry Dashboard](https://sentry.io)

## 🚀 Common Patterns

### API Calls
```javascript
try {
  const data = await fetch('/api/endpoint');
  SentryLogger.info('API call successful');
} catch (error) {
  SentryLogger.error('API failed', error, { endpoint });
}
```

### Feature Tracking
```javascript
function exportPage() {
  SentryLogger.track('Export Started', { format: 'html' });
  // ... export logic
  SentryLogger.track('Export Completed');
}
```

### Image Uploads
```javascript
try {
  SentryLogger.info('Upload started', { filename: file.name });
  const result = await upload(file);
  SentryLogger.track('Upload Complete', { id: result.id });
} catch (error) {
  SentryLogger.error('Upload failed', error, { filename });
}
```

## 🎨 Log Levels Guide

| Level | Use For | Example |
|-------|---------|---------|
| **info** | Normal operations | "User saved project" |
| **warn** | Recoverable issues | "API slow response" |
| **error** | Failed operations | "Save failed" |
| **critical** | System failures | "Database unreachable" |

## 🔍 View Errors

Access your Sentry dashboard: **https://sentry.io**

Filter by:
- Environment (development/production)
- User
- Time range
- Error type

## 💡 Pro Tips

1. **Always include context** - Add relevant data to every log
2. **Track user actions** - Helps understand user behavior
3. **Use breadcrumbs** - They show the path to an error
4. **Don't log secrets** - Never log passwords or API keys
5. **Clear user on logout** - Use `SentryLogger.clearUser()`

## 🆘 Troubleshooting

**Errors not appearing?**
- Check Sentry dashboard environment filter
- Run `SentryDebug.showConfig()` to verify setup
- Check browser console for Sentry errors

**User context not set?**
- Ensure Clerk loads before setting user
- Manually set: `SentryLogger.setUser({ id, email })`

---

**Need help?** Check `README_SENTRY_SETUP.md` for complete documentation.

