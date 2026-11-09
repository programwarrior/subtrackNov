# Subtrack

A calm, mobile-friendly subscription tracker. The frontend runs on GitHub Pages; the optional PHP API uses your existing MariaDB database. No Supabase and no database credentials in browser code.

## Run locally

```sh
npm ci
npm run dev
npm test
npm run build
```

Node.js 22 is recommended. The first installation includes local PDF, spreadsheet and OCR tools. `npm run build` produces a static `dist/` directory with an installable offline app.

## What works without a backend

- Subscription creation, editing, pause/resume/cancellation, search, combined filters and bulk selection.
- Monthly equivalents, separate currency totals, upcoming payments and mark-paid history.
- Manual historical charges, dated price changes and clearly marked estimates.
- Local review-first imports: PDF, XLSX, CSV/TSV, text and multiple images.
- IndexedDB persistence, backups, safe merge/confirmed restore, CSV export and recoverable trash.
- Responsive forms and a versioned service worker. No sample subscriptions are inserted.

Cloud accounts and cross-device synchronization require the API to be deployed separately. GitHub Pages cannot execute PHP or securely connect directly to MariaDB. The interface clearly indicates local-only operation when no API URL is configured.

## Deploy

1. Set repository **Settings → Pages → Source → GitHub Actions**.
2. Run **Actions → Deploy GitHub Pages → Run workflow**.
3. The frontend is published at `https://programwarrior.github.io/subtrackNov/`.
4. When a secure PHP host is available, follow [deployment instructions](docs/DEPLOYMENT.md). Set the repository variable `SUBTRACK_API_URL` to its public HTTPS `index.php` URL and redeploy. This is a public URL, never a database password.

See [project state](docs/PROJECT_STATE.md), [decisions](docs/DECISIONS.md), [current work](docs/CURRENT_TASK.md) and [backup recovery](docs/BACKUP_RECOVERY.md).
