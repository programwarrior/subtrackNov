# Project state — 2026-11-09

## Architecture

- React 19 + Vite static frontend, relative asset paths for the GitHub Pages repository subpath.
- Integer minor-unit monetary values; date-only billing schedules with preserved month-end anchors.
- Separate subscription, payment, price-change and settings record types. Currency totals are not silently converted.
- IndexedDB database `subtrack-v1`, `accounts` object store. Local and authenticated workspaces are isolated. Development `?qa` uses a separate test workspace.
- Local changes persist atomically with a mutation queue. Web Locks prevent concurrent tab writes; BroadcastChannel updates other tabs.
- Optional PHP 8.2 API with PDO MySQL. MariaDB 11.8.9 was verified on the supplied hosting server using certificate-validated TLS; the hosted database was empty and remains unmodified by implementation/testing.
- Server records are user-scoped, versioned and backed by an incremental change log. Atomic action batches and idempotency keys protect payment/renewal consistency and retries. Conflicts require review.
- Session tokens are randomly generated, stored hashed on the server and expire after 30 days. Browser tokens are kept in sessionStorage. Password resets expire after 30 minutes, are single-use and revoke sessions.

## Implemented

Local subscription workflows, home summaries, monthly equivalents, histories, price changes, manual corrections, catalogue, import review, CSV export, full backups, safe merge and confirmed replacement, soft deletion/recovery, responsive forms, keyboard focus trap, offline app shell and update prompt.

Imports use PDF.js, ExcelJS, Papa Parse and Tesseract locally. OCR worker, engine and English language data are bundled with the static build. No financial document is uploaded to an external processor. Source files are not retained in the account. XLSX is supported; legacy XLS must be converted first.

## Validation evidence

- 24 automated frontend domain/import/sync tests initially passed.
- 22 PHP integration assertions passed against a separate local MySQL 8 test database: login, authorization, cross-user isolation, rejected empty snapshots, stale-write conflicts, atomic rollback, idempotent retries, bulk-delete safeguards, tombstones and token revocation.
- PHP 8.2 syntax validation passed; production build succeeded; npm audit reported zero known vulnerabilities after dependency updates.
- Browser: created isolated test subscription, marked paid, verified monthly/yearly totals and renewal/history; confirmed input focus remains stable; 390px viewport had no horizontal overflow and form inputs were 16px.
- Browser: imported one CSV and two images together; both image dates/amounts appeared correctly and changing prices grouped under one provider. Latest charge set renewal amount and anchor.
- Browser: exported a portable backup with 3 test subscriptions and 5 payments, previewed it, merged it without duplicating or losing records.

## Limits / not yet operational

- Live account login, recovery mail and cross-device sync await backend hosting and configuration. PHP integration tests are local, not proof of deployed Hostinger mail/runtime behavior.
- In-app reminder preferences only; no scheduled email, web push or background notifications.
- OCR is heuristic; English model handles common Latin-text receipts but extraction accuracy depends on layout. Mandatory review catches uncertain dates, names and amounts. Complex statement layouts may need CSV export/manual corrections.
- Device-size browser checks do not substitute for a physical iPhone keyboard test.
- Trash has no automatic purge yet (data remains recoverable beyond 30 days). Database backup automation must be enabled on the API host.
- Backup merge preserves existing differing records and reports them. It does not blindly overwrite. Confirmed replacement is limited to 400 records per atomic operation.
- Authentication UI is disabled when no API URL is supplied. No production account or sample data has been created.
