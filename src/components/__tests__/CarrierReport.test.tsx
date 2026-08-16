import { describe, expect, it } from "vitest";

import { CarrierReport } from "../CarrierReport";
import { parseCarrier } from "@/lib/fmcsa/parse";
import type { CarrierRecord, FmcsaCarrier } from "@/lib/fmcsa/types";
import {
  healthyCarrier,
  sparseCarrier,
  troubledCarrier,
} from "@/lib/fmcsa/__tests__/fixtures";
import { markup, text } from "../../../test/render";

/**
 * The report is where every rule in `risk.ts` becomes something a broker reads
 * before deciding to tender a load, so the assertions below are about what the
 * page says rather than about how it is laid out. The fixtures are the same
 * synthetic records the library tests use; no number in them is a fact about
 * any real carrier.
 */

function recordFrom(
  fixture: { content: { carrier: unknown }; retrievalDate?: string },
  overrides: Partial<FmcsaCarrier> = {},
): CarrierRecord {
  const carrier = parseCarrier(fixture.content.carrier);
  if (!carrier) throw new Error("fixture did not parse");
  return {
    carrier: { ...carrier, ...overrides },
    retrievalDate: fixture.retrievalDate ?? null,
  };
}

describe("CarrierReport, clean record", () => {
  const rendered = text(<CarrierReport record={recordFrom(healthyCarrier)} />);

  it("leads with the verdict and the flag counts", () => {
    expect(rendered).toContain("No flags raised");
    expect(rendered).toContain("0 critical, 0 warning");
  });

  it("names the carrier and renders its USDOT number as an identifier", () => {
    expect(rendered).toContain("EXAMPLE FREIGHT LLC");
    expect(rendered).toContain("1000001");
    expect(rendered).not.toContain("1,000,001");
  });

  it("reports each authority, the operating permission and the address", () => {
    expect(rendered).toContain("Common authority Active");
    expect(rendered).toContain("Broker authority None on file");
    expect(rendered).toContain("Allowed to operate Yes");
    expect(rendered).toContain("CHICAGO, IL 60601");
  });

  it("describes insurance as filings held, with the required minimum", () => {
    expect(rendered).toContain("1 on file");
    expect(rendered).toContain("Minimum required: $750");
    expect(rendered).toContain("not certificates of current coverage");
  });

  it("shows the safety rating and the review it came from", () => {
    expect(rendered).toContain("Satisfactory");
    expect(rendered).toContain("04/12/2023");
  });

  it("attributes the data and dates it", () => {
    expect(rendered).toContain("Source: FMCSA QCMobile API");
    expect(rendered).toContain("Retrieved 2026-08-15T12:00:00.000+0000");
    expect(rendered).toContain("Census snapshot dated 07/01/2026");
  });
});

describe("CarrierReport, record that should stop a dispatch", () => {
  const record = recordFrom(troubledCarrier);
  const rendered = text(<CarrierReport record={record} />);

  it("says do not dispatch and counts the criticals", () => {
    expect(rendered).toContain("Do not dispatch");
    expect(rendered).toContain("5 critical, 6 warning");
  });

  it("renders the prohibited-carrier flag with its source field", () => {
    expect(rendered).toContain("Not allowed to operate");
    expect(rendered).toContain("Allowed to operate No");
    expect(rendered).toContain(
      "Do not tender a load against this record",
    );
    expect(rendered).toContain("allowedToOperate");
  });

  it("carries the out-of-service order, the inactive registration and the rating", () => {
    expect(rendered).toContain("Out of service since 02/11/2026");
    expect(rendered).toContain("Registration inactive");
    expect(rendered).toContain("Unsatisfactory safety rating");
    expect(rendered).toContain("No liability insurance on file");
  });

  it("names the API fields behind every check it prints", () => {
    const html = markup(<CarrierReport record={record} />);
    for (const field of [
      "oosDate",
      "statusCode",
      "safetyRating",
      "bipdInsuranceRequired, bipdInsuranceOnFile",
    ]) {
      expect(html).toContain(field);
    }
  });
});

describe("CarrierReport, sparse record", () => {
  const rendered = text(<CarrierReport record={recordFrom(sparseCarrier)} />);

  it("files an absent safety rating as a note rather than a warning", () => {
    expect(rendered).toContain("Not rated");
    expect(rendered).toContain("No safety rating assigned");
    expect(rendered).toContain("Note");
    expect(rendered).toContain("No flags raised");
  });

  it("says there is no inspection history rather than showing empty numbers", () => {
    expect(rendered).toContain(
      "No inspections on record in the last 24 months",
    );
  });
});

describe("CarrierReport, operating permission the API did not report", () => {
  /**
   * The case the dual-spelling guard exists for. If neither `allowedToOperate`
   * nor `allowToOperate` is present, the prohibited-carrier check cannot run —
   * and the report has to say so, because "no flags" would read as a pass.
   */
  const record = recordFrom(healthyCarrier, { allowedToOperate: null });
  const rendered = text(<CarrierReport record={record} />);

  it("does not render an unread field as a yes", () => {
    expect(rendered).toContain("Allowed to operate Not reported");
    expect(rendered).not.toContain("Allowed to operate Yes");
    expect(rendered).toContain(
      "FMCSA returned no value for this field, so this check did not run",
    );
  });

  it("raises the unknown state as a flag instead of leaving it out", () => {
    expect(rendered).toContain("Operating authority unknown");
    expect(rendered).toContain("allowedToOperate, allowToOperate");
    expect(rendered).toContain("confirm it in SAFER");
  });

  it("never reports the carrier as clear", () => {
    expect(rendered).not.toContain("No flags raised");
    expect(rendered).toContain("Check before dispatch");
    expect(rendered).toContain("0 critical, 1 warning");
  });
});
