/**
 * The error taxonomy the UI renders against.
 *
 * Each of these produces a different, actionable message. "Something went
 * wrong" is not a state a broker can do anything with — the useful distinction
 * is between *this carrier does not exist*, *the service is down*, and *this
 * deployment is misconfigured*, because only one of those is worth retrying.
 */
export type LookupErrorKind =
  /** No `FMCSA_WEB_KEY` in the environment. A deployment problem, not a user problem. */
  | "missing-api-key"
  /** The webKey was rejected. Also a deployment problem — see the note below. */
  | "unauthorized"
  /** The API answered, and there is no carrier with that number. */
  | "not-found"
  /** Too many requests, either ours upstream or the visitor's against us. */
  | "rate-limited"
  /** FMCSA returned 5xx. */
  | "upstream-error"
  /** FMCSA did not answer inside the timeout. */
  | "timeout"
  /** DNS, TLS, connection reset. */
  | "network-error"
  /** 200 with a body that is not the documented shape. */
  | "malformed-response";

export class CarrierLookupError extends Error {
  readonly kind: LookupErrorKind;
  /** Upstream HTTP status, when there was one. */
  readonly status?: number;

  constructor(kind: LookupErrorKind, message: string, status?: number) {
    super(message);
    this.name = "CarrierLookupError";
    this.kind = kind;
    this.status = status;
  }
}

export function isCarrierLookupError(
  error: unknown,
): error is CarrierLookupError {
  return error instanceof CarrierLookupError;
}

/**
 * Whether retrying the same request could plausibly succeed. Drives whether
 * the UI offers a retry button.
 */
export function isRetryable(kind: LookupErrorKind): boolean {
  return (
    kind === "rate-limited" ||
    kind === "upstream-error" ||
    kind === "timeout" ||
    kind === "network-error"
  );
}

/**
 * Strip the webKey out of anything before it is logged or shown.
 *
 * QCMobile takes its credential as a **query parameter**, which means the key
 * is inside every request URL. Any code path that logs a URL, echoes a failed
 * request, or attaches one to an error message leaks it. Rather than trying to
 * remember not to do that, every string that could contain a URL goes through
 * here first.
 */
export function redactWebKey(text: string): string {
  return text.replace(/([?&]webKey=)[^&\s"']*/gi, "$1REDACTED");
}
