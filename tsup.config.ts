import type { Options } from 'tsup';

const config: Options = {
	entry: ['src/index.ts'],
	bundle: true,
	clean: true,
	platform: 'node',
	target: 'node18',
	format: ['cjs'],
	outDir: 'dist',
	sourcemap: false,
	dts: false,
};

export default config;
