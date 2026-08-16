import { describe, expect, it } from "vitest";
import {
  authorityLabel,
  carrierName,
  formatAddress,
  formatCount,
  formatDate,
  formatDollars,
  formatIdentifier,
  formatRate,
} from "../format";
import { parseCarrier } from "../parse";
import { healthyCarrier, sparseCarrier } from "./fixtures";

describe("formatDate", () => {
  it("renders an ISO day as US format", () => {
    expect(formatDate("2023-04-12")).toBe("04/12/2023");
  });

  it("renders an ISO timestamp as the day only", () => {
    expect(formatDate("2026-07-01T00:00:00.000+0000")).toBe("07/01/2026");
  });

  it("pads a US date that arrived unpadded", () => {
    expect(formatDate("4/2/2023")).toBe("04/02/2023");
  });

  it("passes an unrecognised value through rather than showing Invalid Date", () => {
    expect(formatDate("SEE FILE")).toBe("SEE FILE");
  });

  it("returns null for an absent date", () => {
    expect(formatDate(null)).toBeNull();
    expect(formatDate("")).toBeNull();
  });
});

describe("formatIdentifier", () => {
  it("leaves a USDOT number unseparated", () => {
    // A DOT number is an identifier. "4,581,509" reads as a typo.
    expect(formatIdentifier(4581509)).toBe("4581509");
  });

  it("shows a dash for an absent number", () => {
    expect(formatIdentifier(null)).toBe("—");
  });
});

describe("formatCount / formatRate", () => {
  it("separates thousands", () => {
    expect(formatCount(1234567)).toBe("1,234,567");
  });

  it("shows a dash rather than 0 for absent data", () => {
    // The difference between "zero crashes" and "we do not know" matters here.
    expect(formatCount(null)).toBe("—");
    expect(formatCount(0)).toBe("0");
    expect(formatRate(null)).toBe("—");
    expect(formatRate(6.723)).toBe("6.7%");
  });
});

describe("formatDollars", () => {
  it("renders a bare amount as currency", () => {
    expect(formatDollars("750000")).toBe("$750,000");
  });

  it("passes a non-numeric value through", () => {
    expect(formatDollars("SEE FILING")).toBe("SEE FILING");
  });

  it("returns null when there is no amount", () => {
    expect(formatDollars(null)).toBeNull();
  });
});

describe("carrierName / formatAddress", () => {
  it("prefers the legal name", () => {
    const carrier = parseCarrier(healthyCarrier.content.carrier)!;
    expect(carrierName(carrier)).toBe("EXAMPLE FREIGHT LLC");
    expect(formatAddress(carrier)).toBe(
      "1 EXAMPLE WAY, CHICAGO, IL 60601",
    );
  });

  it("returns null for an address with no parts rather than a string of commas", () => {
    const carrier = parseCarrier(sparseCarrier.content.carrier)!;
    expect(formatAddress(carrier)).toBeNull();
  });
});

describe("authorityLabel", () => {
  it("distinguishes not-reported from none-on-file", () => {
    expect(authorityLabel("unknown")).toBe("Not reported");
    expect(authorityLabel("none")).toBe("None on file");
    expect(authorityLabel("active")).toBe("Active");
    expect(authorityLabel("inactive")).toBe("Inactive");
  });
});
