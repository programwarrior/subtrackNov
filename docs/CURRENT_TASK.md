# Current task

## Completed locally
App implementation, domain/import/sync tests, isolated PHP integration tests, initial desktop/mobile browser QA, production build, and GitHub Pages workflows.

## In progress
Publishing the source and GitHub Pages frontend. User explicitly requested deployment on GitHub. The user signed into GitHub in the browser for Pages settings.

## After frontend deployment
1. Verify deployed subpath, install/offline cache, OCR bundle and update behavior.
2. Record final live URL and commit/build result in this file.

## Separate backend launch prerequisites
Obtain a PHP-hosted HTTPS endpoint and upload access (SFTP/SSH or hosting file manager). Confirm PHP 8.2+, PDO MySQL, hosting-local database address, mail sender/delivery and daily backup scheduling.

Before production schema work: make and verify a recoverable database backup even if empty; use a restricted application database user; store configuration outside web root; apply non-destructive schema manually. Never copy credentials from chat into source or public build files.

Then deploy only `api/index.php` and `.htaccess`, configure exact allowed origin, test HTTPS/auth/user isolation/recovery email/sync with two devices, set `SUBTRACK_API_URL`, rebuild Pages, and verify physically on iPhone.
