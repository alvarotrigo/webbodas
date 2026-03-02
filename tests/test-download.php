<?php
// Test script to simulate the download process

// Simulate POST data with realistic sections
$_POST['sections'] = json_encode([
    [
        'html' => '<section class="hero-section">
            <div class="container">
                <div class="hero-content">
                    <h1 class="heading-themed">Welcome to Our Platform</h1>
                    <p class="text-themed-secondary">Discover amazing features and possibilities</p>
                    <div class="cta-buttons">
                        <button class="btn-themed">Get Started</button>
                        <button class="btn-themed-outline">Learn More</button>
                    </div>
                </div>
            </div>
        </section>'
    ],
    [
        'html' => '<section class="features-section">
            <div class="container">
                <h2 class="heading-themed">Our Features</h2>
                <div class="features-grid">
                    <div class="feature-card">
                        <h3 class="text-themed-primary">Feature 1</h3>
                        <p class="text-themed-secondary">Description of feature 1</p>
                    </div>
                    <div class="feature-card">
                        <h3 class="text-themed-primary">Feature 2</h3>
                        <p class="text-themed-secondary">Description of feature 2</p>
                    </div>
                </div>
            </div>
        </section>'
    ],
    [
        'html' => '<section class="contact-section">
            <div class="container">
                <h2 class="heading-themed">Contact Us</h2>
                <form class="contact-form">
                    <input type="text" class="form-input" placeholder="Your Name">
                    <input type="email" class="form-input" placeholder="Your Email">
                    <textarea class="form-textarea" placeholder="Your Message"></textarea>
                    <button type="submit" class="btn-themed">Send Message</button>
                </form>
            </div>
        </section>'
    ]
]);
$_POST['theme'] = 'theme-candy-shop';
$_POST['fullpageEnabled'] = 'true';
$_POST['animationsEnabled'] = 'true';

// Include the download script
include 'download-page.php';
?>
