# Polar Sandbox/Test Environment Setup

This guide explains how to set up and use Polar's sandbox environment for testing payments without affecting production data.

## Overview

The Polar integration now supports both **production** and **sandbox/test** environments. This allows you to:
- Test payment flows without real transactions
- Verify webhook integrations safely
- Debug issues without affecting production users
- Develop new features in isolation

## Quick Start

### 1. Get Your Sandbox Credentials

1. Log in to your [Polar Dashboard](https://polar.sh/dashboard)
2. Switch to **Sandbox mode** (usually a toggle in the top navigation)
3. Go to **Settings** → **API Keys**
4. Generate or copy your **Sandbox Access Token**
5. Copy your **Sandbox Webhook Secret**

### 2. Create Test Products

1. In Polar Sandbox mode, go to **Products**
2. Create test versions of your products:
   - Annual subscription
   - Lifetime deal
3. For each product, create a **Checkout Link**
4. Copy the checkout URLs (they'll look like `https://sandbox.polar.sh/...`)

### 3. Configure Environment Variables

Copy your `.env.example` to `.env` if you haven't already:

```bash
cp .env.example .env
```

Then add your sandbox credentials to `.env`:

```env
# ==================================================
# POLAR.SH CONFIGURATION
# ==================================================

# Production Credentials (keep these secure!)
POLAR_ACCESS_TOKEN=polar_at_your_production_token_here
POLAR_WEBHOOK_SECRET=your_production_webhook_secret_here

# Sandbox/Test Credentials
POLAR_ACCESS_TOKEN_SANDBOX=polar_at_sandbox_your_test_token_here
POLAR_WEBHOOK_SECRET_SANDBOX=your_test_webhook_secret_here

# Test Mode: Set to 'true' to use sandbox, 'false' for production
POLAR_TEST_MODE=true

# Production Checkout Links
POLAR_CHECKOUT_ANNUAL=https://buy.polar.sh/polar_cl_your_prod_annual_here
POLAR_CHECKOUT_LIFETIME=https://buy.polar.sh/polar_cl_your_prod_lifetime_here

# Sandbox Checkout Links
POLAR_CHECKOUT_ANNUAL_SANDBOX=https://sandbox.polar.sh/your_test_annual_here
POLAR_CHECKOUT_LIFETIME_SANDBOX=https://sandbox.polar.sh/your_test_lifetime_here
```

### 4. Enable Test Mode

Set `POLAR_TEST_MODE=true` in your `.env` file:

```env
POLAR_TEST_MODE=true
```

That's it! Your application will now use the sandbox environment.

## How It Works

### Backend Configuration

The `config/polar.php` file automatically selects the correct credentials based on `POLAR_TEST_MODE`:

- **Test Mode Enabled** (`POLAR_TEST_MODE=true`):
  - Uses `POLAR_ACCESS_TOKEN_SANDBOX`
  - Uses `POLAR_WEBHOOK_SECRET_SANDBOX`
  - API URL: `https://sandbox-api.polar.sh/v1`
  - Uses sandbox checkout links

- **Production Mode** (`POLAR_TEST_MODE=false` or not set):
  - Uses `POLAR_ACCESS_TOKEN`
  - Uses `POLAR_WEBHOOK_SECRET`
  - API URL: `https://api.polar.sh/v1`
  - Uses production checkout links

### What Changes in Test Mode

1. **API Requests**: All Polar API calls go to the sandbox API
2. **Checkout Links**: Users are directed to sandbox checkout pages
3. **Webhooks**: Webhook signatures are verified using the sandbox secret
4. **Database Records**: Subscriptions created in test mode are marked with `[TEST]` prefix in the customer name
5. **Logging**: All logs indicate whether they're from SANDBOX or PRODUCTION

### Frontend Integration

The frontend (`public/js/upgrade-modal.js`) doesn't need to know about test mode. It simply:
1. Calls `api/polar-create-checkout.php` with user details
2. Receives the appropriate checkout URL (sandbox or production)
3. Redirects the user to that URL

The backend handles all the environment switching automatically.

## Testing Workflow

### 1. Testing Checkout Flow

1. Set `POLAR_TEST_MODE=true` in `.env`
2. Open your application
3. Click on upgrade/pricing buttons
4. Complete the checkout using Polar's test cards
5. Verify the success redirect works
6. Check that the user's pro status is updated

### 2. Testing Webhooks

#### Setup Webhook Endpoint

In Polar Sandbox Dashboard:
1. Go to **Settings** → **Webhooks**
2. Add your webhook URL: `https://yourdomain.com/api/polar-webhook.php`
3. Enable these events:
   - `checkout.created`
   - `checkout.updated`
   - `subscription.created`
   - `subscription.active`
   - `subscription.updated`
   - `subscription.canceled`
   - `order.created`

#### Test Webhook Events

1. Make a test purchase in sandbox mode
2. Check `api/logs.txt` for webhook logs
3. Verify the logs show:
   ```
   Environment: SANDBOX (test_mode=true)
   API URL: https://sandbox-api.polar.sh/v1
   ```
4. Confirm user pro status is updated correctly
5. Check that subscription records have `[TEST]` prefix

### 3. Reviewing Test Data

Test subscriptions in your database will have:
- `customer_name` starting with `[TEST]`
- Links to sandbox checkout/subscription IDs
- Standard `is_pro` and `pro_status_source` fields

You can filter test data with:

```sql
SELECT * FROM subscriptions WHERE customer_name LIKE '[TEST]%';
```

## Switching Between Environments

### Switch to Sandbox

```env
POLAR_TEST_MODE=true
```

### Switch to Production

```env
POLAR_TEST_MODE=false
```

**No code changes required!** The system automatically uses the correct:
- API credentials
- API endpoints
- Checkout links
- Webhook secrets

## Monitoring and Debugging

### Check Current Environment

All log files will show the current environment:

```
[2026-01-14 10:30:00] [POLAR-WEBHOOK] Environment: SANDBOX (test_mode=true)
[2026-01-14 10:30:00] [POLAR-WEBHOOK] API URL: https://sandbox-api.polar.sh/v1
```

### Log Files

- **Webhook logs**: `api/logs.txt`
- **PHP errors**: `debug/php_errors.log`
- **Server error log**: Check your server's error log

### Common Issues

#### "Checkout URL not configured"

**Error**: `Checkout URL not configured for plan: annual`

**Solution**: Make sure you've set the sandbox checkout links in `.env`:

```env
POLAR_CHECKOUT_ANNUAL_SANDBOX=https://sandbox.polar.sh/...
POLAR_CHECKOUT_LIFETIME_SANDBOX=https://sandbox.polar.sh/...
```

#### Webhook signature verification failed

**Error**: `Webhook signature verification failed`

**Solutions**:
1. Verify `POLAR_WEBHOOK_SECRET_SANDBOX` is set correctly in `.env`
2. Check that the webhook is configured in Polar Sandbox Dashboard
3. Ensure the webhook secret matches between `.env` and Polar Dashboard

#### API requests failing

**Error**: `Polar API error: Unauthorized`

**Solutions**:
1. Verify `POLAR_ACCESS_TOKEN_SANDBOX` is correct
2. Make sure the token has the required scopes
3. Check that the token hasn't expired

## Best Practices

### 1. Keep Environments Separate

- Never mix sandbox and production credentials
- Use different webhook endpoints if possible
- Consider using a separate test database

### 2. Clear Test Data

Periodically clean up test subscriptions:

```sql
DELETE FROM subscriptions WHERE customer_name LIKE '[TEST]%';
```

### 3. Test Before Production

Always test in sandbox before deploying to production:
- Test all payment flows
- Verify webhook handling
- Check success and error scenarios
- Test subscription cancellations

### 4. Use Git Ignored .env

Never commit your `.env` file to version control:

```bash
# .gitignore should include:
.env
```

Only commit `.env.example` with empty values.

## Production Deployment Checklist

Before going live with production:

- [ ] Set `POLAR_TEST_MODE=false`
- [ ] Add production API credentials
- [ ] Add production webhook secret
- [ ] Add production checkout links
- [ ] Test one sandbox transaction to verify mode is working
- [ ] Configure production webhooks in Polar Dashboard
- [ ] Monitor logs for any "SANDBOX" references (there should be none)
- [ ] Test a small real transaction
- [ ] Verify production webhooks are received and processed

## Support

If you encounter issues:

1. Check the logs in `api/logs.txt` and `debug/php_errors.log`
2. Verify environment variables are set correctly
3. Ensure `POLAR_TEST_MODE` matches your intent
4. Check [Polar's documentation](https://polar.sh/docs)
5. Review webhook payload formats in Polar Dashboard

## API Reference

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `POLAR_ACCESS_TOKEN` | Yes (prod) | Production API access token |
| `POLAR_WEBHOOK_SECRET` | Yes (prod) | Production webhook secret |
| `POLAR_ACCESS_TOKEN_SANDBOX` | Yes (test) | Sandbox API access token |
| `POLAR_WEBHOOK_SECRET_SANDBOX` | Yes (test) | Sandbox webhook secret |
| `POLAR_TEST_MODE` | No | `true` for sandbox, `false` for production (default: `false`) |
| `POLAR_CHECKOUT_ANNUAL` | Yes (prod) | Production annual checkout link |
| `POLAR_CHECKOUT_LIFETIME` | Yes (prod) | Production lifetime checkout link |
| `POLAR_CHECKOUT_ANNUAL_SANDBOX` | Yes (test) | Sandbox annual checkout link |
| `POLAR_CHECKOUT_LIFETIME_SANDBOX` | Yes (test) | Sandbox lifetime checkout link |

### Helper Functions

```php
// Check if in test mode
isPolarTestMode(); // Returns bool

// Get current API endpoint
POLAR_API_URL; // Returns string (sandbox or production URL)

// Get current access token (automatically selected)
getPolarAccessToken(); // Returns string

// Get checkout URL (automatically selects sandbox/production)
getPolarCheckoutUrl('annual'); // Returns string
getPolarCheckoutUrl('lifetime'); // Returns string
```

## Files Modified

The following files have been updated to support sandbox mode:

- `.env.example` - Added sandbox credential placeholders
- `config/polar.php` - Automatic environment switching
- `api/polar-create-checkout.php` - Logs environment, validates config
- `api/polar-webhook.php` - Logs environment, marks test subscriptions
- `api/polar-success.php` - Logs environment, marks test subscriptions
- `public/js/upgrade-modal.js` - Documentation updates

No changes required to use sandbox mode - just set `POLAR_TEST_MODE=true`!

