-- Migration: Add clerk_user_id to subscriptions table
-- Date: 2025-01-XX
-- Description: Adds clerk_user_id column to link subscriptions directly to users

-- Add clerk_user_id column to subscriptions table
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS clerk_user_id VARCHAR(255);

-- Create index for fast lookups by clerk_user_id
CREATE INDEX IF NOT EXISTS idx_subscriptions_clerk_user_id 
ON subscriptions(clerk_user_id);

-- Add comment
COMMENT ON COLUMN subscriptions.clerk_user_id IS 'Links subscription to user via clerk_user_id from users table';


