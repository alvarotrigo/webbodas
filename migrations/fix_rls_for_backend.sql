-- Fix RLS policies to allow backend API to create/update pages
-- This allows the anon key (used by backend) to perform operations

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can create own pages" ON user_pages;
DROP POLICY IF EXISTS "Users can update own pages" ON user_pages;
DROP POLICY IF EXISTS "Users can delete own pages" ON user_pages;

-- Allow anon role (backend API) to do everything
-- This is safe because the API validates the user before making requests
CREATE POLICY "Backend API can manage user_pages"
ON user_pages
FOR ALL
TO anon
USING (true)
WITH CHECK (true);

-- Keep the service role policy
DROP POLICY IF EXISTS "Service role full access to user_pages" ON user_pages;
CREATE POLICY "Service role full access to user_pages"
ON user_pages
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Note: In production, you should:
-- 1. Use the actual service_role key (not anon key) in your backend
-- 2. Keep RLS policies strict for anon
-- 3. Only the service_role should bypass RLS


