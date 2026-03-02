# Database Structure - Summary & Key Points

**Last Updated:** November 19, 2025

## 📊 Quick Overview

**Total Tables:** 4
- `users` - User accounts with pro status
- `subscriptions` - LemonSqueezy subscription data  
- `editor_pages` - Anonymous/shared page configurations
- `user_pages` - User-owned page drafts (replaces localStorage)

**Total Functions:** 1
- `update_updated_at_column()` - Auto-update timestamp trigger function

---

## 🗂️ Table Summary

### 1. `users` Table
**Stores:** All logged-in users (paying and non-paying)  
**Primary Key:** `id` (BIGSERIAL)  
**Unique Identifier:** `clerk_user_id` (VARCHAR(255))  
**RLS:** ✅ Enabled with policies

**Key Fields:**
- `clerk_user_id` - Unique Clerk user ID
- `email` - User's email
- `is_pro` - Boolean for subscription status
- `subscription_id` - Links to LemonSqueezy subscription
- `pro_status_source` - 'lemonsqueezy' or 'legacy'

---

### 2. `subscriptions` Table
**Stores:** LemonSqueezy webhook subscription data  
**Primary Key:** `id` (BIGSERIAL)  
**Unique Identifier:** `subscription_id` (VARCHAR)  
**RLS:** ⚠️ NOT enabled

**Key Fields:**
- `subscription_id` - Unique LemonSqueezy subscription ID
- `user_id` - Foreign key to `users.id` (BIGINT)
- `customer_id` - LemonSqueezy customer ID
- `customer_email` - Customer email
- `status` - active, cancelled, expired, paused, past_due
- Payment info (card_brand, card_last_four)
- Dates (renews_at, ends_at, trial_ends_at)

---

### 3. `editor_pages` Table
**Stores:** Anonymous/shared page configurations  
**Primary Key:** `id` (UUID)  
**RLS:** ✅ Enabled (public can read & insert)

**Key Fields:**
- `id` - UUID primary key
- `data` - JSONB with page configuration
- `created_at` - Timestamp

---

### 4. `user_pages` Table
**Stores:** User-owned page drafts (replaces localStorage)  
**Primary Key:** `id` (UUID)  
**RLS:** ✅ Enabled with user-based policies

**Key Fields:**
- `id` - UUID primary key
- `user_id` - Foreign key to users
- `title` - Page title
- `data` - JSONB with full page state (sections, theme, animations, etc.)
- `is_favorite` - Favorite flag
- `is_public` - Public sharing flag
- `share_token` - Unique token for sharing
- `last_accessed` - Last access timestamp
- `thumbnail_url` - Optional thumbnail

---

## 🔗 Key Relationships

### Users ↔ Subscriptions (Dual Linking)

**Method 1: Foreign Key (Proper Relational)**
```
users.id ← subscriptions.user_id (FOREIGN KEY)
```
- Proper database constraint
- Enables JOINs for complex queries
- One user can have multiple subscriptions

**Method 2: String Reference (Fast Lookup)**
```
users.subscription_id → subscriptions.subscription_id (String match)
```
- No FK constraint (just a value match)
- Enables quick single-subscription lookups without JOINs
- Stored as string in both tables

### Users ↔ User Pages (One-to-Many)

```
users.id ← user_pages.user_id (FOREIGN KEY, ON DELETE CASCADE)
```
- One user can have many saved pages
- Pages deleted when user deleted
- Indexed for fast queries

---

## ❓ Common Questions Answered

### Q: How do we check if a user is pro?
**A:** Query `users` table by `clerk_user_id` or `email` and check `is_pro` field.
- Fast lookup (indexed)
- No JOIN needed
- `is_pro` is updated by webhooks when subscription status changes

### Q: Do we have customer_id from LemonSqueezy?
**A:** ✅ YES - Stored in `subscriptions.customer_id`
- Indexed for fast lookups
- Useful for linking multiple subscriptions to same customer

### Q: Can we link subscriptions to users?
**A:** ✅ YES - Two ways:
1. Via `subscriptions.user_id` → `users.id` (foreign key)
2. Via `subscriptions.subscription_id` ↔ `users.subscription_id` (string match)

### Q: Are triggers active for auto-updating `updated_at`?
**A:** ❌ NO - The function exists but triggers are NOT created
- Must manually update `updated_at` in application code
- Or create triggers to enable auto-updating

### Q: Is the subscriptions table protected by RLS?
**A:** ❌ NO - RLS is not enabled on `subscriptions`
- Users table: Protected ✅
- Subscriptions table: Unprotected ⚠️
- Editor pages: Public access ⚠️

---

## 🔒 Security Status

| Table | RLS Enabled | Policies | Status |
|-------|-------------|----------|--------|
| `users` | ✅ Yes | Service role (all), Anon (read) | Protected |
| `subscriptions` | ❌ No | None | Unprotected |
| `editor_pages` | ✅ Yes | Public (read, insert) | Open Access |
| `user_pages` | ✅ Yes | User-based (CRUD on own pages) | Protected |

---

## 📈 Performance Features

### Indexes on `users`:
- `clerk_user_id` (unique) - Fast auth lookups
- `email` - Email-based queries
- `is_pro` - Filter pro users

### Indexes on `subscriptions`:
- `subscription_id` (unique) - Fast subscription lookups
- `user_id` - Fast JOINs with users
- `customer_id` - Customer-based queries

### Indexes on `editor_pages`:
- `id` (primary key) - Fast UUID lookups

### Indexes on `user_pages`:
- `id` (primary key) - Fast UUID lookups
- `user_id` - Fast user page queries
- `(user_id, last_accessed DESC)` - Recent pages
- `share_token` (partial, where public) - Shared pages
- `(user_id, is_favorite)` (partial) - Favorite pages
- `data->'theme'` (GIN) - Theme-based queries

---

## 🚀 Current Flow

### When a user subscribes:
1. User completes checkout on LemonSqueezy
2. LemonSqueezy sends webhook to backend
3. Webhook saves subscription to `subscriptions` table
4. If user exists (via email match), updates `users.subscription_id` and `users.is_pro = true`
5. If `user_id` is available, also sets `subscriptions.user_id` foreign key

### When checking if user is "pro":
1. Frontend sends `clerk_user_id` to backend
2. Backend queries `users` table by `clerk_user_id`
3. Returns `is_pro` field directly (fast, no JOIN)
4. Optionally verifies subscription status in `subscriptions` table

---

## ⚠️ Known Issues & Recommendations

### 1. Missing RLS on subscriptions
**Issue:** Anyone with database access can read/modify subscriptions  
**Recommendation:** Enable RLS and add policies:
```sql
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage subscriptions"
ON subscriptions FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Anon can read subscriptions"
ON subscriptions FOR SELECT TO anon
USING (true);
```

### 2. No active triggers
**Issue:** `updated_at` columns don't auto-update  
**Recommendation:** Create triggers on `users` and `subscriptions` tables

### 3. Public write access to editor_pages
**Issue:** Anyone can insert records to `editor_pages`  
**Impact:** Depends on use case - might be intentional for anonymous editing

---

## 📝 Quick Reference

**To add a new user:**
```sql
INSERT INTO users (clerk_user_id, email, name, is_pro)
VALUES ('user_xxx', 'user@example.com', 'John Doe', false);
```

**To check user's pro status:**
```sql
SELECT is_pro, subscription_id FROM users WHERE clerk_user_id = 'user_xxx';
```

**To get user with their active subscription:**
```sql
SELECT u.*, s.status, s.renews_at
FROM users u
LEFT JOIN subscriptions s ON u.id = s.user_id
WHERE u.clerk_user_id = 'user_xxx'
AND s.status = 'active';
```

**To save an anonymous/shared page:**
```sql
INSERT INTO editor_pages (data)
VALUES ('{"sections": [], "theme": {}}'::jsonb)
RETURNING id;
```

**To save a user's page:**
```sql
INSERT INTO user_pages (user_id, title, data)
VALUES (123, 'My Homepage', '{"sections": [], "theme": {}}'::jsonb)
RETURNING id, share_token;
```

**To load user's recent pages:**
```sql
SELECT id, title, last_accessed, is_favorite
FROM user_pages
WHERE user_id = 123
ORDER BY last_accessed DESC
LIMIT 20;
```

**To load a shared user page:**
```sql
SELECT * FROM user_pages
WHERE share_token = 'uuid-here' AND is_public = TRUE;
```
