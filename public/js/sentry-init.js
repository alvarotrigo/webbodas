/**
 * Sentry Error Tracking and Logging Configuration
 * Initializes Sentry with proper error handling, user context, and logging utilities
 */

(function() {
  'use strict';

  // Initialize Sentry
  function initSentry() {
    if (typeof Sentry === 'undefined' || typeof Sentry.init !== 'function') {
      console.warn('⏳ Sentry SDK not loaded yet, retrying...');
      setTimeout(initSentry, 100);
      return;
    }

    try {
      console.log('🔧 Initializing Sentry...');
      
      // Initialize Sentry with full configuration
      Sentry.init({
        dsn: "https://f951eddd3032a06509aef351e98d5972@o4510974504402944.ingest.de.sentry.io/4510975658557520",
        
        // Enable logs to be sent to Sentry
        enableLogs: true,

        // Environment
        environment: window.location.hostname === 'localhost' ? 'development' : 'production',
        
        // Performance Monitoring / Tracing
        tracesSampleRate: 1.0, // Capture 100% of transactions
        
        // Send user IP and other PII
        sendDefaultPii: true,
        
        // Enable debug mode in development
        debug: window.location.hostname === 'localhost',
        
        // Breadcrumb settings
        maxBreadcrumbs: 100,
        
        // Attach stack traces to all captured messages
        attachStacktrace: true,
      });
      
      // Set tags
      Sentry.setTag('environment', window.location.hostname === 'localhost' ? 'development' : 'production');
      Sentry.setTag('page', window.location.pathname);
    
      // Add browser context
      Sentry.setContext('browser', {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        viewport: `${window.innerWidth}x${window.innerHeight}`
      });
      
      // Add initial breadcrumb
      Sentry.addBreadcrumb({
        message: 'Sentry initialized',
        level: 'info'
      });
      
      console.log('✅ Sentry initialized successfully');
      console.log('📊 Environment:', window.location.hostname === 'localhost' ? 'development' : 'production');
      console.log('🎯 Tracing enabled: 100%');
      console.log('📄 Page:', window.location.pathname);

      // Set up user context from Clerk (if available)
      window.addEventListener('clerk:loaded', function() {
        if (window.Clerk && window.Clerk.user) {
          const user = window.Clerk.user;
          Sentry.setUser({
            id: user.id,
            email: user.primaryEmailAddress?.emailAddress,
            username: user.username || user.firstName + ' ' + user.lastName
          });
          console.log('✅ Sentry user context set from Clerk');
        }
      });

      // Also try to set user context immediately if Clerk is already loaded
      if (window.Clerk?.user) {
        const user = window.Clerk.user;
        Sentry.setUser({
          id: user.id,
          email: user.primaryEmailAddress?.emailAddress,
          username: user.username || user.firstName + ' ' + user.lastName
        });
      }

      // Global error handler with additional context
      window.addEventListener('error', function(event) {
        Sentry.addBreadcrumb({
          category: 'error',
          message: event.message,
          level: 'error',
          data: {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno
          }
        });
      });

      // Unhandled promise rejection handler
      window.addEventListener('unhandledrejection', function(event) {
        Sentry.captureException(event.reason, {
          tags: {
            type: 'unhandled-promise-rejection'
          }
        });
        
        Sentry.addBreadcrumb({
          category: 'promise',
          message: 'Unhandled Promise Rejection',
          level: 'error',
          data: {
            reason: event.reason
          }
        });
      });

      // Add breadcrumb for page visibility changes
      document.addEventListener('visibilitychange', function() {
        Sentry.addBreadcrumb({
          category: 'navigation',
          message: `Page visibility: ${document.hidden ? 'hidden' : 'visible'}`,
          level: 'info'
        });
      });

      // Add breadcrumb for network status changes
      window.addEventListener('online', function() {
        Sentry.addBreadcrumb({
          category: 'network',
          message: 'Connection restored',
          level: 'info'
        });
      });

      window.addEventListener('offline', function() {
        Sentry.addBreadcrumb({
          category: 'network',
          message: 'Connection lost',
          level: 'warning'
        });
      });

    } catch (error) {
      console.error('Failed to initialize Sentry:', error);
    }
  }

  // Start initialization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSentry);
  } else {
    initSentry();
  }

  // Create logging utilities
  window.SentryLogger = {
    /**
     * Log an informational message
     */
    info: function(message, context) {
      console.log('[INFO]', message, context);
      if (typeof Sentry !== 'undefined') {
        Sentry.addBreadcrumb({
          category: 'log',
          message: message,
          level: 'info',
          data: context
        });
      }
    },

    /**
     * Log a warning
     */
    warn: function(message, context) {
      console.warn('[WARN]', message, context);
      if (typeof Sentry !== 'undefined') {
        Sentry.addBreadcrumb({
          category: 'log',
          message: message,
          level: 'warning',
          data: context
        });
        Sentry.captureMessage(message, {
          level: 'warning',
          contexts: { details: context }
        });
      }
    },

    /**
     * Log an error
     */
    error: function(message, error, context) {
      console.error('[ERROR]', message, error, context);
      if (typeof Sentry !== 'undefined') {
        Sentry.addBreadcrumb({
          category: 'log',
          message: message,
          level: 'error',
          data: context
        });
        
        if (error instanceof Error) {
          Sentry.captureException(error, {
            contexts: { details: context },
            tags: { custom_message: message }
          });
        } else {
          Sentry.captureMessage(message, {
            level: 'error',
            contexts: { details: context, error: error }
          });
        }
      }
    },

    /**
     * Log a critical error that requires immediate attention
     */
    critical: function(message, error, context) {
      console.error('[CRITICAL]', message, error, context);
      if (typeof Sentry !== 'undefined') {
        Sentry.addBreadcrumb({
          category: 'log',
          message: message,
          level: 'fatal',
          data: context
        });
        
        if (error instanceof Error) {
          Sentry.captureException(error, {
            level: 'fatal',
            contexts: { details: context },
            tags: { 
              custom_message: message,
              severity: 'critical'
            }
          });
        } else {
          Sentry.captureMessage(message, {
            level: 'fatal',
            contexts: { details: context, error: error },
            tags: { severity: 'critical' }
          });
        }
      }
    },

    /**
     * Track a custom event or user action
     */
    track: function(eventName, data) {
      console.log('[TRACK]', eventName, data);
      if (typeof Sentry !== 'undefined') {
        Sentry.addBreadcrumb({
          category: 'user-action',
          message: eventName,
          level: 'info',
          data: data
        });
      }
    },

    /**
     * Set user context
     */
    setUser: function(userData) {
      if (typeof Sentry !== 'undefined') {
        Sentry.setUser(userData);
        console.log('✅ Sentry user context updated', userData);
      }
    },

    /**
     * Clear user context (e.g., on logout)
     */
    clearUser: function() {
      if (typeof Sentry !== 'undefined') {
        Sentry.setUser(null);
        console.log('✅ Sentry user context cleared');
      }
    },

    /**
     * Add custom context
     */
    setContext: function(key, data) {
      if (typeof Sentry !== 'undefined') {
        Sentry.setContext(key, data);
      }
    },

    /**
     * Add a breadcrumb manually
     */
    addBreadcrumb: function(category, message, level, data) {
      if (typeof Sentry !== 'undefined') {
        Sentry.addBreadcrumb({
          category: category || 'custom',
          message: message,
          level: level || 'info',
          data: data
        });
      }
    }
  };

  // Expose Sentry globally for debugging
  window.SentryDebug = {
    /**
     * Test Sentry error tracking
     */
    testError: function() {
      try {
        throw new Error('Test error from Sentry integration');
      } catch (e) {
        window.SentryLogger.error('Test error triggered manually', e, {
          test: true,
          timestamp: new Date().toISOString()
        });
      }
      console.log('✅ Test error sent to Sentry. Check your Sentry dashboard.');
    },

    /**
     * Test critical error
     */
    testCritical: function() {
      window.SentryLogger.critical('Test critical error', new Error('Critical test error'), {
        test: true,
        impact: 'high',
        timestamp: new Date().toISOString()
      });
      console.log('✅ Test critical error sent to Sentry. Check your Sentry dashboard.');
    },

    /**
     * Show current Sentry configuration
     */
    showConfig: function() {
      console.log('Sentry Status:', {
        loaded: typeof Sentry !== 'undefined',
        environment: window.location.hostname === 'localhost' ? 'development' : 'production',
        page: window.location.pathname,
        user: window.Clerk?.user ? {
          id: window.Clerk.user.id,
          email: window.Clerk.user.primaryEmailAddress?.emailAddress
        } : 'Not authenticated'
      });
    }
  };

  console.log('📊 Sentry logging utilities loaded. Use SentryLogger for logging and SentryDebug for testing.');
})();

