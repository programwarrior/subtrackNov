# Backup and recovery

## Device backups

Settings → Download full backup exports versioned JSON with all record types and deleted metadata. Treat it as private financial information. CSV export is for inspection; it is not a complete restore format.

Restore first previews record counts. Merge adds unknown IDs and preserves differing existing records. Replacement requires typing REPLACE, downloads the current dataset, and retains removed records as tombstones. An empty backup cannot replace populated data. The app cannot prove the browser's downloaded file was moved to durable storage: verify it exists and keep an independent copy before destructive work.

Offline records and pending edits live in IndexedDB. Clearing site data, changing browsers, or uninstalling a web app may remove them. Synced records remain on the server; unsynced changes require a device backup to recover. Local and cloud workspaces are intentionally separate; export locally and merge after signing in to transfer data.

## Database backups — enable before production use

Use the hosting provider's automatic daily backups and an independent encrypted copy outside the public web root. Target at least 30 daily copies plus 12 monthly copies, adjusted to storage constraints. Include all `st_` tables, schema and migration version. Store configuration secrets separately in a secret manager; never in GitHub or public artifacts.

Before any migration, take a consistent transaction-based dump (for InnoDB, `mariadb-dump --single-transaction`) through an account-scoped credentials file or secret environment. Never put a password in shell arguments. Confirm the dump is nonempty, checksum it, and restore into a separate restricted database to verify readability and row counts.

## Recovery sequence

1. Pause API writes and preserve a fresh snapshot of the damaged state.
2. Restore the selected backup into a **new** database, keeping the original intact.
3. Verify tables, user ownership, record counts, payment histories, tombstones and change-log consistency.
4. Revoke restored login/recovery tokens before reopening access.
5. Test with a controlled account. Point the backend to the recovered database only after verification.
6. Clients may hold cursors newer than the recovered log. Export every device's unsynced state before resetting its local cloud cache; sign in to download the recovered account, then review/merge remaining local edits. Do not silently roll back device cursors or discard queues.
7. Keep the original database/dumps until the recovery is accepted.

Automated host backups and restoration drills have not yet been configured because API hosting access is still pending.
