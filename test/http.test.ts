import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchWithRetry, fetchJson, downloadBuffer, pLimit } from '../src/utils/http.js';

describe('src/utils/http.ts utilities', () => {
	const origFetch = global.fetch;

	afterEach(() => {
		global.fetch = origFetch;
	});

	it('pLimit limits concurrency and queues excess tasks', async () => {
		const limit = pLimit(2);
		let running = 0;
		let maxRunning = 0;

		const task = async () => {
			running++;
			if (running > maxRunning) maxRunning = running;
			await new Promise((r) => setTimeout(r, 10));
			running--;
			return 'done';
		};

		const results = await Promise.all([
			limit(task),
			limit(task),
			limit(task),
			limit(task),
			limit(task),
		]);

		expect(results).toEqual(['done', 'done', 'done', 'done', 'done']);
		expect(maxRunning).toBeLessThanOrEqual(2);
	});

	it('fetchWithRetry retries on 429 rate limit response and succeeds', async () => {
		let attempts = 0;
		global.fetch = vi.fn().mockImplementation(async () => {
			attempts++;
			if (attempts === 1) {
				return new Response('Rate limited', {
					status: 429,
					headers: { 'Retry-After': '0' },
				});
			}
			return new Response('OK', { status: 200 });
		});

		const res = await fetchWithRetry('https://example.com/test', 2);
		expect(res.status).toBe(200);
		expect(attempts).toBe(2);
	});

	it('fetchJson throws error on non-OK response', async () => {
		global.fetch = vi.fn().mockImplementation(async () => {
			return new Response('Not Found', { status: 404 });
		});

		await expect(fetchJson('https://example.com/missing')).rejects.toThrow('HTTP 404');
	});

	it('downloadBuffer throws on non-OK response', async () => {
		global.fetch = vi.fn().mockImplementation(async () => {
			return new Response('Error', { status: 500 });
		});

		await expect(downloadBuffer('https://example.com/buffer')).rejects.toThrow('Failed to fetch');
	});

	it('fetchWithRetry throws when fetch rejects on all attempts', async () => {
		global.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));
		await expect(fetchWithRetry('https://example.com/net-fail', 1)).rejects.toThrow('Network failure');
	});
});
