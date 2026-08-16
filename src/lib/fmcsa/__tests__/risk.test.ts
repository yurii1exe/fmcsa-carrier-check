import { describe, expect, it } from "vitest";
import {
  assessCarrier,
  readAuthority,
  readOperatingPermission,
  readSafetyRating,
} from "../risk";
import { parseCarrier } from "../parse";
import type { FmcsaCarrier } from "../types";
import { healthyCarrier, sparseCarrier, troubledCarrier } from "./fixtures";

function carrierFrom(fixture: { content: { carrier: unknown } }): FmcsaCarrier {
  const carrier = parseCarrier(fixture.content.carrier);
  if (!carrier) throw new Error("fixture did not parse");
  return carrier;
}

const flagIds = (carrier: FmcsaCarrier) =>
  assessCarrier(carrier).flags.map((flag) => flag.id);

describe("readAuthority", () => {
  it("accepts both the letter and the word", () => {
    expect(readAuthority("A")).toBe("active");
    expect(readAuthority("active")).toBe("active");
    expect(readAuthority("I")).toBe("inactive");
    expect(readAuthority("NONE")).toBe("none");
  });

  it("treats an unrecognised code as unknown, not as active", () => {
    // Failing open here would tell a broker a carrier is authorised on the
    // strength of a code nobody has seen before.
    expect(readAuthority("P")).toBe("unknown");
    expect(readAuthority(null)).toBe("unknown");
    expect(readAuthority("")).toBe("unknown");
  });
});

describe("readSafetyRating", () => {
  it("maps the three assigned ratings", () => {
    expect(readSafetyRating("S")).toBe("satisfactory");
    expect(readSafetyRating("Conditional")).toBe("conditional");
    expect(readSafetyRating("U")).toBe("unsatisfactory");
  });

  it("treats absence as not-rated", () => {
    expect(readSafetyRating(null)).toBe("not-rated");
    expect(readSafetyRating("")).toBe("not-rated");
  });
});

describe("assessCarrier", () => {
  it("clears a carrier with authority, insurance and clean history", () => {
    const assessment = assessCarrier(carrierFrom(healthyCarrier));
    expect(assessment.verdict).toBe("clear");
    expect(assessment.criticalCount).toBe(0);
    expect(assessment.warningCount).toBe(0);
  });

  it("blocks a carrier that cannot legally operate", () => {
    const assessment = assessCarrier(carrierFrom(troubledCarrier));
    expect(assessment.verdict).toBe("blocked");
    expect(assessment.flags.map((f) => f.id)).toEqual(
      expect.arrayContaining([
        "not-allowed-to-operate",
        "out-of-service",
        "inactive-registration",
        "no-bipd-insurance",
        "unsatisfactory-rating",
        "no-active-authority",
        "fatal-crash",
        "mcs150-outdated",
        "driver-oos-above-average",
        "vehicle-oos-above-average",
      ]),
    );
  });

  it("does not treat an unrated carrier as a problem", () => {
    // The single most common misreading of SAFER. A missing rating means no
    // compliance review has happened, which is true of most carriers.
    const assessment = assessCarrier(carrierFrom(sparseCarrier));
    expect(assessment.verdict).toBe("clear");
    expect(assessment.flags.map((f) => f.id)).toContain("not-rated");
    expect(
      assessment.flags.find((f) => f.id === "not-rated")?.severity,
    ).toBe("info");
  });

  it("notes an absence of inspection history without penalising it", () => {
    const assessment = assessCarrier(carrierFrom(sparseCarrier));
    const flag = assessment.flags.find((f) => f.id === "no-inspection-history");
    expect(flag?.severity).toBe("info");
  });

  it("ignores an out-of-service rate built on too few inspections", () => {
    // 1 of 2 inspections is a 50% rate and means nothing.
    const carrier = {
      ...carrierFrom(healthyCarrier),
      driverInsp: 2,
      driverOosInsp: 1,
      driverOosRate: 50,
      driverOosRateNationalAverage: 6.72,
    };
    expect(flagIds(carrier)).not.toContain("driver-oos-above-average");
  });

  it("flags an out-of-service rate above average once there is enough history", () => {
    const carrier = {
      ...carrierFrom(healthyCarrier),
      driverInsp: 40,
      driverOosInsp: 12,
      driverOosRate: 30,
      driverOosRateNationalAverage: 6.72,
    };
    expect(flagIds(carrier)).toContain("driver-oos-above-average");
  });

  it("does not flag missing insurance the carrier is not required to hold", () => {
    const carrier = {
      ...carrierFrom(healthyCarrier),
      cargoInsuranceRequired: "N",
      cargoInsuranceOnFile: "0",
    };
    expect(flagIds(carrier)).not.toContain("no-cargo-insurance");
  });

  it("stays quiet about authority when the API reported none of the three fields", () => {
    const carrier = {
      ...carrierFrom(healthyCarrier),
      commonAuthorityStatus: null,
      contractAuthorityStatus: null,
      brokerAuthorityStatus: null,
    };
    expect(flagIds(carrier)).not.toContain("no-active-authority");
  });

  it("names the fields each flag was derived from", () => {
    const assessment = assessCarrier(carrierFrom(troubledCarrier));
    for (const flag of assessment.flags) {
      expect(flag.source.length).toBeGreaterThan(0);
    }
  });
});

describe("the allowedToOperate field-name disagreement", () => {
  /**
   * FMCSA's API elements page spells this field `allowToOperate`. Live
   * responses and independent third-party clients of the same API spell it
   * `allowedToOperate`, which is what this code reads first. Since the
   * disagreement decides whether the *critical* "not allowed to operate" flag
   * can fire at all, both spellings are accepted and the third case — neither
   * present — is a reported state rather than a quiet pass.
   */

  const base = { dotNumber: 1000009, legalName: "EXAMPLE FIELD NAME LLC" };

  function assess(record: Record<string, unknown>) {
    const carrier = parseCarrier(record);
    if (!carrier) throw new Error("record did not parse");
    return { carrier, flags: flagIds(carrier) };
  }

  it("reads the spelling live responses use", () => {
    const { carrier, flags } = assess({ ...base, allowedToOperate: "N" });
    expect(carrier.allowedToOperate).toBe("N");
    expect(flags).toContain("not-allowed-to-operate");
    expect(flags).not.toContain("operating-status-unknown");
  });

  it("reads the spelling FMCSA's own documentation uses", () => {
    const { carrier, flags } = assess({ ...base, allowToOperate: "N" });
    expect(carrier.allowedToOperate).toBe("N");
    expect(flags).toContain("not-allowed-to-operate");
    expect(flags).not.toContain("operating-status-unknown");
  });

  it("prefers the live spelling when a record carries both", () => {
    const { carrier } = assess({
      ...base,
      allowedToOperate: "Y",
      allowToOperate: "N",
    });
    expect(carrier.allowedToOperate).toBe("Y");
  });

  it("reports that the check could not run when neither spelling is present", () => {
    // The failure this guards against: the field parses to null, the critical
    // flag never fires, and a prohibited carrier is rendered as unflagged.
    const carrier = parseCarrier(base);
    if (!carrier) throw new Error("record did not parse");
    const assessment = assessCarrier(carrier);

    expect(carrier.allowedToOperate).toBeNull();
    expect(assessment.flags.map((f) => f.id)).toContain(
      "operating-status-unknown",
    );
    expect(assessment.verdict).not.toBe("clear");
    expect(assessment.warningCount).toBeGreaterThan(0);
    expect(
      assessment.flags.find((f) => f.id === "operating-status-unknown")?.source,
    ).toContain("allowToOperate");
  });

  it("stays quiet when the carrier reports that it may operate", () => {
    const { flags } = assess({ ...base, allowToOperate: "Y" });
    expect(flags).not.toContain("operating-status-unknown");
    expect(flags).not.toContain("not-allowed-to-operate");
  });
});

describe("readOperatingPermission", () => {
  it("maps the yes and no wordings the API uses", () => {
    expect(readOperatingPermission("Y")).toBe("allowed");
    expect(readOperatingPermission("yes")).toBe("allowed");
    expect(readOperatingPermission("N")).toBe("not-allowed");
    expect(readOperatingPermission("No")).toBe("not-allowed");
  });

  it("returns unknown for an absent or unrecognised value", () => {
    expect(readOperatingPermission(null)).toBe("unknown");
    expect(readOperatingPermission("")).toBe("unknown");
    expect(readOperatingPermission("PENDING")).toBe("unknown");
  });
});
