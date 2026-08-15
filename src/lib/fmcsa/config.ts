import "server-only";

/**
 * Configuration, read from the environment on the server only.
 *
 * The `server-only` import above is the enforcement, not a comment: if any
 * client component ever imports this module, even transitively, the build
 * fails rather than shipping the key to the browser. The variable is
 * deliberately *not* prefixed `NEXT_PUBLIC_`, which is the other half of the
 * guarantee — Next only inlines `NEXT_PUBLIC_*` into client bundles.
 *
 * There is no hardcoded fallback key here and there must never be one. A
 * credential committed "temporarily" is a credential committed.
 */

export const FMCSA_BASE_URL = "https://mobile.fmcsa.dot.gov/qc/services";

/** How long a carrier response stays cached, in seconds. */
export const CACHE_TTL_SECONDS = 60 * 60;

/** Upstream request timeout, in milliseconds. */
export const REQUEST_TIMEOUT_MS = 10_000;

/**
 * The FMCSA webKey, or null when it is not configured.
 *
 * Returning null rather than throwing lets the app render an explanatory
 * setup page instead of a stack trace, which is what a stranger cloning the
 * repo should see.
 */
export function getWebKey(): string | null {
  const key = process.env.FMCSA_WEB_KEY?.trim();
  return key && key.length > 0 ? key : null;
}

export function isConfigured(): boolean {
  return getWebKey() !== null;
}
