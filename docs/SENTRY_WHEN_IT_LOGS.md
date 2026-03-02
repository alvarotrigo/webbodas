# When Does Sentry Create Logs?

## 🤖 AUTOMATIC (No code needed)

Sentry **automatically** captures these **without** any manual logging:

### ✅ Uncaught JavaScript Errors
```javascript
// Automatically captured by Sentry
function doSomething() {
  someUndefinedFunction();  // ReferenceError - CAPTURED
}
```

### ✅ Unhandled Promise Rejections
```javascript
// Automatically captured by Sentry
fetch('/api/data')
  .then(res => res.json());
  // If this fails and no .catch() - CAPTURED
```

### ✅ Async Function Errors (Unhandled)
```javascript
// Automatically captured by Sentry
async function loadData() {
  throw new Error('Failed');  // If not caught - CAPTURED
}
loadData(); // No try/catch - CAPTURED
```

---

## 📝 MANUAL (Requires SentryLogger)

These are **NOT automatically captured** - you must use `SentryLogger`:

### ❌ console.error() - NOT Captured
```javascript
// NOT sent to Sentry
console.error('Something went wrong');

// To capture, use:
SentryLogger.error('Something went wrong', error, { context });
```

### ❌ console.warn() - NOT Captured
```javascript
// NOT sent to Sentry
console.warn('API is slow');

// To capture, use:
SentryLogger.warn('API is slow', { duration: 3000 });
```

### ❌ Caught Errors in try/catch - NOT Captured
```javascript
// NOT sent to Sentry (it's caught!)
try {
  await saveData();
} catch (error) {
  console.error(error);  // NOT captured
}

// To capture, use:
try {
  await saveData();
} catch (error) {
  SentryLogger.error('Save failed', error, { userId: 123 });  // CAPTURED
  throw error;
}
```

### ❌ User Actions - NOT Captured
```javascript
// To track user actions, use:
button.addEventListener('click', () => {
  SentryLogger.track('Button Clicked', { button: 'export' });
});
```

---

## 🎯 Quick Reference Table

| Event Type | Automatic? | Example | How to Capture |
|------------|-----------|---------|----------------|
| **Uncaught Error** | ✅ YES | `undefinedFunc()` | Automatic |
| **Unhandled Promise** | ✅ YES | `Promise.reject()` | Automatic |
| **Async Error (uncaught)** | ✅ YES | `async () => throw` | Automatic |
| **console.error()** | ❌ NO | `console.error('msg')` | `SentryLogger.error()` |
| **console.warn()** | ❌ NO | `console.warn('msg')` | `SentryLogger.warn()` |
| **Caught Error** | ❌ NO | `try/catch` | `SentryLogger.error()` |
| **User Actions** | ❌ NO | Button clicks | `SentryLogger.track()` |
| **Custom Events** | ❌ NO | State changes | `SentryLogger.info()` |

---

## 💡 Best Practice

### ✅ Good Pattern (Error is caught AND logged)
```javascript
try {
  await saveProject(data);
} catch (error) {
  // Log to Sentry with context
  SentryLogger.error('Failed to save project', error, {
    projectId: data.id,
    sectionCount: data.sections.length
  });
  
  // Show user-friendly message
  alert('Failed to save. Please try again.');
  throw error;
}
```

### ❌ Bad Pattern (Error is caught but NOT logged)
```javascript
try {
  await saveProject(data);
} catch (error) {
  console.error('Save failed', error);  // NOT sent to Sentry!
  alert('Failed to save');
}
```

---

## 🧪 How to Test

1. **Open test page**: `test-sentry.html`
2. **Open browser console**: Press F12
3. **Open Sentry dashboard**: https://sentry.io
4. **Click test buttons** and watch what gets captured!

---

## 📊 Summary

### Sentry Automatically Captures:
- Uncaught errors that crash your code
- Unhandled promise rejections
- Async errors that aren't caught

### You Must Manually Log:
- Errors you catch in try/catch
- Warnings and info messages
- User actions and events
- console.error/warn/log messages

**Think of it this way:** 
- Sentry catches things that would **break your app**
- You log things you **want to know about** but don't break the app



