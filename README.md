# fli

Fonts Local Importer CLI

`fli` is a production-ready Node.js CLI tool for downloading Google Fonts locally and injecting the corresponding `@font-face` rules into a project CSS file. It is designed for GDPR-compliant font delivery, modern TypeScript architecture, and framework-aware static asset placement.

## Features

- Prompt-driven CLI wizard with polished UX using `@clack/prompts`
- Supports multiple font families in one run
- Supports `ttf`, `woff2`, `woff`, `eot`, and `svg` (OTF generation is intentionally skipped)
- Fonts are stored in `public/fonts` and served from `/fonts/` for supported frameworks
- Automatically detects Vite, Next.js, and Nuxt.js from `package.json`
- Places font files in framework-specific static asset directories
- Injects generated `@font-face` rules below the last `@import` in the target CSS file
- Creates the target CSS file if it does not exist
- Bundled with `tsup` for a compact, distributable CLI

## Usage

Install locally or run via `npx` from the project root:

```bash
npx fli
```

Answer the prompt sequence:

1. Name of font you want to import (comma separated)
2. Which formats? `ttf`, `woff2`, `woff`, `eot`, `svg`, or `full` (full excludes `otf`)
3. Which wrapper are you using? Detect automatically or manual selection
4. CSS file path to inject into

## CLI Flow

The CLI will:

- detect your framework from `package.json` when possible
- download fonts from the Google Webfonts Helper API
- convert missing formats locally when the API does not provide them
- save fonts under the correct static directory for your framework
- inject `@font-face` rules into the provided CSS file

## Supported Frameworks

- Next.js
- Nuxt.js
- Vite

## Release Workflow

This repository includes a GitHub Actions release workflow at `.github/workflows/release.yml`. It:

- runs `npm ci` and `npm test`
- resolves the release tag from the workflow input or `package.json` version
- creates and pushes a git tag when needed
- generates a GitHub release from `CHANGELOG.md`
- publishes `@dstn/fli` to npm when `NPM_TOKEN` is configured

NPM automation tokens expire after 90 days. If the workflow fails during `npm whoami` or `npm publish`, regenerate the token at https://www.npmjs.com/settings/tokens and update the `NPM_TOKEN` secret in GitHub repository settings.

## Project Structure

- `src/` - TypeScript source files
- `dist/` - Bundled CLI output
- `tsup.config.ts` - Build configuration
- `package.json` - CLI package manifest

## License

MIT
