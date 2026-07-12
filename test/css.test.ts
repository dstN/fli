import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { ensureCssFile, injectFontFaceRules, fontFaceExistsInCss } from '../src/css.js';
import type { FontAsset } from '../src/fonts.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

let tempDir: string;

beforeEach(async () => {
	tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fli-css-'));
});

afterEach(async () => {
	await fs.rm(tempDir, { recursive: true, force: true });
});

const makeAsset = (family: string, format: 'woff2' | 'woff' = 'woff2'): FontAsset => ({
	family,
	normalizedFamily: family.toLowerCase().replace(/\s+/g, '-'),
	format,
	fileName: `${family.toLowerCase().replace(/\s+/g, '-')}-regular.${format}`,
	publicUrl: `/fonts/${family.toLowerCase().replace(/\s+/g, '-')}-regular.${format}`,
	savedPath: path.join(tempDir, `${family.toLowerCase().replace(/\s+/g, '-')}-regular.${format}`),
	fontWeight: 400,
	fontStyle: 'normal',
});

const writeAndInject = async (initialContent: string, assets: FontAsset[]) => {
	const cssPath = path.join(tempDir, 'styles.css');
	await fs.writeFile(cssPath, initialContent, 'utf8');
	const result = await injectFontFaceRules(cssPath, assets);
	const output = await fs.readFile(cssPath, 'utf8');
	return { cssPath, output, result };
};

// ---------------------------------------------------------------------------
// ensureCssFile
// ---------------------------------------------------------------------------

describe('ensureCssFile', () => {
	it('creates a CSS file and intermediate directories when they do not exist', async () => {
		const cssPath = path.join(tempDir, 'nested', 'styles', 'globals.css');
		await ensureCssFile(cssPath);

		const exists = await fs
			.stat(cssPath)
			.then(() => true)
			.catch(() => false);
		expect(exists).toBe(true);
	});

	it('does not overwrite an existing CSS file', async () => {
		const cssPath = path.join(tempDir, 'existing.css');
		await fs.writeFile(cssPath, '/* existing */', 'utf8');
		await ensureCssFile(cssPath);

		const content = await fs.readFile(cssPath, 'utf8');
		expect(content).toBe('/* existing */');
	});

	it('is idempotent — calling twice does not throw', async () => {
		const cssPath = path.join(tempDir, 'idempotent.css');
		await expect(ensureCssFile(cssPath)).resolves.toBeUndefined();
		await expect(ensureCssFile(cssPath)).resolves.toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// fontFaceExistsInCss
// ---------------------------------------------------------------------------

describe('fontFaceExistsInCss', () => {
	it('returns true when the family is already in a @font-face block', () => {
		const css = `@font-face { font-family: 'Inter'; src: url('/fonts/inter.woff2'); }`;
		expect(fontFaceExistsInCss(css, 'Inter')).toBe(true);
	});

	it('is case-insensitive', () => {
		const css = `@font-face { font-family: "open sans"; src: url('/fonts/open-sans.woff2'); }`;
		expect(fontFaceExistsInCss(css, 'Open Sans')).toBe(true);
	});

	it('returns false when the family is not present', () => {
		const css = `@font-face { font-family: 'Roboto'; src: url('/fonts/roboto.woff2'); }`;
		expect(fontFaceExistsInCss(css, 'Inter')).toBe(false);
	});

	it('returns false on empty CSS', () => {
		expect(fontFaceExistsInCss('', 'Inter')).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// injectFontFaceRules — insertion position
// ---------------------------------------------------------------------------

describe('injectFontFaceRules — insertion position', () => {
	it('injects @font-face below the last @import statement', async () => {
		const initial = '@import "reset.css";\nbody { color: #000; }\n';
		const { output } = await writeAndInject(initial, [makeAsset('Open Sans')]);

		expect(output).toContain('@import "reset.css";');
		expect(output).toContain("url('/fonts/open-sans-regular.woff2')");
		expect(output.indexOf('@font-face')).toBeGreaterThan(output.indexOf('@import'));
	});

	it('injects at the top of an empty CSS file', async () => {
		const { output } = await writeAndInject('', [makeAsset('Roboto')]);
		expect(output.trim().startsWith('@font-face')).toBe(true);
	});

	it('prepends @font-face when file has no @import but has other content', async () => {
		const initial = 'body { margin: 0; }\n';
		const { output } = await writeAndInject(initial, [makeAsset('Inter')]);
		expect(output.trim().startsWith('@font-face')).toBe(true);
		expect(output).toContain('body { margin: 0; }');
	});

	it('injects below the LAST @import when multiple exist', async () => {
		const initial = '@import "a.css";\n@import "b.css";\nbody { margin: 0; }\n';
		const { output } = await writeAndInject(initial, [makeAsset('Inter')]);

		const importBPos = output.indexOf('@import "b.css";');
		const fontFacePos = output.indexOf('@font-face');
		expect(fontFacePos).toBeGreaterThan(importBPos);
	});

	it('does NOT inject above @charset declarations', async () => {
		// @charset must always be the first rule in CSS
		const initial = '@charset "UTF-8";\n@import "reset.css";\nbody {}\n';
		const { output } = await writeAndInject(initial, [makeAsset('Inter')]);

		const charsetPos = output.indexOf('@charset');
		const fontFacePos = output.indexOf('@font-face');
		expect(fontFacePos).toBeGreaterThan(charsetPos);
	});
});

// ---------------------------------------------------------------------------
// injectFontFaceRules — comment handling
// ---------------------------------------------------------------------------

describe('injectFontFaceRules — comment handling', () => {
	it('does NOT treat a commented-out @import as an insertion point', async () => {
		// The real @import is after the comment; @font-face should go below the real one
		const initial = '/* @import "old.css"; */\n@import "real.css";\nbody {}\n';
		const { output } = await writeAndInject(initial, [makeAsset('Roboto')]);

		const realImportPos = output.indexOf('@import "real.css";');
		const fontFacePos = output.indexOf('@font-face');
		expect(fontFacePos).toBeGreaterThan(realImportPos);
	});

	it('handles block comments spanning multiple lines', async () => {
		const initial = `/*\n * @import "nope.css";\n */\n@import "yes.css";\nbody {}\n`;
		const { output } = await writeAndInject(initial, [makeAsset('Inter')]);

		expect(output.indexOf('@font-face')).toBeGreaterThan(output.indexOf('@import "yes.css";'));
	});
});

// ---------------------------------------------------------------------------
// injectFontFaceRules — @import url() syntax
// ---------------------------------------------------------------------------

describe('injectFontFaceRules — url() @import syntax', () => {
	it('recognises @import url("...") as a valid import line', async () => {
		const initial = '@import url("reset.css");\nbody {}\n';
		const { output } = await writeAndInject(initial, [makeAsset('Lato')]);

		expect(output.indexOf('@font-face')).toBeGreaterThan(output.indexOf('@import url('));
	});

	it('recognises @import url(...) without quotes', async () => {
		const initial = '@import url(reset.css);\nbody {}\n';
		const { output } = await writeAndInject(initial, [makeAsset('Lato')]);

		expect(output.indexOf('@font-face')).toBeGreaterThan(output.indexOf('@import url('));
	});
});

// ---------------------------------------------------------------------------
// injectFontFaceRules — CRLF handling
// ---------------------------------------------------------------------------

describe('injectFontFaceRules — CRLF line endings', () => {
	it('handles Windows CRLF line endings without breaking injection', async () => {
		const initial = '@import "reset.css";\r\nbody { color: red; }\r\n';
		const { output } = await writeAndInject(initial, [makeAsset('Inter')]);

		expect(output).toContain('@font-face');
		expect(output.indexOf('@font-face')).toBeGreaterThan(output.indexOf('@import'));
	});
});

// ---------------------------------------------------------------------------
// injectFontFaceRules — idempotency (duplicate detection)
// ---------------------------------------------------------------------------

describe('injectFontFaceRules — idempotency', () => {
	it('skips families already present in the CSS', async () => {
		const initial = `@font-face { font-family: 'Roboto'; src: url('/fonts/roboto.woff2'); }\nbody {}\n`;
		const { result } = await writeAndInject(initial, [makeAsset('Roboto')]);

		expect(result.injected).toHaveLength(0);
		expect(result.skipped).toContain('Roboto');
	});

	it('running twice does not duplicate @font-face blocks', async () => {
		const cssPath = path.join(tempDir, 'twice.css');
		await fs.writeFile(cssPath, '', 'utf8');

		await injectFontFaceRules(cssPath, [makeAsset('Inter')]);
		await injectFontFaceRules(cssPath, [makeAsset('Inter')]);

		const content = await fs.readFile(cssPath, 'utf8');
		const count = (content.match(/@font-face/g) ?? []).length;
		expect(count).toBe(1);
	});

	it('injects new family while skipping already-present one', async () => {
		const initial = `@font-face { font-family: 'Roboto'; src: url('/fonts/roboto.woff2'); }\n`;
		const { result, output } = await writeAndInject(
			initial,
			[makeAsset('Roboto'), makeAsset('Inter')],
		);

		expect(result.injected).toContain('Inter');
		expect(result.skipped).toContain('Roboto');
		expect(output).toContain("font-family: 'Inter'");
	});
});

// ---------------------------------------------------------------------------
// injectFontFaceRules — multiple assets / families
// ---------------------------------------------------------------------------

describe('injectFontFaceRules — multiple families', () => {
	it('injects @font-face for multiple font families', async () => {
		const initial = '@import "theme.css";\nbody {}\n';
		const { output } = await writeAndInject(
			initial,
			[makeAsset('Inter'), makeAsset('Roboto')],
		);

		expect(output).toContain("font-family: 'Inter'");
		expect(output).toContain("font-family: 'Roboto'");
	});

	it('injects multiple formats for the same family in a single @font-face block', async () => {
		const assets = [makeAsset('Lato', 'woff2'), makeAsset('Lato', 'woff')];
		const { output } = await writeAndInject('@import "a.css";\n', assets);

		// Count @font-face occurrences directly — should be exactly 1 block for Lato
		const occurrences = (output.match(/@font-face/g) ?? []).length;
		expect(occurrences).toBe(1);
		// Both formats should be in that single block
		expect(output).toContain("format('woff2')");
		expect(output).toContain("format('woff')");
	});
});
