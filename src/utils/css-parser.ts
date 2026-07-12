/**
 * src/utils/css-parser.ts
 *
 * Pure CSS inspection and parsing utilities:
 *  - Stripping block comments
 *  - Detecting existing @font-face declarations
 *  - Finding the last @import statement insertion point
 */

/**
 * Matches a valid CSS @import line in multiple forms:
 *   @import "foo.css";
 *   @import url("foo.css");
 *   @import url(foo.css);
 *   @import 'foo.css' layer;
 * Handles optional leading whitespace. Does NOT match commented-out imports.
 */
export const IMPORT_LINE_RE =
	/^\s*@import\s+(?:url\(\s*['"]?[^'"\s)]+['"]?\s*\)|['"][^'"]+['"])[^;]*;/;

/** Strip CSS block comments while preserving line count (replace content with spaces). */
export const stripBlockComments = (css: string): string =>
	css.replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ' '));

/**
 * Duplicate detection — check if a family is already injected in the CSS.
 */
export const fontFaceExistsInCss = (css: string, family: string): boolean => {
	const escaped = family.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	return new RegExp(
		`@font-face\\s*\\{[^}]*font-family:\\s*['"]${escaped}['"]`,
		'i',
	).test(css);
};

/**
 * Find line index of the last valid @import statement in the CSS lines.
 */
export const findLastImportIndex = (lines: string[]): number => {
	const stripped = stripBlockComments(lines.join('\n')).split('\n');
	let lastIndex = -1;
	for (let i = 0; i < stripped.length; i++) {
		if (IMPORT_LINE_RE.test(stripped[i]!)) {
			lastIndex = i;
		}
	}
	return lastIndex;
};
