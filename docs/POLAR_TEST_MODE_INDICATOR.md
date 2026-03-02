# Polar Test Mode Indicator

## Overview

The application now displays a prominent yellow banner at the top of the page when running in Polar test/sandbox mode. This helps developers and testers clearly identify when they're working with test data.

## Features

- **Prominent Visual Indicator**: Yellow gradient banner at the top of all main pages
- **Clear Messaging**: States "POLAR TEST MODE: Changes you make here don't affect your live account • Payments are not processed"
- **Warning Icon**: Alert triangle icon for visual emphasis
- **Fixed Position**: Banner stays at the top while scrolling
- **Auto-adjustment**: Content automatically adjusts to accommodate the banner

## How to Enable Test Mode

Test mode is controlled by the `POLAR_TEST_MODE` environment variable in your `.env` file:

```bash
# Enable Polar test mode
POLAR_TEST_MODE=true

# Disable Polar test mode (production)
POLAR_TEST_MODE=false
```

### Complete .env Configuration

Your `.env` file should include these Polar-related variables:

```bash
# Polar Test Mode
POLAR_TEST_MODE=true

# Production Credentials
POLAR_ACCESS_TOKEN=your_production_access_token_here
POLAR_WEBHOOK_SECRET=your_production_webhook_secret_here
POLAR_CHECKOUT_ANNUAL=your_annual_checkout_link_here
POLAR_CHECKOUT_LIFETIME=your_lifetime_checkout_link_here

# Sandbox/Test Credentials (used when POLAR_TEST_MODE=true)
POLAR_ACCESS_TOKEN_SANDBOX=your_sandbox_access_token_here
POLAR_WEBHOOK_SECRET_SANDBOX=your_sandbox_webhook_secret_here
POLAR_CHECKOUT_ANNUAL_SANDBOX=your_sandbox_annual_checkout_link_here
POLAR_CHECKOUT_LIFETIME_SANDBOX=your_sandbox_lifetime_checkout_link_here
```

## Implementation Details

### Files Modified

1. **app.php** - Editor page
2. **pages.php** - Pages list

Both files now:
- Include the `config/polar.php` configuration file
- Check `isPolarTestMode()` function
- Display the banner conditionally when test mode is active
- Adjust body padding to prevent content from being hidden under the banner

### Banner Styling

The banner uses:
- Yellow gradient background (`#fef3c7` to `#fde68a`)
- Dark brown text (`#92400e`)
- Fixed positioning (z-index: 999999)
- 44px height
- Auto-adjusts body padding

## Testing

To test the indicator:

1. Set `POLAR_TEST_MODE=true` in your `.env` file
2. Restart your PHP server (if needed)
3. Navigate to any main page (app.php or pages.php)
4. You should see the yellow banner at the top

To verify production mode:

1. Set `POLAR_TEST_MODE=false` in your `.env` file
2. Restart your PHP server
3. The banner should not appear

## Related Files

- `config/polar.php` - Polar configuration and helper functions
- `.env` - Environment configuration file
- `POLAR_SANDBOX_SUMMARY.md` - Complete Polar sandbox documentation

