// Gallery Thumbnail Switcher (No Animation)
window.galleryThumbsInit = function(section) {
  if (!section) return;

  // Find all thumbnail containers in this section (in case there are multiple galleries)
  const thumbnailContainers = section.querySelectorAll('.gallery-thumbnail-container');
  
  thumbnailContainers.forEach(thumbnailContainer => {
    // Find the corresponding main image for this gallery
    // Look for the main image that's a sibling or in the same parent context
    const galleryWrapper = thumbnailContainer.closest('.flex-col, .space-y-6') || thumbnailContainer.parentElement;
    const mainImage = galleryWrapper?.querySelector('.gallery-main-image');
    
    if (!mainImage || !thumbnailContainer) return;

    // Handle thumbnail clicks
    thumbnailContainer.addEventListener('click', function(e) {
      const thumb = e.target.closest('.gallery-thumb');
      if (thumb) {
        // Instantly switch the main image (no transition)
        mainImage.src = thumb.src;
        mainImage.alt = thumb.alt;
      }
    });
  });
};
