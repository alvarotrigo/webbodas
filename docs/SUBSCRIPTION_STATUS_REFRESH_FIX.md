# Subscription Status Refresh Fix

## Problem

Users were seeing lock icons on PRO sections and being shown the upgrade modal even after subscribing to a paid plan. This occurred when:

1. A user logged in after several days
2. Their PHP session persisted with old cached data
3. The system returned stale session data without checking the database for updated subscription status

## Root Cause

In `includes/clerk-auth.php`, the `syncClerkSession()` function had an optimization that would return cached session data if:
- An existing session was found
- The session had an avatar URL

```php
$existing = clerk_session_user_payload();
if ($existing && !empty($existing['avatar_url'])) {
    return $existing;  // ❌ Returns stale data without checking database
}
```

This meant that if a user's session persisted across multiple days and they subscribed during that time, the system would never re-check the database to get their updated subscription status.

## Solution

### 1. Periodic Subscription Status Refresh (Server-Side)

**File**: `includes/clerk-auth.php`

Added periodic refresh logic that re-checks subscription status every 5 minutes:

```php
// Check if we should force a refresh of the paid status
// Refresh every 5 minutes to ensure subscription status is up-to-date
$lastSync = $_SESSION['clerk_last_sync'] ?? 0;
$syncInterval = 300; // 5 minutes in seconds
$shouldRefresh = (time() - $lastSync) > $syncInterval;

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
    
    return $existing;
}
```

**Benefits**:
- Ensures subscription status is always fresh (max 5 minutes old)
- Lightweight check that only queries the database when needed
- Works automatically for all pages that use `syncClerkSession()`

### 2. Sync Server Data to localStorage (Client-Side)

**File**: `app.php`

When the page loads with server authentication data, we now update localStorage with the fresh server data:

```javascript
// Update localStorage with fresh server data to ensure consistency
localStorage.setItem('isAuthenticated', 'true');
localStorage.setItem('editorMode', serverUserData.mode || 'authenticated');
localStorage.setItem('isPaid', serverUserData.is_paid ? 'true' : 'false');
localStorage.setItem('userEmail', serverUserData.email || '');
if (serverUserData.name) {
    localStorage.setItem('userName', serverUserData.name);
}
if (serverUserData.avatar_url) {
    localStorage.setItem('userAvatar', serverUserData.avatar_url);
}

console.log('Updated localStorage with server data - isPaid:', serverUserData.is_paid, 'mode:', serverUserData.mode);
```

**Benefits**:
- Ensures localStorage matches the server state
- Prevents stale localStorage data from conflicting with server data
- Provides consistent user experience across page reloads

### 3. Update UI Immediately After Data Sync

**File**: `app.php`

Call `updateUserInterface()` after syncing data to ensure all UI elements are updated:

```javascript
// Update UI (including PRO badge and section visibility) after DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (typeof updateUserInterface === 'function') {
            console.log('Calling updateUserInterface on DOMContentLoaded with mode:', editorMode);
            updateUserInterface();
        }
    });
} else {
    // DOM already ready, update immediately
    setTimeout(() => {
        if (typeof updateUserInterface === 'function') {
            console.log('Calling updateUserInterface immediately with mode:', editorMode);
            updateUserInterface();
        }
    }, 100);
}
```

**Benefits**:
- Ensures PRO badge is shown/hidden correctly
- Updates lock icons on sections
- Applies correct access permissions immediately

### 4. Dynamic PRO Badge Creation

**File**: `app.php`

Enhanced the `updateUserInterface()` function to create the PRO badge dynamically if it doesn't exist:

```javascript
// Handle PRO badge - create if it doesn't exist and user is paid
if (editorMode === 'paid') {
    if (clerkProBadge) {
        clerkProBadge.style.display = 'inline-block';
    } else if (serverUserDisplay) {
        // Create PRO badge if it doesn't exist
        const badge = document.createElement('span');
        badge.className = 'pro-badge';
        badge.id = 'clerk-pro-badge';
        badge.textContent = 'PRO';
        serverUserDisplay.appendChild(badge);
        console.log('Created PRO badge dynamically');
    }
} else if (clerkProBadge) {
    clerkProBadge.style.display = 'none';
}
```

**Benefits**:
- Handles the case where the page was initially rendered without the PRO badge
- Creates the badge dynamically when subscription status is updated
- Provides immediate visual feedback to paid users

## Testing

To test these changes:

1. **Test automatic refresh**:
   - Log in as a user
   - Wait 5+ minutes
   - Reload the page
   - Check console for "Refreshing paid status" log
   - Verify subscription status is current

2. **Test localStorage sync**:
   - Log in as a paid user
   - Check localStorage to verify `isPaid: 'true'` and `editorMode: 'paid'`
   - Clear localStorage
   - Reload page
   - Verify localStorage is repopulated with correct values

3. **Test UI updates**:
   - Log in as a paid user
   - Verify PRO badge is visible
   - Verify no lock icons on PRO sections
   - Verify no upgrade modal is shown

4. **Test dynamic badge creation**:
   - Inspect the DOM and remove the PRO badge element
   - Update `editorMode` to 'paid' in console
   - Call `updateUserInterface()`
   - Verify PRO badge is recreated

## Impact

These changes ensure that:
- ✅ Subscription status is always fresh (max 5 minutes old)
- ✅ Users see their correct access level immediately
- ✅ PRO sections are accessible to paid users
- ✅ Upgrade modal is only shown to non-paid users
- ✅ PRO badge is displayed correctly for paid users
- ✅ No manual logout/login required to refresh status

## Performance

The periodic refresh check is lightweight:
- Only runs every 5 minutes (not on every request)
- Only queries the database when the sync interval has passed
- Reuses existing session validation logic
- No additional HTTP requests from client-side

## Backwards Compatibility

These changes are fully backwards compatible:
- Existing sessions continue to work
- No database migrations required
- No changes to authentication flow
- Falls back gracefully if checks fail


