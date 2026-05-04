/**
 * In-process token-bucket rate limiter.
 *
 * Used by /api/auth/login to slow brute-force attempts. Single-process state
 * — when HireWire is deployed across multiple instances, this only protects
 * against a single instance being hammered. A shared Redis-backed limiter
 * would be the next step; the interface stays the same.
 */
export interface RateLimitOptions {
	max: number; // max requests in the window
	windowSeconds: number; // sliding window size
	now?: () => number;
}

export interface RateLimitResult {
	allowed: boolean;
	remaining: number;
	resetSeconds: number;
}

interface BucketState {
	hits: number[];
}

export class RateLimiter {
	private readonly buckets = new Map<string, BucketState>();
	private readonly max: number;
	private readonly windowMs: number;
	private readonly now: () => number;

	constructor(opts: RateLimitOptions) {
		this.max = opts.max;
		this.windowMs = opts.windowSeconds * 1000;
		this.now = opts.now ?? (() => Date.now());
	}

	check(key: string): RateLimitResult {
		const now = this.now();
		const cutoff = now - this.windowMs;
		let bucket = this.buckets.get(key);
		if (!bucket) {
			bucket = { hits: [] };
			this.buckets.set(key, bucket);
		}
		// Drop hits outside the window.
		bucket.hits = bucket.hits.filter((t) => t > cutoff);
		if (bucket.hits.length >= this.max) {
			const oldest = bucket.hits[0];
			const resetMs = oldest + this.windowMs - now;
			return {
				allowed: false,
				remaining: 0,
				resetSeconds: Math.max(0, Math.ceil(resetMs / 1000)),
			};
		}
		bucket.hits.push(now);
		return {
			allowed: true,
			remaining: this.max - bucket.hits.length,
			resetSeconds: Math.ceil(this.windowMs / 1000),
		};
	}

	/** Test seam — clear all bucket state. */
	reset(): void {
		this.buckets.clear();
	}
}

/** Shared instance for /api/auth/login: 5 attempts per 15 minutes per key. */
export const loginLimiter = new RateLimiter({ max: 5, windowSeconds: 15 * 60 });

/** Extract a stable rate-limit key from an incoming Request. */
export function rateLimitKey(request: Request): string {
	// Prefer X-Forwarded-For if present (set by proxies); fall back to a
	// constant so dev environments don't divide by undefined.
	const xff = request.headers.get('x-forwarded-for');
	if (xff) return xff.split(',')[0].trim();
	const real = request.headers.get('x-real-ip');
	if (real) return real.trim();
	return 'unknown';
}
