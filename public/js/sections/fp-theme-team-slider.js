// Team Slider with Arrow Navigation (shows 2 items at a time)
window['teamSliderInit'] = function(section) {
  if (!section) return;

  // Guard: Clean up existing initialization if present
  if (section._teamSliderCleanup) {
    section._teamSliderCleanup();
  }

  const slider = section.querySelector('.team-slider-track');
  const nextButton = section.querySelector('.team-slider-next');
  const prevButton = section.querySelector('.team-slider-prev');
  
  if (!slider || !nextButton || !prevButton) return;
  
  let currentSlide = 0;
  const totalCards = slider.children.length;
  const cardsToShow = 2; // Show 2 cards at a time
  const maxSlides = Math.ceil(totalCards / cardsToShow);
  let slideInterval = null;
  let intersectionObserver = null;
  let nextButtonHandler = null;
  let prevButtonHandler = null;
  let resizeHandler = null;

  function goToSlide(index) {
    // Calculate the width of one card including gap
    const card = slider.children[0];
    if (!card) return;
    
    const cardWidth = card.clientWidth;
    const gap = 24; // 24px gap (gap-6 in Tailwind = 1.5rem = 24px)
    const moveDistance = (cardWidth + gap) * cardsToShow * index;
    
    slider.style.transform = `translateX(-${moveDistance}px)`;
  }

  function nextSlide() {
    currentSlide = (currentSlide + 1) % maxSlides;
    goToSlide(currentSlide);
  }

  function prevSlide() {
    currentSlide = (currentSlide - 1 + maxSlides) % maxSlides;
    goToSlide(currentSlide);
  }

  function startAutoSlide() {
    // Only start if not already running
    if (slideInterval) return;
    slideInterval = setInterval(nextSlide, 4000);
  }

  function stopAutoSlide() {
    if (slideInterval) {
      clearInterval(slideInterval);
      slideInterval = null;
    }
  }

  function resetAutoSlide() {
    stopAutoSlide();
    // Only restart if section is visible
    if (intersectionObserver && section.getAttribute('data-slider-visible') === 'true') {
      startAutoSlide();
    }
  }

  // Store event handlers for proper cleanup
  nextButtonHandler = () => {
    nextSlide();
    resetAutoSlide();
  };
  prevButtonHandler = () => {
    prevSlide();
    resetAutoSlide();
  };

  nextButton.addEventListener('click', nextButtonHandler);
  prevButton.addEventListener('click', prevButtonHandler);
  
  // Optimized resize handler (only updates if slider is in viewport)
  let resizePending = false;
  resizeHandler = () => {
    if (resizePending) return;
    resizePending = true;
    requestAnimationFrame(() => {
      resizePending = false;
      // Only update if section is visible
      if (section.getAttribute('data-slider-visible') === 'true') {
        goToSlide(currentSlide);
      }
    });
  };
  window.addEventListener('resize', resizeHandler, { passive: true });

  // Use IntersectionObserver to detect when slider is in viewport
  // Only run auto-slide timer when visible
  intersectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // Section is visible - start auto-slide
        section.setAttribute('data-slider-visible', 'true');
        startAutoSlide();
      } else {
        // Section is not visible - stop auto-slide
        section.setAttribute('data-slider-visible', 'false');
        stopAutoSlide();
      }
    });
  }, {
    root: null, // Use viewport as root
    rootMargin: '0px', // No margin - only when actually visible
    threshold: 0.1 // Trigger when at least 10% is visible
  });

  // Observe the section for visibility
  intersectionObserver.observe(section);

  // Initialize position
  goToSlide(currentSlide);

  // Cleanup function (can be called if section is removed or re-initialized)
  section._teamSliderCleanup = () => {
    stopAutoSlide();
    if (intersectionObserver) {
      intersectionObserver.disconnect();
      intersectionObserver = null;
    }
    if (nextButton && nextButtonHandler) {
      nextButton.removeEventListener('click', nextButtonHandler);
    }
    if (prevButton && prevButtonHandler) {
      prevButton.removeEventListener('click', prevButtonHandler);
    }
    if (resizeHandler) {
      window.removeEventListener('resize', resizeHandler);
    }
    section.removeAttribute('data-slider-visible');
    delete section._teamSliderCleanup;
  };
};

// Auto-initialize on DOM ready for sections present at page load
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', function() {
    var sections = document.querySelectorAll('#fp-theme-team-slider');
    sections.forEach(function(sec) { window['teamSliderInit'](sec); });
  });
}
