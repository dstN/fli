import { describe, expect, it } from 'vitest';
import { parseFormatInput } from '../src/fonts';

describe('font format parsing', () => {
	it('returns woff2 when input is blank', () => {
		expect(parseFormatInput('')).toEqual(['woff2']);
	});

	it('parses comma-separated formats', () => {
		expect(parseFormatInput('woff2, woff, ttf')).toEqual(['woff2', 'woff', 'ttf']);
	});

	it('returns full format set when input contains full', () => {
		expect(parseFormatInput('full')).toEqual(['ttf', 'woff2', 'woff', 'eot', 'svg']);
	});

	it('ignores unsupported format names', () => {
		expect(parseFormatInput('woff2, invalid, svg')).toEqual(['woff2', 'svg']);
	});
});
