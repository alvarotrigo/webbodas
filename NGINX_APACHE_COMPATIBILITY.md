# nginx and Apache Compatibility Solution

## Problem

The application was displaying "File not found" errors (404) on the production server (nginx) but worked fine locally (Apache). This was caused by:

1. **Missing URL rewrite rules**: The `.htaccess` file contained URL rewrite rules that weren't present in the nginx configuration
2. **Configuration drift**: The two environments had diverged in their configuration
3. **Different configuration formats**: Apache uses `.htaccess` while nginx requires server block configuration
4. **Location block priority**: nginx's regex location blocks were being overridden by other rules, causing URLs with trailing slashes (like `/signin/`) to return 404 errors

## Solution

This solution ensures both environments are compatible and synchronized:

### 1. Created `nginx.conf`

A complete nginx configuration file that mirrors all rules from `.htaccess`:

- **URL Rewrites** (using exact location matches for highest priority):
  - `/subscribe` or `/subscribe/` → `subscribe.php`
  - `/signin` or `/signin/` → `auth-wall.html`
  - `/app` or `/app/` → `app.php`

- **Security Headers**:
  - X-Frame-Options
  - X-XSS-Protection  
  - X-Content-Type-Options
  - Referrer-Policy

- **Cache Control**:
  - Static assets (images, fonts, CSS, JS)
  - Proper expiration times

- **PHP Settings**:
  - Upload limits
  - Execution timeouts
  - Error logging

### 2. Created `update-nginx.sh` Script

A helper script to safely update nginx configuration on the production server:

```bash
./update-nginx.sh
```

This script:
- Uploads the new `nginx.conf` to the server
- Creates a backup of the current configuration
- Applies the new configuration
- Tests the configuration before activating
- Rolls back automatically if there are errors
- Reloads nginx if successful

### 3. Updated `deploy.sh`

Added a reminder at the end of deployment about updating nginx configuration when URL rewrite rules change.

### 4. Created `DEPLOYMENT.md`

Comprehensive documentation covering:
- Environment differences
- Configuration synchronization
- Manual nginx update process
- Testing procedures
- Troubleshooting guide
- How to add new URL rewrites to both systems

## Files Modified

- **Created**: `nginx.conf` - Production nginx configuration
- **Created**: `update-nginx.sh` - Helper script for nginx updates
- **Created**: `DEPLOYMENT.md` - Deployment documentation
- **Created**: `NGINX_APACHE_COMPATIBILITY.md` - This file
- **Modified**: `deploy.sh` - Added nginx update reminder

## How to Deploy the Fix

### Step 1: Deploy Code (Already Done for Regular Deployments)

```bash
./deploy.sh
```

### Step 2: Update nginx Configuration (NEW - Do This Once)

```bash
./update-nginx.sh
```

This will:
1. Upload the new nginx configuration
2. Backup the current configuration
3. Apply and test the new configuration
4. Reload nginx

### Step 3: Test

After updating, test that the URL rewrites work:

```bash
# Test /signin rewrite
curl -I https://yeslovey.com/signin
# Should return 200 OK

# Test /subscribe rewrite
curl -I https://yeslovey.com/subscribe
# Should return 200 OK

# Test pages.php direct access
curl -I https://yeslovey.com/pages.php
# Should return 200 OK
```

## Future Workflow

### When Adding New URL Rewrites

1. **Update `.htaccess`** (for local Apache):
   ```apache
   RewriteCond %{REQUEST_FILENAME} !-f
   RewriteCond %{REQUEST_FILENAME} !-d
   RewriteRule ^your-route/?$ your-target.php [L,QSA]
   ```

2. **Update `nginx.conf`** (for production nginx):
   ```nginx
   # Use exact matches for highest priority
   location = /your-route {
     rewrite ^ /your-target.php last;
   }
   
   location = /your-route/ {
     rewrite ^ /your-target.php last;
   }
   ```

3. **Test locally** with Apache

4. **Deploy code**:
   ```bash
   ./deploy.sh
   ```

5. **Update nginx** on production:
   ```bash
   ./update-nginx.sh
   ```

6. **Test** on production

## Benefits

✅ **Consistency**: Both environments use the same rules  
✅ **Maintainability**: Single source of truth for each environment  
✅ **Safety**: Automatic backup and rollback on errors  
✅ **Documentation**: Clear process for updates  
✅ **Automation**: Scripts reduce manual steps and errors  

## Troubleshooting

### "File not found" errors persist

1. Check if nginx configuration was applied:
   ```bash
   ssh yeslovey "sudo cat /etc/nginx/sites-available/yeslovey.com | grep -A 3 signin"
   ```

2. Check nginx error log:
   ```bash
   ssh yeslovey "sudo tail -f /var/log/nginx/error.log"
   ```

3. Verify file permissions:
   ```bash
   ssh yeslovey "ls -la ~/htdocs/yeslovey.com/*.php"
   ```

### URL rewrites not working

1. Verify nginx was reloaded:
   ```bash
   ssh yeslovey "sudo systemctl status nginx"
   ```

2. Test nginx configuration:
   ```bash
   ssh yeslovey "sudo nginx -t"
   ```

### Different behavior between local and production

1. Compare configurations side by side
2. Check for typos in URLs or file names
3. Verify both configurations were updated

## Notes

- The `nginx.conf` file is **NOT** automatically applied by deployment
- You must manually run `./update-nginx.sh` to update nginx
- The `.htaccess` file is automatically loaded by Apache (local)
- Always keep both configuration files synchronized
- Test URL rewrites after any configuration changes

## Questions?

See `DEPLOYMENT.md` for more detailed information.

