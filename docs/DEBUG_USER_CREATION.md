# Debugging User Creation Issue

## ✅ What We Know

1. **The function works** - Test script successfully created a user
2. **RLS policies are correct** - Service role has full access
3. **Frontend code looks correct** - It's sending `clerk_user_id`

## 🔍 Debugging Steps

### Step 1: Check Error Logs After Signing In

After signing in, immediately check the error logs:

```bash
tail -50 debug/php_errors.log | grep -i "auth\|user\|clerk\|creating\|updating"
```

**Look for these messages:**
- ✅ `"Auth handler - clerk_user_id: ..."` - Shows if clerk_user_id is received
- ✅ `"Calling createOrUpdateUser with: ..."` - Shows if function is called
- ✅ `"Creating new user: ..."` - Shows if insert is attempted
- ⚠️ `"WARNING: clerk_user_id is NULL or empty"` - Means frontend isn't sending it
- ❌ `"Error creating/updating user record: ..."` - Shows any errors

### Step 2: Check Browser Console

Open browser DevTools → Console and look for:
- Any errors when calling `api/auth-handler.php`
- The request payload being sent
- The response from the server

### Step 3: Check Network Tab

1. Open DevTools → Network tab
2. Sign in
3. Find the request to `api/auth-handler.php`
4. Check:
   - **Request Payload** - Does it include `clerk_user_id`?
   - **Response** - What does the server return?

### Step 4: Manual Test

Run this test script to verify the function works:

```bash
php test-user-insert.php
```

If this works, the issue is in the authentication flow, not the function itself.

## 🎯 Common Issues

### Issue 1: clerk_user_id is NULL
**Symptom:** Log shows "WARNING: clerk_user_id is NULL or empty"

**Cause:** Frontend isn't sending `clerk_user_id` correctly

**Fix:** Check if `clerkUser.id` exists in the frontend code

### Issue 2: Error is being caught silently
**Symptom:** No logs at all, or error logs show exception

**Cause:** Exception is caught but not logged properly

**Fix:** Check error logs for full exception details

### Issue 3: RLS blocking access
**Symptom:** Error logs show "Supabase error (401)" or "row-level security policy"

**Cause:** RLS policies not set up correctly

**Fix:** Run the RLS migration script again

## 🔧 Quick Fixes

### Fix 1: Verify RLS Policies

Run this in Supabase SQL Editor:

```sql
-- Check if policies exist
SELECT policyname, cmd, roles 
FROM pg_policies 
WHERE tablename = 'users';

-- If no policies, create them:
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can do everything on users"
ON users FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Anon can read all users"
ON users FOR SELECT TO anon USING (true);
```

### Fix 2: Add More Debugging

The auth handler now logs:
- When it receives clerk_user_id
- When it calls createOrUpdateUser
- Any errors that occur

Check the logs after signing in to see what's happening.

### Fix 3: Test Directly

Run the test script to verify everything works:

```bash
php test-user-insert.php
```

If this works, the issue is in the authentication flow.

## 📊 Expected Log Output

When everything works correctly, you should see:

```
[timestamp] Auth handler - clerk_user_id: user_abc123, email: user@example.com
[timestamp] Calling createOrUpdateUser with: clerk_user_id=user_abc123, email=user@example.com, is_pro=false
[timestamp] Creating new user: user_abc123 (user@example.com), is_pro: false
[timestamp] User created successfully: [{"id":1,...}]
[timestamp] createOrUpdateUser completed successfully
```

## 🚨 If Still Not Working

1. **Check Supabase table directly:**
   ```sql
   SELECT * FROM users ORDER BY created_at DESC LIMIT 5;
   ```

2. **Check if user exists but with different clerk_user_id:**
   ```sql
   SELECT * FROM users WHERE email = 'your-email@example.com';
   ```

3. **Try manual insert:**
   ```sql
   INSERT INTO users (clerk_user_id, email, is_pro, created_at, updated_at)
   VALUES ('test_manual', 'test@example.com', false, NOW(), NOW());
   ```

If manual insert works, the issue is in the PHP code.
If manual insert fails, the issue is with RLS policies.

