/**
 * Tiny in-memory sliding-window rate limiter. Adequate for a single instance;
 * if you scale horizontally, swap the backing store for Redis. Buckets are
 * keyed by an arbitrary string (here: the key token hash and the client IP).
 */

type Hit = { count: number; resetAt: number };

const buckets = new Map<string, Hit>();

// How many requests per window, and the window length (ms).
const LIMIT = Number(process.env.UPLOAD_RATE_LIMIT ?? 30);
const WINDOW_MS = Number(process.env.UPLOAD_RATE_WINDOW_MS ?? 60_000);

export type RateResult = {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export function rateLimit(key: string, now = Date.now()): RateResult {
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true, remaining: LIMIT - 1, retryAfterSeconds: 0 };
  }

  if (existing.count >= LIMIT) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  existing.count += 1;
  return {
    ok: true,
    remaining: LIMIT - existing.count,
    retryAfterSeconds: 0,
  };
}

// Opportunistically evict stale buckets so the map can't grow unbounded.
export function sweepRateBuckets(now = Date.now()): void {
  for (const [k, v] of buckets) {
    if (v.resetAt <= now) buckets.delete(k);
  }
}
