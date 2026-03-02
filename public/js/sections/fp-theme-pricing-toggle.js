/**
 * Pricing Toggle Section - Monthly/Yearly Switch
 * Handles pricing plan toggle between monthly and yearly billing
 */
/* global lucide */

// Core initialization function
function initPricingToggle(section, isDynamic = false) {
  if (!section) return;
  
  // Skip if already initialized
  if (section.hasAttribute('data-pricing-initialized')) return;
  if (isDynamic) {
    section.setAttribute('data-pricing-initialized', 'true');
  }
  
  let isYearly = false;
  
  const toggleButton = section.querySelector('[data-pricing-toggle]');
  const slider = section.querySelector('[data-pricing-slider]');
  const monthlyLabel = section.querySelector('[data-pricing-monthly]');
  const yearlyLabel = section.querySelector('[data-pricing-yearly]');
  
  if (!toggleButton || !slider) {
    console.error('Pricing toggle: Required elements not found in section', section.id);
    return;
  }
  
  console.log('Pricing toggle initialized for section:', section.id);
  
  // Toggle pricing function
  function togglePricing() {
    isYearly = !isYearly;
    
    const pricingAmounts = section.querySelectorAll('.pricing-amount');
    const pricingPeriods = section.querySelectorAll('.pricing-period');
    
    if (isYearly) {
      // Switch to yearly
      slider.style.transform = 'translateX(32px)';
      
      if (monthlyLabel) monthlyLabel.style.color = 'var(--secondary-text)';
      if (yearlyLabel) yearlyLabel.style.color = 'var(--primary-text)';
      
      // Update pricing amounts (show yearly price)
      pricingAmounts.forEach(amount => {
        const yearlyPrice = amount.dataset.yearly;
        if (yearlyPrice) {
          amount.textContent = yearlyPrice;
        }
      });
      
      // Update period text
      pricingPeriods.forEach(period => {
        period.textContent = 'Year';
      });
    } else {
      // Switch to monthly
      slider.style.transform = 'translateX(0)';
      
      if (monthlyLabel) monthlyLabel.style.color = 'var(--primary-text)';
      if (yearlyLabel) yearlyLabel.style.color = 'var(--secondary-text)';
      
      // Update pricing amounts (show monthly price)
      pricingAmounts.forEach(amount => {
        const monthlyPrice = amount.dataset.monthly;
        if (monthlyPrice) {
          amount.textContent = monthlyPrice;
        }
      });
      
      // Update period text
      pricingPeriods.forEach(period => {
        period.textContent = 'Month';
      });
    }
  }
  
  // Add click event listener to toggle button
  toggleButton.addEventListener('click', togglePricing);
  
  // Initialize Lucide icons if available
  const maybeLucide = /** @type {any} */ (window).lucide;
  if (typeof maybeLucide !== 'undefined' && maybeLucide && typeof maybeLucide.createIcons === 'function') {
    maybeLucide.createIcons();
  }
}

// Export for section initializer
/** @type {any} */ (window).pricingToggleInit = function(section) {
  if (!section) return;
  // Mark as dynamic since this entrypoint is used for appended sections
  initPricingToggle(section, true);
};

// Auto-initialize on page load for standalone usage
document.addEventListener('DOMContentLoaded', () => {
  const sections = document.querySelectorAll('[id^="fp-theme-pricing-toggle"]');
  sections.forEach(section => {
    // Initial page load: not dynamically appended
    initPricingToggle(section, false);
  });
});
