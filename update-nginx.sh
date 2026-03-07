#!/bin/bash
# update-nginx.sh - Update nginx configuration on production server
# Usage: ./update-nginx.sh

set -euo pipefail

DEST_HOST="yeslovey"
LOCAL_CONFIG="nginx.conf"
REMOTE_TEMP="~/nginx.conf.new"
REMOTE_CONFIG="/etc/nginx/sites-available/studio.fullpagejs.com"
BACKUP_SUFFIX=".backup.$(date +%Y%m%d_%H%M%S)"

echo "🔧 Updating nginx configuration on production server..."
echo ""

# Check if local config exists
if [ ! -f "$LOCAL_CONFIG" ]; then
    echo "❌ Error: $LOCAL_CONFIG not found!"
    exit 1
fi

echo "📤 Uploading nginx.conf to server..."
scp "$LOCAL_CONFIG" "$DEST_HOST:$REMOTE_TEMP"

echo "🔐 Applying configuration (requires sudo)..."
ssh -t "$DEST_HOST" <<'EOF'
set -e

echo "📋 Creating backup of current config..."
sudo cp /etc/nginx/sites-available/studio.fullpagejs.com \
    /etc/nginx/sites-available/studio.fullpagejs.com.backup.$(date +%Y%m%d_%H%M%S)

echo "📝 Applying new configuration..."
sudo cp ~/nginx.conf.new /etc/nginx/sites-available/studio.fullpagejs.com

echo "✅ Testing nginx configuration..."
if sudo nginx -t; then
    echo "✅ Configuration test passed!"
    echo "🔄 Reloading nginx..."
    sudo systemctl reload nginx
    echo "✅ Nginx reloaded successfully!"
    echo ""
    echo "🎉 nginx configuration updated successfully!"
else
    echo "❌ Configuration test failed!"
    echo "🔄 Restoring previous configuration..."
    sudo cp /etc/nginx/sites-available/studio.fullpagejs.com.backup.$(date +%Y%m%d_%H%M%S) \
        /etc/nginx/sites-available/studio.fullpagejs.com
    echo "⚠️  Previous configuration restored. Please fix the errors and try again."
    exit 1
fi

# Clean up temp file
rm -f ~/nginx.conf.new
EOF

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ nginx configuration update complete!"
    echo ""
    echo "🧪 Test the URL rewrites:"
    echo "   curl -I https://studio.fullpagejs.com/signin"
    echo "   curl -I https://studio.fullpagejs.com/subscribe"
    echo "   curl -I https://studio.fullpagejs.com/pages.php"
else
    echo ""
    echo "❌ Failed to update nginx configuration!"
    exit 1
fi

