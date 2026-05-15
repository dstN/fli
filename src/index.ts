#!/usr/bin/env node

import path from 'path';
import { intro, text, select, isCancel, spinner, outro, cancel } from '@clack/prompts';
import { detectFramework, FRAMEWORKS, FrameworkKey, manualFrameworkOptions } from './frameworks';
import { downloadFontAssets, parseFormatInput, SUPPORTED_FORMATS } from './fonts';
import { ensureCssFile, injectFontFaceRules } from './css';

const getFrameworkSelection = async (projectRoot: string): Promise<FrameworkKey> => {
	const mode = await select({
		message: 'Which wrapper are you using?',
		options: [
			{ label: 'Detect automatically', value: 'detect' },
			{ label: 'Manual selection', value: 'manual' },
		],
	});

	if (isCancel(mode)) {
		cancel('Operation cancelled.');
		process.exit(0);
	}

	if (mode === 'detect') {
		const detected = detectFramework(projectRoot);
		if (detected.key !== 'unknown') {
			return detected.key;
		}

		const fallback = await select({
			message: 'Automatic detection could not identify a framework. Please select one manually:',
			options: manualFrameworkOptions,
		});

		if (isCancel(fallback)) {
			cancel('Operation cancelled.');
			process.exit(0);
		}

		return fallback as FrameworkKey;
	}

	const manualSelection = await select({
		message: 'Please select your wrapper manually:',
		options: manualFrameworkOptions,
	});

	if (isCancel(manualSelection)) {
		cancel('Operation cancelled.');
		process.exit(0);
	}

	return manualSelection as FrameworkKey;
};

const normalizeFontInput = (input: string): string[] =>
	input
		.split(',')
		.map((font) => font.trim())
		.filter((font) => font.length > 0);

const normalizeFormatChoice = (input: string): string => {
	const trimmed = input.trim().toLowerCase();
	if (trimmed === '') {
		return 'woff2';
	}

	if (trimmed === 'full' || SUPPORTED_FORMATS.includes(trimmed as any)) {
		return trimmed;
	}

	return 'woff2';
};

const run = async (): Promise<void> => {
	intro('Welcome to fli — Fonts Local Importer');
	const projectRoot = process.cwd();

	const fontInput = await text({
		message: 'Name of font you want to import (you can name multiple by comma separating):',
		placeholder: 'Open Sans, Roboto, Inter',
	});

	if (isCancel(fontInput)) {
		cancel('Operation cancelled.');
		process.exit(0);
	}

	const fonts = normalizeFontInput(fontInput);
	if (fonts.length === 0) {
		cancel('No font names were provided.');
		process.exit(1);
	}

	const formatInput = await text({
		message: 'Which formats? (default is woff2). You can choose between: ttf, woff2, woff, eot, svg, or full:',
		placeholder: 'woff2',
	});

	if (isCancel(formatInput)) {
		cancel('Operation cancelled.');
		process.exit(0);
	}

	const normalizedFormatInput = normalizeFormatChoice(formatInput);
	const selectedFormats = parseFormatInput(normalizedFormatInput);

	const frameworkKey = await getFrameworkSelection(projectRoot);
	const frameworkInfo = FRAMEWORKS[frameworkKey] ?? FRAMEWORKS.vanilla;

	const cssInput = await text({
		message: 'Name the css file you want to import it to (e.g., globals.css or src/style.css):',
		placeholder: 'globals.css',
	});

	if (isCancel(cssInput)) {
		cancel('Operation cancelled.');
		process.exit(0);
	}

	const cssPath = path.resolve(projectRoot, cssInput.trim());
	await ensureCssFile(cssPath);

	const outputDir = path.resolve(projectRoot, frameworkInfo.assetDirectory);
	const loading = spinner();
	loading.start('Downloading fonts and generating local assets...');

	try {
		const assets = await downloadFontAssets(fonts, selectedFormats, outputDir, frameworkInfo.publicUrl);
		await injectFontFaceRules(cssPath, assets);
		loading.stop('Fonts downloaded and CSS updated.');

		outro(`Successfully saved ${assets.length} font files to ${frameworkInfo.assetDirectory} and updated ${path.relative(projectRoot, cssPath)}.`);
	} catch (error) {
		loading.stop('Failed to complete font import.');
		const message = error instanceof Error ? error.message : 'Unknown error';
		cancel(message);
		process.exit(1);
	}
};

run();
