/**
 * Section Script Initializer
 * Initializes interactive functionality for dynamically added sections
 */

window.SectionInitializer = {
  // Map section IDs to their init function names
  // Used for dynamically added sections in the editor
  initFunctionMap: {
    // Gallery sections
    'fp-theme-gallery-thumbs': 'galleryThumbsInit',
    'fp-theme-gallery-thumbs-fade': 'galleryThumbsFadeInit',
    'fp-theme-gallery-slider': 'gallerySliderInit',
    'fp-theme-gallery-slider-arrows': 'gallerySliderArrowsInit',
    'fp-theme-gallery-scroll': 'galleryScrollInit',
    
    // Team sections
    'fp-theme-team-slider': 'teamSliderInit',
    'fp-theme-team-carousel': 'teamCarouselInit',
    'fp-theme-exceptional-team': 'exceptionalTeamInit',
    
    // Testimonial sections
    'fp-theme-testimonial-carousel': 'testimonialCarouselInit',
    'fp-theme-testimonials-interactive': 'testimonialsInteractiveInit',
    
    // Product/slider sections
    'fp-theme-product-slider': 'productSliderInit',
    'fp-theme-steps-slider': 'stepsSliderInit',
    
    // Pricing
    'fp-theme-pricing-toggle': 'pricingToggleInit',
    
    // Interactive features
    'fp-theme-interactive-features': 'interactiveFeaturesInit',
    
    // Accordion sections (using generic accordion script)
    'fp-theme-faqs': 'accordionInit',
    'fp-theme-faq-image': 'accordionInit',
    'fp-theme-questions-answers': 'accordionInit',
    'fp-theme-split-faq': 'accordionInit',
    'fp-theme-features-accordion': 'accordionInit',
    
    // Accordion sections (specialized/hybrid)
    'fp-theme-process-accordion': 'processAccordionInit',
    'fp-theme-popular-questions': 'popularQuestionsInit' // Hybrid: custom categories + generic accordion
  },

  /**
   * Initialize scripts for a dynamically added section element
   * Used in the editor when sections are added/moved
   */
  initSection: function(sectionElement) {
    if (!sectionElement) return;
    
    const sectionId = sectionElement.id;
    if (!sectionId) return;
    
    // Get the init function name from the map
    const initFunctionName = this.initFunctionMap[sectionId];
    
    if (!initFunctionName) {
      // No init function for this section (it might not need one)
      return;
    }
    
    // Call the init function if it exists on window
    const initFunction = window[initFunctionName];
    if (typeof initFunction === 'function') {
      try {
        // For accordion init, pass true to indicate dynamic content
        if (initFunctionName === 'accordionInit') {
          initFunction(sectionElement, true);
        } else {
          initFunction(sectionElement);
        }
      } catch (error) {
        console.error(`Error initializing section ${sectionId}:`, error);
      }
    } else {
      console.warn(`Init function ${initFunctionName} not found for section ${sectionId}`);
    }
  }
};
