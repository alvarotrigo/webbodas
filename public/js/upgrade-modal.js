/**
 * Upgrade Modal Component
 * Loads and manages the upgrade modal on demand
 * Single Pro plan – checkout via Stripe
 */

class UpgradeModal {
    constructor() {
        this.modal = null;
        this.isLoaded = false;
        this.eventListeners = [];
        this.proFeaturesModal = null;
        this.proFeaturesEventListeners = [];
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
            // [DISABLED_FOR_WEDDING_VERSION]: Senja widget replaced by static review cards
            // this.loadSenjaWidget();
            this.attachEventListeners();
            return this.modal;
        }

        // Inject CSS styles
        this.injectStyles();

        // Create modal HTML (layout aligned with upgrademodal.html reference)
        const modalHTML = `
            <div id="upgrade-modal" class="upgrade-modal">
                <div class="upgrade-modal-content">
                    <button class="upgrade-modal-close" id="close-upgrade-modal" type="button" aria-label="Close">✕</button>

                    <div class="upgrade-modal-body">
                        <div class="upgrade-modal-left">
                            <div class="upgrade-modal-pro-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                        </svg>
                    </div>

                    <div class="upgrade-modal-header">
                        <h2>Plan Pro</h2>
                        <p class="upgrade-modal-subtitle">Unlock all premium features</p>
                    </div>

                    <div class="upgrade-modal-price-row">
                        <span class="price-amount">89€</span>
                        <span class="price-badge">One-time payment</span>
                    </div>

                    <div class="upgrade-modal-features">
                        <div class="upgrade-modal-feature">
                            <div class="upgrade-modal-feature-icon"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg></div>
                            <span>Custom <strong>.com domain</strong></span>
                        </div>
                                                <div class="upgrade-modal-feature">
                            <div class="upgrade-modal-feature-icon"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg></div>
                            <span><strong>Unlimited</strong> pages</span>
                        </div>
                        <div class="upgrade-modal-feature">
                            <div class="upgrade-modal-feature-icon"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg></div>
                            <span><strong>All</strong> Pro templates</span>
                        </div>
                        <div class="upgrade-modal-feature">
                            <div class="upgrade-modal-feature-icon"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg></div>
                            <span>Full visual editor</span>
                        </div>
                        <div class="upgrade-modal-feature">
                            <div class="upgrade-modal-feature-icon"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg></div>
                            <span><strong>Unlimited</strong> forms</span>
                        </div>
                        <div class="upgrade-modal-feature">
                            <div class="upgrade-modal-feature-icon"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg></div>
                            <span>Shareable link</span>
                        </div>
                            </div>

                            <button type="button" class="upgrade-modal-cta-btn pricing-btn pricing-btn-pro" data-plan="pro">
                        <span class="upgrade-btn-spinner" aria-hidden="true"></span>
                        <span class="upgrade-btn-label">Get Pro</span>
                            </button>
                            <div class="pricing-notices">
                        <p><span class="pricing-notice-shield" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></span> Secure payment with Stripe</p>
                            </div>
                                                        <div class="upgrade-modal-divider"></div>
                            <a href="#" id="continue-free-link" class="upgrade-modal-skip-link">Continue with the free plan</a>



                            <p class="upgrade-error-message" id="upgrade-error-message" role="alert" aria-live="polite"></p>

                        </div>

                        <div class="upgrade-modal-right">
                            <div class="upgrade-modal-reviews-title">Trusted by the community</div>
                            <div class="upgrade-modal-reviews">

                                <div class="um-review-card um-review-card--full">
                                    <div class="um-review-header">
                                        <img class="um-review-avatar" src="https://api.dicebear.com/7.x/avataaars/svg?seed=SarahK" alt="">
                                        <div>
                                            <div class="um-review-name">Sarah K.</div>
                                            <div class="um-review-role">Bride</div>
                                        </div>
                                    </div>
                                    <div class="um-review-stars">★★★★★</div>
                                    <div class="um-review-text">One of the best solutions for our big day. We selected the Pro plan for the custom .com link and it's a must-have. Thanks! — the editor is so easy to use even if you aren't a "computer person."</div>
                                </div>

                                <div class="um-review-row">
                                    <div class="um-review-card">
                                        <div class="um-review-header">
                                            <img class="um-review-avatar" src="https://api.dicebear.com/7.x/avataaars/svg?seed=JamesM" alt="">
                                            <div>
                                                <div class="um-review-name">James M.</div>
                                                <div class="um-review-role">Groom</div>
                                            </div>
                                        </div>
                                        <div class="um-review-stars">★★★★★</div>
                                        <div class="um-review-text">I didn't need to read a manual or watch tutorials—it just makes sense as you go. If you want a stunning wedding site without the headache, this is the one.</div>
                                    </div>
                                    <div class="um-review-card">
                                        <div class="um-review-header">
                                            <img class="um-review-avatar" src="https://api.dicebear.com/7.x/avataaars/svg?seed=RyanT" alt="">
                                            <div>
                                                <div class="um-review-name">Ryan T.</div>
                                                <div class="um-review-role">Groom</div>
                                            </div>
                                        </div>
                                        <div class="um-review-stars">★★★★★</div>
                                        <div class="um-review-text">Simple, elegant, and it just works. I fell in love with the templates immediately—they are absolutely gorgeous and didn't look 'cheap' like other sites I tried.</div>
                                    </div>
                                </div>

                                <div class="um-review-card um-review-card--full">
                                    <div class="um-review-header">
                                        <img class="um-review-avatar" src="https://api.dicebear.com/7.x/avataaars/svg?seed=LauraP" alt="">
                                        <div>
                                            <div class="um-review-name">Laura P.</div>
                                            <div class="um-review-role">Bride</div>
                                        </div>
                                    </div>
                                    <div class="um-review-stars">★★★★★</div>
                                    <div class="um-review-text">I created our site in under an hour! We upgraded to Pro because we had over 100 guests and needed to get past the free plan limit. The RSVP dashboard made tracking everyone a breeze—it’s worth every penny and I wish I’d found it sooner!</div>
                                </div>

                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Insert modal into body
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modal = document.getElementById('upgrade-modal');
        this.isLoaded = true;

        // [DISABLED_FOR_WEDDING_VERSION]: Senja widget replaced by static review cards
        // this.loadSenjaWidget();
        this.attachEventListeners();

        return this.modal;
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
                /* Upgrade modal – layout aligned with upgrademodal.html reference */
                .upgrade-modal {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.5);
                    display: none;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                }

                .upgrade-modal.show {
                    display: flex;
                }

                .upgrade-modal-content {
                    position: relative;
                    z-index: 10;
                    background: #fff;
                    border-radius: 16px;
                    padding: 36px 32px 20px;
                    width: 100%;
                    max-width: 1040px;
                    max-height: 85vh;
                    overflow-x: hidden;
                    overflow-y: auto;
                    box-shadow: 0 25px 60px rgba(0, 0, 0, 0.15);
                }

                .upgrade-modal-body {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1.5rem;
                    align-items: start;
                }
                @media (max-width: 768px) {
                    .upgrade-modal-body {
                        grid-template-columns: 1fr;
                    }
                }

                .upgrade-modal-close {
                    position: absolute;
                    top: 16px;
                    right: 16px;
                    background: none;
                    border: none;
                    cursor: pointer;
                    color: #999;
                    font-size: 20px;
                    line-height: 1;
                    padding: 0;
                }
                .upgrade-modal-close:hover {
                    color: #333;
                }

                .upgrade-modal-pro-icon {
                    width: 56px;
                    height: 56px;
                    background: linear-gradient(135deg, #3b82f6, #1d4ed8);
                    border-radius: 14px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-bottom: 20px;
                    box-shadow: 0 4px 14px rgba(59, 130, 246, 0.3);
                }
                .upgrade-modal-pro-icon svg {
                    width: 28px;
                    height: 28px;
                    color: #fff;
                }

                .upgrade-modal-header h2 {
                    font-size: 24px;
                    font-weight: 700;
                    color: #111;
                    margin-bottom: 4px;
                }

                .upgrade-modal-subtitle {
                    font-size: 14px;
                    color: #888;
                    margin-bottom: 24px;
                    line-height: 1.5;
                }

                .upgrade-modal-price-row {
                    display: flex;
                    align-items: baseline;
                    gap: 8px;
                    margin-bottom: 28px;
                }
                .upgrade-modal-price-row .price-amount {
                    font-size: 56px;
                    font-weight: 800;
                    color: #111;
                    line-height: 1;
                }
                .price-badge {
                    background: #eff6ff;
                    color: #3b82f6;
                    font-size: 12px;
                    font-weight: 600;
                    padding: 3px 10px;
                    border-radius: 20px;
                    margin-left: 4px;
                }

                .upgrade-modal-features {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                    margin-bottom: 28px;
                }
                .upgrade-modal-feature {
                    display: flex;
                    align-items: center;
                    gap: 14px;
                    font-size: 18px;
                    color: #333;
                    font-weight: 500;
                }
                .upgrade-modal-feature-icon {
                    width: 28px;
                    height: 28px;
                    flex-shrink: 0;
                    background: #f0fdf4;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .upgrade-modal-feature-icon svg {
                    width: 16px;
                    height: 16px;
                    color: #16a34a;
                }

                .upgrade-modal-cta-btn {
                    width: 100%;
                    padding: 14px;
                    background: #3b82f6;
                    color: #fff;
                    border: none;
                    border-radius: 12px;
                    font-size: 15px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: background 0.2s;
                    margin-bottom: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .upgrade-modal-cta-btn:hover {
                    background: #2563eb;
                }

                .upgrade-modal-skip-link {
                    display: block;
                    text-align: center;
                    font-size: 13px;
                    color: #999;
                    text-decoration: underline;
                    cursor: pointer;
                    margin-bottom: 12px;
                }
                .upgrade-modal-skip-link:hover {
                    color: #666;
                }

                .upgrade-modal-divider {
                    height: 1px;
                    background: #f1f5f9;
                    margin-bottom: 12px;
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
                    margin: 0.5rem 0 1rem;
                }
                .pricing-notices p {
                    color: #888;
                    font-size: 0.85rem;
                    margin: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                }
                .pricing-notice-shield {
                    display: inline-flex;
                    align-items: center;
                    color: #16a34a;
                }

                .upgrade-modal-right {
                    background: #f1f5f9;
                    border-radius: 12px;
                    padding: 1rem;
                }
                .upgrade-modal-reviews-title {
                    font-size: 12px;
                    font-weight: 600;
                    color: #64748b;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin-bottom: 14px;
                }
                .upgrade-modal-reviews {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                .um-review-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 10px;
                }
                .um-review-card {
                    background: #fff;
                    border-radius: 10px;
                    padding: 14px;
                }
                .um-review-card--full {
                    width: 100%;
                }
                .um-review-header {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin-bottom: 8px;
                }
                .um-review-avatar {
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    object-fit: cover;
                    flex-shrink: 0;
                }
                .um-review-name {
                    font-size: 14px;
                    font-weight: 600;
                    color: #1e293b;
                    line-height: 1.2;
                }
                .um-review-role {
                    font-size: 12px;
                    color: #94a3b8;
                    font-weight: 400;
                }
                .um-review-stars {
                    font-size: 14px;
                    color: #facc15;
                    margin-bottom: 6px;
                    letter-spacing: 1px;
                }
                .um-review-text {
                    font-size: 14px;
                    color: #64748b;
                    line-height: 1.55;
                }
                @media (max-width: 600px) {
                    .um-review-row {
                        grid-template-columns: 1fr;
                    }
                }

                .upgrade-modal-footer {
                    text-align: center;
                    margin-top: 0.75rem;
                    padding-top: 0.75rem;
                    border-top: 1px solid #f1f5f9;
                }
                .upgrade-modal-footer p {
                    color: #888;
                    font-size: 0.8rem;
                    margin-bottom: 0.5rem;
                }
                .upgrade-modal-footer a {
                    color: #3b82f6;
                    text-decoration: none;
                    font-weight: 500;
                }
                .upgrade-modal-footer a:hover {
                    text-decoration: underline;
                }

                /* CTA when used as .pricing-btn (loading state) */
                .pricing-btn.loading {
                    opacity: 0.85;
                    cursor: progress;
                }
                .upgrade-btn-spinner {
                    display: none;
                    width: 18px;
                    height: 18px;
                    border: 2px solid rgba(255, 255, 255, 0.3);
                    border-top-color: #fff;
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
                    to { transform: rotate(360deg); }
                }
            </style>
        `;

        document.head.insertAdjacentHTML('beforeend', styles);
    }

    /**
     * Inject CSS for the narrow Pro Features (informative) modal
     */
    injectProFeaturesStyles() {
        if (document.getElementById('pro-features-modal-styles')) {
            return;
        }
        const styles = `
            <style id="pro-features-modal-styles">
                #pro-features-modal {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.5);
                    display: none;
                    align-items: center;
                    justify-content: center;
                    z-index: 10001;
                }
                #pro-features-modal.show {
                    display: flex;
                }
                #pro-features-modal .pro-features-modal-content {
                    position: relative;
                    z-index: 10;
                    background: #fff;
                    border-radius: 16px;
                    padding: 28px 24px 24px;
                    width: 100%;
                    max-width: 270px;
                    max-height: 85vh;
                    overflow-x: hidden;
                    overflow-y: auto;
                    box-shadow: 0 25px 60px rgba(0, 0, 0, 0.15);
                }
                #pro-features-modal .pro-features-modal-close {
                    position: absolute;
                    top: 12px;
                    right: 12px;
                    background: none;
                    border: none;
                    cursor: pointer;
                    color: #999;
                    font-size: 20px;
                    line-height: 1;
                    padding: 0;
                }
                #pro-features-modal .pro-features-modal-close:hover {
                    color: #333;
                }
                #pro-features-modal .upgrade-modal-pro-icon {
                    width: 48px;
                    height: 48px;
                    background: linear-gradient(135deg, #3b82f6, #1d4ed8);
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-bottom: 16px;
                    box-shadow: 0 4px 14px rgba(59, 130, 246, 0.3);
                }
                #pro-features-modal .upgrade-modal-pro-icon svg {
                    width: 24px;
                    height: 24px;
                    color: #fff;
                }
                #pro-features-modal .upgrade-modal-header h2 {
                    font-size: 20px;
                    font-weight: 700;
                    color: #111;
                    margin-bottom: 4px;
                }
                #pro-features-modal .pro-features-modal-title-row {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    flex-wrap: wrap;
                }
                #pro-features-modal .pro-features-activated-badge {
                    display: inline-block;
                    background: #16a34a;
                    color: #fff;
                    font-size: 11px;
                    font-weight: 700;
                    padding: 4px 10px;
                    border-radius: 20px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                #pro-features-modal .upgrade-modal-subtitle {
                    font-size: 13px;
                    color: #888;
                    margin-bottom: 20px;
                    line-height: 1.5;
                }
                #pro-features-modal .upgrade-modal-features {
                    display: flex;
                    flex-direction: column;
                    gap: 14px;
                }
                #pro-features-modal .upgrade-modal-feature {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    font-size: 15px;
                    color: #333;
                    font-weight: 500;
                }
                #pro-features-modal .upgrade-modal-feature-icon {
                    width: 26px;
                    height: 26px;
                    flex-shrink: 0;
                    background: #f0fdf4;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                #pro-features-modal .upgrade-modal-feature-icon svg {
                    width: 14px;
                    height: 14px;
                    color: #16a34a;
                }
            </style>
        `;
        document.head.insertAdjacentHTML('beforeend', styles);
    }

    /**
     * Load the Pro Features (informative-only) modal – no price, no CTA, no reviews
     */
    async loadProFeaturesModal() {
        if (this.proFeaturesModal) {
            return this.proFeaturesModal;
        }
        const existing = document.getElementById('pro-features-modal');
        if (existing) {
            this.proFeaturesModal = existing;
            this.attachProFeaturesEventListeners();
            return this.proFeaturesModal;
        }
        this.injectProFeaturesStyles();
        const modalHTML = `
            <div id="pro-features-modal" class="pro-features-modal">
                <div class="pro-features-modal-content">
                    <button class="pro-features-modal-close" id="close-pro-features-modal" type="button" aria-label="Close">✕</button>
                    <div class="upgrade-modal-pro-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                        </svg>
                    </div>
                    <div class="upgrade-modal-header">
                        <h2 class="pro-features-modal-title-row">Plan Pro <span class="pro-features-activated-badge">Activated!</span></h2>
                        <p class="upgrade-modal-subtitle">All premium features unlocked 🎉</p>
                    </div>
                    <div class="upgrade-modal-features">
                        <div class="upgrade-modal-feature">
                            <div class="upgrade-modal-feature-icon"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg></div>
                            <span>Custom <strong>.com domain</strong></span>
                        </div>
                        <div class="upgrade-modal-feature">
                            <div class="upgrade-modal-feature-icon"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg></div>
                            <span><strong>Unlimited</strong> pages</span>
                        </div>
                        <div class="upgrade-modal-feature">
                            <div class="upgrade-modal-feature-icon"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg></div>
                            <span><strong>All</strong> Pro templates</span>
                        </div>
                        <div class="upgrade-modal-feature">
                            <div class="upgrade-modal-feature-icon"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg></div>
                            <span>Full visual editor</span>
                        </div>
                        <div class="upgrade-modal-feature">
                            <div class="upgrade-modal-feature-icon"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg></div>
                            <span><strong>Unlimited</strong> forms</span>
                        </div>
                        <div class="upgrade-modal-feature">
                            <div class="upgrade-modal-feature-icon"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg></div>
                            <span>Shareable link</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.proFeaturesModal = document.getElementById('pro-features-modal');
        this.attachProFeaturesEventListeners();
        return this.proFeaturesModal;
    }

    /**
     * Attach event listeners for the Pro Features modal
     */
    attachProFeaturesEventListeners() {
        if (!this.proFeaturesModal) return;
        this.removeProFeaturesEventListeners();
        const closeBtn = this.proFeaturesModal.querySelector('#close-pro-features-modal');
        const closeHandler = () => this.hideProFeaturesModal();
        if (closeBtn) {
            closeBtn.addEventListener('click', closeHandler);
            this.proFeaturesEventListeners.push({ element: closeBtn, event: 'click', handler: closeHandler });
        }
        const outsideClickHandler = (e) => {
            if (e.target === this.proFeaturesModal) this.hideProFeaturesModal();
        };
        this.proFeaturesModal.addEventListener('click', outsideClickHandler);
        this.proFeaturesEventListeners.push({ element: this.proFeaturesModal, event: 'click', handler: outsideClickHandler });
        const escKeyHandler = (e) => {
            if (e.key === 'Escape' && this.proFeaturesModal && this.proFeaturesModal.classList.contains('show')) {
                this.hideProFeaturesModal();
            }
        };
        document.addEventListener('keydown', escKeyHandler);
        this.proFeaturesEventListeners.push({ element: document, event: 'keydown', handler: escKeyHandler });
    }

    removeProFeaturesEventListeners() {
        this.proFeaturesEventListeners.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
        this.proFeaturesEventListeners = [];
    }

    /**
     * Show the Pro Features (informative-only) modal – e.g. when clicking the PRO badge
     */
    async showProFeaturesModal() {
        await this.loadProFeaturesModal();
        if (this.proFeaturesModal) {
            this.proFeaturesModal.classList.add('show');
            document.body.style.overflow = 'hidden';
        }
    }

    /**
     * Hide the Pro Features modal
     */
    hideProFeaturesModal() {
        if (this.proFeaturesModal) {
            this.proFeaturesModal.classList.remove('show');
            document.body.style.overflow = '';
        }
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

        // Pricing buttons - create Stripe checkout
        pricingButtons.forEach((button) => {
            const btn = /** @type {HTMLButtonElement} */ (button);
            const upgradeHandler = (e) => {
                const plan = btn.dataset.plan || 'pro';
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
     * Handle upgrade button click – creates Stripe Checkout session (single Pro plan)
     * @param {Event} e - Click event
     * @param {HTMLButtonElement} button - The clicked button
     * @param {string} plan - Plan identifier ('pro')
     */
    async handleUpgradeClick(e, button, plan) {
        e.preventDefault();
        
        if (!button || button.disabled) {
            return;
        }

        if (!plan || plan !== 'pro') {
            this.showUpgradeError('Selecciona el plan Pro.');
            return;
        }

        const user = this.getActiveUser();

        // If user is not logged in, prompt them to sign in first
        if (!user || !user.email || !user.id) {
            this.showUpgradeError('Inicia sesión para actualizar a Pro.');
            setTimeout(() => {
                window.location.href = 'auth-wall.html';
            }, 1500);
            return;
        }

        try {
            this.clearUpgradeError();
            this.setUpgradeButtonLoading(button, 'Preparando checkout...');

            // Create checkout session with customer email pre-filled
            // Store current URL to return after successful checkout
            const currentUrl = window.location.href;
            
            const response = await fetch('api/stripe-create-checkout.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: user.email,
                    name: user.name || '',
                    clerk_user_id: user.id,
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
                throw new Error(result.error || 'No se pudo crear la sesión de pago.');
            }

            this.setUpgradeButtonLoading(button, 'Redirigiendo…');
            
            window.location.href = result.checkout_url;
            
        } catch (error) {
            console.error('Stripe checkout error:', error);
            this.showUpgradeError(error.message || 'No se pudo iniciar el pago. Inténtalo de nuevo.');
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
            const id = window.serverUserData.clerk_user_id || null;
            const email = window.serverUserData.email || null;
            if (id && email) {
                return {
                    email: email,
                    name: window.serverUserData.name || null,
                    id: id
                };
            }
        }

        // Fallback: Clerk client-side user (when serverUserData not yet set or page doesn't expose it)
        try {
            const clerk = typeof window.Clerk !== 'undefined' ? window.Clerk : null;
            const user = clerk?.user;
            if (user) {
                const primaryEmail = user.primaryEmailAddress?.emailAddress || user.emailAddresses?.[0]?.emailAddress || null;
                const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || null;
                if (primaryEmail && user.id) {
                    return {
                        email: primaryEmail,
                        name: name,
                        id: user.id
                    };
                }
            }
        } catch (e) {
            // ignore
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

// Open Pro Features modal when clicking the PRO badge – works on app.php and pages.php (delegated)
document.addEventListener('click', function (e) {
    const badge = e.target.closest('#clerk-pro-badge');
    if (!badge) return;
    e.preventDefault();
    if (typeof upgradeModal !== 'undefined' && typeof upgradeModal.showProFeaturesModal === 'function') {
        upgradeModal.showProFeaturesModal();
    }
});

// Export for use in other scripts
if (typeof window !== 'undefined') {
    // @ts-ignore - Adding to window object at runtime
    window.UpgradeModal = UpgradeModal;
    // @ts-ignore - Adding to window object at runtime
    window.upgradeModal = upgradeModal;
}
