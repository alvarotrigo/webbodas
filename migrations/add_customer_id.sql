-- Migration: Add customer_id to lemonsqueezy_subscriptions table
-- Date: 2025-11-10
-- Description: Adds customer_id column to track LemonSqueezy customer IDs

-- Add customer_id column
ALTER TABLE lemonsqueezy_subscriptions 
ADD COLUMN IF NOT EXISTS customer_id VARCHAR(255);

-- Add index for fast lookups by customer_id
CREATE INDEX IF NOT EXISTS idx_lemonsqueezy_customer_id 
ON lemonsqueezy_subscriptions(customer_id);

-- Add comment for documentation
COMMENT ON COLUMN lemonsqueezy_subscriptions.customer_id IS 'LemonSqueezy customer ID - links multiple subscriptions to same customer';


