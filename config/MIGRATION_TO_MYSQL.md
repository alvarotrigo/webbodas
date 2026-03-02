# Migration Guide: Supabase → MySQL

## Why Migrate?

- **Faster**: 0ms latency vs 50-200ms network latency
- **More Reliable**: No "connection reset by peer" errors
- **Simpler**: Direct database connection, no API layer
- **Lower Cost**: No Supabase fees

## Step 1: Create the Database Schema

Run the MySQL schema file:

```bash
mysql -u your_username -p your_database < config/mysql-schema.sql
```

Or import via phpMyAdmin/MySQL Workbench.

## Step 1.5: Configure Database Connection

Edit `config/database.php` to set up your database connection.

### Option A: Local Database (Recommended for Development)

For local testing, create a local MySQL database:

1. Create a local database:
   ```bash
   mysql -u root -p
   CREATE DATABASE fpstudio;
   ```

2. Import the schema:
   ```bash
   mysql -u root -p fpstudio < config/mysql-schema.sql
   ```

3. Update `config/database.php`:
   ```php
   define('DB_ENV', 'local'); // Use local database
   ```

4. Configure local credentials in `config/database.php`:
   ```php
   define('DB_LOCAL_HOST', '127.0.0.1');
   define('DB_LOCAL_NAME', 'fpstudio');
   define('DB_LOCAL_USER', 'root');
   define('DB_LOCAL_PASS', 'your_local_password');
   ```

### Option B: Remote Database via SSH Tunnel (Like TablePlus)

For remote testing via SSH tunnel (similar to how TablePlus connects):

1. Set up SSH tunnel manually (or use TablePlus's built-in tunnel):
   ```bash
   ssh -L 3306:127.0.0.1:3306 -p 522 dbssh@95.216.154.45
   ```

2. Update `config/database.php`:
   ```php
   define('DB_ENV', 'remote'); // Use remote database via SSH tunnel
   ```

3. Configure remote credentials in `config/database.php`:
   ```php
   define('DB_REMOTE_HOST', '127.0.0.1'); // Localhost when using SSH tunnel
   define('DB_REMOTE_NAME', 'fpstudio');
   define('DB_REMOTE_USER', 'fpstudio');
   define('DB_REMOTE_PASS', 'your_remote_password');
   define('DB_REMOTE_PORT', 3306); // Local port where SSH tunnel forwards MySQL
   ```

**Note**: The SSH tunnel must be running before PHP tries to connect. TablePlus can set up the tunnel automatically, but for PHP you'll need to set it up manually or use a tool like `autossh` to keep it alive.

### Option C: Production Database

For production, configure production settings:

```php
define('DB_ENV', 'production');
// Configure DB_PROD_* constants in database.php
```

## Step 2: Update `api/pages.php`

Replace the Supabase client with MySQL client:

**Before:**
```php
require_once __DIR__ . '/../config/lemonsqueezy.php';
$supabase = new SupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
```

**After:**
```php
require_once __DIR__ . '/../config/mysql-client.php';
$supabase = getMySQLClient(); // Same variable name, different implementation
```

## Step 3: Update Other Files Using Supabase

Search for files that use `SupabaseClient` or `getSupabaseClient()`:

```bash
grep -r "SupabaseClient\|getSupabaseClient" --include="*.php" .
```

Replace with:
```php
require_once __DIR__ . '/../config/mysql-client.php';
$supabase = getMySQLClient();
```

## Step 4: Migrate Existing Data (Optional)

If you have existing data in Supabase, export and import:

### Export from Supabase:
```sql
-- Export users
COPY users TO STDOUT WITH CSV HEADER;

-- Export subscriptions  
COPY subscriptions TO STDOUT WITH CSV HEADER;

-- Export user_pages
COPY user_pages TO STDOUT WITH CSV HEADER;
```

### Import to MySQL:
```sql
-- Import users (adjust column order if needed)
LOAD DATA LOCAL INFILE 'users.csv' 
INTO TABLE users 
FIELDS TERMINATED BY ',' 
ENCLOSED BY '"' 
LINES TERMINATED BY '\n' 
IGNORE 1 ROWS;

-- Repeat for other tables
```

## Step 5: Test

1. Test creating a page
2. Test updating a page
3. Test listing pages
4. Test deleting a page
5. Check error logs for any issues

## Differences to Be Aware Of

### 1. UUIDs
- **Supabase**: Native UUID type
- **MySQL**: Stored as CHAR(36) strings
- **Impact**: None - handled automatically by MySQLClient

### 2. JSON Queries
- **Supabase**: Advanced JSONB queries with GIN indexes for fast path-based queries
- **MySQL**: JSON functions (JSON_EXTRACT, JSON_CONTAINS, etc.)
- **Impact**: **Negligible for our use case** - We store/retrieve entire JSON objects as blobs, never query inside JSON structures. MySQL handles this perfectly and is actually faster due to local access (0-5ms vs 50-200ms network latency).

### 3. Row Level Security (RLS)
- **Supabase**: Built-in RLS policies
- **MySQL**: Not available - implement in PHP application layer
- **Impact**: Your PHP code already handles authorization, so this is fine

### 4. Timestamps
- **Supabase**: TIMESTAMP WITH TIME ZONE
- **MySQL**: TIMESTAMP (range 1970-2038) or DATETIME
- **Impact**: None for most use cases

## Performance Comparison

Expected improvements:
- **Query latency**: 50-200ms → 0-5ms (40-200x faster)
- **Connection errors**: Eliminated
- **Throughput**: Higher (no network bottleneck)

## Rollback Plan

If you need to rollback:
1. Keep Supabase credentials in `.env`
2. Comment out MySQL client, uncomment Supabase client
3. Data remains in Supabase

## Notes

- The `MySQLClient` class provides the same interface as `SupabaseClient`
- All existing code should work without changes
- JSON columns are automatically encoded/decoded
- UUIDs are generated automatically

