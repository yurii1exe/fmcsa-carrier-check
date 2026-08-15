import { describe, expect, it } from "vitest";
import { assessCarrier, readAuthority, readSafetyRating } from "../risk";
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
