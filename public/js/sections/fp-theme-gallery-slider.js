// Gallery Slider with Thumbnail Navigation
window.gallerySliderInit = function(section) {
  if (!section) return;

  const container = section.querySelector('.gallery-slider-container');
  const thumbs = section.querySelectorAll('.gallery-slider-thumb');
  const prevBtn = section.querySelector('.gallery-slider-prev');
  const nextBtn = section.querySelector('.gallery-slider-next');
  
  if (!container || !thumbs.length || !prevBtn || !nextBtn) return;
  
  let currentSlide = 0;
  const totalSlides = thumbs.length;

  function updateSlider(index) {
    // Ensure index is within bounds
    if (index < 0) index = totalSlides - 1;
    if (index >= totalSlides) index = 0;
    
    currentSlide = index;
    
    // Update slider position
    container.style.transform = `translateX(-${currentSlide * 100}%)`;
    
    // Update thumbnail active states
    thumbs.forEach((thumb, i) => {
      if (i === currentSlide) {
        thumb.classList.add('active');
        thumb.classList.remove('opacity-50', 'hover:opacity-75');
      } else {
        thumb.classList.remove('active');
        thumb.classList.add('opacity-50', 'hover:opacity-75');
      }
    });
  }

  // Thumbnail click handlers
  thumbs.forEach((thumb, index) => {
    thumb.addEventListener('click', () => {
      updateSlider(index);
    });
  });

  // Previous button
  prevBtn.addEventListener('click', () => {
    updateSlider(currentSlide - 1);
  });

  // Next button
  nextBtn.addEventListener('click', () => {
    updateSlider(currentSlide + 1);
  });

  // Keyboard navigation
  section.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') {
      updateSlider(currentSlide - 1);
    } else if (e.key === 'ArrowRight') {
      updateSlider(currentSlide + 1);
    }
  });

  // Initialize
  updateSlider(0);
};
