# User Pages Migration Guide

**Date:** November 19, 2025  
**Purpose:** Migrate from localStorage to Supabase `user_pages` table

## 📋 Overview

This guide explains how to migrate from localStorage-based page storage to the new `user_pages` database table for authenticated users.

## 🎯 Benefits of Migration

### Before (localStorage):
- ❌ Storage quota limits (5-10MB)
- ❌ Single device only
- ❌ Lost on browser clear
- ❌ No backup/history
- ❌ Can't share with others
- ❌ No cross-tab sync

### After (Supabase):
- ✅ No storage limits
- ✅ Multi-device access
- ✅ Auto-backup & history
- ✅ Built-in sharing
- ✅ Real-time sync possible
- ✅ Pro feature differentiation

---

## 🗄️ Database Structure

### `user_pages` Table

```sql
CREATE TABLE user_pages (
    id UUID PRIMARY KEY,
    user_id BIGINT NOT NULL,      -- Links to users table
    title VARCHAR(255),            -- Page title
    data JSONB NOT NULL,           -- Full page state
    thumbnail_url TEXT,            -- Preview image
    is_favorite BOOLEAN,           -- Quick access
    is_public BOOLEAN,             -- Sharing flag
    share_token UUID,              -- Sharing URL
    last_accessed TIMESTAMP,       -- For sorting
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### `data` JSONB Structure

Keep the same structure as localStorage:

```json
{
  "sections": [
    {
      "id": "hero-1",
      "html": "...",
      "originalIndex": 0
    }
  ],
  "theme": {
    "name": "theme-light-minimal",
    "colors": {...}
  },
  "fullpageEnabled": true,
  "animationsEnabled": true,
  "selectedSections": [0, 1, 2],
  "history": {
    "stack": [],
    "index": -1
  }
}
```

---

## 🚀 Implementation Steps

### Step 1: Run Migration in Supabase

Go to your Supabase SQL Editor and run:

```sql
-- See: /migrations/create_user_pages_table.sql
```

Or copy the content from `migrations/create_user_pages_table.sql` and execute it.

### Step 2: Create Backend API Endpoints

Create these endpoints for page management:

#### `api/save-user-page.php`
```php
<?php
// Save or update a user's page
// POST: {user_id, title, data, page_id (optional)}
// Returns: {id, share_token}
```

#### `api/get-user-pages.php`
```php
<?php
// Get all pages for a user
// GET: ?user_id=123&limit=20
// Returns: [{id, title, last_accessed, is_favorite, thumbnail_url}]
```

#### `api/get-user-page.php`
```php
<?php
// Get a single page by ID
// GET: ?page_id=uuid&user_id=123
// Returns: {id, title, data, ...}
```

#### `api/delete-user-page.php`
```php
<?php
// Delete a user's page
// DELETE: {page_id, user_id}
// Returns: {success: true}
```

#### `api/share-user-page.php`
```php
<?php
// Make a page public and get share link
// POST: {page_id, user_id, is_public: true}
// Returns: {share_token, share_url}
```

### Step 3: Create JavaScript Service Layer

Create `public/js/user-pages-service.js`:

```javascript
class UserPagesService {
    constructor(userId) {
        this.userId = userId;
        this.currentPageId = null;
    }
    
    // Save current state to database
    async savePage(title, data) {
        const response = await fetch('/api/save-user-page.php', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                user_id: this.userId,
                page_id: this.currentPageId,
                title: title,
                data: data
            })
        });
        
        const result = await response.json();
        this.currentPageId = result.id;
        return result;
    }
    
    // Load a page by ID
    async loadPage(pageId) {
        const response = await fetch(`/api/get-user-page.php?page_id=${pageId}&user_id=${this.userId}`);
        const page = await response.json();
        this.currentPageId = pageId;
        return page;
    }
    
    // Get all user's pages
    async listPages(limit = 20) {
        const response = await fetch(`/api/get-user-pages.php?user_id=${this.userId}&limit=${limit}`);
        return await response.json();
    }
    
    // Delete a page
    async deletePage(pageId) {
        const response = await fetch('/api/delete-user-page.php', {
            method: 'DELETE',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                page_id: pageId,
                user_id: this.userId
            })
        });
        return await response.json();
    }
    
    // Share a page
    async sharePage(pageId) {
        const response = await fetch('/api/share-user-page.php', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                page_id: pageId,
                user_id: this.userId,
                is_public: true
            })
        });
        return await response.json();
    }
    
    // Auto-save (debounced)
    autoSave = this.debounce(async (title, data) => {
        try {
            await this.savePage(title, data);
            console.log('Auto-saved successfully');
        } catch (error) {
            console.error('Auto-save failed:', error);
        }
    }, 2000);
    
    // Utility: Debounce function
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }
}
```

### Step 4: Update Editor Integration

In `app.php`, integrate the service:

```javascript
// Initialize user pages service for authenticated users
let userPagesService = null;

if (isAuthenticated && currentUser) {
    // Get user's database ID from backend
    const userDbId = await getUserDatabaseId(currentUser.email);
    userPagesService = new UserPagesService(userDbId);
}

// Hook into save/autosave
function saveCurrentState() {
    const state = {
        sections: sections,
        theme: currentTheme,
        fullpageEnabled: fullpageEnabled,
        animationsEnabled: animationsEnabled,
        selectedSections: Array.from(selectedSections)
    };
    
    if (userPagesService) {
        // Save to database
        userPagesService.autoSave('My Page', state);
    } else {
        // Fall back to localStorage
        localStorage.setItem('fp_editor_draft', JSON.stringify(state));
    }
}
```

### Step 5: Add UI for Page Management

Create a "My Pages" modal:

```html
<div id="myPagesModal" class="modal">
    <div class="modal-content">
        <h2>My Pages</h2>
        <div id="pagesList">
            <!-- Populated dynamically -->
        </div>
        <button onclick="createNewPage()">New Page</button>
    </div>
</div>
```

```javascript
async function loadMyPages() {
    const pages = await userPagesService.listPages();
    
    const listHtml = pages.map(page => `
        <div class="page-item" data-id="${page.id}">
            <img src="${page.thumbnail_url || 'placeholder.svg'}" />
            <h3>${page.title}</h3>
            <p>Last accessed: ${formatDate(page.last_accessed)}</p>
            <button onclick="loadPage('${page.id}')">Open</button>
            <button onclick="sharePage('${page.id}')">Share</button>
            <button onclick="deletePage('${page.id}')">Delete</button>
        </div>
    `).join('');
    
    document.getElementById('pagesList').innerHTML = listHtml;
}
```

---

## 🔄 Migration Strategy

### Phase 1: Parallel Operation
1. Keep localStorage working
2. Add database save for authenticated users
3. Check database first, fall back to localStorage

### Phase 2: Gradual Migration
1. On user login, migrate localStorage data to database
2. Keep one "draft" in localStorage as backup
3. Primary storage is database

### Phase 3: Database Only
1. Remove localStorage persistence (keep only as temporary cache)
2. All authenticated users use database
3. Anonymous users continue using localStorage

---

## 📝 Example: Migration Helper

```javascript
async function migrateFromLocalStorage() {
    if (!userPagesService) return;
    
    // Get localStorage draft
    const draft = localStorage.getItem('fp_editor_draft');
    if (!draft) return;
    
    try {
        const data = JSON.parse(draft);
        
        // Save to database
        await userPagesService.savePage('Migrated Draft', data);
        
        console.log('Successfully migrated from localStorage to database');
        
        // Optionally clear localStorage
        // localStorage.removeItem('fp_editor_draft');
    } catch (error) {
        console.error('Migration failed:', error);
    }
}
```

---

## 🧪 Testing Checklist

- [ ] User can save a page to database
- [ ] User can load a saved page
- [ ] User can see list of all their pages
- [ ] User can delete a page
- [ ] User can share a page (get public URL)
- [ ] Auto-save works (debounced)
- [ ] Page thumbnails are generated
- [ ] Favorites work
- [ ] Multi-device sync works
- [ ] RLS policies prevent unauthorized access
- [ ] Anonymous users still work with localStorage

---

## 🔒 Security Considerations

1. **RLS Policies Active**: Users can only access their own pages
2. **Service Role**: Backend uses service role key for admin operations
3. **Share Tokens**: UUIDs are unguessable
4. **Cascade Delete**: Pages deleted when user deleted
5. **Input Validation**: Sanitize titles and validate data structure

---

## 📊 Monitoring

### Useful Queries:

```sql
-- Pages per user
SELECT u.email, COUNT(up.id) as page_count
FROM users u
LEFT JOIN user_pages up ON u.id = up.user_id
GROUP BY u.id, u.email
ORDER BY page_count DESC;

-- Most popular shared pages
SELECT title, (data->'sections') as sections_count
FROM user_pages
WHERE is_public = TRUE
ORDER BY last_accessed DESC
LIMIT 10;

-- Storage usage
SELECT 
    pg_size_pretty(pg_total_relation_size('user_pages')) as total_size,
    COUNT(*) as total_pages,
    AVG(pg_column_size(data)) as avg_data_size
FROM user_pages;
```

---

## 🚨 Rollback Plan

If you need to rollback:

```sql
-- Disable the table (don't drop yet)
ALTER TABLE user_pages DISABLE TRIGGER ALL;
DROP POLICY "Users can view own pages" ON user_pages;
DROP POLICY "Users can create own pages" ON user_pages;
DROP POLICY "Users can update own pages" ON user_pages;
DROP POLICY "Users can delete own pages" ON user_pages;

-- Re-enable localStorage in frontend
-- (revert code changes)

-- After confirming rollback works:
-- DROP TABLE user_pages;
```

---

## ✅ Success Criteria

- No localStorage quota errors
- Users can access pages from any device
- Auto-save works reliably
- Page load time < 500ms
- Share links work correctly
- RLS prevents unauthorized access


