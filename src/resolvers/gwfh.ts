/**
 * src/resolvers/gwfh.ts
 *
 * Strategy 1: Resolve metadata and URLs via google-webfonts-helper API.
 */

import { fetchWithRetry, fetchJson } from '../utils/http.js';
import { getCached, setCache } from '../utils/cache.js';
import { normalizeFamily, parseFontWeight } from '../utils/normalize.js';
import type { FontFormat } from '../fonts.js';

export const GWFH_BASE = 'https://gwfh.mranftl.com/api/fonts';

export interface GwfhVariant {
	id: string;
	fontWeight: number | string;
	fontStyle?: string;
	italic?: boolean;
	files?: Partial<Record<FontFormat, string>>;
	ttf?: string;
	woff2?: string;
	woff?: string;
	eot?: string;
	svg?: string;
}

export interface GwfhResponse {
	id?: string;
	family: string;
	variants: GwfhVariant[];
}

export interface GwfhListItem {
	id: string;
	family: string;
}

export interface ResolvedFontMetadata {
	family: string;
	urls: Partial<Record<FontFormat, string>>;
	fontWeight: number;
	fontStyle: string;
}

const isItalicVariant = (v: GwfhVariant): boolean =>
	v.italic === true || v.fontStyle === 'italic';

export const selectGwfhVariantByWeight = (
	variants: GwfhVariant[],
	weight: number,
	italic = false,
): GwfhVariant | null => {
	return (
		variants.find(
			(v) =>
				parseFontWeight(v.fontWeight) === weight &&
				(italic ? isItalicVariant(v) : !isItalicVariant(v)),
		) ?? null
	);
};

export const selectGwfhVariant = (variants: GwfhVariant[]): GwfhVariant => {
	const regular = variants.find(
		(v) => parseFontWeight(v.fontWeight) === 400 && !isItalicVariant(v),
	);
	if (regular) return regular;
	return variants[0]!;
};

export const fetchGwfhForWeight = async (
	family: string,
	weight = 400,
): Promise<ResolvedFontMetadata> => {
	const fontId = normalizeFamily(family);
	const cacheKey = `gwfh-${fontId}`;

	let payload = await getCached<GwfhResponse>(cacheKey);

	if (!payload) {
		let fetched: GwfhResponse | null = null;
		try {
			const res = await fetchWithRetry(`${GWFH_BASE}/${fontId}?subsets=latin`);
			if (res.ok) {
				fetched = (await res.json()) as GwfhResponse;
			}
		} catch {
			// fall through to list lookup
		}

		if (!fetched) {
			const list = await fetchJson<GwfhListItem[]>(`${GWFH_BASE}?sort=alpha`);
			const match = list.find(
				(item) => item.id === fontId || normalizeFamily(item.family) === fontId,
			);
			if (!match) throw new Error(`Font "${family}" not found in GWFH list`);
			const res = await fetchWithRetry(`${GWFH_BASE}/${match.id}?subsets=latin`);
			if (!res.ok) throw new Error(`GWFH returned HTTP ${res.status} for ${match.id}`);
			fetched = (await res.json()) as GwfhResponse;
		}

		payload = fetched;
		await setCache(cacheKey, payload);
	}

	const variant =
		selectGwfhVariantByWeight(payload.variants, weight) ??
		selectGwfhVariant(payload.variants);

	const directUrls = variant.files ?? {
		ttf: variant.ttf,
		woff2: variant.woff2,
		woff: variant.woff,
		eot: variant.eot,
		svg: variant.svg,
	};

	return {
		family: payload.family,
		urls: directUrls as Partial<Record<FontFormat, string>>,
		fontWeight: parseFontWeight(variant.fontWeight),
		fontStyle: isItalicVariant(variant) ? 'italic' : 'normal',
	};
};
