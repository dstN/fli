import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { detectFramework, FRAMEWORKS } from '../src/frameworks.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tempDir: string;

beforeEach(async () => {
	tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fli-framework-'));
});

afterEach(async () => {
	await fs.rm(tempDir, { recursive: true, force: true });
});

const writePackageJson = async (pkg: Record<string, unknown>) => {
	await fs.writeFile(path.join(tempDir, 'package.json'), JSON.stringify(pkg), 'utf8');
};

// ---------------------------------------------------------------------------
// Detection tests
// ---------------------------------------------------------------------------

describe('detectFramework', () => {
	it('detects Next.js when "next" is a dependency', async () => {
		await writePackageJson({ dependencies: { next: '^14.0.0' } });
		expect(detectFramework(tempDir)).toEqual(FRAMEWORKS.next);
	});

	it('detects Next.js when "next" is a devDependency', async () => {
		await writePackageJson({ devDependencies: { next: '^14.0.0' } });
		expect(detectFramework(tempDir)).toEqual(FRAMEWORKS.next);
	});

	it('detects Nuxt when "nuxt" is a dependency', async () => {
		await writePackageJson({ dependencies: { nuxt: '^4.0.0' } });
		expect(detectFramework(tempDir)).toEqual(FRAMEWORKS.nuxt);
	});

	it('detects Nuxt when "nuxt-edge" is a dependency', async () => {
		await writePackageJson({ dependencies: { 'nuxt-edge': '^4.0.0' } });
		expect(detectFramework(tempDir)).toEqual(FRAMEWORKS.nuxt);
	});

	it('detects Nuxt when "@nuxtjs/kit" is a dependency', async () => {
		await writePackageJson({ dependencies: { '@nuxtjs/kit': '^3.0.0' } });
		expect(detectFramework(tempDir)).toEqual(FRAMEWORKS.nuxt);
	});

	it('detects Vite when "vite" is a dependency', async () => {
		await writePackageJson({ dependencies: { vite: '^5.0.0' } });
		expect(detectFramework(tempDir)).toEqual(FRAMEWORKS.vite);
	});

	it('detects framework from peerDependencies', async () => {
		await writePackageJson({ peerDependencies: { next: '^14.0.0' } });
		expect(detectFramework(tempDir)).toEqual(FRAMEWORKS.next);
	});

	it('returns vanilla when no framework is identified', async () => {
		await writePackageJson({ dependencies: { lodash: '^4.17.0' } });
		expect(detectFramework(tempDir)).toEqual(FRAMEWORKS.vanilla);
	});

	it('returns vanilla when package.json does not exist', () => {
		expect(detectFramework('/nonexistent-path-fli-test')).toEqual(FRAMEWORKS.vanilla);
	});

	it('returns vanilla when package.json contains malformed JSON', async () => {
		await fs.writeFile(path.join(tempDir, 'package.json'), '{INVALID JSON', 'utf8');
		expect(detectFramework(tempDir)).toEqual(FRAMEWORKS.vanilla);
	});

	it('returns vanilla when package.json exists but has no dependencies', async () => {
		await writePackageJson({ name: 'my-app', version: '1.0.0' });
		expect(detectFramework(tempDir)).toEqual(FRAMEWORKS.vanilla);
	});

	// Priority tests: Next > Nuxt > Vite
	it('prefers Next.js over Nuxt when both are present', async () => {
		await writePackageJson({ dependencies: { next: '^14.0.0', nuxt: '^4.0.0' } });
		expect(detectFramework(tempDir)).toEqual(FRAMEWORKS.next);
	});

	it('prefers Next.js over Vite when both are present', async () => {
		await writePackageJson({ dependencies: { next: '^14.0.0', vite: '^5.0.0' } });
		expect(detectFramework(tempDir)).toEqual(FRAMEWORKS.next);
	});

	it('prefers Nuxt over Vite when both are present', async () => {
		await writePackageJson({ dependencies: { nuxt: '^4.0.0', vite: '^5.0.0' } });
		expect(detectFramework(tempDir)).toEqual(FRAMEWORKS.nuxt);
	});
});

// ---------------------------------------------------------------------------
// FRAMEWORKS registry completeness
// ---------------------------------------------------------------------------

describe('FRAMEWORKS registry', () => {
	it('contains entries for next, nuxt, vite, and vanilla', () => {
		expect(Object.keys(FRAMEWORKS)).toContain('next');
		expect(Object.keys(FRAMEWORKS)).toContain('nuxt');
		expect(Object.keys(FRAMEWORKS)).toContain('vite');
		expect(Object.keys(FRAMEWORKS)).toContain('vanilla');
	});

	it('all framework entries have required fields', () => {
		for (const [key, info] of Object.entries(FRAMEWORKS)) {
			expect(info.key).toBe(key);
			expect(info.displayName).toBeTruthy();
			expect(info.assetDirectory).toBeTruthy();
			expect(info.publicUrl).toBeTruthy();
		}
	});

	it('all publicUrl values start with /', () => {
		for (const info of Object.values(FRAMEWORKS)) {
			expect(info.publicUrl.startsWith('/')).toBe(true);
		}
	});
});
