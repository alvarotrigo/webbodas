<?php
/**
 * Section ID to HTML content mapping
 * 
 * This file provides a mapping of section IDs to their HTML content.
 * Generated from the sections array in app.php and the actual HTML files.
 * 
 * Usage:
 *   require_once __DIR__ . '/config/sections-map.php';
 *   $html = getSectionHtml($sectionId);
 */

$projectRoot = dirname(__DIR__);
$sectionsPath = $projectRoot . '/sections';

/**
 * Section data mapping (from app.php lines 2698-2872)
 * Maps section ID to filename
 */
$sectionsMap = [
    1 => 'fp-theme-hero.html',
    2 => 'fp-theme-hero2.html',
    3 => 'fp-theme-inspiration.html',
    4 => 'fp-theme-discussion.html',
    5 => 'fp-theme-single-testimonial.html',
    6 => 'fp-theme-customer-testimonial.html',
    7 => 'fp-theme-how-it-works.html',
    8 => 'fp-theme-signup.html',
    9 => 'fp-theme-trusted-by.html',
    10 => 'fp-theme-collections.html',
    11 => 'fp-theme-photography-skills.html',
    12 => 'fp-theme-success-stories.html',
    13 => 'fp-theme-business-growth.html',
    14 => 'fp-theme-about.html',
    15 => 'fp-theme-features.html',
    16 => 'fp-theme-features2.html',
    17 => 'fp-theme-testimonials.html',
    18 => 'fp-theme-testimonials-interactive.html',
    19 => 'fp-theme-testimonial-cards.html',
    20 => 'fp-theme-testimonial-split.html',
    21 => 'fp-theme-testimonial-carousel.html',
    22 => 'fp-theme-testimonial-grid.html',
    23 => 'fp-theme-client-feedback.html',
    24 => 'fp-theme-customer-experience.html',
    25 => 'fp-theme-customer-story.html',
    26 => 'fp-theme-happy-users.html',
    27 => 'fp-theme-pricing.html',
    28 => 'fp-theme-pricing-2.html',
    29 => 'fp-theme-pricing-3.html',
    30 => 'fp-theme-pricing-4.html',
    31 => 'fp-theme-pricing-5.html',
    32 => 'fp-theme-pricing-6.html',
    33 => 'fp-theme-bio.html',
    34 => 'fp-theme-team.html',
    35 => 'fp-theme-team2.html',
    36 => 'fp-theme-faqs.html',
    37 => 'fp-theme-numbers.html',
    38 => 'fp-theme-screenshot.html',
    39 => 'fp-theme-cta.html',
    40 => 'fp-theme-team-layout-1.html',
    41 => 'fp-theme-web-app.html',
    42 => 'fp-theme-team-layout-2.html',
    43 => 'fp-theme-features-showcase.html',
    44 => 'fp-theme-team-circles.html',
    45 => 'fp-theme-card-section.html',
    46 => 'fp-theme-contact.html',
    47 => 'fp-theme-welcome.html',
    48 => 'fp-theme-hero-2.html',
    49 => 'fp-theme-email.html',
    50 => 'fp-theme-simple-form.html',
    51 => 'fp-theme-gallery.html',
    52 => 'fp-theme-gallery-2.html',
    53 => 'fp-theme-form-split.html',
    54 => 'fp-theme-people.html',
    55 => 'fp-theme-numbers-2.html',
    56 => 'fp-theme-phone-mockup.html',
    57 => 'fp-theme-video-bottom.html',
    58 => 'fp-theme-video-top.html',
    59 => 'fp-theme-video-center.html',
    60 => 'fp-theme-half-image.html',
    61 => 'fp-theme-rotated-images.html',
    62 => 'fp-theme-why-care.html',
    63 => 'fp-theme-contact-info.html',
    64 => 'fp-theme-pricing-comparison.html',
    65 => 'fp-theme-comparison-table.html',
    66 => 'fp-theme-events-grid.html',
    67 => 'fp-theme-events-list.html',
    68 => 'fp-theme-pros-cons.html',
    69 => 'fp-theme-features-accordion.html',
    70 => 'fp-theme-product-slider.html',
    71 => 'fp-theme-video-split.html',
    72 => 'fp-theme-video-split-right.html',
    73 => 'fp-theme-video-heading.html',
    74 => 'fp-theme-gallery-scroll.html',
    75 => 'fp-theme-image-only.html',
    76 => 'fp-theme-image-center.html',
    77 => 'fp-theme-image-top.html',
    78 => 'fp-theme-image-bottom.html',
    79 => 'fp-theme-bento-gallery.html',
    80 => 'fp-theme-masonry-gallery.html',
    81 => 'fp-theme-gallery-split.html',
    82 => 'fp-theme-gallery-grid.html',
    83 => 'fp-theme-gallery-asymmetric.html',
    84 => 'fp-theme-gallery-slider.html',
    85 => 'fp-theme-gallery-expand.html',
    86 => 'fp-theme-gallery-expand-overlay.html',
    87 => 'fp-theme-gallery-slider-arrows.html',
    88 => 'fp-theme-gallery-thumbs.html',
    89 => 'fp-theme-gallery-thumbs-fade.html',
    90 => 'fp-theme-gallery-grid-links.html',
    91 => 'fp-theme-gallery-collection-split.html',
    92 => 'fp-theme-gallery-overflow.html',
    93 => 'fp-theme-gallery-features.html',
    94 => 'fp-theme-features-grid.html',
    95 => 'fp-theme-featured-benefits.html',
    96 => 'fp-theme-user-features.html',
    97 => 'fp-theme-business-features.html',
    98 => 'fp-theme-image-features.html',
    99 => 'fp-theme-task-features.html',
    100 => 'fp-theme-phone-features.html',
    101 => 'fp-theme-customer-features.html',
    102 => 'fp-theme-sustainable-features.html',
    103 => 'fp-theme-network-features.html',
    104 => 'fp-theme-interactive-features.html',
    105 => 'fp-theme-standout-features.html',
    106 => 'fp-theme-questions-answers.html',
    107 => 'fp-theme-popular-questions.html',
    108 => 'fp-theme-inline-faq.html',
    109 => 'fp-theme-split-faq.html',
    110 => 'fp-theme-faq-image.html',
    111 => 'fp-theme-faq-visible.html',
    112 => 'fp-theme-faq-hover.html',
    113 => 'fp-theme-pricing-toggle.html',
    114 => 'fp-theme-pricing-cards.html',
    115 => 'fp-theme-pricing-features.html',
    116 => 'fp-theme-event-pricing.html',
    117 => 'fp-theme-dedicated-team.html',
    118 => 'fp-theme-creative-team.html',
    119 => 'fp-theme-skilled-team.html',
    120 => 'fp-theme-exceptional-team-2.html',
    121 => 'fp-theme-award-team.html',
    122 => 'fp-theme-talented-team.html',
    123 => 'fp-theme-collaboration-team.html',
    124 => 'fp-theme-exceptional-team.html',
    125 => 'fp-theme-team-slider.html',
    126 => 'fp-theme-staggered-team.html',
    127 => 'fp-theme-team-carousel.html',
    128 => 'fp-theme-portfolio-grid.html',
    129 => 'fp-theme-blog-entries.html',
    130 => 'fp-theme-latest-blog.html',
    131 => 'fp-theme-contact-form.html',
    132 => 'fp-theme-contact-map.html',
    133 => 'fp-theme-logos-grid.html',
    134 => 'fp-theme-contact-split.html',
    135 => 'fp-theme-integrations-cards.html',
    136 => 'fp-theme-numbers-split.html',
    137 => 'fp-theme-numbers-centered.html',
    138 => 'fp-theme-numbers-with-features.html',
    139 => 'fp-theme-numbers-performance.html',
    140 => 'fp-theme-integrations.html',
    141 => 'fp-theme-numbers-innovative.html',
    142 => 'fp-theme-property-experts.html',
    143 => 'fp-theme-empowering-communities.html',
    144 => 'fp-theme-testimonials-image.html',
    145 => 'fp-theme-logos.html',
    146 => 'fp-theme-login.html',
    147 => 'fp-theme-newsletter-centered.html',
    148 => 'fp-theme-newsletter.html',
    149 => 'fp-theme-cta-1.html',
    150 => 'fp-theme-cta-2.html',
    151 => 'fp-theme-cta-3.html',
    152 => 'fp-theme-cta-4.html',
    153 => 'fp-theme-cta-5.html',
    154 => 'fp-theme-cta-6.html',
    155 => 'fp-theme-contact-2.html',
    156 => 'fp-theme-hero-3.html',
    157 => 'fp-theme-hero-4.html',
    158 => 'fp-theme-hero-5.html',
    159 => 'fp-theme-footer.html',
    160 => 'fp-theme-about-video-stats.html',
    161 => 'fp-theme-achievement-story.html',
    162 => 'fp-theme-process-steps.html',
    163 => 'fp-theme-guide-steps.html',
    164 => 'fp-theme-onboarding-flow.html',
    165 => 'fp-theme-understanding-steps.html',
    166 => 'fp-theme-process-accordion.html',
    167 => 'fp-theme-step-cards.html',
    168 => 'fp-theme-steps-slider.html',
    169 => 'fp-theme-testimonials-cards.html',
    170 => 'fp-theme-footer-1.html',
    171 => 'fp-theme-footer-2.html',
    172 => 'fp-theme-footer-3.html',
    173 => 'fp-theme-footer-4.html',
];

// Cache for loaded HTML content
$sectionHtmlCache = [];

/**
 * Get HTML content for a section by ID
 * 
 * @param int $sectionId Section ID (1-173)
 * @return string|null HTML content or null if not found
 */
function getSectionHtml(int $sectionId): ?string {
    global $sectionsMap, $sectionsPath, $sectionHtmlCache;
    
    // Check cache first
    if (isset($sectionHtmlCache[$sectionId])) {
        return $sectionHtmlCache[$sectionId];
    }
    
    // Check if section ID exists
    if (!isset($sectionsMap[$sectionId])) {
        return null;
    }
    
    // Get filename
    $filename = $sectionsMap[$sectionId];
    $filePath = $sectionsPath . '/' . $filename;
    
    // Check if file exists
    if (!file_exists($filePath)) {
        return null;
    }
    
    // Read and cache HTML content
    $html = file_get_contents($filePath);
    $sectionHtmlCache[$sectionId] = $html;
    
    return $html;
}

/**
 * Get all section IDs that have HTML files
 * 
 * @return array Array of section IDs
 */
function getAvailableSectionIds(): array {
    global $sectionsMap, $sectionsPath;
    
    $available = [];
    foreach ($sectionsMap as $id => $filename) {
        $filePath = $sectionsPath . '/' . $filename;
        if (file_exists($filePath)) {
            $available[] = $id;
        }
    }
    
    return $available;
}

/**
 * Get section filename by ID
 * 
 * @param int $sectionId Section ID
 * @return string|null Filename or null if not found
 */
function getSectionFilename(int $sectionId): ?string {
    global $sectionsMap;
    return $sectionsMap[$sectionId] ?? null;
}

