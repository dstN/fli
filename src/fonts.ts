import fs from 'fs';
import path from 'path';
import { Font } from 'fonteditor-core';

export type FontFormat = 'ttf' | 'woff2' | 'woff' | 'eot' | 'svg';

export const SUPPORTED_FORMATS: FontFormat[] = ['ttf', 'woff2', 'woff', 'eot', 'svg'];
export const FULL_FORMATS: FontFormat[] = ['ttf', 'woff2', 'woff', 'eot', 'svg'];

const GOOGLE_WEBFONTS_HELPER_ENDPOINTS = ['https://google-webfonts-helper.herokuapp.com/api/fonts', 'https://gwfh.mranftl.com/api/fonts'];

interface WebfontHelperListItem {
	id: string;
	family: string;
}

interface WebfontHelperVariant {
	id: string;
	fontWeight: number | string;
	fontStyle?: string;
	italic?: boolean;
	files?: Record<string, string>;
	ttf?: string;
	woff2?: string;
	woff?: string;
	eot?: string;
	svg?: string;
}

interface WebfontHelperResponse {
	id?: string;
	family: string;
	variants: WebfontHelperVariant[];
}

export interface FontAsset {
	family: string;
	normalizedFamily: string;
	format: FontFormat;
	fileName: string;
	publicUrl: string;
	savedPath: string;
}

const normalizeFamily = (family: string): string =>
	family
		.trim()
		.toLowerCase()
		.replace(/\s+/g, '-')
		.replace(/[^a-z0-9\-]/g, '');

const normalizeFormatInput = (value: string): FontFormat[] => {
	const normalized = value
		.split(',')
		.map((entry) => entry.trim().toLowerCase())
		.filter(Boolean);

	if (normalized.includes('full')) {
		return FULL_FORMATS;
	}

	const requested = normalized.map((format) => format as FontFormat).filter((format) => SUPPORTED_FORMATS.includes(format));
	return requested.length > 0 ? requested : ['woff2'];
};

const fetchJson = async <T>(url: string): Promise<T> => {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`HTTP ${response.status} for ${url}`);
	}
	return response.json();
};

const fetchFontMetadata = async (family: string): Promise<WebfontHelperResponse> => {
	const fontId = normalizeFamily(family);
	const suffix = `${fontId}?subsets=latin`;
	const listSuffix = '?sort=alpha';

	for (const baseUrl of GOOGLE_WEBFONTS_HELPER_ENDPOINTS) {
		try {
			return await fetchJson<WebfontHelperResponse>(`${baseUrl}/${suffix}`);
		} catch {
			continue;
		}
	}

	for (const baseUrl of GOOGLE_WEBFONTS_HELPER_ENDPOINTS) {
		try {
			const list = await fetchJson<WebfontHelperListItem[]>(`${baseUrl}/${listSuffix}`);
			const match = list.find((item) => item.id === fontId || normalizeFamily(item.family) === fontId);
			if (match) {
				return await fetchJson<WebfontHelperResponse>(`${baseUrl}/${match.id}?subsets=latin`);
			}
		} catch {
			continue;
		}
	}

	throw new Error(`Unable to retrieve metadata for font family "${family}" from the Google Webfonts Helper API.`);
};

const parseFontWeight = (weight: number | string): number => (typeof weight === 'string' ? Number(weight.replace(/[^0-9]/g, '')) : weight);

const isItalicVariant = (variant: WebfontHelperVariant): boolean => variant.italic === true || variant.fontStyle === 'italic';

const selectVariant = (payload: WebfontHelperResponse): WebfontHelperVariant => {
	const regular = payload.variants.find((variant) => parseFontWeight(variant.fontWeight) === 400 && !isItalicVariant(variant));
	return regular ?? payload.variants[0];
};

const formatToCssFormat = (format: FontFormat): string => {
	switch (format) {
		case 'woff2':
			return 'woff2';
		case 'woff':
			return 'woff';
		case 'ttf':
			return 'truetype';
		case 'eot':
			return 'embedded-opentype';
		case 'svg':
			return 'svg';
		default:
			return format;
	}
};

const ensureBuffer = (value: ArrayBuffer | Buffer | Uint8Array): Buffer => (Buffer.isBuffer(value) ? value : Buffer.from(value instanceof Uint8Array ? value : new Uint8Array(value)));

const convertTtfToWoff2 = (ttfBuffer: Buffer): Buffer => {
	const font = Font.create(ttfBuffer, { type: 'ttf' });
	const output = font.write({ type: 'woff2' });
	return ensureBuffer(output);
};

const convertTtfToWoff = (ttfBuffer: Buffer): Buffer => {
	const font = Font.create(ttfBuffer, { type: 'ttf' });
	const output = font.write({ type: 'woff' });
	return ensureBuffer(output);
};

const convertTtfToEot = (ttfBuffer: Buffer): Buffer => {
	const font = Font.create(ttfBuffer, { type: 'ttf' });
	const output = font.write({ type: 'eot' });
	return ensureBuffer(output);
};

const convertTtfToSvg = (ttfBuffer: Buffer, family: string): Buffer => {
	const font = Font.create(ttfBuffer, { type: 'ttf' });
	const output = font.write({ type: 'svg', fontFamily: family, fullName: family });
	return ensureBuffer(output);
};

const possiblyDownload = async (url: string): Promise<Buffer> => {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to download font asset from ${url}`);
	}
	const arrayBuffer = await response.arrayBuffer();
	return Buffer.from(arrayBuffer);
};

const createFileName = (normalizedFamily: string, variantKey: string, format: FontFormat): string => `${normalizedFamily}-${variantKey}.${format}`;

const normalizePublicUrlBase = (base: string): string => {
	const trimmed = base.trim().replace(/\/+$|^\/+/, '');
	return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
};

const chooseVariantKey = (variant: WebfontHelperVariant): string => {
	if (variant.fontWeight === 400 && !variant.italic) {
		return 'regular';
	}
	return variant.italic ? `${variant.fontWeight}italic` : `${variant.fontWeight}`;
};

export const parseFormatInput = (input: string): FontFormat[] => normalizeFormatInput(input);

export const downloadFontAssets = async (families: string[], formats: FontFormat[], outputDir: string, publicUrlBase: string): Promise<FontAsset[]> => {
	const result: FontAsset[] = [];
	await fs.promises.mkdir(outputDir, { recursive: true });

	const normalizedPublicUrlBase = normalizePublicUrlBase(publicUrlBase);

	for (const family of families) {
		const metadata = await fetchFontMetadata(family);
		const variant = selectVariant(metadata);
		const normalizedFamily = normalizeFamily(family);
		const variantKey = chooseVariantKey(variant);

		const directUrls = variant.files ?? {
			ttf: variant.ttf,
			woff2: variant.woff2,
			woff: variant.woff,
			eot: variant.eot,
			svg: variant.svg,
		};
		let ttfBuffer: Buffer | null = null;

		for (const format of formats) {
			const fileName = createFileName(normalizedFamily, variantKey, format);
			const savedPath = path.join(outputDir, fileName);
			const publicUrl = `${normalizedPublicUrlBase}/${fileName}`;

			if (directUrls[format]) {
				const downloaded = await possiblyDownload(directUrls[format]);
				await fs.promises.writeFile(savedPath, downloaded);
				result.push({ family, normalizedFamily, format, fileName, publicUrl, savedPath });
				continue;
			}

			if (!ttfBuffer && directUrls.ttf) {
				ttfBuffer = await possiblyDownload(directUrls.ttf);
			}

			if (!ttfBuffer) {
				throw new Error(`Unable to fetch TTF base font for "${family}" and derive missing formats.`);
			}

			let outputBuffer: Buffer;
			switch (format) {
				case 'woff2':
					outputBuffer = convertTtfToWoff2(ttfBuffer);
					break;
				case 'woff':
					outputBuffer = convertTtfToWoff(ttfBuffer);
					break;
				case 'eot':
					outputBuffer = convertTtfToEot(ttfBuffer);
					break;
				case 'svg':
					outputBuffer = convertTtfToSvg(ttfBuffer, family);
					break;
				case 'ttf':
					outputBuffer = ttfBuffer;
					break;
				default:
					throw new Error(`Format conversion not supported for ${format}`);
			}

			await fs.promises.writeFile(savedPath, outputBuffer);
			result.push({ family, normalizedFamily, format, fileName, publicUrl, savedPath });
		}
	}

	return result;
};

export const createFontFaceDeclarations = (assets: FontAsset[]): string => {
	const groups = assets.reduce<Record<string, FontAsset[]>>((acc, asset) => {
		acc[asset.family] = acc[asset.family] ?? [];
		acc[asset.family].push(asset);
		return acc;
	}, {});

	return Object.entries(groups)
		.map(([family, group]) => {
			const ordered = [...group].sort((left, right) => SUPPORTED_FORMATS.indexOf(left.format) - SUPPORTED_FORMATS.indexOf(right.format));
			const sources = ordered.map((asset) => `  url('${asset.publicUrl}') format('${formatToCssFormat(asset.format)}')`).join(',\n');

			return `@font-face {
  font-family: '${family}';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: ${sources};
}`;
		})
		.join('\n\n');
};
