-- Migration: Create subscriptions table
-- Date: 2025-01-XX
-- Description: Creates the subscriptions table for LemonSqueezy subscription data
-- Note: Assumes users table already exists with RLS policies

-- Subscriptions Table
-- Stores all subscription data from LemonSqueezy webhooks

CREATE TABLE IF NOT EXISTS subscriptions (
    id BIGSERIAL PRIMARY KEY,
    subscription_id VARCHAR(255) UNIQUE NOT NULL,
    customer_id VARCHAR(255),
    customer_email VARCHAR(255) NOT NULL,
    customer_name VARCHAR(255),
    product_id VARCHAR(255),
    product_name VARCHAR(255),
    variant_id VARCHAR(255),
    variant_name VARCHAR(255),
    status VARCHAR(50) NOT NULL,
    status_formatted VARCHAR(100),
    card_brand VARCHAR(50),
    card_last_four VARCHAR(4),
    renews_at TIMESTAMP WITH TIME ZONE,
    ends_at TIMESTAMP WITH TIME ZONE,
    trial_ends_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookups by email and status
CREATE INDEX IF NOT EXISTS idx_subscriptions_email_status 
ON subscriptions(customer_email, status);

-- Index for subscription_id lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_subscription_id 
ON subscriptions(subscription_id);

-- Index for customer_id lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer_id 
ON subscriptions(customer_id);

-- Enable Row Level Security (RLS)
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subscriptions
-- Allow service role to do everything
DROP POLICY IF EXISTS "Service role can do everything on subscriptions" ON subscriptions;
CREATE POLICY "Service role can do everything on subscriptions"
ON subscriptions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Allow anon role to read (for frontend queries with service key)
DROP POLICY IF EXISTS "Anon can read all subscriptions" ON subscriptions;
CREATE POLICY "Anon can read all subscriptions"
ON subscriptions
FOR SELECT
TO anon
USING (true);

-- Function to automatically update the updated_at timestamp (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at on subscriptions
DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
BEFORE UPDATE ON subscriptions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE subscriptions IS 'Stores LemonSqueezy subscription data received from webhooks';
COMMENT ON COLUMN subscriptions.status IS 'Subscription status: active, cancelled, expired, paused, past_due, etc.';
COMMENT ON COLUMN subscriptions.subscription_id IS 'Unique subscription ID from LemonSqueezy';
COMMENT ON COLUMN subscriptions.customer_id IS 'LemonSqueezy customer ID - links multiple subscriptions to same customer';


