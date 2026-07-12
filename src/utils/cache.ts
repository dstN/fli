/**
 * src/utils/cache.ts
 *
 * Persistent JSON disk cache in ~/.cache/fli/ with atomic file writes.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';

export const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const CACHE_DIR = path.join(os.homedir(), '.cache', 'fli');

export const getCached = async <T>(key: string): Promise<T | null> => {
	const filePath = path.join(CACHE_DIR, `${key}.json`);
	try {
		const stat = await fs.promises.stat(filePath);
		if (Date.now() - stat.mtimeMs > CACHE_TTL_MS) return null;
		const raw = await fs.promises.readFile(filePath, 'utf8');
		return JSON.parse(raw) as T;
	} catch {
		return null;
	}
};

export const setCache = async <T>(key: string, data: T): Promise<void> => {
	await fs.promises.mkdir(CACHE_DIR, { recursive: true });
	const tmpPath = path.join(CACHE_DIR, `${key}.${randomUUID()}.tmp`);
	try {
		await fs.promises.writeFile(tmpPath, JSON.stringify(data), 'utf8');
		await fs.promises.rename(tmpPath, path.join(CACHE_DIR, `${key}.json`));
	} catch {
		await fs.promises.unlink(tmpPath).catch(() => {});
	}
};

export const clearCache = async (): Promise<void> => {
	await fs.promises.rm(CACHE_DIR, { recursive: true, force: true }).catch(() => {});
};
