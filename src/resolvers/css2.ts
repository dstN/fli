/**
 * src/resolvers/css2.ts
 *
 * Strategy 2: Resolve font URLs by parsing fonts.googleapis.com/css2 output.
 */

import { fetchWithRetry } from '../utils/http.js';
import type { FontFormat } from '../fonts.js';
import type { ResolvedFontMetadata } from './gwfh.js';

const MODERN_UA =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const parseCssSrcUrls = (css: string, format: FontFormat): string[] => {
	const urlMatches = [...css.matchAll(/url\((['"]?)([^'")\s]+)\1\)/g)];
	return urlMatches.map((m) => m[2]!).filter((u) => u.endsWith(`.${format}`));
};

export const fetchFromGoogleCss = async (
	family: string,
	weight = 400,
): Promise<ResolvedFontMetadata> => {
	const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
		family,
	)}:wght@${weight}&display=swap`;

	const resWoff2 = await fetchWithRetry(cssUrl, 3, { 'User-Agent': MODERN_UA });
	if (!resWoff2.ok) throw new Error(`Google Fonts CSS returned HTTP ${resWoff2.status}`);

	const cssContent = await resWoff2.text();
	const woff2Urls = parseCssSrcUrls(cssContent, 'woff2');
	const ttfUrls = parseCssSrcUrls(cssContent, 'ttf');

	const urls: Partial<Record<FontFormat, string>> = {};
	if (woff2Urls[0]) urls.woff2 = woff2Urls[0];
	if (ttfUrls[0]) urls.ttf = ttfUrls[0];

	if (Object.keys(urls).length === 0) {
		throw new Error(`No font URLs could be parsed from Google Fonts CSS for "${family}"`);
	}

	return {
		family,
		urls,
		fontWeight: weight,
		fontStyle: 'normal',
	};
};
