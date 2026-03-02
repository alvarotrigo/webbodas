const puppeteer = require('puppeteer');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Create screenshots directory if it doesn't exist
const screenshotsDir = path.join(__dirname, 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

// List of all available themes
const themes = [
  'theme-light-grey-minimal',
  'theme-light-minimal',
  'theme-dark-modern',
  'theme-corporate-clean',
  'theme-playful-colorful',
  'theme-elegant-serif',
  'theme-wellness-calm',
  'theme-floral-bliss',
  'theme-ocean-breeze',
  'theme-health-trust',
  'theme-luxury-gold',
  'theme-retro-pop',
  'theme-earthy-organic',
  'theme-tech-neon',
  'theme-desert-sand',
  'theme-bold-monochrome',
  'theme-sunset-gradient',
  'theme-cyber-grid',
  'theme-candy-shop'
];

async function compressImage(inputPath, outputPath, maxWidth = 700) {
  try {
    await sharp(inputPath)
      .resize(maxWidth, null, { withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toFile(outputPath);
    
    // Remove the original uncompressed file
    fs.unlinkSync(inputPath);
    console.log(`✓ Compressed: ${path.basename(outputPath)}`);
  } catch (error) {
    console.error(`Error compressing ${inputPath}:`, error);
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Function to extract and preload background images
async function injectAndPreloadBackgrounds(page) {
  console.log('📥 Injecting thumbnails-bgs.css and preloading background images...');
  
  // Read the thumbnails-bgs.css file
  const cssPath = path.join(__dirname, 'public/css/thumbnails-bgs.css');
  const cssContent = fs.readFileSync(cssPath, 'utf8');
  
  // Inject the CSS and extract/preload background images
  await page.evaluate((css) => {
    // Inject the CSS
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    
    // Extract all background image URLs from the CSS
    const urlRegex = /url\(['"]?([^'"()]+)['"]?\)/g;
    const urls = [];
    let match;
    
    while ((match = urlRegex.exec(css)) !== null) {
      urls.push(match[1]);
    }
    
    // Remove duplicates
    const uniqueUrls = [...new Set(urls)];
    
    // Preload all background images
    return Promise.all(
      uniqueUrls.map(url => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(url);
          img.onerror = () => resolve(url); // Resolve even on error to not block
          img.src = url;
          
          // Timeout after 10 seconds
          setTimeout(() => resolve(url), 10000);
        });
      })
    );
  }, cssContent);
  
  console.log('✓ Background images preloaded\n');
}

async function captureViewportScreenshots() {
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: { width: 1920, height: 1080 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  // Set user agent to avoid mobile detection
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  // Load the HTML file
  await page.goto('http://localhost/nine-screen-canvas-flow/all.html', {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });

  // Wait for fonts and images to load
  await sleep(2000);

  console.log('🚀 Starting viewport screenshot generation...\n');

  let totalScreenshots = 0;

  // Only process the first theme
  const theme = themes[0];
  console.log(`\n📸 Processing theme: ${theme}`);
  
  // Apply theme
  await page.evaluate((themeName) => {
    document.body.className = themeName;
  }, theme);

  // Hide theme selector and add custom styles
  await page.evaluate(() => {
    const themeSelector = document.querySelector('.theme-selector');
    if (themeSelector) {
      themeSelector.style.display = 'none';
    }
    
    // Add custom styles to sections
    const style = document.createElement('style');
    style.textContent = `
      section {
        max-height: 100vh;
        overflow: auto;
        padding: 4em 0;
      }
    `;
    document.head.appendChild(style);
  });

  // Wait for theme transition
  await sleep(500);

  // Inject thumbnails-bgs.css and preload all background images
  await injectAndPreloadBackgrounds(page);

  // Scroll to top
  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });

  await sleep(1000);

  // Get page dimensions
  const { viewportHeight, totalHeight } = await page.evaluate(() => {
    return {
      viewportHeight: window.innerHeight,
      totalHeight: document.body.scrollHeight
    };
  });

  let scrollPosition = 0;
  let screenshotIndex = 1;

  while (scrollPosition < totalHeight) {
    try {
      // Scroll to current position
      await page.evaluate((y) => {
        window.scrollTo(0, y);
      }, scrollPosition);

      // Wait for scroll and any animations
      await sleep(1000);

      // Take screenshot WITHOUT background image (regular version)
      const screenshotPath = path.join(screenshotsDir, `${screenshotIndex}.png`);
      await page.screenshot({
        path: screenshotPath,
        omitBackground: false
      });

      // Compress the screenshot
      const compressedPath = path.join(screenshotsDir, `${screenshotIndex}.jpg`);
      await compressImage(screenshotPath, compressedPath, 700);

      totalScreenshots++;
      console.log(`  ✓ Screenshot ${screenshotIndex} (no bg)`);

      // Now add has-bg-image class to all sections in the current viewport
      await page.evaluate(() => {
        const sections = document.querySelectorAll('section');
        sections.forEach(section => {
          section.classList.add('has-bg-image');
        });
      });

      // Wait for background images to render
      await sleep(800);

      // Take screenshot WITH background image
      const screenshotBgPath = path.join(screenshotsDir, `${screenshotIndex}-bg.png`);
      await page.screenshot({
        path: screenshotBgPath,
        omitBackground: false
      });

      // Compress the background screenshot
      const compressedBgPath = path.join(screenshotsDir, `${screenshotIndex}-bg.jpg`);
      await compressImage(screenshotBgPath, compressedBgPath, 700);

      totalScreenshots++;
      console.log(`  ✓ Screenshot ${screenshotIndex}-bg (with bg)`);

      // Remove has-bg-image class from all sections for next iteration
      await page.evaluate(() => {
        const sections = document.querySelectorAll('section');
        sections.forEach(section => {
          section.classList.remove('has-bg-image');
        });
      });

      // Move to next viewport
      scrollPosition += viewportHeight;
      screenshotIndex++;

    } catch (error) {
      console.error(`❌ Error capturing screenshot ${screenshotIndex}:`, error.message);
      break;
    }
  }

  await browser.close();
  
  console.log(`\n🎉 Viewport screenshot generation complete!`);
  console.log(`📊 Total screenshots generated: ${totalScreenshots}`);
  console.log(`📁 Screenshots saved in: ${screenshotsDir}`);
  console.log(`📏 All images compressed to max 700px width`);
}

// Function to capture full page screenshots for each theme
async function captureFullPageScreenshots() {
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: { width: 1920, height: 1080 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  await page.goto('http://localhost/nine-screen-canvas-flow/all.html', {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });

  await sleep(2000);

  console.log('\n📸 Capturing full page screenshots...\n');

  // Only process the first theme
  const theme = themes[0];
  try {
    console.log(`Processing full page: ${theme}`);
    
    // Apply theme
    await page.evaluate((themeName) => {
      document.body.className = themeName;
    }, theme);

    // Hide theme selector and add custom styles
    await page.evaluate(() => {
      const themeSelector = document.querySelector('.theme-selector');
      if (themeSelector) {
        themeSelector.style.display = 'none';
      }
      
      // Add custom styles to sections
      const style = document.createElement('style');
      style.textContent = `
        section {
          max-height: 100vh;
          overflow: auto;
          padding: 4em 0;
        }
      `;
      document.head.appendChild(style);
    });

    await sleep(500);

    // Inject thumbnails-bgs.css and preload all background images
    await injectAndPreloadBackgrounds(page);

    // Scroll to top
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });

    await sleep(1000);

    // Take full page screenshot WITHOUT background images
    const screenshotPath = path.join(screenshotsDir, 'full-page.png');
    await page.screenshot({
      path: screenshotPath,
      fullPage: true,
      omitBackground: false
    });

    // Compress the full page screenshot
    const compressedPath = path.join(screenshotsDir, 'full-page.jpg');
    await compressImage(screenshotPath, compressedPath, 700);

    console.log(`  ✓ Full page screenshot (no bg)`);

    // Add has-bg-image class to all sections
    await page.evaluate(() => {
      const sections = document.querySelectorAll('section');
      sections.forEach(section => {
        section.classList.add('has-bg-image');
      });
    });

    // Wait for background images to render
    await sleep(1000);

    // Take full page screenshot WITH background images
    const screenshotBgPath = path.join(screenshotsDir, 'full-page-bg.png');
    await page.screenshot({
      path: screenshotBgPath,
      fullPage: true,
      omitBackground: false
    });

    // Compress the full page screenshot with backgrounds
    const compressedBgPath = path.join(screenshotsDir, 'full-page-bg.jpg');
    await compressImage(screenshotBgPath, compressedBgPath, 700);

    console.log(`  ✓ Full page screenshot (with bg)`);

  } catch (error) {
    console.error(`❌ Error capturing full page:`, error.message);
  }

  await browser.close();
  console.log('\n✅ Full page screenshots complete!');
}

// Main execution
async function main() {
  try {
    console.log('🎨 ModernCo Viewport Screenshot Generator');
    console.log('==========================================\n');
    
    // Capture viewport screenshots
    await captureViewportScreenshots();
    
    // Capture full page screenshots
    await captureFullPageScreenshots();
    
    console.log('\n🎊 All screenshots generated successfully!');
    console.log(`📂 Check the '${screenshotsDir}' directory for your screenshots.`);
    
  } catch (error) {
    console.error('❌ Error during screenshot generation:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { captureViewportScreenshots, captureFullPageScreenshots }; 