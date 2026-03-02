// Interactive Testimonials Section
window.testimonialsInteractiveInit = function(section) {
  if (!section) return;

  // Build data from DOM
  const itemsContainer = section.querySelector('[data-testimonials-items]');
  const itemEls = itemsContainer ? Array.from(itemsContainer.querySelectorAll('.ti-item')) : [];
  const testimonials = itemEls.map((el, idx) => {
    const name = el.querySelector('[data-name]')?.textContent?.trim() || '';
    const location = el.querySelector('[data-location]')?.textContent?.trim() || '';
    const avatar = el.querySelector('[data-avatar]')?.getAttribute('src') || '';
    const title = el.querySelector('[data-title]')?.textContent?.trim() || '';
    const text = el.querySelector('[data-text]')?.textContent?.trim() || '';
    const ratingAttr = el.getAttribute('data-rating');
    const rating = ratingAttr ? parseInt(ratingAttr, 10) : 5;
    return { id: idx + 1, name, location, avatar, title, text, rating: isNaN(rating) ? 5 : rating };
  });

  // UI elements
  const titleElement = section.querySelector('[data-ti-title]');
  const textElement = section.querySelector('[data-ti-text]');
  const ratingElement = section.querySelector('[data-ti-rating]');
  const authorCards = Array.from(section.querySelectorAll('[data-ti-author]'));
  const prevBtn = section.querySelector('[data-ti-prev]');
  const nextBtn = section.querySelector('[data-ti-next]');

  let currentTestimonialIndex = 0;

  function render(index) {
    currentTestimonialIndex = index;
    const t = testimonials[index] || {};
    if (titleElement) titleElement.textContent = t.title || '';
    if (textElement) textElement.textContent = t.text || '';
    
    // Ensure dynamically updated elements stay editable by TinyMCE
    if (window.tinyMCEEditor && typeof window.tinyMCEEditor.initForSection === 'function') {
      window.tinyMCEEditor.initForSection(section);
    }
    if (ratingElement) {
      const stars = Math.max(0, Math.min(5, t.rating || 0));
      ratingElement.setAttribute('data-rating', String(stars));
    }
    authorCards.forEach((card) => {
      const idxAttr = card.getAttribute('data-index');
      const cardIdx = idxAttr ? parseInt(idxAttr, 10) : -1;
      if (cardIdx === index) card.classList.add('active'); else card.classList.remove('active');
    });
  }

  // Wire events per instance
  authorCards.forEach((card) => {
    card.addEventListener('click', function() {
      const idxAttr = card.getAttribute('data-index');
      const idx = idxAttr ? parseInt(idxAttr, 10) : 0;
      const clamped = ((idx % testimonials.length) + testimonials.length) % testimonials.length;
      render(clamped);
    });
  });
  if (prevBtn) prevBtn.addEventListener('click', function() {
    if (!testimonials.length) return;
    const prevIndex = (currentTestimonialIndex - 1 + testimonials.length) % testimonials.length;
    render(prevIndex);
  });
  if (nextBtn) nextBtn.addEventListener('click', function() {
    if (!testimonials.length) return;
    const nextIndex = (currentTestimonialIndex + 1) % testimonials.length;
    render(nextIndex);
  });

  // Initialize
  render(0);
};

// Auto-init all instances
document.addEventListener('DOMContentLoaded', function() {
  var sections = document.querySelectorAll('[data-testimonials-interactive]');
  if (!sections) return;
  sections.forEach(function(sec) { window.testimonialsInteractiveInit(sec); });
});
