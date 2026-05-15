# CLAUDE Scope and Architecture

## Project Vision

`fli` is a CLI tool that ensures Google Webfonts are imported locally rather than through third-party CDNs. It is built for GDPR compliance and modern web frameworks.

## Strict Constraints

- No guessing of framework asset paths. The tool only uses official static directories as of April 2026.
- CSS injection must occur strictly below the last existing `@import` statement.
- The tool must support exact prompt flows, including automatic framework detection and manual selection.
- If the Google Webfonts Helper API does not provide a requested format, the package must generate it locally from a downloaded base font.
- The tool must create missing directories and the CSS file if needed.

## Framework Paths

- Next.js: `/public/fonts`
- Nuxt.js: `/public/fonts`
- Angular: `/src/assets/fonts`
- Vite: `/public/fonts`
- React: `/public/fonts`
- Vue: `/public/fonts`
- Vanilla/Other: `/public/fonts`

## Current Development State

- Repository initialized with documentation and project scaffolding.
- CLI architecture defined for prompt flow, font downloading, local conversion, and CSS injection.
- Package configuration and build tooling to be added.
- Source code implementation pending.
