/**
 * src/utils/http.ts
 *
 * HTTP utilities with exponential backoff, rate limiting handling,
 * streaming file downloads, and zero-dependency concurrency control.
 */

import path from 'path';
import fs from 'fs';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

export const FETCH_TIMEOUT_MS = 20_000;
export const FETCH_RETRIES = 3;

/**
 * Fetch with timeout and exponential backoff retry.
 * Handles 429 rate limits and 5xx server errors.
 */
export const fetchWithRetry = async (
	url: string,
	retries = FETCH_RETRIES,
	headers?: Record<string, string>,
): Promise<Response> => {
	let lastError: unknown;

	for (let attempt = 0; attempt <= retries; attempt++) {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

		try {
			const res = await fetch(url, {
				headers,
				signal: controller.signal,
			});
			clearTimeout(timer);

			// Retry on 429 or 5xx server errors
			if ((res.status === 429 || res.status >= 500) && attempt < retries) {
				const retryAfterHeader = res.headers.get('Retry-After');
				const delayMs = retryAfterHeader
					? parseInt(retryAfterHeader, 10) * (process.env.VITEST ? 5 : 1000)
					: process.env.VITEST
						? 5
						: 2 ** attempt * 500;
				await new Promise((r) => setTimeout(r, delayMs));
				continue;
			}
			return res;
		} catch (err) {
			clearTimeout(timer);
			lastError = err;
			if (attempt < retries) {
				await new Promise((r) =>
					setTimeout(r, process.env.VITEST ? 5 : 2 ** attempt * 500),
				);
			}
		}
	}
	throw lastError ?? new Error(`All ${retries + 1} attempts failed for ${url}`);
};

/**
 * Fetch and parse JSON payload with automatic retries.
 */
export const fetchJson = async <T>(url: string): Promise<T> => {
	const res = await fetchWithRetry(url);
	if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
	return res.json() as Promise<T>;
};

/**
 * Download a remote resource into an in-memory Buffer.
 */
export const downloadBuffer = async (url: string): Promise<Buffer> => {
	const res = await fetchWithRetry(url);
	if (!res.ok) throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`);
	const arrayBuffer = await res.arrayBuffer();
	return Buffer.from(arrayBuffer);
};

/**
 * Stream a remote URL directly to disk without holding the whole binary in memory.
 */
export const downloadToFile = async (url: string, destPath: string): Promise<void> => {
	const res = await fetchWithRetry(url);
	if (!res.ok) throw new Error(`Failed to download ${url}: HTTP ${res.status}`);

	await fs.promises.mkdir(path.dirname(destPath), { recursive: true }).catch(() => {});

	if (res.body && typeof (res.body as any).getReader === 'function') {
		const fileStream = fs.createWriteStream(destPath);
		await pipeline(Readable.fromWeb(res.body as any), fileStream);
	} else {
		const arrayBuffer = await res.arrayBuffer();
		await fs.promises.writeFile(destPath, Buffer.from(arrayBuffer));
	}
};

/**
 * Zero-dependency concurrency limiter (p-limit replacement).
 */
export const pLimit = (concurrency: number) => {
	const queue: Array<() => void> = [];
	let active = 0;

	const next = () => {
		active--;
		if (queue.length > 0) {
			const fn = queue.shift()!;
			fn();
		}
	};

	return <T>(fn: () => Promise<T>): Promise<T> =>
		new Promise<T>((resolve, reject) => {
			const run = async () => {
				active++;
				try {
					resolve(await fn());
				} catch (err) {
					reject(err);
				} finally {
					next();
				}
			};

			if (active < concurrency) {
				run();
			} else {
				queue.push(run);
			}
		});
};
