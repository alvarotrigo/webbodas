-- Migration: Create editor_pages table
-- Purpose: Store shared pages for anonymous users (public sharing)
-- Date: 2026-02-02
-- Note: This is separate from user_pages which is for authenticated users

-- Create editor_pages table
CREATE TABLE IF NOT EXISTS editor_pages (
    id VARCHAR(36) PRIMARY KEY,

    -- Full page state as JSON (same structure as localStorage)
    data JSON NOT NULL,

    -- Tracking
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_editor_pages_created_at (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Note: editor_pages is for anonymous/public sharing
-- user_pages is for authenticated users with full features like favorites, etc.
