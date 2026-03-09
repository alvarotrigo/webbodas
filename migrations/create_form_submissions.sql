-- Migration: RSVP — Form Submissions, Dashboard Access, Guest Groups & Table Assignment
-- Description: Full RSVP database setup for published wedding websites
-- Applies to: MySQL 5.7+ / MariaDB 10.3+
-- Run after: config/mysql-schema.sql  (creates user_pages and users tables)

-- ===================================
-- TABLE: form_submissions
-- Stores every RSVP response from a published wedding website.
-- form_data is a JSON blob with the dynamic fields submitted by the guest.
-- table_number and group_id support the seating-plan dashboard features.
-- ===================================

CREATE TABLE IF NOT EXISTS form_submissions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    page_id CHAR(36) NOT NULL,
    form_data JSON NOT NULL,
    notes TEXT DEFAULT NULL,
    table_number VARCHAR(20) DEFAULT NULL,
    group_id BIGINT UNSIGNED DEFAULT NULL,
    ip_address VARCHAR(45) DEFAULT NULL,
    user_agent VARCHAR(500) DEFAULT NULL,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_form_submissions_page_id (page_id),
    INDEX idx_form_submissions_submitted_at (page_id, submitted_at DESC),

    FOREIGN KEY (page_id) REFERENCES user_pages(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===================================
-- TABLE: dashboard_access_links
-- Private shareable tokens for collaborators (e.g. the couple's partner)
-- who need to view the dashboard without a Clerk account.
-- ===================================

CREATE TABLE IF NOT EXISTS dashboard_access_links (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    page_id CHAR(36) NOT NULL,
    access_token CHAR(36) UNIQUE NOT NULL,
    email VARCHAR(255) DEFAULT NULL,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL DEFAULT NULL,
    is_active BOOLEAN DEFAULT TRUE,

    INDEX idx_dashboard_access_page (page_id),
    INDEX idx_dashboard_access_token (access_token),

    FOREIGN KEY (page_id) REFERENCES user_pages(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===================================
-- TABLE: guest_groups
-- Custom group labels per page (e.g. "Bride's Family", "Work Friends").
-- Each group has a display color chosen by the owner.
-- ===================================

CREATE TABLE IF NOT EXISTS guest_groups (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    page_id CHAR(36) NOT NULL,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7) NOT NULL DEFAULT '#9333ea',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_guest_groups_page_id (page_id),

    FOREIGN KEY (page_id) REFERENCES user_pages(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===================================
-- ALTER: user_pages — add form control columns
-- ===================================
-- Compatible with MySQL 5.7+. If you re-run this migration and the columns
-- already exist, MySQL will throw "Duplicate column name"; you can ignore it.

ALTER TABLE user_pages
    ADD COLUMN form_open BOOLEAN DEFAULT TRUE,
    ADD COLUMN form_closed_message VARCHAR(500) DEFAULT NULL;

-- ===================================
-- ALTER: form_submissions — add table_number and group_id
-- ===================================
-- Only needed when upgrading an existing installation that was set up before
-- these columns existed. Safe to ignore "Duplicate column name" errors.

ALTER TABLE form_submissions
    ADD COLUMN table_number VARCHAR(20) DEFAULT NULL,
    ADD COLUMN group_id BIGINT UNSIGNED DEFAULT NULL;
