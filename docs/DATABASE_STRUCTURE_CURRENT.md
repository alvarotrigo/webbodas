# Current Database Structure

**Last Updated:** November 19, 2025  
**Source:** Extracted from Supabase production database

## 📊 Database Tables

### 1. `users` Table
**Purpose:** Stores all logged-in users (paying and non-paying) with pro status

**Columns:**
- `id` - Primary key (BIGSERIAL)
- `clerk_user_id` - Unique Clerk user ID (VARCHAR(255), UNIQUE, NOT NULL)
- `email` - User's email address (VARCHAR(255), NOT NULL)
- `name` - User's name (VARCHAR(255))
- `is_pro` - Boolean indicating if user has active subscription (BOOLEAN, DEFAULT FALSE)
- `pro_status_source` - Source of pro status: 'lemonsqueezy' or 'legacy' (VARCHAR(50))
- `subscription_id` - Links to subscription in `subscriptions` table (VARCHAR(255))
- `last_login` - Last login timestamp (TIMESTAMP WITH TIME ZONE)
- `created_at` - Record creation timestamp (TIMESTAMP WITH TIME ZONE, DEFAULT NOW())
- `updated_at` - Last update timestamp (TIMESTAMP WITH TIME ZONE, DEFAULT NOW())

**Indexes:**
- `users_pkey` - Primary key on `id`
- `users_clerk_user_id_key` - Unique constraint on `clerk_user_id`
- `idx_users_clerk_id` - Index on `clerk_user_id` (for fast lookups)
- `idx_users_email` - Index on `email` (for email-based queries)
- `idx_users_is_pro` - Index on `is_pro` (for filtering pro users)

**RLS Policies:**
- `Service role can do everything on users` - Service role has full access
- `Anon can read all users` - Anonymous role can SELECT

**Key:** `clerk_user_id` (unique identifier)

---

### 2. `subscriptions` Table
**Purpose:** Stores subscription data from LemonSqueezy webhooks

**Columns:**
- `id` - Primary key (BIGSERIAL)
- `subscription_id` - Unique subscription ID from LemonSqueezy (VARCHAR, UNIQUE, NOT NULL)
- `user_id` - Foreign key linking to `users.id` (BIGINT, REFERENCES users(id))
- `customer_id` - LemonSqueezy customer ID (VARCHAR)
- `customer_email` - Customer's email address (VARCHAR)
- `customer_name` - Customer's name (VARCHAR)
- `product_id` - Product ID from LemonSqueezy (VARCHAR)
- `product_name` - Product name (VARCHAR)
- `variant_id` - Variant ID from LemonSqueezy (VARCHAR)
- `variant_name` - Variant name (VARCHAR)
- `status` - Subscription status: active, cancelled, expired, paused, past_due, etc. (VARCHAR)
- `status_formatted` - Human-readable status (VARCHAR)
- `card_brand` - Payment card brand (VARCHAR)
- `card_last_four` - Last 4 digits of payment card (VARCHAR)
- `renews_at` - Next renewal date (TIMESTAMP WITH TIME ZONE)
- `ends_at` - Subscription end date (TIMESTAMP WITH TIME ZONE)
- `trial_ends_at` - Trial end date (TIMESTAMP WITH TIME ZONE)
- `created_at` - Record creation timestamp (TIMESTAMP WITH TIME ZONE, DEFAULT NOW())
- `updated_at` - Last update timestamp (TIMESTAMP WITH TIME ZONE, DEFAULT NOW())

**Indexes:**
- `subscriptions_pkey` - Primary key on `id`
- `subscriptions_subscription_id_key` - Unique constraint on `subscription_id`
- `subscriptions_customer_id_idx` - Index on `customer_id` (for customer lookups)
- `subscriptions_user_id_idx` - Index on `user_id` (for joining with users)

**RLS Policies:**
- ⚠️ **NONE** - RLS is currently NOT enabled on this table

**Key:** `subscription_id` (unique from LemonSqueezy)

---

### 3. `editor_pages` Table
**Purpose:** Stores anonymous/shared editor page configurations as JSON (no user ownership)

**Columns:**
- `id` - Primary key (UUID, DEFAULT gen_random_uuid())
- `data` - JSONB data containing the page configuration (JSONB, NOT NULL)
- `created_at` - Record creation timestamp (TIMESTAMP WITH TIME ZONE, DEFAULT NOW())

**Indexes:**
- `editor_pages_pkey` - Primary key on `id`

**RLS Policies:**
- `public_select_editor_pages` - Public role can SELECT
- `public_insert_editor_pages` - Public role can INSERT

**Key:** `id` (UUID)

---

### 4. `user_pages` Table
**Purpose:** Stores user-owned page drafts with full state (replaces localStorage)

**Columns:**
- `id` - Primary key (UUID, DEFAULT gen_random_uuid())
- `user_id` - Foreign key to `users.id` (BIGINT, NOT NULL, REFERENCES users(id) ON DELETE CASCADE)
- `title` - Page title (VARCHAR(255), DEFAULT 'Untitled Page')
- `data` - Full page state as JSONB (JSONB, NOT NULL, DEFAULT '{}')
- `thumbnail_url` - Optional thumbnail URL (TEXT)
- `is_favorite` - Favorite flag (BOOLEAN, DEFAULT FALSE)
- `is_public` - Public sharing flag (BOOLEAN, DEFAULT FALSE)
- `share_token` - Unique sharing token (UUID, UNIQUE, DEFAULT gen_random_uuid())
- `last_accessed` - Last access timestamp (TIMESTAMP WITH TIME ZONE, DEFAULT NOW())
- `created_at` - Record creation timestamp (TIMESTAMP WITH TIME ZONE, DEFAULT NOW())
- `updated_at` - Last update timestamp (TIMESTAMP WITH TIME ZONE, DEFAULT NOW())

**Indexes:**
- `user_pages_pkey` - Primary key on `id`
- `user_pages_share_token_key` - Unique constraint on `share_token`
- `idx_user_pages_user_id` - Index on `user_id` (for user's pages)
- `idx_user_pages_user_last_accessed` - Index on `(user_id, last_accessed DESC)` (for recent pages)
- `idx_user_pages_share_token` - Partial index on `share_token` WHERE `is_public = TRUE`
- `idx_user_pages_favorites` - Partial index on `(user_id, is_favorite)` WHERE `is_favorite = TRUE`
- `idx_user_pages_data_theme` - GIN index on `data->'theme'` (for theme-based queries)

**RLS Policies:**
- `Users can view own pages` - Users can SELECT their own pages or public pages
- `Users can create own pages` - Users can INSERT their own pages
- `Users can update own pages` - Users can UPDATE their own pages
- `Users can delete own pages` - Users can DELETE their own pages
- `Service role full access to user_pages` - Service role has full access

**Triggers:**
- `update_user_pages_updated_at` - Auto-updates `updated_at` on UPDATE

**Key:** `id` (UUID)

---

## 🔧 Functions

### `update_updated_at_column()`
**Purpose:** Automatically updates the `updated_at` column when a record is modified

**Type:** TRIGGER FUNCTION  
**Language:** PL/pgSQL

**Definition:**
```sql
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
```

**Note:** This function exists but is **NOT currently attached to any triggers**. To enable auto-updating:
```sql
CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
BEFORE UPDATE ON subscriptions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
```

---

## 🔗 Relationships

### User ← Subscription (One-to-Many)
- `users.id` ← `subscriptions.user_id` (Foreign Key)
- A user can have multiple subscriptions over time
- A subscription belongs to one user

### User ← Subscription (via subscription_id string)
- `users.subscription_id` stores the LemonSqueezy subscription ID as a string
- This links to `subscriptions.subscription_id` (not a true FK constraint)
- Used for quick lookups without JOINs

### User ← User Pages (One-to-Many)
- `users.id` ← `user_pages.user_id` (Foreign Key, ON DELETE CASCADE)
- A user can have multiple saved pages
- A page belongs to one user
- Pages are deleted when user is deleted

---

## ⚠️ Important Notes

### Missing Features:
1. **No RLS on `subscriptions` table** - Anyone with database access can read/modify
2. **No triggers on `users` and `subscriptions`** - `updated_at` columns must be manually updated
3. **No foreign key from `users.subscription_id` to `subscriptions.subscription_id`** - Only a reference by value

### Security Considerations:
- `users` table has RLS enabled and policies configured ✅
- `subscriptions` table has NO RLS protection ⚠️
- `editor_pages` table allows public INSERT and SELECT ⚠️ (intentional for anonymous pages)
- `user_pages` table has full RLS protection ✅

### Performance Notes:
- All critical columns are indexed for fast lookups ✅
- `user_id` in subscriptions and user_pages has indexes for JOINs ✅
- `customer_id` indexed for customer-based queries ✅
- `user_pages` has GIN index on JSONB theme data for advanced queries ✅
- `user_pages` has partial indexes for favorites and public pages ✅
