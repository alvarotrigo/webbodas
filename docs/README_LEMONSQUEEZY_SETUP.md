# LemonSqueezy Subscription Integration Setup Guide

This guide will walk you through setting up LemonSqueezy subscriptions for your editor paywall system.

## Overview

The system allows users to subscribe via LemonSqueezy and gain PRO access to the editor. It integrates with your existing Clerk authentication and supports both legacy purchases and new LemonSqueezy subscriptions.

## Flow

1. User visits `/subscribe` 
2. If not logged in → redirected to login page → after login, redirected back to `/subscribe`
3. On subscribe page, user sees pricing and clicks "Start 3-day Trial for $1"
4. System creates a LemonSqueezy checkout session with user's Clerk email
5. User is redirected to LemonSqueezy checkout page
6. After successful payment, LemonSqueezy sends webhook to your server
7. Webhook handler saves subscription data to Supabase
8. User now has PRO access when logging into the editor

## Step 1: Set Up Supabase Database

### 1.1 Run the SQL Schema

1. Go to your Supabase project: https://bkvumiysdvjyuuvhqvnc.supabase.co
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy and paste the contents of `config/supabase-schema.sql`
5. Click **Run** to create the tables

This will create:
- `subscriptions` - Stores all subscription data from LemonSqueezy
- `users` - Stores all logged-in users (paying and non-paying) with pro status

### 1.2 Verify Tables

Go to **Table Editor** and verify both tables exist with the correct columns.

## Step 2: Set Up LemonSqueezy

### 2.1 Create Your Product (Already Done in Test Mode)

You mentioned you already created a product in test mode. Great! Now you need to get the IDs.

### 2.2 Get Your API Key

1. Go to [LemonSqueezy Settings > API](https://app.lemonsqueezy.com/settings/api)
2. Click **Create API Key**
3. Give it a name like "ModernCo Editor API"
4. Copy the API key (you'll only see it once!)

### 2.3 Get Your Store ID

1. Go to [LemonSqueezy Settings > Stores](https://app.lemonsqueezy.com/settings/stores)
2. Click on your store name
3. Look at the URL: `https://app.lemonsqueezy.com/stores/{STORE_ID}`
4. Copy the `STORE_ID` number

### 2.4 Get Your Product and Variant IDs

1. Go to [Products](https://app.lemonsqueezy.com/products)
2. Click on your subscription product
3. Look at the URL: `https://app.lemonsqueezy.com/products/{PRODUCT_ID}`
4. Copy the `PRODUCT_ID`
5. Scroll down to the **Variants** section
6. Click on your variant (e.g., "Monthly Plan")
7. Look at the URL: `https://app.lemonsqueezy.com/products/{PRODUCT_ID}/variants/{VARIANT_ID}`
8. Copy the `VARIANT_ID`

### 2.5 Update Configuration

Edit `config/lemonsqueezy.php` and add your credentials:

```php
// Production API key
define('LEMONSQUEEZY_API_KEY', 'your-production-api-key-here');

// Test API key (for testing)
define('LEMONSQUEEZY_TEST_API_KEY', 'your-test-api-key-here');

// Production IDs
define('LEMONSQUEEZY_STORE_ID', 'your-store-id-here');
define('LEMONSQUEEZY_PRODUCT_ID', 'your-product-id-here');
define('LEMONSQUEEZY_VARIANT_ID', 'your-variant-id-here');

// Test IDs (if different from production - leave empty to use production IDs)
define('LEMONSQUEEZY_TEST_STORE_ID', '');
define('LEMONSQUEEZY_TEST_PRODUCT_ID', '');
define('LEMONSQUEEZY_TEST_VARIANT_ID', '');
```

### 2.6 Test Mode Configuration

The system supports switching between test and production modes. You can enable test mode in two ways:

**Option 1: Environment Variable (Recommended)**
```bash
export LEMONSQUEEZY_TEST_MODE=true
```

**Option 2: Edit Config File**
Edit `config/lemonsqueezy.php` and change the default:
```php
define('LEMONSQUEEZY_TEST_MODE', true); // Change false to true
```

When test mode is enabled:
- The system uses `LEMONSQUEEZY_TEST_API_KEY` instead of `LEMONSQUEEZY_API_KEY`
- If test store/product/variant IDs are set, those are used; otherwise production IDs are used
- All API calls are logged with the mode being used

**To check which mode is active:**
- Check the error logs - you'll see messages like: `LemonSqueezy Checkout - Mode: TEST` or `Mode: PRODUCTION`
- Or use the `isLemonSqueezyTestMode()` function in your code

## Step 3: Set Up Webhooks

### 3.1 Configure Webhook Endpoint

1. Go to [LemonSqueezy Settings > Webhooks](https://app.lemonsqueezy.com/settings/webhooks)
2. Click **+** to add a new webhook
3. **Callback URL**: `https://studio.fullpagejs.com/api/subscription-webhook.php`
   - For local testing, you can use ngrok: `https://your-ngrok-url/api/subscription-webhook.php`
4. **Signing Secret**: Click "Generate" and copy the secret
5. **Events to listen for** - Select these events:
   - ✅ `subscription_created`
   - ✅ `subscription_updated`
   - ✅ `subscription_cancelled`
   - ✅ `subscription_resumed`
   - ✅ `subscription_expired`
   - ✅ `subscription_paused`
   - ✅ `subscription_unpaused`
   - ✅ `subscription_payment_success`
   - ✅ `subscription_payment_failed`
6. Click **Save**

### 3.2 Add Webhook Secret to Config

Edit `config/lemonsqueezy.php`:

```php
define('LEMONSQUEEZY_WEBHOOK_SECRET', 'your-webhook-signing-secret');
```

## Step 4: Test the Integration

### 4.1 Test Local Development (Optional)

If you want to test webhooks locally:

1. Install ngrok: `brew install ngrok` (Mac) or download from [ngrok.com](https://ngrok.com)
2. Start your local PHP server: `php -S localhost:8000`
3. Start ngrok: `ngrok http 8000`
4. Copy the HTTPS URL from ngrok (e.g., `https://abc123.ngrok.io`)
5. Update the webhook URL in LemonSqueezy to: `https://abc123.ngrok.io/api/subscription-webhook.php`

### 4.2 Test the Full Flow

1. **Open the subscribe page**: Navigate to `https://studio.fullpagejs.com/subscribe`
2. **Login**: If not logged in, you'll be redirected to login
3. **Click Subscribe**: Click "Start 3-day Trial for $1"
4. **Complete Checkout**: Use LemonSqueezy test card:
   - Card: `4242 4242 4242 4242`
   - Expiry: Any future date
   - CVC: Any 3 digits
5. **Check Webhook**: After payment, check `debug/php_errors.log` for webhook events
6. **Verify Database**: Check Supabase → Table Editor → `subscriptions` for new row
7. **Test Editor Access**: Go to editor and verify PRO access

### 4.3 Verify PRO Access

After subscribing:

1. Go to `app.php`
2. Open browser console
3. You should see PRO features enabled
4. Check the user status via: `api/auth-handler.php` (GET request)

## Step 5: Understanding the Code

### Key Files

1. **`config/lemonsqueezy.php`** - LemonSqueezy configuration and Supabase client
2. **`subscribe.html`** - Subscription page with pricing and checkout button
3. **`api/create-checkout.php`** - Creates LemonSqueezy checkout sessions
4. **`api/subscription-webhook.php`** - Handles webhook events from payment provider
5. **`api/check-subscription.php`** - Checks if user has active subscription
6. **`config/database.php`** - Updated with `checkUserPaidStatusAllSources()`

### How Subscription Check Works

When a user logs in:

1. `auth-handler.php` calls `checkUserPaidStatusAllSources($email)`
2. This function first checks legacy purchases in MySQL
3. If no legacy purchase, it checks LemonSqueezy subscriptions in Supabase
4. Returns `is_paid: true` if either source has valid subscription
5. User session is updated with paid status

### Webhook Events Handled

- **subscription_created**: New subscription → Save to database
- **subscription_updated**: Subscription changed → Update database
- **subscription_cancelled**: User cancelled → Mark as cancelled
- **subscription_expired**: Subscription ended → Mark as expired
- **subscription_payment_success**: Payment succeeded → Mark as active
- **subscription_payment_failed**: Payment failed → Mark as past_due

## Troubleshooting

### Webhooks Not Receiving Events

1. Check webhook URL is correct in LemonSqueezy
2. Check `debug/php_errors.log` for errors
3. Verify webhook secret matches in `config/lemonsqueezy.php`
4. Test webhook with LemonSqueezy "Send Test" button

### User Not Getting PRO Access

1. Check Supabase table has subscription row with `status = 'active'`
2. Verify email in subscription matches user's email
3. Check `debug/php_errors.log` for authentication errors
4. Clear browser localStorage and re-login

### Checkout Not Creating

1. Verify API key, Store ID, and Variant ID in `config/lemonsqueezy.php`
2. Check browser console for errors
3. Check `debug/php_errors.log` for API errors
4. Verify LemonSqueezy product is active (not draft)

### Local Development Issues

1. Make sure ngrok is running if testing webhooks locally
2. Update webhook URL in LemonSqueezy to ngrok URL
3. Remember to switch back to production URL when deploying

## Security Notes

1. **Never commit API keys** - Add `config/lemonsqueezy.php` to `.gitignore` if it contains real keys
2. **Webhook signature verification** - Always verify webhook signatures in production
3. **HTTPS required** - LemonSqueezy webhooks require HTTPS endpoints
4. **Service key security** - Keep Supabase service key secure, never expose to frontend

## Going to Production

1. **Switch to Live Mode** in LemonSqueezy
2. Create production product and variant
3. Update `config/lemonsqueezy.php` with production IDs
4. Update webhook URL to production domain
5. Generate new API key for production
6. Test the entire flow with a real card

## Support

If you encounter issues:

1. Check `debug/php_errors.log`
2. Check browser console
3. Check Supabase logs
4. Check LemonSqueezy webhook logs
5. Verify all IDs and API keys are correct

## Next Steps

After setup:

1. Customize pricing and features in `subscribe.html`
2. Add custom success/cancel pages
3. Add subscription management page
4. Add email notifications
5. Add analytics tracking
6. Implement trial period logic if needed

