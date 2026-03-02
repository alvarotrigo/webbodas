-- Migration: Drop clerk_lemonsqueezy_links table
-- Date: 2025-01-XX
-- Description: Removes the redundant clerk_lemonsqueezy_links table
--               The users table already stores clerk_user_id and subscription_id,
--               making this linking table unnecessary

-- Drop the table (this will also drop all associated indexes and policies)
DROP TABLE IF EXISTS clerk_lemonsqueezy_links CASCADE;

-- Add comment for documentation
COMMENT ON TABLE users IS 'Stores all logged-in users (paying and non-paying) with pro status. Links to subscriptions via subscription_id.';


