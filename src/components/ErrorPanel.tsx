import type { LookupErrorKind } from "@/lib/fmcsa/errors";
import { isRetryable } from "@/lib/fmcsa/errors";

/**
 * One panel per failure mode.
 *
 * The copy differs because the reader's next action differs. "Carrier not
 * found" means check the number; "FMCSA is not responding" means come back in
 * a minute; "not configured" means the person who deployed this needs to fix
 * it and the visitor can do nothing. Collapsing those into one message
 * throws away the only useful part.
 */

interface ErrorCopy {
  heading: string;
  body: string;
  /** Rendered as a bulleted list under the body. */
  suggestions?: string[];
}

const COPY: Record<LookupErrorKind, ErrorCopy> = {
  "missing-api-key": {
    heading: "This deployment has no FMCSA API key",
    body: "Lookups need a free FMCSA webKey in the FMCSA_WEB_KEY environment variable. Nothing is wrong with the number you entered.",
    suggestions: [
      "Create a Login.gov account at mobile.fmcsa.dot.gov/QCDevsite and request a WebKey.",
      "Copy .env.example to .env.local and set FMCSA_WEB_KEY.",
      "On Vercel, add FMCSA_WEB_KEY as an environment variable and redeploy.",
    ],
  },
  unauthorized: {
    heading: "FMCSA rejected the API key",
    body: "The key configured for this deployment is missing, expired, or not valid. Again, not a problem with your search.",
    suggestions: [
      "Check FMCSA_WEB_KEY for a copy-paste error or a trailing space.",
      "Confirm the key is still active in the FMCSA developer portal.",
    ],
  },
  "not-found": {
    heading: "No carrier with that number",
    body: "FMCSA answered, and has no record under that number.",
    suggestions: [
      "A bare number is read as a USDOT number. If you meant a docket number, type MC-1515020 rather than 1515020.",
      "Check the digits — a transposed pair usually lands on nothing rather than on the wrong carrier.",
      "Very recently issued numbers can take time to appear.",
    ],
  },
  "rate-limited": {
    heading: "Too many lookups",
    body: "The request limit has been reached. Wait a moment and try again.",
  },
  "upstream-error": {
    heading: "FMCSA returned an error",
    body: "The problem is at FMCSA's end, not with the number you entered. Their service has scheduled maintenance windows.",
  },
  timeout: {
    heading: "FMCSA did not respond in time",
    body: "The request was abandoned after ten seconds so the page would not hang. The service is often slow rather than down.",
  },
  "network-error": {
    heading: "Could not reach FMCSA",
    body: "The request never got there. This is usually a transient network problem.",
  },
  "malformed-response": {
    heading: "FMCSA returned something unreadable",
    body: "The response did not match the documented shape. If this persists, the API has probably changed and this tool needs updating.",
  },
};

export function ErrorPanel({
  kind,
  detail,
  query,
}: {
  kind: LookupErrorKind;
  detail?: string;
  query?: string;
}) {
  const copy = COPY[kind];
  const critical = kind === "missing-api-key" || kind === "unauthorized";

  return (
    <section
      role="alert"
      className={`rounded-lg border p-4 sm:p-5 ${
        critical
          ? "border-critical/40 bg-critical-surface"
          : "border-warning/40 bg-warning-surface"
      }`}
    >
      <h2 className="text-lg font-semibold">{copy.heading}</h2>
      <p className="mt-1.5">{copy.body}</p>

      {copy.suggestions ? (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
          {copy.suggestions.map((suggestion) => (
            <li key={suggestion}>{suggestion}</li>
          ))}
        </ul>
      ) : null}

      {detail ? (
        <p className="mt-3 font-mono text-xs text-muted">{detail}</p>
      ) : null}

      {isRetryable(kind) && query ? (
        <form action="/" method="get" className="mt-4">
          <input type="hidden" name="q" value={query} />
          <button
            type="submit"
            className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium"
          >
            Try again
          </button>
        </form>
      ) : null}
    </section>
  );
}

/** Invalid input never reaches the API, so it gets its own, gentler panel. */
export function InvalidInputPanel({ message }: { message: string }) {
  return (
    <section
      role="alert"
      className="rounded-lg border border-warning/40 bg-warning-surface p-4 sm:p-5"
    >
      <h2 className="text-lg font-semibold">That is not a carrier number</h2>
      <p className="mt-1.5">{message}</p>
    </section>
  );
}
