# Production Asset Build System - Setup Complete ✓

## Overview

Your production asset build system has been successfully implemented! This system provides:

- **Minified assets** for production (JS reduced by ~52%, CSS by ~27%)
- **Content hashing** for optimal CloudFlare CDN caching
- **Environment-aware loading** (original files in dev, minified in production)
- **Zero cache invalidation** needed on deployments

## File Size Improvements

Example reductions:
- `app.js`: 196K → 93K (52% reduction)
- `app.css`: 45K → 33K (27% reduction)

## How It Works

### Development Mode (APP_ENV=development)
- Loads original files from `public/js/` and `public/css/`
- Uses `filemtime()` for cache busting: `app.js?v=1706345678`
- No build step required during development

### Production Mode (APP_ENV=production)
- Loads minified, hashed files from `public/dist/`
- Content hash in filename: `app-62ec293b73.js`
- Aggressive CDN caching enabled (immutable assets)

## Usage

### Local Development
```bash
# No build needed! Just work on your code normally
# Assets load from public/js/ and public/css/ automatically
```

### Production Deployment

1. **Build assets:**
```bash
npm run build:prod
```
This runs:
- `tailwindcss` to build CSS
- `gulp` to minify and hash all JS/CSS files
- Generates `public/dist/rev-manifest.json`

2. **Deploy to server:**
- Upload code + `public/dist/` folder
- Set `APP_ENV=production` in your `.env` file

3. **Done!** 
- PHP automatically serves minified, hashed assets
- CloudFlare caches them forever (no purging needed)

## Files Modified

### New Files
- `gulpfile.js` - Build configuration
- `preview.php` - PHP version with environment-aware assets
- `PRODUCTION_BUILD_GUIDE.md` - This guide

### Updated Files
- `app.php` - Enhanced `editor_asset()` function
- `.env.example` - Added `APP_ENV` variable
- `.gitignore` - Ignores `public/dist/` folder
- `package.json` - Added `build:assets` and `build:prod` scripts

## CloudFlare CDN Configuration

With content hashing, you can set aggressive caching:

```
Cache Rule for /public/dist/*
Cache-Control: public, max-age=31536000, immutable
```

Benefits:
- Files cached for 1 year
- When content changes, new hash = new URL
- Zero cache invalidation needed
- Maximum performance

## Manifest Example

The build generates `public/dist/rev-manifest.json`:

```json
{
  "css/app.css": "css/app-619e56314b.css",
  "js/app.js": "js/app-62ec293b73.js",
  "js/history-manager.js": "js/history-manager-8288590db1.js"
}
```

PHP uses this to load the correct hashed version in production.

## Environment Variables

Add to your `.env` file:

```bash
# Development (local)
APP_ENV=development

# Production (live server)
APP_ENV=production
```

## Build Output

After running `npm run build:prod`, you'll see:

```
public/dist/
├── css/
│   ├── app-[hash].css
│   ├── sections-[hash].css
│   └── ...
├── js/
│   ├── app-[hash].js
│   ├── history-manager-[hash].js
│   └── sections/
│       └── fp-theme-gallery-thumbs-[hash].js
└── rev-manifest.json
```

## Troubleshooting

### Assets not loading in production?
1. Check `APP_ENV=production` is set in `.env`
2. Verify `public/dist/rev-manifest.json` exists
3. Check error logs for "Asset not found in manifest" messages

### Need to rebuild?
```bash
npm run build:assets
```

### Old build files piling up?
The build automatically cleans `public/dist/` before each run.

## What's Excluded from Build

The following are intentionally NOT minified:
- TinyMCE files (already minified: `tinymce.min.js`)
- Any files already ending in `.min.js` or `.min.css`
- External CDN resources (unpkg, fonts.googleapis.com, etc.)

## Next Steps

1. Test locally by setting `APP_ENV=production` temporarily
2. Verify assets load with hashed filenames
3. Deploy to production with `npm run build:prod`
4. Configure CloudFlare cache rules for `/public/dist/*`

---

**Note:** The `public/dist/` folder is gitignored. Build assets fresh on each deployment.
