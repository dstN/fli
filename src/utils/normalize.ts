/**
 * src/utils/normalize.ts
 *
 * Normalization utilities for font family IDs, formats, and weights.
 */

import { SUPPORTED_FORMATS, FULL_FORMATS, type FontFormat } from '../fonts.js';

export const normalizeFamily = (family: string): string =>
	family
		.trim()
		.toLowerCase()
		.replace(/\s+/g, '-')
		.replace(/[^a-z0-9-]/g, '');

export const parseFontWeight = (weight: number | string): number =>
	typeof weight === 'string' ? Number(weight.replace(/\D/g, '')) || 400 : weight;

export const parseFormatInput = (input: string): FontFormat[] => {
	const normalized = input
		.split(',')
		.map((e) => e.trim().toLowerCase())
		.filter(Boolean);

	if (normalized.includes('full')) return FULL_FORMATS;

	const requested = normalized
		.map((f) => f as FontFormat)
		.filter((f) => SUPPORTED_FORMATS.includes(f));

	return requested.length > 0 ? requested : ['woff2'];
};

export const parseWeightInput = (input: string): number[] => {
	if (!input || !input.trim()) return [400];
	const weights = input
		.split(',')
		.map((w) => parseInt(w.trim(), 10))
		.filter((w) => !isNaN(w) && w >= 100 && w <= 900);
	return weights.length > 0 ? weights : [400];
};
