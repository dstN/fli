/**
 * src/css.ts
 *
 * CSS file initialization and atomic @font-face rule injection.
 */

import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import type { FontAsset } from './fonts.js';
import { createFontFaceDeclarations } from './fonts.js';
import { fontFaceExistsInCss, findLastImportIndex } from './utils/css-parser.js';

export { fontFaceExistsInCss };

// ---------------------------------------------------------------------------
// ensureCssFile — atomic create-if-not-exists (fixes TOCTOU race)
// ---------------------------------------------------------------------------

export const ensureCssFile = async (cssPath: string): Promise<void> => {
	await fs.promises.mkdir(path.dirname(cssPath), { recursive: true });
	try {
		await fs.promises.writeFile(cssPath, '', { flag: 'wx', encoding: 'utf8' });
	} catch (err: unknown) {
		if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
	}
};

// ---------------------------------------------------------------------------
// atomicWrite — write-then-rename to avoid partial writes
// ---------------------------------------------------------------------------

const atomicWrite = async (filePath: string, content: string): Promise<void> => {
	const tmpPath = `${filePath}.${randomUUID()}.tmp`;
	try {
		await fs.promises.writeFile(tmpPath, content, 'utf8');
		await fs.promises.rename(tmpPath, filePath);
	} catch (err) {
		await fs.promises.unlink(tmpPath).catch(() => {});
		throw err;
	}
};

// ---------------------------------------------------------------------------
// injectFontFaceRules — with duplicate detection and atomic write
// ---------------------------------------------------------------------------

export const injectFontFaceRules = async (
	cssPath: string,
	assets: FontAsset[],
): Promise<{ injected: string[]; skipped: string[] }> => {
	const content = await fs.promises.readFile(cssPath, 'utf8');
	const lines = content.replace(/\r\n/g, '\n').split('\n');

	const toInject = assets.filter((a) => !fontFaceExistsInCss(content, a.family));
	const skipped = [
		...new Set(
			assets.filter((a) => fontFaceExistsInCss(content, a.family)).map((a) => a.family),
		),
	];
	const injected = [...new Set(toInject.map((a) => a.family))];

	if (toInject.length === 0) {
		return { injected: [], skipped };
	}

	const injection = createFontFaceDeclarations(toInject);
	const lastImportIndex = findLastImportIndex(lines);
	const insertionIndex = lastImportIndex >= 0 ? lastImportIndex + 1 : 0;

	const updatedLines = [...lines];
	if (insertionIndex === 0) {
		updatedLines.unshift(injection);
		if (content.trim().length > 0) {
			updatedLines.splice(1, 0, '');
		}
	} else {
		updatedLines.splice(insertionIndex, 0, '', injection);
	}

	await atomicWrite(cssPath, updatedLines.join('\n'));
	return { injected, skipped };
};
