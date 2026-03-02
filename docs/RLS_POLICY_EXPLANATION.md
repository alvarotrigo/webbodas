# RLS (Row Level Security) Policies for Users Table

## 🤔 Do You Need RLS Policies?

**YES, you should create RLS policies** for the `users` table to:
- ✅ Secure user data
- ✅ Control who can read/write user records
- ✅ Follow Supabase best practices
- ✅ Prevent unauthorized access

---

## 📋 What Are RLS Policies?

**Row Level Security (RLS)** is a Supabase feature that:
- Controls access to individual rows in a table
- Works at the database level (more secure than application-level checks)
- Uses policies to define who can do what

**Without RLS:**
- Anyone with the API key can access all data
- No row-level restrictions

**With RLS:**
- You define exactly who can read/write which rows
- More secure and granular control

---

## 🔐 Recommended RLS Policies for Users Table

### Policy 1: Service Role (Backend) - Full Access
**Purpose:** Allow backend operations (webhooks, auth handler) to read/write all user data

```sql
CREATE POLICY "Service role can do everything on users"
ON users
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
```

**What it does:**
- ✅ Backend can read all users
- ✅ Backend can create/update/delete users
- ✅ Used by: `auth-handler.php`, webhook handlers

---

### Policy 2: Anon Role (Frontend) - Read All
**Purpose:** Allow frontend to query user data when using service key

```sql
CREATE POLICY "Anon can read all users"
ON users
FOR SELECT
TO anon
USING (true);
```

**What it does:**
- ✅ Frontend can read all users (when using service key)
- ❌ Frontend cannot create/update/delete users
- ⚠️ **Note:** This is the same pattern as your other tables

---

### Policy 3 (OPTIONAL): Users Can Only Read Their Own Data
**Purpose:** Restrict users to only see their own user record

```sql
CREATE POLICY "Users can read own data"
ON users
FOR SELECT
TO authenticated
USING (auth.uid()::text = clerk_user_id);
```

**What it does:**
- ✅ Users can only read their own user record
- ❌ Users cannot see other users' data
- ⚠️ **Note:** Requires Clerk JWT to be passed to Supabase

---

## 🎯 Which Policies Should You Use?

### Option 1: Simple (Recommended for Now)
**Use Policies 1 & 2** (same as your other tables)
- ✅ Simple and consistent
- ✅ Works with your current setup
- ✅ Backend has full access
- ✅ Frontend can read (with service key)

**When to use:**
- You're using service key for all operations
- You don't need user-specific restrictions
- You want consistency with other tables

---

### Option 2: Secure (For Production)
**Use Policies 1 & 3** (restrictive)
- ✅ More secure
- ✅ Users can only see their own data
- ⚠️ Requires Clerk JWT integration with Supabase

**When to use:**
- You want maximum security
- You're passing Clerk JWT to Supabase
- You want users to only access their own data

---

## 📝 How to Create RLS Policies

### Method 1: Using Supabase Dashboard
1. Go to Supabase Dashboard → Table Editor
2. Select `users` table
3. Click "Policies" tab
4. Click "New Policy"
5. Choose policy type and configure
6. Save

### Method 2: Using SQL Editor
1. Go to Supabase Dashboard → SQL Editor
2. Run the SQL script: `migrations/add_users_rls_policies.sql`
3. Verify policies are created

### Method 3: Using Migration Script
```bash
# Run the migration script
psql -h your-supabase-host -U postgres -d postgres -f migrations/add_users_rls_policies.sql
```

---

## 🔍 Current Setup Analysis

Looking at your existing tables:
- ✅ `subscriptions` - Has RLS with service_role (full) + anon (read)
- ✅ `users` - Has RLS with service_role (full) + anon (read)

**Recommendation:** Use the same pattern for `users` table:
- Service role: Full access
- Anon role: Read-only access

---

## ⚠️ Important Notes

### 1. Service Key vs Anon Key
- **Service key:** Bypasses RLS (has full access)
- **Anon key:** Subject to RLS policies
- Your backend uses **service key**, so it has full access regardless of policies

### 2. RLS is Enabled by Default
- When you create a table in Supabase, RLS is **disabled** by default
- You need to **enable RLS** and **create policies** to allow access

### 3. Without Policies
- If RLS is enabled but no policies exist:
  - ❌ No one can access the table (not even service role)
  - You must create at least one policy

---

## ✅ Quick Start

**For your current setup, run this SQL:**

```sql
-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Service role: Full access
CREATE POLICY "Service role can do everything on users"
ON users FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Anon role: Read-only
CREATE POLICY "Anon can read all users"
ON users FOR SELECT TO anon USING (true);
```

This matches your existing table patterns and will work with your current code!

---

## 🧪 Testing RLS Policies

After creating policies, test:

1. **Backend access (should work):**
   ```php
   // This should work - uses service key
   $supabase->select('users', '*', ['clerk_user_id' => 'test']);
   ```

2. **Frontend access (should work with service key):**
   ```javascript
   // This should work - uses service key
   const { data } = await supabase.from('users').select('*');
   ```

3. **Unauthorized access (should fail):**
   ```javascript
   // This should fail - uses anon key without proper auth
   const { data } = await supabase.from('users').insert({...});
   ```

---

## 📚 Additional Resources

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [RLS Policy Examples](https://supabase.com/docs/guides/auth/row-level-security#policy-examples)
- [Service Role vs Anon Role](https://supabase.com/docs/guides/auth/row-level-security#service-role)

