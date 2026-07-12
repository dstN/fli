import fs from 'fs';
import path from 'path';

export type FrameworkKey = 'next' | 'nuxt' | 'vite' | 'vanilla';

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
	vanilla: {
		key: 'vanilla',
		displayName: 'Vanilla / Other',
		assetDirectory: 'public/fonts',
		publicUrl: '/fonts',
	},
};

/**
 * Detects the framework from the project's package.json.
 * Returns FRAMEWORKS.vanilla when detection is impossible.
 */
export const detectFramework = (projectRoot: string): FrameworkInfo => {
	const packageJsonPath = path.resolve(projectRoot, 'package.json');

	if (!fs.existsSync(packageJsonPath)) {
		return FRAMEWORKS.vanilla;
	}

	let manifest: Record<string, unknown>;
	try {
		const raw = fs.readFileSync(packageJsonPath, 'utf8');
		manifest = JSON.parse(raw) as Record<string, unknown>;
	} catch {
		return FRAMEWORKS.vanilla;
	}

	const deps: Record<string, string> = {
		...(manifest['dependencies'] as Record<string, string> | undefined),
		...(manifest['devDependencies'] as Record<string, string> | undefined),
		...(manifest['peerDependencies'] as Record<string, string> | undefined),
	};

	// Detection priority: Next > Nuxt > Vite
	if (deps['next']) return FRAMEWORKS.next;

	if (deps['nuxt'] || deps['nuxt-edge'] || deps['@nuxtjs/kit']) {
		return FRAMEWORKS.nuxt;
	}

	if (deps['vite']) return FRAMEWORKS.vite;

	return FRAMEWORKS.vanilla;
};

export const manualFrameworkOptions = [
	{ label: 'Next.js', value: 'next' as FrameworkKey },
	{ label: 'Nuxt.js', value: 'nuxt' as FrameworkKey },
	{ label: 'Vite', value: 'vite' as FrameworkKey },
	{ label: 'Vanilla / Other', value: 'vanilla' as FrameworkKey },
];
