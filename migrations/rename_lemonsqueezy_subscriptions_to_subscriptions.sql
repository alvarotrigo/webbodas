-- Migration: Rename lemonsqueezy_subscriptions to subscriptions
-- Date: 2025-01-XX
-- Description: Renames the lemonsqueezy_subscriptions table to just "subscriptions"
--               for simplicity and cleaner naming

-- Rename the table
ALTER TABLE lemonsqueezy_subscriptions RENAME TO subscriptions;

-- Rename indexes
ALTER INDEX IF EXISTS idx_lemonsqueezy_email_status RENAME TO idx_subscriptions_email_status;
ALTER INDEX IF EXISTS idx_lemonsqueezy_subscription_id RENAME TO idx_subscriptions_subscription_id;
ALTER INDEX IF EXISTS idx_lemonsqueezy_customer_id RENAME TO idx_subscriptions_customer_id;

-- Rename the trigger
ALTER TRIGGER update_lemonsqueezy_subscriptions_updated_at ON subscriptions
RENAME TO update_subscriptions_updated_at;

-- Update table comment
COMMENT ON TABLE subscriptions IS 'Stores LemonSqueezy subscription data received from webhooks';
COMMENT ON COLUMN subscriptions.status IS 'Subscription status: active, cancelled, expired, paused, past_due, etc.';
COMMENT ON COLUMN subscriptions.subscription_id IS 'Unique subscription ID from LemonSqueezy';

