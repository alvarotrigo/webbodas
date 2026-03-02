<?php
/**
 * Section to Script File Mapping
 * Maps section IDs to their required JavaScript files
 * 
 * This file is synchronized with public/js/section-initializer.js
 * Update both files when adding new interactive sections
 */

/**
 * Get the section-to-init-function mapping
 * Maps section IDs to their initialization function names
 * @return array Associative array mapping section IDs to init function names
 */
function getSectionInitMap() {
    return [
        // Gallery sections
        'fp-theme-gallery-thumbs' => 'galleryThumbsInit',
        'fp-theme-gallery-thumbs-fade' => 'galleryThumbsFadeInit',
        'fp-theme-gallery-slider' => 'gallerySliderInit',
        'fp-theme-gallery-slider-arrows' => 'gallerySliderArrowsInit',
        'fp-theme-gallery-scroll' => 'galleryScrollInit',
        
        // Team sections
        'fp-theme-team-slider' => 'teamSliderInit',
        'fp-theme-team-carousel' => 'teamCarouselInit',
        'fp-theme-exceptional-team' => 'exceptionalTeamInit',
        
        // Testimonial sections
        'fp-theme-testimonial-carousel' => 'testimonialCarouselInit',
        'fp-theme-testimonials-interactive' => 'testimonialsInteractiveInit',
        
        // Product/slider sections
        'fp-theme-product-slider' => 'productSliderInit',
        'fp-theme-steps-slider' => 'stepsSliderInit',
        
        // Pricing
        'fp-theme-pricing-toggle' => 'pricingToggleInit',
        
        // Interactive features
        'fp-theme-interactive-features' => 'interactiveFeaturesInit',
        
        // Generic accordion sections
        'fp-theme-faqs' => 'accordionInit',
        'fp-theme-faq-image' => 'accordionInit',
        'fp-theme-questions-answers' => 'accordionInit',
        'fp-theme-split-faq' => 'accordionInit',
        'fp-theme-features-accordion' => 'accordionInit',
        
        // Specialized accordion sections
        'fp-theme-process-accordion' => 'processAccordionInit',
        'fp-theme-popular-questions' => 'popularQuestionsInit'
    ];
}

/**
 * Get the complete section-to-script mapping
 * @return array Associative array mapping section IDs to script files
 */
function getSectionScriptMap() {
    return [
        // Gallery sections
        'fp-theme-gallery-thumbs' => 'fp-theme-gallery-thumbs.js',
        'fp-theme-gallery-thumbs-fade' => 'fp-theme-gallery-thumbs-fade.js',
        'fp-theme-gallery-slider' => 'fp-theme-gallery-slider.js',
        'fp-theme-gallery-slider-arrows' => 'fp-theme-gallery-slider-arrows.js',
        'fp-theme-gallery-scroll' => 'fp-theme-gallery-scroll.js',
        
        // Team sections
        'fp-theme-team-slider' => 'fp-theme-team-slider.js',
        'fp-theme-team-carousel' => 'fp-theme-team-carousel.js',
        'fp-theme-exceptional-team' => 'fp-theme-exceptional-team.js',
        
        // Testimonial sections
        'fp-theme-testimonial-carousel' => 'fp-theme-testimonial-carousel.js',
        'fp-theme-testimonials-interactive' => 'fp-theme-testimonials-interactive.js',
        
        // Product/slider sections
        'fp-theme-product-slider' => 'fp-theme-product-slider.js',
        'fp-theme-steps-slider' => 'fp-theme-steps-slider.js',
        
        // Pricing
        'fp-theme-pricing-toggle' => 'fp-theme-pricing-toggle.js',
        
        // Interactive features
        'fp-theme-interactive-features' => 'fp-theme-interactive-features.js',
        
        // Generic accordion sections (all share the same script)
        'fp-theme-faqs' => 'fp-theme-accordion.js',
        'fp-theme-faq-image' => 'fp-theme-accordion.js',
        'fp-theme-questions-answers' => 'fp-theme-accordion.js',
        'fp-theme-split-faq' => 'fp-theme-accordion.js',
        'fp-theme-features-accordion' => 'fp-theme-accordion.js',
        
        // Specialized accordion sections
        'fp-theme-process-accordion' => 'fp-theme-process-accordion.js',
        
        // Hybrid section: custom categories + generic accordion
        // This section requires BOTH scripts
        'fp-theme-popular-questions' => ['fp-theme-popular-questions.js', 'fp-theme-accordion.js']
    ];
}

/**
 * Get required script files for given section IDs (with automatic deduplication)
 * @param array $sectionIds Array of section IDs
 * @return array Array of unique script filenames (sorted alphabetically)
 */
function getRequiredScripts($sectionIds) {
    $scriptMap = getSectionScriptMap();
    $scripts = [];
    
    foreach ($sectionIds as $sectionId) {
        if (isset($scriptMap[$sectionId])) {
            $scriptFile = $scriptMap[$sectionId];
            
            // Handle both single script and array of scripts
            if (is_array($scriptFile)) {
                foreach ($scriptFile as $file) {
                    $scripts[$file] = true; // Use key to auto-deduplicate
                }
            } else {
                $scripts[$scriptFile] = true;
            }
        }
    }
    
    // Convert keys to array and sort
    $uniqueScripts = array_keys($scripts);
    sort($uniqueScripts);
    
    return $uniqueScripts;
}

/**
 * Extract section IDs from sections data
 * Parses HTML to find section IDs since they're embedded in the HTML, not separate fields
 * @param array $sections Array of section objects/arrays (each containing 'html' key)
 * @return array Array of section IDs
 */
function extractSectionIds($sections) {
    $sectionIds = [];
    
    foreach ($sections as $section) {
        $html = '';
        
        // Get HTML content from section data
        if (is_array($section) && isset($section['html'])) {
            $html = $section['html'];
        } elseif (is_object($section) && isset($section->html)) {
            $html = $section->html;
        } elseif (is_string($section)) {
            // In case sections are passed as HTML strings directly
            $html = $section;
        }
        
        if (empty($html)) {
            continue;
        }
        
        // Parse HTML to extract section ID using regex
        // Look for <section id="..." or <section ... id="..."
        if (preg_match('/<section[^>]*\sid=["\']([^"\']+)["\']/', $html, $matches)) {
            $sectionIds[] = $matches[1];
        }
    }
    
    return $sectionIds;
}
?>

