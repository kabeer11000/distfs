# TODO - DistFS project

## Completed
- Created `public/`, `app/`, `config/`, `database/`, `vendor/`, `storage/`, `routes/` directories.
- Added `app/views/terminal.php` with updated template include path.
- Moved `index.php` to `public/index.php` and updated root `index.php` to redirect.
- Kept a shim `pages/terminal.php` that includes the new `app/views/terminal.php` for legacy includes.

## Next steps
1. Update public assets in `public/` (CSS/JS/images/uploads) and ensure path prefixes in views are correct.
2. Move any other UI pages from `pages/` to `app/views/` and add controllers in `app/controllers/` as needed.
3. Configure a proper routing entrypoint in `public/index.php` and a front-controller in `app/controllers/` if we switch to MVC-router pattern.
4. Integrate database connection using `config/config.php` and move `schema.sql` into `database/`.
5. Add Composer (`composer.json`) if you want to use dependencies and populate `vendor/`.
6. Add a simple health check route and a `README` section on how to run the app locally.

## Theme & styling
- Terminal theme variables now live in `public/css/terminal-theme.css` and are read by `templates/terminal_config.js`.
- Update colors in `terminal-theme.css` to customize the terminal or add theme classes (e.g., `.light`).

## Testing steps
- Start a dev server: `php -S localhost:8000 -t public`
- Navigate to `http://localhost:8000/` and expect the terminal app to load.
- Verify file uploads and commands work as expected.

Notes:
- Terminal prompt is centralized via `writePrompt()` in `templates/terminal_config.js` — this should be used everywhere to keep prompt consistent.

## Cleanups
- Remove `pages/` directory once all references are moved.
- Add `.gitignore` entries for `storage/` and `vendor/`.

*** End of TODO
