# Polar.sh Integration Setup Guide

This guide walks you through setting up Polar.sh payment integration with redundant payment verification (Success URL + Webhooks).

## Overview

We use **two methods** to ensure payments are recorded:
1. **Success URL Redirect** - Immediate verification when user completes payment
2. **Webhooks** - Backup + real-time subscription lifecycle updates

Both methods are idempotent (safe to run multiple times) and will update the same database records.

---

## Step 1: Add Environment Variables

Add these to your `.env` file:

```bash
# Polar.sh Configuration
POLAR_ACCESS_TOKEN=polar_at_xxxxxxxxxxxxx
POLAR_WEBHOOK_SECRET=polar_whs_xxxxxxxxxxxxx
```

### How to get these values:

These are **two different credentials** from **two different places** in Polar:

#### 1. **POLAR_ACCESS_TOKEN** (API Access)

**Where:** Polar Dashboard → Settings → API → Access Tokens

**Purpose:** Allows your server to make API calls TO Polar to verify payments

**Steps:**
1. Go to https://polar.sh/settings/api (or Settings → API → Access Tokens)
2. Click **"Create new token"**
3. Name it: "fullPage.js Studio API"
4. **Select ONLY these scopes** (principle of least privilege):
   - ✅ `customers:read`
   - ✅ `orders:read`
   - ✅ `checkouts:read`
   - ✅ `subscriptions:read`
   - ❌ **UNCHECK ALL OTHER SCOPES** (especially `:write` scopes)
5. Choose expiration:
   - **Recommended:** 90 days (better security, requires rotation)
   - **Acceptable:** 365 days (less maintenance)
   - ⚠️ Set a calendar reminder to regenerate before expiration!
6. Click **"Create"**
7. Copy the token (starts with `polar_at_`)
8. Add to `.env`: `POLAR_ACCESS_TOKEN=polar_at_...`

**Format:** `polar_at_xxxxxxxxxxxxx`

**Used in:** `api/polar-success.php` - Verifies checkout via API call

#### 2. **POLAR_WEBHOOK_SECRET** (Webhook Verification)

**Where:** Polar Dashboard → Settings → Webhooks → Create/Edit Webhook

**Purpose:** Verifies that webhook requests are actually from Polar (HMAC signature)

**Steps:**
1. Go to Polar Dashboard → **Settings** → **Webhooks**
2. Click **"Add Endpoint"** or **"Create webhook"**
3. Enter webhook URL: `https://studio.fullpage.dev/api/polar-webhook.php`
4. Polar will **generate a webhook secret** for you (starts with `polar_whs_`)
5. Copy the secret
6. Add to `.env`: `POLAR_WEBHOOK_SECRET=polar_whs_...`
7. ⚠️ **Important:** This secret does NOT expire (unlike access token)

**Format:** `polar_whs_xxxxxxxxxxxxx`

**Used in:** `api/polar-webhook.php` - Verifies webhook signatures

### Token vs Secret Comparison

| Credential | Where to Get | Format | Purpose | Expires? |
|------------|--------------|--------|---------|----------|
| `POLAR_ACCESS_TOKEN` | API → Access Tokens | `polar_at_...` | Call Polar API | ✅ Yes (90-365 days) |
| `POLAR_WEBHOOK_SECRET` | Webhooks → Create Webhook | `polar_whs_...` | Verify webhooks | ❌ No |

### ⚠️ What Happens When Access Token Expires?

**When the access token expires:**
- ❌ Success redirect handler will fail (can't verify with API)
- ✅ Webhooks will STILL work (they use the webhook secret)
- ❌ Your code will NOT automatically regenerate it

**What to do when it expires:**
1. Go to Polar Dashboard → Settings → API → Access Tokens
2. Create a **new token** with same 4 scopes
3. Update `.env` with the new token
4. Restart your server (if needed)
5. Optional: Revoke old token in Polar dashboard

**Pro tip for zero-downtime rotation:**
1. Generate new token (old still works)
2. Update `.env` and restart server
3. Then revoke old token

---

## Understanding Access Token Scopes

### Why These Specific Scopes?

Your webhook handler and success redirect only **READ** data from Polar - they never create or modify anything. Following the **principle of least privilege**, only request the minimum permissions needed:

#### ✅ Required Scopes (SELECT THESE):

1. **`checkouts:read`** - **CRITICAL for security!**
   - Used by `polar-success.php` to verify payment actually succeeded
   - Prevents fake success URL manipulation
   - Called via `getPolarCheckout($checkoutId)`

2. **`subscriptions:read`**
   - Read subscription status and details
   - Handle subscription lifecycle events

3. **`orders:read`**
   - Read one-time orders (lifetime deals)
   - Handle `order.created` webhook events

4. **`customers:read`**
   - Read customer email and information
   - Link payments to user accounts

#### ❌ NOT Needed (UNCHECK THESE):

- All **`:write`** scopes - You never create/modify Polar data
- `products:read/write` - Not querying product details
- `webhooks:read/write` - You receive webhooks, not manage them
- `benefits`, `custom_fields`, `customer_portal`, `discounts`, etc. - Not used

### Access Token vs Webhook Secret

| What | Purpose | Used By | Format | Expires? |
|------|---------|---------|--------|----------|
| **Access Token** | Call Polar API to verify payments | `polar-success.php` | `polar_at_...` | Yes (90-365 days) |
| **Webhook Secret** | Verify webhook HMAC signatures | `polar-webhook.php` | `polar_whs_...` | No |

**Both are required:**
- **Access Token** prevents fake success redirects (verifies with Polar API)
- **Webhook Secret** prevents fake webhook requests (verifies signature)

---

## Step 2: Configure Success URL in Polar

For **each checkout link** (Annual + Lifetime):

1. Go to **Polar Dashboard** → https://polar.sh/dashboard
2. Navigate to **Products** → **Checkout Links**
3. Find your checkout links:
   - Annual: `polar_cl_vGfXimmFJMnYqTQWN7Vu3PEhqpyHoLZFdZCXJ4geYUn`
   - Lifetime: `polar_cl_jvXG4n0BcuDSybmQSnMqKKmqZTYgsntIEGHh12CaUM7`
4. Click **Edit** on each
5. In the **"Success URL"** field, enter:
   ```
   https://studio.fullpage.dev/api/polar-success.php?checkout_id={CHECKOUT_ID}
   ```
6. **Save** each checkout link

**Note:** The `{CHECKOUT_ID}` is a placeholder that Polar will automatically replace.

---

## Step 3: Configure Webhooks in Polar

1. Go to **Polar Dashboard** → **Settings** → **Webhooks**
2. Click **"Add Endpoint"** or **"Create webhook"**
3. Configure:
   - **Endpoint URL:** `https://studio.fullpage.dev/api/polar-webhook.php`
   - **Events to Subscribe:**
     - ✅ `checkout.updated` - Payment completed
     - ✅ `subscription.created` - New subscription
     - ✅ `subscription.updated` - Subscription changes
     - ✅ `subscription.active` - Subscription activated
     - ✅ `subscription.canceled` - Subscription canceled
     - ✅ `subscription.revoked` - Subscription revoked
     - ✅ `order.created` - One-time order (lifetime deals)
4. **Save** the webhook
5. **Important:** Polar will generate a webhook secret (starts with `polar_whs_`)
6. **Copy this secret** and add it to your `.env` file as `POLAR_WEBHOOK_SECRET`

**Note:** The webhook secret is generated BY Polar (not by you). It's shown once when you create the webhook.

---

## How It Works

### Payment Flow with Redundancy:

```
User clicks "Subscribe Now"
    ↓
Opens Polar checkout (email pre-filled)
    ↓
User completes payment
    ↓
┌─────────────────────────────────────────────┐
│ TWO PARALLEL PROCESSES:                     │
├─────────────────────────────────────────────┤
│                                             │
│ 1. SUCCESS REDIRECT (Immediate)            │
│    Polar redirects to:                      │
│    polar-success.php?checkout_id=abc123     │
│    ↓                                        │
│    Verifies with Polar API                  │
│    ↓                                        │
│    Updates database                         │
│    ↓                                        │
│    Redirects user to app.php?payment=success│
│                                             │
│ 2. WEBHOOK (Backup, ~1-2 seconds later)    │
│    Polar sends webhook to:                  │
│    polar-webhook.php                        │
│    ↓                                        │
│    Verifies signature                       │
│    ↓                                        │
│    Updates database (idempotent)            │
│                                             │
└─────────────────────────────────────────────┘
    ↓
User sees success message & has PRO access
```

### Why Both?

- **Success URL:** User gets immediate feedback
- **Webhook:** Catches edge cases (user closes browser, network issues)
- **Webhook:** Handles ongoing subscription events (renewals, cancellations)

---

## File Structure

```
api/
  ├── polar-create-checkout.php  # Creates checkout URL with email
  ├── polar-success.php          # Handles success redirect
  └── polar-webhook.php          # Handles webhook events

config/
  └── polar.php                  # Polar configuration & helpers
```

---

## Testing

### Test Success Redirect:
1. Click pricing button
2. Email should be pre-filled
3. Complete test purchase
4. You should be redirected to app with success message
5. Check `api/logs.txt` for `[POLAR-SUCCESS]` entries

### Test Webhook:
1. Use Polar's webhook testing tool in dashboard
2. Send a test `checkout.updated` event
3. Check `api/logs.txt` for `[POLAR-WEBHOOK]` entries

---

## Database Updates

Both handlers update these tables:

### `users` table:
```sql
UPDATE users SET
  is_pro = true,
  pro_status_source = 'polar',
  subscription_id = 'checkout_abc123',
  updated_at = NOW()
WHERE email = 'user@example.com'
```

### `subscriptions` table:
```sql
INSERT INTO subscriptions (
  subscription_id,
  user_id,
  customer_email,
  product_name,
  status,
  ...
) VALUES (...)
ON DUPLICATE KEY UPDATE ...
```

---

## Monitoring

Check `api/logs.txt` for detailed logs:

```bash
# View recent Polar activity
tail -n 100 api/logs.txt | grep POLAR

# Watch for new events
tail -f api/logs.txt
```

Log format:
- `[POLAR-SUCCESS]` - Success redirect events
- `[POLAR-WEBHOOK]` - Webhook events

---

## Troubleshooting

### Email not pre-filling?
- Verify `api/polar-create-checkout.php` is being called
- Check error logs in `debug/php_errors.log`
- Ensure parameter is `customer_email` not `email`

### Success redirect not working?
- Verify Success URL is configured in Polar checkout links
- Check that `POLAR_ACCESS_TOKEN` is set in `.env`
- **Check if token expired** (see Token Expiration section below)
- Look for errors in `api/logs.txt`

### Webhooks not being received?
- Verify webhook URL is correct in Polar dashboard
- Check that `POLAR_WEBHOOK_SECRET` matches in `.env` and Polar
- Test webhook using Polar's testing tool

### User not marked as PRO?
- Check `api/logs.txt` for user lookup messages
- Verify user exists in database with correct email
- Check database permissions

### Access Token Expired?

**Symptoms:**
- Success redirect fails with API errors
- Logs show "401 Unauthorized" or "Invalid token"
- Webhooks still work (they use different credential)

**How to Fix:**
1. Go to Polar Dashboard → Settings → API → Access Tokens
2. Click **"Create new token"**
3. Name it (e.g., "fullPage.js Studio API - Jan 2026")
4. Select same 4 scopes:
   - `customers:read`
   - `orders:read`
   - `checkouts:read`
   - `subscriptions:read`
5. Choose expiration (90 or 365 days)
6. Copy the new token
7. Update `.env`: `POLAR_ACCESS_TOKEN=polar_at_NEW_TOKEN`
8. Restart your server (if needed for env changes to load)
9. Optional: Revoke old token in Polar dashboard

**Prevent Future Expiration:**
- Set calendar reminder for ~1 week before expiration
- Use 90-day tokens for better security hygiene
- Document renewal process for your team

**Zero-Downtime Rotation:**
1. Generate new token (old one still valid)
2. Update `.env` with new token
3. Restart application
4. Verify everything works
5. Then revoke old token

---

## Security Notes

### Authentication & Authorization
- ✅ Webhook signatures verified using `POLAR_WEBHOOK_SECRET` (HMAC-SHA256)
- ✅ Success redirect verifies checkout status via Polar API
- ✅ Access token uses only required read scopes (principle of least privilege)
- ✅ Both handlers are idempotent (safe to run multiple times)

### Token Management
- ⚠️ Access token expires (90-365 days) - set calendar reminder!
- ⚠️ Webhook secret does NOT expire (set once, use forever)
- ✅ If access token expires, webhooks continue working
- ✅ Rotate tokens before expiration for zero-downtime

### Data Protection
- ✅ Logs contain sensitive data - ensure `api/logs.txt` is not publicly accessible
- ✅ Add `.env` to `.gitignore` to prevent committing secrets
- ✅ Never expose `POLAR_ACCESS_TOKEN` or `POLAR_WEBHOOK_SECRET` in client-side code
- ✅ Use HTTPS for all Polar webhook endpoints

---

## Support

If you encounter issues:
1. Check `api/logs.txt` for detailed error messages
2. Check `debug/php_errors.log` for PHP errors
3. Use Polar's dashboard to test webhooks
4. Contact Polar support if webhook events aren't being sent

