import { describe, expect, it } from "vitest";
import { parseCarrierIdentifier } from "../identifier";

describe("parseCarrierIdentifier", () => {
  it("reads a bare number as a USDOT number", () => {
    const result = parseCarrierIdentifier("4581509");
    expect(result).toEqual({
      ok: true,
      id: { kind: "dot", value: "4581509", display: "USDOT 4581509" },
    });
  });

  it.each([
    "USDOT 4581509",
    "usdot4581509",
    "US DOT 4581509",
    "DOT-4581509",
    "  4581509  ",
    "4,581,509",
  ])("accepts %s as the same USDOT number", (input) => {
    const result = parseCarrierIdentifier(input);
    expect(result.ok && result.id).toMatchObject({
      kind: "dot",
      value: "4581509",
    });
  });

  it.each(["MC-1515020", "MC 1515020", "mc1515020", "MC#1515020"])(
    "accepts %s as a docket number",
    (input) => {
      const result = parseCarrierIdentifier(input);
      expect(result.ok && result.id).toMatchObject({
        kind: "docket",
        value: "1515020",
        docketPrefix: "MC",
        display: "MC-1515020",
      });
    },
  );

  it("recognises MX and FF docket prefixes", () => {
    const mx = parseCarrierIdentifier("MX123456");
    expect(mx.ok && mx.id).toMatchObject({
      kind: "docket",
      docketPrefix: "MX",
      display: "MX-123456",
    });

    const ff = parseCarrierIdentifier("FF-99");
    expect(ff.ok && ff.id).toMatchObject({
      kind: "docket",
      docketPrefix: "FF",
      display: "FF-99",
    });
  });

  it("does not treat a name beginning with a docket prefix as a docket number", () => {
    // `MCLANE` starts with MC. Without the digit requirement it would be read
    // as docket LANE and produce a nonsense request.
    const result = parseCarrierIdentifier("MCLANE");
    expect(result.ok).toBe(false);
  });

  it("strips leading zeros so 0004581509 and 4581509 hit the same cache entry", () => {
    const result = parseCarrierIdentifier("0004581509");
    expect(result.ok && result.id.value).toBe("4581509");
  });

  it("keeps a single zero rather than producing an empty path segment", () => {
    const result = parseCarrierIdentifier("0000");
    expect(result.ok && result.id.value).toBe("0");
  });

  it.each([
    ["", "empty"],
    ["   ", "empty"],
    ["- - -", "no-digits"],
    ["Swift Transportation", "not-a-number"],
    ["4581509-A", "not-a-number"],
    ["123456789012", "too-long"],
  ] as const)("rejects %j with problem %s", (input, problem) => {
    const result = parseCarrierIdentifier(input);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.problem).toBe(problem);
  });

  it("gives a message that names what to do instead", () => {
    const result = parseCarrierIdentifier("Swift Transportation");
    expect(!result.ok && result.message).toMatch(/USDOT/i);
    expect(!result.ok && result.message).toMatch(/name search is not supported/i);
  });
});
