// Team Carousel - Slides one item at a time, shows 4 on desktop, 3 on tablet, 2 on mobile
window['teamCarouselInit'] = function(section) {
  if (!section) return;

  const track = section.querySelector('.team-carousel-track');
  const nextButton = section.querySelector('.team-carousel-next');
  const prevButton = section.querySelector('.team-carousel-prev');
  
  if (!track || !nextButton || !prevButton) return;
  
  let currentIndex = 0;
  const cards = track.children;
  const totalCards = cards.length;

  // Get number of visible cards based on screen width
  function getVisibleCards() {
    const width = window.innerWidth;
    if (width >= 1024) return 4; // Desktop
    if (width >= 768) return 3;  // Tablet
    if (width >= 640) return 2;  // Small tablet
    return 1; // Mobile
  }

  function updateCardWidths() {
    const visibleCards = getVisibleCards();
    const gap = 24; // 24px gap (gap-6 in Tailwind)
    const containerWidth = track.parentElement.clientWidth;
    const cardWidth = (containerWidth - (gap * (visibleCards - 1))) / visibleCards;
    
    Array.from(cards).forEach(card => {
      card.style.width = `${cardWidth}px`;
    });
  }

  function goToSlide(index) {
    if (!cards[0]) return;
    
    const cardWidth = cards[0].clientWidth;
    const gap = 24; // 24px gap
    const moveDistance = (cardWidth + gap) * index;
    
    track.style.transform = `translateX(-${moveDistance}px)`;
  }

  function nextSlide() {
    const visibleCards = getVisibleCards();
    const maxIndex = totalCards - visibleCards;
    
    if (currentIndex < maxIndex) {
      currentIndex++;
    } else {
      currentIndex = 0; // Loop back to start
    }
    
    goToSlide(currentIndex);
  }

  function prevSlide() {
    const visibleCards = getVisibleCards();
    const maxIndex = totalCards - visibleCards;
    
    if (currentIndex > 0) {
      currentIndex--;
    } else {
      currentIndex = maxIndex; // Loop to end
    }
    
    goToSlide(currentIndex);
  }

  // Event listeners
  nextButton.addEventListener('click', nextSlide);
  prevButton.addEventListener('click', prevSlide);
  
  // Recalculate on window resize
  let resizeTimer;
  const resizeHandler = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      updateCardWidths();
      // Reset to first slide if current position is invalid
      const visibleCards = getVisibleCards();
      const maxIndex = totalCards - visibleCards;
      if (currentIndex > maxIndex) {
        currentIndex = maxIndex;
      }
      goToSlide(currentIndex);
    }, 250);
  };
  window.addEventListener('resize', resizeHandler);

  // Initialize
  updateCardWidths();
  goToSlide(currentIndex);
};

// Auto-initialize on DOM ready for sections present at page load
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', function() {
    var sections = document.querySelectorAll('#fp-theme-team-carousel');
    sections.forEach(function(sec) { window['teamCarouselInit'](sec); });
  });
}
