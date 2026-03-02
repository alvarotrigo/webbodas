<?php
/**
 * React Project Generator with HTML to JSX Conversion
 * Converts sections to JSX using Node.js service, then generates React project
 */

header('Content-Type: application/json');

// Get POST data
$input = json_decode(file_get_contents('php://input'), true);

if (!$input || !isset($input['sections'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid input data. Sections required.']);
    exit;
}

$sections = $input['sections'];
$theme = $input['theme'] ?? 'theme-light-minimal';
$projectName = $input['projectName'] ?? 'fpstudio-react-app';

// Handle both boolean and string values (JavaScript may send either)
$fullpageEnabled = $input['fullpageEnabled'] ?? false;
$fullpageSettings = $input['fullpageSettings'] ?? [];
$animationsEnabled = $input['animationsEnabled'] ?? false;

// Normalize to boolean for easier comparison
$fullpageEnabledBool = ($fullpageEnabled === true || $fullpageEnabled === 'true');
$animationsEnabledBool = ($animationsEnabled === true || $animationsEnabled === 'true');

// Debug: Log received parameters
error_log("=== REACT EXPORT PARAMETERS ===");
error_log("fullpageEnabled (raw): " . var_export($fullpageEnabled, true));
error_log("fullpageSettings: " . json_encode($fullpageSettings));
error_log("animationsEnabled (raw): " . var_export($animationsEnabled, true));
error_log("fullpageEnabled (normalized): " . ($fullpageEnabledBool ? 'true' : 'false'));
error_log("animationsEnabled (normalized): " . ($animationsEnabledBool ? 'true' : 'false'));
error_log("Should include viewport animations: " . (($animationsEnabledBool && !$fullpageEnabledBool) ? 'YES' : 'NO'));

/**
 * Convert HTML to JSX using Node.js service
 */
function convertHtmlToJsx($html) {
    $nodeServiceUrl = 'http://localhost:3000/html-to-jsx';
    
    // Clean up HTML before sending
    $html = cleanHtml($html);
    
    $payload = json_encode([
        'html' => $html
    ]);
    
    $ch = curl_init($nodeServiceUrl);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Content-Length: ' . strlen($payload)
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    
    if ($httpCode !== 200) {
        error_log("HTML to JSX conversion failed. HTTP Code: $httpCode, Error: $curlError");
        error_log("HTML content length: " . strlen($html));
        return false;
    }
    
    $result = json_decode($response, true);
    
    if (!$result || !isset($result['jsx'])) {
        error_log("Invalid response from HTML to JSX service");
        return false;
    }
    
    // Post-process JSX to fix issues the converter missed
    $jsx = $result['jsx'];
    $jsx = cleanJsx($jsx);
    
    return $jsx;
}

/**
 * Clean JSX after conversion
 * Fixes issues that the HTML-to-JSX converter missed
 */
function cleanJsx($jsx) {
    // Fix event handlers: onclick -> onClick, onchange -> onChange, etc.
    $jsx = preg_replace_callback('/\s+(on[a-z]+)=/i', function($matches) {
        $eventName = strtolower($matches[1]);
        // Convert to camelCase: onclick -> onClick
        $reactEventName = 'on' . ucfirst(substr($eventName, 2));
        return ' ' . $reactEventName . '=';
    }, $jsx);
    
    // Fix common HTML attributes that should be camelCase in JSX
    $jsx = preg_replace('/\s+tabindex=/i', ' tabIndex=', $jsx);
    $jsx = preg_replace('/\s+maxlength=/i', ' maxLength=', $jsx);
    $jsx = preg_replace('/\s+minlength=/i', ' minLength=', $jsx);
    $jsx = preg_replace('/\s+readonly=/i', ' readOnly=', $jsx);
    $jsx = preg_replace('/\s+autocomplete=/i', ' autoComplete=', $jsx);
    $jsx = preg_replace('/\s+autofocus=/i', ' autoFocus=', $jsx);
    $jsx = preg_replace('/\s+colspan=/i', ' colSpan=', $jsx);
    $jsx = preg_replace('/\s+rowspan=/i', ' rowSpan=', $jsx);
    
    // Remove invalid href="true" or href="false" if they slipped through
    $jsx = preg_replace('/\s+href=(["\'])(true|false)\1/', '', $jsx);
    
    // Remove empty onclick handlers that might cause issues
    $jsx = preg_replace('/\s+onClick=(["\'])\1/', '', $jsx);
    $jsx = preg_replace('/\s+onClick={["\']["\']}/','', $jsx);
    
    return $jsx;
}

/**
 * Clean CSS content by removing comments and excessive empty lines
 */
function cleanCSSContent($cssContent) {
    // Remove CSS comments
    $cssContent = preg_replace('/\/\*[\s\S]*?\*\//', '', $cssContent);
    
    // Replace multiple consecutive empty lines with a single empty line
    $cssContent = preg_replace('/\n\s*\n\s*\n+/', "\n\n", $cssContent);
    
    return $cssContent;
}

/**
 * Purge CSS using external service
 */
function purgeCSS($htmlContent, $cssFilePaths) {
    $purgeUrl = 'http://localhost:3000/purge/purge-with-tailwind?combine=false';
    
    // Prepare CSS files with content for the API
    $cssFiles = [];
    foreach ($cssFilePaths as $fileName => $filePath) {
        if (file_exists($filePath)) {
            $cssFiles[] = [
                'content' => file_get_contents($filePath),
                'filename' => $fileName
            ];
        }
    }
    
    if (empty($cssFiles)) {
        return false;
    }
    
    // Prepare the request data with safelist for theme classes
    $requestData = [
        'cssFiles' => $cssFiles,
        'contentFiles' => [
            [
                'content' => $htmlContent,
                'extension' => 'html'
            ]
        ],
        'htmlContent' => $htmlContent,
        'safelist' => [
            'theme-candy-shop',
            'theme-light-minimal',
            'theme-dark-modern',
            'theme-corporate-clean',
            'theme-playful-colorful',
            'theme-elegant-serif',
            'btn-themed',
            'btn-themed-outline',
            'heading-themed',
            'text-themed-primary',
            'text-themed-secondary',
            'text-themed-accent',
            'bg-themed-primary',
            'bg-themed-secondary',
            'bg-themed-accent',
            'card-themed',
            'gradient-themed-1',
            'gradient-themed-2',
            'feature-card',
            'feature-icon'
        ]
    ];
    
    // Initialize cURL
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $purgeUrl);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($requestData));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Accept: application/json'
    ]);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    
    // Execute the request
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

    // Check if request was successful
    if ($httpCode === 200 && $response) {
        $purgedData = json_decode($response, true);
        if ($purgedData) {
            return $purgedData;
        }
    }
    
    // Return false if purging failed
    return false;
}

/**
 * Clean HTML before conversion to JSX
 * Fixes common issues that cause JSX conversion errors
 * Note: .section-menu elements are already removed on the JS side (preview.html)
 */
function cleanHtml($html) {
    // Remove TinyMCE attributes
    $html = preg_replace('/\s+id="mce_\d+"/', '', $html);
    $html = preg_replace('/\s+contenteditable="[^"]*"/', '', $html);
    $html = preg_replace('/\s+spellcheck="[^"]*"/', '', $html);
    $html = preg_replace('/\s+data-mce-style="[^"]*"/', '', $html);
    $html = preg_replace('/\s+class="[^"]*mce-content-body[^"]*"/', '', $html);
    
    // Fix invalid boolean attributes that appear as strings
    // Remove href="true", href="false", disabled="true", etc.
    $html = preg_replace('/\s+href=(["\'])(true|false)\1/', '', $html);
    $html = preg_replace('/\s+disabled=(["\'])(true|false)\1/', ' disabled', $html);
    $html = preg_replace('/\s+checked=(["\'])(true|false)\1/', ' checked', $html);
    $html = preg_replace('/\s+selected=(["\'])(true|false)\1/', ' selected', $html);
    $html = preg_replace('/\s+readonly=(["\'])(true|false)\1/', ' readonly', $html);
    $html = preg_replace('/\s+required=(["\'])(true|false)\1/', ' required', $html);
    
    // Convert lowercase event handlers to camelCase for React
    // onclick -> onClick, onchange -> onChange, etc.
    $html = preg_replace_callback('/\s+(on[a-z]+)=/i', function($matches) {
        $eventName = strtolower($matches[1]);
        // Convert to camelCase: onclick -> onClick
        $reactEventName = 'on' . ucfirst(substr($eventName, 2));
        return ' ' . $reactEventName . '=';
    }, $html);
    
    // Remove empty href attributes
    $html = preg_replace('/\s+href=(["\'])\1/', '', $html);
    
    // Clean up excessive whitespace
    $html = preg_replace('/\n\s*\n\s*\n+/', "\n\n", $html);
    
    return trim($html);
}

/**
 * Generate component name from HTML content
 */
function generateComponentName($html, $index) {
    // Try to extract meaningful name from classes
    if (preg_match('/class="[^"]*\b(hero|feature|testimonial|pricing|contact|cta|about|team|gallery|faq)[^"]*"/i', $html, $matches)) {
        $type = ucfirst(strtolower($matches[1]));
        return $type . 'Section' . ($index > 0 ? $index : '');
    }
    
    return 'Section' . ($index + 1);
}

/**
 * Generate React component file content
 */
function generateComponentFile($componentName, $jsx, $withAnimations = false) {
    // Clean up the JSX (remove any extra indentation)
    $jsxLines = explode("\n", $jsx);
    $indentedJsx = array_map(function($line) {
        return '    ' . $line;
    }, $jsxLines);
    $indentedJsxContent = implode("\n", $indentedJsx);
    
    // Add animation hook if enabled
    $animationImport = $withAnimations ? '
import useScrollAnimation from "../hooks/useScrollAnimation";' : '';
    
    $animationHook = $withAnimations ? '
  const ref = useScrollAnimation();' : '';
    
    // Add ref to first element if animations are enabled
    if ($withAnimations) {
        // Add ref={ref} to the first opening tag (usually a <section> or <div>)
        $indentedJsxContent = preg_replace(
            '/^(\s*<[a-zA-Z][a-zA-Z0-9]*)([\s>])/',
            '$1 ref={ref}$2',
            $indentedJsxContent,
            1
        );
    }
    
    return "import React from \"react\";{$animationImport}

const {$componentName} = () => {{$animationHook}
  return (
{$indentedJsxContent}
  );
};

export default {$componentName};
";
}

/**
 * Generate GSAP scroll animation hook
 */
function generateScrollAnimationHook() {
    return 'import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Register GSAP plugin
gsap.registerPlugin(ScrollTrigger);

/**
 * Custom hook for scroll-triggered animations using GSAP
 * Animates elements as they enter the viewport
 */
export function useScrollAnimation() {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;

    // Find all animatable elements within the component
    const elements = ref.current.querySelectorAll(
      "h1, h2, h3, h4, h5, h6, p, a, img, form, label, input, textarea, button, [data-animate]"
    );

    if (elements.length === 0) return;

    // Set initial state (hidden)
    gsap.set(elements, {
      opacity: 0,
      y: 50,
    });

    // Create staggered animation as elements enter viewport
    const animation = gsap.to(elements, {
      opacity: 1,
      y: 0,
      duration: 0.7,
      ease: "power2.out",
      stagger: 0.1,
      scrollTrigger: {
        trigger: ref.current,
        start: "top 80%", // Animation starts when top of element is 80% from top of viewport
        toggleActions: "play none none none", // Only play once
      },
    });

    // Cleanup
    return () => {
      animation.scrollTrigger?.kill();
      animation.kill();
    };
  }, []);

  return ref;
}

export default useScrollAnimation;
';
}

/**
 * Generate all configuration files
 */
function generateConfigFiles($components, $theme, $cssFiles = [], $animationsEnabled = false, $fullpageEnabled = false) {
    $files = [];
    
    // Generate index.jsx
    $imports = array_map(function($comp) {
        return "import {$comp['name']} from \"@/{$comp['name']}\";";
    }, $components);
    
    $componentTags = array_map(function($comp) {
        return "      <{$comp['name']} />";
    }, $components);
    
    $files['src/pages/index.jsx'] = "import React from \"react\";\n" . 
        implode("\n", $imports) . "\n\n" .
        "function Index() {\n" .
        "  return (\n" .
        "    <>\n" .
        implode("\n", $componentTags) . "\n" .
        "    </>\n" .
        "  );\n" .
        "}\n\n" .
        "export default Index;\n";
    
    // main.jsx
    $files['src/main.jsx'] = 'import { createRoot } from "react-dom/client";
import { BrowserRouter, useRoutes } from "react-router-dom";
import "./index.css";

// Load all pages from src/pages/
const modules = import.meta.glob("./pages/**/*.{jsx,tsx}", { eager: true });

// Convert file paths into React Router routes
const routes = Object.keys(modules).map((path) => {
  const name = path.match(/\.\/pages\/(.*)\.jsx$/)?.[1];
  const Component = modules[path].default;

  return {
    path: name === "index" ? "/" : `/${name.toLowerCase()}`,
    element: <Component />,
  };
});

function App() {
  return useRoutes(routes);
}

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
';
    
    // index.css - Tailwind v4 import and custom styles
    // Using @import 'tailwindcss' is the new Tailwind v4 syntax with @tailwindcss/vite
    $cssImports = "@import 'tailwindcss';\n\n";
    
    // Add import for sections.css if it exists
    if (isset($cssFiles['sections.css'])) {
        $cssImports .= "/* Theme and component styles */\n@import './styles/sections.css';\n\n";
    }
    
    // Note: Viewport animations are not included in React exports
    // React developers should use React-specific animation libraries instead
    
    $cssImports .= "/* Add any custom global styles here */\n";
    
    $files['src/index.css'] = $cssImports;
    
    // index.html
    // Note: No viewport animations in React exports - use React animation libraries instead
    $files['index.html'] = '<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>FPStudio + Vite + React</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
';
    
    // Add GSAP if animations are enabled
    $gsapDependencies = $animationsEnabled ? ',
    "gsap": "^3.12.5"' : '';
    
    // package.json
    $files['package.json'] = '{
  "name": "fpstudio-react-app",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite --port 8000",
    "build": "vite build",
    "lint": "eslint .",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.1.1",
    "react-dom": "^19.1.1",
    "react-router-dom": "^7.8.2"' . $gsapDependencies . '
  },
  "devDependencies": {
    "@eslint/js": "^9.33.0",
    "@tailwindcss/postcss": "^4.1.13",
    "@tailwindcss/vite": "^4.1.13",
    "@types/react": "^19.1.10",
    "@types/react-dom": "^19.1.7",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.20",
    "eslint": "^9.33.0",
    "eslint-plugin-react-hooks": "^5.2.0",
    "eslint-plugin-react-refresh": "^0.4.20",
    "globals": "^16.3.0",
    "react-router-dom": "^6.28.0",
    "tailwindcss": "^4.1.13",
    "vite": "^5.4.0"
  }
}
';
    
    // vite.config.js
    $files['vite.config.js'] = 'import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "./", // Allows flexible deployment (root or subdirectory)
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src/components"),
    },
  },
});
';
    
    // eslint.config.js
    $files['eslint.config.js'] = 'import js from \'@eslint/js\'

import globals from \'globals\'
import reactHooks from \'eslint-plugin-react-hooks\'
import reactRefresh from \'eslint-plugin-react-refresh\'
import { defineConfig, globalIgnores } from \'eslint/config\'

export default defineConfig([
  globalIgnores([\'dist\']),
  {
    files: [\'**/*.{js,jsx,ts,tsx}\'],
    extends: [
      js.configs.recommended,
      reactHooks.configs[\'recommended-latest\'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: \'latest\',
        ecmaFeatures: { jsx: true },
        sourceType: \'module\',
      },
    },
    rules: {
      \'no-unused-vars\': [\'error\', { varsIgnorePattern: \'^[A-Z_]\' }],
    },
  },
])
';
    
    // jsconfig.json
    $files['jsconfig.json'] = '{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/components/*"]
    }
  }
}
';
    
    // postcss.config.js - Required for Tailwind v4
    $files['postcss.config.js'] = 'import tailwindcss from \'@tailwindcss/postcss\'
import autoprefixer from \'autoprefixer\'

export default {
  plugins: [
    tailwindcss,
    autoprefixer,
  ],
}
';
    
    // .gitignore
    $files['.gitignore'] = '# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

node_modules
dist
dist-ssr
*.local

# Editor directories and files
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?
';
    
    // README.md
    $componentsCount = count($components);
    $hasSectionsCSS = isset($cssFiles['sections.css']);
    $hasAnimations = ($animationsEnabled && !$fullpageEnabled);
    
    $animationsSection = $hasAnimations ? "
- `src/hooks/` - Custom React hooks
  - `useScrollAnimation.js` - GSAP scroll-triggered animations" : "";
    
    $files['README.md'] = "# FPStudio React Project

This is a React + Vite project generated from the FPStudio editor.

## 📁 Project Structure

- `src/components/` - {$componentsCount} React components (one per section)
- `src/pages/index.jsx` - Main page importing all components
- `src/main.jsx` - App entry point with routing
- `src/index.css` - Global styles with Tailwind imports" . ($hasSectionsCSS ? "
- `src/styles/` - CSS files
  - `sections.css` - Theme and component styles (purged)" : "") . $animationsSection . "
- `postcss.config.js` - PostCSS configuration for Tailwind v4

## 🚀 Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```
   
   The app will be available at [http://localhost:8000](http://localhost:8000)

3. **Build for production:**
   ```bash
   npm run build
   ```

4. **Preview production build:**
   ```bash
   npm run preview
   ```
   
   ⚠️ **Important:** Don't open `dist/index.html` directly in your browser. Always use `npm run preview` or deploy to a web server.

## 🛠 Technologies

- React 19 - UI library
- Vite 5.4 - Build tool and dev server (Node 18 compatible)
- Tailwind CSS 4 - Utility-first CSS framework (Vite plugin)
- React Router Dom 7 - Client-side routing" . 
($hasAnimations ? "
- GSAP 3 - Professional-grade animation library with ScrollTrigger" : "") . "
- ESLint - Code linting

## 🎨 Styles

This project uses **Tailwind CSS v4**:
- Uses `@import 'tailwindcss'` syntax in `src/index.css`
- Processed by `@tailwindcss/postcss` plugin (configured in `postcss.config.js`)
- Utility classes are generated automatically based on your HTML/JSX
- Theme styles" . ($hasSectionsCSS ? " (purged for optimal size)" : "") . " are in `src/styles/sections.css`

All styles are automatically optimized during the build process." . 
($hasAnimations ? "

## ✨ Scroll Animations

This project includes **GSAP-powered scroll animations**:

- Elements fade in and slide up as they enter the viewport
- Uses the `useScrollAnimation` custom hook
- Powered by GSAP ScrollTrigger for smooth, performant animations
- Each component automatically animates its children on scroll

### Customizing Animations

Edit `src/hooks/useScrollAnimation.js` to:
- Change animation duration, easing, or stagger
- Adjust the scroll trigger point (currently 80% from top)
- Add different animations for specific elements
- Configure animation behavior (play once, toggle, etc.)

Example:
```javascript
gsap.to(elements, {
  opacity: 1,
  y: 0,
  duration: 1.0, // Change duration
  ease: \"elastic.out\", // Change easing
  stagger: 0.15, // Change stagger delay
});
```" : "

## ✨ Adding Animations (Optional)

Want to add scroll animations? Popular React animation libraries:

- **GSAP** - `npm install gsap` (recommended, used in FPStudio)
- **Framer Motion** - `npm install framer-motion`
- **React Spring** - `npm install @react-spring/web`") . "

---

Built with ❤️ using FPStudio
";
    
    return $files;
}

// Process sections and convert to JSX
$components = [];
$conversionErrors = [];
$allSectionHtml = ''; // Combine all HTML for CSS purging

foreach ($sections as $index => $section) {
    $html = $section['html'] ?? '';
    
    if (empty($html)) {
        continue;
    }
    
    // Add to combined HTML for CSS purging
    $allSectionHtml .= $html . "\n";
    
    // Convert HTML to JSX using Node.js service
    $jsx = convertHtmlToJsx($html);
    
    if ($jsx === false) {
        $conversionErrors[] = "Failed to convert section " . ($index + 1);
        error_log("Failed to convert section $index");
        continue;
    }
    
    // Generate component name and file (with animations if enabled)
    $componentName = generateComponentName($html, $index);
    $componentCode = generateComponentFile($componentName, $jsx, $animationsEnabledBool && !$fullpageEnabledBool);
    
    $components[] = [
        'name' => $componentName,
        'filename' => $componentName . '.jsx',
        'code' => $componentCode
    ];
}

// Check if we have any components
if (empty($components)) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Failed to generate any components',
        'details' => $conversionErrors
    ]);
    exit;
}

// Purge CSS files
$cssFiles = [];
$cssFilePaths = [];

// Use absolute paths from project root
$projectRoot = dirname(__DIR__);

$outputCssPath = $projectRoot . '/dist/output.css';
$sectionsCssPath = $projectRoot . '/public/css/sections.css';

if (file_exists($outputCssPath)) {
    $cssFilePaths['output.css'] = $outputCssPath;
}

if (file_exists($sectionsCssPath)) {
    $cssFilePaths['sections.css'] = $sectionsCssPath;
}

// Log CSS file paths for debugging
error_log("CSS file paths found: " . json_encode(array_keys($cssFilePaths)));

// Attempt to purge CSS
$purgedCSS = false;
if (!empty($cssFilePaths) && !empty($allSectionHtml)) {
    error_log("Attempting to purge CSS...");
    $purgedCSS = purgeCSS($allSectionHtml, $cssFilePaths);
    
    if ($purgedCSS) {
        error_log("CSS purging succeeded");
    } else {
        error_log("CSS purging failed, using fallback");
    }
}

if ($purgedCSS && is_array($purgedCSS)) {
    // Process purged CSS files
    foreach ($purgedCSS as $fileName => $value) {
        $cssContent = '';
        
        // Extract CSS content from the response
        if (is_array($value) && isset($value['css'])) {
            $cssContent = $value['css'];
        } elseif (is_string($value)) {
            $cssContent = $value;
        }
        
        if (!empty($cssContent)) {
            // Clean CSS content
            $cssContent = cleanCSSContent($cssContent);
            
            // Determine the new filename for React project
            if ($fileName === 'output.css') {
                // Tailwind utilities go directly into index.css via @tailwind directives
                // We can skip this or add as a separate file if needed
                error_log("Skipping output.css (Tailwind handled by Vite)");
                continue;
            } else {
                // sections.css stays as is
                $cssFiles[$fileName] = $cssContent;
                error_log("Added purged CSS file: $fileName (" . strlen($cssContent) . " bytes)");
            }
        }
    }
}

// Always ensure sections.css is included (fallback if purging failed or was skipped)
if (!isset($cssFiles['sections.css']) && file_exists($sectionsCssPath)) {
    error_log("Using fallback for sections.css");
    $cssContent = file_get_contents($sectionsCssPath);
    $cssContent = cleanCSSContent($cssContent);
    $cssFiles['sections.css'] = $cssContent;
    error_log("Added fallback sections.css (" . strlen($cssContent) . " bytes)");
}

// Add GSAP scroll animations if animations are enabled (animations ON + fullPage OFF)
if ($animationsEnabledBool && !$fullpageEnabledBool) {
    error_log("GSAP scroll animations will be included in React export");
} else {
    error_log("Scroll animations skipped for React export");
    error_log("  - animationsEnabled: " . ($animationsEnabledBool ? 'true' : 'false'));
    error_log("  - fullpageEnabled: " . ($fullpageEnabledBool ? 'true' : 'false'));
}

// Log final CSS files that will be included
error_log("Final CSS files to include: " . json_encode(array_keys($cssFiles)));

// Generate all project files (pass boolean values)
$files = generateConfigFiles($components, $theme, $cssFiles, $animationsEnabledBool, $fullpageEnabledBool);

// Add CSS/JS files to appropriate directories
foreach ($cssFiles as $fileName => $content) {
    // Check if it's a JS file (viewport-animations.js)
    if (pathinfo($fileName, PATHINFO_EXTENSION) === 'js') {
        $filePath = 'public/' . $fileName;
        $files[$filePath] = $content;
        error_log("Added JS file to output: $filePath (" . strlen($content) . " bytes)");
    } else {
        // CSS files go to src/styles/
        $filePath = 'src/styles/' . $fileName;
        $files[$filePath] = $content;
        error_log("Added CSS file to output: $filePath (" . strlen($content) . " bytes)");
    }
}

// Add GSAP scroll animation hook if animations are enabled
if ($animationsEnabledBool && !$fullpageEnabledBool) {
    $files['src/hooks/useScrollAnimation.js'] = generateScrollAnimationHook();
    error_log('Added useScrollAnimation hook for GSAP animations');
}

// Add component files
foreach ($components as $component) {
    $files['src/components/' . $component['filename']] = $component['code'];
}

// Log all file paths being returned
error_log("Total files in output: " . count($files));
error_log("File list: " . json_encode(array_keys($files)));

// Return the file structure
echo json_encode([
    'success' => true,
    'files' => $files,
    'componentsCount' => count($components),
    'projectName' => $projectName,
    'conversionErrors' => $conversionErrors,
    'cssFiles' => array_keys($cssFiles),
    'cssPurged' => $purgedCSS !== false
]);
?>

