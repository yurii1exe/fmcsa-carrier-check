import "server-only";

import {
  CACHE_TTL_SECONDS,
  FMCSA_BASE_URL,
  REQUEST_TIMEOUT_MS,
  getWebKey,
} from "./config";
import { CarrierLookupError, redactWebKey } from "./errors";
import {
  extractCarriers,
  isAuthFailureMessage,
  readEnvelope,
} from "./parse";
import type { CarrierId } from "./identifier";
import type { CarrierRecord } from "./types";

/**
 * The only place in the app that talks to FMCSA.
 *
 * Everything above this file deals in `CarrierRecord` and
 * `CarrierLookupError`; nothing above it sees a URL, a status code or the
 * webKey.
 */

function buildUrl(id: CarrierId, webKey: string): string {
  const path =
    id.kind === "dot"
      ? `/carriers/${encodeURIComponent(id.value)}`
      : `/carriers/docket-number/${encodeURIComponent(id.value)}`;

  const url = new URL(`${FMCSA_BASE_URL}${path}`);
  url.searchParams.set("webKey", webKey);
  return url.toString();
}

/**
 * Look a carrier up by USDOT or docket number.
 *
 * Throws `CarrierLookupError` for every failure mode. The caller renders the
 * `kind`; it never has to interpret an HTTP status.
 */
export async function lookupCarrier(id: CarrierId): Promise<CarrierRecord> {
  const webKey = getWebKey();
  if (!webKey) {
    throw new CarrierLookupError(
      "missing-api-key",
      "FMCSA_WEB_KEY is not set on this deployment.",
    );
  }

  const url = buildUrl(id, webKey);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json" },
      // FMCSA census and safety data is refreshed on a slow cycle — snapshots
      // are monthly, inspection and crash counts update within a few days.
      // Re-fetching per request would add latency and burn quota for data that
      // cannot have changed. One hour is well inside the data's own resolution.
      next: { revalidate: CACHE_TTL_SECONDS, tags: ["fmcsa-carrier"] },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (cause) {
    // AbortSignal.timeout rejects with a TimeoutError DOMException.
    if (cause instanceof Error && cause.name === "TimeoutError") {
      throw new CarrierLookupError(
        "timeout",
        `FMCSA did not respond within ${REQUEST_TIMEOUT_MS / 1000} seconds.`,
      );
    }
    throw new CarrierLookupError(
      "network-error",
      redactWebKey(
        cause instanceof Error ? cause.message : "Could not reach FMCSA.",
      ),
    );
  }

  if (response.status === 429) {
    throw new CarrierLookupError(
      "rate-limited",
      "FMCSA is rate limiting this key.",
      429,
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw new CarrierLookupError(
      "unauthorized",
      "FMCSA rejected the API key.",
      response.status,
    );
  }

  if (response.status >= 500) {
    throw new CarrierLookupError(
      "upstream-error",
      `FMCSA returned ${response.status}.`,
      response.status,
    );
  }

  // Below here the body matters, including on 404 — see the comment in
  // parse.ts about auth failures arriving as 404 with a string body.
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    if (response.status === 404) {
      throw new CarrierLookupError("not-found", notFoundMessage(id), 404);
    }
    throw new CarrierLookupError(
      "malformed-response",
      `FMCSA returned ${response.status} with a body that is not JSON.`,
      response.status,
    );
  }

  const envelope = readEnvelope(body);
  if (!envelope) {
    throw new CarrierLookupError(
      "malformed-response",
      "FMCSA returned JSON in an unexpected shape.",
      response.status,
    );
  }

  // A bad webKey is an HTTP 404 with `{"content":"Webkey not found"}`. Without
  // this check it would surface to the user as "carrier not found", and they
  // would go looking for a problem with the DOT number they typed.
  if (isAuthFailureMessage(envelope.contentMessage)) {
    throw new CarrierLookupError(
      "unauthorized",
      "FMCSA rejected the API key.",
      response.status,
    );
  }

  if (response.status === 404) {
    throw new CarrierLookupError("not-found", notFoundMessage(id), 404);
  }

  if (!response.ok) {
    throw new CarrierLookupError(
      "upstream-error",
      `FMCSA returned ${response.status}.`,
      response.status,
    );
  }

  const [carrier] = extractCarriers(envelope.content);

  // A 200 with an empty or null `content` is how the API reports a number that
  // is well-formed but does not belong to anyone.
  if (!carrier) {
    if (envelope.content === null || isEmptyContent(envelope.content)) {
      throw new CarrierLookupError("not-found", notFoundMessage(id), 200);
    }
    throw new CarrierLookupError(
      "malformed-response",
      "FMCSA returned a carrier record that could not be read.",
      200,
    );
  }

  return { carrier, retrievalDate: envelope.retrievalDate };
}

function isEmptyContent(content: unknown): boolean {
  if (Array.isArray(content)) return content.length === 0;
  if (typeof content === "object" && content !== null) {
    return Object.keys(content).length === 0;
  }
  return false;
}

function notFoundMessage(id: CarrierId): string {
  return id.kind === "dot"
    ? `FMCSA has no carrier registered under ${id.display}.`
    : `FMCSA has no carrier registered under docket ${id.display}.`;
}
