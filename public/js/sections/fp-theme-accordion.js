/**
 * Generic Accordion Section Script
 * Handles accordion functionality for any accordion-based section
 * Supports multiple icon types and animation styles
 */

// Track initialized sections without needing a DOM attribute for static content
const initializedAccordions = new WeakSet();

// Core initialization function
function initAccordion(section, isDynamic = false) {
  if (!section) return;
  
  // Skip if already initialized
  if (initializedAccordions.has(section)) return;
  if (section.hasAttribute('data-accordion-initialized')) return;
  
  // Mark with data attribute when section was appended dynamically
  if (isDynamic) {
    section.setAttribute('data-accordion-initialized', 'true');
  }
  
  const accordionItems = section.querySelectorAll('[data-acc-item]');
  
  if (!accordionItems.length) {
    console.error('Accordion: No accordion items found in section', section.id);
    return;
  }
  
  console.log('Accordion initialized for section:', section.id);
  
  // Record initialization to prevent duplicates for static sections
  initializedAccordions.add(section);
  
  // Toggle function for accordion items
  function toggleAccordionItem(clickedItem) {
    const content = clickedItem.querySelector('[data-acc-content]');
    const icon = clickedItem.querySelector('[data-acc-icon]');
    
    if (!content) return;
    
    const isCurrentlyOpen = content.style.maxHeight && content.style.maxHeight !== '0px';
    
    // Close all accordion items in this section
    accordionItems.forEach(item => {
      const itemContent = item.querySelector('[data-acc-content]');
      const itemIcon = item.querySelector('[data-acc-icon]');
      
      if (itemContent) {
        itemContent.style.maxHeight = '0';
        // Don't use 'hidden' class - it prevents TinyMCE from initializing
        // max-height: 0 is sufficient for the animation
      }
      
      // Handle different icon types
      if (itemIcon) {
        const iconType = itemIcon.getAttribute('data-acc-icon');
        
        if (iconType === 'rotate' || iconType === 'rotate-90') {
          // Chevron rotation (0deg = closed)
          itemIcon.style.transform = 'rotate(0deg)';
        } else if (iconType === 'plus-minus') {
          // Plus/minus toggle
          const plusIcon = itemIcon.querySelector('[data-icon-plus]');
          const minusIcon = itemIcon.querySelector('[data-icon-minus]');
          if (plusIcon) plusIcon.classList.remove('hidden');
          if (minusIcon) minusIcon.classList.add('hidden');
        }
      }
    });
    
    // Open clicked item if it was closed
    if (!isCurrentlyOpen) {
      // Ensure content is visible (remove hidden class if it exists)
      content.classList.remove('hidden');
      // Small delay to ensure display change takes effect before animation
      setTimeout(() => {
        content.style.maxHeight = content.scrollHeight + 'px';
        
        // Reinitialize TinyMCE for newly opened content to ensure it's editable
        const tinyMCEEditor = window['tinyMCEEditor'];
        if (tinyMCEEditor && tinyMCEEditor.initForSection) {
          const section = content.closest('section');
          if (section) {
            // Use a small delay to ensure the content is fully visible
            setTimeout(() => {
              tinyMCEEditor.initForSection(section);
            }, 50);
          }
        }
      }, 10);
      
      // Handle icon animation
      if (icon) {
        const iconType = icon.getAttribute('data-acc-icon');
        
        if (iconType === 'rotate') {
          icon.style.transform = 'rotate(180deg)';
        } else if (iconType === 'rotate-90') {
          icon.style.transform = 'rotate(90deg)';
        } else if (iconType === 'plus-minus') {
          const plusIcon = icon.querySelector('[data-icon-plus]');
          const minusIcon = icon.querySelector('[data-icon-minus]');
          if (plusIcon) plusIcon.classList.add('hidden');
          if (minusIcon) minusIcon.classList.remove('hidden');
        }
      }
      
      // Reinitialize lucide icons if available
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
    }
  }
  
  // Add click event listeners to title/header wrappers only (not the content)
  accordionItems.forEach(item => {
    const content = item.querySelector('[data-acc-content]');
    const titleElement = item.querySelector('h3');
    const iconElement = item.querySelector('[data-acc-icon]');
    
    // Find the header wrapper: the element that contains title and icon but not content
    // This is typically a div that's a direct child of [data-acc-item]
    let headerWrapper = null;
    
    if (titleElement && iconElement) {
      // Find common parent that contains both title and icon but not content
      let current = titleElement.parentElement;
      while (current && current !== item) {
        const containsIcon = current.contains(iconElement);
        const containsContent = content && current.contains(content);
        
        // If this element contains icon but not content, it's our header wrapper
        if (containsIcon && !containsContent) {
          headerWrapper = current;
          break;
        }
        // If we've reached the item level, stop
        if (current === item) break;
        current = current.parentElement;
      }
    }
    
    // Function to handle toggle
    const handleToggle = (e) => {
      // Don't trigger if clicking on the content area or its children
      if (content && (content === e.target || content.contains(e.target))) {
        return;
      }
      // Prevent event bubbling issues
      e.stopPropagation();
      toggleAccordionItem(item);
    };
    
    // Use header wrapper if found, otherwise make title and icon individually clickable
    if (headerWrapper) {
      headerWrapper.style.cursor = 'pointer';
      headerWrapper.addEventListener('click', handleToggle);
    } else {
      // Fallback: make title and icon clickable individually
      if (titleElement) {
        titleElement.style.cursor = 'pointer';
        titleElement.addEventListener('click', handleToggle);
      }
      if (iconElement) {
        iconElement.style.cursor = 'pointer';
        iconElement.addEventListener('click', handleToggle);
      }
    }
    
    // Don't prevent pointer events on content - allow TinyMCE to work
    // The click handler already prevents toggling when clicking on content (line 133-135)
    // So we can allow normal interaction for TinyMCE editing
  });

  // Auto-open first item (optional, can be controlled via data attribute)
  const autoOpen = section.getAttribute('data-acc-auto-open');
  if (autoOpen !== 'false') {
    const firstItem = accordionItems[0];
    if (firstItem) {
      const content = firstItem.querySelector('[data-acc-content]');
      const icon = firstItem.querySelector('[data-acc-icon]');
      
      if (content) {
        // Ensure content is visible (remove hidden class if it exists)
        content.classList.remove('hidden');
        setTimeout(() => {
          content.style.maxHeight = content.scrollHeight + 'px';
        }, 10);
      }
      
      if (icon) {
        const iconType = icon.getAttribute('data-acc-icon');
        
        if (iconType === 'rotate') {
          icon.style.transform = 'rotate(180deg)';
        } else if (iconType === 'rotate-90') {
          icon.style.transform = 'rotate(90deg)';
        } else if (iconType === 'plus-minus') {
          const plusIcon = icon.querySelector('[data-icon-plus]');
          const minusIcon = icon.querySelector('[data-icon-minus]');
          if (plusIcon) plusIcon.classList.add('hidden');
          if (minusIcon) minusIcon.classList.remove('hidden');
        }
      }
    }
  }
}

// Export for section initializer
window['accordionInit'] = function(section, options) {
  if (!section) return;
  // Support both boolean and object formats for backward compatibility
  let isDynamic = true;
  if (typeof options === 'boolean') {
    isDynamic = options;
  } else if (options && typeof options.dynamic === 'boolean') {
    isDynamic = options.dynamic;
  }
  initAccordion(section, isDynamic);
};

// Auto-initialize on page load for standalone usage
document.addEventListener('DOMContentLoaded', () => {
  const sections = document.querySelectorAll('[data-acc]');
  sections.forEach(section => {
    // Static content on initial load should not get the data attribute
    initAccordion(section, false);
  });
});

