const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function extractSections() {
  console.log('Starting section extraction...');
  
  // Launch browser
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-web-security', // Allow local file access
      '--disable-features=IsolateOrigins,site-per-process'
    ]
  });

  try {
    const page = await browser.newPage();
    
    // Disable loading of images and fonts to speed up page load
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });
    
    // Load the HTML file
    const htmlPath = path.join(__dirname, 'all.html');
    console.log(`Loading HTML file: ${htmlPath}`);
    
    // Use domcontentloaded instead of networkidle0 for faster load
    // and increase timeout to 60 seconds
    await page.goto(`file://${htmlPath}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    // Wait for the app to load with increased timeout
    await page.waitForSelector('#app', { timeout: 20000 });
    
    console.log('App loaded successfully, extracting sections...');

    // Extract all section elements from the app
    const sections = await page.evaluate(() => {
      const app = document.getElementById('app');
      if (!app) {
        throw new Error('App element not found');
      }
      
      const sectionElements = app.querySelectorAll('section, footer');
      console.log(`Found ${sectionElements.length} sections`);
      
      return Array.from(sectionElements).map((section, index) => {
        return {
          index: index + 1,
          id: section.id || `section-${index + 1}`,
          className: section.className,
          tagName: section.tagName.toLowerCase(),
          outerHTML: section.outerHTML
        };
      });
    });

    console.log(`Extracted ${sections.length} sections`);

    // Separate footer sections from regular sections
    const footerSections = sections.filter(section => 
      section.tagName === 'footer' ||
      section.id.toLowerCase().includes('footer') || 
      section.className.toLowerCase().includes('footer')
    );
    const regularSections = sections.filter(section => 
      section.tagName !== 'footer' &&
      !section.id.toLowerCase().includes('footer') && 
      !section.className.toLowerCase().includes('footer')
    );

    console.log(`Found ${regularSections.length} regular sections and ${footerSections.length} footer sections`);

    // Create sections directory if it doesn't exist
    const sectionsDir = path.join(__dirname, 'sections');
    if (!fs.existsSync(sectionsDir)) {
      fs.mkdirSync(sectionsDir, { recursive: true });
      console.log(`Created sections directory: ${sectionsDir}`);
    }

    // Save regular sections
    let savedCount = 0;
    regularSections.forEach((section, index) => {
      try {
        // Create a safe filename from the section ID
        const safeId = section.id.replace(/[^a-zA-Z0-9-_]/g, '_');
        const filename = `${safeId}.html`;
        const filePath = path.join(sectionsDir, filename);
        
        // Write the section to file
        fs.writeFileSync(filePath, section.outerHTML, 'utf8');
        
        console.log(`  ✅ Section ${section.index}: ${section.id} -> ${filename}`);
        savedCount++;
      } catch (error) {
        console.error(`  ❌ Error saving section ${section.index} (${section.id}):`, error.message);
      }
    });

    // Save footer sections (same directory as regular sections so app fetch sections/<file> works)
    let footerSavedCount = 0;
    footerSections.forEach((section, index) => {
      try {
        // Create a safe filename from the section ID
        const safeId = section.id.replace(/[^a-zA-Z0-9-_]/g, '_');
        const filename = `${safeId}.html`;
        const filePath = path.join(sectionsDir, filename);
        
        // Write the section to file
        fs.writeFileSync(filePath, section.outerHTML, 'utf8');
        
        console.log(`  ✅ Footer ${section.index}: ${section.id} -> ${filename}`);
        footerSavedCount++;
      } catch (error) {
        console.error(`  ❌ Error saving footer section ${section.index} (${section.id}):`, error.message);
      }
    });

    console.log(`\n🎉 Successfully saved ${savedCount} regular sections and ${footerSavedCount} footer sections`);
    
    // Create an index file listing all sections
    const indexContent = `# Extracted Sections

Total sections: ${sections.length}
- Regular sections: ${regularSections.length}
- Footer sections: ${footerSections.length}

## Regular Sections:

${regularSections.map(section => `- **${section.index}.** \`${section.id}\` -> \`${section.id.replace(/[^a-zA-Z0-9-_]/g, '_')}.html\``).join('\n')}

## Footer Sections:

${footerSections.map(section => `- **${section.index}.** \`${section.id}\` -> \`${section.id.replace(/[^a-zA-Z0-9-_]/g, '_')}.html\``).join('\n')}

## Files created:

### Regular Sections:
${regularSections.map(section => `- \`${section.id.replace(/[^a-zA-Z0-9-_]/g, '_')}.html\` - ${section.id}`).join('\n')}

### Footer Sections:
${footerSections.map(section => `- \`${section.id.replace(/[^a-zA-Z0-9-_]/g, '_')}.html\` - ${section.id}`).join('\n')}
`;

    const indexPath = path.join(sectionsDir, 'README.md');
    fs.writeFileSync(indexPath, indexContent, 'utf8');
    console.log(`📝 Created index file: ${indexPath}`);

  } catch (error) {
    console.error('❌ Error during extraction:', error.message);
    throw error;
  } finally {
    await browser.close();
    console.log('Browser closed');
  }
}

// Run the extraction
extractSections()
  .then(() => {
    console.log('🎉 Section extraction completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Section extraction failed:', error);
    process.exit(1);
  }); 