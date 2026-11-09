<?php
// Test harness only. Never deploy this file. It simulates TLS termination locally.
if (getenv('SUBTRACK_TEST_MODE') !== '1') { http_response_code(404); exit; }
$_SERVER['HTTPS'] = 'on';
require __DIR__.'/../api/index.php';
