import { describe, expect, it } from "vitest";
import { CarrierLookupError, isRetryable, redactWebKey } from "../errors";

describe("redactWebKey", () => {
  it("removes the key from a request URL", () => {
    const url =
      "https://mobile.fmcsa.dot.gov/qc/services/carriers/4581509?webKey=abc123secret";
    expect(redactWebKey(url)).toBe(
      "https://mobile.fmcsa.dot.gov/qc/services/carriers/4581509?webKey=REDACTED",
    );
  });

  it("removes it when it is not the first parameter", () => {
    expect(redactWebKey("https://x/y?size=10&webKey=abc123&start=0")).toBe(
      "https://x/y?size=10&webKey=REDACTED&start=0",
    );
  });

  it("is case-insensitive about the parameter name", () => {
    expect(redactWebKey("https://x/y?WEBKEY=abc123")).toContain("REDACTED");
  });

  it("leaves text without a key alone", () => {
    expect(redactWebKey("FMCSA returned 503.")).toBe("FMCSA returned 503.");
  });

  it("does not leak the key out of a wrapped error message", () => {
    const message = "fetch failed for https://x/y?webKey=abc123secret";
    expect(redactWebKey(message)).not.toContain("abc123secret");
  });
});

describe("isRetryable", () => {
  it("offers a retry only where one could work", () => {
    expect(isRetryable("timeout")).toBe(true);
    expect(isRetryable("upstream-error")).toBe(true);
    expect(isRetryable("rate-limited")).toBe(true);
    expect(isRetryable("network-error")).toBe(true);

    expect(isRetryable("not-found")).toBe(false);
    expect(isRetryable("unauthorized")).toBe(false);
    expect(isRetryable("missing-api-key")).toBe(false);
    expect(isRetryable("malformed-response")).toBe(false);
  });
});

describe("CarrierLookupError", () => {
  it("keeps its kind and status through a throw/catch", () => {
    try {
      throw new CarrierLookupError("upstream-error", "FMCSA returned 503.", 503);
    } catch (error) {
      expect(error).toBeInstanceOf(CarrierLookupError);
      expect((error as CarrierLookupError).kind).toBe("upstream-error");
      expect((error as CarrierLookupError).status).toBe(503);
    }
  });
});
