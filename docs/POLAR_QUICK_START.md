# Polar.sh Quick Start Checklist

Use this checklist to quickly set up Polar.sh integration.

## ✅ Configuration Checklist

### 1. Environment Variables (.env)
```bash
POLAR_ACCESS_TOKEN=polar_at_xxxxxxxxxxxxx   # From: API → Access Tokens (for API calls)
POLAR_WEBHOOK_SECRET=polar_whs_xxxxxxxxxxx  # From: Webhooks → Create Webhook (for signature verification)
```

**Quick setup:**
1. **Access Token:** Go to Polar → Settings → API → Access Tokens
   - Create token with scopes: `customers:read`, `orders:read`, `checkouts:read`, `subscriptions:read`
   - Choose expiration: 90 or 365 days (set reminder!)
   - Format: `polar_at_...`
   
2. **Webhook Secret:** Go to Polar → Settings → Webhooks → Create Webhook
   - Polar generates this for you when creating webhook
   - Format: `polar_whs_...`
   - Does NOT expire

### 2. Polar Dashboard - Checkout Links

Configure **both** checkout links (Annual + Lifetime):

**Success URL:**
```
https://studio.fullpage.dev/api/polar-success.php?checkout_id={CHECKOUT_ID}
```

Links to configure:
- [ ] Annual: `polar_cl_vGfXimmFJMnYqTQWN7Vu3PEhqpyHoLZFdZCXJ4geYUn`
- [ ] Lifetime: `polar_cl_jvXG4n0BcuDSybmQSnMqKKmqZTYgsntIEGHh12CaUM7`

### 3. Polar Dashboard - Webhooks

Go to: Polar Dashboard → Settings → Webhooks → Create Webhook

**Endpoint URL:**
```
https://studio.fullpage.dev/api/polar-webhook.php
```

**Secret:** Polar will generate this - copy it to `POLAR_WEBHOOK_SECRET` in .env

**Events to Subscribe:**
- [ ] `checkout.updated` - Payment completed
- [ ] `subscription.created` - New subscription
- [ ] `subscription.updated` - Subscription changes
- [ ] `subscription.active` - Subscription activated
- [ ] `subscription.canceled` - Subscription canceled
- [ ] `subscription.revoked` - Subscription revoked
- [ ] `order.created` - One-time order (lifetime deals)

**Important:** Copy the generated webhook secret to your `.env` file!

---

## 🔑 Access Token Scopes

When creating your `POLAR_ACCESS_TOKEN`, **only select these 4 scopes:**

- ✅ `customers:read` - Read customer information
- ✅ `orders:read` - Read one-time orders (lifetime deals)
- ✅ `checkouts:read` - **Required for success redirect verification**
- ✅ `subscriptions:read` - Read subscription data

**Uncheck all other scopes**, especially:
- ❌ All `:write` scopes (you don't modify Polar data)
- ❌ `products:read/write` (not used)
- ❌ `webhooks:read/write` (you receive webhooks, not manage them)
- ❌ All other scopes (benefits, discounts, disputes, etc.)

**Why only read scopes?** Your webhook handler only **receives** data from Polar and **verifies** payments via API. You never create or modify data in Polar, so write permissions are unnecessary and would be a security risk.

---

## 📊 Why Both Access Token AND Webhook Secret?

| Credential | Used By | Purpose | When Used |
|------------|---------|---------|-----------|
| Access Token | `polar-success.php` | **Verify payment** by calling Polar API | When user returns after payment |
| Webhook Secret | `polar-webhook.php` | **Verify webhook signature** (HMAC) | When Polar sends event notifications |

**Both are required for secure payment processing:**
- **Access Token:** Prevents fake success URLs (verifies with Polar API)
- **Webhook Secret:** Prevents fake webhook requests (verifies signature)

---

## 🧪 Testing

### Test Email Pre-fill:
1. [ ] Login to your app
2. [ ] Click "Subscribe Now" or "Get Lifetime Access"
3. [ ] Verify email is pre-filled in Polar checkout

### Test Success Redirect:
1. [ ] Make a test purchase
2. [ ] Verify redirect back to app with success message
3. [ ] Check `api/logs.txt` for `[POLAR-SUCCESS]` entry
4. [ ] Verify user is marked as PRO in database

### Test Webhook:
1. [ ] Use Polar webhook testing tool
2. [ ] Send test `checkout.updated` event
3. [ ] Check `api/logs.txt` for `[POLAR-WEBHOOK]` entry

---

## 📋 Endpoints Created

| File | Purpose | Required Config |
|------|---------|----------------|
| `api/polar-create-checkout.php` | Creates checkout URL with email | None |
| `api/polar-success.php` | Handles success redirect | `POLAR_ACCESS_TOKEN` |
| `api/polar-webhook.php` | Handles webhook events | `POLAR_WEBHOOK_SECRET` |
| `config/polar.php` | Configuration & helpers | Environment variables |

---

## 📝 Next Steps

1. [ ] Add tokens to `.env` file
2. [ ] Configure Success URL in both Polar checkout links
3. [ ] Configure Webhook in Polar dashboard
4. [ ] Test with a real purchase
5. [ ] Monitor `api/logs.txt` for successful events

---

## 🆘 Quick Troubleshooting

**Email not pre-filled?**
→ Check browser console for API errors
→ Verify `api/polar-create-checkout.php` returns success

**Success redirect fails?**
→ Check `POLAR_ACCESS_TOKEN` is set
→ Look in `api/logs.txt` for errors

**Webhook not received?**
→ Verify URL matches exactly
→ Check `POLAR_WEBHOOK_SECRET` matches in both places
→ Test using Polar's webhook testing tool

**Access token expired?**
→ Go to Polar → Settings → API → Access Tokens
→ Create new token with same 4 scopes (customers, orders, checkouts, subscriptions)
→ Update `.env` with new token
→ Restart server
→ ⚠️ Set reminder to regenerate before next expiration!

**Note:** Webhooks will still work when access token expires (they use separate secret)

---

For detailed setup instructions, see [POLAR_SETUP_GUIDE.md](./POLAR_SETUP_GUIDE.md)

