# RLS Troubleshooting Guide

## ❓ Will RLS Policies Interfere with Inserting Data?

**Short Answer: NO, if policies are set up correctly.**

**Long Answer:**
- ✅ **Service role key** (used by your backend) **bypasses RLS** when policies allow it
- ✅ The policies I provided **allow service role full access** (including INSERT)
- ⚠️ **If RLS is enabled but NO policies exist**, it will block ALL access (even service role)
- ⚠️ **If RLS is enabled with wrong policies**, it might block inserts

---

## 🔍 Why Your User Record Isn't Appearing

### Most Likely Causes:

1. **RLS is enabled but no policies exist** (most common)
   - RLS is enabled on the table
   - But no policies have been created yet
   - **Result:** All access is blocked (even service role)

2. **Error is being caught silently**
   - The code catches exceptions but doesn't fail authentication
   - Check error logs for "Error creating/updating user"

3. **Table doesn't exist yet**
   - The `users` table hasn't been created in Supabase

---

## ✅ Solution: Create RLS Policies

### Step 1: Check if RLS is Enabled

Run this in Supabase SQL Editor:
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'users';
```

If `rowsecurity = true` but no policies exist, that's your problem!

### Step 2: Create the Policies

Run this SQL in Supabase SQL Editor:
```sql
-- Enable RLS (if not already enabled)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Service role: Full access (allows backend to insert/update/delete)
DROP POLICY IF EXISTS "Service role can do everything on users" ON users;
CREATE POLICY "Service role can do everything on users"
ON users FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Anon role: Read-only (allows frontend to read with service key)
DROP POLICY IF EXISTS "Anon can read all users" ON users;
CREATE POLICY "Anon can read all users"
ON users FOR SELECT TO anon USING (true);
```

### Step 3: Verify Policies Exist

```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'users';
```

You should see 2 policies:
1. "Service role can do everything on users"
2. "Anon can read all users"

---

## 🧪 Testing After Creating Policies

### Test 1: Check Error Logs
```bash
tail -f debug/php_errors.log
```

Then sign in again and look for:
- "Creating new user: ..." (should appear)
- "Error creating/updating user: ..." (should NOT appear)

### Test 2: Check Supabase Table
1. Go to Supabase Dashboard → Table Editor
2. Select `users` table
3. You should see your user record

### Test 3: Manual Insert Test
Run this in Supabase SQL Editor (should work):
```sql
INSERT INTO users (clerk_user_id, email, is_pro, created_at, updated_at)
VALUES ('test_user_123', 'test@example.com', false, NOW(), NOW());
```

If this fails, RLS policies aren't set up correctly.

---

## 🔧 Quick Fix Script

Run this complete script in Supabase SQL Editor:

```sql
-- Step 1: Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop existing policies (if any)
DROP POLICY IF EXISTS "Service role can do everything on users" ON users;
DROP POLICY IF EXISTS "Anon can read all users" ON users;

-- Step 3: Create service role policy (allows backend to do everything)
CREATE POLICY "Service role can do everything on users"
ON users FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Step 4: Create anon role policy (allows frontend to read)
CREATE POLICY "Anon can read all users"
ON users FOR SELECT TO anon USING (true);

-- Step 5: Verify policies
SELECT policyname, cmd, roles FROM pg_policies WHERE tablename = 'users';
```

---

## 📊 Understanding RLS Behavior

### Without RLS:
- ✅ Anyone with API key can access all data
- ❌ No security

### With RLS but NO policies:
- ❌ **ALL access blocked** (even service role)
- ❌ This is likely your current situation!

### With RLS and correct policies:
- ✅ Service role: Full access (INSERT, UPDATE, DELETE, SELECT)
- ✅ Anon role: Read-only (SELECT only)
- ✅ Your backend code will work perfectly

---

## 🎯 Key Points

1. **Service role key bypasses RLS** - but only if policies allow it
2. **If RLS is enabled but no policies exist** - everything is blocked
3. **The policies I provided allow service role full access** - so inserts will work
4. **Your backend uses service role key** - so it will have full access once policies are created

---

## 🚨 Common Mistakes

1. **Enabling RLS but forgetting to create policies**
   - Result: Everything blocked
   - Fix: Create policies

2. **Creating policies for wrong role**
   - Result: Backend can't insert
   - Fix: Make sure service_role policy exists

3. **Not using service role key**
   - Result: Subject to RLS restrictions
   - Fix: Your code already uses service role key (good!)

---

## ✅ After Creating Policies

1. **Sign in again** - User record should be created
2. **Check Supabase table** - Should see your user
3. **Check error logs** - Should see "Creating new user" message
4. **No more errors** - Everything should work!

