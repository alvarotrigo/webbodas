# React Export Architecture

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                          USER INTERFACE                          │
│                            (app.php)                             │
└─────────────────────────────────────────────────────────────────┘
                                  │
                    User clicks Download Button
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Download Options Handler                      │
│              (download-options-handler.js)                       │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                           │   │
│  │  ┌─────────────┐              ┌─────────────┐           │   │
│  │  │             │              │             │           │   │
│  │  │  HTML       │              │   React     │           │   │
│  │  │  Export     │              │   Export    │           │   │
│  │  │             │              │             │           │   │
│  │  └─────────────┘              └─────────────┘           │   │
│  │                                                           │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
         │                                        │
         │ HTML Export                            │ React Export
         │ (existing flow)                        │ (new flow)
         ▼                                        ▼
┌──────────────────────┐              ┌──────────────────────────┐
│                      │              │  React Project Generator │
│  download-page.php   │              │                          │
│                      │              │ (react-project-          │
│  • Generates HTML    │              │  generator.js)           │
│  • Purges CSS        │              │                          │
│  • Creates ZIP       │              │  Converts:               │
│                      │              │  • HTML → JSX            │
└──────────────────────┘              │  • Sections → Components │
                                      │  • Generates configs     │
                                      └──────────────────────────┘
                                                  │
                                                  │
                                                  ▼
                                      ┌──────────────────────────┐
                                      │    PHP Backend Handler   │
                                      │                          │
                                      │  (download-react-        │
                                      │   project.php)           │
                                      │                          │
                                      │  • Receives files        │
                                      │  • Creates temp dir      │
                                      │  • Generates ZIP         │
                                      │  • Cleanup               │
                                      └──────────────────────────┘
                                                  │
                                                  │
                                                  ▼
                                      ┌──────────────────────────┐
                                      │    Browser Downloads     │
                                      │                          │
                                      │  fpstudio-react-app.zip │
                                      └──────────────────────────┘
```

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 1: User Initiates Export                                        │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                    User clicks Download Button
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 2: Show Export Options                                          │
│                                                                       │
│  DownloadOptionsHandler.showDownloadOptions()                        │
│  → Displays modal with HTML and React options                        │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                    User selects "React + Vite"
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 3: Request Section Data                                         │
│                                                                       │
│  DownloadOptionsHandler.exportReact()                                │
│  → Sends postMessage to iframe: 'GET_SECTIONS_DATA'                  │
│  → Request ID: 'react_export_[timestamp]'                            │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 4: Iframe Responds with Data                                    │
│                                                                       │
│  Preview iframe sends:                                                │
│  {                                                                    │
│    type: 'SECTIONS_DATA',                                            │
│    requestId: 'react_export_...',                                    │
│    data: {                                                            │
│      sections: [...],    // Array of section HTML                    │
│      theme: '...',        // Active theme                            │
│      fullpageEnabled: boolean,                                        │
│      animationsEnabled: boolean                                       │
│    }                                                                  │
│  }                                                                    │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 5: Message Handler Routes to React Export                       │
│                                                                       │
│  app.php message listener detects:                                    │
│  if (requestId.startsWith('react_export_')) {                        │
│    window.downloadOptionsHandler.generateReactProject(data);          │
│  }                                                                    │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 6: Generate React Project Structure                             │
│                                                                       │
│  ReactProjectGenerator.prepareReactProject(sections, theme)          │
│                                                                       │
│  For each section:                                                    │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ 1. Generate component name (HeroSection, etc.)               │   │
│  │ 2. Convert HTML to JSX                                        │   │
│  │    • class → className                                        │   │
│  │    • for → htmlFor                                            │   │
│  │    • style="..." → style={{...}}                              │   │
│  │    • Remove editor artifacts                                  │   │
│  │ 3. Wrap in React component template                          │   │
│  │ 4. Generate import/export statements                          │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  Generate configuration files:                                        │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ • package.json (with dependencies)                           │   │
│  │ • vite.config.js (with React & Tailwind plugins)             │   │
│  │ • eslint.config.js (with React rules)                        │   │
│  │ • jsconfig.json (with path aliases)                          │   │
│  │ • index.html (entry point)                                    │   │
│  │ • src/main.jsx (router setup)                                │   │
│  │ • src/index.css (Tailwind imports)                           │   │
│  │ • src/pages/index.jsx (imports all components)               │   │
│  │ • .gitignore                                                  │   │
│  │ • README.md                                                   │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  Returns:                                                             │
│  {                                                                    │
│    files: {                                                           │
│      'index.html': '...',                                             │
│      'package.json': '...',                                           │
│      'src/components/HeroSection.jsx': '...',                         │
│      // ... all other files                                           │
│    }                                                                  │
│  }                                                                    │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 7: Send to PHP Backend                                          │
│                                                                       │
│  fetch('api/download-react-project.php', {                           │
│    method: 'POST',                                                    │
│    body: JSON.stringify({                                             │
│      files: { ... },                                                  │
│      projectName: 'fpstudio-react-app'                              │
│    })                                                                 │
│  })                                                                   │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 8: PHP Creates ZIP File                                         │
│                                                                       │
│  download-react-project.php:                                         │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ 1. Create temp directory                                     │   │
│  │    /tmp/fpstudio-react-app-[unique-id]/                     │   │
│  │                                                               │   │
│  │ 2. Write all files to temp directory                         │   │
│  │    foreach (files as path => content) {                      │   │
│  │      file_put_contents(tempDir + path, content)              │   │
│  │    }                                                          │   │
│  │                                                               │   │
│  │ 3. Create ZIP archive                                         │   │
│  │    Mac: ditto -c -k tempDir zipFile                          │   │
│  │    Other: ZipArchive PHP extension                            │   │
│  │                                                               │   │
│  │ 4. Send ZIP to browser                                        │   │
│  │    header('Content-Type: application/zip')                   │   │
│  │    readfile(zipFile)                                          │   │
│  │                                                               │   │
│  │ 5. Cleanup                                                    │   │
│  │    unlink(zipFile)                                            │   │
│  │    removeDirectory(tempDir)                                   │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 9: Browser Downloads ZIP                                        │
│                                                                       │
│  Browser receives blob and triggers download:                        │
│  • Filename: fpstudio-react-app.zip                                 │
│  • Size: ~10-20 KB (config files only)                               │
│  • Contains: Complete React project ready to run                     │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 10: Show Success Message                                        │
│                                                                       │
│  DownloadOptionsHandler.showSuccessMessage()                         │
│  → Green notification: "React project exported successfully!"        │
│  → Instructions: "Run 'npm install' to get started"                  │
│  → Auto-dismisses after 5 seconds                                    │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Interaction Map

```
┌─────────────────────────────────────────────────────────────────┐
│                            app.php                               │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Download Button Click Handler                              │ │
│  │                                                             │ │
│  │ downloadBtn.addEventListener('click', () => {              │ │
│  │   downloadOptionsHandler.showDownloadOptions()             │ │
│  │ })                                                          │ │
│  └────────────────────────────────────────────────────────────┘ │
│                               │                                  │
│                               │                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Message Event Handler                                       │ │
│  │                                                             │ │
│  │ window.addEventListener('message', (event) => {            │ │
│  │   if (requestId.startsWith('react_export_')) {            │ │
│  │     downloadOptionsHandler.generateReactProject(data)      │ │
│  │   }                                                         │ │
│  │ })                                                          │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                    │                           │
                    │                           │
                    ▼                           ▼
┌───────────────────────────┐   ┌──────────────────────────────┐
│  DownloadOptionsHandler   │   │  ReactProjectGenerator       │
│                           │   │                              │
│  • showDownloadOptions()  │   │  • prepareReactProject()     │
│  • exportHTML()           │   │  • htmlToJSX()               │
│  • exportReact()          │   │  • generateComponentName()   │
│  • generateReactProject() │◄──│  • generateComponentFile()   │
│  • showLoadingIndicator() │   │  • generateIndexFile()       │
│  • showSuccessMessage()   │   │  • generate*Config()         │
└───────────────────────────┘   └──────────────────────────────┘
                    │
                    │
                    ▼
        ┌───────────────────────┐
        │  fetch() to PHP       │
        │                       │
        │  POST                 │
        │  /api/download-       │
        │  react-project.php    │
        └───────────────────────┘
                    │
                    │
                    ▼
        ┌───────────────────────┐
        │  download-react-      │
        │  project.php          │
        │                       │
        │  • Receives files     │
        │  • Creates temp dir   │
        │  • Writes files       │
        │  • Creates ZIP        │
        │  • Sends response     │
        │  • Cleanup            │
        └───────────────────────┘
```

## File Structure Map

```
nine-screen-canvas-flow/
│
├── app.php ⭐ (Modified)
│   └── Added: Script includes, download button handler, message handler
│
├── api/
│   └── download-react-project.php ✨ (New)
│       └── Creates ZIP of React project
│
├── public/js/
│   ├── react-project-generator.js ✨ (New)
│   │   └── Converts sections to React components
│   │
│   └── download-options-handler.js ✨ (New)
│       └── Manages download UI and workflow
│
└── docs/
    ├── REACT_EXPORT_FEATURE.md ✨ (New)
    │   └── Technical documentation
    │
    ├── REACT_EXPORT_QUICK_START.md ✨ (New)
    │   └── User guide
    │
    ├── REACT_EXPORT_IMPLEMENTATION_SUMMARY.md ✨ (New)
    │   └── Implementation details
    │
    └── REACT_EXPORT_ARCHITECTURE.md ✨ (New - This file)
        └── Architecture diagrams

Legend:
⭐ = Modified existing file
✨ = New file created
```

## Technology Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                      EXPORTED PROJECT STACK                      │
└─────────────────────────────────────────────────────────────────┘

Frontend Framework:
  ┌──────────────┐
  │  React 19.1  │  Latest React with concurrent features
  └──────────────┘

Build Tool:
  ┌──────────────┐
  │  Vite 7.1    │  Lightning-fast HMR and optimized builds
  └──────────────┘

Styling:
  ┌──────────────────┐
  │  Tailwind CSS 4  │  Utility-first CSS framework
  └──────────────────┘

Routing:
  ┌────────────────────┐
  │  React Router 7.8  │  Client-side routing with auto-routing
  └────────────────────┘

Code Quality:
  ┌──────────────┐
  │  ESLint 9    │  Linting with React-specific rules
  └──────────────┘

Package Manager:
  ┌──────────────┐
  │     npm      │  Standard package management
  └──────────────┘
```

## Integration Points

```
                     ┌─────────────────────┐
                     │   User clicks       │
                     │   Download button   │
                     └─────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                    INTEGRATION POINT 1                        │
│                                                               │
│  Location: app.php lines 6102-6111                           │
│  Purpose: Show download options modal                        │
│                                                               │
│  downloadBtn.addEventListener('click', () => {               │
│    window.downloadOptionsHandler.showDownloadOptions()       │
│  })                                                           │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
                     ┌─────────────────────┐
                     │   Modal shows       │
                     │   React option      │
                     └─────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                    INTEGRATION POINT 2                        │
│                                                               │
│  Location: download-options-handler.js exportReact()         │
│  Purpose: Request section data from iframe                   │
│                                                               │
│  iframe.contentWindow.postMessage({                          │
│    type: 'GET_SECTIONS_DATA',                                │
│    requestId: 'react_export_...'                             │
│  })                                                           │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
                     ┌─────────────────────┐
                     │   Iframe responds   │
                     │   with sections     │
                     └─────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                    INTEGRATION POINT 3                        │
│                                                               │
│  Location: app.php lines 5720-5726                           │
│  Purpose: Route React export requests                        │
│                                                               │
│  if (requestId.startsWith('react_export_')) {                │
│    window.downloadOptionsHandler.generateReactProject(data)  │
│  }                                                            │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
                     ┌─────────────────────┐
                     │   Generate React    │
                     │   project files     │
                     └─────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                    INTEGRATION POINT 4                        │
│                                                               │
│  Location: download-options-handler.js                       │
│  Purpose: Send to backend for ZIP creation                   │
│                                                               │
│  fetch('api/download-react-project.php', {                   │
│    method: 'POST',                                            │
│    body: JSON.stringify({ files, projectName })              │
│  })                                                           │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
                     ┌─────────────────────┐
                     │   ZIP downloaded    │
                     │   Success message   │
                     └─────────────────────┘
```

---

**Document Purpose:** Visual reference for React export architecture  
**Last Updated:** November 17, 2025  
**Version:** 1.0.0


