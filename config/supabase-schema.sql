-- ===================================
-- COMPLETE DATABASE SCHEMA
-- Last Updated: 2025-11-19
-- ===================================

-- ===================================
-- TABLE: users
-- ===================================
-- Purpose: Stores all logged-in users (paying and non-paying) with pro status

CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    clerk_user_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    is_pro BOOLEAN DEFAULT FALSE,
    pro_status_source VARCHAR(50),
    subscription_id VARCHAR(255),
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for users table
CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_is_pro ON users(is_pro);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users
CREATE POLICY "Service role can do everything on users"
ON users
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Anon can read all users"
ON users
FOR SELECT
TO anon
USING (true);


-- ===================================
-- TABLE: subscriptions
-- ===================================
-- Purpose: Stores subscription data from LemonSqueezy webhooks

CREATE TABLE IF NOT EXISTS subscriptions (
    id BIGSERIAL PRIMARY KEY,
    subscription_id VARCHAR UNIQUE NOT NULL,
    user_id BIGINT REFERENCES users(id),
    customer_id VARCHAR,
    customer_email VARCHAR,
    customer_name VARCHAR,
    product_id VARCHAR,
    product_name VARCHAR,
    variant_id VARCHAR,
    variant_name VARCHAR,
    status VARCHAR,
    status_formatted VARCHAR,
    card_brand VARCHAR,
    card_last_four VARCHAR,
    renews_at TIMESTAMP WITH TIME ZONE,
    ends_at TIMESTAMP WITH TIME ZONE,
    trial_ends_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for subscriptions table
CREATE INDEX IF NOT EXISTS subscriptions_customer_id_idx ON subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON subscriptions(user_id);

-- Note: RLS is NOT currently enabled on subscriptions table
-- If you need to enable it, run:
-- ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
-- And add appropriate policies


-- ===================================
-- TABLE: editor_pages
-- ===================================
-- Purpose: Stores saved editor page data as JSON (anonymous/shared pages)

CREATE TABLE IF NOT EXISTS editor_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE editor_pages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for editor_pages
CREATE POLICY "public_select_editor_pages"
ON editor_pages
FOR SELECT
TO public
USING (true);

CREATE POLICY "public_insert_editor_pages"
ON editor_pages
FOR INSERT
TO public
WITH CHECK (true);


-- ===================================
-- TABLE: user_pages
-- ===================================
-- Purpose: Stores user-owned page drafts with full state (replaces localStorage)

CREATE TABLE IF NOT EXISTS user_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL DEFAULT 'Untitled Page',
    
    -- Full page state as JSONB (same structure as localStorage)
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Optional metadata for better UX
    thumbnail_url TEXT,
    is_favorite BOOLEAN DEFAULT FALSE,
    
    -- Sharing capabilities
    is_public BOOLEAN DEFAULT FALSE,
    share_token UUID UNIQUE DEFAULT gen_random_uuid(),
    
    -- Tracking
    last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for user_pages
CREATE INDEX IF NOT EXISTS idx_user_pages_user_id ON user_pages(user_id);
CREATE INDEX IF NOT EXISTS idx_user_pages_user_last_accessed ON user_pages(user_id, last_accessed DESC);
CREATE INDEX IF NOT EXISTS idx_user_pages_share_token ON user_pages(share_token) WHERE is_public = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_pages_favorites ON user_pages(user_id, is_favorite) WHERE is_favorite = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_pages_data_theme ON user_pages USING gin ((data->'theme'));

-- Enable Row Level Security (RLS)
ALTER TABLE user_pages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_pages
-- Users can view their own pages or public pages
CREATE POLICY "Users can view own pages"
ON user_pages
FOR SELECT
USING (
    user_id = (
        SELECT id FROM users 
        WHERE clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub'
    )
    OR is_public = TRUE
);

-- Users can insert their own pages
CREATE POLICY "Users can create own pages"
ON user_pages
FOR INSERT
WITH CHECK (
    user_id = (
        SELECT id FROM users 
        WHERE clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub'
    )
);

-- Users can update their own pages
CREATE POLICY "Users can update own pages"
ON user_pages
FOR UPDATE
USING (
    user_id = (
        SELECT id FROM users 
        WHERE clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub'
    )
);

-- Users can delete their own pages
CREATE POLICY "Users can delete own pages"
ON user_pages
FOR DELETE
USING (
    user_id = (
        SELECT id FROM users 
        WHERE clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub'
    )
);

-- Service role can do everything
CREATE POLICY "Service role full access to user_pages"
ON user_pages
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);


-- ===================================
-- FUNCTIONS
-- ===================================

-- Function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-updating updated_at on user_pages
CREATE TRIGGER update_user_pages_updated_at
BEFORE UPDATE ON user_pages
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Note: Triggers are NOT currently active on users and subscriptions tables
-- If you want to add triggers for auto-updating updated_at:
-- CREATE TRIGGER update_users_updated_at
-- BEFORE UPDATE ON users
-- FOR EACH ROW
-- EXECUTE FUNCTION update_updated_at_column();

-- CREATE TRIGGER update_subscriptions_updated_at
-- BEFORE UPDATE ON subscriptions
-- FOR EACH ROW
-- EXECUTE FUNCTION update_updated_at_column();


-- ===================================
-- COMMENTS FOR DOCUMENTATION
-- ===================================

COMMENT ON TABLE users IS 'Stores all logged-in users with Clerk authentication and pro status';
COMMENT ON TABLE subscriptions IS 'Stores LemonSqueezy subscription data received from webhooks';
COMMENT ON TABLE editor_pages IS 'Stores anonymous/shared editor page configurations as JSON';
COMMENT ON TABLE user_pages IS 'Stores user-owned page drafts with full state (replaces localStorage)';

COMMENT ON COLUMN users.clerk_user_id IS 'Unique Clerk user ID for authentication';
COMMENT ON COLUMN users.is_pro IS 'Boolean indicating if user has active pro subscription';
COMMENT ON COLUMN subscriptions.subscription_id IS 'Unique subscription ID from LemonSqueezy';
COMMENT ON COLUMN subscriptions.user_id IS 'Foreign key linking to users table';
COMMENT ON COLUMN subscriptions.status IS 'Subscription status: active, cancelled, expired, paused, past_due, etc.';
COMMENT ON COLUMN editor_pages.data IS 'JSONB data containing the complete editor page configuration';
COMMENT ON COLUMN user_pages.data IS 'Full page state: {sections, theme, fullpageEnabled, animationsEnabled, history, etc.}';
COMMENT ON COLUMN user_pages.share_token IS 'Unique token for sharing public pages';
COMMENT ON COLUMN user_pages.user_id IS 'Foreign key linking to users table - owner of the page';
