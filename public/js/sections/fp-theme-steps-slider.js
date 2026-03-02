// Steps Slider Section Script
window['stepsSliderInit'] = function(section) {
  if (!section) return;

  const track = section.querySelector('.steps-slider-track');
  const navButtons = section.querySelectorAll('.steps-slider-nav');
  
  if (!track || !navButtons.length) return;

  let currentSlide = 0;
  const totalSlides = 4;

  function goToSlide(index) {
    // Ensure index is within bounds
    if (index < 0) index = 0;
    if (index >= totalSlides) index = totalSlides - 1;
    
    currentSlide = index;
    
    // Update slider position - only the text content slides
    track.style.transform = `translateX(-${currentSlide * 100}%)`;
    
    // Update navigation button styles
    navButtons.forEach((btn, i) => {
      if (i === currentSlide) {
        // Active button
        btn.style.background = 'var(--primary-accent)';
        btn.style.color = 'white';
        btn.style.border = 'none';
        btn.style.transform = 'scale(1.1)';
      } else {
        // Inactive button
        btn.style.background = 'var(--card-bg)';
        btn.style.color = 'var(--primary-accent)';
        btn.style.border = '2px solid var(--border-color)';
        btn.style.transform = 'scale(1)';
      }
    });
  }

  // Navigation button click handlers
  navButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const slideIndex = parseInt(btn.dataset.slide);
      goToSlide(slideIndex);
    });
  });

  // Keyboard navigation
  section.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') {
      goToSlide(currentSlide - 1);
    } else if (e.key === 'ArrowRight') {
      goToSlide(currentSlide + 1);
    }
  });

  // Touch/swipe support - only on the text content area
  let touchStartX = 0;
  let touchEndX = 0;

  track.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
  });

  track.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
  });

  function handleSwipe() {
    if (touchEndX < touchStartX - 50) {
      // Swipe left - next slide
      goToSlide(currentSlide + 1);
    }
    if (touchEndX > touchStartX + 50) {
      // Swipe right - previous slide
      goToSlide(currentSlide - 1);
    }
  }

  // Initialize
  goToSlide(0);
};

// Auto-initialize on DOM ready for sections present at page load
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', function() {
    var sections = document.querySelectorAll('#fp-theme-steps-slider');
    sections.forEach(function(sec) { window['stepsSliderInit'](sec); });
  });
}
