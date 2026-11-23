# @dstn/fli: Fonts Local Importer CLI

[![GDPR Compliant](https://img.shields.io/badge/GDPR-100%25%20Compliant-success.svg)](#why-local-fonts)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/node-%3E%3D24-brightgreen.svg)](https://nodejs.org/)

`@dstn/fli` downloads Google Webfonts into your project and writes the matching `@font-face` CSS, so your pages serve fonts from your own domain instead of Google's.

It is built for GDPR compliance and works with Next.js, Nuxt.js, Vite and plain CSS projects.

---

## Why Local Fonts? (GDPR Compliance)

Loading web fonts directly from Google CDNs (`fonts.googleapis.com`) transmits your visitors' IP addresses to third-party servers. Under European GDPR privacy rulings (such as the Munich Regional Court ruling), linking external web fonts without explicit visitor consent violates privacy regulations.

With `@dstn/fli` the font files sit on your own domain, so no visitor request goes to Google.

---

## Features

- An interactive terminal wizard built on `@clack/prompts`.
- Detects Next.js, Nuxt.js and Vite from your `package.json` and writes to the framework's official static asset directory (`public/fonts`, etc.).
- Downloads several weights (`300`, `400`, `500`, `600`, `700`) and italic variants in one pass.
- Writes files atomically, so a failed run leaves no corrupted or partial CSS behind. If an error occurs, the original CSS files are restored.
- Looks up font metadata in three places, in this order:
  1. Google Webfonts Helper API (`gwfh.mranftl.com`)
  2. Google Fonts CSS2 Parser (`fonts.googleapis.com/css2`)
  3. Official Google Fonts Webfonts API v1 (`GOOGLE_FONTS_API_KEY`)
- If WOFF2, WOFF, EOT or SVG is missing, `fonteditor-core` (WebAssembly) converts it from the TrueType source.
- Every prompt has a flag (`--font`, `--format`, `--weight`, `--framework`, `--css`), so it runs in CI without interaction.

---

## Quickstart

Run `fli` directly in your project root using `npx`:

```bash
npx @dstn/fli
```

### Interactive Flow
1. Font families: enter comma-separated font names (e.g. `Inter, Roboto`).
2. Formats: `woff2` is enough for modern browsers, `full` adds the legacy formats.
3. Weights: select weights (`300`, `400`, `700`, etc.).
4. Framework: confirm the detected framework (`Next.js`, `Nuxt.js`, `Vite`, or `Vanilla`).
5. CSS target: confirm or change the stylesheet path (`src/app/globals.css`, etc.).

---

## Non-Interactive & CI Usage

With flags, `fli` asks nothing:

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
| `--version` | Print package version | |
| `--help` | Display usage banner | |

---

## Supported Framework Directories

| Framework | Static Asset Directory | Default CSS Target | Public URL Base |
|---|---|---|---|
| **Next.js** | `public/fonts` | `src/app/globals.css` | `/fonts` |
| **Nuxt.js** | `public/fonts` | `assets/css/main.css` | `/fonts` |
| **Vite** | `public/fonts` | `src/index.css` | `/fonts` |
| **Vanilla** | `public/fonts` | `styles.css` | `/fonts` |

---

## Release & npm Publishing

Two GitHub workflows test and publish the package.

`.github/workflows/ci.yml` runs type checking, linting, the build and the tests (`node24`) on every push to `master` and on pull requests against it.

`.github/workflows/release.yml` starts on a new tag or by hand. It:
  1. Installs with `npm ci`, type checks and runs the unit tests (`npm test`).
  2. Takes the release tag from the input or the `package.json` version and creates and pushes the git tag.
  3. Extracts the release notes from `CHANGELOG.md` and creates a GitHub Release with the GitHub CLI (`gh`).
  4. Publishes `@dstn/fli` to npm with provenance (`npm publish --provenance --access public`) through npm Trusted Publishing (OIDC), so no token or secret is stored.

---

## Documentation

Architecture diagrams, the API fallback details and troubleshooting are in [DOCS.md](DOCS.md).

---

## License

MIT © [dstN](https://github.com/dstN)
