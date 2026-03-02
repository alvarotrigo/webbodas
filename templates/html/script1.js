document.addEventListener('DOMContentLoaded', () => {
    // ─── NAV SCROLL ───
    const nav = document.getElementById('nav');
    window.addEventListener('scroll', () => {
        nav.classList.toggle('scrolled', window.scrollY > 80);
    });

    // ─── REVEAL ON SCROLL ───
    const revealEls = document.querySelectorAll('.reveal');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.15 });

    revealEls.forEach(el => observer.observe(el));

    // ─── RSVP FORM ───
    const rsvpForm = document.getElementById('rsvpForm');
    if (rsvpForm) {
        rsvpForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const toast = document.getElementById('toast');
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), 3500);
            e.target.reset();
        });
    }

    // ─── SMOOTH SCROLL ───
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const target = document.querySelector(targetId);
            if (target) {
                // Cerramos el menú móvil si está abierto
                nav.classList.remove('mobile-open');
                
                target.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'start' 
                });
            }
        });
    });
});

// Función global para el menú (llamada desde el HTML onclick)
function toggleMenu() {
    const nav = document.getElementById('nav');
    nav.classList.toggle('mobile-open');
}