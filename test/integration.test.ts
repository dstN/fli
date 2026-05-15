import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { ensureCssFile, injectFontFaceRules } from '../src/css';
import { FontAsset } from '../src/fonts';

describe('integration: CSS injection and asset path flow', () => {
	it('injects font-face declarations for multiple assets and preserves imports', async () => {
		const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fli-integration-'));
		const cssPath = path.join(tempDir, 'app.css');
		const initialContent = '@import "theme.css";\n@import "reset.css";\nbody { margin: 0; }\n';

		await fs.writeFile(cssPath, initialContent, 'utf8');
		await ensureCssFile(cssPath);

		const assets: FontAsset[] = [
			{
				family: 'Open Sans',
				normalizedFamily: 'open-sans',
				format: 'woff2',
				fileName: 'open-sans-regular.woff2',
				publicUrl: '/fonts/open-sans-regular.woff2',
				savedPath: path.join(tempDir, 'open-sans-regular.woff2'),
			},
			{
				family: 'Open Sans',
				normalizedFamily: 'open-sans',
				format: 'woff',
				fileName: 'open-sans-regular.woff',
				publicUrl: '/fonts/open-sans-regular.woff',
				savedPath: path.join(tempDir, 'open-sans-regular.woff'),
			},
			{
				family: 'Roboto',
				normalizedFamily: 'roboto',
				format: 'woff2',
				fileName: 'roboto-regular.woff2',
				publicUrl: '/fonts/roboto-regular.woff2',
				savedPath: path.join(tempDir, 'roboto-regular.woff2'),
			},
		];

		await injectFontFaceRules(cssPath, assets);
		const result = await fs.readFile(cssPath, 'utf8');

		expect(result).toContain('@import "reset.css";');
		expect(result).toContain('@font-face {');
		expect(result).toContain("url('/fonts/open-sans-regular.woff2') format('woff2')");
		expect(result).toContain("url('/fonts/open-sans-regular.woff') format('woff')");
		expect(result).toContain("url('/fonts/roboto-regular.woff2') format('woff2')");
		expect(result.indexOf('@font-face')).toBeGreaterThan(result.indexOf('@import "reset.css";'));

		await fs.rm(tempDir, { recursive: true, force: true });
	});
});
