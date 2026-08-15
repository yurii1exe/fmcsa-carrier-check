/**
 * A plain GET form.
 *
 * No client JavaScript: the search state lives in the URL, which means results
 * are shareable and bookmarkable, back and forward work, and the page is
 * usable before hydration. For a tool someone opens on a phone on a bad
 * connection to check a carrier, that is the right trade.
 */
export function SearchForm({ initialQuery }: { initialQuery?: string }) {
  return (
    <form
      action="/"
      method="get"
      role="search"
      className="flex flex-col gap-2 sm:flex-row"
    >
      <div className="flex-1">
        <label
          htmlFor="carrier-query"
          className="mb-1.5 block text-sm font-medium"
        >
          USDOT or MC number
        </label>
        <input
          id="carrier-query"
          name="q"
          type="search"
          defaultValue={initialQuery}
          placeholder="4581509"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          aria-describedby="carrier-query-hint"
          className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-base tabular-nums placeholder:text-muted/60"
        />
        <p id="carrier-query-hint" className="mt-1.5 text-sm text-muted">
          A bare number is read as a USDOT number. For a docket lookup, include
          the prefix — <span className="tabular-nums">MC-1515020</span>.
        </p>
      </div>
      <button
        type="submit"
        className="h-11 shrink-0 rounded-md bg-accent px-5 font-medium text-white sm:mt-7 dark:text-slate-950"
      >
        Check carrier
      </button>
    </form>
  );
}
