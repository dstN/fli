#!/usr/bin/env node

/**
 * src/index.ts
 *
 * CLI Entrypoint for @dstn/fli.
 */

import { intro, spinner, outro, log } from '@clack/prompts';
import { parseCliFlags, printVersionAndExit, printHelpAndExit } from './cli/args.js';
import { runInteractivePrompts } from './cli/prompts.js';
import { executeFli } from './core.js';

const main = async (): Promise<void> => {
	const flags = parseCliFlags();

	if (flags.version) printVersionAndExit();
	if (flags.help) printHelpAndExit();

	intro('fli — Google Webfonts Local Importer (GDPR compliant)');

	const projectRoot = process.cwd();
	const options = await runInteractivePrompts(projectRoot, {
		font: flags.font,
		format: flags.format,
		weight: flags.weight,
		framework: flags.framework,
		css: flags.css,
		dryRun: flags['dry-run'],
		verbose: flags.verbose,
	});

	const s = spinner();
	s.start(`Downloading fonts and updating CSS...`);

	try {
		const result = await executeFli(options);
		s.stop(`Done!`);

		if (result.injectedFamilies.length > 0) {
			outro(
				`Successfully imported ${result.filesWritten} font file(s) to ${result.outputDir} ` +
					`and injected @font-face rules into ${options.cssPath}`,
			);
		} else if (result.skippedFamilies.length > 0) {
			outro(
				`Font files verified in ${result.outputDir}. ` +
					`Skipped CSS injection (@font-face rules already exist for: ${result.skippedFamilies.join(', ')}).`,
			);
		} else {
			outro(`Done (dry run — no files written).`);
		}
	} catch (err: unknown) {
		s.stop(`Error occurred`);
		const msg = err instanceof Error ? err.message : String(err);
		log.error(msg);
		process.exit(1);
	}
};

main();
