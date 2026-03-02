
        // Generate starfield
        function createStars() {
            const starsContainer = document.getElementById('stars');
            const numberOfStars = 100;
            
            for (let i = 0; i < numberOfStars; i++) {
                const star = document.createElement('div');
                star.className = 'star';
                star.style.left = Math.random() * 100 + '%';
                star.style.top = Math.random() * 100 + '%';
                star.style.animationDelay = Math.random() * 3 + 's';
                starsContainer.appendChild(star);
            }
        }
        
        createStars();
        
        // Smooth scroll for anchor links
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });
        
        // Burger menu toggle
        const burgerBtn = document.getElementById('burgerBtn');
        const mobileMenu = document.getElementById('mobileMenu');
        
        if (burgerBtn && mobileMenu) {
            burgerBtn.addEventListener('click', function() {
                burgerBtn.classList.toggle('active');
                mobileMenu.classList.toggle('active');
            });
            
            // Close menu when clicking on a link
            mobileMenu.querySelectorAll('a').forEach(link => {
                link.addEventListener('click', function() {
                    burgerBtn.classList.remove('active');
                    mobileMenu.classList.remove('active');
                });
            });
            
            // Close menu when clicking outside
            document.addEventListener('click', function(event) {
                const isClickInside = burgerBtn.contains(event.target) || mobileMenu.contains(event.target);
                if (!isClickInside && mobileMenu.classList.contains('active')) {
                    burgerBtn.classList.remove('active');
                    mobileMenu.classList.remove('active');
                }
            });
        }
        
        // Add hover effects to links
        document.querySelectorAll('nav a, footer a').forEach(link => {
            link.addEventListener('mouseenter', function() {
                this.style.color = '#a78bfa';
            });
            link.addEventListener('mouseleave', function() {
                this.style.color = 'rgba(255, 255, 255, 0.7)';
            });
        });
    