/**
 * src/utils/font-io.ts
 *
 * Font binary validation, atomic disk I/O, and format conversions
 * powered by fonteditor-core.
 */

import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { Font, woff2 } from 'fonteditor-core';
import type { FontFormat } from '../fonts.js';

/**
 * Validate TrueType / OpenType TTF magic bytes (`0x00010000` or `OTTO`).
 */
export const isValidTtf = (buf: Buffer): boolean => {
	if (buf.length < 4) return false;
	const sig = buf.readUInt32BE(0);
	return sig === 0x00010000 || sig === 0x4f54544f;
};

/**
 * Validate WOFF2 magic bytes (`wOF2` = 0x774f4632).
 */
export const isValidWoff2 = (buf: Buffer): boolean =>
	buf.length >= 4 && buf.readUInt32BE(0) === 0x774f4632;

const ensureBuffer = (value: ArrayBuffer | Buffer | Uint8Array): Buffer =>
	Buffer.isBuffer(value)
		? value
		: Buffer.from(value instanceof Uint8Array ? value : new Uint8Array(value));

/**
 * Convert a TTF Buffer into another web font format (woff2, woff, eot, svg).
 */
export const convertTtf = async (
	ttfBuffer: Buffer,
	format: Exclude<FontFormat, 'ttf'>,
	family: string,
): Promise<Buffer> => {
	if (!isValidTtf(ttfBuffer)) {
		throw new Error(
			`Downloaded font for "${family}" appears corrupted (invalid TTF magic bytes). ` +
				`Try re-running fli or downloading the font manually from https://fonts.google.com`,
		);
	}

	const font = Font.create(ttfBuffer, { type: 'ttf' });

	switch (format) {
		case 'woff2':
			await woff2.init();
			return ensureBuffer(font.write({ type: 'woff2' }) as unknown as ArrayBuffer);
		case 'woff':
			return ensureBuffer(font.write({ type: 'woff' }) as unknown as ArrayBuffer);
		case 'eot':
			return ensureBuffer(font.write({ type: 'eot' }) as unknown as ArrayBuffer);
		case 'svg': {
			const svgStr = font.write({ type: 'svg' }) as unknown as string;
			return Buffer.from(svgStr, 'utf8');
		}
	}
};

/**
 * Write a file atomically: write to a temporary file in the same directory,
 * then rename over the destination.
 */
export const atomicWriteFile = async (destPath: string, data: Buffer): Promise<void> => {
	const dir = path.dirname(destPath);
	await fs.promises.mkdir(dir, { recursive: true });
	const tmpPath = path.join(dir, `.fli-font-${randomUUID()}.tmp`);

	try {
		await fs.promises.writeFile(tmpPath, data);
		await fs.promises.rename(tmpPath, destPath);
	} catch (err) {
		await fs.promises.unlink(tmpPath).catch(() => {});
		throw err;
	}
};

/**
 * Check if a font file already exists on disk and has non-zero size.
 */
export const fontFileExists = async (filePath: string): Promise<boolean> => {
	try {
		const stat = await fs.promises.stat(filePath);
		return stat.size > 0;
	} catch {
		return false;
	}
};
