import fs from 'fs';
import path from 'path';
import { FontAsset, createFontFaceDeclarations } from './fonts';

export const ensureCssFile = async (cssPath: string): Promise<void> => {
	const directory = path.dirname(cssPath);
	await fs.promises.mkdir(directory, { recursive: true });

	if (!fs.existsSync(cssPath)) {
		await fs.promises.writeFile(cssPath, '', 'utf8');
	}
};

export const injectFontFaceRules = async (cssPath: string, assets: FontAsset[]): Promise<void> => {
	const content = await fs.promises.readFile(cssPath, 'utf8');
	const lines = content.split(/\r?\n/);
	const lastImportIndex = lines
		.map((line) => line.trim())
		.reduce((lastIndex, line, index) => {
			if (line.startsWith('@import') && line.endsWith(';')) {
				return index;
			}
			return lastIndex;
		}, -1);

	const injection = createFontFaceDeclarations(assets);
	const insertionIndex = lastImportIndex >= 0 ? lastImportIndex + 1 : 0;
	const updatedLines = [...lines];

	if (insertionIndex === 0) {
		if (content.trim().length > 0) {
			updatedLines.unshift('');
		}
		updatedLines.unshift(injection);
	} else {
		updatedLines.splice(insertionIndex, 0, '', injection);
	}

	await fs.promises.writeFile(cssPath, updatedLines.join('\n'), 'utf8');
};
