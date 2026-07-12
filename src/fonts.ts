/**
 * src/fonts.ts
 *
 * Core font asset resolution, multi-weight orchestration, and CSS @font-face generation.
 *
 * Modularized architecture:
 *  - Network & concurrency utilities: src/utils/http.ts
 *  - Disk caching: src/utils/cache.ts
 *  - Binary validation & format conversions: src/utils/font-io.ts
 *  - Resolution strategies: src/resolvers/ (gwfh, css2, official-api)
 */

import path from 'path';
import { downloadBuffer, downloadToFile, pLimit } from './utils/http.js';
import { clearCache } from './utils/cache.js';
import {
	isValidTtf,
	isValidWoff2,
	convertTtf,
	atomicWriteFile,
	fontFileExists,
} from './utils/font-io.js';
import {
	normalizeFamily,
	parseFormatInput,
	parseWeightInput,
} from './utils/normalize.js';
import { fetchGwfhForWeight, type ResolvedFontMetadata } from './resolvers/gwfh.js';
import { fetchFromGoogleCss } from './resolvers/css2.js';
import { fetchFromOfficialApi } from './resolvers/official-api.js';

// ---------------------------------------------------------------------------
// Public Types & Constants
// ---------------------------------------------------------------------------

export type FontFormat = 'ttf' | 'woff2' | 'woff' | 'eot' | 'svg';

export const SUPPORTED_FORMATS: FontFormat[] = ['ttf', 'woff2', 'woff', 'eot', 'svg'];
export const FULL_FORMATS: FontFormat[] = ['ttf', 'woff2', 'woff', 'eot', 'svg'];

export interface FontAsset {
	family: string;
	normalizedFamily: string;
	format: FontFormat;
	fileName: string;
	publicUrl: string;
	savedPath: string;
	fontWeight?: number;
	fontStyle?: string;
}

export { normalizeFamily, parseFormatInput, parseWeightInput, clearCache };

// ---------------------------------------------------------------------------
// Hybrid Resolution Strategy Orchestration
// ---------------------------------------------------------------------------

const resolveFontMetadata = async (
	family: string,
	weight = 400,
): Promise<ResolvedFontMetadata> => {
	const errors: string[] = [];

	try {
		return await fetchGwfhForWeight(family, weight);
	} catch (err) {
		errors.push(`GWFH API: ${err instanceof Error ? err.message : String(err)}`);
	}

	try {
		return await fetchFromGoogleCss(family, weight);
	} catch (err) {
		errors.push(`Google CSS: ${err instanceof Error ? err.message : String(err)}`);
	}

	if (process.env.GOOGLE_FONTS_API_KEY) {
		try {
			return await fetchFromOfficialApi(family, weight);
		} catch (err) {
			errors.push(`Official API: ${err instanceof Error ? err.message : String(err)}`);
		}
	}

	throw new Error(
		`Unable to retrieve metadata for font "${family}" (weight ${weight}). Attempted sources failed:\n` +
			errors.map((e) => `  • ${e}`).join('\n'),
	);
};

// ---------------------------------------------------------------------------
// Single Family Processing
// ---------------------------------------------------------------------------

const processSingleFamily = async (
	family: string,
	formats: FontFormat[],
	weights: number[],
	outputDir: string,
	publicUrlBase: string,
	dryRun: boolean,
): Promise<FontAsset[]> => {
	const normalizedFamily = normalizeFamily(family);
	const result: FontAsset[] = [];

	for (const weight of weights) {
		const metadata = await resolveFontMetadata(family, weight);
		let ttfBuffer: Buffer | null = null;

		for (const format of formats) {
			const weightSuffix = weight === 400 ? 'regular' : String(weight);
			const fileName = `${normalizedFamily}-${weightSuffix}.${format}`;
			const publicUrl = `${publicUrlBase.replace(/\/$/, '')}/${fileName}`;
			const savedPath = path.join(outputDir, fileName);

			if (!dryRun && (await fontFileExists(savedPath))) {
				result.push({
					family,
					normalizedFamily,
					format,
					fileName,
					publicUrl,
					savedPath,
					fontWeight: metadata.fontWeight,
					fontStyle: metadata.fontStyle,
				});
				continue;
			}

			const directUrl = metadata.urls[format];

			if (directUrl) {
				if (!dryRun) {
					await downloadToFile(directUrl, savedPath);
				}
				result.push({
					family,
					normalizedFamily,
					format,
					fileName,
					publicUrl,
					savedPath,
					fontWeight: metadata.fontWeight,
					fontStyle: metadata.fontStyle,
				});
				continue;
			}

			if (!ttfBuffer) {
				const ttfUrl = metadata.urls['ttf'];
				if (!ttfUrl) {
					throw new Error(
						`Unable to fetch TTF base font for "${family}" weight ${weight} to derive missing formats.`,
					);
				}
				ttfBuffer = await downloadBuffer(ttfUrl);
				if (!isValidTtf(ttfBuffer)) {
					throw new Error(
						`Downloaded TTF for "${family}" appears corrupted. ` +
							`Try re-running fli or downloading the font manually from https://fonts.google.com`,
					);
				}
			}

			if (format === 'ttf') {
				if (!dryRun) await atomicWriteFile(savedPath, ttfBuffer);
			} else {
				const converted = await convertTtf(ttfBuffer, format, family);

				if (format === 'woff2' && !isValidWoff2(converted)) {
					throw new Error(`WOFF2 conversion for "${family}" produced an invalid file.`);
				}

				if (!dryRun) await atomicWriteFile(savedPath, converted);
			}

			result.push({
				family,
				normalizedFamily,
				format,
				fileName,
				publicUrl,
				savedPath,
				fontWeight: metadata.fontWeight,
				fontStyle: metadata.fontStyle,
			});
		}
	}

	return result;
};

// ---------------------------------------------------------------------------
// downloadFontAssets
// ---------------------------------------------------------------------------

export const downloadFontAssets = async (
	families: string[],
	formats: FontFormat[],
	weights: number[] = [400],
	outputDir: string,
	publicUrlBase: string,
	dryRun = false,
): Promise<FontAsset[]> => {
	const limit = pLimit(4);

	const outcomes = await Promise.allSettled(
		families.map((family) =>
			limit(() =>
				processSingleFamily(family, formats, weights, outputDir, publicUrlBase, dryRun),
			),
		),
	);

	const assets: FontAsset[] = [];
	const failures: string[] = [];

	outcomes.forEach((outcome, idx) => {
		if (outcome.status === 'fulfilled') {
			assets.push(...outcome.value);
		} else {
			const reason =
				outcome.reason instanceof Error
					? outcome.reason.message
					: String(outcome.reason);
			failures.push(`[${families[idx]}]: ${reason}`);
		}
	});

	if (failures.length > 0) {
		throw new Error(
			`Failed to download ${failures.length} font(s):\n` +
				failures.map((f) => `  • ${f}`).join('\n'),
		);
	}

	return assets;
};

// ---------------------------------------------------------------------------
// createFontFaceDeclarations
// ---------------------------------------------------------------------------

const FORMAT_CSS_NAMES: Record<FontFormat, string> = {
	woff2: 'woff2',
	woff: 'woff',
	ttf: 'truetype',
	eot: 'embedded-opentype',
	svg: 'svg',
};

export const createFontFaceDeclarations = (assets: FontAsset[]): string => {
	const groups = new Map<string, FontAsset[]>();

	for (const asset of assets) {
		const weight = asset.fontWeight ?? 400;
		const style = asset.fontStyle ?? 'normal';
		const key = `${asset.family}|${weight}|${style}`;

		const existing = groups.get(key) ?? [];
		existing.push(asset);
		groups.set(key, existing);
	}

	return Array.from(groups.values())
		.map((groupAssets) => {
			const first = groupAssets[0]!;
			const sorted = [...groupAssets].sort(
				(a, b) =>
					SUPPORTED_FORMATS.indexOf(a.format) - SUPPORTED_FORMATS.indexOf(b.format),
			);

			const sources = sorted
				.map((asset) => {
					const url = asset.publicUrl.replace(/\\/g, '/');
					const cssFormat = FORMAT_CSS_NAMES[asset.format];
					return `url('${url}') format('${cssFormat}')`;
				})
				.join(',\n  ');

			return `@font-face {\n  font-family: '${first.family}';\n  font-style: ${first.fontStyle ?? 'normal'};\n  font-weight: ${first.fontWeight ?? 400};\n  font-display: swap;\n  src: ${sources};\n}`;
		})
		.join('\n\n');
};
