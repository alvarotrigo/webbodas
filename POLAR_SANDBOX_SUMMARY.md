# Polar Sandbox Implementation - Summary

## What Was Done

Your Polar integration now fully supports **sandbox/test mode** for safe testing without affecting production data.

## Changes Made

### 1. Environment Variables (`.env.example`)

Added sandbox credential placeholders:
```env
# Sandbox Credentials
POLAR_ACCESS_TOKEN_SANDBOX=
POLAR_WEBHOOK_SECRET_SANDBOX=

# Test Mode Toggle
POLAR_TEST_MODE=false

# Sandbox Checkout Links
POLAR_CHECKOUT_ANNUAL_SANDBOX=
POLAR_CHECKOUT_LIFETIME_SANDBOX=
```

### 2. Configuration (`config/polar.php`)

Updated to automatically switch between environments based on `POLAR_TEST_MODE`:

**When `POLAR_TEST_MODE=true`:**
- Uses `POLAR_ACCESS_TOKEN_SANDBOX`
- Uses `POLAR_WEBHOOK_SECRET_SANDBOX`
- API URL: `https://sandbox-api.polar.sh/v1`
- Uses sandbox checkout links

**When `POLAR_TEST_MODE=false` (default):**
- Uses `POLAR_ACCESS_TOKEN`
- Uses `POLAR_WEBHOOK_SECRET`
- API URL: `https://api.polar.sh/v1`
- Uses production checkout links

### 3. API Endpoints

Updated three API files with sandbox support:

#### `api/polar-create-checkout.php`
- Logs which environment is active (SANDBOX/PRODUCTION)
- Validates checkout URLs are configured
- Provides clear error messages if sandbox URLs are missing

#### `api/polar-webhook.php`
- Logs environment on each webhook
- Marks test subscriptions with `[TEST]` prefix in customer name
- Uses correct webhook secret for signature verification

#### `api/polar-success.php`
- Logs environment on success redirects
- Marks test subscriptions with `[TEST]` prefix
- Handles sandbox API responses

### 4. Frontend (`public/js/upgrade-modal.js`)

- Added documentation about test mode
- Clarified that checkout URLs come from backend
- No functional changes needed (already works via API)

### 5. Visual Test Mode Indicator (NEW)

Added a prominent yellow banner that appears at the top of all pages when in test mode:

- **Location**: `app.php` and `pages.php`
- **Design**: Yellow gradient banner with warning icon
- **Message**: "POLAR TEST MODE: Changes you make here don't affect your live account • Payments are not processed"
- **Visibility**: Fixed at top of page, always visible while scrolling
- **Automatic**: Shows only when `POLAR_TEST_MODE=true`

This makes it immediately obvious when you're working with test data!

### 6. Documentation

Created comprehensive guides:

- **`docs/POLAR_TEST_MODE_INDICATOR.md`** - Visual indicator documentation (NEW)
- **`docs/POLAR_SANDBOX_SETUP.md`** - Complete setup guide with troubleshooting
- **`docs/POLAR_SANDBOX_QUICK_START.md`** - Quick reference for common tasks

## How to Use

### Enable Sandbox Mode

1. Get credentials from Polar Sandbox Dashboard
2. Add to `.env`:
   ```env
   POLAR_TEST_MODE=true
   POLAR_ACCESS_TOKEN_SANDBOX=your_token
   POLAR_WEBHOOK_SECRET_SANDBOX=your_secret
   POLAR_CHECKOUT_ANNUAL_SANDBOX=your_link
   POLAR_CHECKOUT_LIFETIME_SANDBOX=your_link
   ```
3. That's it! All Polar operations now use sandbox.

### Verify It's Working

Check `api/logs.txt` after a test transaction:
```
Environment: SANDBOX (test_mode=true)
API URL: https://sandbox-api.polar.sh/v1
```

Test subscriptions will have `[TEST]` prefix in customer names.

### Switch to Production

```env
POLAR_TEST_MODE=false
```

No code changes needed!

## Key Features

✅ **Visual Test Mode Indicator** - Yellow banner shows when in sandbox mode (NEW)
✅ **Automatic Environment Switching** - Just flip one variable
✅ **Clear Logging** - Always know which environment you're using
✅ **Test Data Marking** - Easy to identify and clean test subscriptions
✅ **Error Validation** - Clear messages if configuration is missing
✅ **Zero Code Changes** - Same codebase works for both environments
✅ **Webhook Support** - Proper signature verification for both modes

## Testing Workflow

```bash
# 1. Enable sandbox
POLAR_TEST_MODE=true

# 2. Test checkout flow
# - Click upgrade button
# - Complete with test card
# - Verify success redirect

# 3. Test webhooks
# - Check api/logs.txt
# - Verify subscription created
# - Check [TEST] prefix

# 4. Clean up test data
DELETE FROM subscriptions WHERE customer_name LIKE '[TEST]%';

# 5. Deploy to production
POLAR_TEST_MODE=false
```

## Files Modified

- `.env.example` - Sandbox credential placeholders
- `config/polar.php` - Environment auto-switching
- `api/polar-create-checkout.php` - Sandbox logging & validation
- `api/polar-webhook.php` - Sandbox logging & test marking
- `api/polar-success.php` - Sandbox logging & test marking
- `public/js/upgrade-modal.js` - Documentation updates
- **`app.php`** - Visual test mode indicator banner (NEW)
- **`pages.php`** - Visual test mode indicator banner (NEW)
- `docs/POLAR_SANDBOX_SETUP.md` - Complete guide (NEW)
- `docs/POLAR_SANDBOX_QUICK_START.md` - Quick reference (NEW)
- **`docs/POLAR_TEST_MODE_INDICATOR.md`** - Visual indicator documentation (NEW)

## Next Steps

1. **Get Sandbox Credentials**
   - Log in to Polar Dashboard
   - Switch to Sandbox mode
   - Copy API credentials and create test products

2. **Configure `.env`**
   - Copy sandbox credentials
   - Set `POLAR_TEST_MODE=true`
   - Add sandbox checkout links

3. **Test Everything**
   - Test checkout flow
   - Verify webhooks work
   - Check logs show SANDBOX mode
   - Verify subscriptions have [TEST] prefix

4. **Go Live**
   - Set `POLAR_TEST_MODE=false`
   - Verify production credentials are set
   - Test one real transaction
   - Monitor logs

## Support

- **Full Documentation**: See `docs/POLAR_SANDBOX_SETUP.md`
- **Quick Reference**: See `docs/POLAR_SANDBOX_QUICK_START.md`
- **Logs**: Check `api/logs.txt` and `debug/php_errors.log`
- **Polar Docs**: https://polar.sh/docs

## Summary

Your Polar integration is now fully equipped to handle both sandbox and production environments with a single configuration flag. No code changes are needed to switch between environments - just set `POLAR_TEST_MODE` in your `.env` file!

**Safe testing, smooth production! 🎉**

