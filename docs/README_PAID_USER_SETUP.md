# Paid User Verification System Setup

This guide explains how to set up the paid user verification system that checks if users have purchased specific products and grants them paid access.

## Overview

The system integrates with Clerk authentication and checks a MySQL database to determine if a user has a valid paid subscription. Users are considered "paid" if they have purchased one of these products within the last 12 months:

- `fullpage-professional`
- `fullpage-professional-lifetime`
- `fullpage-business`
- `fullpage-business-lifetime`

## Database Setup

### 1. Database Table Structure

The system expects a `purchases` table with the following structure:

```sql
CREATE TABLE `purchases` (
  `id` mediumint(9) NOT NULL AUTO_INCREMENT,
  `purchase_id` varchar(30) DEFAULT NULL,
  `email` varchar(80) NOT NULL,
  `product` varchar(80) NOT NULL,
  `created` timestamp NOT NULL DEFAULT current_timestamp(),
  `license_id` smallint(1) NOT NULL,
  `license_key` char(37) DEFAULT NULL,
  `sent_discount` smallint(1) NOT NULL DEFAULT 0,
  `sent_quiz` tinyint(1) NOT NULL DEFAULT 0,
  `price` decimal(6,2) NOT NULL DEFAULT 0.00,
  `user_id` mediumint(9) NOT NULL DEFAULT 1,
  `country` varchar(80) NOT NULL,
  `sent_fullsnap` tinyint(1) NOT NULL DEFAULT 0,
  `gifter_email` varchar(80) DEFAULT NULL,
  `offer_code` varchar(120) DEFAULT NULL,
  `is_discover_sale` tinyint(1) DEFAULT 0,
  PRIMARY KEY (`id`)
);
```

### 2. Database Configuration

1. Copy the example configuration file:
   ```bash
   cp config/database.example.php config/database.php
   ```

2. Edit `config/database.php` and update with your database credentials:
   ```php
   define('DB_HOST', 'localhost');     // Your database host
   define('DB_NAME', 'your_database'); // Your database name
   define('DB_USER', 'your_username'); // Your database username
   define('DB_PASS', 'your_password'); // Your database password
   define('DB_CHARSET', 'utf8mb4');    // Character set
   ```

## File Structure

```
├── config/
│   ├── database.php              # Database configuration (create from example)
│   └── database.example.php      # Example database configuration
├── includes/
│   └── session-manager.php       # Session management functions
├── api/
│   ├── auth-handler.php          # Main authentication handler
│   ├── check-user-status.php     # Check user paid status
│   └── get-user-status.php       # Get current user status
├── auth-wall.html                # Updated authentication page
├── app.php                  # Updated editor with paid status
└── PAID_USER_SETUP.md           # This file
```

## How It Works

### 1. Authentication Flow

1. User signs in via Clerk (Google, GitHub, or Magic Link)
2. System extracts user email from Clerk
3. Backend checks database for valid purchases
4. User is classified as:
   - **Free**: No authentication or no valid purchases
   - **Authenticated**: Signed in but no valid purchases
   - **Paid**: Signed in with valid purchases

### 2. Paid Status Logic

A user is considered "paid" if they have:
- Purchased one of the valid products
- Purchase is within the last 12 months (or lifetime product)
- Most recent purchase is used if multiple exist

### 3. Session Management

- User status is stored in PHP sessions
- Status is cached for 5 minutes to reduce database queries
- Sessions expire after 30 minutes of inactivity

## API Endpoints

### 1. Authentication Handler (`/api/auth-handler.php`)

**POST** - Authenticate user and check paid status
```json
{
  "action": "authenticate",
  "email": "user@example.com",
  "name": "John Doe",
  "clerk_user_id": "user_123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "email": "user@example.com",
    "name": "John Doe",
    "is_authenticated": true,
    "is_paid": true,
    "mode": "paid",
    "subscription": {
      "status": "paid",
      "product": "fullpage-business-lifetime",
      "purchase_date": "2024-01-15 10:30:00",
      "is_lifetime": true
    }
  }
}
```

### 2. Check User Status (`/api/check-user-status.php`)

**GET** - Check paid status for an email
```
GET /api/check-user-status.php?email=user@example.com
```

**POST** - Check paid status with JSON
```json
{
  "email": "user@example.com"
}
```

### 3. Get Current User Status (`/api/get-user-status.php`)

**GET** - Get current session user status
```
GET /api/get-user-status.php
```

## Frontend Integration

### 1. User Interface Updates

The system updates the user interface to show:
- **Free Mode**: Orange indicator, "Free Mode" text
- **Authenticated**: Green indicator, "Free User" text
- **Paid**: Green indicator, "Paid User" text

### 2. JavaScript Functions

Key functions added to `app.php`:

```javascript
// Authenticate user with Clerk and check paid status
async function authenticateUserWithClerk(clerkUser)

// Check user paid status
async function checkUserPaidStatus(email)

// Update user interface based on status
function updateUserInterface()
```

## Testing

### 1. Test Database Connection

Create a test file `test-db.php`:

```php
<?php
require_once 'config/database.php';

try {
    $pdo = getDatabaseConnection();
    echo "Database connection successful!\n";
    
    // Test with a sample email
    $result = checkUserPaidStatus('test@example.com');
    echo "Test result: " . json_encode($result, JSON_PRETTY_PRINT);
    
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
```

### 2. Test API Endpoints

Use curl or Postman to test the API endpoints:

```bash
# Test authentication
curl -X POST http://localhost/your-project/api/auth-handler.php \
  -H "Content-Type: application/json" \
  -d '{"action":"authenticate","email":"test@example.com","name":"Test User"}'

# Test status check
curl "http://localhost/your-project/api/check-user-status.php?email=test@example.com"
```

## Security Considerations

1. **Database Security**:
   - Use prepared statements (already implemented)
   - Store database credentials securely
   - Limit database user permissions

2. **Session Security**:
   - Sessions expire after 30 minutes
   - Session data is validated on each request
   - CORS headers are properly configured

3. **Input Validation**:
   - Email addresses are validated
   - All inputs are sanitized
   - Error messages don't expose sensitive information

## Troubleshooting

### Common Issues

1. **Database Connection Failed**:
   - Check database credentials in `config/database.php`
   - Ensure MySQL server is running
   - Verify database and table exist

2. **CORS Errors**:
   - Ensure API endpoints are accessible
   - Check browser console for CORS errors
   - Verify server configuration

3. **Session Issues**:
   - Check PHP session configuration
   - Ensure session directory is writable
   - Verify session cookies are being set

### Debug Mode

Enable debug logging by adding to your PHP files:

```php
error_reporting(E_ALL);
ini_set('display_errors', 1);
```

### Log Files

Check PHP error logs for detailed error messages:
- Apache: `/var/log/apache2/error.log`
- Nginx: `/var/log/nginx/error.log`
- PHP: `/var/log/php_errors.log`

## Maintenance

### Regular Tasks

1. **Monitor Database Performance**:
   - Check query execution times
   - Optimize indexes if needed
   - Monitor database connections

2. **Session Cleanup**:
   - Sessions are automatically cleaned up by PHP
   - Monitor session storage usage

3. **Log Rotation**:
   - Rotate PHP error logs regularly
   - Monitor application logs for issues

### Updates

When updating the system:

1. Backup your database configuration
2. Test in a staging environment
3. Update files during low-traffic periods
4. Monitor for errors after deployment

## Support

For issues or questions:

1. Check the troubleshooting section above
2. Review PHP error logs
3. Test database connectivity
4. Verify API endpoint responses

The system is designed to gracefully handle errors and fall back to free mode if any issues occur. 