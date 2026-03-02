import { test, expect } from '@playwright/test';

test.describe('History Undo/Redo Feature', () => {
  test('should correctly undo multiple text edits', async ({ page }) => {
    // Enable console logging to capture history debug messages
    const consoleMessages = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('History:') || text.includes('⏪') || text.includes('💾') || text.includes('⏱️') || text.includes('⏩')) {
        consoleMessages.push(text);
      }
    });

    // Clear localStorage and navigate to editor
    await page.goto('http://localhost:8000/app.php?developer=1');
    await page.evaluate(() => {
      localStorage.clear();
    });
    
    // Wait for iframe to load
    const iframe = page.frameLocator('#preview-iframe');
    await iframe.locator('body').waitFor({ state: 'visible', timeout: 10000 });
    
    // Wait for editor to initialize
    await page.waitForTimeout(3000);

    // Step 1: Add a section using category-list
    // Find and click on a category-item (e.g., "Hero", "Content", etc.)
    const categoryList = page.locator('.category-list');
    await categoryList.waitFor({ state: 'visible', timeout: 5000 });
    
    // Click on the first category-item to show the category panel
    const firstCategory = categoryList.locator('.category-item').first();
    await firstCategory.waitFor({ state: 'visible', timeout: 5000 });
    
    // Hover over the category to trigger the panel
    await firstCategory.hover();
    await page.waitForTimeout(500);
    
    // Wait for category panel to appear
    const categoryPanel = page.locator('#category-hover-panel');
    await categoryPanel.waitFor({ state: 'visible', timeout: 5000 });
    
    // Click on the first category-section-item to add a section
    const categorySectionsGrid = page.locator('#category-sections-grid');
    await categorySectionsGrid.waitFor({ state: 'visible', timeout: 5000 });
    
    const firstSectionInCategory = categorySectionsGrid.locator('.category-section-item').first();
    await firstSectionInCategory.waitFor({ state: 'visible', timeout: 5000 });
    await firstSectionInCategory.click();
    
    // Wait for section to be added to preview
    await page.waitForTimeout(2000);
    
    // Step 2: Find and edit a heading in the preview iframe
    // Wait for section to appear in preview
    await iframe.locator('.section').first().waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForTimeout(2000);

    // Find a heading element (h1, h2, h3, etc.) in the first section
    const heading = iframe.locator('.section h1, .section h2, .section h3').first();
    
    // Wait for heading to be visible
    await heading.waitFor({ state: 'visible', timeout: 10000 });
    await heading.scrollIntoViewIfNeeded();
    
    // Get the original text
    const originalText = (await heading.textContent()) || '';
    console.log('Original heading text:', originalText);

    // Click on the heading to make it editable (TinyMCE should activate)
    await heading.click();
    await page.waitForTimeout(1500); // Wait for TinyMCE to initialize

    // Step 3: Change heading to "a", focus out, wait 1 second
    await heading.clear();
    await heading.fill('a');
    // Focus out by clicking outside the heading
    await page.locator('body').click();
    await page.waitForTimeout(1000);

    // Step 4: Change heading to "b", focus out, wait 1 second
    await heading.click();
    await page.waitForTimeout(500);
    await heading.clear();
    await heading.fill('b');
    await page.locator('body').click();
    await page.waitForTimeout(1000);

    // Step 5: Change heading to "c", focus out, wait 1 second
    await heading.click();
    await page.waitForTimeout(500);
    await heading.clear();
    await heading.fill('c');
    await page.locator('body').click();
    await page.waitForTimeout(1000);

    // Verify current content is "c"
    let currentText = await heading.textContent();
    expect(currentText.trim()).toBe('c');
    console.log('Current text after edits:', currentText);

    // Get history state before undo
    const historyBeforeUndo = await page.evaluate(() => {
      if (window.historyManager) {
        return {
          stackLength: window.historyManager.historyStack.length,
          currentIndex: window.historyManager.historyIndex,
          stack: window.historyManager.historyStack.map((s, i) => ({
            index: i,
            sectionsCount: s.sections?.length || 0,
            firstSectionText: s.sections?.[0]?.html ? 
              (s.sections[0].html.match(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/i)?.[1] || '') : ''
          }))
        };
      }
      return null;
    });
    console.log('History before undo:', JSON.stringify(historyBeforeUndo, null, 2));

    // Step 6: Click undo button once - should get "b"
    const undoBtn = page.locator('#undo-btn');
    await undoBtn.waitFor({ state: 'visible', timeout: 5000 });
    await undoBtn.click();
    await page.waitForTimeout(2500); // Wait longer for undo to complete
    
    currentText = await heading.textContent();
    console.log('Text after first undo:', currentText);
    expect(currentText.trim()).toBe('b');
    
    // Get history state after first undo
    const historyAfterFirstUndo = await page.evaluate(() => {
      if (window.historyManager) {
        return {
          stackLength: window.historyManager.historyStack.length,
          currentIndex: window.historyManager.historyIndex,
          canUndo: window.historyManager.historyIndex > 0,
          isUndoing: window.historyManager.isUndoing,
          isRestoring: window.historyManager.isRestoring
        };
      }
      return null;
    });
    console.log('History after first undo:', JSON.stringify(historyAfterFirstUndo, null, 2));

    // Step 7: Click undo button once more - should get "a"
    await undoBtn.click();
    await page.waitForTimeout(2000); // Wait for undo to complete
    
    currentText = await heading.textContent();
    console.log('Text after second undo:', currentText);
    expect(currentText.trim()).toBe('a');

    // Step 8: Click undo button once more - should get original text
    await undoBtn.click();
    await page.waitForTimeout(2000); // Wait for undo to complete
    
    currentText = await heading.textContent();
    console.log('Text after third undo:', currentText);
    expect(currentText.trim()).toBe(originalText.trim());

    // Step 9: Test redo (forward button)
    const redoBtn = page.locator('#redo-btn');
    await redoBtn.waitFor({ state: 'visible', timeout: 5000 });
    
    // Redo once - should get "a"
    await redoBtn.click();
    await page.waitForTimeout(2000);
    currentText = await heading.textContent();
    console.log('Text after first redo:', currentText);
    expect(currentText.trim()).toBe('a');

    // Redo once - should get "b"
    await redoBtn.click();
    await page.waitForTimeout(2000);
    currentText = await heading.textContent();
    console.log('Text after second redo:', currentText);
    expect(currentText.trim()).toBe('b');

    // Redo once - should get "c"
    await redoBtn.click();
    await page.waitForTimeout(2000);
    currentText = await heading.textContent();
    console.log('Text after third redo:', currentText);
    expect(currentText.trim()).toBe('c');

    // Print console messages for debugging
    console.log('\n=== Console Messages ===');
    consoleMessages.forEach(msg => console.log(msg));
    console.log('========================\n');
  });
});
