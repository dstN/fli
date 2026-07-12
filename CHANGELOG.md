# Changelog

All notable changes to this project will be documented in this file.

## [2.0.0] - 2026-07-13

### Added
- **Multi-Weight & Font Style Support**: Support importing multiple font weights (`300`, `400`, `500`, `600`, `700`, etc.) and italic variants in a single pass via interactive prompts or `--weight` CLI flag.
- **Hybrid Resolution Fallback Chain**: Multi-tier metadata resolution ensuring maximum uptime:
  1. Primary: Google Webfonts Helper API (`gwfh.mranftl.com`)
  2. Secondary: Google Fonts CSS2 Parser (`fonts.googleapis.com/css2`)
  3. Tertiary: Official Google Fonts Webfonts API v1 (`GOOGLE_FONTS_API_KEY`)
- **WebAssembly WOFF2 Format Derivation**: Async initialization (`woff2.init()`) of WebAssembly encoders inside `fonteditor-core` to convert TrueType binaries into WOFF2, WOFF, EOT, or SVG formats on the fly.
- **Automatic CSS Rollback Recovery**: Creates backup snapshots (`.fli-backup`) before modifying CSS and automatically restores original files if injection encounters an error.
- **Persistent Disk Caching**: 24-hour JSON cache stored under `~/.cache/fli/` with atomic write-then-rename persistence.
- **Parallel Downloading**: Zero-dependency concurrency queue (`pLimit(4)`) with exponential backoff and rate-limit (`HTTP 429`) retry handling.
- **Atomic File Operations**: Exclusive file creation (`flag: 'wx'`) preventing TOCTOU races and write-then-rename updates preventing partial/corrupted output files.
- **Cross-Platform Compatibility**: Fully verified cross-platform path resolution across Windows (`\`), macOS, and Linux (`/`).
- **Comprehensive Documentation**: Added detailed `DOCS.md` architectural reference and updated `README.md`.
- **Automated Maintenance CI/CD**: Added `.github/workflows/ci.yml` matrix testing and `.github/workflows/token-check.yml` automated monthly expiry reminder.

### Changed
- **Major Architecture Rewrite**: Refactored monolithic codebase into clean single-responsibility modules adhering to SRP across `src/cli/`, `src/resolvers/`, and `src/utils/`.
- **Separation of Concerns**: Extracted pure core business logic (`src/core.ts`) from CLI prompt wizards (`src/cli/prompts.ts`) and command-line argument parsing (`src/cli/args.ts`).
- **Target Runtime**: Updated TypeScript compile target and `tsup` configuration from `node18` to `node24`.

### Fixed
- Replaced dead Heroku endpoint (`google-webfonts-helper.herokuapp.com`) with official community mirror (`gwfh.mranftl.com`).
- Fixed `@import` detection regex to properly ignore block comments and handle `url()`, quotes, and `@layer` syntax.
- Fixed script injection vulnerability in `.github/workflows/release.yml` and switched issue creation from Python script to official `gh` CLI.

---

## [1.0.0] - 2026-05-15

- Initial release of `@dstn/fli` CLI tool.
