-- Migration: Add published_data and has_unpublished_changes to user_pages
-- Description: Separates the working draft (data) from the publicly visible version (published_data).
--              When a published page is saved, published_data is not touched; the user must
--              explicitly press "Publish Changes" to push the draft to the live site.
-- Applies to: MySQL

ALTER TABLE user_pages
ADD COLUMN published_data LONGTEXT NULL
    COMMENT 'Last content explicitly published by the user. NULL means use data as fallback (backward compat).',
ADD COLUMN has_unpublished_changes TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '1 when data differs from published_data and the page is public. Reset to 0 on publish.';

CREATE INDEX idx_user_pages_unpublished ON user_pages(has_unpublished_changes);
