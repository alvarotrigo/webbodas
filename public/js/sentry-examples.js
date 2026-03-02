/**
 * Sentry Integration Examples
 * 
 * This file contains example patterns for integrating Sentry logging
 * into your existing codebase. Use these patterns as a reference.
 * 
 * NOTE: This is an example file. Include the patterns in your actual code files.
 */

// ============================================================================
// EXAMPLE 1: Error Handling in API Calls
// ============================================================================

/**
 * Example: Fetch data from API with error tracking
 */
async function fetchDataWithTracking(endpoint) {
  // Add breadcrumb for debugging
  SentryLogger.addBreadcrumb('api', `Fetching ${endpoint}`, 'info', { endpoint });
  
  try {
    const response = await fetch(endpoint);
    
    if (!response.ok) {
      // Log warning for non-200 responses
      SentryLogger.warn(`API returned ${response.status}`, {
        endpoint,
        status: response.status,
        statusText: response.statusText
      });
      
      if (response.status >= 500) {
        // Critical for server errors
        SentryLogger.critical('Server error detected', new Error(`${response.status}: ${response.statusText}`), {
          endpoint,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    const data = await response.json();
    SentryLogger.info('API call successful', { endpoint, recordCount: data.length });
    return data;
    
  } catch (error) {
    // Log critical error with full context
    SentryLogger.error('Network request failed', error, {
      endpoint,
      errorMessage: error.message,
      errorType: error.name
    });
    throw error;
  }
}

// ============================================================================
// EXAMPLE 2: Save/Update Operations with Retry Logic
// ============================================================================

/**
 * Example: Save project with comprehensive error tracking
 */
async function saveProject(projectData, retryCount = 0) {
  const maxRetries = 3;
  
  try {
    SentryLogger.track('Save Initiated', {
      projectId: projectData.id,
      sectionCount: projectData.sections.length,
      attempt: retryCount + 1
    });
    
    const response = await fetch('/api/save.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(projectData)
    });
    
    if (!response.ok) {
      throw new Error(`Save failed with status ${response.status}`);
    }
    
    const result = await response.json();
    
    // Track successful save
    SentryLogger.info('Project saved successfully', {
      projectId: projectData.id,
      timestamp: new Date().toISOString()
    });
    
    SentryLogger.track('Save Completed', {
      projectId: projectData.id,
      duration: result.duration
    });
    
    return result;
    
  } catch (error) {
    if (retryCount < maxRetries) {
      // Log warning for retry attempt
      SentryLogger.warn('Save failed, retrying...', {
        projectId: projectData.id,
        attempt: retryCount + 1,
        maxRetries,
        error: error.message
      });
      
      // Retry with exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
      return saveProject(projectData, retryCount + 1);
      
    } else {
      // Critical error after all retries exhausted
      SentryLogger.critical('Save failed after all retries', error, {
        projectId: projectData.id,
        attempts: maxRetries + 1,
        hasUnsavedChanges: true,
        lastError: error.message
      });
      
      throw error;
    }
  }
}

// ============================================================================
// EXAMPLE 3: Image Upload with Progress Tracking
// ============================================================================

/**
 * Example: Upload image to Cloudinary with detailed tracking
 */
async function uploadImageWithTracking(file, options = {}) {
  const uploadId = `upload_${Date.now()}`;
  
  try {
    // Log upload start
    SentryLogger.info('Image upload started', {
      uploadId,
      filename: file.name,
      size: file.size,
      type: file.type
    });
    
    SentryLogger.track('Image Upload Started', {
      uploadId,
      fileSize: file.size,
      fileType: file.type
    });
    
    // Validate file
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      const error = new Error('File too large');
      SentryLogger.error('Image upload validation failed', error, {
        uploadId,
        fileSize: file.size,
        maxSize: 10 * 1024 * 1024,
        filename: file.name
      });
      throw error;
    }
    
    // Perform upload
    const result = await cloudinaryImageEditor.uploadImage(file, options);
    
    // Log success
    SentryLogger.info('Image upload completed', {
      uploadId,
      cloudinaryId: result.public_id,
      url: result.secure_url,
      duration: result.duration
    });
    
    SentryLogger.track('Image Upload Completed', {
      uploadId,
      cloudinaryId: result.public_id,
      size: file.size
    });
    
    return result;
    
  } catch (error) {
    // Log upload failure
    SentryLogger.error('Image upload failed', error, {
      uploadId,
      filename: file.name,
      size: file.size,
      errorMessage: error.message,
      options
    });
    
    throw error;
  }
}

// ============================================================================
// EXAMPLE 4: Theme Changes with Fallback
// ============================================================================

/**
 * Example: Change theme with error handling and fallback
 */
function changeThemeWithTracking(newTheme) {
  const oldTheme = document.body.className;
  
  try {
    SentryLogger.track('Theme Change Started', {
      from: oldTheme,
      to: newTheme,
      timestamp: new Date().toISOString()
    });
    
    // Apply new theme
    document.body.className = newTheme;
    localStorage.setItem('theme', newTheme);
    
    // Verify theme applied
    const appliedTheme = document.body.className;
    if (appliedTheme !== newTheme) {
      throw new Error('Theme not applied correctly');
    }
    
    SentryLogger.info('Theme changed successfully', {
      oldTheme,
      newTheme
    });
    
    SentryLogger.track('Theme Change Completed', { theme: newTheme });
    
  } catch (error) {
    // Log error and revert
    SentryLogger.error('Theme change failed, reverting', error, {
      attempted: newTheme,
      reverted: oldTheme
    });
    
    // Revert to old theme
    document.body.className = oldTheme;
    localStorage.setItem('theme', oldTheme);
  }
}

// ============================================================================
// EXAMPLE 5: Section Management
// ============================================================================

/**
 * Example: Add section with validation and tracking
 */
function addSectionWithTracking(sectionId, position) {
  try {
    SentryLogger.addBreadcrumb('ui-action', 'Add section button clicked', 'info', {
      sectionId,
      position
    });
    
    // Validate section ID
    if (!sectionId || typeof sectionId !== 'string') {
      throw new Error('Invalid section ID');
    }
    
    // Add section
    const section = createSection(sectionId);
    insertSectionAt(section, position);
    
    // Track success
    SentryLogger.track('Section Added', {
      sectionId,
      position,
      totalSections: document.querySelectorAll('.section').length
    });
    
    SentryLogger.info('Section added successfully', {
      sectionId,
      position
    });
    
  } catch (error) {
    SentryLogger.error('Failed to add section', error, {
      sectionId,
      position,
      currentSectionCount: document.querySelectorAll('.section').length
    });
    
    // Show user-friendly error
    alert('Failed to add section. Please try again.');
  }
}

/**
 * Example: Delete section with confirmation
 */
function deleteSectionWithTracking(sectionId) {
  try {
    SentryLogger.addBreadcrumb('ui-action', 'Delete section requested', 'info', {
      sectionId
    });
    
    const section = document.getElementById(sectionId);
    if (!section) {
      throw new Error('Section not found');
    }
    
    // Get section data before deletion for logging
    const sectionData = {
      id: sectionId,
      type: section.dataset.sectionType,
      position: Array.from(section.parentElement.children).indexOf(section)
    };
    
    // Delete section
    section.remove();
    
    // Track deletion
    SentryLogger.track('Section Deleted', sectionData);
    
    SentryLogger.info('Section deleted successfully', sectionData);
    
  } catch (error) {
    SentryLogger.error('Failed to delete section', error, {
      sectionId
    });
  }
}

// ============================================================================
// EXAMPLE 6: User Authentication Events
// ============================================================================

/**
 * Example: Track user authentication
 */
function handleUserAuthentication(user) {
  try {
    // Set user context in Sentry
    SentryLogger.setUser({
      id: user.id,
      email: user.primaryEmailAddress?.emailAddress,
      username: user.username || `${user.firstName} ${user.lastName}`
    });
    
    // Track login event
    SentryLogger.track('User Logged In', {
      userId: user.id,
      timestamp: new Date().toISOString()
    });
    
    SentryLogger.info('User authenticated', {
      userId: user.id,
      email: user.primaryEmailAddress?.emailAddress
    });
    
  } catch (error) {
    SentryLogger.error('Authentication tracking failed', error, {
      hasUser: !!user
    });
  }
}

/**
 * Example: Track user logout
 */
function handleUserLogout() {
  try {
    const userId = window.Clerk?.user?.id;
    
    // Track logout event before clearing user
    SentryLogger.track('User Logged Out', {
      userId,
      timestamp: new Date().toISOString()
    });
    
    // Clear user context
    SentryLogger.clearUser();
    
    SentryLogger.info('User logged out');
    
  } catch (error) {
    SentryLogger.error('Logout tracking failed', error);
  }
}

// ============================================================================
// EXAMPLE 7: Feature Usage Tracking
// ============================================================================

/**
 * Example: Track feature usage
 */
function trackFeatureUsage(featureName, details = {}) {
  SentryLogger.track(`Feature Used: ${featureName}`, {
    feature: featureName,
    timestamp: new Date().toISOString(),
    ...details
  });
}

// Usage examples:
// trackFeatureUsage('Image Editor', { action: 'crop', aspectRatio: '16:9' });
// trackFeatureUsage('Export', { format: 'html', sectionCount: 9 });
// trackFeatureUsage('Custom Theme', { colorScheme: 'dark', fontFamily: 'Inter' });

// ============================================================================
// EXAMPLE 8: Performance Monitoring
// ============================================================================

/**
 * Example: Track performance of operations
 */
async function performOperationWithTiming(operationName, operationFn) {
  const startTime = performance.now();
  
  try {
    SentryLogger.addBreadcrumb('performance', `${operationName} started`, 'info');
    
    const result = await operationFn();
    
    const duration = performance.now() - startTime;
    
    // Log if operation is slow
    if (duration > 3000) { // 3 seconds
      SentryLogger.warn(`Slow operation: ${operationName}`, {
        operation: operationName,
        duration: Math.round(duration),
        threshold: 3000
      });
    } else {
      SentryLogger.info(`${operationName} completed`, {
        duration: Math.round(duration)
      });
    }
    
    SentryLogger.track('Operation Completed', {
      operation: operationName,
      duration: Math.round(duration)
    });
    
    return result;
    
  } catch (error) {
    const duration = performance.now() - startTime;
    
    SentryLogger.error(`${operationName} failed`, error, {
      operation: operationName,
      duration: Math.round(duration)
    });
    
    throw error;
  }
}

// Usage example:
// await performOperationWithTiming('Generate Page', async () => {
//   return await generatePage(sections);
// });

// ============================================================================
// EXAMPLE 9: Network Status Monitoring
// ============================================================================

/**
 * Example: Monitor network status
 */
function initializeNetworkMonitoring() {
  window.addEventListener('online', () => {
    SentryLogger.info('Network connection restored');
    SentryLogger.track('Network Status Changed', { status: 'online' });
  });
  
  window.addEventListener('offline', () => {
    SentryLogger.warn('Network connection lost');
    SentryLogger.track('Network Status Changed', { status: 'offline' });
  });
}

// ============================================================================
// EXAMPLE 10: Form Validation Errors
// ============================================================================

/**
 * Example: Track form validation errors
 */
function validateFormWithTracking(formData) {
  const errors = [];
  
  try {
    SentryLogger.addBreadcrumb('validation', 'Form validation started', 'info', {
      formFields: Object.keys(formData).length
    });
    
    // Validate fields
    if (!formData.email || !formData.email.includes('@')) {
      errors.push('Invalid email');
    }
    
    if (!formData.name || formData.name.length < 2) {
      errors.push('Name too short');
    }
    
    if (errors.length > 0) {
      SentryLogger.warn('Form validation failed', {
        errors,
        fieldCount: Object.keys(formData).length,
        formType: 'contact'
      });
      
      return { valid: false, errors };
    }
    
    SentryLogger.info('Form validation successful');
    return { valid: true };
    
  } catch (error) {
    SentryLogger.error('Form validation error', error, {
      formData: Object.keys(formData)
    });
    return { valid: false, errors: ['Validation error occurred'] };
  }
}

// ============================================================================
// EXAMPLE 11: Critical State Changes
// ============================================================================

/**
 * Example: Track critical state changes
 */
function updateCriticalState(stateKey, newValue) {
  const oldValue = window.appState?.[stateKey];
  
  try {
    SentryLogger.addBreadcrumb('state-change', `Updating ${stateKey}`, 'info', {
      oldValue,
      newValue
    });
    
    // Update state
    window.appState = window.appState || {};
    window.appState[stateKey] = newValue;
    
    // Track critical changes
    if (['hasUnsavedChanges', 'isPublished', 'isPaid'].includes(stateKey)) {
      SentryLogger.track('Critical State Changed', {
        stateKey,
        oldValue,
        newValue,
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    SentryLogger.error('State update failed', error, {
      stateKey,
      attemptedValue: newValue
    });
  }
}

// ============================================================================
// HOW TO USE THESE PATTERNS
// ============================================================================

/*
1. Copy the pattern that matches your use case
2. Adapt it to your specific code
3. Ensure you're using appropriate log levels:
   - info() for normal operations
   - warn() for issues that don't break functionality
   - error() for caught exceptions
   - critical() for serious failures

4. Always include relevant context in your logs
5. Use track() for important user actions
6. Add breadcrumbs for debugging complex flows

Example integration in your existing code:

// Before:
async function uploadImage(file) {
  const result = await cloudinary.upload(file);
  return result;
}

// After:
async function uploadImage(file) {
  try {
    SentryLogger.info('Starting image upload', { filename: file.name, size: file.size });
    const result = await cloudinary.upload(file);
    SentryLogger.track('Image Uploaded', { cloudinaryId: result.public_id });
    return result;
  } catch (error) {
    SentryLogger.error('Image upload failed', error, { filename: file.name });
    throw error;
  }
}
*/

console.log('📚 Sentry integration examples loaded. Check the file for patterns.');




