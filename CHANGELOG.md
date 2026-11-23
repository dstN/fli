# Changelog

All notable changes to this project will be documented in this file.

## [2.0.2] - 2026-11-23

### Changed
- `README.md`, `DOCS.md` and this changelog describe what the tool does in plain terms; bold labels on every bullet, dashes and marketing phrases are gone. No behaviour changed.

## [2.0.1] - 2026-07-13

### Changed
- The release workflow (`.github/workflows/release.yml`) publishes `@dstn/fli` through npm Trusted Publishing with OpenID Connect (OIDC, `id-token: write`) and a provenance attestation (`npm publish --provenance`), without a token.
- `README.md` and `DOCS.md` describe the Trusted Publishing setup; the old workflows that checked for expiring tokens are gone.

## [2.0.0] - 2026-07-13

### Added
- Import several font weights (`300`, `400`, `500`, `600`, `700`, etc.) and italic variants in one pass, via the prompts or the `--weight` flag.
- Font metadata comes from three sources, tried in order:
  1. Primary: Google Webfonts Helper API (`gwfh.mranftl.com`)
  2. Secondary: Google Fonts CSS2 Parser (`fonts.googleapis.com/css2`)
  3. Tertiary: Official Google Fonts Webfonts API v1 (`GOOGLE_FONTS_API_KEY`)
- `fonteditor-core` converts TrueType files to WOFF2, WOFF, EOT or SVG during the run; its WebAssembly encoders are initialized asynchronously (`woff2.init()`).
- A backup (`.fli-backup`) is written before the CSS is changed, and the original is restored if the injection fails.
- JSON disk cache under `~/.cache/fli/`, valid for 24 hours, written to a temp file and then renamed.
- Parallel downloads through a dependency-free queue (`pLimit(4)`), with exponential backoff and retries on rate limits (`HTTP 429`).
- Files are created exclusively (`flag: 'wx'`) to avoid TOCTOU races and updated by write-then-rename, so no partial or corrupted output remains.
- Path resolution tested on Windows (`\`), macOS and Linux (`/`).
- New `DOCS.md` with the architecture reference; `README.md` updated.
- `.github/workflows/ci.yml` runs a test matrix, and the release workflow now uses npm Trusted Publishing (OIDC) with a provenance attestation (`--provenance`) instead of a token.

### Changed
- The monolithic code is split into single-responsibility modules in `src/cli/`, `src/resolvers/` and `src/utils/`.
- The core logic (`src/core.ts`) is separate from the prompt wizard (`src/cli/prompts.ts`) and the argument parsing (`src/cli/args.ts`).
- TypeScript compile target and `tsup` configuration moved from `node18` to `node24`.

### Fixed
- Replaced dead Heroku endpoint (`google-webfonts-helper.herokuapp.com`) with official community mirror (`gwfh.mranftl.com`).
- Fixed `@import` detection regex to properly ignore block comments and handle `url()`, quotes, and `@layer` syntax.
- Fixed script injection vulnerability in `.github/workflows/release.yml` and switched issue creation from Python script to official `gh` CLI.

---

## [1.0.0] - 2026-05-15

- Initial release of `@dstn/fli` CLI tool.
