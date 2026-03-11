<?php
/**
 * MySQL Database Client
 * Drop-in replacement for SupabaseClient using local MySQL database
 * Provides same interface for easy migration
 */

require_once __DIR__ . '/database.php';

class MySQLClient {
    private $pdo;
    
    public function __construct() {
        $this->pdo = getDatabaseConnection();
    }
    
    /**
     * Insert data into a table
     * Returns array with inserted record(s) to match SupabaseClient interface
     */
    public function insert($table, $data) {
        try {
            // Generate UUID for tables that use UUIDs
            if (in_array($table, ['user_pages', 'editor_pages']) && !isset($data['id'])) {
                $data['id'] = $this->generateUUID();
            }
            
            // Generate UUID for share_token if needed
            if ($table === 'user_pages' && isset($data['is_public']) && $data['is_public'] && !isset($data['share_token'])) {
                $data['share_token'] = $this->generateUUID();
            }
            
            // Convert arrays/objects to JSON for JSON columns
            $data = $this->prepareDataForInsert($table, $data);
            
            $columns = array_keys($data);
            $placeholders = ':' . implode(', :', $columns);
            $columnsList = '`' . implode('`, `', $columns) . '`';
            
            $sql = "INSERT INTO `{$table}` ({$columnsList}) VALUES ({$placeholders})";
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute($data);
            
            // Return the inserted record (match SupabaseClient behavior)
            $id = $data['id'] ?? $this->pdo->lastInsertId();
            return $this->select($table, '*', ['id' => $id]);
            
        } catch (PDOException $e) {
            error_log("MySQL insert error: " . $e->getMessage());
            throw new Exception("Failed to insert into {$table}: " . $e->getMessage());
        }
    }
    
    /**
     * Update data in a table
     * Returns array with updated record(s) to match SupabaseClient interface
     */
    public function update($table, $data, $where) {
        try {
            // Convert arrays/objects to JSON for JSON columns
            $data = $this->prepareDataForUpdate($table, $data);
            
            // Build SET clause
            $setParts = [];
            foreach ($data as $key => $value) {
                $setParts[] = "`{$key}` = :{$key}";
            }
            $setClause = implode(', ', $setParts);
            
            // Build WHERE clause (adds where params into $data by reference)
            $whereClause = $this->buildWhereClause($where, $data);
            
            $sql = "UPDATE `{$table}` SET {$setClause} WHERE {$whereClause}";
            
            error_log("MySQL update query: " . $sql);
            error_log("MySQL update params: " . json_encode(array_map(function($v) {
                return is_string($v) && strlen($v) > 200 ? substr($v, 0, 50) . '...[truncated]' : $v;
            }, $data)));
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute($data);
            
            $rowCount = $stmt->rowCount();
            error_log("MySQL update affected rows: " . $rowCount);
            
            // Return updated record(s) (match SupabaseClient behavior)
            return $this->select($table, '*', $where);
            
        } catch (PDOException $e) {
            error_log("MySQL update error: " . $e->getMessage());
            error_log("MySQL update failed SQL: " . ($sql ?? 'N/A'));
            throw new Exception("Failed to update {$table}: " . $e->getMessage());
        }
    }
    
    /**
     * Select data from a table
     */
    public function select($table, $columns = '*', $where = []) {
        try {
            // Handle column selection
            if ($columns === '*') {
                $columnsList = '*';
            } else {
                $columnArray = array_map('trim', explode(',', $columns));
                $columnsList = '`' . implode('`, `', $columnArray) . '`';
            }
            
            $sql = "SELECT {$columnsList} FROM `{$table}`";
            
            // Build WHERE clause
            $params = [];
            if (!empty($where)) {
                // Extract order, limit, offset before building WHERE clause
                $order = $where['order'] ?? null;
                $limit = $where['limit'] ?? null;
                $offset = $where['offset'] ?? null;
                
                // Remove special keys from where for WHERE clause building
                $whereForClause = array_diff_key($where, array_flip(['order', 'limit', 'offset']));
                
                if (!empty($whereForClause)) {
                    $whereClause = $this->buildWhereClause($whereForClause, $params);
                    $sql .= " WHERE {$whereClause}";
                }
            }
            
            // Handle ORDER BY - use indexed column if possible to avoid memory issues
            // For large datasets, we'll try to use ORDER BY but catch memory errors
            if (isset($where['order'])) {
                $order = $where['order'];
                // Parse "column.desc" or "column.asc" format
                if (strpos($order, '.') !== false) {
                    list($col, $dir) = explode('.', $order);
                    // Use COALESCE to handle NULL values in ORDER BY to prevent memory issues
                    $sql .= " ORDER BY COALESCE(`{$col}`, '1970-01-01 00:00:00') " . strtoupper($dir);
                } else {
                    $sql .= " ORDER BY {$order}";
                }
            }
            
            // Handle LIMIT
            if (isset($where['limit'])) {
                $sql .= " LIMIT " . (int)$where['limit'];
            }
            
            // Handle OFFSET
            if (isset($where['offset'])) {
                $sql .= " OFFSET " . (int)$where['offset'];
            }
            
            // Add debug logging
            error_log("MySQL select query: " . $sql);
            error_log("MySQL select params: " . json_encode($params));
            
            try {
                $stmt = $this->pdo->prepare($sql);
                $stmt->execute($params);
                $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
            } catch (PDOException $e) {
                // If we get a memory error with ORDER BY, try without ORDER BY and sort in PHP
                if (strpos($e->getMessage(), 'sort memory') !== false && isset($where['order'])) {
                    error_log("MySQL sort memory error, retrying without ORDER BY and sorting in PHP");
                    // Remove ORDER BY from SQL
                    $sqlWithoutOrder = preg_replace('/\s+ORDER BY.*$/i', '', $sql);
                    $stmt = $this->pdo->prepare($sqlWithoutOrder);
                    $stmt->execute($params);
                    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
                    
                    // Sort in PHP
                    $order = $where['order'];
                    if (strpos($order, '.') !== false) {
                        list($col, $dir) = explode('.', $order);
                        usort($results, function($a, $b) use ($col, $dir) {
                            $valA = $a[$col] ?? null;
                            $valB = $b[$col] ?? null;
                            if ($dir === 'desc') {
                                return $valB <=> $valA;
                            } else {
                                return $valA <=> $valB;
                            }
                        });
                    }
                } else {
                    throw $e;
                }
            }
            
            error_log("MySQL select returned " . count($results) . " rows");
            
            // Decode JSON columns
            $decodedResults = $this->decodeJsonColumns($table, $results);
            
            // Optional: log first result keys for debugging (data may be missing when query selected specific columns only)
            // if (!empty($decodedResults)) {
            //     error_log("MySQL select first result keys: " . implode(', ', array_keys($decodedResults[0])));
            // }
            
            return $decodedResults;
            
        } catch (PDOException $e) {
            error_log("MySQL select error: " . $e->getMessage());
            error_log("MySQL select SQL: " . ($sql ?? 'N/A'));
            error_log("MySQL select params: " . json_encode($params ?? []));
            throw new Exception("Failed to select from {$table}: " . $e->getMessage());
        }
    }
    
    /**
     * Delete data from a table
     */
    public function delete($table, $where) {
        try {
            $params = [];
            $whereClause = $this->buildWhereClause($where, $params);
            
            $sql = "DELETE FROM `{$table}` WHERE {$whereClause}";
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute($params);
            
            return [];
            
        } catch (PDOException $e) {
            error_log("MySQL delete error: " . $e->getMessage());
            throw new Exception("Failed to delete from {$table}: " . $e->getMessage());
        }
    }
    
    /**
     * Build WHERE clause from conditions
     */
    private function buildWhereClause($where, &$params) {
        $conditions = [];
        $paramIndex = 0;
        
        foreach ($where as $key => $value) {
            // Skip special keys
            if (in_array($key, ['order', 'limit', 'offset'])) {
                continue;
            }
            
            if (is_array($value)) {
                // Handle operators like ['gt', 100] or ['in', [1,2,3]]
                $operator = $value[0] ?? 'eq';
                $rawVal = $value[1] ?? null;
                
                $paramName = "where_{$key}_{$paramIndex}";
                $paramIndex++;
                
                switch (strtolower($operator)) {
                    case 'eq':
                        $conditions[] = "`{$key}` = :{$paramName}";
                        $params[$paramName] = $rawVal;
                        break;
                    case 'gt':
                        $conditions[] = "`{$key}` > :{$paramName}";
                        $params[$paramName] = $rawVal;
                        break;
                    case 'gte':
                        $conditions[] = "`{$key}` >= :{$paramName}";
                        $params[$paramName] = $rawVal;
                        break;
                    case 'lt':
                        $conditions[] = "`{$key}` < :{$paramName}";
                        $params[$paramName] = $rawVal;
                        break;
                    case 'lte':
                        $conditions[] = "`{$key}` <= :{$paramName}";
                        $params[$paramName] = $rawVal;
                        break;
                    case 'neq':
                    case 'ne':
                        $conditions[] = "`{$key}` != :{$paramName}";
                        $params[$paramName] = $rawVal;
                        break;
                    case 'in':
                        if (is_array($rawVal)) {
                            $placeholders = [];
                            foreach ($rawVal as $i => $item) {
                                $placeholder = "{$paramName}_{$i}";
                                $placeholders[] = ":{$placeholder}";
                                $params[$placeholder] = $item;
                            }
                            $conditions[] = "`{$key}` IN (" . implode(', ', $placeholders) . ")";
                        }
                        break;
                    default:
                        // Default to equality
                        $conditions[] = "`{$key}` = :{$paramName}";
                        $params[$paramName] = $rawVal;
                }
            } else {
                // Simple equality
                $paramName = "where_{$key}_{$paramIndex}";
                $paramIndex++;
                $conditions[] = "`{$key}` = :{$paramName}";
                $params[$paramName] = $value;
            }
        }
        
        return implode(' AND ', $conditions);
    }
    
    /**
     * Prepare data for insert (convert JSON columns and booleans)
     */
    private function prepareDataForInsert($table, $data) {
        $jsonColumns = ['data']; // Columns that store JSON
        $booleanColumns = ['is_pro', 'is_favorite', 'is_public']; // Columns that store BOOLEAN
        $integerColumns = ['user_id', 'id']; // Columns that store BIGINT/INTEGER
        
        foreach ($jsonColumns as $col) {
            if (isset($data[$col])) {
                if (is_array($data[$col]) || is_object($data[$col])) {
                    $data[$col] = json_encode($data[$col]);
                }
            }
        }
        
        // Ensure boolean columns are always 0 or 1 for MySQL (never null/empty string)
        foreach ($booleanColumns as $col) {
            if (array_key_exists($col, $data)) {
                $v = $data[$col];
                if ($v === true || $v === 1 || $v === '1') {
                    $data[$col] = 1;
                } else {
                    $data[$col] = 0;
                }
            }
        }
        
        // Ensure integer columns are integers or null (never empty string)
        foreach ($integerColumns as $col) {
            if (array_key_exists($col, $data)) {
                $v = $data[$col];
                if ($v === '' || $v === null) {
                    // Keep null for nullable columns, but convert empty string to null
                    $data[$col] = null;
                } elseif (is_numeric($v)) {
                    $data[$col] = (int)$v;
                }
                // If not numeric and not empty/null, leave as-is (might be UUID string for id)
            }
        }
        
        return $data;
    }
    
    /**
     * Prepare data for update (convert JSON columns and booleans)
     */
    private function prepareDataForUpdate($table, $data) {
        return $this->prepareDataForInsert($table, $data);
    }
    
    /**
     * Decode JSON columns in results and format timestamps
     */
    private function decodeJsonColumns($table, $results) {
        $jsonColumns = ['data'];
        $timestampColumns = ['created_at', 'updated_at', 'last_accessed', 'renews_at', 'ends_at', 'trial_ends_at', 'last_login'];
        
        foreach ($results as &$row) {
            // Decode JSON columns
            foreach ($jsonColumns as $col) {
                if (isset($row[$col])) {
                    if (is_string($row[$col]) && !empty($row[$col])) {
                        $decoded = json_decode($row[$col], true);
                        if (json_last_error() === JSON_ERROR_NONE) {
                            $row[$col] = $decoded;
                        } else {
                            error_log("JSON decode error for {$table}.{$col}: " . json_last_error_msg());
                            // Keep original value if decode fails
                        }
                    } elseif ($row[$col] === null || $row[$col] === '') {
                        // Handle NULL or empty string - set to empty array for consistency
                        $row[$col] = [];
                        error_log("Warning: {$table}.{$col} is NULL or empty, setting to empty array");
                    }
                }
                // Column not in result set is OK when it wasn't selected (e.g. SELECT id FROM users)
            }
            
            // Format timestamp columns to ISO 8601 with UTC timezone (match Supabase format)
            foreach ($timestampColumns as $col) {
                if (isset($row[$col]) && $row[$col] !== null) {
                    // MySQL returns timestamps as 'Y-m-d H:i:s' format
                    // Convert to ISO 8601 format with UTC timezone: 'Y-m-d\TH:i:s.000\Z'
                    try {
                        $dt = new DateTime($row[$col], new DateTimeZone('UTC'));
                        $row[$col] = $dt->format('Y-m-d\TH:i:s.000\Z');
                    } catch (Exception $e) {
                        error_log("Failed to format timestamp {$col}: " . $e->getMessage());
                        // Keep original value if formatting fails
                    }
                }
            }
        }
        
        return $results;
    }
    
    /**
     * Generate UUID v4
     */
    private function generateUUID() {
        // Use MySQL UUID() function if available, otherwise generate in PHP
        try {
            $stmt = $this->pdo->query("SELECT UUID() as uuid");
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            return $result['uuid'] ?? $this->generateUUIDPHP();
        } catch (PDOException $e) {
            return $this->generateUUIDPHP();
        }
    }
    
    /**
     * Generate UUID v4 in PHP
     */
    private function generateUUIDPHP() {
        $data = random_bytes(16);
        $data[6] = chr(ord($data[6]) & 0x0f | 0x40); // Set version to 0100
        $data[8] = chr(ord($data[8]) & 0x3f | 0x80); // Set bits 6-7 to 10
        
        return sprintf(
            '%08s-%04s-%04s-%04s-%012s',
            bin2hex(substr($data, 0, 4)),
            bin2hex(substr($data, 4, 2)),
            bin2hex(substr($data, 6, 2)),
            bin2hex(substr($data, 8, 2)),
            bin2hex(substr($data, 10, 6))
        );
    }
}

/**
 * Get MySQL client instance (drop-in replacement for getSupabaseClient)
 */
function getMySQLClient() {
    return new MySQLClient();
}

