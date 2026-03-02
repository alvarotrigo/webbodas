# How SaaS Apps Link Subscriptions to Users

## The Problem

When a payment provider (like LemonSqueezy) sends a webhook, it doesn't know about your internal user system (like Clerk). You need to link:
- **Subscription** (from LemonSqueezy) → **User** (in your database)

## Common SaaS Approaches

### 1. **Custom Data in Checkout** (Primary - Most Common) ✅

**How it works:**
- When creating checkout, pass your `clerk_user_id` in `custom_data`
- Payment provider includes this in webhook payload
- Extract `clerk_user_id` from webhook and link to user

**Pros:**
- ✅ Most reliable - direct link
- ✅ Works even if user changes email
- ✅ No ambiguity

**Cons:**
- ⚠️ Requires passing data during checkout
- ⚠️ If checkout created without custom_data, link is lost

**Implementation:**
```php
// In create-checkout.php
'custom' => [
    'clerk_user_id' => $clerkUserId
]

// In webhook handler
$clerkUserId = $customData['clerk_user_id'] ?? null;
```

---

### 2. **Email Matching** (Fallback) ✅

**How it works:**
- Match subscription `customer_email` to user `email` in your database
- Update user record with subscription_id

**Pros:**
- ✅ Works as fallback if custom_data missing
- ✅ Simple to implement

**Cons:**
- ⚠️ Email can change (user updates email in Clerk but not in LemonSqueezy)
- ⚠️ Multiple users could have same email (rare but possible)
- ⚠️ User might use different email for payment

**Implementation:**
```php
// In webhook handler
if (!$clerkUserId) {
    $clerkUserId = getClerkUserIdFromEmail($subscriptionData['customer_email']);
}
```

---

### 3. **Customer ID Mapping** (LemonSqueezy-specific)

**How it works:**
- Store LemonSqueezy `customer_id` in subscriptions table
- Use for API queries and customer management
- Not directly used for user linking, but useful for:
  - Querying LemonSqueezy API for customer details
  - Linking multiple subscriptions to same customer
  - Customer-level operations

**Implementation:**
```php
// Extract from webhook relationships
$customerId = $eventData['relationships']['customer']['data']['id'] ?? null;
$subscriptionData['customer_id'] = $customerId;
```

---

### 4. **Subscription ID in User Record** (Reverse Lookup)

**How it works:**
- Store `subscription_id` in `users` table
- When webhook arrives, look up user by `subscription_id`
- Useful for updates/cancellations when custom_data might be missing

**Pros:**
- ✅ Works for subsequent webhooks (updates, cancellations)
- ✅ Direct relationship

**Cons:**
- ⚠️ Requires initial link to be established (via custom_data or email)

**Implementation:**
```php
// In users table
subscription_id VARCHAR(255) -- Links to subscriptions.subscription_id

// In webhook handler
$clerkUserId = getClerkUserIdFromSubscription($subscriptionId);
```

---

## Our Implementation (Multi-Layered Approach)

We use **all approaches** in priority order:

### Priority 1: Custom Data (Primary)
```php
$clerkUserId = $customData['clerk_user_id'] ?? null;
```

### Priority 2: Subscription ID Lookup (Reverse)
```php
if (!$clerkUserId) {
    $clerkUserId = getClerkUserIdFromSubscription($subscriptionId);
}
```

### Priority 3: Email Matching (Fallback)
```php
if (!$clerkUserId) {
    $clerkUserId = getClerkUserIdFromEmail($customerEmail);
}
```

### Priority 4: Store Customer ID
```php
$subscriptionData['customer_id'] = $customerId; // For LemonSqueezy API queries
```

---

## Real-World Examples

### Stripe
- Uses **metadata** (similar to custom_data) to pass user IDs
- Also supports email matching as fallback
- Stores `customer_id` for API operations

### Paddle
- Uses **passthrough** field (similar to custom_data)
- Email matching as fallback
- Stores `customer_id` for customer management

### LemonSqueezy (Our Setup)
- Uses **custom_data** in checkout
- Email matching as fallback
- Stores `customer_id` for API queries

---

## Best Practices

1. **Always pass user ID in checkout** - Most reliable method
2. **Store customer_id** - Useful for API queries and customer management
3. **Use email as fallback** - Handles edge cases
4. **Store subscription_id in user record** - Enables reverse lookups
5. **Log everything** - Track which method successfully linked user
6. **Handle edge cases** - What if user changes email? What if custom_data missing?

---

## Edge Cases to Handle

### Case 1: User changes email in Clerk but not in LemonSqueezy
- **Solution:** Primary link via `clerk_user_id` in custom_data (doesn't depend on email)
- **Fallback:** Subscription ID lookup (already linked)

### Case 2: Custom data missing from webhook
- **Solution:** Email matching or subscription ID lookup
- **Prevention:** Always pass custom_data in checkout

### Case 3: Multiple subscriptions for same user
- **Solution:** Store all subscription_ids, check all for active status
- **Current:** We store one subscription_id per user (can be enhanced)

### Case 4: User subscribes before logging in
- **Solution:** Email matching when user logs in, or manual linking
- **Prevention:** Require login before checkout

---

## Current Implementation Status

✅ **Implemented:**
- Custom data passing in checkout
- Customer ID extraction and storage
- Email matching fallback
- Subscription ID reverse lookup
- Comprehensive logging

✅ **Working:**
- Multi-layered approach with priority order
- Detailed logs in `api/logs.txt`
- Error handling and warnings

---

## Testing Checklist

- [ ] Test checkout with logged-in user (custom_data should work)
- [ ] Test checkout without custom_data (email matching should work)
- [ ] Test webhook with missing custom_data (fallback should work)
- [ ] Verify customer_id is stored in subscriptions table
- [ ] Verify subscription_id is stored in users table
- [ ] Check logs to see which linking method was used

