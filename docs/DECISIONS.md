# Decisions

1. **GitHub Pages frontend, separate PHP backend.** Explicit user hosting preference; Pages is static. PHP is a practical candidate for existing shared hosting, pending runtime/deployment access confirmation. Do not expose database administration to make deployment work.
2. **Existing MariaDB, no Supabase.** The supplied Hostinger hostname resolved to the provided IP; MariaDB 11.8.9 and verified TLS authentication succeeded. The earlier server timed out on common database ports.
3. **Local-first without pretending to sync.** The app is useful immediately without an API. It plainly labels local storage and keeps account workspaces separate. A fresh sign-in only downloads changes and cannot replace an account with an empty snapshot.
4. **Action batches instead of snapshots.** Every record has an expected server version; writes are serialized per user. Record creation and payment advancement occur in one database transaction. Retrying a batch returns the original acknowledgement.
5. **No last-write-wins conflict loss.** Keep both versions, pause synchronization and ask the user which whole action to retain. Export before resolution. Tombstones remain available for recovery.
6. **Calendar arithmetic and integer amounts.** Preserve Jan 31 through February and back to Mar 31. Use currency-specific minor units. Weekly normalization uses 52/12; custom day intervals use 365.2425/12. One-time purchases are excluded from recurring totals.
7. **Actual charges versus estimates.** No estimated gaps for imported histories. Confirmed charges and dated price changes determine renewal amounts; estimates do not. Import never silently substitutes today for missing dates.
8. **Local document processing.** Bundle OCR assets with the site, process PDFs/spreadsheets/images on-device, and require review. No external AI processor or financial document uploads.
9. **No invented catalogue prices.** Offer names/categories/websites/plan suggestions; users enter current regional prices.
10. **Manual initial Pages deployment.** Keep checks separate from deployment. The user explicitly requested GitHub deployment; future deployment is available through the named workflow. Credentials are never GitHub build variables.
