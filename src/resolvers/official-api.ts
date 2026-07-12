/**
 * src/resolvers/official-api.ts
 *
 * Strategy 3: Resolve metadata via Official Google Fonts Webfonts API v1
 * when GOOGLE_FONTS_API_KEY is available.
 */

import { fetchJson } from '../utils/http.js';
import type { FontFormat } from '../fonts.js';
import type { ResolvedFontMetadata } from './gwfh.js';

interface GoogleFontItem {
	family: string;
	files: Record<string, string>;
}

interface GoogleFontsApiResponse {
	items?: GoogleFontItem[];
}

export const fetchFromOfficialApi = async (
	family: string,
	weight = 400,
): Promise<ResolvedFontMetadata> => {
	const apiKey = process.env.GOOGLE_FONTS_API_KEY;
	if (!apiKey) {
		throw new Error(
			'Official Google Fonts API key not provided (set GOOGLE_FONTS_API_KEY environment variable)',
		);
	}

	const url = `https://www.googleapis.com/webfonts/v1/webfonts?key=${encodeURIComponent(
		apiKey,
	)}&family=${encodeURIComponent(family)}`;

	const data = await fetchJson<GoogleFontsApiResponse>(url);
	const item = data.items?.find(
		(i) => i.family.toLowerCase() === family.toLowerCase(),
	);
	if (!item) throw new Error(`Font "${family}" not found via Official API`);

	const weightKey = weight === 400 ? 'regular' : String(weight);
	const ttfUrl = item.files[weightKey] ?? item.files['regular'];
	if (!ttfUrl) throw new Error(`No TTF file URL found in Official API response for "${family}"`);

	return {
		family: item.family,
		urls: { ttf: ttfUrl } as Partial<Record<FontFormat, string>>,
		fontWeight: weight,
		fontStyle: 'normal',
	};
};
