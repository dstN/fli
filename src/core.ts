/**
 * src/core.ts
 *
 * Pure orchestration layer — no CLI prompts, no process.exit().
 * This module is fully unit-testable with mocked fetch and real temp dirs.
 */

import path from 'path';
import fs from 'fs';
import type { FontFormat } from './fonts.js';
import type { FrameworkKey } from './frameworks.js';
import { downloadFontAssets } from './fonts.js';
import { ensureCssFile, injectFontFaceRules } from './css.js';
import { FRAMEWORKS } from './frameworks.js';

// ---------------------------------------------------------------------------
// Public option types
// ---------------------------------------------------------------------------

export interface FliOptions {
	/** Raw font family names exactly as the user entered them (e.g. ['Open Sans', 'Roboto']). */
	fonts: string[];
	/** Resolved formats to download. */
	formats: FontFormat[];
	/** Resolved font weights to download (e.g. [400, 700]). Defaults to [400]. */
	weights: number[];
	/** Resolved framework key used to determine the asset directory. */
	frameworkKey: FrameworkKey;
	/** Absolute path to the target CSS file. */
	cssPath: string;
	/** The project root used to resolve relative paths. */
	projectRoot: string;
	/** When true, no files are written and no CSS is modified. */
	dryRun?: boolean;
	/** When true, emit verbose per-step logs via the provided logger. */
	verbose?: boolean;
	/** Optional logger — defaults to console. Swap out in tests. */
	logger?: Pick<Console, 'info' | 'warn' | 'error'>;
}

export interface FliResult {
	/** Number of font files written to disk (0 in dry-run). */
	filesWritten: number;
	/** Absolute directory where fonts were saved. */
	outputDir: string;
	/** Font families whose @font-face was injected into the CSS. */
	injectedFamilies: string[];
	/** Font families that were already present in the CSS and skipped. */
	skippedFamilies: string[];
	/** The public URL base used (e.g. '/fonts'). */
	publicUrlBase: string;
}

// ---------------------------------------------------------------------------
// executeFli
// ---------------------------------------------------------------------------

export const executeFli = async (options: FliOptions): Promise<FliResult> => {
	const {
		fonts,
		formats,
		weights,
		frameworkKey,
		cssPath,
		projectRoot,
		dryRun = false,
		verbose = false,
		logger = console,
	} = options;

	const vlog = (msg: string) => { if (verbose) logger.info(msg); };

	const frameworkInfo = FRAMEWORKS[frameworkKey] ?? FRAMEWORKS.vanilla;
	const outputDir = path.resolve(projectRoot, frameworkInfo.assetDirectory);
	const publicUrlBase = frameworkInfo.publicUrl;

	vlog(`Framework: ${frameworkInfo.displayName} → ${frameworkInfo.assetDirectory}`);
	vlog(`Output dir: ${outputDir}`);
	vlog(`CSS target: ${cssPath}`);

	// Ensure the CSS file exists before downloading (fail fast on bad paths)
	if (!dryRun) {
		await ensureCssFile(cssPath);
	}

	const assets = await downloadFontAssets(fonts, formats, weights, outputDir, publicUrlBase, dryRun);
	vlog(`Downloaded/resolved ${assets.length} font file(s).`);

	let injectedFamilies: string[] = [];
	let skippedFamilies: string[] = [];

	if (!dryRun) {
		// ---------------------------------------------------------------------------
		// Rollback: take a backup of the CSS file before modifying it.
		// If injection throws, we restore the original content.
		// ---------------------------------------------------------------------------
		const backupPath = `${cssPath}.fli-backup`;
		await fs.promises.copyFile(cssPath, backupPath);
		vlog(`Backup created at ${backupPath}`);

		try {
			const result = await injectFontFaceRules(cssPath, assets);
			injectedFamilies = result.injected;
			skippedFamilies = result.skipped;
			if (injectedFamilies.length > 0) vlog(`Injected: ${injectedFamilies.join(', ')}`);
			if (skippedFamilies.length > 0) vlog(`Skipped (already present): ${skippedFamilies.join(', ')}`);
		} catch (err) {
			// Restore original CSS on failure
			logger.error('CSS injection failed — rolling back to original file.');
			await fs.promises.copyFile(backupPath, cssPath).catch(() => {});
			throw err;
		} finally {
			// Always clean up the backup
			await fs.promises.unlink(backupPath).catch(() => {});
		}
	} else {
		injectedFamilies = [...new Set(assets.map((a) => a.family))];
	}

	return {
		filesWritten: dryRun ? 0 : assets.length,
		outputDir,
		injectedFamilies,
		skippedFamilies,
		publicUrlBase,
	};
};
