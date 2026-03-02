# Cloudinary Widget: Aspect Ratio Locked Cropping

## 🎯 Feature: Interactive Cropping with Aspect Ratio Constraint

When uploading a replacement image, the **Cloudinary Upload Widget's cropping tool** is now constrained to match the original image's aspect ratio. Users can still choose which part of the image to keep, but the crop frame maintains the correct proportions.

---

## 🎨 How It Works

### Step 1: User Clicks Image
```javascript
// When user clicks an image to replace
Original image: 400×300 (aspect ratio: 1.33)

→ Code detects: aspectRatio = 1.33
→ Stores for widget configuration
```

### Step 2: Upload Widget Opens
```javascript
// Widget is configured with locked aspect ratio
croppingAspectRatio: 1.33  // ← Enforced!
showSkipCropButton: false    // Can't skip when ratio locked
```

### Step 3: User Crops Image
```
User uploads: 2000×1500 portrait photo

Cloudinary Widget shows:
┌─────────────────────────┐
│                         │
│    ╔═══════════════╗    │ ← Crop frame locked
│    ║               ║    │   to 1.33 aspect ratio
│    ║  [PHOTO]      ║    │
│    ║               ║    │   User can drag to 
│    ║               ║    │   reposition but can't
│    ╚═══════════════╝    │   change the ratio
│                         │
│   [ Crop & Upload ]     │
└─────────────────────────┘
```

### Step 4: Result
```
✅ Cropped to 1.33 aspect ratio
✅ User chose the best framing
✅ Matches original image's proportions
✅ Fits perfectly in layout
```

---

## 💡 User Experience

### What Users See

1. **Click an image** to replace
2. **Upload dialog appears** - "Choose Image"
3. **Select a file** from computer
4. **Cropping interface opens** with message:
   ```
   Crop (1.33 ratio locked)
   Drag to reposition (ratio locked)
   ```
5. **User drags the image** to choose the best framing
6. **Crop frame stays at 1.33 ratio** - can't be changed
7. **Click "Crop & Upload"**
8. **Image uploads** and fits perfectly!

### Benefits for Users

- ✅ **Visual control** - See exactly what will be cropped
- ✅ **Perfect framing** - Choose the best part of the image
- ✅ **No surprises** - What you see is what you get
- ✅ **Consistent results** - Always matches layout
- ✅ **Professional look** - All images have correct proportions

---

## 🔧 Technical Implementation

### When Image is Clicked

```javascript
// Detect and store aspect ratio
const naturalWidth = img.naturalWidth;    // 400
const naturalHeight = img.naturalHeight;  // 300
this.currentImageAspectRatio = naturalWidth / naturalHeight;  // 1.33

console.log('📸 Current image aspect ratio: 1.333 (400×300)');
```

### When Upload Widget Opens

```javascript
// Create widget with aspect ratio constraint
cloudinary.createUploadWidget({
  cloudName: 'devdwphku',
  uploadPreset: 'fp_studio',
  cropping: true,
  croppingAspectRatio: 1.33,           // ← LOCKED!
  croppingShowDimensions: true,         // Show px dimensions
  showSkipCropButton: false,            // Must crop (can't skip)
  text: {
    crop: {
      title: 'Crop (1.33 ratio locked)',
      handle_tooltip: 'Drag to reposition (ratio locked)'
    }
  }
});
```

### Widget Behavior

| Aspect Ratio | Crop Behavior | Skip Button |
|--------------|---------------|-------------|
| **Locked (1.33)** | Frame fixed at 1.33 | ❌ Hidden |
| **Free (null)** | Any ratio allowed | ✅ Shown |

---

## 📊 Examples

### Example 1: Square Avatar (1:1)

**Original:** 300×300 (ratio: 1.00)

**Upload:** Portrait 3024×4032

**Widget Shows:**
```
Crop (1.00 ratio locked)

┌──────────────────┐
│  ╔════════════╗  │
│  ║            ║  │ ← Square crop frame
│  ║  Portrait  ║  │   Locked to 1:1
│  ║            ║  │
│  ╚════════════╝  │
│                  │
└──────────────────┘

User can drag portrait up/down to choose framing
Frame stays square!
```

**Result:** Perfect square crop ✅

### Example 2: Wide Banner (3:1)

**Original:** 1200×400 (ratio: 3.00)

**Upload:** Square 2048×2048

**Widget Shows:**
```
Crop (3.00 ratio locked)

┌──────────────────────────┐
│  ╔════════════════════╗  │
│  ║    Square Image    ║  │ ← Wide crop frame
│  ╚════════════════════╝  │   Locked to 3:1
└──────────────────────────┘

User can drag square left/right to choose framing
Frame stays 3:1!
```

**Result:** Perfect wide banner crop ✅

### Example 3: Portrait Card (2:3)

**Original:** 400×600 (ratio: 0.67)

**Upload:** Landscape 4000×3000

**Widget Shows:**
```
Crop (0.67 ratio locked)

┌────────────────────┐
│   ╔══════════╗     │
│   ║          ║     │
│   ║ Landscape║     │ ← Portrait crop frame
│   ║          ║     │   Locked to 2:3
│   ║          ║     │
│   ╚══════════╝     │
└────────────────────┘

User can drag landscape left/right to choose framing
Frame stays 2:3 portrait!
```

**Result:** Perfect portrait crop ✅

---

## 🎯 Console Logs

### What You'll See

```javascript
// 1. When clicking an image
📸 Current image aspect ratio: 1.333 (400×300)

// 2. When opening upload widget
📸 Forcing crop aspect ratio: 1.333 in upload widget

// 3. Widget opens with locked aspect ratio
// User sees: "Crop (1.33 ratio locked)"

// 4. After cropping and uploading
Upload successful: { width: 2000, height: 1500, ... }

// 5. Image is applied
📸 Original image aspect ratio: 1.33 (400×300)
📸 Image display size: 400x300px → Requesting: 800×600px (aspect ratio: 1.33, mode: fill)
```

---

## 🆚 Comparison

### Before (No Aspect Ratio Lock)

```
User uploads landscape to square container
→ Widget allows free cropping
→ User accidentally crops to 16:9
→ Result doesn't fit square container
→ Looks stretched or has empty space ❌
```

### After (With Aspect Ratio Lock)

```
User uploads landscape to square container
→ Widget enforces 1:1 crop
→ User can only crop to square
→ Result fits square container perfectly
→ Looks professional ✅
```

---

## 🎨 Widget UI Elements

### Title Bar
```
Before: "Crop"
After:  "Crop (1.33 ratio locked)"
```

### Tooltip
```
Before: "Drag handle to resize"
After:  "Drag to reposition (ratio locked)"
```

### Skip Button
```
Before: [Skip Cropping] button visible
After:  Button hidden (must crop to match ratio)
```

### Crop Frame
```
Before: Can resize to any shape
After:  Fixed ratio, can only move/zoom
```

---

## ⚙️ Configuration

### Widget Configuration

```javascript
{
  cropping: true,                        // Enable cropping
  croppingAspectRatio: 1.33,            // Lock to this ratio
  croppingShowDimensions: true,          // Show pixel dimensions
  croppingCoordinatesMode: 'custom',     // Allow custom coordinates
  showSkipCropButton: false,             // Force cropping (no skip)
  
  text: {
    crop: {
      title: 'Crop (1.33 ratio locked)',
      crop_btn: 'Crop & Upload',
      handle_tooltip: 'Drag to reposition (ratio locked)'
    }
  }
}
```

### Dynamic Per Image

The aspect ratio is **calculated dynamically** for each image:
- Square avatar → 1.00 ratio lock
- Wide banner → 3.00 ratio lock  
- Portrait card → 0.67 ratio lock

**Each image replacement gets its own widget with the correct ratio!**

---

## 🧪 Testing

### Test It Yourself

1. **Open your editor**
2. **Find a square team photo** (circular avatar)
3. **Click to replace it**
4. **Upload a portrait or landscape photo**
5. **Notice the crop frame is locked to square!**
6. **Drag the image** to choose framing
7. **Try to resize the frame** - it won't change ratio!
8. **Crop & Upload**
9. **Perfect square result** ✅

### Test Different Ratios

| Image Type | Original Ratio | Upload Type | Expected Crop |
|------------|----------------|-------------|---------------|
| Square avatar | 1:1 | Portrait | Square frame (1:1) |
| Wide banner | 3:1 | Square | Wide frame (3:1) |
| Portrait card | 2:3 | Landscape | Portrait frame (2:3) |
| Cinema header | 21:9 | Portrait | Cinema frame (21:9) |

---

## 📝 Benefits Summary

### For Users
- ✅ Visual control over cropping
- ✅ See what will be uploaded
- ✅ Choose best framing
- ✅ No unexpected results
- ✅ Professional-looking images

### For Developers
- ✅ Automatic aspect ratio detection
- ✅ No manual configuration needed
- ✅ Consistent results every time
- ✅ Works with any image ratio
- ✅ Clean, maintainable code

### For Design
- ✅ Layout consistency maintained
- ✅ No stretched/squished images
- ✅ Professional appearance
- ✅ Predictable results
- ✅ Better user experience

---

## 🎉 Result

**Users have full control over HOW their image is cropped, while the system ensures it's cropped to the CORRECT aspect ratio!**

Best of both worlds:
- 🎨 **User control** - Choose the framing
- 🔒 **System constraint** - Enforce correct ratio
- ✅ **Perfect fit** - Every time!

🚀 **Try it now!** Replace any image and watch the magic happen in the cropping interface.




