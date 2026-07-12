/**
 * src/cli/prompts.ts
 *
 * Interactive terminal UI wizard using @clack/prompts.
 */

import path from 'path';
import { text, select, multiselect, isCancel, cancel } from '@clack/prompts';
import { detectFramework, FRAMEWORKS, type FrameworkKey, manualFrameworkOptions } from '../frameworks.js';
import { parseFormatInput, parseWeightInput, SUPPORTED_FORMATS } from '../fonts.js';
import type { FliOptions } from '../core.js';

const normalizeFontInput = (input: string): string[] =>
	input
		.split(',')
		.map((f) => f.trim())
		.filter((f) => f.length > 0);

const normalizeFormatChoice = (input: string): string => {
	const trimmed = input.trim().toLowerCase();
	if (trimmed === '' || trimmed === 'woff2') return 'woff2';
	if (trimmed === 'full') return 'full';
	if (SUPPORTED_FORMATS.includes(trimmed as any)) return trimmed;
	return 'woff2';
};

const cancelAndExit = (): never => {
	cancel('Operation cancelled.');
	process.exit(0);
};

export const runInteractivePrompts = async (
	projectRoot: string,
	initialFlags: {
		font?: string;
		format?: string;
		weight?: string;
		framework?: string;
		css?: string;
		verbose?: boolean;
		dryRun?: boolean;
	},
): Promise<FliOptions> => {
	// 1. Fonts
	let fonts: string[];
	if (initialFlags.font) {
		fonts = normalizeFontInput(initialFlags.font);
	} else {
		const rawFonts = await text({
			message: 'Which Google font families do you want to import?',
			placeholder: 'e.g. Inter, Roboto',
			validate(value) {
				if (!value || value.trim().length === 0) {
					return 'Please enter at least one font family name.';
				}
			},
		});
		if (isCancel(rawFonts)) cancelAndExit();
		fonts = normalizeFontInput(rawFonts as string);
	}

	// 2. Formats
	let formatChoice: string;
	if (initialFlags.format) {
		formatChoice = normalizeFormatChoice(initialFlags.format);
	} else {
		const rawFormat = await multiselect({
			message: 'Select font formats to download:',
			options: [
				{ value: 'woff2', label: 'WOFF2 (Recommended for modern browsers)' },
				{ value: 'woff', label: 'WOFF' },
				{ value: 'ttf', label: 'TTF' },
				{ value: 'full', label: 'All formats (WOFF2, WOFF, TTF, EOT, SVG)' },
			],
			initialValues: ['woff2'],
			required: true,
		});
		if (isCancel(rawFormat)) cancelAndExit();
		const selected = rawFormat as string[];
		formatChoice = selected.includes('full') ? 'full' : selected.join(',');
	}

	// 3. Weights
	let weightChoice: string;
	if (initialFlags.weight) {
		weightChoice = initialFlags.weight;
	} else {
		const rawWeights = await multiselect({
			message: 'Select font weights to import:',
			options: [
				{ value: '300', label: '300 (Light)' },
				{ value: '400', label: '400 (Regular)' },
				{ value: '500', label: '500 (Medium)' },
				{ value: '600', label: '600 (Semi-Bold)' },
				{ value: '700', label: '700 (Bold)' },
			],
			initialValues: ['400'],
			required: true,
		});
		if (isCancel(rawWeights)) cancelAndExit();
		weightChoice = (rawWeights as string[]).join(',');
	}

	// 4. Framework
	let frameworkKey: FrameworkKey;
	if (
		initialFlags.framework &&
		Object.prototype.hasOwnProperty.call(FRAMEWORKS, initialFlags.framework)
	) {
		frameworkKey = initialFlags.framework as FrameworkKey;
	} else {
		const detected = detectFramework(projectRoot);
		if (detected && detected.key !== 'vanilla') {
			frameworkKey = detected.key;
		} else {
			const choice = await select({
				message: 'Which web framework are you using?',
				options: manualFrameworkOptions,
			});
			if (isCancel(choice)) cancelAndExit();
			frameworkKey = choice as FrameworkKey;
		}
	}

	// 5. CSS Path
	let cssPath: string;
	if (initialFlags.css) {
		cssPath = path.resolve(projectRoot, initialFlags.css);
	} else {
		const DEFAULT_CSS_PATHS: Record<FrameworkKey, string> = {
			next: 'src/app/globals.css',
			nuxt: 'assets/css/main.css',
			vite: 'src/index.css',
			vanilla: 'styles.css',
		};
		const defaultCss = DEFAULT_CSS_PATHS[frameworkKey] ?? 'styles.css';
		const rawCss = await text({
			message: 'Path to target CSS file:',
			defaultValue: defaultCss,
			placeholder: defaultCss,
		});
		if (isCancel(rawCss)) cancelAndExit();
		cssPath = path.resolve(projectRoot, rawCss as string);
	}

	return {
		fonts,
		formats: parseFormatInput(formatChoice),
		weights: parseWeightInput(weightChoice),
		frameworkKey,
		cssPath,
		projectRoot,
		dryRun: initialFlags.dryRun ?? false,
		verbose: initialFlags.verbose ?? false,
	};
};
