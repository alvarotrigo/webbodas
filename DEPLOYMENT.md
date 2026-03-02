# Deployment Guide

This project supports both **Apache** (via `.htaccess`) and **nginx** environments.

## Environment Compatibility

### Local Development (Apache)
- Uses `.htaccess` file for URL rewriting and configuration
- Located in project root
- Automatically loaded by Apache

### Production Server (nginx)
- Uses `nginx.conf` file for URL rewriting and configuration
- Must be manually applied to nginx configuration
- Located in project root

## Keeping Configurations Synchronized

Both `.htaccess` and `nginx.conf` implement the same URL rewrite rules:

### URL Rewrites
- `/subscribe` or `/subscribe/` → `subscribe.php`
- `/signin` or `/signin/` → `auth-wall.html`
- `/app` → `app.php`
- `/app/` → redirects to `/app`

### Security Headers
- `X-Frame-Options: SAMEORIGIN`
- `X-XSS-Protection: 1; mode=block`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`

### Cache Control
- Images (jpg, png, svg, etc.): 1 year
- CSS/JS: 1 month
- Fonts (woff2, woff, ttf): 1 year

### PHP Settings
- `upload_max_filesize`: 64M
- `post_max_size`: 64M
- `max_execution_time`: 300 seconds
- `max_input_time`: 300 seconds
- Error logging enabled

## Updating nginx Configuration on Server

After deploying code changes, if you modified URL rewriting rules:

1. **Update the nginx configuration:**
   ```bash
   # Copy the new nginx.conf to the server
   scp nginx.conf fullpagestudio:/home/fullpagestudio/nginx.conf.new
   ```

2. **SSH to the server:**
   ```bash
   ssh fullpagestudio
   ```

3. **Apply the configuration:**
   ```bash
   # Backup current config
   sudo cp /etc/nginx/sites-available/studio.fullpagejs.com /etc/nginx/sites-available/studio.fullpagejs.com.backup
   
   # Copy new config
   sudo cp ~/nginx.conf.new /etc/nginx/sites-available/studio.fullpagejs.com
   
   # Test configuration
   sudo nginx -t
   
   # If test passes, reload nginx
   sudo systemctl reload nginx
   ```

## Deployment Script

The `deploy.sh` script handles code deployment:

```bash
./deploy.sh
```

**Note:** The deploy script does NOT automatically update nginx configuration. You must manually apply nginx config changes as shown above.

## Testing URL Rewrites

After deployment, test that URL rewrites work correctly:

### Test /signin
```bash
curl -I https://studio.fullpagejs.com/signin
# Should return 200 OK and serve auth-wall.html
```

### Test /subscribe  
```bash
curl -I https://studio.fullpagejs.com/subscribe
# Should return 200 OK and serve subscribe.php
```

### Test /app
```bash
curl -I https://studio.fullpagejs.com/app
# Should return 200 OK and serve app.php
```

### Test pages.php
```bash
curl -I https://studio.fullpagejs.com/pages.php
# Should return 200 OK
```

## Troubleshooting

### "File not found" errors on nginx

1. Check nginx error log:
   ```bash
   sudo tail -f /var/log/nginx/error.log
   ```

2. Verify the file exists:
   ```bash
   ls -la /home/fullpagestudio/htdocs/studio.fullpagejs.com/pages.php
   ```

3. Check nginx configuration:
   ```bash
   sudo nginx -t
   ```

4. Verify PHP-FPM is running:
   ```bash
   sudo systemctl status php-fpm
   ```

### URL rewrites not working

1. Verify nginx config was applied:
   ```bash
   sudo cat /etc/nginx/sites-available/studio.fullpagejs.com | grep -A 3 "location.*signin"
   ```

2. Check if nginx was reloaded:
   ```bash
   sudo systemctl reload nginx
   ```

### Different behavior between local and production

1. Compare configurations:
   - Local: Check `.htaccess` rules
   - Production: Check `nginx.conf` rules

2. Ensure both files are synchronized

3. Test URL patterns match exactly

## Adding New URL Rewrites

When adding new URL rewrites, update **BOTH** files:

1. **`.htaccess`** (for local Apache):
   ```apache
   RewriteCond %{REQUEST_FILENAME} !-f
   RewriteCond %{REQUEST_FILENAME} !-d
   RewriteRule ^your-route/?$ your-target.php [L,QSA]
   ```

2. **`nginx.conf`** (for production nginx):
   ```nginx
   location ~ ^/your-route/?$ {
     rewrite ^ /your-target.php last;
   }
   ```

3. Test locally with Apache

4. Deploy and test on production with nginx

5. Document the new route in this file

