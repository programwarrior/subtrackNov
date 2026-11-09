# Deployment

## Static interface on GitHub Pages

No new hosting subscription is needed for the public repository's static frontend. GitHub Actions builds only `dist/`; API code, tests, database configuration and backups are not part of that artifact.

Select **Settings → Pages → GitHub Actions**, then run **Deploy GitHub Pages**. `SUBTRACK_API_URL` is optional; unset means local-only mode. Never create a `VITE_` variable containing a private credential. HTTPS is supplied by GitHub for its `github.io` address. No custom DNS is required for this frontend.

## PHP API on existing hosting

The app requires PHP 8.2+, PDO MySQL, HTTPS, InnoDB transactions, and a reliable email transport for recovery. Confirm the hosting plan includes PHP execution and scheduled backups; database access alone does not establish these capabilities. Existing shared hosting may avoid an additional hosting charge, subject to its actual plan; no paid service has been purchased.

An existing hosted HTTPS URL plus `/subtrack-api/index.php` is sufficient; a new domain is not mandatory. Alternatively, create an `api` subdomain on an owned domain, point it to the PHP host and enable its managed TLS certificate. No database port should be added to public DNS or opened broadly for this app.

1. Back up the hosted database and verify it can be restored (see recovery document).
2. Use a dedicated app user with SELECT, INSERT, UPDATE and DELETE on this database. Use a separate administrative identity only for schema deployment.
3. Apply `api/schema.sql` using the host's database administration tool. It creates namespaced `st_` tables without dropping data.
4. Place a filled copy of `api/config.example.php` **outside public_html**, for example the account's private config directory. File permissions should allow only the hosting user to read it.
5. Set `SUBTRACK_CONFIG_FILE` to that absolute path using the host's environment configuration. Fill database values through a secret manager/environment. A hosting-local connection is preferred. For remote DB connections, configure the provider's trusted CA and matching DNS hostname; certificate verification is mandatory.
6. Upload only `api/index.php` and `api/.htaccess` into the public API directory. Ensure Authorization headers reach PHP and HTTPS is reported correctly by the trusted hosting frontend. Do not enable a broad forwarded-header trust bypass.
7. Set `allowed_origin` to `https://programwarrior.github.io` (origin has no path), `app_url` to the full Pages URL, and a random rate-limit secret of at least 32 bytes.
8. Explicitly enable registration after verification. Configure a verified email sender and test recovery email before setting `recovery_enabled=true`. PHP `mail()` delegates to the hosting mail transport; successful enqueue is not proof of delivery.
9. Check `?route=health`. Test account registration/login, recovery, two-device edits, stale-write conflicts, logout and cross-account isolation.
10. Set GitHub repository variable `SUBTRACK_API_URL` to the API HTTPS endpoint, then run the Pages deployment workflow.

Operational work: runtime/security updates, TLS renewal monitoring, daily encrypted off-host backups, periodic restore drills, mail delivery monitoring and removal of expired sessions/rate-limit rows. Do not truncate changes or batch acknowledgements without implementing a cursor-resync protocol first.

## Local backend tests

`tests/backend.integration.mjs` requires `SUBTRACK_TEST_API=http://127.0.0.1:<port>` and refuses non-loopback URLs. The test router requires `SUBTRACK_TEST_MODE=1` and simulates HTTPS only for the isolated local test server. Never deploy the test router.

Initialize a separate disposable MySQL/MariaDB instance, load the schema, point a private test config to it, enable registration, then run PHP's local development server with the test router. No production credentials or database are involved.
