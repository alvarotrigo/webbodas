# React Export Feature

## Overview

The React Export feature allows users to export their website designs as a complete React + Vite project. Each section in the editor is converted into a standalone React component, ready for development and deployment.

## Architecture

The React export feature consists of three main components:

### 1. Frontend JavaScript Module: `react-project-generator.js`

**Location:** `/public/js/react-project-generator.js`

**Responsibilities:**
- Converts HTML sections to JSX-compatible format
- Generates React component files
- Creates all necessary configuration files (package.json, vite.config.js, etc.)
- Handles intelligent component naming based on section content

**Key Methods:**
- `prepareReactProject(sections, theme)` - Main entry point
- `htmlToJSX(html)` - Converts HTML to React-compatible JSX
- `generateComponentName(sectionHtml, index)` - Creates meaningful component names
- `generateComponentFile(componentName, jsxContent)` - Creates React component code

### 2. Download Options Handler: `download-options-handler.js`

**Location:** `/public/js/download-options-handler.js`

**Responsibilities:**
- Displays a modal with export options (HTML vs React)
- Manages the export workflow
- Communicates with the preview iframe to get section data
- Handles loading states and success/error messages

**Key Methods:**
- `showDownloadOptions()` - Shows the export modal
- `exportHTML()` - Triggers HTML export
- `exportReact()` - Triggers React export
- `generateReactProject(data)` - Coordinates the React export process

### 3. PHP Backend Handler: `download-react-project.php`

**Location:** `/api/download-react-project.php`

**Responsibilities:**
- Receives project file structure from frontend
- Creates temporary directory with all project files
- Generates a ZIP archive
- Handles cleanup and error management

## Generated Project Structure

When a user exports to React, they receive a complete project with this structure:

```
fpstudio-react-app/
├── public/
│   └── fpstudio.svg           # Project favicon
├── src/
│   ├── components/             # Generated React components
│   │   ├── HeroSection.jsx
│   │   ├── FeaturesSection.jsx
│   │   ├── TestimonialsSection.jsx
│   │   └── ... (one per section)
│   ├── pages/
│   │   └── index.jsx          # Main page importing all components
│   ├── main.jsx               # App entry point with routing
│   └── index.css              # Tailwind CSS imports
├── index.html                 # HTML entry point
├── package.json               # Dependencies and scripts
├── vite.config.js             # Vite configuration
├── eslint.config.js           # ESLint configuration
├── jsconfig.json              # Path aliases configuration
├── .gitignore                 # Git ignore rules
└── README.md                  # Project documentation
```

## Component Naming Strategy

The system intelligently names components based on their content:

- **HeroSection** - For sections with "hero" classes
- **FeaturesSection** - For feature showcase sections
- **TestimonialsSection** - For testimonial sections
- **PricingSection** - For pricing tables
- **ContactSection** - For contact forms
- **CTASection** - For call-to-action sections
- **AboutSection** - For about/company info sections
- **TeamSection** - For team member displays
- **GallerySection** - For image galleries
- **FAQSection** - For FAQ sections
- **Section1, Section2, etc.** - Fallback for unrecognized types

## HTML to JSX Conversion

The converter handles the following transformations:

1. **Attribute Conversion:**
   - `class` → `className`
   - `for` → `htmlFor`
   
2. **Inline Styles:**
   - CSS string → JavaScript object
   - Kebab-case → camelCase (e.g., `background-color` → `backgroundColor`)

3. **Self-Closing Tags:**
   - Ensures tags like `<img>`, `<br>`, `<hr>`, `<input>` are properly self-closed

4. **Editor Cleanup:**
   - Removes TinyMCE attributes (`contenteditable`, `spellcheck`, etc.)
   - Removes section menu controls
   - Cleans up editor-specific classes and IDs

## User Flow

1. **User clicks Download button** → Modal appears with export options
2. **User selects "React + Vite"** → Loading indicator shows
3. **System requests section data** from preview iframe
4. **JavaScript generates project structure** with all files
5. **Data sent to PHP backend** for ZIP creation
6. **ZIP file downloaded** to user's computer
7. **Success message displayed** with next steps

## Integration Points

### app.php Integration

The feature is integrated into `app.php` at these key points:

1. **Script Includes** (lines ~149-151):
```php
<script src="<?= editor_asset('public/js/react-project-generator.js') ?>"></script>
<script src="<?= editor_asset('public/js/download-options-handler.js') ?>"></script>
```

2. **Download Button Handler** (lines ~6102-6111):
```javascript
downloadBtn.addEventListener('click', () => {
    if (window.downloadOptionsHandler) {
        window.downloadOptionsHandler.showDownloadOptions();
    } else {
        downloadPage(); // Fallback
    }
});
```

3. **Message Handler** (lines ~5720-5726):
```javascript
if (requestId && typeof requestId === 'string' && requestId.startsWith('react_export_')) {
    if (window.downloadOptionsHandler) {
        window.downloadOptionsHandler.generateReactProject(data);
    }
    break;
}
```

## Technologies & Versions

The exported React project includes:

- **React 19.1.1** - Latest React with newest features
- **React DOM 19.1.1** - DOM renderer for React
- **Vite 7.1.5** - Modern build tool and dev server
- **Tailwind CSS 4.1.13** - Utility-first CSS framework
- **@tailwindcss/vite 4.1.13** - Vite plugin for Tailwind
- **React Router DOM 7.8.2** - Client-side routing
- **ESLint 9.33.0** - Code linting and quality
- **@vitejs/plugin-react 5.0.0** - React support for Vite

## Developer Scripts

The exported project includes these npm scripts:

- `npm run dev` - Start development server on port 8000
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

## Path Aliases

The project is configured with path aliases for cleaner imports:

```javascript
// Instead of:
import Component from '../../../components/Component';

// You can use:
import Component from '@/Component';
```

## Error Handling

The system includes comprehensive error handling:

1. **Frontend Validation:**
   - Checks if React generator is loaded
   - Validates section data before processing
   - Shows user-friendly error messages

2. **Backend Validation:**
   - Validates incoming data structure
   - Ensures all required files are present
   - Handles ZIP creation failures gracefully

3. **Cleanup:**
   - Automatically removes temporary directories
   - Cleans up ZIP files after download
   - Prevents resource leaks

## Future Enhancements

Potential improvements for future versions:

1. **TypeScript Support** - Option to generate TypeScript components
2. **Component Libraries** - Option to use Material-UI, Chakra UI, etc.
3. **State Management** - Include Redux, Zustand, or Context API setup
4. **API Integration** - Generate API client code
5. **Custom Templates** - Allow users to define custom project templates
6. **Advanced Routing** - Support for nested routes and layouts
7. **Testing Setup** - Include Jest, Vitest, or React Testing Library

## Testing

To test the React export feature:

1. Load a project with multiple sections in the editor
2. Click the Download button
3. Select "React + Vite" from the modal
4. Extract the downloaded ZIP file
5. Run `npm install` in the extracted folder
6. Run `npm run dev` to start the development server
7. Verify all sections appear correctly at http://localhost:8000

## Troubleshooting

### Issue: ZIP file is corrupt or won't extract

**Solution:** Check server logs for errors. Ensure the `ditto` command (Mac) or `ZipArchive` extension (other systems) is available.

### Issue: Components don't render correctly

**Solution:** Check the browser console for errors. Verify that JSX conversion handled all HTML properly. Some complex inline styles might need manual adjustment.

### Issue: Styles are missing

**Solution:** Ensure Tailwind CSS is properly configured. The project uses Tailwind 4's Vite plugin which requires specific setup.

### Issue: Download fails with 500 error

**Solution:** Check PHP error logs. Common causes:
- Insufficient disk space for temporary files
- Permission issues writing to temp directory
- Missing PHP ZipArchive extension (on non-Mac systems)

## Security Considerations

1. **Input Sanitization:** HTML content is not executed during export, only converted to JSX strings
2. **Temporary Files:** All temporary files are cleaned up immediately after ZIP creation
3. **File Permissions:** Temporary directories use 0755 permissions
4. **Path Traversal:** Backend validates all file paths to prevent directory traversal attacks

## Performance

- **Average Export Time:** 2-5 seconds for projects with 10-15 sections
- **Zip File Size:** Typically 10-20 KB (configuration files only, no node_modules)
- **Memory Usage:** Minimal, temporary files are created in system temp directory

## Maintenance

When updating the feature:

1. **Version Bumps:** Update package versions in `generatePackageJSON()`
2. **Configuration Changes:** Modify template generators in `react-project-generator.js`
3. **New Features:** Add new configuration files to `prepareReactProject()`
4. **Testing:** Always test complete workflow after changes

---

**Created:** November 17, 2025  
**Last Updated:** November 17, 2025  
**Version:** 1.0.0


