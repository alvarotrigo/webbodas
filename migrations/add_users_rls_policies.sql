-- Migration: Add RLS Policies for users table
-- Date: 2025-11-10
-- Description: Enables Row Level Security and creates policies for users table

-- Enable Row Level Security (RLS) on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy 1: Service role can do everything
-- This allows backend operations (webhooks, auth handler) to read/write all user data
DROP POLICY IF EXISTS "Service role can do everything on users" ON users;
CREATE POLICY "Service role can do everything on users"
ON users
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Policy 2: Anon role can read all users (for frontend queries with service key)
-- This allows frontend to query user data when using service key
-- NOTE: If you want users to only read their own data, use Policy 3 instead
DROP POLICY IF EXISTS "Anon can read all users" ON users;
CREATE POLICY "Anon can read all users"
ON users
FOR SELECT
TO anon
USING (true);

-- Policy 3 (OPTIONAL): Users can only read their own data
-- Uncomment this if you want users to only see their own user record
-- This requires Clerk JWT to be passed to Supabase
-- DROP POLICY IF EXISTS "Users can read own data" ON users;
-- CREATE POLICY "Users can read own data"
-- ON users
-- FOR SELECT
-- TO authenticated
-- USING (auth.uid()::text = clerk_user_id);

-- Add comment for documentation
COMMENT ON TABLE users IS 'Stores all logged-in users (paying and non-paying) with pro status';
COMMENT ON COLUMN users.is_pro IS 'Boolean: Is user a pro user?';
COMMENT ON COLUMN users.pro_status_source IS 'Source of pro status: lemonsqueezy or legacy';


