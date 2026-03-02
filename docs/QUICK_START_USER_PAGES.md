# Quick Start: Add user_pages Table

**Ready to run?** Copy and paste this into your Supabase SQL Editor.

## 🚀 Run This in Supabase SQL Editor

```sql
-- ===================================
-- CREATE user_pages TABLE
-- ===================================

CREATE TABLE user_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL DEFAULT 'Untitled Page',
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    thumbnail_url TEXT,
    is_favorite BOOLEAN DEFAULT FALSE,
    is_public BOOLEAN DEFAULT FALSE,
    share_token UUID UNIQUE DEFAULT gen_random_uuid(),
    last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_user_pages_user_id ON user_pages(user_id);
CREATE INDEX idx_user_pages_user_last_accessed ON user_pages(user_id, last_accessed DESC);
CREATE INDEX idx_user_pages_share_token ON user_pages(share_token) WHERE is_public = TRUE;
CREATE INDEX idx_user_pages_favorites ON user_pages(user_id, is_favorite) WHERE is_favorite = TRUE;
CREATE INDEX idx_user_pages_data_theme ON user_pages USING gin ((data->'theme'));

-- Enable RLS
ALTER TABLE user_pages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own pages"
ON user_pages FOR SELECT
USING (
    user_id = (
        SELECT id FROM users 
        WHERE clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub'
    )
    OR is_public = TRUE
);

CREATE POLICY "Users can create own pages"
ON user_pages FOR INSERT
WITH CHECK (
    user_id = (
        SELECT id FROM users 
        WHERE clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub'
    )
);

CREATE POLICY "Users can update own pages"
ON user_pages FOR UPDATE
USING (
    user_id = (
        SELECT id FROM users 
        WHERE clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub'
    )
);

CREATE POLICY "Users can delete own pages"
ON user_pages FOR DELETE
USING (
    user_id = (
        SELECT id FROM users 
        WHERE clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub'
    )
);

CREATE POLICY "Service role full access to user_pages"
ON user_pages FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- Trigger
CREATE TRIGGER update_user_pages_updated_at
BEFORE UPDATE ON user_pages
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE user_pages IS 'User-owned page drafts (replaces localStorage)';
COMMENT ON COLUMN user_pages.data IS 'Full page state: sections, theme, animations, history';
```

## ✅ Verify It Worked

Run this to check:

```sql
-- Should return the new table
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'user_pages';

-- Should return 5 indexes
SELECT indexname FROM pg_indexes 
WHERE tablename = 'user_pages';

-- Should return 5 policies
SELECT policyname FROM pg_policies 
WHERE tablename = 'user_pages';
```

## 📖 What's Next?

1. ✅ Table created
2. 📄 Read: `docs/USER_PAGES_MIGRATION_GUIDE.md` for implementation details
3. 🔧 Create backend API endpoints (see guide)
4. 💻 Add JavaScript service layer (see guide)
5. 🎨 Add UI for page management

## 🎯 Purpose

This table replaces localStorage for authenticated users:
- ✅ No storage limits
- ✅ Multi-device access
- ✅ Auto-backup
- ✅ Built-in sharing
- ✅ History tracking

## 📊 Example Data

```json
{
  "sections": [...],
  "theme": {...},
  "fullpageEnabled": true,
  "animationsEnabled": true,
  "history": {...}
}
```

## 🔗 Related Files

- Full schema: `config/supabase-schema.sql`
- Migration file: `migrations/create_user_pages_table.sql`
- Implementation guide: `docs/USER_PAGES_MIGRATION_GUIDE.md`
- Database docs: `docs/DATABASE_STRUCTURE_CURRENT.md`


