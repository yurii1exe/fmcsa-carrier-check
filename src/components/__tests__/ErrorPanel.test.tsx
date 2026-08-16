import { describe, expect, it } from "vitest";

import { ErrorPanel, InvalidInputPanel } from "../ErrorPanel";
import { isRetryable, redactWebKey } from "@/lib/fmcsa/errors";
import type { LookupErrorKind } from "@/lib/fmcsa/errors";
import { markup, text } from "../../../test/render";

/**
 * The panels are the whole of what a visitor sees when something has gone
 * wrong, and three of the failure modes below — no key, FMCSA 5xx, rate
 * limited — are the app's graceful degradation. They are asserted here rather
 * than confirmed by looking at a running server, because a running server is
 * not something CI can look at.
 */

const KINDS: Array<[LookupErrorKind, string]> = [
  ["missing-api-key", "This deployment has no FMCSA API key"],
  ["unauthorized", "FMCSA rejected the API key"],
  ["not-found", "No carrier with that number"],
  ["rate-limited", "Too many lookups"],
  ["upstream-error", "FMCSA returned an error"],
  ["timeout", "FMCSA did not respond in time"],
  ["network-error", "Could not reach FMCSA"],
  ["malformed-response", "FMCSA returned something unreadable"],
];

describe("ErrorPanel", () => {
  it.each(KINDS)("gives %s its own heading and body", (kind, heading) => {
    const rendered = text(<ErrorPanel kind={kind} query="4581509" />);
    expect(rendered).toContain(heading);
    // Every panel says something after the heading. A heading alone leaves the
    // reader with no next move, which is the failure this taxonomy exists to
    // avoid.
    expect(rendered.length).toBeGreaterThan(heading.length + 40);
  });

  it.each(KINDS)("announces %s to a screen reader as an alert", (kind) => {
    expect(markup(<ErrorPanel kind={kind} />)).toContain('role="alert"');
  });

  it("tells a visitor that a missing key is not their fault, and the deployer how to fix it", () => {
    const rendered = text(<ErrorPanel kind="missing-api-key" query="4581509" />);
    expect(rendered).toContain("FMCSA_WEB_KEY");
    expect(rendered).toContain("Nothing is wrong with the number you entered");
    expect(rendered).toContain("mobile.fmcsa.dot.gov/QCDevsite");
    // Nothing the visitor can retry, so nothing is offered.
    expect(rendered).not.toContain("Try again");
  });

  it("keeps a rejected key separate from a missing one", () => {
    const rendered = text(<ErrorPanel kind="unauthorized" query="4581509" />);
    expect(rendered).toContain("FMCSA rejected the API key");
    expect(rendered).toContain("not a problem with your search");
    expect(rendered).not.toContain("Try again");
  });

  it("points a not-found at the number rather than at the service", () => {
    const rendered = text(<ErrorPanel kind="not-found" query="9999999" />);
    expect(rendered).toContain("FMCSA answered");
    expect(rendered).toContain("MC-1515020");
    expect(rendered).not.toContain("Try again");
  });

  it("shows the wait when a lookup is rate limited", () => {
    const rendered = text(
      <ErrorPanel kind="rate-limited" query="4581509" detail="Try again in 42s." />,
    );
    expect(rendered).toContain("Too many lookups");
    expect(rendered).toContain("Try again in 42s.");
  });

  it("blames FMCSA rather than the visitor for an upstream failure", () => {
    const rendered = text(
      <ErrorPanel kind="upstream-error" query="4581509" detail="FMCSA returned HTTP 503." />,
    );
    expect(rendered).toContain("The problem is at FMCSA");
    expect(rendered).toContain("FMCSA returned HTTP 503.");
  });

  it.each(KINDS)("offers retry on %s only when retrying could work", (kind) => {
    const rendered = markup(<ErrorPanel kind={kind} query="4581509" />);
    expect(rendered.includes("Try again")).toBe(isRetryable(kind));
  });

  it("carries the query into the retry form so the button repeats the search", () => {
    const rendered = markup(<ErrorPanel kind="timeout" query="MC-1515020" />);
    expect(rendered).toContain('name="q"');
    expect(rendered).toContain('value="MC-1515020"');
    expect(rendered).toContain('action="/"');
  });

  it("has no retry button to press when there is no query to repeat", () => {
    expect(markup(<ErrorPanel kind="timeout" />)).not.toContain("Try again");
  });

  it("renders a detail that has already been through redaction, and no key", () => {
    // `page.tsx` redacts before it reaches the panel; this pins that a redacted
    // string survives rendering intact and nothing re-expands it.
    const detail = redactWebKey(
      "GET https://mobile.fmcsa.dot.gov/qc/services/carriers/4581509?webKey=SECRETKEY failed",
    );
    const rendered = markup(<ErrorPanel kind="network-error" detail={detail} />);
    expect(rendered).toContain("webKey=REDACTED");
    expect(rendered).not.toContain("SECRETKEY");
  });

  it("omits the detail line entirely when there is nothing to say", () => {
    expect(text(<ErrorPanel kind="network-error" />)).not.toContain("webKey");
  });
});

describe("InvalidInputPanel", () => {
  it("repeats the parser's message instead of a generic rejection", () => {
    const rendered = text(
      <InvalidInputPanel message="Carrier name search is not supported — enter a USDOT or MC number." />,
    );
    expect(rendered).toContain("That is not a carrier number");
    expect(rendered).toContain("Carrier name search is not supported");
  });

  it("is announced as an alert", () => {
    expect(markup(<InvalidInputPanel message="x" />)).toContain('role="alert"');
  });
});
