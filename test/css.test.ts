import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { ensureCssFile, injectFontFaceRules } from '../src/css';
import { FontAsset } from '../src/fonts';

describe('CSS handling', () => {
	it('creates a CSS file when it does not exist', async () => {
		const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fli-css-'));
		const cssPath = path.join(tempDir, 'styles', 'globals.css');

		await ensureCssFile(cssPath);
		const exists = await fs
			.stat(cssPath)
			.then(() => true)
			.catch(() => false);
		expect(exists).toBe(true);

		await fs.rm(tempDir, { recursive: true, force: true });
	});

	it('injects font-face rules below the last @import statement', async () => {
		const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fli-css-'));
		const cssPath = path.join(tempDir, 'styles.css');
		const initialContent = '@import "reset.css";\nbody { color: #000; }\n';
		await fs.writeFile(cssPath, initialContent, 'utf8');

		const assets: FontAsset[] = [
			{
				family: 'Open Sans',
				normalizedFamily: 'open-sans',
				format: 'woff2',
				fileName: 'open-sans-regular.woff2',
				publicUrl: '/fonts/open-sans-regular.woff2',
				savedPath: path.join(tempDir, 'open-sans-regular.woff2'),
			},
		];

		await injectFontFaceRules(cssPath, assets);
		const result = await fs.readFile(cssPath, 'utf8');

		expect(result).toContain('@import "reset.css";');
		expect(result).toContain("url('/fonts/open-sans-regular.woff2')");
		expect(result.indexOf("url('/fonts/open-sans-regular.woff2')")).toBeGreaterThan(result.indexOf('@import "reset.css";'));

		await fs.rm(tempDir, { recursive: true, force: true });
	});
});
