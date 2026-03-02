# Polar.sh Credentials Explained

This document clarifies the two different credentials used in Polar.sh integration and why both are needed.

## Quick Reference

| Credential | Format | Where to Get | Expires? | Used By |
|------------|--------|--------------|----------|---------|
| **Access Token** | `polar_at_...` | API → Access Tokens | ✅ Yes (90-365 days) | `polar-success.php` |
| **Webhook Secret** | `polar_whs_...` | Webhooks → Create Webhook | ❌ No | `polar-webhook.php` |

---

## 1. POLAR_ACCESS_TOKEN

### What Is It?
An API access token that allows your server to make authenticated requests TO Polar's API.

### Where to Get It
1. Go to Polar Dashboard
2. Navigate to **Settings → API → Access Tokens**
3. Click **"Create new token"**
4. Select scopes (see below)
5. Choose expiration period
6. Copy the generated token

### Required Scopes
**Only select these 4 read scopes:**
- ✅ `customers:read` - Read customer information
- ✅ `orders:read` - Read one-time orders (lifetime deals)
- ✅ `checkouts:read` - **Critical: Verify payments in success redirect**
- ✅ `subscriptions:read` - Read subscription status

**Uncheck everything else**, especially:
- ❌ All `:write` scopes
- ❌ `products`, `webhooks`, `benefits`, etc.

### Why These Scopes?
Your application only **reads** data from Polar to verify payments. You never create or modify data in Polar, so write permissions are unnecessary and would be a security risk.

### When Is It Used?
```php
// File: api/polar-success.php
// Line 53
$checkout = getPolarCheckout($checkoutId); // ← Uses POLAR_ACCESS_TOKEN
```

**Purpose:** When a user completes payment and returns to your site, verify the payment actually succeeded by calling Polar's API.

**Security:** Prevents someone from faking the success URL redirect without actually paying.

### Expiration
- **Recommended:** 90 days (better security, forces regular rotation)
- **Acceptable:** 365 days (less maintenance)
- ⚠️ **Critical:** Set a calendar reminder to regenerate before expiration!

### What Happens When It Expires?
- ❌ Success redirect handler fails (can't verify with API)
- ✅ Webhooks **STILL WORK** (they use the webhook secret)
- ❌ Code does **NOT** automatically regenerate it

### How to Regenerate
```bash
# When token expires:
1. Polar Dashboard → Settings → API → Access Tokens
2. Create new token with same 4 scopes
3. Update .env: POLAR_ACCESS_TOKEN=polar_at_NEW_TOKEN
4. Restart server
5. Optional: Revoke old token
```

**Pro Tip - Zero-Downtime Rotation:**
1. Generate new token (old still works)
2. Update `.env` and restart
3. Verify everything works
4. Then revoke old token

---

## 2. POLAR_WEBHOOK_SECRET

### What Is It?
A secret key used to verify that webhook requests are actually from Polar (HMAC-SHA256 signature verification).

### Where to Get It
1. Go to Polar Dashboard
2. Navigate to **Settings → Webhooks**
3. Click **"Create webhook"**
4. Enter your webhook URL
5. **Polar generates the secret for you**
6. Copy the secret (shown once, starts with `polar_whs_`)

**Important:** You don't generate this yourself - Polar creates it when you create the webhook.

### When Is It Used?
```php
// File: api/polar-webhook.php
// Line 67
if (!verifyPolarWebhookSignature($payload, $signature)) { // ← Uses POLAR_WEBHOOK_SECRET
    throw new Exception('Invalid webhook signature');
}
```

**Purpose:** Verify that webhook POST requests are actually from Polar, not from an attacker trying to grant themselves free access.

**Security:** HMAC signature verification ensures only Polar (who knows the secret) can send valid webhooks.

### Expiration
❌ **Does NOT expire** - Set once when creating webhook, use forever.

**Note:** You can regenerate it in Polar dashboard if compromised, but it won't expire on its own.

---

## Why Both Are Needed?

### Different Security Purposes

| Scenario | Credential Used | Security Provided |
|----------|----------------|-------------------|
| User returns after payment | **Access Token** | Verifies payment with Polar API |
| Polar sends event notification | **Webhook Secret** | Verifies request is from Polar |

### Payment Flow

```
User completes payment
    ↓
┌─────────────────────────────────────┐
│ TWO PARALLEL VERIFICATION METHODS:   │
├─────────────────────────────────────┤
│                                     │
│ 1. SUCCESS REDIRECT                 │
│    User redirected to:              │
│    polar-success.php?checkout_id=X  │
│    ↓                                │
│    Uses ACCESS TOKEN to call:       │
│    GET /checkouts/{id}              │
│    ↓                                │
│    ✓ Verifies payment succeeded     │
│                                     │
│ 2. WEBHOOK (backup)                 │
│    Polar POSTs to:                  │
│    polar-webhook.php                │
│    ↓                                │
│    Uses WEBHOOK SECRET to verify:   │
│    HMAC signature                   │
│    ↓                                │
│    ✓ Verifies request from Polar    │
│                                     │
└─────────────────────────────────────┘
    ↓
Both update database → User gets PRO access
```

### Why Not Just One?

**Without Access Token:**
- Someone could fake the success URL: `?checkout_id=fake123`
- Without API verification, you'd grant access to anyone

**Without Webhook Secret:**
- Someone could POST fake webhook events
- Without signature verification, attackers could grant themselves access

**Together:**
- Access Token = Verify payment actually happened (via API)
- Webhook Secret = Verify request actually from Polar (via signature)

---

## Common Issues

### "My access token isn't working"

**Check:**
```bash
# 1. Is it set in .env?
grep POLAR_ACCESS_TOKEN .env

# 2. Format correct?
# Should start with: polar_at_

# 3. Has it expired?
# Check creation date + expiration period

# 4. Are scopes correct?
# Must have: customers:read, orders:read, checkouts:read, subscriptions:read
```

### "Webhooks aren't being received"

**Check:**
```bash
# 1. Is webhook secret set?
grep POLAR_WEBHOOK_SECRET .env

# 2. Format correct?
# Should start with: polar_whs_

# 3. URL configured in Polar?
# Polar Dashboard → Settings → Webhooks → Check endpoint URL

# 4. Test webhook
# Use Polar's webhook testing tool in dashboard
```

### "Do I need to create the webhook secret?"

**No!** Polar generates it for you when you create the webhook endpoint.

**Steps:**
1. Create webhook in Polar dashboard
2. Polar shows you the secret
3. Copy secret to your `.env`
4. Done!

### "What if I lose the webhook secret?"

You'll need to:
1. Delete old webhook in Polar dashboard
2. Create new webhook
3. Polar generates new secret
4. Update `.env` with new secret

---

## Security Best Practices

### ✅ Do This
- Use only required scopes (4 read scopes)
- Set expiration reminder for access token
- Rotate access tokens before expiration
- Keep secrets in `.env` (never in code)
- Add `.env` to `.gitignore`
- Use HTTPS for webhook endpoints
- Verify webhook signatures (already implemented)
- Verify API responses (already implemented)

### ❌ Don't Do This
- Request write scopes you don't need
- Share tokens publicly or commit to git
- Skip signature verification
- Skip API verification
- Use access token in client-side JavaScript
- Hardcode secrets in code
- Ignore token expiration

---

## Quick Setup Checklist

```bash
# 1. Create Access Token
[ ] Go to: Polar → Settings → API → Access Tokens
[ ] Create token with 4 read scopes
[ ] Choose expiration (90 or 365 days)
[ ] Copy token to .env: POLAR_ACCESS_TOKEN=polar_at_...
[ ] Set calendar reminder before expiration

# 2. Create Webhook
[ ] Go to: Polar → Settings → Webhooks
[ ] Create webhook with URL: https://yourdomain.com/api/polar-webhook.php
[ ] Copy generated secret to .env: POLAR_WEBHOOK_SECRET=polar_whs_...
[ ] Subscribe to events: checkout.updated, subscription.*, order.created

# 3. Test
[ ] Test payment flow
[ ] Check api/logs.txt for [POLAR-SUCCESS] entries
[ ] Test webhook with Polar's testing tool
[ ] Check api/logs.txt for [POLAR-WEBHOOK] entries
[ ] Verify user marked as PRO in database
```

---

## Related Documentation

- **Quick Start:** [POLAR_QUICK_START.md](./POLAR_QUICK_START.md)
- **Detailed Setup:** [POLAR_SETUP_GUIDE.md](./POLAR_SETUP_GUIDE.md)
- **Database Structure:** [DATABASE_STRUCTURE_CURRENT.md](./DATABASE_STRUCTURE_CURRENT.md)

---

## Summary

| Question | Answer |
|----------|--------|
| Do I need both credentials? | ✅ Yes - for different security purposes |
| Can I skip the access token? | ❌ No - needed to verify payments |
| Can I skip the webhook secret? | ❌ No - needed to verify webhook requests |
| Will code auto-generate tokens? | ❌ No - you must manually create them |
| What if access token expires? | 🔄 Regenerate in Polar dashboard |
| What if webhook secret expires? | ✅ It doesn't expire |
| Which scopes do I need? | ✅ Only 4 read scopes (customers, orders, checkouts, subscriptions) |

**Bottom Line:** Both credentials are required for secure payment processing. Access token verifies payments via API, webhook secret verifies webhook authenticity. Neither is automatically generated by your code.

