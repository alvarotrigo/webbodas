// Animated Gallery Scroll

// Add CSS animations dynamically (only once)
if (!document.getElementById('gallery-scroll-styles')) {
  const style = document.createElement('style');
  style.id = 'gallery-scroll-styles';
  style.textContent = `
    .gallery-row {
      display: flex;
      gap: 2rem;
      white-space: nowrap;
    }
    
    .gallery-track {
      display: flex;
      gap: 2rem;
    }
    
    .gallery-item {
      flex-shrink: 0;
      width: 350px;
    }
    
    @keyframes scrollLeft {
      0% {
        transform: translateX(0);
      }
      100% {
        transform: translateX(-100%);
      }
    }
    
    @keyframes scrollRight {
      0% {
        transform: translateX(-100%);
      }
      100% {
        transform: translateX(0);
      }
    }
    
    .gallery-row:hover .gallery-track {
      animation-play-state: paused !important;
    }
  `;
  document.head.appendChild(style);
}

// Core initialization function
function initGalleryScroll(container, isDynamic = false) {
  const galleryRows = container.querySelectorAll('.gallery-row');
  
  galleryRows.forEach(row => {
    const direction = row.getAttribute('data-direction');
    const track = row.querySelector('.gallery-track');
    
    if (!track) return;
    
    // Skip if already initialized
    if (track.hasAttribute('data-gallery-initialized')) return;
    if (isDynamic) {
      track.setAttribute('data-gallery-initialized', 'true');
    }
    
    // Clone the track content for seamless loop
    const clone = track.cloneNode(true);
    row.appendChild(clone);
    
    // Set animation direction and speed
    const animationDuration = 40; // seconds
    const animationName = direction === 'left' ? 'scrollLeft' : 'scrollRight';
    
    // Apply animation
    track.style.animation = `${animationName} ${animationDuration}s linear infinite`;
    clone.style.animation = `${animationName} ${animationDuration}s linear infinite`;
  });
}

// Export for section initializer
/** @type {any} */ (window).galleryScrollInit = function(section) {
  if (!section) return;
  initGalleryScroll(section, true);
};

// Auto-initialize on page load for standalone usage
document.addEventListener('DOMContentLoaded', () => {
  initGalleryScroll(document, false);
});
