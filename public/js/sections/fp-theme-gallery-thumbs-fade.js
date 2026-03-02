// Gallery Thumbnail Fade Switcher
window.galleryThumbsFadeInit = function(section) {
  if (!section) return;

  const mainImage = section.querySelector('#gallery-thumbs-fade-main-image');
  const thumbnailContainer = section.querySelector('#gallery-thumbs-fade-container');
  const thumbnails = section.querySelectorAll('.gallery-thumbs-fade-thumb');

  if (!mainImage || !thumbnailContainer) return;

  // Add active border styling
  const style = document.createElement('style');
  style.textContent = `
    .gallery-thumbs-fade-thumb {
      border: 3px solid transparent;
    }
    .gallery-thumbs-fade-thumb.active {
      border-color: var(--primary-accent);
      opacity: 1;
    }
    .gallery-thumbs-fade-thumb:not(.active) {
      opacity: 0.6;
    }
    .gallery-thumbs-fade-thumb:not(.active):hover {
      opacity: 0.8;
    }
  `;
  document.head.appendChild(style);

  // Handle thumbnail clicks
  thumbnailContainer.addEventListener('click', function(e) {
    const thumb = e.target.closest('.gallery-thumbs-fade-thumb');
    if (thumb) {
      const thumbImg = thumb.querySelector('img');
      
      // Fade out
      mainImage.style.opacity = '0';
      
      // Wait for fade out, then change image and fade in
      setTimeout(() => {
        mainImage.src = thumbImg.src;
        mainImage.alt = thumbImg.alt;
        mainImage.style.opacity = '1';
      }, 250);

      // Update active state
      thumbnails.forEach(t => t.classList.remove('active'));
      thumb.classList.add('active');
    }
  });
};
