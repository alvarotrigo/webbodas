<?php
/**
 * Environment Variables Loader
 * Loads .env file variables using phpdotenv
 * This file should be required by any script that needs access to environment variables
 */

// Only load once
if (defined('ENV_LOADED')) {
    return;
}

$autoloadPath = __DIR__ . '/../vendor/autoload.php';

if (file_exists($autoloadPath)) {
    require_once $autoloadPath;

    // Try multiple .env locations to support different deployment scenarios
    $possiblePaths = [
        // Production: .env one level above project root (outside web root)
        // e.g., /home/yeslovey/.env when project is in /home/yeslovey/htdocs/yeslovey.com/
        __DIR__ . '/../../..',

        // Development/Standard: .env in project root
        // e.g., /Users/username/Sites/project/.env
        __DIR__ . '/..',
    ];

    $dotenvPath = null;
    $envFilePath = null;

    // Find the first valid .env file location
    foreach ($possiblePaths as $path) {
        $testPath = realpath($path) . '/.env';
        if (file_exists($testPath)) {
            $dotenvPath = realpath($path);
            $envFilePath = $testPath;
            break;
        }
    }

    if ($dotenvPath && $envFilePath) {
        try {
            // Use createUnsafeImmutable to also populate putenv() so getenv() works
            $dotenv = Dotenv\Dotenv::createUnsafeImmutable($dotenvPath);
            $dotenv->load();
            error_log("Successfully loaded .env from: $envFilePath");
        } catch (Exception $e) {
            error_log("Dotenv loading error: " . $e->getMessage());
            // In production, continue even if .env doesn't load (might use server env vars)
        }
    } else {
        // Log warning if .env file is missing (expected in some production setups)
        $searchedPaths = implode(', ', array_map(function($p) {
            return realpath($p) ?: $p;
        }, $possiblePaths));
        error_log("Warning: .env file not found in any of: $searchedPaths - using server environment variables");
    }
} else {
    error_log("Warning: Composer autoload not found at: $autoloadPath");
}

define('ENV_LOADED', true);
