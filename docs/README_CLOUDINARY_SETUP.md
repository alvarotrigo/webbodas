# Cloudinary Image Editor Setup

This guide explains how to set up and use the Cloudinary image editor integration for inline image editing in your sections.

## Features

- ✅ **Upload Images**: Upload images from local files, URLs, or camera
- ✅ **Crop & Resize**: Built-in cropping tool with free aspect ratio
- ✅ **Auto-Optimization**: Automatic format (WebP/AVIF) and quality optimization
- ✅ **Responsive Delivery**: Auto-responsive images with `w_auto` and `dpr_auto`
- ✅ **Inline Editing**: Click any image to replace or edit it

## Quick Start (Free Tier)

### Option 1: Using Demo Mode (No signup required)

The editor is pre-configured to use Cloudinary's demo account for testing:

```javascript
// Default configuration in cloudinary-image-editor.js
cloudName: 'demo'
uploadPreset: 'ml_default'
```

**Note**: Demo mode has limitations and uploaded images may be removed periodically.

### Option 2: Create Your Own Free Account (Recommended)

1. **Sign up for Cloudinary Free Tier**
   - Go to [https://cloudinary.com/users/register/free](https://cloudinary.com/users/register/free)
   - Free tier includes:
     - 25 GB storage
     - 25 GB monthly bandwidth
     - 25,000 monthly transformations
     - All core features

2. **Get Your Cloud Name**
   - After signing up, go to your [Dashboard](https://cloudinary.com/console)
   - Find your **Cloud name** (e.g., `my-cloud-name`)

3. **Create an Upload Preset**
   - Go to Settings → Upload → Upload presets
   - Click "Add upload preset"
   - **Important**: Set signing mode to **"Unsigned"** for client-side uploads
   - Name it (e.g., `my_upload_preset`)
   - Configure optional settings:
     - **Folder**: Specify a folder for organization (e.g., `sections`)
     - **Allowed formats**: `jpg, png, webp, gif, svg`
     - **Max file size**: `10000000` (10MB)
     - **Max dimensions**: Width: `4000px`, Height: `4000px`
   - Click "Save"

4. **Update Configuration**
   - Open `public/js/cloudinary-image-editor.js`
   - Update lines 10-11:
   ```javascript
   this.cloudName = config.cloudName || 'YOUR_CLOUD_NAME_HERE';
   this.uploadPreset = config.uploadPreset || 'YOUR_UPLOAD_PRESET_HERE';
   ```
   - Or update the initialization at the bottom:
   ```javascript
   window.cloudinaryImageEditor = new CloudinaryImageEditor({
       cloudName: 'YOUR_CLOUD_NAME_HERE',
       uploadPreset: 'YOUR_UPLOAD_PRESET_HERE'
   });
   ```

## How It Works

### User Experience

1. **Hover over any image** in a section → Edit icon appears
2. **Click the image** → Cloudinary Upload Widget opens
3. **Upload or select image** → Cropping tool appears (optional)
4. **Crop if desired** → Click "Crop & Upload" or "Skip Cropping"
5. **Image is uploaded** → Automatically replaces the original image
6. **Success notification** appears → Image is now optimized and delivered via Cloudinary CDN

### Automatic Optimizations

All uploaded images are automatically optimized with:

- **Format optimization** (`f_auto`): Delivers WebP/AVIF when supported
- **Quality optimization** (`q_auto:good`): Balances quality and file size
- **Responsive sizing** (`w_auto`): Adapts to device screen size
- **DPR optimization** (`dpr_auto`): Supports retina displays

Example transformed URL:
```
https://res.cloudinary.com/YOUR_CLOUD/image/upload/f_auto,q_auto:good,w_auto,dpr_auto/sample.jpg
```

### Architecture: Clean HTML Storage

### **Design Decision: Separation of Content and Editor State**

Following industry best practices (WordPress, TinyMCE, Notion, etc.), we store **clean HTML** without editor runtime attributes:

**What Gets Saved:**
- ✅ Image metadata: `data-cloudinary-public-id`, `data-cloudinary-format`, etc.
- ✅ Section content and structure
- ✅ User-created classes and styles

**What Gets Cleaned Before Saving:**
- ❌ `data-cloudinary-editable` (runtime)
- ❌ `data-cloudinary-hover-init` (runtime)
- ❌ `data-cloudinary-initialized` (runtime)
- ❌ `.cloudinary-image-wrapper` (unwrapped)
- ❌ `.cloudinary-edit-indicator` (removed)
- ❌ Inline `cursor: pointer` styles

**Benefits:**
1. **Storage Efficiency** - Smaller localStorage footprint
2. **Forward Compatibility** - HTML works even if editor changes
3. **No Conflicts** - Fresh initialization every time
4. **Export Ready** - Same HTML for save and download
5. **Industry Standard** - Matches TinyMCE, CKEditor patterns

### **How It Works:**

```javascript
// On Save (localStorage/download)
sendSectionsData() {
    // Clone section
    // Clean TinyMCE attributes
    // Clean Cloudinary attributes  ← New!
    // Return clean HTML
}

// On Load (page restore)
initForSection() {
    // HTML is clean, no wrappers/indicators
    // Create fresh wrappers
    // Add fresh event listeners
    // Everything works!
}
```

## Technical Details

**Initialization Flow:**

1. `cloudinary-image-editor.js` loads on page load
2. Cloudinary Upload Widget script is loaded dynamically
3. When a section is added (`addSection()`), `initForSection()` is called
4. All `<img>` tags in the section become editable
5. Click handlers and visual indicators are added

**Data Storage:**

When an image is uploaded, the following data attributes are stored:

```html
<img 
  src="https://res.cloudinary.com/.../optimized.jpg"
  data-cloudinary-public-id="sample"
  data-cloudinary-format="jpg"
  data-cloudinary-width="1920"
  data-cloudinary-height="1080"
  data-cloudinary-editable="true"
/>
```

## Customization

### Change Default Transformations

Edit the `getOptimizedUrl()` method in `cloudinary-image-editor.js`:

```javascript
getOptimizedUrl(info) {
    const baseUrl = `https://res.cloudinary.com/${this.cloudName}/${info.resource_type}/upload/`;
    
    // Customize transformations here
    const transformations = 'f_auto,q_auto:good,w_auto,dpr_auto';
    // Example: Add blur or grayscale
    // const transformations = 'f_auto,q_auto:good,w_auto,e_blur:300';
    
    const imageId = `${info.public_id}.${info.format}`;
    return `${baseUrl}${transformations}/${imageId}`;
}
```

### Disable Cropping

In `openUploadWidget()`, change:

```javascript
cropping: false, // Set to false to disable cropping
```

### Change Allowed File Types

In `openUploadWidget()`, update:

```javascript
clientAllowedFormats: ['png', 'jpg', 'jpeg', 'gif', 'webp'], // Remove svg if needed
```

### Change Max File Size

```javascript
maxImageFileSize: 10000000, // 10MB (in bytes)
```

## Advanced Features

### Programmatic Upload

You can also trigger image upload programmatically:

```javascript
// Get the editor instance
const editor = window.cloudinaryImageEditor;

// Open widget for a specific image
editor.currentImage = document.querySelector('#my-image');
editor.openUploadWidget();
```

### Custom Upload Sources

Enable/disable upload sources in the widget configuration:

```javascript
sources: ['local', 'url', 'camera', 'image_search', 'google_drive', 'dropbox']
```

Note: Some sources require additional API keys.

### Image Transformations

Cloudinary supports 100+ transformations. Examples:

```javascript
// Circular crop
const transformations = 'f_auto,q_auto,w_400,h_400,c_fill,r_max';

// Add border
const transformations = 'f_auto,q_auto,bo_5px_solid_rgb:000000';

// Apply effects
const transformations = 'f_auto,q_auto,e_grayscale';

// Overlay watermark
const transformations = 'f_auto,q_auto,l_watermark,o_50';
```

Learn more: [Cloudinary Transformations](https://cloudinary.com/documentation/image_transformations)

## Troubleshooting

### Widget doesn't open
- Check browser console for errors
- Verify cloud name and upload preset are correct
- Ensure upload preset is set to "unsigned"

### Images not uploading
- Check upload preset settings (signing mode must be "unsigned")
- Verify file size is under the limit
- Check allowed formats in upload preset

### Images not displaying after upload
- Check browser console for CORS errors
- Verify the Cloudinary account is active
- Check that the public ID is correct

### Edit icon not appearing
- Verify the Cloudinary script is loaded: `window.cloudinaryImageEditor`
- Check that `initForSection()` was called for the section
- Inspect the image element for `data-cloudinary-editable="true"`

## Free Tier Limits

Cloudinary Free Tier includes:
- **25 GB** storage
- **25 GB/month** bandwidth
- **25,000/month** transformations
- **10,000** images and videos
- **Unlimited** optimization

If you exceed limits, consider:
- Upgrading to a paid plan
- Optimizing image sizes before upload
- Using Cloudinary's auto-optimization to reduce transformations

## Security Notes

- **Unsigned uploads** are used for client-side uploads
- For production, consider:
  - Using **signed uploads** with a backend
  - Implementing **upload restrictions** (file size, format, etc.)
  - Setting up **asset moderation** for user-generated content
  - Enabling **Cloudinary AI Moderation** add-on

## Resources

- [Cloudinary Documentation](https://cloudinary.com/documentation)
- [Upload Widget Reference](https://cloudinary.com/documentation/upload_widget_reference)
- [Image Transformations](https://cloudinary.com/documentation/image_transformations)
- [Optimization Guide](https://cloudinary.com/documentation/image_optimization)
- [Free Tier Details](https://cloudinary.com/pricing)

## Support

For issues specific to this integration:
1. Check browser console for errors
2. Verify configuration in `cloudinary-image-editor.js`
3. Test with demo mode first

For Cloudinary-specific issues:
- [Cloudinary Support](https://support.cloudinary.com/)
- [Community Forum](https://community.cloudinary.com/)

