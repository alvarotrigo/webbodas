<?php
/**
 * Slot Deriver
 * 
 * Derives content slots from section metadata at runtime.
 * This allows generating AI content without modifying the existing metadata catalog.
 * 
 * Usage:
 *   require_once __DIR__ . '/includes/slot-deriver.php';
 *   $schema = derive_slots($sectionMetadata);
 *   $minimal = minimal_section_for_llm($sectionMetadata);
 */

/**
 * Derives content slots from a single section's metadata
 * 
 * @param array $meta Section metadata array
 * @return array Array with 'section_id' and 'slots' keys
 */
function derive_slots(array $meta): array {
    $id            = $meta['id'] ?? '';
    $category      = $meta['category'] ?? '';
    $layout        = $meta['layout'] ?? '';
    $elements      = $meta['elements'] ?? [];
    $cta           = $meta['cta'] ?? 'none';
    $content_units = $meta['content_units'] ?? 0;
    $has_quote     = $meta['has_quote'] ?? false;
    $has_rating    = $meta['has_rating'] ?? false;
    $has_avatars   = $meta['has_avatars'] ?? false;
    
    $slots = [];
    
    $units = function($n, $fallback) { return max(1, $n ?: $fallback); };
    
    // Basics
    if (in_array('heading', $elements, true))    $slots['heading']    = '';
    if (in_array('subheading', $elements, true)) $slots['subheading'] = '';
    if (in_array('paragraph', $elements, true))  $slots['paragraph']  = '';
    
    if (in_array('list', $elements, true)) {
        $count = $units($content_units, 3);
        $slots['bullets'] = array_fill(0, $count, '');
    }
    
    // CTAs
    if (in_array('button', $elements, true) || $cta !== 'none') {
        if (in_array($cta, ['one','two','multi'], true)) {
            $slots['primary_cta_label'] = '';
            $slots['primary_cta_url']   = '';
        }
        if (in_array($cta, ['two','multi'], true)) {
            $slots['secondary_cta_label'] = '';
            $slots['secondary_cta_url']   = '';
        }
    }
    
    if ($has_quote && !isset($slots['quote'])) $slots['quote'] = '';
    if ($has_rating && !isset($slots['rating'])) $slots['rating'] = null;
    
    // Cards / features
    $wantsCards = ($category === 'features')
        || ($layout === 'cards')
        || (in_array('card', $elements, true) && ($category === 'content' || $category === 'stats'));
    
    if ($wantsCards) {
        $count = $units($content_units, 3);
        $includeIcon  = in_array('icon', $elements, true);
        $includeImage = in_array('image', $elements, true) || in_array('illustration', $elements, true);
        
        $cards = [];
        for ($i = 0; $i < $count; $i++) {
            $card = ['title' => '', 'description' => ''];
            if ($includeIcon)  $card['icon'] = '';
            if ($includeImage) $card['image_url'] = '';
            $cards[] = $card;
        }
        $slots['cards'] = $cards;
    }
    
    // Testimonials
    if ($category === 'testimonials') {
        $count = $units($content_units, 2);
        $items = [];
        for ($i = 0; $i < $count; $i++) {
            $item = ['quote' => '', 'author' => '', 'role' => ''];
            if ($has_rating)  $item['rating'] = null;
            if ($has_avatars) $item['avatar_url'] = '';
            $items[] = $item;
        }
        $slots['testimonials'] = $items;
    }
    
    // FAQ
    if ($category === 'faq') {
        $count = $units($content_units, 4);
        $faqs = [];
        for ($i = 0; $i < $count; $i++) {
            $faqs[] = ['q' => '', 'a' => ''];
        }
        $slots['faq'] = $faqs;
    }
    
    // Pricing
    if ($category === 'pricing') {
        $count = $units($content_units, 3);
        $plans = [];
        for ($i = 0; $i < $count; $i++) {
            $plans[] = [
                'name' => '',
                'tagline' => '',
                'price' => '',
                'features' => array_fill(0, 5, ''),
                'cta_label' => '',
                'cta_url' => ''
            ];
        }
        $slots['plans'] = $plans;
    }
    
    // Stats
    if ($category === 'stats') {
        $count = $units($content_units, 3);
        $stats = [];
        for ($i = 0; $i < $count; $i++) {
            $stats[] = ['label' => '', 'value' => '', 'qualifier' => ''];
        }
        $slots['stats'] = $stats;
    }
    
    // Logos
    if ($category === 'logos' || in_array('logos', $elements, true) || in_array('logo', $elements, true)) {
        $count = $units($content_units, 6);
        $logos = [];
        for ($i = 0; $i < $count; $i++) {
            $logos[] = ['name' => '', 'logo_url' => ''];
        }
        $slots['logos'] = $logos;
    }
    
    // Team
    if ($category === 'team') {
        $count = $units($content_units, 3);
        $team = [];
        for ($i = 0; $i < $count; $i++) {
            $member = ['name' => '', 'role' => '', 'bio' => ''];
            if ($has_avatars) $member['avatar_url'] = '';
            $team[] = $member;
        }
        $slots['team'] = $team;
    }
    
    // Steps
    if ($category === 'steps') {
        $count = $units($content_units, 3);
        $steps = [];
        for ($i = 0; $i < $count; $i++) {
            $steps[] = ['step_number' => $i + 1, 'title' => '', 'description' => ''];
        }
        $slots['steps'] = $steps;
    }
    
    // Gallery / Portfolio
    if ($category === 'gallery' || $category === 'portfolio') {
        $count = $units($content_units, 6);
        $includeImage = in_array('image', $elements, true) || in_array('illustration', $elements, true);
        $includeVideo = in_array('video', $elements, true);
        
        $items = [];
        for ($i = 0; $i < $count; $i++) {
            $item = ['title' => '', 'description' => ''];
            if ($includeImage) $item['image_url'] = '';
            if ($includeVideo) $item['video_url'] = '';
            $items[] = $item;
        }
        $slots['items'] = $items;
    }
    
    // Contact / Forms
    if ($category === 'contact' || in_array('form', $elements, true)) {
        $slots['form'] = [
            'fields' => [
                ['name' => 'name', 'label' => 'Name', 'type' => 'text'],
                ['name' => 'email', 'label' => 'Email', 'type' => 'email'],
                ['name' => 'message', 'label' => 'Message', 'type' => 'textarea'],
            ],
            'submit_label' => 'Send',
            'success_message' => ''
        ];
    }
    
    // Nav
    if ($category === 'nav') {
        $count = $units($content_units, 4);
        $links = [];
        for ($i = 0; $i < $count; $i++) $links[] = ['label' => '', 'url' => ''];
        $slots['nav_links'] = $links;
    }
    
    // Footer
    if ($category === 'footer') {
        $count = $units($content_units, 6);
        $links = [];
        for ($i = 0; $i < $count; $i++) $links[] = ['label' => '', 'url' => ''];
        $slots['footer_links'] = $links;
        $slots['legal'] = ['company' => '', 'copyright' => ''];
        
        if (in_array('form', $elements, true)) {
            $slots['newsletter'] = ['label' => 'Subscribe', 'placeholder' => 'Your email', 'submit_label' => 'Join'];
        }
    }
    
    return [
        'section_id' => $id,
        'slots' => $slots
    ];
}

/**
 * Derives slots for multiple sections
 * 
 * @param array $metas Array of section metadata arrays
 * @return array Array of slot schemas
 */
function derive_slots_for_sections(array $metas): array {
    return array_map('derive_slots', $metas);
}

/**
 * Extracts minimal section metadata needed for LLM calls
 * Only includes fields that are relevant for content generation
 * 
 * @param array $meta Full section metadata array
 * @return array Minimal metadata array with only relevant fields
 */
function minimal_section_for_llm(array $meta): array {
    $keep = ['id','category','layout','elements','cta','content_units','has_quote','has_rating','has_avatars','style'];
    $out = [];
    
    foreach ($keep as $k) {
        if (array_key_exists($k, $meta)) {
            $out[$k] = $meta[$k];
        }
    }
    
    return $out;
}


