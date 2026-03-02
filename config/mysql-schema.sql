-- ===================================
-- MYSQL DATABASE SCHEMA
-- Migrated from Supabase PostgreSQL schema
-- Last Updated: 2025-12-29
-- ===================================

-- ===================================
-- TABLE: users
-- ===================================
-- Purpose: Stores all logged-in users (paying and non-paying) with pro status

CREATE TABLE IF NOT EXISTS users (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    clerk_user_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255) DEFAULT NULL,
    is_pro BOOLEAN DEFAULT FALSE,
    pro_status_source VARCHAR(50) DEFAULT NULL,
    subscription_id VARCHAR(255) DEFAULT NULL,
    last_login TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_users_clerk_id (clerk_user_id),
    INDEX idx_users_email (email),
    INDEX idx_users_is_pro (is_pro)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===================================
-- TABLE: subscriptions
-- ===================================
-- Purpose: Stores subscription data from LemonSqueezy webhooks

CREATE TABLE IF NOT EXISTS subscriptions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    subscription_id VARCHAR(255) UNIQUE NOT NULL,
    user_id BIGINT UNSIGNED DEFAULT NULL,
    customer_id VARCHAR(255) DEFAULT NULL,
    customer_email VARCHAR(255) DEFAULT NULL,
    customer_name VARCHAR(255) DEFAULT NULL,
    product_id VARCHAR(255) DEFAULT NULL,
    product_name VARCHAR(255) DEFAULT NULL,
    variant_id VARCHAR(255) DEFAULT NULL,
    variant_name VARCHAR(255) DEFAULT NULL,
    status VARCHAR(50) DEFAULT NULL,
    status_formatted VARCHAR(255) DEFAULT NULL,
    card_brand VARCHAR(50) DEFAULT NULL,
    card_last_four VARCHAR(4) DEFAULT NULL,
    renews_at TIMESTAMP NULL DEFAULT NULL,
    ends_at TIMESTAMP NULL DEFAULT NULL,
    trial_ends_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_subscriptions_customer_id (customer_id),
    INDEX idx_subscriptions_user_id (user_id),
    INDEX idx_subscriptions_status (status),
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===================================
-- TABLE: editor_pages
-- ===================================
-- Purpose: Stores saved editor page data as JSON (anonymous/shared pages)

CREATE TABLE IF NOT EXISTS editor_pages (
    id CHAR(36) PRIMARY KEY, -- UUID stored as CHAR(36)
    data JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===================================
-- TABLE: user_pages
-- ===================================
-- Purpose: Stores user-owned page drafts with full state (replaces localStorage)

CREATE TABLE IF NOT EXISTS user_pages (
    id CHAR(36) PRIMARY KEY, -- UUID stored as CHAR(36)
    user_id BIGINT UNSIGNED NOT NULL,
    title VARCHAR(255) NOT NULL DEFAULT 'Untitled Page',
    
    -- Full page state as JSON (same structure as localStorage)
    data JSON NOT NULL,
    
    -- Optional metadata for better UX
    thumbnail_url TEXT DEFAULT NULL,
    is_favorite BOOLEAN DEFAULT FALSE,
    
    -- Sharing capabilities
    is_public BOOLEAN DEFAULT FALSE,
    share_token CHAR(36) UNIQUE DEFAULT NULL, -- UUID stored as CHAR(36)
    
    -- Tracking
    last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_user_pages_user_id (user_id),
    INDEX idx_user_pages_user_last_accessed (user_id, last_accessed DESC),
    INDEX idx_user_pages_share_token (share_token),
    INDEX idx_user_pages_favorites (user_id, is_favorite),
    INDEX idx_user_pages_public (is_public, share_token),
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===================================
-- HELPER FUNCTIONS
-- ===================================

-- Function to generate UUID (MySQL 8.0+)
-- For older MySQL versions, use UUID() function directly in INSERT statements
-- Example: INSERT INTO user_pages (id, ...) VALUES (UUID(), ...)

-- ===================================
-- COMMENTS FOR DOCUMENTATION
-- ===================================

ALTER TABLE users COMMENT = 'Stores all logged-in users with Clerk authentication and pro status';
ALTER TABLE subscriptions COMMENT = 'Stores LemonSqueezy subscription data received from webhooks';
ALTER TABLE editor_pages COMMENT = 'Stores anonymous/shared editor page configurations as JSON';
ALTER TABLE user_pages COMMENT = 'Stores user-owned page drafts with full state (replaces localStorage)';

-- ===================================
-- NOTES
-- ===================================
-- 
-- 1. UUIDs: MySQL doesn't have native UUID type, so we use CHAR(36) to store UUID strings
--    Use UUID() function or generate UUIDs in PHP: bin2hex(random_bytes(16))
-- 
-- 2. JSON: MySQL 5.7+ supports JSON type with JSON functions:
--    - JSON_EXTRACT(data, '$.theme')
--    - JSON_CONTAINS(data, '"theme-light-minimal"', '$.theme')
--    - JSON_SET, JSON_REMOVE, etc.
--
-- 3. Timestamps: MySQL TIMESTAMP has range 1970-2038, use DATETIME if you need wider range
--
-- 4. Row Level Security: Not available in MySQL, implement in PHP application layer
--
-- 5. Foreign Keys: InnoDB engine required for foreign key constraints
--
-- 6. Character Set: utf8mb4 recommended for full Unicode support (emojis, etc.)

