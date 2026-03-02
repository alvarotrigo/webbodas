<?php
require_once __DIR__ . '/config/env.php';
echo 'DB_LOCAL_USER: ' . (getenv('DB_LOCAL_USER') ?: '(vacío)') . "\n";
echo 'DB_LOCAL_PASS: ' . (getenv('DB_LOCAL_PASS') !== false ? '***' : '(vacío/false)') . "\n";