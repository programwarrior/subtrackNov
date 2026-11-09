<?php
// Copy OUTSIDE the public web root as subtrack-config.php.
// Set SUBTRACK_CONFIG_FILE to its absolute path in your hosting environment.
// Never commit the populated file or place it in the GitHub Pages build.
return [
    'db_host' => 'localhost', // Confirm the provider's INTERNAL hostname.
    'db_port' => 3306,
    'db_name' => getenv('SUBTRACK_DB_NAME') ?: '',
    'db_user' => getenv('SUBTRACK_DB_USER') ?: '',
    'db_password' => getenv('SUBTRACK_DB_PASSWORD') ?: '',
    'db_ssl_ca' => getenv('SUBTRACK_DB_SSL_CA') ?: '', // Required for a remote TCP host.
    'allowed_origin' => 'https://programwarrior.github.io',
    'app_url' => 'https://programwarrior.github.io/subtrackNov/',
    'allow_registration' => false, // Enable deliberately after deploying HTTPS.
    'mail_from' => 'noreply@example.invalid', // Replace with a verified sender.
    'recovery_enabled' => false, // Enable only after testing hosting mail delivery.
    'rate_limit_secret' => getenv('SUBTRACK_RATE_LIMIT_SECRET') ?: '', // At least 32 random bytes.
];
