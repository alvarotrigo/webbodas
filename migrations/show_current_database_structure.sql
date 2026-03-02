-- Query to show current database structure
-- Run this in Supabase SQL Editor to see your current database schema
-- This version only queries tables that exist

-- Show all tables in public schema
SELECT 
    table_name,
    table_type
FROM 
    information_schema.tables
WHERE 
    table_schema = 'public'
ORDER BY 
    table_name;

-- Show users table structure (if exists)
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM 
    information_schema.columns
WHERE 
    table_schema = 'public'
    AND table_name = 'users'
ORDER BY 
    ordinal_position;

-- Show subscriptions table structure (if exists)
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM 
    information_schema.columns
WHERE 
    table_schema = 'public'
    AND table_name = 'subscriptions'
ORDER BY 
    ordinal_position;

-- Show editor_pages table structure (if exists)
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM 
    information_schema.columns
WHERE 
    table_schema = 'public'
    AND table_name = 'editor_pages'
ORDER BY 
    ordinal_position;

-- Show indexes on users table (if exists)
SELECT 
    indexname,
    indexdef
FROM 
    pg_indexes
WHERE 
    schemaname = 'public'
    AND tablename = 'users'
ORDER BY 
    indexname;

-- Show indexes on subscriptions table (if exists)
SELECT 
    indexname,
    indexdef
FROM 
    pg_indexes
WHERE 
    schemaname = 'public'
    AND tablename = 'subscriptions'
ORDER BY 
    indexname;

-- Show RLS policies on users table (if exists)
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM 
    pg_policies
WHERE 
    schemaname = 'public'
    AND tablename = 'users'
ORDER BY 
    policyname;

-- Show RLS policies on subscriptions table (if exists)
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM 
    pg_policies
WHERE 
    schemaname = 'public'
    AND tablename = 'subscriptions'
ORDER BY 
    policyname;

-- Count records (only for tables that exist)
DO $$
DECLARE
    table_count INTEGER;
BEGIN
    -- Check and count users table
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'users';
    
    IF table_count > 0 THEN
        RAISE NOTICE 'users table: % rows', (SELECT COUNT(*) FROM users);
    END IF;
    
    -- Check and count subscriptions table
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'subscriptions';
    
    IF table_count > 0 THEN
        RAISE NOTICE 'subscriptions table: % rows', (SELECT COUNT(*) FROM subscriptions);
    END IF;
    
    -- Check and count editor_pages table
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'editor_pages';
    
    IF table_count > 0 THEN
        RAISE NOTICE 'editor_pages table: % rows', (SELECT COUNT(*) FROM editor_pages);
    END IF;
END $$;

