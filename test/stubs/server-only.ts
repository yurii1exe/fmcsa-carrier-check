/**
 * Stub for the `server-only` package, used by vitest.
 *
 * The real package throws on import outside a React Server Component, which is
 * the point of it — it turns "this module must not reach the browser" into a
 * build error. Unit tests are neither a browser nor an RSC, so they get this
 * empty module instead. Nothing else imports it.
 */
export {};
