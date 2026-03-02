// Gallery Slider with Arrow Navigation
window.gallerySliderArrowsInit = function(section) {
  if (!section) return;

  // Guard: Clean up existing initialization if present
  if (section._gallerySliderCleanup) {
    section._gallerySliderCleanup();
  }

  const slider = section.querySelector('.gallery-arrows-slider');
  const nextButton = section.querySelector('.gallery-arrows-next');
  const prevButton = section.querySelector('.gallery-arrows-prev');
  
  if (!slider || !nextButton || !prevButton || !slider.children.length) return;
  
  let currentSlide = 0;
  const totalSlides = slider.children.length;
  let slideInterval = null;
  let intersectionObserver = null;
  let nextButtonHandler = null;
  let prevButtonHandler = null;
  let resizeHandler = null;

  function goToSlide(index) {
    const slideWidth = slider.children[0].clientWidth;
    slider.style.transform = `translateX(-${index * slideWidth}px)`;
  }

  function nextSlide() {
    currentSlide = (currentSlide + 1) % totalSlides;
    goToSlide(currentSlide);
  }

  function prevSlide() {
    currentSlide = (currentSlide - 1 + totalSlides) % totalSlides;
    goToSlide(currentSlide);
  }

  function startAutoSlide() {
    // Only start if not already running
    if (slideInterval) return;
    slideInterval = setInterval(nextSlide, 3000);
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
  section._gallerySliderCleanup = () => {
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
    delete section._gallerySliderCleanup;
  };
};
