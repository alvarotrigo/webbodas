# Using Email and Customer ID to Link Subscriptions to Users

## Overview

Yes! We can use **email** (which is unique in the `users` table) to relate subscriptions to users. We also store **customer_id** from LemonSqueezy for API operations.

## How It Works

### 1. **Email Matching** (Primary Fallback Method) ✅

Since `email` is **unique** in the `users` table, we can reliably use it to link subscriptions to users.

**Flow:**
1. Webhook receives subscription with `customer_email`
2. Query `users` table by `email = customer_email`
3. If found, update user's `is_pro` status and `subscription_id`
4. If not found, subscription is saved but user record not updated (user hasn't logged in yet)

**Implementation:**
```php
// In subscription-webhook.php
$clerkUserId = getClerkUserIdFromEmail($subscriptionData['customer_email']);

if ($clerkUserId) {
    // Update user's pro status
    updateUserProStatus($clerkUserId, $email, $isPro, 'lemonsqueezy', $subscriptionId);
}
```

**Pros:**
- ✅ Email is unique in users table (reliable)
- ✅ Works even if custom_data is missing
- ✅ Simple and straightforward

**Cons:**
- ⚠️ User must exist in users table (must have logged in at least once)
- ⚠️ Email must match exactly (case-sensitive in database, but we normalize)

---

### 2. **Customer ID** (LemonSqueezy's Customer ID) 📋

We store `customer_id` from LemonSqueezy in the `subscriptions` table, but **not for user linking**.

**What it's used for:**
- Querying LemonSqueezy API for customer details
- Linking multiple subscriptions to the same LemonSqueezy customer
- Customer-level operations via LemonSqueezy API

**What it's NOT used for:**
- ❌ Linking to our internal users (we use `clerk_user_id` or `email`)

**Example:**
```php
// Store customer_id in subscription
$subscriptionData['customer_id'] = $customerId; // From webhook relationships

// Later, query LemonSqueezy API
GET /v1/customers/{customer_id}
```

---

## Linking Priority Order

When a webhook arrives, we try to link the subscription to a user in this order:

### Priority 1: Custom Data (Best) ✅
```php
$clerkUserId = $customData['clerk_user_id'] ?? null;
```
- **Source:** `meta.custom_data` from webhook
- **Reliability:** 100% (direct link)
- **Requires:** Passing `clerk_user_id` in checkout custom_data

### Priority 2: Subscription ID Lookup (Reverse) ✅
```php
$clerkUserId = getClerkUserIdFromSubscription($subscriptionId);
```
- **Source:** `users.subscription_id` (if already linked)
- **Reliability:** 100% (if already linked)
- **Requires:** User record already has `subscription_id` set

### Priority 3: Email Matching (Fallback) ✅
```php
$clerkUserId = getClerkUserIdFromEmail($customerEmail);
```
- **Source:** `users.email` matching `subscriptions.customer_email`
- **Reliability:** 100% (email is unique)
- **Requires:** User must exist in users table (must have logged in)

---

## Edge Cases

### Case 1: User subscribes before logging in
**Scenario:** User completes checkout but hasn't logged in yet

**What happens:**
- ✅ Subscription is saved to `subscriptions` table
- ⚠️ User record doesn't exist yet, so no linking
- ✅ When user logs in, `auth-handler.php` will:
  1. Check subscription by email
  2. Create user record
  3. Link subscription to user
  4. Set `is_pro = true`

**Result:** User gets linked when they log in

---

### Case 2: Email mismatch (different case)
**Scenario:** User's email in Clerk is `User@Example.com` but LemonSqueezy has `user@example.com`

**What happens:**
- We normalize email (lowercase, trimmed) before querying
- If emails are stored in mixed case, we try both normalized and original

**Result:** Should match correctly

---

### Case 3: User changes email in Clerk but not in LemonSqueezy
**Scenario:** User updates email in Clerk but subscription still has old email

**What happens:**
- Primary link via `clerk_user_id` in custom_data still works ✅
- Email matching would fail, but custom_data takes priority ✅

**Result:** Still works via custom_data

---

## Database Schema

### `subscriptions` Table
```sql
subscription_id VARCHAR(255) UNIQUE NOT NULL
customer_id VARCHAR(255)        -- LemonSqueezy customer ID (for API queries)
customer_email VARCHAR(255)     -- Used for email matching
customer_name VARCHAR(255)
...
```

### `users` Table
```sql
clerk_user_id VARCHAR(255) UNIQUE NOT NULL
email VARCHAR(255) UNIQUE NOT NULL  -- Used for email matching
subscription_id VARCHAR(255)        -- Links to subscriptions.subscription_id
is_pro BOOLEAN
...
```

---

## Best Practices

1. **Always pass `clerk_user_id` in checkout custom_data** (most reliable)
2. **Store `customer_email` in subscriptions** (for email matching fallback)
3. **Store `customer_id` in subscriptions** (for LemonSqueezy API queries)
4. **Store `subscription_id` in users** (for reverse lookups)
5. **Normalize emails** (lowercase, trimmed) for consistent matching

---

## Summary

✅ **Yes, we can use email to relate subscriptions to users!**

- Email is unique in `users` table → reliable matching
- We use it as fallback when `clerk_user_id` is missing
- We also store `customer_id` for LemonSqueezy API operations
- Multi-layered approach ensures subscriptions get linked

The system now:
1. Tries `clerk_user_id` from custom_data (best)
2. Falls back to email matching (reliable)
3. Stores `customer_id` for API operations
4. Logs everything for debugging

