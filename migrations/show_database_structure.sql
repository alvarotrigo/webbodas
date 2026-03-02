-- Query to show current database structure
-- Run this in Supabase SQL Editor to see your current database schema

-- Show all tables
SELECT 
    table_name,
    table_type
FROM 
    information_schema.tables
WHERE 
    table_schema = 'public'
    AND table_name IN ('users', 'subscriptions')
ORDER BY 
    table_name;

-- Show users table structure
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

-- Show subscriptions table structure
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

-- Show indexes on users table
SELECT 
    indexname,
    indexdef
FROM 
    pg_indexes
WHERE 
    schemaname = 'public'
    AND tablename = 'users';

-- Show indexes on subscriptions table
SELECT 
    indexname,
    indexdef
FROM 
    pg_indexes
WHERE 
    schemaname = 'public'
    AND tablename = 'subscriptions';

-- Show RLS policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM 
    pg_policies
WHERE 
    schemaname = 'public'
    AND tablename IN ('users', 'subscriptions')
ORDER BY 
    tablename, policyname;

-- Count records in each table
SELECT 
    'users' as table_name,
    COUNT(*) as record_count
FROM 
    users
UNION ALL
SELECT 
    'subscriptions' as table_name,
    COUNT(*) as record_count
FROM 
    subscriptions;


