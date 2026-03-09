-- Migration: Add share_slug to user_pages table
-- Description: Custom subdomain for published pages (e.g. nombrepropio.yeslovey.com)
-- Applies to: MySQL

ALTER TABLE user_pages
ADD COLUMN share_slug VARCHAR(64) UNIQUE NULL
COMMENT 'Custom subdomain for publish URL (slug.SHARE_BASE_DOMAIN)';

CREATE INDEX idx_user_pages_share_slug ON user_pages(share_slug);
