<?php
/**
 * Convert PostgreSQL SQL export to MySQL format
 */

$inputFile = __DIR__ . '/user_pages_rows.sql';
$outputFile = __DIR__ . '/user_pages_rows_mysql.sql';

if (!file_exists($inputFile)) {
    die("Input file not found: $inputFile\n");
}

echo "Reading input file...\n";
$content = file_get_contents($inputFile);

echo "Converting to MySQL format...\n";

// 1. Remove "public"." schema prefix
$content = preg_replace('/"public"\./i', '', $content);

// 2. Remove double quotes around table and column names in INSERT INTO statement
// Match: INSERT INTO "table" 
$content = preg_replace('/INSERT INTO "([^"]+)"/i', 'INSERT INTO $1', $content);
// Remove quotes from column names: ("id", "user_id", ...)
$content = preg_replace('/\("([^"]+)"/', '($1', $content);
$content = preg_replace('/, "([^"]+)"/', ', $1', $content);
$content = preg_replace('/"\)/', ')', $content);

// 3. Remove timezone from timestamps (+00, +01, etc.)
// Match timestamps in single quotes: '2025-11-10 16:26:31+00' or '2025-12-19 17:31:20.594029+00'
$content = preg_replace("/'(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?)\+\d{2}'/", "'$1'", $content);

// 4. Convert boolean strings to MySQL format
// 'true' -> 1, 'false' -> 0
// But only when they're standalone values, not inside JSON
// We need to be careful - match 'true' or 'false' followed by comma or closing paren
$content = preg_replace("/'true'(?=[,\)])/i", '1', $content);
$content = preg_replace("/'false'(?=[,\)])/i", '0', $content);

// 5. Convert null to NULL (uppercase) - but only standalone null, not in strings
$content = preg_replace("/(?<=[,\\(])\s*null\s*(?=[,\\)])/i", ' NULL ', $content);

// 6. Remove quotes from numeric user_id values
// Match: , '3' or ('3' where 3 is all digits
$content = preg_replace("/(, )'(\d+)'(?=,|\))/", '$1$2', $content);
$content = preg_replace("/\('(\d+)'(?=,|\))/", '($1', $content);

// Write output
file_put_contents($outputFile, $content);

echo "Conversion complete!\n";
echo "Output written to: $outputFile\n";
echo "File size: " . number_format(filesize($outputFile)) . " bytes\n";
