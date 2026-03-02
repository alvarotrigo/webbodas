# Polar Sandbox - Quick Reference

## TL;DR - Start Testing in 3 Steps

### 1. Get Sandbox Credentials from Polar

```
1. Go to https://polar.sh/dashboard
2. Switch to Sandbox mode (toggle in top nav)
3. Copy your Sandbox Access Token & Webhook Secret
4. Create test products and get checkout links
```

### 2. Add to `.env`

```env
POLAR_TEST_MODE=true

POLAR_ACCESS_TOKEN_SANDBOX=polar_at_sandbox_your_token_here
POLAR_WEBHOOK_SECRET_SANDBOX=your_sandbox_webhook_secret_here

POLAR_CHECKOUT_ANNUAL_SANDBOX=https://sandbox.polar.sh/your_annual_link
POLAR_CHECKOUT_LIFETIME_SANDBOX=https://sandbox.polar.sh/your_lifetime_link
```

### 3. Test!

```bash
# That's it! Your app now uses sandbox mode
# - All checkouts go to sandbox
# - All API calls go to sandbox
# - All webhooks verified with sandbox secret
# - Test subscriptions marked with [TEST] prefix
```

## Switch Back to Production

```env
POLAR_TEST_MODE=false
```

## Check Which Mode You're In

Look at your logs (`api/logs.txt`):

```
✓ SANDBOX mode:
[POLAR-WEBHOOK] Environment: SANDBOX (test_mode=true)
[POLAR-WEBHOOK] API URL: https://sandbox-api.polar.sh/v1

✓ PRODUCTION mode:
[POLAR-WEBHOOK] Environment: PRODUCTION (test_mode=false)
[POLAR-WEBHOOK] API URL: https://api.polar.sh/v1
```

## Test Cards

Use Polar's test card numbers in sandbox mode:
- Check [Polar's documentation](https://polar.sh/docs) for test card details

## Cleanup Test Data

```sql
-- View all test subscriptions
SELECT * FROM subscriptions WHERE customer_name LIKE '[TEST]%';

-- Delete test subscriptions
DELETE FROM subscriptions WHERE customer_name LIKE '[TEST]%';
```

## Production Checklist

Before going live:

```env
☐ Set POLAR_TEST_MODE=false
☐ Verify production credentials are set
☐ Test in sandbox one more time
☐ Deploy
☐ Test one real transaction
☐ Monitor logs (should show PRODUCTION)
```

## Need More Details?

See [POLAR_SANDBOX_SETUP.md](./POLAR_SANDBOX_SETUP.md) for complete documentation.

## Files That Changed

All files updated to support sandbox mode:
- `.env.example` - New sandbox variables
- `config/polar.php` - Auto environment switching
- `api/polar-create-checkout.php` - Sandbox logging
- `api/polar-webhook.php` - Sandbox logging & marking
- `api/polar-success.php` - Sandbox logging & marking
- `public/js/upgrade-modal.js` - Documentation

**No code changes needed to switch - just flip `POLAR_TEST_MODE`!**

