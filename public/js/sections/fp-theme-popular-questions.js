// Popular Questions FAQ Section with Categories

// Core initialization function
function initPopularQuestions(section, isDynamic = false) {
  if (!section) return;
  
  // Skip if already initialized
  if (section.hasAttribute('data-popular-questions-initialized')) return;
  if (isDynamic) {
    section.setAttribute('data-popular-questions-initialized', 'true');
  }

  const categoryButtons = section.querySelectorAll('[data-faq-category]');
  const faqSections = section.querySelectorAll('[data-faq-section]');
  
  if (!categoryButtons.length || !faqSections.length) {
    return;
  }

  // Remove accordion-initialized flag to allow re-initialization
  section.removeAttribute('data-accordion-initialized');

  // Function to show/hide FAQ sections based on selected category
  function showFAQSection(category) {
    // Save and blur all TinyMCE editors before switching sections
    if (typeof window.tinymce !== 'undefined') {
      try {
        // Iterate through all editor instances
        if (window.tinymce.editors) {
          window.tinymce.editors.forEach(editor => {
            if (editor && !editor.isHidden()) {
              try {
                editor.save(); // Save content back to textarea
                editor.selection.collapse();
                if (editor.getBody()) {
                  editor.getBody().blur();
                }
              } catch (e) {
                // Ignore individual editor errors
              }
            }
          });
        }
        
        // Also handle active editor specifically
        if (window.tinymce.activeEditor) {
          try {
            window.tinymce.activeEditor.selection.collapse();
          } catch (e) {
            // Ignore
          }
        }
      } catch (e) {
        // Ignore TinyMCE errors
      }
    }
    
    // Small delay to ensure TinyMCE cleanup completes
    setTimeout(() => {
      faqSections.forEach(faqSection => {
        const sectionCategory = faqSection.getAttribute('data-faq-section');
        if (sectionCategory === category) {
          faqSection.style.display = 'block';
        } else {
          faqSection.style.display = 'none';
        }
      });
    }, 10);
  }

  // Function to switch active category
  function switchCategory(button) {
    // Remove active class from all buttons and reset their styles
    categoryButtons.forEach(btn => {
      btn.classList.remove('active-category');
      btn.style.background = 'var(--secondary-bg)';
      btn.style.boxShadow = 'var(--shadow-sm)';
      btn.style.border = '1px solid var(--border-color)';
      
      // Reset text colors
      const heading = btn.querySelector('h3');
      const paragraph = btn.querySelector('p');
      const icon = btn.querySelector('i');
      if (heading) heading.style.color = 'var(--primary-text)';
      if (paragraph) paragraph.style.color = 'var(--secondary-text)';
      if (icon) icon.style.color = 'var(--secondary-text)';
    });
    
    // Add active class to clicked button
    button.classList.add('active-category');
    button.style.background = 'var(--primary-accent)';
    button.style.boxShadow = 'var(--shadow-md)';
    button.style.border = 'none';
    
    // Set active text colors
    const heading = button.querySelector('h3');
    const paragraph = button.querySelector('p');
    const icon = button.querySelector('i');
    if (heading) heading.style.color = 'white';
    if (paragraph) paragraph.style.color = 'rgba(255, 255, 255, 0.9)';
    if (icon) icon.style.color = 'white';
    
    // Show/hide FAQ sections
    const category = button.dataset.faqCategory;
    showFAQSection(category);
  }

  // Initialize accordion functionality FIRST before any interactions
  if (typeof window.accordionInit === 'function') {
    // Initialize accordion on the main section
    window.accordionInit(section, { dynamic: true });
  }

  // Add click event listeners to category buttons
  categoryButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      // Prevent default and stop propagation to avoid editor conflicts
      e.preventDefault();
      e.stopPropagation();
      
      // Remove focus from any active element
      if (document.activeElement && document.activeElement !== document.body) {
        document.activeElement.blur();
      }
      
      switchCategory(button);
    });
  });

  // Initialize with first category (general) - show the general section by default
  const firstButton = section.querySelector('[data-faq-category="general"]');
  if (firstButton) {
    switchCategory(firstButton);
  }
}

// Export for section initializer
/** @type {any} */ (window).popularQuestionsInit = function(section) {
  if (!section) return;
  initPopularQuestions(section, true);
};

// Auto-initialize on page load for standalone usage
document.addEventListener('DOMContentLoaded', () => {
  const section = document.getElementById('fp-theme-popular-questions');
  if (section) {
    initPopularQuestions(section, false);
  }
});
