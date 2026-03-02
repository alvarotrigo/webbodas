-- Migration: Create user_pages table
-- Purpose: Replace localStorage with database storage for authenticated users
-- Date: 2025-11-19

-- Create user_pages table
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

-- Create indexes for fast queries
CREATE INDEX idx_user_pages_user_id ON user_pages(user_id);
CREATE INDEX idx_user_pages_user_last_accessed ON user_pages(user_id, last_accessed DESC);
CREATE INDEX idx_user_pages_share_token ON user_pages(share_token) WHERE is_public = TRUE;
CREATE INDEX idx_user_pages_favorites ON user_pages(user_id, is_favorite) WHERE is_favorite = TRUE;

-- GIN index for JSONB queries (optional - enable if you need theme-based queries)
CREATE INDEX idx_user_pages_data_theme ON user_pages USING gin ((data->'theme'));

-- Enable Row Level Security
ALTER TABLE user_pages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
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

-- Create trigger for auto-updating updated_at
CREATE TRIGGER update_user_pages_updated_at
BEFORE UPDATE ON user_pages
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE user_pages IS 'Stores user-owned page drafts with full state (replaces localStorage)';
COMMENT ON COLUMN user_pages.data IS 'Full page state: {sections, theme, fullpageEnabled, animationsEnabled, history, etc.}';
COMMENT ON COLUMN user_pages.share_token IS 'Unique token for sharing public pages';
COMMENT ON COLUMN user_pages.user_id IS 'Foreign key linking to users table - owner of the page';


