import fs from 'fs';
import path from 'path';

export type FrameworkKey = 'next' | 'nuxt' | 'vite' | 'unknown';

export interface FrameworkInfo {
	key: FrameworkKey;
	displayName: string;
	assetDirectory: string;
	publicUrl: string;
}

export const FRAMEWORKS: Record<FrameworkKey, FrameworkInfo> = {
	next: {
		key: 'next',
		displayName: 'Next.js',
		assetDirectory: 'public/fonts',
		publicUrl: '/fonts',
	},
	nuxt: {
		key: 'nuxt',
		displayName: 'Nuxt.js',
		assetDirectory: 'public/fonts',
		publicUrl: '/fonts',
	},
	vite: {
		key: 'vite',
		displayName: 'Vite',
		assetDirectory: 'public/fonts',
		publicUrl: '/fonts',
	},
	unknown: {
		key: 'unknown',
		displayName: 'Unknown',
		assetDirectory: 'public/fonts',
		publicUrl: '/fonts',
	},
};

export const detectFramework = (projectRoot: string): FrameworkInfo => {
	const packageJsonPath = path.resolve(projectRoot, 'package.json');
	if (!fs.existsSync(packageJsonPath)) {
		return FRAMEWORKS.unknown;
	}

	try {
		const raw = fs.readFileSync(packageJsonPath, 'utf8');
		const manifest = JSON.parse(raw) as Record<string, unknown>;
		const dependencies = {
			...(manifest.dependencies as Record<string, string> | undefined),
			...(manifest.devDependencies as Record<string, string> | undefined),
			...(manifest.peerDependencies as Record<string, string> | undefined),
		};

		if (dependencies.next) {
			return FRAMEWORKS.next;
		}

		if (dependencies.nuxt || dependencies['nuxt-edge'] || dependencies['@nuxtjs/kit']) {
			return FRAMEWORKS.nuxt;
		}

		if (dependencies.vite) {
			return FRAMEWORKS.vite;
		}
	} catch {
		return FRAMEWORKS.unknown;
	}

	return FRAMEWORKS.unknown;
};

export const manualFrameworkOptions = [
	{ label: 'Next.js', value: 'next' as FrameworkKey },
	{ label: 'Nuxt.js', value: 'nuxt' as FrameworkKey },
	{ label: 'Vite', value: 'vite' as FrameworkKey },
];
