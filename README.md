# @dstn/fli — Fonts Local Importer CLI

[![GDPR Compliant](https://img.shields.io/badge/GDPR-100%25%20Compliant-success.svg)](#why-local-fonts)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/node-%3E%3D24-brightgreen.svg)](https://nodejs.org/)

`@dstn/fli` is a production-grade Node.js CLI tool that automatically downloads Google Webfonts locally into your web project and injects optimized `@font-face` CSS declarations.

Designed specifically for **GDPR compliance**, zero-layout-shift web performance, and modern framework architectures (**Next.js**, **Nuxt.js**, **Vite**, and **Vanilla CSS**).

---

## Why Local Fonts? (GDPR Compliance)

Loading web fonts directly from Google CDNs (`fonts.googleapis.com`) transmits your visitors' IP addresses to third-party servers. Under European GDPR privacy rulings (such as the Munich Regional Court ruling), linking external web fonts without explicit visitor consent violates privacy regulations.

`@dstn/fli` eliminates this risk completely by hosting Google Fonts directly from your own domain.

---

## Key Features

- **Interactive Terminal Wizard**: Beautiful CLI experience powered by `@clack/prompts`.
- **Framework Aware**: Automatically detects **Next.js**, **Nuxt.js**, and **Vite** from your `package.json` and targets official static asset directories (`public/fonts`, etc.).
- **Multi-Weight & Style Support**: Download and bundle multiple weights (`300`, `400`, `500`, `600`, `700`) and italic variants in one pass.
- **Atomic I/O & Rollback Recovery**: Never leaves corrupted or partial CSS files behind. Automatically restores original CSS files if an error occurs.
- **Hybrid API Fallback Chain**: Resolves font metadata reliably across three fallback layers:
  1. Google Webfonts Helper API (`gwfh.mranftl.com`)
  2. Google Fonts CSS2 Parser (`fonts.googleapis.com/css2`)
  3. Official Google Fonts Webfonts API v1 (`GOOGLE_FONTS_API_KEY`)
- **WebAssembly Format Derivation**: Missing WOFF2, WOFF, EOT, or SVG formats are automatically converted from source TrueType binaries using `fonteditor-core`.
- **CI / Non-Interactive Mode**: Fully scriptable flags (`--font`, `--format`, `--weight`, `--framework`, `--css`).

---

## Quickstart

Run `fli` directly in your project root using `npx`:

```bash
npx @dstn/fli
```

### Interactive Flow
1. **Font Families**: Enter comma-separated font names (e.g. `Inter, Roboto`).
2. **Formats**: Choose formats to bundle (`woff2` recommended for modern browsers, or `full` for legacy support).
3. **Weights**: Select weights (`300`, `400`, `700`, etc.).
4. **Framework**: Confirm auto-detected framework (`Next.js`, `Nuxt.js`, `Vite`, or `Vanilla`).
5. **CSS Target**: Confirm or customize target stylesheet path (`src/app/globals.css`, etc.).

---

## Non-Interactive & CI Usage

You can bypass prompts entirely by specifying command-line flags:

```bash
# Example: Download Inter (weights 400 & 700 in WOFF2) for a Next.js project
npx @dstn/fli \
  --font "Inter" \
  --weight "400,700" \
  --format woff2 \
  --framework next \
  --css src/app/globals.css
```

### Command-Line Flags

| Flag | Description | Default |
|---|---|---|
| `--font <names>` | Comma-separated font family names (`"Inter, Roboto"`) | Prompt |
| `--weight <weights>` | Comma-separated weights (`"400,700"`) | `400` |
| `--format <formats>` | Formats: `woff2`, `woff`, `ttf`, `eot`, `svg`, or `full` | `woff2` |
| `--framework <key>` | Framework target (`next`, `nuxt`, `vite`, `vanilla`) | Auto-detect |
| `--css <path>` | Target CSS stylesheet path | Framework default |
| `--dry-run` | Preview actions without modifying disk or CSS | `false` |
| `--verbose` | Emit structured per-step logs | `false` |
| `--version` | Print package version | — |
| `--help` | Display usage banner | — |

---

## Supported Framework Directories

| Framework | Static Asset Directory | Default CSS Target | Public URL Base |
|---|---|---|---|
| **Next.js** | `public/fonts` | `src/app/globals.css` | `/fonts` |
| **Nuxt.js** | `public/fonts` | `assets/css/main.css` | `/fonts` |
| **Vite** | `public/fonts` | `src/index.css` | `/fonts` |
| **Vanilla** | `public/fonts` | `styles.css` | `/fonts` |

---

## Automated Release & NPM Publishing Workflow

This repository includes fully automated CI/CD workflows for testing and publishing releases:

- **Continuous Integration (`.github/workflows/ci.yml`)**: Automatically runs type checking, linting, build verification, and test suites (`node24`) on every push and pull request.
- **Automated Releases (`.github/workflows/release.yml`)**: Triggered manually or on tag creation. It:
  1. Runs clean installation (`npm ci`), type checks, and full unit test verification (`npm test`).
  2. Resolves the release tag from input or `package.json` version and creates/pushes the git tag automatically.
  3. Extracts release notes from `CHANGELOG.md` and generates an official GitHub Release via the GitHub CLI (`gh`).
  4. Automatically publishes `@dstn/fli` to the **npm registry** when the `NPM_TOKEN` repository secret is configured (`npm publish --access public`).
- **NPM Token Expiry Guardian (`.github/workflows/token-check.yml`)**: NPM automation tokens expire after 90 days. This cron workflow runs monthly on the 1st of each month to verify token validity (`npm whoami`) and automatically opens a high-priority GitHub issue if the token needs renewal.

---

## Documentation & Deep Dive

Looking for detailed architectural diagrams, API fallback details, or troubleshooting guides?
Check out our **[Comprehensive Documentation Guide (DOCS.md)](DOCS.md)**.

---

## License

MIT © [dstN](https://github.com/dstN)
