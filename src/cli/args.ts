/**
 * src/cli/args.ts
 *
 * CLI arguments definition, parsing, and help/version banners.
 */

import fs from 'fs';
import { parseArgs } from 'node:util';
import { SUPPORTED_FORMATS } from '../fonts.js';

export interface CliFlags {
	font?: string;
	format?: string;
	weight?: string;
	framework?: string;
	css?: string;
	'dry-run': boolean;
	version: boolean;
	help: boolean;
	verbose: boolean;
}

export const parseCliFlags = (): CliFlags => {
	const { values } = parseArgs({
		options: {
			font:      { type: 'string' },
			format:    { type: 'string' },
			weight:    { type: 'string' },
			framework: { type: 'string' },
			css:       { type: 'string' },
			'dry-run': { type: 'boolean', default: false },
			version:   { type: 'boolean', default: false },
			help:      { type: 'boolean', default: false },
			verbose:   { type: 'boolean', default: false },
		},
		strict: false,
		allowPositionals: false,
	});

	return values as unknown as CliFlags;
};

export const printVersionAndExit = (): never => {
	const pkgPath = new URL('../../package.json', import.meta.url);
	const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { version: string };
	process.stdout.write(`${pkg.version}\n`);
	process.exit(0);
};

export const printHelpAndExit = (): never => {
	process.stdout.write(`
fli — Fonts Local Importer

USAGE
  npx fli [options]

OPTIONS
  --font <names>       Comma-separated font family names (e.g. "Inter, Roboto")
  --format <formats>   Comma-separated formats: ttf, woff2, woff, eot, svg, or "full"
                       Defaults to woff2.
  --weight <weights>   Comma-separated font weights: 400, 700. Defaults to 400.
  --framework <key>    Framework key: next | nuxt | vite | vanilla
                       If omitted, fli will auto-detect or prompt.
  --css <path>         Path to the CSS file to inject @font-face rules into
  --dry-run            Preview actions without writing any files
  --verbose            Print detailed per-step logs
  --version            Print version and exit
  --help               Show this help message

EXAMPLES
  npx fli
  npx fli --font "Inter" --format woff2 --framework next --css src/app/globals.css
  npx fli --font "Roboto, Open Sans" --format full --dry-run
  npx fli --font "Inter" --framework vite --css src/styles.css --verbose

SUPPORTED FORMATS
  ${SUPPORTED_FORMATS.join(', ')}, full (all of the above)

NOTES
  Set GOOGLE_FONTS_API_KEY env var to enable the official Google Fonts API as
  a last-resort fallback when all other data sources are unavailable.
`);
	process.exit(0);
};
