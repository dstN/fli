# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [1.0.0] - 2026-05-15

- Add TypeScript CLI implementation for interactive font importing
- Add framework detection and manual wrapper selection
- Add Google Webfonts Helper API fetching with local fallback conversions for missing formats
- Add framework-specific font output paths and CSS injection below last `@import`
- Add bundler configuration and build pipeline using `tsup`
- Replace vulnerable `ttf2*` converter packages with `fonteditor-core` font conversions to reduce critical transitive vulnerabilities
- Fix Google Webfonts Helper metadata lookup by normalizing font IDs and falling back to list-based font discovery
- Remove unsupported OTF generation and skip `otf` from supported/full format sets
- Limit supported wrapper detection and manual selection to Next.js, Nuxt.js, and Vite
