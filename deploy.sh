#!/bin/bash
# deploy.sh - Automated deployment script for Apache server
# Usage: ./deploy.sh [destination-path]

set -euo pipefail

# Configuration
DEST_HOST="fullpagestudio"
# Default destination path - adjusts to ./studio.fullpagejs.com on server
DEST_PATH="${1:-./htdocs/studio.fullpagejs.com}"

# Source directory (project root)
SRC_DIR="."

# Exclude patterns for rsync
EXCLUDES=(
  # Version control
  --exclude ".git"
  --exclude ".gitignore"
  --exclude ".cursorignore"
  
  # Dependencies
  --exclude "node_modules"
  --exclude "dist-ssr"
  
  # Environment & config
  # Note: .env is deployed separately to parent directory (outside web root)
  --exclude ".env"
  --exclude ".env.example"
  --exclude ".env.local"
  --exclude "*.local"
  
  # Editor files
  --exclude ".vscode"
  --exclude ".history"
  --exclude ".idea"
  --exclude ".DS_Store"
  
  # Source files (built output deployed instead)
  --exclude "index-src.html"
  
  # Build & development folders
  --exclude "/build"
  --exclude "/debug"
  --exclude "/docs"
  --exclude "/migrations"
  --exclude "/prototypes"
  --exclude "/scripts"
  --exclude "/src"
  --exclude "/tests"
  --exclude "playwright-report"
  --exclude "test-results"
  
  # Documentation
  --exclude "*.md"
  --exclude "README*"
  --exclude "CHANGELOG*"
  --exclude "TODO*"
  
  # Config examples
  --exclude "*.example"
  --exclude "env.example"
  
  # Package management
  --exclude "package.json"
  --exclude "package-lock.json"
  --exclude "bun.lockb"
  --exclude "composer.json"
  --exclude "composer.lock"
  
  # Build config files
  --exclude "vite.config.ts"
  --exclude "tailwind.config.js"
  --exclude "postcss.config.js"
  --exclude "tsconfig*.json"
  --exclude "eslint.config.js"
  --exclude "playwright.config.js"
  --exclude "components.json"
  
  # Build scripts
  --exclude "extract-sections.cjs"
  --exclude "screenshot-generator.cjs"
  --exclude "revert-container-queries.js"
  --exclude "update-container-queries.js"
  --exclude "dev.js"
  --exclude "deploy.sh"
  
  # Test files
  --exclude "test-*.php"
  --exclude "test-*.html"
  --exclude "quick-test.php"
  --exclude "debug-*.html"
  
  # Log files
  --exclude "*.log"
  --exclude "logs.txt"
  --exclude "errors.txt"
  --exclude "npm-debug.log*"
  --exclude "yarn-debug.log*"
  --exclude "yarn-error.log*"
  --exclude "pnpm-debug.log*"
  --exclude "lerna-debug.log*"
  
  # Config notes
  --exclude "nginx-config-fix.txt"
  --exclude ".ssh-tunnel.pid"
  
  # IDE files
  --exclude "*.suo"
  --exclude "*.ntvs*"
  --exclude "*.njsproj"
  --exclude "*.sln"
  --exclude "*.sw?"
)

echo "🚀 Starting deployment..."
echo "   Source: $SRC_DIR"
echo "   Destination: $DEST_HOST:$DEST_PATH"
echo ""

# Perform rsync with exclusions
rsync -avz --delete \
  "${EXCLUDES[@]}" \
  "$SRC_DIR/" \
  "$DEST_HOST:$DEST_PATH/"

echo ""
echo "✅ Files synced successfully!"

# Deploy .env to parent directory (outside web root for security)
echo ""
echo "🔒 Deploying .env file to secure location..."

if [ -f "$SRC_DIR/.env" ]; then
  # Deploy .env to /home/fullpagestudio/ (parent of htdocs)
  rsync -avz "$SRC_DIR/.env" "$DEST_HOST:~/.env"
  echo "✅ .env deployed to ~/  (outside web root)"
else
  echo "⚠️  No .env file found locally - skipping .env deployment"
  echo "   Make sure .env exists on the server at: /home/fullpagestudio/.env"
fi

# Update nginx configuration
echo ""
echo "📝 Updating nginx configuration..."

# Try to update nginx config (will prompt for password if needed)
if ssh -t $DEST_HOST bash <<'EOF'
set -e

# Check if nginx.conf exists in the deployed files
if [ -f ~/htdocs/studio.fullpagejs.com/nginx.conf ]; then
  echo "📋 Creating backup of current nginx config..."
  sudo cp /etc/nginx/sites-available/studio.fullpagejs.com \
      /etc/nginx/sites-available/studio.fullpagejs.com.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null || true
  
  echo "📝 Applying new nginx configuration..."
  sudo cp ~/htdocs/studio.fullpagejs.com/nginx.conf /etc/nginx/sites-available/studio.fullpagejs.com
  
  echo "✅ Testing nginx configuration..."
  if sudo nginx -t 2>&1 | grep -q "successful\|test is successful"; then
    echo "✅ Configuration test passed!"
    echo "🔄 Reloading nginx..."
    sudo systemctl reload nginx
    echo "✅ Nginx configuration updated and reloaded!"
  else
    echo "❌ Configuration test failed!"
    echo "🔄 Restoring previous configuration..."
    LATEST_BACKUP=$(ls -t /etc/nginx/sites-available/studio.fullpagejs.com.backup.* 2>/dev/null | head -1)
    if [ -n "$LATEST_BACKUP" ]; then
      sudo cp "$LATEST_BACKUP" /etc/nginx/sites-available/studio.fullpagejs.com
      echo "⚠️  Previous configuration restored."
    fi
    exit 1
  fi
  exit 0
else
  echo "⚠️  No nginx.conf found in deployment, skipping nginx update."
  exit 0
fi
EOF
then
  echo ""
  echo "✅ Deployment complete!"
  echo ""
  echo "🧪 Test your fixes:"
  echo "   https://studio.fullpagejs.com/signin/"
  echo "   https://studio.fullpagejs.com/subscribe/"
else
  echo ""
  echo "⚠️  Deployment completed but nginx configuration update failed!"
  echo ""
  echo "Please run this command manually in your terminal:"
  echo "   ssh -t fullpagestudio 'sudo cp ~/htdocs/studio.fullpagejs.com/nginx.conf /etc/nginx/sites-available/studio.fullpagejs.com && sudo nginx -t && sudo systemctl reload nginx'"
fi

