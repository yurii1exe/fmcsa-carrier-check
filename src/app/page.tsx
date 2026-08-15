import { Suspense } from "react";
import { headers } from "next/headers";
import type { Metadata } from "next";

import { SearchForm } from "@/components/SearchForm";
import { CarrierReport } from "@/components/CarrierReport";
import { ErrorPanel, InvalidInputPanel } from "@/components/ErrorPanel";
import { ReportSkeleton } from "@/components/ReportSkeleton";
import { lookupCarrier } from "@/lib/fmcsa/client";
import { parseCarrierIdentifier, type CarrierId } from "@/lib/fmcsa/identifier";
import { isCarrierLookupError, redactWebKey } from "@/lib/fmcsa/errors";
import { checkRateLimit, clientKeyFromHeaders } from "@/lib/rate-limit";

/** The example the README and the landing page both point at. */
const EXAMPLE_DOT = "4581509";

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export async function generateMetadata({
  searchParams,
}: PageProps): Promise<Metadata> {
  const { q } = await searchParams;
  const query = q?.trim();
  if (!query) return {};
  const parsed = parseCarrierIdentifier(query);
  return { title: parsed.ok ? parsed.id.display : "Search" };
}

export default async function Home({ searchParams }: PageProps) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const parsed = query.length > 0 ? parseCarrierIdentifier(query) : null;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:py-12">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          FMCSA Carrier Check
        </h1>
        <p className="mt-1.5 text-muted">
          Operating authority, insurance filings, safety rating and 24-month
          inspection history for any US motor carrier, from FMCSA&rsquo;s public
          data.
        </p>
      </header>

      <SearchForm initialQuery={query || undefined} />

      <main id="main" className="flex flex-col gap-4">
        {parsed === null ? (
          <Landing />
        ) : !parsed.ok ? (
          <InvalidInputPanel message={parsed.message} />
        ) : (
          <Suspense key={query} fallback={<ReportSkeleton />}>
            <Results id={parsed.id} query={query} />
          </Suspense>
        )}
      </main>

      <Footer />
    </div>
  );
}

/**
 * The async boundary. Everything slow lives below this component, so the
 * header and the search box paint immediately and the skeleton streams in
 * underneath while FMCSA is thinking.
 */
async function Results({ id, query }: { id: CarrierId; query: string }) {
  const limit = checkRateLimit(clientKeyFromHeaders(await headers()));
  if (!limit.allowed) {
    return (
      <ErrorPanel
        kind="rate-limited"
        query={query}
        detail={`Try again in ${limit.retryAfterSeconds}s.`}
      />
    );
  }

  try {
    const record = await lookupCarrier(id);
    return <CarrierReport record={record} />;
  } catch (error) {
    if (isCarrierLookupError(error)) {
      return (
        <ErrorPanel
          kind={error.kind}
          query={query}
          detail={redactWebKey(error.message)}
        />
      );
    }
    // Anything not already classified is a bug in this app rather than a
    // known failure of the upstream API. Re-throw so it reaches error.tsx and
    // the logs, instead of being disguised as an FMCSA problem.
    throw error;
  }
}

function Landing() {
  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-lg border border-border bg-surface p-4 sm:p-5">
        <h2 className="font-semibold">What this checks</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          <li>
            Operating authority — common, contract and broker — and whether the
            carrier is allowed to operate at all
          </li>
          <li>
            Liability, cargo and bond insurance filings, against what the carrier
            is required to carry
          </li>
          <li>Safety rating and the compliance review it came from</li>
          <li>
            24 months of driver and vehicle inspections, out-of-service rates
            against the national average, and crash counts
          </li>
        </ul>
        <p className="mt-3 text-sm">
          Try{" "}
          <a
            href={`/?q=${EXAMPLE_DOT}`}
            className="font-medium text-accent underline underline-offset-2"
          >
            USDOT {EXAMPLE_DOT}
          </a>{" "}
          — Fast Line Logistics LLC.
        </p>
      </section>

      <section className="rounded-lg border border-border bg-surface p-4 sm:p-5">
        <h2 className="font-semibold">What it is not</h2>
        <p className="mt-2 text-sm">
          Insurance shown here is a <em>filing FMCSA holds</em>, not proof of
          current coverage — cancellations reach FMCSA on a delay. Crash counts
          are not fault-adjusted. Nothing here detects double-brokering or
          identity theft, which is where most freight fraud actually happens.
          This is a fast first pass, not a carrier packet.
        </p>
      </section>
    </div>
  );
}

function Footer() {
  return (
    <footer className="mt-auto border-t border-border pt-4 text-xs text-muted">
      <p>
        Data from the{" "}
        <a
          className="underline underline-offset-2"
          href="https://mobile.fmcsa.dot.gov/QCDevsite/"
          rel="noreferrer noopener"
        >
          FMCSA QCMobile API
        </a>
        . Not affiliated with or endorsed by the Federal Motor Carrier Safety
        Administration.
      </p>
    </footer>
  );
}
