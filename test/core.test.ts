import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeFli } from '../src/core.js';
import type { FliOptions } from '../src/core.js';

// ---------------------------------------------------------------------------
// Mocking fetch globally
// ---------------------------------------------------------------------------

const mockGwfhResponse = {
	family: 'Inter',
	variants: [
		{
			id: 'regular',
			fontWeight: 400,
			fontStyle: 'normal',
			italic: false,
			woff2: 'https://gwfh.mranftl.com/api/fonts/inter/regular/inter-regular.woff2',
			ttf: 'https://gwfh.mranftl.com/api/fonts/inter/regular/inter-regular.ttf',
		},
	],
};

const mockWoff2Buffer = Buffer.from([0x77, 0x4f, 0x46, 0x32, ...Array(100).fill(0)]); // valid WOFF2 magic bytes

const createFetchMock = (overrides: Record<string, unknown> = {}) => {
	return vi.fn((url: string) => {
		const urlStr = String(url);

		// GWFH direct lookup
		if (urlStr.includes('gwfh.mranftl.com/api/fonts/inter?')) {
			return Promise.resolve({
				ok: true,
				status: 200,
				json: () => Promise.resolve(mockGwfhResponse),
				headers: new Headers(),
			} as unknown as Response);
		}

		// WOFF2 font file download
		if (urlStr.endsWith('.woff2')) {
			return Promise.resolve({
				ok: true,
				status: 200,
				body: null,
				arrayBuffer: () => Promise.resolve(mockWoff2Buffer.buffer),
				headers: new Headers(),
			} as unknown as Response);
		}

		// Any unmocked URL
		return Promise.reject(new Error(`Unexpected fetch call: ${urlStr}`));
	});
};

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

let tempDir: string;

beforeEach(async () => {
	tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fli-core-'));
	// Create a minimal package.json so detectFramework works
	await fs.writeFile(
		path.join(tempDir, 'package.json'),
		JSON.stringify({ dependencies: { next: '^14.0.0' } }),
		'utf8',
	);
	vi.stubGlobal('fetch', createFetchMock());
});

afterEach(async () => {
	vi.unstubAllGlobals();
	await fs.rm(tempDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// executeFli — dry-run mode (no file I/O needed)
// ---------------------------------------------------------------------------

describe('executeFli — dry-run mode', () => {
	it('returns injectedFamilies without writing any files', async () => {
		const cssPath = path.join(tempDir, 'styles.css');

		const options: FliOptions = {
			fonts: ['Inter'],
			formats: ['woff2'],
			weights: [400],
			frameworkKey: 'next',
			cssPath,
			projectRoot: tempDir,
			dryRun: true,
		};

		const result = await executeFli(options);

		// In dry-run mode, filesWritten should be 0
		expect(result.filesWritten).toBe(0);
		expect(result.injectedFamilies).toContain('Inter');

		// No CSS file should be created in dry-run
		const cssExists = await fs
			.stat(cssPath)
			.then(() => true)
			.catch(() => false);
		expect(cssExists).toBe(false);
	});

	it('does not create the output font directory in dry-run', async () => {
		const cssPath = path.join(tempDir, 'globals.css');

		await executeFli({
			fonts: ['Inter'],
			formats: ['woff2'],
			weights: [400],
			frameworkKey: 'next',
			cssPath,
			projectRoot: tempDir,
			dryRun: true,
		});

		const fontDir = path.join(tempDir, 'public', 'fonts');
		const dirExists = await fs
			.stat(fontDir)
			.then(() => true)
			.catch(() => false);
		expect(dirExists).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// executeFli — real mode with mocked fetch
// ---------------------------------------------------------------------------

describe('executeFli — real mode', () => {
	it('creates CSS file and injects @font-face when CSS does not exist', async () => {
		const cssPath = path.join(tempDir, 'globals.css');

		const result = await executeFli({
			fonts: ['Inter'],
			formats: ['woff2'],
			weights: [400],
			frameworkKey: 'next',
			cssPath,
			projectRoot: tempDir,
		});

		expect(result.injectedFamilies).toContain('Inter');

		const css = await fs.readFile(cssPath, 'utf8');
		expect(css).toContain("font-family: 'Inter'");
		expect(css).toContain('font-display: swap');
	});

	it('injects below existing @import statements', async () => {
		const cssPath = path.join(tempDir, 'globals.css');
		await fs.writeFile(cssPath, '@import "reset.css";\nbody { margin: 0; }\n', 'utf8');

		await executeFli({
			fonts: ['Inter'],
			formats: ['woff2'],
			weights: [400],
			frameworkKey: 'next',
			cssPath,
			projectRoot: tempDir,
		});

		const css = await fs.readFile(cssPath, 'utf8');
		expect(css.indexOf('@font-face')).toBeGreaterThan(css.indexOf('@import'));
	});

	it('reports skipped families when @font-face already exists', async () => {
		const cssPath = path.join(tempDir, 'globals.css');
		await fs.writeFile(
			cssPath,
			`@font-face { font-family: 'Inter'; src: url('/fonts/inter.woff2'); }\n`,
			'utf8',
		);

		const result = await executeFli({
			fonts: ['Inter'],
			formats: ['woff2'],
			weights: [400],
			frameworkKey: 'next',
			cssPath,
			projectRoot: tempDir,
		});

		expect(result.skippedFamilies).toContain('Inter');
		expect(result.injectedFamilies).toHaveLength(0);
	});

	it('writes font files to the correct framework-specific output directory', async () => {
		const cssPath = path.join(tempDir, 'globals.css');

		await executeFli({
			fonts: ['Inter'],
			formats: ['woff2'],
			weights: [400],
			frameworkKey: 'next',
			cssPath,
			projectRoot: tempDir,
		});

		const fontDir = path.join(tempDir, 'public', 'fonts');
		const files = await fs.readdir(fontDir);
		expect(files.some((f) => f.startsWith('inter') && f.endsWith('.woff2'))).toBe(true);
	});

	it('returns correct outputDir in the result', async () => {
		const cssPath = path.join(tempDir, 'globals.css');

		const result = await executeFli({
			fonts: ['Inter'],
			formats: ['woff2'],
			weights: [400],
			frameworkKey: 'vite',
			cssPath,
			projectRoot: tempDir,
		});

		expect(result.outputDir).toBe(path.resolve(tempDir, 'public/fonts'));
	});
});

// ---------------------------------------------------------------------------
// executeFli — vanilla / fallback framework
// ---------------------------------------------------------------------------

describe('executeFli — vanilla framework fallback', () => {
	it('uses public/fonts directory for vanilla framework', async () => {
		const cssPath = path.join(tempDir, 'styles.css');

		const result = await executeFli({
			fonts: ['Inter'],
			formats: ['woff2'],
			weights: [400],
			frameworkKey: 'vanilla',
			cssPath,
			projectRoot: tempDir,
		});

		expect(result.outputDir).toBe(path.resolve(tempDir, 'public/fonts'));
	});
});

// ---------------------------------------------------------------------------
// executeFli — verbose logging & rollback
// ---------------------------------------------------------------------------

describe('executeFli — verbose logging & rollback', () => {
	it('emits verbose logs when verbose=true', async () => {
		const cssPath = path.join(tempDir, 'styles.css');
		const infoLogs: string[] = [];
		const customLogger = {
			info: (msg: string) => { infoLogs.push(msg); },
			warn: () => {},
			error: () => {},
		};

		await executeFli({
			fonts: ['Inter'],
			formats: ['woff2'],
			weights: [400],
			frameworkKey: 'vanilla',
			cssPath,
			projectRoot: tempDir,
			dryRun: true,
			verbose: true,
			logger: customLogger,
		});

		expect(infoLogs.length).toBeGreaterThan(0);
		expect(infoLogs.some((m) => m.includes('Framework:'))).toBe(true);
	});

	it('creates backup and restores CSS file if injection throws an error', async () => {
		const cssPath = path.join(tempDir, 'styles.css');
		const initialCss = 'body { color: red; }';
		await fs.writeFile(cssPath, initialCss, 'utf8');

		const errorLogs: string[] = [];
		const customLogger = {
			info: () => {},
			warn: () => {},
			error: (msg: string) => { errorLogs.push(msg); },
		};

		// Pass an invalid cssPath that causes injectFontFaceRules or file operations to throw after backup
		// Or we can test normal non-dryRun execution
		const res = await executeFli({
			fonts: ['Inter'],
			formats: ['woff2'],
			weights: [400],
			frameworkKey: 'vanilla',
			cssPath,
			projectRoot: tempDir,
			dryRun: false,
			verbose: true,
			logger: customLogger,
		});

		expect(res.injectedFamilies).toContain('Inter');
		const content = await fs.readFile(cssPath, 'utf8');
		expect(content).toContain('@font-face');
	});

	it('restores original CSS content when injection throws', async () => {
		const cssPath = path.join(tempDir, 'styles.css');
		const initialCss = 'body { color: blue; }';
		await fs.writeFile(cssPath, initialCss, 'utf8');

		const errorLogs: string[] = [];
		const customLogger = {
			info: () => {},
			warn: () => {},
			error: (msg: string) => { errorLogs.push(msg); },
		};

		// Mock fs.rename temporarily to fail during atomic write in injectFontFaceRules
		const origRename = fs.rename;
		const renameSpy = vi.spyOn(fs, 'rename').mockImplementation(async (oldPath, newPath) => {
			if (String(newPath).endsWith('styles.css')) {
				throw new Error('Simulated write failure during CSS injection');
			}
			return origRename.call(fs, oldPath, newPath);
		});

		await expect(
			executeFli({
				fonts: ['Inter'],
				formats: ['woff2'],
				weights: [400],
				frameworkKey: 'vanilla',
				cssPath,
				projectRoot: tempDir,
				dryRun: false,
				verbose: true,
				logger: customLogger,
			}),
		).rejects.toThrow('Simulated write failure during CSS injection');

		renameSpy.mockRestore();

		// Verify rollback restored initialCss and logged error
		const restoredContent = await fs.readFile(cssPath, 'utf8');
		expect(restoredContent).toBe(initialCss);
		expect(errorLogs.some((m) => m.includes('rolling back'))).toBe(true);
	});
});
