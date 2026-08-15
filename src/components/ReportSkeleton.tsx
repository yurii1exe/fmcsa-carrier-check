/**
 * Streamed in while the FMCSA request is in flight.
 *
 * FMCSA regularly takes a second or more to answer, so the skeleton is doing
 * real work rather than decorating a fast response. `role="status"` and the
 * visually hidden text mean a screen reader is told the page is loading
 * instead of being handed a set of empty boxes.
 */
export function ReportSkeleton() {
  return (
    <div role="status" className="flex flex-col gap-4">
      <span className="sr-only">Looking up carrier…</span>
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          aria-hidden
          className="animate-pulse rounded-lg border border-border bg-surface p-5"
        >
          <div className="h-3 w-28 rounded bg-surface-muted" />
          <div className="mt-4 h-5 w-2/3 rounded bg-surface-muted" />
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="h-4 rounded bg-surface-muted" />
            <div className="h-4 rounded bg-surface-muted" />
            <div className="h-4 rounded bg-surface-muted" />
            <div className="h-4 rounded bg-surface-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}
