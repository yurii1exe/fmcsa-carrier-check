"use client";

/**
 * The last resort, for anything the lookup layer did not already classify.
 *
 * Deliberately does not render `error.message`: in production Next replaces it
 * with a digest anyway, and in development an unclassified message is more
 * likely to contain a request URL — which is where the FMCSA webKey lives —
 * than anything a visitor could use.
 */
export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12">
      <section
        role="alert"
        className="rounded-lg border border-critical/40 bg-critical-surface p-5"
      >
        <h1 className="text-lg font-semibold">Something broke in this app</h1>
        <p className="mt-1.5">
          This is not an FMCSA problem — the lookup never got far enough to be
          one. The details are in the server logs.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium"
        >
          Try again
        </button>
      </section>
    </div>
  );
}
