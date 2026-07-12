import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { ensureCssFile, injectFontFaceRules } from '../src/css.js';
import type { FontAsset } from '../src/fonts.js';

let tempDir: string;

beforeEach(async () => {
	tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fli-integration-'));
});

afterEach(async () => {
	await fs.rm(tempDir, { recursive: true, force: true });
});

describe('integration: CSS injection and asset path flow', () => {
	it('injects font-face declarations for multiple assets and preserves existing imports', async () => {
		const cssPath = path.join(tempDir, 'app.css');
		const initialContent = '@import "theme.css";\n@import "reset.css";\nbody { margin: 0; }\n';

		await fs.writeFile(cssPath, initialContent, 'utf8');
		await ensureCssFile(cssPath); // Should be a no-op since file exists

		const assets: FontAsset[] = [
			{
				family: 'Open Sans',
				normalizedFamily: 'open-sans',
				format: 'woff2',
				fileName: 'open-sans-regular.woff2',
				publicUrl: '/fonts/open-sans-regular.woff2',
				savedPath: path.join(tempDir, 'open-sans-regular.woff2'),
				fontWeight: 400,
				fontStyle: 'normal',
			},
			{
				family: 'Open Sans',
				normalizedFamily: 'open-sans',
				format: 'woff',
				fileName: 'open-sans-regular.woff',
				publicUrl: '/fonts/open-sans-regular.woff',
				savedPath: path.join(tempDir, 'open-sans-regular.woff'),
				fontWeight: 400,
				fontStyle: 'normal',
			},
			{
				family: 'Roboto',
				normalizedFamily: 'roboto',
				format: 'woff2',
				fileName: 'roboto-regular.woff2',
				publicUrl: '/fonts/roboto-regular.woff2',
				savedPath: path.join(tempDir, 'roboto-regular.woff2'),
				fontWeight: 400,
				fontStyle: 'normal',
			},
		];

		const { injected, skipped } = await injectFontFaceRules(cssPath, assets);
		const result = await fs.readFile(cssPath, 'utf8');

		// Original imports are preserved
		expect(result).toContain('@import "theme.css";');
		expect(result).toContain('@import "reset.css";');

		// @font-face blocks were injected
		expect(result).toContain('@font-face {');
		expect(result).toContain("url('/fonts/open-sans-regular.woff2') format('woff2')");
		expect(result).toContain("url('/fonts/open-sans-regular.woff') format('woff')");
		expect(result).toContain("url('/fonts/roboto-regular.woff2') format('woff2')");

		// @font-face appears after the last @import
		expect(result.indexOf('@font-face')).toBeGreaterThan(result.indexOf('@import "reset.css";'));

		// Return value is correct
		expect(injected).toContain('Open Sans');
		expect(injected).toContain('Roboto');
		expect(skipped).toHaveLength(0);
	});

	it('full round-trip: create CSS file, inject, verify idempotency on second run', async () => {
		const cssPath = path.join(tempDir, 'style.css');

		// File does not exist yet
		await ensureCssFile(cssPath);
		const exists = await fs.stat(cssPath).then(() => true).catch(() => false);
		expect(exists).toBe(true);

		const asset: FontAsset = {
			family: 'Inter',
			normalizedFamily: 'inter',
			format: 'woff2',
			fileName: 'inter-regular.woff2',
			publicUrl: '/fonts/inter-regular.woff2',
			savedPath: path.join(tempDir, 'inter-regular.woff2'),
			fontWeight: 400,
			fontStyle: 'normal',
		};

		// First injection
		const firstRun = await injectFontFaceRules(cssPath, [asset]);
		expect(firstRun.injected).toContain('Inter');
		expect(firstRun.skipped).toHaveLength(0);

		// Second injection — should be a no-op for this family
		const secondRun = await injectFontFaceRules(cssPath, [asset]);
		expect(secondRun.injected).toHaveLength(0);
		expect(secondRun.skipped).toContain('Inter');

		// Only one @font-face block in the file
		const content = await fs.readFile(cssPath, 'utf8');
		const count = (content.match(/@font-face/g) ?? []).length;
		expect(count).toBe(1);
	});
});
