import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		environment: 'node',
		include: ['test/**/*.test.ts'],
		globals: true,
		coverage: {
			provider: 'v8',
			include: ['src/**/*.ts'],
			exclude: [
				'src/index.ts', // CLI entrypoint — tested via E2E
				'src/cli/**',   // Interactive terminal prompts & flag parsing — tested via E2E
			],
			thresholds: {
				branches: 80,
				functions: 85,
				lines: 85,
				statements: 85,
			},
		},
	},
});
