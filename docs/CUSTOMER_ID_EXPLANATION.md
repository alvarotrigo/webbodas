# Customer ID Explanation - How We Link Subscriptions to Users

## The Confusion

You saw `customer_id` (7111368) in the `subscriptions` table and thought we were using it to link subscriptions to users. **We're not!** Here's what's actually happening:

---

## What is `customer_id`?

**`customer_id` is LemonSqueezy's customer ID**, NOT our user ID!

### Where it comes from:
- LemonSqueezy webhook sends it in `relationships.customer.data.id`
- It's LemonSqueezy's internal customer identifier
- One LemonSqueezy customer can have multiple subscriptions

### What we use it for:
- ✅ Storing in `subscriptions` table for reference
- ✅ Querying LemonSqueezy API for customer details
- ✅ Linking multiple subscriptions to the same LemonSqueezy customer
- ❌ **NOT for linking to our internal users** (we use `clerk_user_id` or `email`)

---

## How We Actually Link Subscriptions to Users

We use a **multi-layered approach** with priority order:

### Priority 1: Custom Data (Best) ✅
```php
$clerkUserId = $customData['clerk_user_id'] ?? null;
```
- **Source:** `meta.custom_data` from webhook
- **How:** We pass `clerk_user_id` in checkout custom_data
- **Reliability:** 100% (direct link)

### Priority 2: Email Matching (Fallback) ✅
```php
$clerkUserId = getClerkUserIdFromEmail($customerEmail);
```
- **Source:** `users.email` matching `subscriptions.customer_email`
- **How:** Email is unique in users table, so we can match
- **Reliability:** 100% (if user exists)

### Priority 3: Customer ID Matching (Last Resort) ✅ NEW!
```php
$clerkUserId = getClerkUserIdFromCustomerId($customerId);
```
- **Source:** Find existing subscription by `customer_id`, then link via email
- **How:** 
  1. Find subscription by `customer_id`
  2. Get `customer_email` from that subscription
  3. Match email to user
- **Reliability:** Depends on existing subscription having email

---

## Database Structure

### `subscriptions` Table
```sql
subscription_id VARCHAR(255)  -- LemonSqueezy subscription ID (should NOT be empty!)
customer_id VARCHAR(255)      -- LemonSqueezy customer ID (7111368)
customer_email VARCHAR(255)  -- Used for email matching
...
```

### `users` Table
```sql
clerk_user_id VARCHAR(255)   -- Our user ID (from Clerk)
email VARCHAR(255)           -- Used for email matching
subscription_id VARCHAR(255) -- Links to subscriptions.subscription_id
...
```

**Note:** `users` table does NOT have `customer_id` - we don't need it!

---

## The Problem: Empty `subscription_id`

Looking at your database screenshot, the subscription has:
- ✅ `customer_id`: `7111368` (filled correctly)
- ❌ `subscription_id`: `EMPTY` (this is a problem!)

### Why is `subscription_id` empty?

The webhook should provide `subscription_id` in `attributes.id`. If it's empty, it means:

1. **Webhook might not be receiving the subscription ID correctly**
2. **The webhook payload might be malformed**
3. **The subscription might not have been created properly**

### How to fix:

1. Check `api/logs.txt` to see what the webhook received
2. Look for `subscription_id` in the logs
3. If it's missing, the webhook payload might be wrong

---

## Linking Flow Diagram

```
Webhook Arrives
    ↓
Extract customer_id from relationships.customer.data.id
    ↓
Try to link subscription to user:
    ↓
1. Check custom_data for clerk_user_id
   ├─ Found? → Link via clerk_user_id ✅
   └─ Not found? → Continue
    ↓
2. Match customer_email to users.email
   ├─ Found? → Link via email ✅
   └─ Not found? → Continue
    ↓
3. Find existing subscription by customer_id
   ├─ Found? → Get email → Match to user ✅
   └─ Not found? → Save subscription, link later when user logs in
```

---

## Summary

1. **`customer_id` (7111368)** = LemonSqueezy's customer ID (NOT our user ID)
2. **We store it** in `subscriptions` table for API queries
3. **We DON'T use it directly** to link to users (we use `clerk_user_id` or `email`)
4. **We CAN use it indirectly** to find existing subscriptions and link via email (new feature)
5. **`subscription_id` being empty** is a problem - check webhook logs!

---

## Next Steps

1. ✅ Check `api/logs.txt` to see what webhook received
2. ✅ Verify `subscription_id` is in the webhook payload
3. ✅ If `subscription_id` is missing, check webhook configuration
4. ✅ Test with a new purchase to see if linking works

The system now tries **3 methods** to link subscriptions to users:
1. `clerk_user_id` from custom_data (best)
2. Email matching (reliable)
3. Customer ID matching (last resort)

