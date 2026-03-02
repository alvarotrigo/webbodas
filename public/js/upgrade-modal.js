/**
 * Upgrade Modal Component
 * Loads and manages the upgrade modal on demand
 * 
 * Updated for Polar.sh integration
 */

class UpgradeModal {
    constructor() {
        this.modal = null;
        this.isLoaded = false;
        this.eventListeners = [];
        
        // NOTE: Checkout URLs are now managed on the backend via config/polar.php
        // The backend automatically uses sandbox URLs when POLAR_TEST_MODE=true
        // These URLs are kept here for reference only and are NOT used in the code
        this.polarCheckoutUrls = {
            production: {
                annual: 'https://buy.polar.sh/polar_cl_vGfXimmFJMnYqTQWN7Vu3PEhqpyHoLZFdZCXJ4geYUn',
                lifetime: 'https://buy.polar.sh/polar_cl_jvXG4n0BcuDSybmQSnMqKKmqZTYgsntIEGHh12CaUM7'
            },
            sandbox: {
                // Add your sandbox checkout links here (from .env)
                annual: 'POLAR_CHECKOUT_ANNUAL_SANDBOX',
                lifetime: 'POLAR_CHECKOUT_LIFETIME_SANDBOX'
            }
        };
    }

    /**
     * Load the upgrade modal HTML and CSS into the page
     */
    async load() {
        if (this.isLoaded && this.modal) {
            return this.modal;
        }

        // Check if modal already exists in DOM
        const existingModal = document.getElementById('upgrade-modal');
        if (existingModal) {
            this.modal = existingModal;
            this.isLoaded = true;
            // Load Senja testimonies widget
            this.loadSenjaWidget();
            // Load Polar embedded checkout script
            this.loadPolarScript();
            this.attachEventListeners();
            return this.modal;
        }

        // Inject CSS styles
        this.injectStyles();

        // Create modal HTML with Polar pricing (Annual + Lifetime)
        const modalHTML = `
            <div id="upgrade-modal" class="upgrade-modal">
                <div class="upgrade-modal-content">
                    <button class="upgrade-modal-close" id="close-upgrade-modal">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
                        </svg>
                    </button>
                    
                    <div class="upgrade-modal-header">
                        <h2>Choose Your Plan</h2>
                        <p>Select the plan that works best for you</p>
                    </div>

                    <div class="free-plan-option">
                        <a href="#" id="continue-free-link" class="continue-free-link">
                            Continue with Free Plan →
                        </a>
                    </div>

                    <div class="pricing-tiers">
                        <div class="pricing-card" data-plan="annual">
                            <div class="pricing-card-content">
                                <div class="pricing-card-header">
                                    <h3>Annual</h3>
                                </div>
                                <div class="pricing-card-price">
                                    <span class="price-amount">$99</span>
                                    <span class="price-period">/year</span>
                                </div>
                                <p class="pricing-subheading">Perfect for getting started</p>
                                <ul class="pricing-features">
                                    <li>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <path d="M20 6 9 17l-5-5"/>
                                        </svg>
                                        Access to 200+ premium sections
                                    </li>
                                    <li>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <path d="M20 6 9 17l-5-5"/>
                                        </svg>
                                        Unlimited downloads
                                    </li>
                                    <li>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <path d="M20 6 9 17l-5-5"/>
                                        </svg>
                                        Advanced customization options
                                    </li>
                                    <li>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <path d="M20 6 9 17l-5-5"/>
                                        </svg>
                                        Priority support
                                    </li>
                                    <li style="opacity: 0.6;">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <circle cx="12" cy="12" r="10"/>
                                        </svg>
                                        AI creation feature (coming soon)
                                        <span class="ai-feature-info">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="info-icon">
                                                <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
                                            </svg>
                                            <span class="ai-feature-tooltip">Credit-based AI creation with monthly limits. Option to purchase additional credits if needed.</span>
                                        </span>
                                    </li>
                                </ul>
                            </div>
                            <button type="button" class="pricing-btn" data-plan="annual">
                                <span class="upgrade-btn-spinner" aria-hidden="true"></span>
                                <span class="upgrade-btn-label">Subscribe Now</span>
                            </button>
                        </div>
                        
                        <div class="pricing-card pricing-card-featured" data-plan="lifetime">
                            <div class="pricing-card-badge">Best Value</div>
                            <div class="pricing-card-content">
                                <div class="pricing-card-header">
                                    <h3>Lifetime</h3>
                                </div>
                                <div class="pricing-card-price">
                                    <span class="price-original">$499</span>
                                    <span class="price-amount">$289</span>
                                    <span class="price-period">one-time</span>
                                </div>
                                <p class="pricing-limited-notice">⚡ Early access price</p>
                                <p class="pricing-subheading">Pay once, use forever</p>
                                <ul class="pricing-features">
                                    <li>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <path d="M20 6 9 17l-5-5"/>
                                        </svg>
                                        Access to 200+ premium sections
                                    </li>
                                    <li>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <path d="M20 6 9 17l-5-5"/>
                                        </svg>
                                        Unlimited downloads
                                    </li>
                                    <li>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <path d="M20 6 9 17l-5-5"/>
                                        </svg>
                                        Advanced customization options
                                    </li>
                                    <li>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <path d="M20 6 9 17l-5-5"/>
                                        </svg>
                                        Priority support
                                    </li>
                                    <li>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <path d="M20 6 9 17l-5-5"/>
                                        </svg>
                                        Lifetime updates included
                                    </li>
                                    <li style="opacity: 0.6;">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <circle cx="12" cy="12" r="10"/>
                                        </svg>
                                        AI creation feature (coming soon)
                                        <span class="ai-feature-info">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="info-icon">
                                                <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
                                            </svg>
                                            <span class="ai-feature-tooltip">Credit-based AI creation with monthly limits. Option to purchase additional credits if needed.</span>
                                        </span>
                                    </li>
                                </ul>
                            </div>
                            <button type="button" class="pricing-btn pricing-btn-featured" data-plan="lifetime">
                                <span class="upgrade-btn-spinner" aria-hidden="true"></span>
                                <span class="upgrade-btn-label">Get Lifetime Access</span>
                            </button>
                        </div>
                    </div>
                    
                    <p class="upgrade-error-message" id="upgrade-error-message" role="alert" aria-live="polite"></p>
                    
                    <div class="pricing-notices">
                        <p>Cancel anytime • Refund within 7 days • Secure checkout by Polar</p>
                    </div>
                    
                    <div class="pricing-testimonies">
                        <div class="senja-embed" data-id="274a3e6d-073f-4761-b991-f03d00c093e8" data-mode="shadow" data-lazyload="false" style="display: block; width: 100%;"></div>
                    </div>
                    
                    <div class="upgrade-modal-footer">
                        <p>Already have an account?</p>
                        <a href="#" id="login-link">Sign in to continue</a>
                    </div>
                </div>
            </div>
        `;

        // Insert modal into body
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modal = document.getElementById('upgrade-modal');
        this.isLoaded = true;

        // Load Senja testimonies widget
        this.loadSenjaWidget();
        
        // Load Polar embedded checkout script
        this.loadPolarScript();

        // Attach event listeners
        this.attachEventListeners();

        return this.modal;
    }

    /**
     * Load Polar.sh embedded checkout script
     * Note: We're now using direct links with pre-filled data via API
     */
    loadPolarScript() {
        // No longer needed - we're using direct checkout links with query params
        // Kept as placeholder in case we want to add embedded checkout later
    }

    /**
     * Load Senja testimonies widget script dynamically
     */
    loadSenjaWidget() {
        // Check if script is already loaded
        const existingScript = document.querySelector('script[src*="senja.io/widget"]');
        if (existingScript) {
            // Script already exists, trigger widget initialization if needed
            if (typeof window.Senja !== 'undefined' && window.Senja.init) {
                window.Senja.init();
            }
            return;
        }

        // Create and load the script
        const script = document.createElement('script');
        script.src = 'https://widget.senja.io/widget/274a3e6d-073f-4761-b991-f03d00c093e8/platform.js';
        script.type = 'text/javascript';
        script.async = true;
        
        script.onload = () => {
            // Widget script loaded, it should automatically initialize the embed
            if (typeof window.Senja !== 'undefined' && window.Senja.init) {
                window.Senja.init();
            }
        };

        document.head.appendChild(script);
    }

    /**
     * Inject CSS styles for the upgrade modal
     */
    injectStyles() {
        // Check if styles already exist
        if (document.getElementById('upgrade-modal-styles')) {
            return;
        }

        const styles = `
            <style id="upgrade-modal-styles">
                /* Upgrade modal styles */
                .upgrade-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.5);
                    display: none;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                    backdrop-filter: blur(4px);
                }

                .upgrade-modal.show {
                    display: flex;
                }

                .upgrade-modal-content {
                    background: white;
                    border-radius: 16px;
                    padding: 2.5rem 3em;
                    max-width: 800px;
                    width: 90%;
                    max-height: 85vh;
                    overflow-y: auto;
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
                    position: relative;
                }

                .upgrade-modal-header {
                    text-align: left;
                    margin-bottom: 1.8rem;
                }

                .upgrade-modal-header h2 {
                    font-size: 1.7rem;
                    font-weight: 700;
                    color: #1a252f;
                    margin-bottom: 0.5rem;
                }

                .upgrade-modal-header p {
                    color: #6c757d;
                    font-size: 0.9rem;
                }

                .free-plan-option {
                    text-align: center;
                    margin: 0 0 1.5rem 0;
                    padding: 0.75rem 0;
                }

                .continue-free-link {
                    color: #6c757d;
                    text-decoration: none;
                    font-size: 0.95rem;
                    font-weight: 500;
                    padding: 0.5rem 1rem;
                    border-radius: 6px;
                    transition: all 0.2s ease;
                    display: inline-block;
                    position: relative;
                }

                .continue-free-link::after {
                    content: '';
                    position: absolute;
                    bottom: 0.25rem;
                    left: 1rem;
                    right: 1rem;
                    height: 1px;
                    background: #6c757d;
                    opacity: 0.4;
                    transition: opacity 0.2s ease;
                }

                .continue-free-link:hover {
                    color: #4285f4;
                    background: rgba(66, 133, 244, 0.05);
                }

                .continue-free-link:hover::after {
                    opacity: 0.7;
                    background: #4285f4;
                }

                .upgrade-modal-close {
                    position: absolute;
                    top: 1rem;
                    right: 1rem;
                    width: 32px;
                    height: 32px;
                    border: none;
                    background: #f1f3f4;
                    border-radius: 50%;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s ease;
                }

                .upgrade-modal-close:hover {
                    background: #e9ecef;
                }

                .upgrade-modal-close i {
                    color: #6c757d;
                }

                .upgrade-modal-close svg {
                    color: #6c757d;
                }

                .pricing-tiers {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1.5rem;
                    margin-bottom: 1.5rem;
                    align-items: stretch;
                }

                @media (max-width: 640px) {
                    .pricing-tiers {
                        grid-template-columns: 1fr;
                    }
                }

                .pricing-card {
                    background: white;
                    border: 2px solid #e9ecef;
                    border-radius: 12px;
                    padding: 1.5rem;
                    text-align: center;
                    position: relative;
                    transition: all 0.3s ease;
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    z-index: 1;
                }

                .pricing-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                    z-index: 10;
                }

                .pricing-card-featured {
                    background: white;
                    border: 2px solid #ff6b6b;
                    box-shadow: 0 4px 16px rgba(255, 107, 107, 0.2);
                }

                .pricing-card-featured:hover {
                    box-shadow: 0 6px 20px rgba(255, 107, 107, 0.3);
                }

                .pricing-card-badge {
                    position: absolute;
                    top: -12px;
                    right: 1rem;
                    background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
                    color: white;
                    padding: 0.25rem 0.75rem;
                    border-radius: 12px;
                    font-size: 0.75rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .pricing-card-content {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    min-height: 0;
                }

                .pricing-card-header {
                    margin-bottom: 1rem;
                }

                .pricing-card-header h3 {
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: #1a252f;
                    margin: 0;
                }

                .pricing-card-price {
                    margin-bottom: 0.5rem;
                }

                .price-original {
                    font-size: 1.5rem;
                    font-weight: 600;
                    color: #6c757d;
                    text-decoration: line-through;
                    opacity: 0.7;
                    margin-right: 0.5rem;
                    display: inline-block;
                }

                .price-amount {
                    font-size: 2.5rem;
                    font-weight: 700;
                    color: #1a252f;
                }

                .price-period {
                    font-size: 1rem;
                    color: #6c757d;
                    margin-left: 0.25rem;
                }

                .pricing-subheading {
                    font-size: 0.9rem;
                    color: #6c757d;
                    margin: 0 0 1.5rem 0;
                    font-weight: 400;
                }

                .pricing-limited-notice {
                    font-size: 0.85rem;
                    color: #ff6b35;
                    font-weight: 700;
                    margin: 0.5rem 0 0.8rem 0;
                    padding: 0.4rem 0.8rem;
                    background: rgba(255, 107, 53, 0.12);
                    border-radius: 6px;
                    display: inline-block;
                    white-space: nowrap;
                }

                .ai-feature-info {
                    position: relative;
                    display: inline-flex;
                    align-items: center;
                    margin-left: 0.3rem;
                    cursor: help;
                    z-index: 100;
                }

                .ai-feature-info .info-icon {
                    width: 14px;
                    height: 14px;
                    color: #6c757d;
                    transition: color 0.2s ease;
                }

                .ai-feature-info .info-icon svg {
                    width: 14px;
                    height: 14px;
                }

                .ai-feature-info:hover .info-icon {
                    color: #ff6b35;
                }

                .ai-feature-tooltip {
                    position: absolute;
                    bottom: 100%;
                    left: 50%;
                    transform: translateX(-50%);
                    background: rgba(0,0,0,0.95);
                    color: white;
                    padding: 0.6rem 0.8rem;
                    border-radius: 6px;
                    font-size: 0.75rem;
                    white-space: normal;
                    width: 200px;
                    text-align: center;
                    opacity: 0;
                    visibility: hidden;
                    transition: opacity 0.2s ease, visibility 0.2s ease;
                    pointer-events: none;
                    margin-bottom: 0.5rem;
                    z-index: 10001;
                    line-height: 1.4;
                }

                .ai-feature-tooltip::after {
                    content: '';
                    position: absolute;
                    top: 100%;
                    left: 50%;
                    transform: translateX(-50%);
                    border: 5px solid transparent;
                    border-top-color: #1a252f;
                }

                .ai-feature-info:hover .ai-feature-tooltip {
                    opacity: 1;
                    visibility: visible;
                }

                .pricing-features {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                    text-align: left;
                    flex: 1;
                    min-height: 0;
                }

                .pricing-features li {
                    display: flex;
                    align-items: flex-start;
                    margin-bottom: 0.2rem;
                    font-size: 0.9rem;
                    color: #2c3e50;
                    position: relative;
                }

                .pricing-features li i {
                    width: 18px;
                    height: 18px;
                    color: #10b981;
                    margin-right: 0.5rem;
                    flex-shrink: 0;
                    margin-top: 0.1rem;
                }

                .pricing-features li svg {
                    width: 18px;
                    height: 18px;
                    color: #10b981;
                    margin-right: 0.5rem;
                    flex-shrink: 0;
                    margin-top: 0.1rem;
                }

                .pricing-btn {
                    width: 100%;
                    background: #e1e1e1;
                    color: black;
                    border: none;
                    padding: 0.75rem 1.5rem;
                    border-radius: 8px;
                    font-weight: 600;
                    font-size: 0.95rem;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-top: auto;
                    flex-shrink: 0;
                    text-decoration: none;
                }

                .pricing-btn:hover {
                    background: #e55a2b;
                    color: white;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(255, 107, 53, 0.3);
                }

                .pricing-btn-featured {
                    background: #ff6b35;
                    margin-top: 25px;
                    color: white;
                }

                .pricing-btn-featured:hover {
                    background: #e55a2b;
                    box-shadow: 0 4px 12px rgba(255, 107, 53, 0.4);
                }

                .pricing-btn:disabled {
                    opacity: 0.8;
                    cursor: not-allowed;
                    pointer-events: none;
                }

                .pricing-btn.loading {
                    opacity: 0.85;
                    cursor: progress;
                }

                .upgrade-btn-spinner {
                    display: none;
                    width: 18px;
                    height: 18px;
                    border: 2px solid rgba(255, 255, 255, 0.3);
                    border-top-color: #ffffff;
                    border-radius: 50%;
                    margin-right: 10px;
                    animation: upgrade-btn-spin 0.8s linear infinite;
                }

                .pricing-btn.loading .upgrade-btn-spinner {
                    display: inline-block;
                }

                .pricing-btn.loading .upgrade-btn-label {
                    opacity: 0.9;
                }

                @keyframes upgrade-btn-spin {
                    to {
                        transform: rotate(360deg);
                    }
                }

                .upgrade-error-message {
                    min-height: 1.25rem;
                    margin: 0 0 1rem;
                    color: #ef4444;
                    font-size: 0.85rem;
                    font-weight: 500;
                    text-align: center;
                }

                .pricing-notices {
                    text-align: center;
                    margin: 1.5rem 0;
                    padding: 1rem 0;
                }

                .pricing-notices p {
                    color: #6c757d;
                    font-size: 0.85rem;
                    margin: 0;
                }

                .pricing-testimonies {
                    margin: 2rem 0 1rem;
                    padding: 1rem 0;
                    border-top: 1px solid #e9ecef;
                }

                .upgrade-modal-footer {
                    text-align: center;
                    margin-top: 1rem;
                    padding-top: 1rem;
                    border-top: 1px solid #e9ecef;
                }

                .upgrade-modal-footer p {
                    color: #6c757d;
                    font-size: 0.8rem;
                    margin-bottom: 0.5rem;
                }

                .upgrade-modal-footer a {
                    color: #4285f4;
                    text-decoration: none;
                    font-weight: 500;
                }

                .upgrade-modal-footer a:hover {
                    text-decoration: underline;
                }
            </style>
        `;

        document.head.insertAdjacentHTML('beforeend', styles);
    }

    /**
     * Attach event listeners to the modal
     */
    attachEventListeners() {
        if (!this.modal) return;

        // Remove existing listeners
        this.removeEventListeners();

        const closeBtn = this.modal.querySelector('#close-upgrade-modal');
        const loginLink = this.modal.querySelector('#login-link');
        const continueFreeLink = this.modal.querySelector('#continue-free-link');
        const upgradeModal = this.modal;
        const pricingButtons = this.modal.querySelectorAll('.pricing-btn');

        // Close button
        if (closeBtn) {
            const closeHandler = () => this.hide();
            closeBtn.addEventListener('click', closeHandler);
            this.eventListeners.push({ element: closeBtn, event: 'click', handler: closeHandler });
        }

        // Continue with Free Plan link
        if (continueFreeLink) {
            const freePlanHandler = (e) => {
                e.preventDefault();
                this.hide();
                // Optional: You can dispatch an event or call a callback here
                // to track that user chose to continue with free plan
            };
            continueFreeLink.addEventListener('click', freePlanHandler);
            this.eventListeners.push({ element: continueFreeLink, event: 'click', handler: freePlanHandler });
        }

        // Login link
        if (loginLink) {
            const loginHandler = (e) => {
                e.preventDefault();
                window.location.href = 'auth-wall.html';
            };
            loginLink.addEventListener('click', loginHandler);
            this.eventListeners.push({ element: loginLink, event: 'click', handler: loginHandler });
        }

        // Close on outside click
        const outsideClickHandler = (e) => {
            if (e.target === upgradeModal) {
                this.hide();
            }
        };
        upgradeModal.addEventListener('click', outsideClickHandler);
        this.eventListeners.push({ element: upgradeModal, event: 'click', handler: outsideClickHandler });

        // Close on ESC key
        const escKeyHandler = (e) => {
            if (e.key === 'Escape' && upgradeModal.classList.contains('show')) {
                this.hide();
            }
        };
        document.addEventListener('keydown', escKeyHandler);
        this.eventListeners.push({ element: document, event: 'keydown', handler: escKeyHandler });

        // Pricing buttons - create checkout with pre-filled customer info
        pricingButtons.forEach((button) => {
            const btn = /** @type {HTMLButtonElement} */ (button);
            const upgradeHandler = (e) => {
                const plan = btn.dataset.plan || 'annual';
                this.handleUpgradeClick(e, btn, plan);
            };

            if (!btn.dataset.defaultLabel) {
                const label = btn.querySelector('.upgrade-btn-label');
                if (label) {
                    btn.dataset.defaultLabel = label.textContent.trim();
                }
            }

            btn.addEventListener('click', upgradeHandler);
            this.eventListeners.push({ element: btn, event: 'click', handler: upgradeHandler });
        });
    }

    /**
     * Remove event listeners
     */
    removeEventListeners() {
        this.eventListeners.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
        this.eventListeners = [];
    }

    /**
     * Show the upgrade modal
     */
    async show() {
        await this.load();
        if (this.modal) {
            this.modal.classList.add('show');
            document.body.style.overflow = 'hidden';
        }
    }

    /**
     * Hide the upgrade modal
     */
    hide() {
        if (this.modal) {
            this.modal.classList.remove('show');
            document.body.style.overflow = '';
        }
    }

    /**
     * Check if modal is visible
     */
    isVisible() {
        return this.modal && this.modal.classList.contains('show');
    }

    /**
     * Handle upgrade button click
     * Creates a Polar checkout session with pre-filled customer information
     * 
     * Note: Test/sandbox mode is automatically handled on the backend via POLAR_TEST_MODE in .env
     * When POLAR_TEST_MODE=true, sandbox credentials and checkout links are used
     * 
     * @param {Event} e - Click event
     * @param {HTMLButtonElement} button - The clicked button
     * @param {string} plan - The plan type ('annual' or 'lifetime')
     */
    async handleUpgradeClick(e, button, plan) {
        e.preventDefault();
        
        if (!button || button.disabled) {
            return;
        }

        if (!plan || (plan !== 'annual' && plan !== 'lifetime')) {
            this.showUpgradeError('Please select a valid plan.');
            return;
        }

        const user = this.getActiveUser();

        // If user is not logged in, prompt them to sign in first
        if (!user || !user.email || !user.id) {
            this.showUpgradeError('Please sign in to upgrade.');
            // Optionally redirect to auth page
            setTimeout(() => {
                window.location.href = 'auth-wall.html';
            }, 1500);
            return;
        }

        try {
            this.clearUpgradeError();
            this.setUpgradeButtonLoading(button, 'Preparing checkout...');

            // Create checkout session with customer email pre-filled
            // Store current URL to return after successful checkout
            const currentUrl = window.location.href;
            
            const response = await fetch('api/polar-create-checkout.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: user.email,
                    name: user.name || '',
                    clerk_user_id: user.id,
                    plan: plan,
                    return_url: currentUrl
                })
            });

            let result;
            try {
                result = await response.json();
            } catch (jsonError) {
                throw new Error('Invalid response from checkout service.');
            }

            if (!response.ok || !result.success || !result.checkout_url) {
                throw new Error(result.error || 'Failed to create checkout session.');
            }

            this.setUpgradeButtonLoading(button, 'Redirecting…');
            
            // Redirect to Polar checkout with pre-filled email
            window.location.href = result.checkout_url;
            
        } catch (error) {
            console.error('Polar checkout error:', error);
            this.showUpgradeError(error.message || 'Unable to start checkout. Please try again.');
            this.resetUpgradeButton(button);
        }
    }

    /**
     * Retrieve active user from global context
     */
    getActiveUser() {
        if (typeof window === 'undefined') {
            return null;
        }

        if (window.currentUser && window.currentUser.email && window.currentUser.id) {
            return window.currentUser;
        }

        if (window.serverUserData && window.serverUserData.authenticated) {
            return {
                email: window.serverUserData.email || null,
                name: window.serverUserData.name || null,
                id: window.serverUserData.clerk_user_id || null
            };
        }

        return null;
    }

    /**
     * Set upgrade button loading state
     */
    setUpgradeButtonLoading(button, message) {
        const label = button.querySelector('.upgrade-btn-label');
        button.disabled = true;
        button.classList.add('loading');
        if (label) {
            label.textContent = message;
        }
    }

    /**
     * Reset upgrade button to default state
     */
    resetUpgradeButton(button) {
        const label = button.querySelector('.upgrade-btn-label');
        button.disabled = false;
        button.classList.remove('loading');
        if (label) {
            const defaultText = button.dataset.defaultLabel || 'Start Now';
            label.textContent = defaultText;
        }
    }

    /**
     * Display error message inside upgrade modal
     */
    showUpgradeError(message) {
        const errorElement = this.modal ? this.modal.querySelector('#upgrade-error-message') : null;
        if (errorElement) {
            errorElement.textContent = message;
        } else {
            alert(message);
        }
    }

    /**
     * Clear upgrade error message
     */
    clearUpgradeError() {
        const errorElement = this.modal ? this.modal.querySelector('#upgrade-error-message') : null;
        if (errorElement) {
            errorElement.textContent = '';
        }
    }
}

// Create singleton instance
const upgradeModal = new UpgradeModal();

// Export for use in other scripts
if (typeof window !== 'undefined') {
    // @ts-ignore - Adding to window object at runtime
    window.UpgradeModal = UpgradeModal;
    // @ts-ignore - Adding to window object at runtime
    window.upgradeModal = upgradeModal;
}
