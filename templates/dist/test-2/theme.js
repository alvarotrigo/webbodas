
    // Mobile menu toggle
    function toggleMobileMenu() {
      const menu = document.getElementById('mobileMenu');
      menu.classList.toggle('active');
    }

    // Services Slider
    let currentSlide = 0;
    const totalSlides = 5;

    function setActiveService(index) {
      currentSlide = index;
      const slides = document.querySelectorAll('.service-slide');
      slides.forEach((slide, i) => {
        if (i === index) {
          slide.classList.add('active');
        } else {
          slide.classList.remove('active');
        }
      });
    }

    function slideServices(direction) {
      currentSlide = (currentSlide + direction + totalSlides) % totalSlides;
      setActiveService(currentSlide);
      
      // Scroll the slider to show the active slide
      const slider = document.getElementById('servicesSlider');
      const slides = document.querySelectorAll('.service-slide');
      const activeSlide = slides[currentSlide];
      
      if (activeSlide && slider) {
        const containerWidth = document.getElementById('servicesSliderContainer').offsetWidth;
        const slideLeft = activeSlide.offsetLeft;
        const slideWidth = activeSlide.offsetWidth;
        const scrollPos = slideLeft - (containerWidth / 2) + (slideWidth / 2);
        
        slider.parentElement.scrollTo({
          left: Math.max(0, scrollPos),
          behavior: 'smooth'
        });
      }
    }

    // FAQ toggle
    function toggleFaq(button) {
      const item = button.parentElement;
      const wasActive = item.classList.contains('active');
      const content = item.querySelector('.faq-content');
      const icon = item.querySelector('.faq-icon');
      const iconSvg = icon.querySelector('svg');
      
      // Close all items
      document.querySelectorAll('.faq-item').forEach(faqItem => {
        faqItem.classList.remove('active');
        const faqContent = faqItem.querySelector('.faq-content');
        const faqIcon = faqItem.querySelector('.faq-icon');
        const faqIconSvg = faqIcon.querySelector('svg');
        faqContent.style.maxHeight = '0';
        faqIcon.classList.remove('rotate-90');
        faqIconSvg.setAttribute('stroke', 'var(--secondary-text)');
      });
      
      // Open clicked item if it wasn't active
      if (!wasActive) {
        item.classList.add('active');
        content.style.maxHeight = content.scrollHeight + 'px';
        icon.classList.add('rotate-90');
        iconSvg.setAttribute('stroke', 'var(--primary-accent)');
      }
    }

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });

    // Navbar background on scroll
    window.addEventListener('scroll', () => {
      const nav = document.querySelector('nav');
      if (window.scrollY > 50) {
        nav.style.background = 'rgba(10, 10, 10, 0.98)';
      } else {
        nav.style.background = 'rgba(10, 10, 10, 0.9)';
      }
    });

    // Initialize services slider scroll behavior
    document.addEventListener('DOMContentLoaded', () => {
      const container = document.getElementById('servicesSliderContainer');
      if (container) {
        container.style.overflowX = 'auto';
        container.style.scrollbarWidth = 'none';
        container.style.msOverflowStyle = 'none';
      }
    });
  