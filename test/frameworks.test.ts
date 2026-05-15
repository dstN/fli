import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { detectFramework, FRAMEWORKS } from '../src/frameworks';

const makeTempProject = async (pkg: Record<string, unknown>) => {
	const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fli-framework-'));
	await fs.writeFile(path.join(tempDir, 'package.json'), JSON.stringify(pkg), 'utf8');
	return tempDir;
};

describe('framework detection', () => {
	it('detects Next.js when next is a dependency', async () => {
		const tempDir = await makeTempProject({ dependencies: { next: '^14.0.0' } });
		const result = detectFramework(tempDir);
		expect(result).toEqual(FRAMEWORKS.next);
		await fs.rm(tempDir, { recursive: true, force: true });
	});

	it('detects Nuxt when nuxt is a dependency', async () => {
		const tempDir = await makeTempProject({ dependencies: { nuxt: '^4.0.0' } });
		const result = detectFramework(tempDir);
		expect(result).toEqual(FRAMEWORKS.nuxt);
		await fs.rm(tempDir, { recursive: true, force: true });
	});

	it('detects Vite when vite is a dependency', async () => {
		const tempDir = await makeTempProject({ dependencies: { vite: '^5.0.0' } });
		const result = detectFramework(tempDir);
		expect(result).toEqual(FRAMEWORKS.vite);
		await fs.rm(tempDir, { recursive: true, force: true });
	});

	it('returns unknown when no framework is identified', async () => {
		const tempDir = await makeTempProject({ dependencies: { lodash: '^4.17.0' } });
		const result = detectFramework(tempDir);
		expect(result).toEqual(FRAMEWORKS.unknown);
		await fs.rm(tempDir, { recursive: true, force: true });
	});
});
