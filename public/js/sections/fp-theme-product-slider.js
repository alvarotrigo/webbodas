// Product Slider
window['productSliderInit'] = function(section) {
  if (!section) return;

  const slider = section.querySelector('[data-product-slider]');

  if (!slider) return;

  // Local scroll function scoped to this section/slider instance
  const scrollProducts = function(direction) {
    const scrollAmount = 404; // Width of one card (372px) plus gap (32px)

    slider.scrollBy({
      left: direction * scrollAmount,
      behavior: 'smooth'
    });
  };

  // Wire up prev/next buttons if present in this section
  const prevBtn = section.querySelector('[data-slider-prev]');
  const nextBtn = section.querySelector('[data-slider-next]');
  if (prevBtn) prevBtn.addEventListener('click', () => scrollProducts(-1));
  if (nextBtn) nextBtn.addEventListener('click', () => scrollProducts(1));

  // Add horizontal scroll with mouse wheel
  const wheelHandler = (e) => {
    // Check if horizontal scroll is intended (shift key or horizontal trackpad gesture)
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey) {
      e.preventDefault();
      slider.scrollBy({
        left: e.deltaX || e.deltaY,
        behavior: 'smooth'
      });
    }
  };

  slider.addEventListener('wheel', wheelHandler, { passive: false });
};

// Auto-initialize on DOM ready for sections present at page load
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', function() {
    var sections = document.querySelectorAll('#fp-theme-product-slider');
    sections.forEach(function(sec) { window['productSliderInit'](sec); });
  });
}
