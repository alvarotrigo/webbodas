# Database Structure Explanation

**Last Updated:** November 19, 2025

## Overview

This document provides a detailed explanation of how our database is structured, why certain design decisions were made, and how the tables relate to each other.

---

## Current Database Tables

### 1. `users` Table
**Purpose:** Stores all logged-in users (paying and non-paying) with pro status

**What it stores:**
- ✅ `clerk_user_id` - Unique Clerk authentication ID
- ✅ `email` - User's email address
- ✅ `name` - User's name
- ✅ `is_pro` - Boolean flag for subscription status
- ✅ `pro_status_source` - Source of pro status ('lemonsqueezy' or 'legacy')
- ✅ `subscription_id` - String reference to LemonSqueezy subscription
- ✅ `last_login` - Last login timestamp
- ✅ Timestamps (created_at, updated_at)

**Key Design Points:**
- Uses `clerk_user_id` as the unique identifier (not email)
- Stores `is_pro` directly for fast lookups without JOINs
- Maintains `subscription_id` as a string for quick reference
- Has proper indexes on all frequently queried columns

**Security:**
- ✅ RLS enabled
- ✅ Service role has full access
- ✅ Anonymous role can read (for frontend queries with service key)

---

### 2. `subscriptions` Table
**Purpose:** Stores subscription data from LemonSqueezy webhooks

**What it stores:**
- ✅ `subscription_id` - Unique LemonSqueezy subscription ID
- ✅ `user_id` - Foreign key linking to `users.id` (BIGINT)
- ✅ `customer_id` - LemonSqueezy customer ID
- ✅ `customer_email` - Customer's email address
- ✅ `customer_name` - Customer's name
- ✅ Product info (product_id, product_name, variant_id, variant_name)
- ✅ Status info (status, status_formatted)
- ✅ Payment info (card_brand, card_last_four)
- ✅ Dates (renews_at, ends_at, trial_ends_at, created_at, updated_at)

**Key Design Points:**
- Has a proper foreign key `user_id` → `users.id`
- Also maintains `customer_id` for LemonSqueezy customer tracking
- Stores all webhook data for debugging and audit trail
- Indexed on `user_id` for fast JOINs
- Indexed on `customer_id` for customer-based queries

**Security:**
- ⚠️ RLS is NOT enabled
- This means backend must handle all access control in application code
- Should consider enabling RLS for additional security layer

---

### 3. `editor_pages` Table
**Purpose:** Stores anonymous/shared editor page configurations as JSON

**What it stores:**
- ✅ `id` - UUID primary key (auto-generated)
- ✅ `data` - JSONB containing the complete page configuration
- ✅ `created_at` - Timestamp

**Key Design Points:**
- Uses UUID for globally unique IDs
- Stores entire page configuration as JSONB for flexibility
- No user_id link - pages are anonymous/public
- JSONB allows complex queries on the JSON structure if needed
- Used for quick sharing without authentication

**Security:**
- ✅ RLS enabled
- ✅ Public can SELECT (read any page)
- ✅ Public can INSERT (create new pages)
- ⚠️ No UPDATE or DELETE policies (intentional - immutable shares)

---

### 4. `user_pages` Table
**Purpose:** Stores user-owned page drafts with full state (replaces localStorage)

**What it stores:**
- ✅ `id` - UUID primary key (auto-generated)
- ✅ `user_id` - Foreign key to users table (owner)
- ✅ `title` - Page title for easy identification
- ✅ `data` - JSONB containing full page state (sections, theme, animations, history)
- ✅ `thumbnail_url` - Optional preview image
- ✅ `is_favorite` - Favorite flag for quick access
- ✅ `is_public` - Whether page is publicly shareable
- ✅ `share_token` - Unique token for sharing
- ✅ `last_accessed` - For sorting recent pages
- ✅ Timestamps (created_at, updated_at)

**Key Design Points:**
- **Replaces localStorage** for authenticated users
- Proper foreign key to users with CASCADE delete
- Hybrid approach: structured fields + JSONB for flexibility
- Share token allows converting private pages to public
- Indexed heavily for common query patterns
- GIN index on theme data for advanced queries
- Partial indexes for favorites and public pages (efficiency)

**Security:**
- ✅ RLS fully enabled
- ✅ Users can only see their own pages (or public ones)
- ✅ Full CRUD permissions on own pages
- ✅ Service role has full access
- ✅ ON DELETE CASCADE protects orphaned data

**Why This Design?**
- **Structured + JSONB**: Best of both worlds
  - Can query by title, user, date (fast)
  - Can store complex state without schema migrations
- **localStorage replacement**: 
  - No quota limits
  - Accessible from any device
  - Backed up automatically
  - Can sync across tabs
- **Sharing built-in**: 
  - Can convert private → public easily
  - Unique token prevents guessing
  - Only public pages exposed via token

---

## Relationships Explained

### Users ↔ Subscriptions: The Dual Linking Strategy

Our system uses **two different methods** to link users and subscriptions. This might seem redundant, but each serves a specific purpose:

#### Method 1: Foreign Key (`subscriptions.user_id` → `users.id`)
```sql
subscriptions.user_id REFERENCES users.id
```

**Purpose:** Proper relational database linking  
**Pros:**
- Enforced by database (referential integrity)
- Enables complex JOINs
- One user can have multiple subscriptions (historical data)
- Proper database normalization

**Use Cases:**
- Querying all subscriptions for a user
- Getting user details along with subscription info
- Historical subscription tracking
- Analytics and reporting

**Example Query:**
```sql
SELECT u.email, s.status, s.renews_at
FROM users u
INNER JOIN subscriptions s ON u.id = s.user_id
WHERE u.clerk_user_id = 'user_123';
```

#### Method 2: String Reference (`users.subscription_id` ↔ `subscriptions.subscription_id`)
```sql
users.subscription_id = subscriptions.subscription_id (string matching)
```

**Purpose:** Fast single-subscription lookups  
**Pros:**
- No JOIN required
- Faster for simple "is user pro?" checks
- Direct reference to active subscription
- Easier to query from frontend

**Use Cases:**
- Quick pro status checks
- Single active subscription reference
- Frontend queries without complex JOINs

**Example Query:**
```sql
SELECT is_pro, subscription_id FROM users WHERE clerk_user_id = 'user_123';
-- Then optionally fetch subscription details if needed
```

---

## Current Flow: How Everything Works Together

### 1. User Signs Up (No Payment)
```
1. User authenticates via Clerk
2. Clerk webhook triggers (or first login)
3. Backend creates record in `users` table:
   - clerk_user_id = "user_xxx"
   - email = "user@example.com"
   - is_pro = false
   - subscription_id = null
```

### 2. User Subscribes via LemonSqueezy
```
1. User clicks "Subscribe" and goes to LemonSqueezy checkout
2. Checkout URL includes clerk_user_id in custom_data
3. User completes payment
4. LemonSqueezy sends webhook to our backend
5. Webhook handler:
   a. Creates/updates record in `subscriptions` table
   b. Finds user by email or clerk_user_id
   c. Updates `users` table:
      - is_pro = true
      - subscription_id = "sub_xxx"
      - pro_status_source = "lemonsqueezy"
   d. Updates `subscriptions` table:
      - user_id = users.id (sets foreign key)
```

### 3. Frontend Checks Pro Status
```
1. User logs in, frontend gets clerk_user_id
2. Frontend calls API with clerk_user_id
3. Backend queries:
   SELECT is_pro FROM users WHERE clerk_user_id = ?
4. Returns true/false immediately (no JOIN needed)
```

### 4. Backend Needs Full Subscription Details
```
1. Backend has clerk_user_id
2. Query with JOIN:
   SELECT u.*, s.*
   FROM users u
   LEFT JOIN subscriptions s ON u.id = s.user_id
   WHERE u.clerk_user_id = ?
   AND s.status = 'active'
3. Gets all user + subscription data in one query
```

### 5. Webhook Updates Subscription Status
```
1. LemonSqueezy sends subscription_updated webhook
2. Backend updates `subscriptions` table with new status
3. If status = 'cancelled' or 'expired':
   - Updates `users.is_pro = false`
   - Keeps `users.subscription_id` for reference
```

### 6. User Saves a Page (Authenticated)
```
1. User designs a page in the editor
2. Auto-save triggers (or manual save)
3. Frontend sends page data to API with user_id
4. Backend saves to `user_pages`:
   INSERT INTO user_pages (user_id, title, data) VALUES (?, ?, ?)
   ON CONFLICT (id) DO UPDATE SET data = ?, last_accessed = NOW()
5. Returns UUID and share_token
```

### 7. User Shares a Page
```
1. User clicks "Share" on their saved page
2. Backend updates: SET is_public = TRUE
3. Returns share_token
4. Anyone with token can view via:
   SELECT * FROM user_pages WHERE share_token = ? AND is_public = TRUE
```

### 8. Anonymous User Saves a Page
```
1. Non-authenticated user designs a page
2. Clicks "Share"
3. Backend saves to `editor_pages` (no user_id):
   INSERT INTO editor_pages (data) VALUES (?)
4. Returns UUID for sharing
```

---

## Why This Design?

### Denormalization for Performance
We store `is_pro` in the `users` table even though it could be calculated from `subscriptions`:
- **Pro:** Much faster queries (no JOIN needed for 90% of requests)
- **Con:** Must keep in sync (webhook handler responsibility)
- **Decision:** Worth it for performance

### Dual Linking (Foreign Key + String Reference)
We maintain both `user_id` (FK) and `subscription_id` (string):
- **Pro:** Flexibility for different query patterns
- **Con:** More storage, must keep in sync
- **Decision:** Worth it for query flexibility

### JSONB for Page Data (Hybrid Approach)
We use structured columns + JSONB instead of fully normalized tables:
- **Pro:** Flexible schema, no migrations for editor changes
- **Pro:** Can still query by title, user, dates
- **Con:** Theme/sections data less queryable
- **Decision:** Worth it for rapid iteration

### Separate Tables: `editor_pages` vs `user_pages`
Two tables instead of one with nullable `user_id`:
- **Pro:** Clear separation of concerns (anonymous vs authenticated)
- **Pro:** Different RLS policies for each use case
- **Pro:** Can optimize queries separately
- **Con:** Slight duplication in structure
- **Decision:** Worth it for clarity and security

### localStorage → Database Migration
Moving from localStorage to `user_pages`:
- **Pro:** No storage limits, multi-device access, backup
- **Pro:** Can implement features like page history, templates
- **Con:** Requires backend API calls (slight latency)
- **Decision:** Worth it for better UX and features

---

## Missing Pieces

### 1. No Triggers for `updated_at`
**Status:** Function exists but triggers not created  
**Impact:** Must manually update `updated_at` in code  
**Fix:** Create triggers (see schema file for SQL)

### 2. No RLS on subscriptions table
**Status:** RLS not enabled  
**Impact:** No database-level access control  
**Risk:** Low (backend-only access) but not ideal  
**Fix:** Enable RLS and add policies

### 3. No foreign key from users.subscription_id to subscriptions.subscription_id
**Status:** Just a string reference, no FK constraint  
**Impact:** No referential integrity enforcement  
**Risk:** Could reference non-existent subscription  
**Decision:** Intentional for flexibility (can reference external subscriptions)

---

## Future Considerations

### If You Add User-Owned Pages
Currently `editor_pages` has no user ownership. If you want to add it:
```sql
ALTER TABLE editor_pages ADD COLUMN user_id BIGINT REFERENCES users(id);
CREATE INDEX idx_editor_pages_user_id ON editor_pages(user_id);
```

### If You Want Multiple Active Subscriptions
Currently we assume one active subscription per user. To support multiple:
- Remove `users.subscription_id` (too ambiguous)
- Query via JOIN on `subscriptions` table
- Add `is_active` flag to subscriptions

### If You Need Subscription History
Already supported! The foreign key `user_id` allows multiple subscriptions per user:
```sql
SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC;
```

---

## Quick Debugging Tips

### Check if user exists:
```sql
SELECT * FROM users WHERE email = 'user@example.com';
```

### Check user's subscription status:
```sql
SELECT u.is_pro, u.subscription_id, s.status, s.renews_at
FROM users u
LEFT JOIN subscriptions s ON u.id = s.user_id
WHERE u.clerk_user_id = 'user_xxx';
```

### Find all active subscriptions:
```sql
SELECT * FROM subscriptions WHERE status = 'active';
```

### Find users with expired subscriptions:
```sql
SELECT u.email, s.status, s.ends_at
FROM users u
INNER JOIN subscriptions s ON u.id = s.user_id
WHERE s.status IN ('expired', 'cancelled')
AND u.is_pro = true;  -- Should be false, indicates sync issue
```

### Check editor pages created recently:
```sql
SELECT id, created_at, 
       jsonb_pretty(data) as formatted_data
FROM editor_pages
WHERE created_at > NOW() - INTERVAL '1 day'
ORDER BY created_at DESC;
```

### Get user's pages with details:
```sql
SELECT 
    up.id,
    up.title,
    up.is_favorite,
    up.is_public,
    up.last_accessed,
    up.created_at,
    up.data->>'theme' as theme_name,
    jsonb_array_length(up.data->'sections') as section_count
FROM user_pages up
WHERE up.user_id = ?
ORDER BY up.last_accessed DESC;
```

### Find all pages using a specific theme:
```sql
SELECT 
    up.id,
    up.title,
    up.data->'theme'->>'name' as theme_name
FROM user_pages up
WHERE up.data->'theme'->>'name' = 'dark-minimal';
```

### Get page sharing stats:
```sql
SELECT 
    u.email,
    COUNT(*) as total_pages,
    COUNT(*) FILTER (WHERE up.is_public = TRUE) as public_pages,
    COUNT(*) FILTER (WHERE up.is_favorite = TRUE) as favorite_pages
FROM users u
LEFT JOIN user_pages up ON u.id = up.user_id
GROUP BY u.id, u.email
ORDER BY total_pages DESC;
```
