# 🎯 Complete Paywall System - Setup Guide

## System Overview

Your paywall system is now fully implemented! Here's how it works:

### User Flow

1. **Free Users**
   - Can access editor with limited features
   - Pro sections show "Upgrade" badge
   - Clicking pro sections shows upgrade modal

2. **Authenticated Users (Not Subscribed)**
   - Same as free users but with saved preferences
   - Can see their account info
   - One-click upgrade to pro

3. **Pro Users (Subscribed via LemonSqueezy)**
   - Full access to all sections
   - No restrictions
   - Manage subscription

---

## 🚀 Quick Setup Checklist

### ✅ Step 1: Configure LemonSqueezy

1. **Add API credentials** to `config/lemonsqueezy.php`:
   ```php
   define('LEMONSQUEEZY_API_KEY', 'your-api-key');
   define('LEMONSQUEEZY_STORE_ID', 'your-store-id');
   define('LEMONSQUEEZY_PRODUCT_ID', 'your-product-id');
   define('LEMONSQUEEZY_VARIANT_ID', 'your-variant-id');
   define('LEMONSQUEEZY_WEBHOOK_SECRET', 'your-webhook-secret');
   ```

2. **Set up webhook** in LemonSqueezy:
   - URL: `https://studio.fullpagejs.com/api/subscription-webhook.php`
   - Select all `subscription_*` events
   - Copy signing secret to config

### ✅ Step 2: Set Up Supabase Tables

1. Go to: https://app.supabase.com/project/bkvumiysdvjyuuvhqvnc/sql
2. Click "New Query"
3. Copy SQL from `config/supabase-schema.sql`
4. Click "Run"

### ✅ Step 3: Test the System

1. Visit: `https://studio.fullpagejs.com/subscribe.html`
2. Log in with Clerk
3. Click "Start 3-day Trial"
4. Complete checkout (use test card: 4242 4242 4242 4242)
5. Check Supabase table for subscription
6. Go to editor and verify pro access

---

## 📁 File Structure

### Core Configuration
- `config/lemonsqueezy.php` - LemonSqueezy & Supabase config
- `config/database.php` - MySQL database & subscription checks
- `config/supabase-schema.sql` - Database schema

### API Endpoints
- `api/subscription-webhook.php` - Receives LemonSqueezy webhooks
- `api/create-checkout.php` - Creates checkout sessions
- `api/check-subscription.php` - Checks user subscription status
- `api/auth-handler.php` - Handles authentication

### Frontend Pages
- `subscribe.php` - Subscription/pricing page (accessible via `/subscribe`)
- `app.php` - Main editor (with paywall protection)
- `auth-wall.html` - Login page

### JavaScript
- `public/js/editor-paywall.js` - Paywall protection logic

---

## 🔗 Important URLs

### Production URLs
- **Editor**: `https://studio.fullpagejs.com/app.php`
- **Subscribe**: `https://studio.fullpagejs.com/subscribe`
- **Login**: `https://studio.fullpagejs.com/auth-wall.html`
- **Webhook**: `https://studio.fullpagejs.com/api/subscription-webhook.php`

### User Journey
```
┌─────────────────┐
│  User visits    │
│    /editor      │
└────────┬────────┘
         │
         ▼
    ┌─────────┐
    │ Logged  │
    │   in?   │
    └────┬────┘
         │
    ┌────┴────┐
    │         │
   No        Yes
    │         │
    ▼         ▼
┌────────┐ ┌────────┐
│ Allow  │ │ Check  │
│  Free  │ │  Paid? │
│ Access │ └───┬────┘
└────────┘     │
           ┌───┴───┐
           │       │
          No      Yes
           │       │
           ▼       ▼
      ┌────────┐ ┌────────┐
      │  Show  │ │  Full  │
      │Paywall │ │ Access │
      │ Modal  │ └────────┘
      └───┬────┘
          │
          ▼
    ┌──────────┐
    │Subscribe │
    │   Page   │
    └─────┬────┘
          │
          ▼
    ┌──────────┐
    │LemonSqzy │
    │Checkout  │
    └─────┬────┘
          │
          ▼
    ┌──────────┐
    │ Webhook  │
    │  Saves   │
    └─────┬────┘
          │
          ▼
    ┌──────────┐
    │   Pro    │
    │  Access  │
    └──────────┘
```

---

## 🎨 How It Works

### Subscription Check Flow

1. **User logs in** via Clerk
2. `auth-handler.php` calls `checkUserPaidStatusAllSources($email)`
3. Function checks:
   - **First**: Legacy MySQL purchases table
   - **Second**: LemonSqueezy subscriptions in Supabase
4. Returns `is_paid: true` if either source has active subscription
5. Editor updates `editorMode` to 'paid' or 'authenticated'
6. UI updates to show/hide pro features

### Webhook Processing

1. **User completes checkout** on LemonSqueezy
2. LemonSqueezy sends webhook to `subscription-webhook.php`
3. Webhook verifies signature
4. Extracts subscription data
5. Saves to Supabase `subscriptions` table
6. Links Clerk user ID to subscription
7. Next login: user automatically has pro access

### Pro Section Protection

In the editor:
```javascript
const isPaidUser = editorMode === 'paid';
const isProSection = section.is_pro === 1;

if (isProSection && !isPaidUser) {
    showUpgradeModal(); // Shows paywall
    return; // Blocks access
}
```

---

## 🔐 Security Features

1. **Webhook Signature Verification**
   - All webhooks are verified with HMAC signature
   - Prevents unauthorized webhook calls

2. **Row Level Security (RLS)**
   - Supabase tables have RLS policies
   - Service role (backend) has full access
   - Anon role (frontend) has read-only access

3. **Dual Verification**
   - Checks both localStorage and server
   - Prevents client-side tampering
   - Server is source of truth

4. **Clerk Authentication**
   - Secure user authentication
   - Email verification
   - Session management

---

## 🧪 Testing

### Test Cards (LemonSqueezy Test Mode)
- **Success**: 4242 4242 4242 4242
- **Declined**: 4000 0000 0000 0002

### Test Checklist

- [ ] Free user can access editor with limited features
- [ ] Free user sees "Upgrade" on pro sections
- [ ] Login redirects back to editor
- [ ] Subscribe page requires login
- [ ] Checkout creates subscription in Supabase
- [ ] Webhook saves subscription correctly
- [ ] User gets pro access after subscribing
- [ ] Pro sections are unlocked
- [ ] User can download pro content

### Verify Subscription

Check Supabase:
```sql
SELECT * FROM subscriptions 
WHERE customer_email = 'test@example.com';
```

Check via API:
```bash
curl -X POST https://studio.fullpagejs.com/api/check-subscription.php \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

---

## 🐛 Troubleshooting

### Webhook Not Receiving Events

1. Check URL is correct in LemonSqueezy
2. Verify webhook secret matches
3. Check `debug/php_errors.log`
4. Test webhook with "Send Test" button

### User Not Getting Pro Access

1. Check Supabase table has subscription row
2. Verify `status = 'active'`
3. Check email matches exactly
4. Clear localStorage and re-login
5. Check `debug/php_errors.log`

### Checkout Not Working

1. Verify all IDs in `config/lemonsqueezy.php`
2. Check API key is valid
3. Ensure product is active (not draft)
4. Check browser console for errors

---

## 📊 Database Tables

### lemonsqueezy_subscriptions
Stores all subscription data:
- `subscription_id` - Unique LemonSqueezy ID
- `customer_email` - User's email
- `status` - active, cancelled, expired, etc.
- `renews_at` - Next billing date
- `ends_at` - Cancellation date (if cancelled)

### users
Stores all logged-in users (paying and non-paying):
- `clerk_user_id` - Clerk user ID (unique)
- `email` - User's email address
- `is_pro` - Boolean indicating if user has active subscription
- `subscription_id` - Links to subscription in `subscriptions` table
- `pro_status_source` - Source of pro status: 'lemonsqueezy' or 'legacy'

---

## 🎯 Next Steps

### Recommended Enhancements

1. **Email Notifications**
   - Welcome email on subscription
   - Payment failed notifications
   - Cancellation confirmations

2. **Subscription Management**
   - Create user dashboard
   - Allow cancellation
   - Update payment method
   - View billing history

3. **Analytics**
   - Track conversion rates
   - Monitor churn
   - A/B test pricing

4. **Features**
   - Add multiple pricing tiers
   - Implement annual billing
   - Add team/enterprise plans
   - Offer add-ons

---

## 📝 Support

### Log Files
- `debug/php_errors.log` - PHP errors and webhook events
- Browser Console - Frontend errors

### Useful Commands

**Verify tables exist:**
```bash
php setup-supabase-tables.php
```

**Test webhook locally:**
```bash
ngrok http 8000
# Update webhook URL in LemonSqueezy to ngrok URL
```

**Check subscription:**
```php
php -r "
require 'config/lemonsqueezy.php';
\$status = checkLemonSqueezySubscription('user@example.com');
print_r(\$status);
"
```

---

## ✅ Completion Status

- [x] Supabase database tables created
- [x] LemonSqueezy configuration file
- [x] Subscription webhook handler
- [x] Checkout API endpoint
- [x] Subscribe page with login protection
- [x] User status checking (legacy + LemonSqueezy)
- [x] Editor paywall protection
- [x] Auth redirect flow
- [x] Documentation

---

## 🎉 You're All Set!

Your paywall system is complete and ready to accept subscriptions! Just complete the configuration steps above and test the flow.

**Questions?** Check the troubleshooting section or review the code comments in each file.

Good luck with your launch! 🚀

