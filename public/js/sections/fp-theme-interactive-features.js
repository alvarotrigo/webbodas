/**
 * Interactive Features Section - Feature Tab Switcher
 * Handles switching between different feature tabs with descriptions and images
 */
/* global lucide */

// Core initialization function
function initInteractiveFeatures(section, isDynamic = false) {
  if (!section) return;
  
  // Skip if already initialized
  if (section.hasAttribute('data-interactive-features-initialized')) return;
  
  // Mark as initialized to prevent duplicate event listeners
  section.setAttribute('data-interactive-features-initialized', 'true');
  
  const featureTabs = section.querySelectorAll('.feature-tab');
  const contentWrapper = section.querySelector('.feature-content-wrapper');
  const descriptionEl = section.querySelector('#feature-description');
  const imageEl = section.querySelector('#feature-image');
  
  if (!featureTabs.length || !contentWrapper || !descriptionEl || !imageEl) {
    console.error('Interactive Features: Required elements not found in section', section.id);
    return;
  }
  
  console.log('Interactive Features initialized for section:', section.id);
  
  // Switch feature tab function
  function switchFeatureTab(tabElement) {
    // Remove active class from all tabs
    featureTabs.forEach(tab => {
      tab.classList.remove('active');
    });
    
    // Add active class to clicked tab
    tabElement.classList.add('active');
    
    // Get the index from the button
    const index = tabElement.getAttribute('data-index');
    
    // Get data from the content wrapper using the index
    const description = contentWrapper.getAttribute(`data-description-${index}`);
    const image = contentWrapper.getAttribute(`data-image-${index}`);
    
    // Update description directly
    if (description) {
      descriptionEl.textContent = description;
    }
    
    // Update image directly
    if (image) {
      imageEl.src = image;
    }
  }
  
  // Add click event listeners to all feature tabs
  featureTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      switchFeatureTab(tab);
    });
  });
  
  // Initialize Lucide icons if available
  const maybeLucide = /** @type {any} */ (window).lucide;
  if (typeof maybeLucide !== 'undefined' && maybeLucide && typeof maybeLucide.createIcons === 'function') {
    maybeLucide.createIcons();
  }
}

// Export for section initializer
/** @type {any} */ (window).interactiveFeaturesInit = function(section) {
  if (!section) return;
  // Mark as dynamic since this entrypoint is used for appended sections
  initInteractiveFeatures(section, true);
};

// Auto-initialize on page load for standalone usage
document.addEventListener('DOMContentLoaded', () => {
  const sections = document.querySelectorAll('[id^="fp-theme-interactive-features"]');
  sections.forEach(section => {
    // Initial page load: not dynamically appended
    initInteractiveFeatures(section, false);
  });
});

