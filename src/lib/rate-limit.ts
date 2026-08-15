import "server-only";

/**
 * A small fixed-window rate limiter.
 *
 * The problem it solves is specific to this app: the FMCSA webKey belongs to
 * whoever deployed the site, but the search box is open to the internet. One
 * script hitting it in a loop spends someone else's quota and gets the key
 * throttled. A per-visitor cap makes casual abuse not worth the effort.
 *
 * Honest limitations, because a limiter that is trusted for more than it does
 * is worse than none:
 *
 * - State is in process memory. On Vercel each serverless instance keeps its
 *   own counter, so the effective limit is per instance, not global.
 * - It resets on cold start.
 * - The client IP comes from proxy headers, which a determined caller can
 *   rotate.
 *
 * It is a speed bump, not a security control. Durable limiting would need a
 * shared store, and that is a dependency this project does not otherwise need.
 */

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Seconds until the window resets. */
  retryAfterSeconds: number;
}

export const DEFAULT_RATE_LIMIT: RateLimitOptions = {
  limit: 20,
  windowMs: 60_000,
};

export function checkRateLimit(
  key: string,
  options: RateLimitOptions = DEFAULT_RATE_LIMIT,
  now: number = Date.now(),
): RateLimitResult {
  pruneExpired(now);

  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + options.windowMs });
    return {
      allowed: true,
      remaining: options.limit - 1,
      retryAfterSeconds: Math.ceil(options.windowMs / 1000),
    };
  }

  existing.count += 1;
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((existing.resetAt - now) / 1000),
  );

  if (existing.count > options.limit) {
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  return {
    allowed: true,
    remaining: options.limit - existing.count,
    retryAfterSeconds,
  };
}

/**
 * Drop expired windows so the map cannot grow without bound on a long-lived
 * instance. Cheap because expired entries are removed on the same pass that
 * would otherwise have to walk them anyway.
 */
function pruneExpired(now: number): void {
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

/** Test seam — there is no other reason to clear the counters. */
export function resetRateLimits(): void {
  windows.clear();
}

/**
 * Best-effort client identity from proxy headers.
 *
 * `x-forwarded-for` is a comma-separated chain; the left-most entry is the
 * original client. Falls back to a single shared bucket, which fails closed
 * onto a stricter limit rather than opening it up.
 */
export function clientKeyFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || "unknown-client";
}
