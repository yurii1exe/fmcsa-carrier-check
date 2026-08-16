import { describe, expect, it } from "vitest";
import {
  asInt,
  asNumber,
  asString,
  extractCarriers,
  isAuthFailureMessage,
  parseCarrier,
  readEnvelope,
  toCarrierRecord,
} from "../parse";
import {
  docketLookup,
  emptyContent,
  healthyCarrier,
  sparseCarrier,
  webkeyMissing,
  webkeyNotFound,
} from "./fixtures";

describe("scalar coercion", () => {
  it("treats empty and whitespace-only strings as absent", () => {
    expect(asString("")).toBeNull();
    expect(asString("   ")).toBeNull();
    expect(asString("  ACTIVE  ")).toBe("ACTIVE");
  });

  it("accepts a number where a string is documented", () => {
    expect(asString(4581509)).toBe("4581509");
  });

  it("accepts counts sent as numeric strings", () => {
    // The insurance and national-average fields arrive as strings.
    expect(asNumber("6.72")).toBe(6.72);
    expect(asInt("12")).toBe(12);
  });

  it("tolerates a trailing percent sign on rate fields", () => {
    expect(asNumber("22.05%")).toBe(22.05);
  });

  it("tolerates thousands separators", () => {
    expect(asInt("1,234")).toBe(1234);
  });

  it("returns null rather than NaN for unparseable input", () => {
    expect(asNumber("N/A")).toBeNull();
    expect(asNumber(Number.NaN)).toBeNull();
    expect(asNumber(null)).toBeNull();
    expect(asNumber(undefined)).toBeNull();
    expect(asNumber({})).toBeNull();
  });
});

describe("envelope", () => {
  it("reads content and retrievalDate", () => {
    const envelope = readEnvelope(healthyCarrier);
    expect(envelope?.retrievalDate).toBe("2026-08-15T12:00:00.000+0000");
    expect(envelope?.contentMessage).toBeNull();
  });

  it("surfaces a string content as a message rather than crashing", () => {
    // This is the case that matters: HTTP 404, but the body says the key is
    // bad, not that the carrier is missing.
    const envelope = readEnvelope(webkeyNotFound);
    expect(envelope?.contentMessage).toBe("Webkey not found");
    expect(isAuthFailureMessage(envelope?.contentMessage ?? null)).toBe(true);
  });

  it("recognises the omitted-key wording as well as the bad-key wording", () => {
    // FMCSA uses two different sentences for the same class of failure, both
    // under an HTTP 404. Pinning only one of them would let the other be
    // reported to the user as "no carrier with that number".
    const envelope = readEnvelope(webkeyMissing);
    expect(envelope?.contentMessage).toBe("Must provide Webkey");
    expect(isAuthFailureMessage(envelope?.contentMessage ?? null)).toBe(true);
  });

  it("does not mistake an ordinary not-found for an auth failure", () => {
    expect(isAuthFailureMessage(null)).toBe(false);
    expect(isAuthFailureMessage("No carriers found")).toBe(false);
  });

  it("rejects a non-object body", () => {
    expect(readEnvelope("<html>502 Bad Gateway</html>")).toBeNull();
    expect(readEnvelope(null)).toBeNull();
    expect(readEnvelope([1, 2, 3])).toBeNull();
  });
});

describe("parseCarrier", () => {
  it("maps a full record", () => {
    const carrier = parseCarrier(healthyCarrier.content.carrier);
    expect(carrier).not.toBeNull();
    expect(carrier?.legalName).toBe("EXAMPLE FREIGHT LLC");
    expect(carrier?.dotNumber).toBe(1000001);
    expect(carrier?.commonAuthorityStatus).toBe("A");
    expect(carrier?.driverOosRateNationalAverage).toBe(6.72);
    expect(carrier?.carrierOperation?.carrierOperationDesc).toBe("Interstate");
    expect(carrier?.censusTypeId?.censusTypeDesc).toBe("CARRIER");
  });

  it("fills absent optional fields with null instead of undefined", () => {
    const carrier = parseCarrier(sparseCarrier.content.carrier);
    expect(carrier?.safetyRating).toBeNull();
    expect(carrier?.crashTotal).toBeNull();
    expect(carrier?.totalPowerUnits).toBeNull();
    expect(carrier?.carrierOperation).toBeNull();
    expect(carrier?.phyCity).toBeNull();
  });

  it("rejects an object that is not a carrier", () => {
    expect(parseCarrier({ message: "Internal Server Error" })).toBeNull();
    expect(parseCarrier(null)).toBeNull();
    expect(parseCarrier("EXAMPLE FREIGHT LLC")).toBeNull();
    expect(parseCarrier([])).toBeNull();
  });

  it("accepts a record with a legal name but no DOT number", () => {
    // Sparse is normal; only the absence of both identity fields is a shape
    // failure.
    expect(parseCarrier({ legalName: "EXAMPLE FREIGHT LLC" })).not.toBeNull();
    expect(parseCarrier({ dotNumber: 1000001 })).not.toBeNull();
  });
});

describe("extractCarriers", () => {
  it("unwraps the single-carrier shape", () => {
    expect(extractCarriers(healthyCarrier.content)).toHaveLength(1);
  });

  it("unwraps the docket-number array shape", () => {
    const carriers = extractCarriers(docketLookup.content);
    expect(carriers).toHaveLength(2);
    expect(carriers[0]?.dotNumber).toBe(1000001);
    expect(carriers[1]?.dotNumber).toBe(1000003);
  });

  it("accepts a bare carrier object without the wrapper", () => {
    // Degrade rather than break if FMCSA drops the `carrier` key.
    expect(extractCarriers(healthyCarrier.content.carrier)).toHaveLength(1);
  });

  it("returns nothing for null, empty and junk content", () => {
    expect(extractCarriers(null)).toHaveLength(0);
    expect(extractCarriers([])).toHaveLength(0);
    expect(extractCarriers("Webkey not found")).toHaveLength(0);
    expect(extractCarriers({ carrier: null })).toHaveLength(0);
  });
});

describe("toCarrierRecord", () => {
  it("carries the retrieval date through", () => {
    const envelope = readEnvelope(healthyCarrier);
    const record = envelope ? toCarrierRecord(envelope) : null;
    expect(record?.retrievalDate).toBe("2026-08-15T12:00:00.000+0000");
    expect(record?.carrier.legalName).toBe("EXAMPLE FREIGHT LLC");
  });

  it("returns null when the number belongs to nobody", () => {
    const envelope = readEnvelope(emptyContent);
    expect(envelope ? toCarrierRecord(envelope) : null).toBeNull();
  });
});
