/**
 * Process Accordion Section Script
 * Handles accordion functionality for the process steps section
 */

// Track initialized sections without needing a DOM attribute for static content
const initializedSections = new WeakSet();

// Core initialization function
function initProcessAccordion(section, isDynamic = false) {
  if (!section) return;
  
  // Skip if already initialized (either internally tracked or marked dynamically)
  if (initializedSections.has(section)) return;
  if (section.hasAttribute('data-process-accordion-initialized')) return;
  
  // Only mark with data attribute when section was appended dynamically
  if (isDynamic) {
    section.setAttribute('data-process-accordion-initialized', 'true');
  }
  
  const accordionItems = section.querySelectorAll('.process-accordion-item');
  
  if (!accordionItems.length) {
    console.error('Process accordion: No accordion items found in section', section.id);
    return;
  }
  
  console.log('Process accordion initialized for section:', section.id);
  
  // Record initialization to prevent duplicates for static sections
  initializedSections.add(section);
  
  // Toggle function for accordion items
  function toggleAccordionItem(clickedItem) {
    const content = clickedItem.querySelector('.process-accordion-content');
    const icon = clickedItem.querySelector('.process-accordion-icon');
    
    if (!content || !icon) return;
    
    const isCurrentlyOpen = content.style.maxHeight && content.style.maxHeight !== '0px';
    
    // Close all accordion items in this section
    accordionItems.forEach(item => {
      const itemContent = item.querySelector('.process-accordion-content');
      const itemIcon = item.querySelector('.process-accordion-icon');
      
      if (itemContent) {
        itemContent.style.maxHeight = '0';
      }
      if (itemIcon) {
        itemIcon.style.transform = 'rotate(0deg)';
      }
    });
    
    // Open clicked item if it was closed
    if (!isCurrentlyOpen) {
      content.style.maxHeight = content.scrollHeight + 'px';
      icon.style.transform = 'rotate(180deg)';
      
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
    }
  }
  
  // Add click event listeners to title wrapper only (not the content)
  accordionItems.forEach(item => {
    const content = item.querySelector('.process-accordion-content');
    const h3 = item.querySelector('h3');
    
    // Find the header wrapper: the flex container that contains the number, title, and icon
    // This is typically the direct child div with "flex items-start"
    // Note: This container does contain the content, but we'll exclude content clicks in the handler
    let headerWrapper = null;
    
    if (h3) {
      // Find the flex container that's a direct child of the item
      const flexContainer = item.querySelector('.flex.items-start');
      if (flexContainer) {
        headerWrapper = flexContainer;
      } else {
        // Fallback: use the item itself but exclude content clicks
        headerWrapper = item;
      }
    }
    
    // Function to handle toggle
    const handleToggle = (e) => {
      // Don't trigger if clicking on the content area or its children
      if (content && (content === e.target || content.contains(e.target))) {
        return;
      }
      toggleAccordionItem(item);
    };
    
    // Make header wrapper clickable if found, otherwise make h3 and icon clickable
    if (headerWrapper) {
      headerWrapper.style.cursor = 'pointer';
      headerWrapper.addEventListener('click', handleToggle);
    } else {
      // Fallback: make title and icon individually clickable
      if (h3) {
        h3.style.cursor = 'pointer';
        h3.addEventListener('click', handleToggle);
      }
      const icon = item.querySelector('.process-accordion-icon');
      if (icon) {
        icon.style.cursor = 'pointer';
        icon.addEventListener('click', handleToggle);
      }
    }
    
    // Don't prevent pointer events on content - allow TinyMCE to work
    // The click handler already prevents toggling when clicking on content (line 87-89)
    // So we can allow normal interaction for TinyMCE editing
  });

  // Auto-open first item
  const firstItem = accordionItems[0];
  if (firstItem) {
    const content = firstItem.querySelector('.process-accordion-content');
    const icon = firstItem.querySelector('.process-accordion-icon');
    
    if (content) {
      content.style.maxHeight = content.scrollHeight + 'px';
    }
    if (icon) {
      icon.style.transform = 'rotate(180deg)';
    }
  }
}

// Export for section initializer
window['processAccordionInit'] = function(section, options) {
  if (!section) return;
  const isDynamic = (options && typeof options.dynamic === 'boolean') ? options.dynamic : true;
  initProcessAccordion(section, isDynamic);
};

// Auto-initialize on page load for standalone usage
document.addEventListener('DOMContentLoaded', () => {
  const sections = document.querySelectorAll('[id^="fp-theme-process-accordion"]');
  sections.forEach(section => {
    // Static content on initial load should not get the data attribute
    initProcessAccordion(section, false);
  });
});
