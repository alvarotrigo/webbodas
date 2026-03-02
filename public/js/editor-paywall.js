/**
 * Editor Paywall Protection
 * Checks if user has paid access before allowing editor usage
 */

class EditorPaywall {
    constructor() {
        this.isChecking = false;
        this.hasAccess = false;
        this.userEmail = null;
    }

    /**
     * Check if user has paid access to the editor
     * @returns {Promise<boolean>}
     */
    async checkAccess() {
        if (this.isChecking) {
            console.log('Access check already in progress...');
            return this.hasAccess;
        }

        this.isChecking = true;

        try {
            // Check if user is authenticated
            const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
            const isPaid = localStorage.getItem('isPaid') === 'true';
            const userEmail = localStorage.getItem('userEmail');

            console.log('Paywall check:', { isAuthenticated, isPaid, userEmail });

            // If not authenticated, allow free access (editor has its own pro section restrictions)
            if (!isAuthenticated) {
                console.log('User not authenticated - allowing free access');
                this.hasAccess = true;
                this.isChecking = false;
                return true;
            }

            // If already marked as paid in localStorage, verify with server
            if (isPaid && userEmail) {
                console.log('User marked as paid, verifying with server...');
                const verified = await this.verifyPaidStatus(userEmail);
                this.hasAccess = verified;
                this.isChecking = false;
                return verified;
            }

            // User is authenticated but not paid - check server
            if (userEmail) {
                console.log('User authenticated but not paid, checking server...');
                const hasPaidAccess = await this.verifyPaidStatus(userEmail);
                this.hasAccess = hasPaidAccess;
                this.isChecking = false;
                return hasPaidAccess;
            }

            // Default: allow access (editor will handle pro sections)
            console.log('Default: allowing access');
            this.hasAccess = true;
            this.isChecking = false;
            return true;

        } catch (error) {
            console.error('Paywall check error:', error);
            // On error, allow access to avoid blocking users incorrectly
            this.hasAccess = true;
            this.isChecking = false;
            return true;
        }
    }

    /**
     * Verify paid status with server
     * @param {string} email
     * @returns {Promise<boolean>}
     */
    async verifyPaidStatus(email) {
        try {
            const response = await fetch('api/check-subscription.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email })
            });

            if (!response.ok) {
                console.warn('Failed to verify paid status');
                return false;
            }

            const result = await response.json();
            
            if (result.success && result.is_paid) {
                // Update localStorage with verified status
                localStorage.setItem('isPaid', 'true');
                localStorage.setItem('editorMode', 'paid');
                console.log('User has paid access:', result.subscription);
                return true;
            }

            console.log('User does not have paid access');
            return false;

        } catch (error) {
            console.error('Error verifying paid status:', error);
            return false;
        }
    }

    /**
     * Show paywall modal for authenticated users without paid access
     */
    showPaywallModal() {
        // Check if modal already exists
        if (document.getElementById('paywall-modal')) {
            return;
        }

        const modal = document.createElement('div');
        modal.id = 'paywall-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            backdrop-filter: blur(5px);
        `;

        modal.innerHTML = `
            <div style="
                background: white;
                border-radius: 16px;
                padding: 3rem;
                max-width: 500px;
                text-align: center;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            ">
                <div style="
                    width: 80px;
                    height: 80px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 1.5rem;
                ">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                </div>
                
                <h2 style="
                    font-size: 1.75rem;
                    font-weight: 700;
                    color: #2c3e50;
                    margin-bottom: 1rem;
                ">Upgrade to Pro</h2>
                
                <p style="
                    color: #6c757d;
                    line-height: 1.6;
                    margin-bottom: 2rem;
                    font-size: 1rem;
                ">
                    Get unlimited access to all premium features, pro sections, 
                    and advanced customization options.
                </p>
                
                <div style="margin-bottom: 2rem;">
                    <div style="
                        display: inline-block;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        padding: 0.5rem 1rem;
                        border-radius: 8px;
                        font-size: 2rem;
                        font-weight: 700;
                        margin-bottom: 0.5rem;
                    ">
                        $99<span style="font-size: 1rem; opacity: 0.9;">/month</span>
                    </div>
                    <div style="color: #6c757d; font-size: 0.875rem;">
                        3-day trial for $1
                    </div>
                </div>
                
                <button id="paywall-upgrade-btn" style="
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    color: white;
                    border: none;
                    padding: 1rem 2rem;
                    border-radius: 12px;
                    font-size: 1.1rem;
                    font-weight: 600;
                    cursor: pointer;
                    width: 100%;
                    margin-bottom: 1rem;
                    transition: transform 0.2s;
                ">
                    Upgrade Now →
                </button>
                
                <button id="paywall-close-btn" style="
                    background: transparent;
                    color: #6c757d;
                    border: none;
                    padding: 0.75rem;
                    font-size: 0.9rem;
                    cursor: pointer;
                    width: 100%;
                ">
                    Continue with Free Version
                </button>
            </div>
        `;

        document.body.appendChild(modal);

        // Add hover effect
        const upgradeBtn = document.getElementById('paywall-upgrade-btn');
        upgradeBtn.addEventListener('mouseenter', () => {
            upgradeBtn.style.transform = 'translateY(-2px)';
        });
        upgradeBtn.addEventListener('mouseleave', () => {
            upgradeBtn.style.transform = 'translateY(0)';
        });

        // Handle upgrade button click
        upgradeBtn.addEventListener('click', () => {
            window.location.href = '/subscribe';
        });

        // Handle close button click
        document.getElementById('paywall-close-btn').addEventListener('click', () => {
            modal.remove();
        });

        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    /**
     * Redirect to subscribe page
     */
    redirectToSubscribe() {
        const currentPath = window.location.pathname;
        const returnUrl = encodeURIComponent(currentPath);
        window.location.href = `/subscribe?return=${returnUrl}`;
    }
}

// Create global instance
window.editorPaywall = new EditorPaywall();

// Optional: Auto-check on page load
window.addEventListener('load', async () => {
    if (window.location.pathname.includes('editor')) {
        await window.editorPaywall.checkAccess();
    }
});

