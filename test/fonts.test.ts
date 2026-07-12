import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	parseFormatInput,
	parseWeightInput,
	normalizeFamily,
	createFontFaceDeclarations,
	downloadFontAssets,
	clearCache,
	SUPPORTED_FORMATS,
	FULL_FORMATS,
	type FontAsset,
	type FontFormat,
} from '../src/fonts.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Font } from 'fonteditor-core';

// ---------------------------------------------------------------------------
// parseFormatInput — exported pure function
// ---------------------------------------------------------------------------

describe('parseFormatInput', () => {
	it('returns woff2 when input is blank', () => {
		expect(parseFormatInput('')).toEqual(['woff2']);
	});

	it('returns woff2 for unrecognised input', () => {
		expect(parseFormatInput('otf')).toEqual(['woff2']);
	});

	it('parses single format', () => {
		expect(parseFormatInput('ttf')).toEqual(['ttf']);
	});

	it('parses comma-separated formats', () => {
		expect(parseFormatInput('woff2, woff, ttf')).toEqual(['woff2', 'woff', 'ttf']);
	});

	it('returns full format set when input is "full"', () => {
		expect(parseFormatInput('full')).toEqual(FULL_FORMATS);
	});

	it('ignores unsupported format names but keeps valid ones', () => {
		expect(parseFormatInput('woff2, otf, svg')).toEqual(['woff2', 'svg']);
	});

	it('handles extra whitespace gracefully', () => {
		expect(parseFormatInput('  woff2  ,  eot  ')).toEqual(['woff2', 'eot']);
	});

	it('falls back to woff2 when all formats are invalid', () => {
		expect(parseFormatInput('xyz, abc')).toEqual(['woff2']);
	});
});

// ---------------------------------------------------------------------------
// parseWeightInput — exported pure function
// ---------------------------------------------------------------------------

describe('parseWeightInput', () => {
	it('returns [400] when input is blank', () => {
		expect(parseWeightInput('')).toEqual([400]);
	});

	it('parses single weight', () => {
		expect(parseWeightInput('700')).toEqual([700]);
	});

	it('parses comma-separated weights with whitespace', () => {
		expect(parseWeightInput('400, 600, 700')).toEqual([400, 600, 700]);
	});

	it('ignores invalid or out-of-range weights and falls back to 400 if empty', () => {
		expect(parseWeightInput('abc, 9999')).toEqual([400]);
	});
});

// ---------------------------------------------------------------------------
// normalizeFamily — exported pure function
// ---------------------------------------------------------------------------

describe('normalizeFamily', () => {
	it('lowercases and hyphenates spaces', () => {
		expect(normalizeFamily('Open Sans')).toBe('open-sans');
	});

	it('strips special characters', () => {
		expect(normalizeFamily('Noto Sans (JP)')).toBe('noto-sans-jp');
	});

	it('collapses multiple spaces', () => {
		expect(normalizeFamily('Ubuntu  Mono')).toBe('ubuntu-mono');
	});

	it('trims surrounding whitespace', () => {
		expect(normalizeFamily('  Inter  ')).toBe('inter');
	});

	it('handles already-normalized input', () => {
		expect(normalizeFamily('roboto')).toBe('roboto');
	});
});

// ---------------------------------------------------------------------------
// createFontFaceDeclarations — pure CSS generation
// ---------------------------------------------------------------------------

const makeAsset = (
	family: string,
	format: FontFormat,
	normalizedFamily = family.toLowerCase().replace(/\s+/g, '-'),
): FontAsset => ({
	family,
	normalizedFamily,
	format,
	fileName: `${normalizedFamily}-regular.${format}`,
	publicUrl: `/fonts/${normalizedFamily}-regular.${format}`,
	savedPath: `/tmp/${normalizedFamily}-regular.${format}`,
	fontWeight: 400,
	fontStyle: 'normal',
});

describe('createFontFaceDeclarations', () => {
	it('generates a single @font-face block for one asset', () => {
		const assets = [makeAsset('Inter', 'woff2')];
		const css = createFontFaceDeclarations(assets);

		expect(css).toContain("font-family: 'Inter'");
		expect(css).toContain("url('/fonts/inter-regular.woff2') format('woff2')");
		expect(css).toContain('font-display: swap');
		expect(css).toContain('font-style: normal');
		expect(css).toContain('font-weight: 400');
	});

	it('groups multiple formats for the same family into one @font-face', () => {
		const assets = [makeAsset('Roboto', 'woff2'), makeAsset('Roboto', 'woff')];
		const css = createFontFaceDeclarations(assets);

		const blocks = css.split('@font-face').filter(Boolean);
		expect(blocks).toHaveLength(1);
		expect(css).toContain("format('woff2')");
		expect(css).toContain("format('woff')");
	});

	it('outputs separate @font-face blocks for different families', () => {
		const assets = [makeAsset('Inter', 'woff2'), makeAsset('Roboto', 'woff2')];
		const css = createFontFaceDeclarations(assets);

		expect(css).toContain("font-family: 'Inter'");
		expect(css).toContain("font-family: 'Roboto'");
		const blocks = css.split('@font-face').filter(Boolean);
		expect(blocks).toHaveLength(2);
	});

	it('sorts formats in SUPPORTED_FORMATS order', () => {
		// SUPPORTED_FORMATS = ['ttf', 'woff2', 'woff', 'eot', 'svg']
		const assets = [
			makeAsset('Lato', 'svg'),
			makeAsset('Lato', 'ttf'),
			makeAsset('Lato', 'woff2'),
		];
		const css = createFontFaceDeclarations(assets);

		const ttfPos = css.indexOf("format('truetype')");
		const woff2Pos = css.indexOf("format('woff2')");
		const svgPos = css.indexOf("format('svg')");

		expect(ttfPos).toBeLessThan(woff2Pos);
		expect(woff2Pos).toBeLessThan(svgPos);
	});

	it('uses correct CSS format names for each font format', () => {
		const formatMap: Array<[FontFormat, string]> = [
			['ttf', 'truetype'],
			['woff2', 'woff2'],
			['woff', 'woff'],
			['eot', 'embedded-opentype'],
			['svg', 'svg'],
		];

		for (const [format, cssFormat] of formatMap) {
			const css = createFontFaceDeclarations([makeAsset('Test', format)]);
			expect(css).toContain(`format('${cssFormat}')`);
		}
	});

	it('public URLs always use forward slashes (not Windows backslashes)', () => {
		const asset = makeAsset('Inter', 'woff2');
		asset.publicUrl = '/fonts/inter-regular.woff2';
		const css = createFontFaceDeclarations([asset]);
		expect(css).not.toContain('\\');
	});

	it('creates separate @font-face blocks for different weights and styles of the same family', () => {
		const assets: FontAsset[] = [
			{ ...makeAsset('Inter', 'woff2'), fontWeight: 400, fontStyle: 'normal' },
			{ ...makeAsset('Inter', 'woff2'), fontWeight: 700, fontStyle: 'normal' },
			{ ...makeAsset('Inter', 'woff2'), fontWeight: 400, fontStyle: 'italic' },
		];
		const css = createFontFaceDeclarations(assets);
		const blocks = css.split('@font-face').filter(Boolean);
		expect(blocks).toHaveLength(3);
		expect(css).toContain('font-weight: 400');
		expect(css).toContain('font-weight: 700');
		expect(css).toContain('font-style: italic');
	});
});

// ---------------------------------------------------------------------------
// downloadFontAssets — hybrid resolution & fallback chains
// ---------------------------------------------------------------------------

describe('downloadFontAssets unit tests', () => {
	let tempDir: string;
	const originalFetch = global.fetch;
	const originalEnv = { ...process.env };

	beforeEach(async () => {
		await clearCache();
		tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'fli-fonts-test-'));
	});

	afterEach(async () => {
		await clearCache();
		global.fetch = originalFetch;
		process.env = { ...originalEnv };
		await fs.promises.rm(tempDir, { recursive: true, force: true });
	});

	it('successfully resolves from GWFH in dryRun mode', async () => {
		global.fetch = vi.fn().mockImplementation(async (url: string) => {
			if (url.includes('gwfh.mranftl.com/api/fonts/inter')) {
				return new Response(
					JSON.stringify({
						id: 'inter',
						family: 'Inter',
						variants: [
							{
								id: '400',
								fontWeight: '400',
								fontStyle: 'normal',
								woff2: 'https://example.com/inter.woff2',
							},
						],
					}),
					{ status: 200 },
				);
			}
			return new Response('Not found', { status: 404 });
		});

		const assets = await downloadFontAssets(['Inter'], ['woff2'], [400], tempDir, '/fonts', true);
		expect(assets).toHaveLength(1);
		expect(assets[0]!.family).toBe('Inter');
		expect(assets[0]!.format).toBe('woff2');
		expect(assets[0]!.fontWeight).toBe(400);
	});

	it('falls back to Google CSS2 when GWFH fails', async () => {
		global.fetch = vi.fn().mockImplementation(async (url: string) => {
			if (url.includes('gwfh.mranftl.com')) {
				return new Response('Error', { status: 500 });
			}
			if (url.includes('fonts.googleapis.com/css2')) {
				return new Response(
					`@font-face {
						font-family: 'Roboto';
						src: url(https://fonts.gstatic.com/s/roboto/v30/roboto.woff2) format('woff2');
					}`,
					{ status: 200 },
				);
			}
			return new Response('Not found', { status: 404 });
		});

		const assets = await downloadFontAssets(['Roboto'], ['woff2'], [400], tempDir, '/fonts', true);
		expect(assets).toHaveLength(1);
		expect(assets[0]!.family).toBe('Roboto');
	});

	it('falls back to Official Google Fonts API when both GWFH and CSS2 fail and API key is set', async () => {
		process.env.GOOGLE_FONTS_API_KEY = 'test-api-key';

		global.fetch = vi.fn().mockImplementation(async (url: string) => {
			if (url.includes('gwfh.mranftl.com') || url.includes('fonts.googleapis.com/css2')) {
				return new Response('Error', { status: 500 });
			}
			if (url.includes('www.googleapis.com/webfonts/v1/webfonts')) {
				return new Response(
					JSON.stringify({
						items: [
							{
								family: 'CustomFont',
								files: { regular: 'https://example.com/custom.ttf' },
							},
						],
					}),
					{ status: 200 },
				);
			}
			return new Response('Not found', { status: 404 });
		});

		const assets = await downloadFontAssets(['CustomFont'], ['ttf'], [400], tempDir, '/fonts', true);
		expect(assets).toHaveLength(1);
		expect(assets[0]!.family).toBe('CustomFont');
	});

	it('throws a helpful error when all sources fail', async () => {
		global.fetch = vi.fn().mockImplementation(async () => {
			return new Response('Error', { status: 500 });
		});

		await expect(
			downloadFontAssets(['NonExistentFont'], ['woff2'], [400], tempDir, '/fonts', true),
		).rejects.toThrow(/Unable to retrieve metadata for font/);
	});

	it('writes font files to disk when dryRun=false and skips download if file already exists', async () => {
		let fetchCallCount = 0;
		global.fetch = vi.fn().mockImplementation(async (url: string) => {
			fetchCallCount++;
			if (url.includes('gwfh.mranftl.com/api/fonts/inter')) {
				return new Response(
					JSON.stringify({
						id: 'inter',
						family: 'Inter',
						variants: [
							{
								id: '400',
								fontWeight: '400',
								fontStyle: 'normal',
								woff2: 'https://example.com/inter.woff2',
							},
						],
					}),
					{ status: 200 },
				);
			}
			if (url === 'https://example.com/inter.woff2') {
				// Return WOFF2 magic bytes
				const buf = Buffer.alloc(16);
				buf.writeUInt32BE(0x774f4632, 0);
				return new Response(buf, { status: 200 });
			}
			return new Response('Not found', { status: 404 });
		});

		// First run writes file to disk
		const assets1 = await downloadFontAssets(['Inter'], ['woff2'], [400], tempDir, '/fonts', false);
		expect(assets1).toHaveLength(1);
		const stat = await fs.promises.stat(assets1[0]!.savedPath);
		expect(stat.size).toBeGreaterThan(0);

		const fetchCallsFirstRun = fetchCallCount;

		// Second run should detect existing file and skip download
		const assets2 = await downloadFontAssets(['Inter'], ['woff2'], [400], tempDir, '/fonts', false);
		expect(assets2).toHaveLength(1);
		// Only metadata fetched or cached, no additional file download
		expect(fetchCallCount).toBe(fetchCallsFirstRun);
	});

	it('downloads multiple weights when requested', async () => {
		global.fetch = vi.fn().mockImplementation(async (url: string) => {
			if (url.includes('gwfh.mranftl.com/api/fonts/multiweightfont')) {
				return new Response(
					JSON.stringify({
						id: 'multiweightfont',
						family: 'MultiWeightFont',
						variants: [
							{ id: '400', fontWeight: '400', fontStyle: 'normal', woff2: 'https://example.com/mw-400.woff2' },
							{ id: '700', fontWeight: '700', fontStyle: 'normal', woff2: 'https://example.com/mw-700.woff2' },
						],
					}),
					{ status: 200 },
				);
			}
			return new Response('Not found', { status: 404 });
		});

		const assets = await downloadFontAssets(['MultiWeightFont'], ['woff2'], [400, 700], tempDir, '/fonts', true);
		expect(assets).toHaveLength(2);
		expect(assets.map((a) => a.fontWeight)).toEqual([400, 700]);
	});

	it('throws corrupted TTF error if derived format needs TTF but TTF magic bytes are invalid', async () => {
		global.fetch = vi.fn().mockImplementation(async (url: string) => {
			if (url.includes('gwfh.mranftl.com/api/fonts/badfont')) {
				return new Response(
					JSON.stringify({
						id: 'badfont',
						family: 'BadFont',
						variants: [
							{
								id: '400',
								fontWeight: '400',
								fontStyle: 'normal',
								ttf: 'https://example.com/badfont.ttf',
							},
						],
					}),
					{ status: 200 },
				);
			}
			if (url === 'https://example.com/badfont.ttf') {
				// Return invalid TTF bytes
				return new Response(Buffer.from('INVALID_TTF_DATA'), { status: 200 });
			}
			return new Response('Not found', { status: 404 });
		});

		await expect(
			downloadFontAssets(['BadFont'], ['woff2'], [400], tempDir, '/fonts', false),
		).rejects.toThrow(/Downloaded TTF for "BadFont" appears corrupted/);
	});

	it('falls back to GWFH list lookup when direct ID lookup returns 404', async () => {
		global.fetch = vi.fn().mockImplementation(async (url: string) => {
			if (url === 'https://gwfh.mranftl.com/api/fonts/listfont?subsets=latin') {
				return new Response('Not found', { status: 404 });
			}
			if (url === 'https://gwfh.mranftl.com/api/fonts?sort=alpha') {
				return new Response(
					JSON.stringify([
						{ id: 'listfont', family: 'List Font' },
					]),
					{ status: 200 },
				);
			}
			if (url === 'https://gwfh.mranftl.com/api/fonts/listfont?subsets=latin') {
				return new Response(
					JSON.stringify({
						id: 'listfont',
						family: 'List Font',
						variants: [
							{ id: '400', fontWeight: '400', fontStyle: 'normal', woff2: 'https://example.com/lf.woff2' },
						],
					}),
					{ status: 200 },
				);
			}
			return new Response('Not found', { status: 404 });
		});

		// Note: first call to subsets=latin returns 404, list returns match, second call to match.id subsets=latin
		let callCount = 0;
		global.fetch = vi.fn().mockImplementation(async (url: string) => {
			if (url.includes('subsets=latin')) {
				callCount++;
				if (callCount === 1) return new Response('Not found', { status: 404 });
				return new Response(
					JSON.stringify({
						id: 'listfont',
						family: 'List Font',
						variants: [
							{ id: '400', fontWeight: '400', fontStyle: 'normal', woff2: 'https://example.com/lf.woff2' },
						],
					}),
					{ status: 200 },
				);
			}
			if (url.includes('sort=alpha')) {
				return new Response(
					JSON.stringify([
						{ id: 'listfont', family: 'List Font' },
					]),
					{ status: 200 },
				);
			}
			return new Response('Not found', { status: 404 });
		});

		const assets = await downloadFontAssets(['List Font'], ['woff2'], [400], tempDir, '/fonts', true);
		expect(assets).toHaveLength(1);
		expect(assets[0]!.family).toBe('List Font');
	});

	it('aggregates errors when multiple families fail to download', async () => {
		global.fetch = vi.fn().mockImplementation(async () => {
			return new Response('Error', { status: 500 });
		});

		await expect(
			downloadFontAssets(['FontA', 'FontB'], ['woff2'], [400], tempDir, '/fonts', true),
		).rejects.toThrow(/Failed to download 2 font\(s\)/);
	});

	it('derives missing formats from fetched TTF when direct format URL is not available', async () => {
		const font = new Font();
		const ttfBuffer = Buffer.from(font.write({ type: 'ttf' }) as unknown as ArrayBuffer);

		global.fetch = vi.fn().mockImplementation(async (url: string) => {
			if (url.includes('gwfh.mranftl.com/api/fonts/derivefont')) {
				return new Response(
					JSON.stringify({
						id: 'derivefont',
						family: 'DeriveFont',
						variants: [
							{
								id: '400',
								fontWeight: '400',
								fontStyle: 'normal',
								ttf: 'https://example.com/derive.ttf',
							},
						],
					}),
					{ status: 200 },
				);
			}
			if (url === 'https://example.com/derive.ttf') {
				return new Response(ttfBuffer, { status: 200 });
			}
			return new Response('Not found', { status: 404 });
		});

		const assets = await downloadFontAssets(['DeriveFont'], ['woff', 'ttf'], [400], tempDir, '/fonts', false);
		expect(assets).toHaveLength(2);
		expect(assets.map((a) => a.format)).toEqual(['woff', 'ttf']);
		const woffStat = await fs.promises.stat(assets[0]!.savedPath);
		expect(woffStat.size).toBeGreaterThan(0);
		const ttfStat = await fs.promises.stat(assets[1]!.savedPath);
		expect(ttfStat.size).toBe(ttfBuffer.length);
	});

	it('throws error when font binary download fails after retries', async () => {
		global.fetch = vi.fn().mockImplementation(async (url: string) => {
			if (url.includes('gwfh.mranftl.com/api/fonts/failbin')) {
				return new Response(
					JSON.stringify({
						id: 'failbin',
						family: 'FailBin',
						variants: [
							{ id: '400', fontWeight: '400', fontStyle: 'normal', woff2: 'https://example.com/fail.woff2' },
						],
					}),
					{ status: 200 },
				);
			}
			if (url === 'https://example.com/fail.woff2') {
				return new Response('Server Error', { status: 500 });
			}
			return new Response('Not found', { status: 404 });
		});

		await expect(
			downloadFontAssets(['FailBin'], ['woff2'], [400], tempDir, '/fonts', false),
		).rejects.toThrow(/Failed to download 1 font\(s\)/);
	});

	it('selects first available variant if requested weight and 400 regular are not present', async () => {
		global.fetch = vi.fn().mockImplementation(async (url: string) => {
			if (url.includes('gwfh.mranftl.com/api/fonts/oddweight')) {
				return new Response(
					JSON.stringify({
						id: 'oddweight',
						family: 'OddWeight',
						variants: [
							{ id: '300', fontWeight: '300', fontStyle: 'italic', italic: true, woff2: 'https://example.com/odd.woff2' },
						],
					}),
					{ status: 200 },
				);
			}
			return new Response('Not found', { status: 404 });
		});

		const assets = await downloadFontAssets(['OddWeight'], ['woff2'], [400], tempDir, '/fonts', true);
		expect(assets).toHaveLength(1);
		expect(assets[0]!.fontWeight).toBe(300);
		expect(assets[0]!.fontStyle).toBe('italic');
	});

	it('derives eot and svg formats from fetched TTF', async () => {
		const font = new Font();
		const ttfBuffer = Buffer.from(font.write({ type: 'ttf' }) as unknown as ArrayBuffer);

		global.fetch = vi.fn().mockImplementation(async (url: string) => {
			if (url.includes('gwfh.mranftl.com/api/fonts/deriveeot')) {
				return new Response(
					JSON.stringify({
						id: 'deriveeot',
						family: 'DeriveEot',
						variants: [
							{
								id: '400',
								fontWeight: '400',
								fontStyle: 'normal',
								ttf: 'https://example.com/derive2.ttf',
							},
						],
					}),
					{ status: 200 },
				);
			}
			if (url === 'https://example.com/derive2.ttf') {
				return new Response(ttfBuffer, { status: 200 });
			}
			return new Response('Not found', { status: 404 });
		});

		const assets = await downloadFontAssets(['DeriveEot'], ['eot', 'svg'], [400], tempDir, '/fonts', false);
		expect(assets).toHaveLength(2);
		expect(assets.map((a) => a.format)).toEqual(['eot', 'svg']);
	});

	it('throws error when deriving format but base TTF URL is missing from metadata', async () => {
		global.fetch = vi.fn().mockImplementation(async (url: string) => {
			if (url.includes('gwfh.mranftl.com/api/fonts/nottf')) {
				return new Response(
					JSON.stringify({
						id: 'nottf',
						family: 'NoTtf',
						variants: [
							{
								id: '400',
								fontWeight: '400',
								fontStyle: 'normal',
							},
						],
					}),
					{ status: 200 },
				);
			}
			return new Response('Not found', { status: 404 });
		});

		await expect(
			downloadFontAssets(['NoTtf'], ['woff'], [400], tempDir, '/fonts', false),
		).rejects.toThrow(/Unable to fetch TTF base font for "NoTtf"/);
	});

	it('derives woff2 format from fetched TTF when direct woff2 URL is missing', async () => {
		const font = new Font();
		const ttfBuffer = Buffer.from(font.write({ type: 'ttf' }) as unknown as ArrayBuffer);

		global.fetch = vi.fn().mockImplementation(async (url: string) => {
			if (url.includes('gwfh.mranftl.com/api/fonts/derivewoff2')) {
				return new Response(
					JSON.stringify({
						id: 'derivewoff2',
						family: 'DeriveWoff2',
						variants: [
							{
								id: '400',
								fontWeight: '400',
								fontStyle: 'normal',
								ttf: 'https://example.com/derive3.ttf',
							},
						],
					}),
					{ status: 200 },
				);
			}
			if (url === 'https://example.com/derive3.ttf') {
				return new Response(ttfBuffer, { status: 200 });
			}
			return new Response('Not found', { status: 404 });
		});

		const assets = await downloadFontAssets(['DeriveWoff2'], ['woff2'], [400], tempDir, '/fonts', false);
		expect(assets).toHaveLength(1);
		expect(assets[0]!.format).toBe('woff2');
	});
});
