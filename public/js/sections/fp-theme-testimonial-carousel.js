// Testimonial Carousel
window.testimonialCarouselInit = function(section) {
  if (!section) return;

  // Build data from DOM items instead of hardcoding (supports multiple instances)
  const itemsContainer = section.querySelector('[data-testimonial-items]');
  const itemElements = itemsContainer ? Array.from(itemsContainer.querySelectorAll('.testimonial-item')) : [];

  const testimonialCarouselData = itemElements.map((el, idx) => {
    const image = el.querySelector('[data-image]')?.getAttribute('src') || '';
    const name = el.querySelector('[data-name]')?.textContent?.trim() || '';
    const title = el.querySelector('[data-title]')?.textContent?.trim() || '';
    const text = el.querySelector('[data-text]')?.textContent?.trim() || '';
    const ratingAttr = el.getAttribute('data-rating');
    const rating = ratingAttr ? parseInt(ratingAttr, 10) : 5;
    return { id: idx + 1, image, name, title, rating: isNaN(rating) ? 5 : rating, text };
  });

  // Fallback to current DOM if no items provided
  if (testimonialCarouselData.length === 0) {
    const imageElement = section.querySelector('#testimonial-carousel-image');
    const nameElement = section.querySelector('#testimonial-carousel-name');
    const titleElement = section.querySelector('#testimonial-carousel-title');
    const textElement = section.querySelector('#testimonial-carousel-text');
    testimonialCarouselData.push({
      id: 1,
      image: imageElement ? imageElement.src : '',
      name: nameElement ? nameElement.textContent || '' : '',
      title: titleElement ? titleElement.textContent || '' : '',
      rating: 5,
      text: textElement ? textElement.textContent || '' : ''
    });
  }

  let currentCarouselIndex = 0;

  function updateTestimonialCarousel(index) {
    currentCarouselIndex = index;
    const testimonial = testimonialCarouselData[index];
    
    // Get elements within this section
    const imageElement = section.querySelector('#testimonial-carousel-image');
    const nameElement = section.querySelector('#testimonial-carousel-name');
    const titleElement = section.querySelector('#testimonial-carousel-title');
    const textElement = section.querySelector('#testimonial-carousel-text');
    const ratingElement = section.querySelector('#testimonial-carousel-rating');
    const counterElement = section.querySelector('#testimonial-carousel-counter');
    const cardElement = section.querySelector('#testimonial-carousel-card');
    
    // Fade out only image and card
    if (imageElement) {
      imageElement.style.opacity = '0';
    }
    if (cardElement) {
      cardElement.style.opacity = '0';
    }
    
    setTimeout(() => {
      // Update content
      if (imageElement) imageElement.src = testimonial.image;
      if (nameElement) nameElement.textContent = testimonial.name;
      if (titleElement) titleElement.textContent = testimonial.title;
      if (textElement) textElement.textContent = testimonial.text;
      if (counterElement) counterElement.textContent = `${index + 1} of ${testimonialCarouselData.length}`;
      
      // Update rating stars
      if (ratingElement) {
        ratingElement.innerHTML = '';
        for (let i = 0; i < testimonial.rating; i++) {
          const star = document.createElement('i');
          star.setAttribute('data-lucide', 'star');
          star.className = 'w-6 h-6 fill-yellow-400 text-yellow-400';
          ratingElement.appendChild(star);
        }
        if (typeof lucide !== 'undefined') {
          lucide.createIcons();
        }
      }
      
      // Fade in
      if (imageElement) {
        imageElement.style.opacity = '1';
      }
      if (cardElement) {
        cardElement.style.opacity = '1';
      }
    }, 300);
  }

  // Build stacked image slides to avoid image swap glitches
  const imageWrapper = section.querySelector('[data-testimonial-image-wrapper]');
  const baseImage = section.querySelector('#testimonial-carousel-image');
  const slides = [];
  if (imageWrapper && testimonialCarouselData.length > 0) {
    // Ensure wrapper is relative
    if (!imageWrapper.style.position) {
      imageWrapper.style.position = 'relative';
    }
    // Create slides
    testimonialCarouselData.forEach((t, i) => {
      const img = document.createElement('img');
      img.src = t.image;
      img.alt = t.name || 'Testimonial';
      img.className = 'w-full h-full object-cover';
      img.style.position = 'absolute';
      img.style.inset = '0';
      img.style.opacity = i === 0 ? '1' : '0';
      img.style.transition = 'opacity 0.35s ease-in-out';
      imageWrapper.appendChild(img);
      slides.push(img);
    });
    // Hide base image to prevent flashes
    if (baseImage) {
      baseImage.style.opacity = '0';
      baseImage.style.transition = 'none';
    }
  }

  // Expose navigation functions globally for HTML onclick handlers
  window.nextTestimonialCarousel = function() {
    const nextIndex = (currentCarouselIndex + 1) % testimonialCarouselData.length;
    updateTestimonialCarousel(nextIndex);
  };

  window.prevTestimonialCarousel = function() {
    const prevIndex = (currentCarouselIndex - 1 + testimonialCarouselData.length) % testimonialCarouselData.length;
    updateTestimonialCarousel(prevIndex);
  };

  // Set up transitions
  const imageElement = section.querySelector('#testimonial-carousel-image');
  const cardElement = section.querySelector('#testimonial-carousel-card');
  
  if (imageElement) {
    imageElement.style.transition = 'opacity 0.3s ease-in-out';
  }
  if (cardElement) {
    cardElement.style.transition = 'opacity 0.3s ease-in-out';
  }
  
  updateTestimonialCarousel(0);

  // Override image swap with slide fade logic
  function applyImageSlide(nextIndex) {
    if (!slides.length) return;
    slides.forEach((img, i) => {
      img.style.opacity = i === nextIndex ? '1' : '0';
    });
  }

  // Wrap original updater to apply slide change after content updates
  const originalUpdate = updateTestimonialCarousel;
  updateTestimonialCarousel = function(index) {
    // call original
    currentCarouselIndex = index;
    const testimonial = testimonialCarouselData[index];
    const nameElement = section.querySelector('#testimonial-carousel-name');
    const titleElement = section.querySelector('#testimonial-carousel-title');
    const textElement = section.querySelector('#testimonial-carousel-text');
    const ratingElement = section.querySelector('#testimonial-carousel-rating');
    const counterElement = section.querySelector('#testimonial-carousel-counter');
    const cardElementLocal = section.querySelector('#testimonial-carousel-card');

    if (imageElement) imageElement.style.opacity = '0';
    if (cardElementLocal) cardElementLocal.style.opacity = '0';

    setTimeout(() => {
      if (nameElement) nameElement.textContent = testimonial.name;
      if (titleElement) titleElement.textContent = testimonial.title;
      if (textElement) textElement.textContent = testimonial.text;
      if (counterElement) counterElement.textContent = `${index + 1} of ${testimonialCarouselData.length}`;
      if (ratingElement) {
        ratingElement.innerHTML = '';
        for (let i = 0; i < testimonial.rating; i++) {
          const star = document.createElement('i');
          star.setAttribute('data-lucide', 'star');
          star.className = 'w-6 h-6 fill-yellow-400 text-yellow-400';
          ratingElement.appendChild(star);
        }
        if (typeof lucide !== 'undefined') {
          lucide.createIcons();
        }
      }

      applyImageSlide(index);

      if (imageElement) imageElement.style.opacity = '1';
      if (cardElementLocal) cardElementLocal.style.opacity = '1';
    }, 300);
  };
};

// Auto-initialize on page load if the section exists
document.addEventListener('DOMContentLoaded', function() {
  var sections = document.querySelectorAll('[data-testimonial-carousel]');
  if (sections && typeof window.testimonialCarouselInit === 'function') {
    sections.forEach(function(sec) {
      window.testimonialCarouselInit(sec);
    });
  }
});
