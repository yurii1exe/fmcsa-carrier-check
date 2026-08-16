import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CarrierLookupError } from "../errors";
import type { CarrierId } from "../identifier";

/**
 * `config.ts` reads `process.env` at call time rather than at import time, but
 * the module still has to be loaded *after* the variable is set for the whole
 * chain to behave the way it does in the app. Each test therefore imports the
 * client fresh.
 */
async function importClient() {
  vi.resetModules();
  return import("../client");
}

const DOT: CarrierId = {
  kind: "dot",
  value: "4581509",
  display: "USDOT 4581509",
};

const DOCKET: CarrierId = {
  kind: "docket",
  value: "1515020",
  docketPrefix: "MC",
  display: "MC-1515020",
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/hal+json" },
  });
}

/**
 * Asserts on `name` and `kind` rather than `instanceof`.
 *
 * `vi.resetModules()` gives each test a fresh copy of the module graph, so the
 * `CarrierLookupError` thrown inside the client is a different class object
 * from the one imported at the top of this file even though it is the same
 * source. `instanceof` is false across that boundary; the shape is not.
 */
async function expectKind(promise: Promise<unknown>, kind: string) {
  await expect(promise).rejects.toMatchObject({
    name: "CarrierLookupError",
    kind,
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env.FMCSA_WEB_KEY = "test-key-not-a-real-credential";
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.FMCSA_WEB_KEY;
});

describe("lookupCarrier", () => {
  it("sends the webKey as a query parameter and never in a header", async () => {
    const { lookupCarrier } = await importClient();
    const { healthyCarrier } = await import("./fixtures");
    fetchMock.mockResolvedValue(jsonResponse(200, healthyCarrier));

    await lookupCarrier(DOT);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://mobile.fmcsa.dot.gov/qc/services/carriers/4581509?webKey=test-key-not-a-real-credential",
    );
    expect(JSON.stringify(init.headers)).not.toContain(
      "test-key-not-a-real-credential",
    );
  });

  it("uses the docket-number endpoint for an MC number", async () => {
    const { lookupCarrier } = await importClient();
    const { docketLookup } = await import("./fixtures");
    fetchMock.mockResolvedValue(jsonResponse(200, docketLookup));

    const record = await lookupCarrier(DOCKET);

    expect(fetchMock.mock.calls[0]?.[0]).toContain(
      "/carriers/docket-number/1515020",
    );
    // The docket endpoint can return several carriers; the first is used.
    expect(record.carrier.dotNumber).toBe(1000001);
  });

  it("asks for a cached response rather than hitting FMCSA every time", async () => {
    const { lookupCarrier } = await importClient();
    const { healthyCarrier } = await import("./fixtures");
    fetchMock.mockResolvedValue(jsonResponse(200, healthyCarrier));

    await lookupCarrier(DOT);

    const init = fetchMock.mock.calls[0]?.[1] as { next?: unknown };
    expect(init.next).toMatchObject({ revalidate: 3600 });
  });

  it("reports a missing key as configuration, not as a failed lookup", async () => {
    delete process.env.FMCSA_WEB_KEY;
    const { lookupCarrier } = await importClient();

    await expectKind(lookupCarrier(DOT), "missing-api-key");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("treats a blank key the same as a missing one", async () => {
    process.env.FMCSA_WEB_KEY = "   ";
    const { lookupCarrier } = await importClient();

    await expectKind(lookupCarrier(DOT), "missing-api-key");
  });

  it("recognises a bad key even though FMCSA reports it as a 404", async () => {
    // The whole reason the body is inspected on 404. Without this the user is
    // told the carrier does not exist and goes hunting for a typo.
    const { lookupCarrier } = await importClient();
    const { webkeyNotFound } = await import("./fixtures");
    fetchMock.mockResolvedValue(jsonResponse(404, webkeyNotFound));

    await expectKind(lookupCarrier(DOT), "unauthorized");
  });

  it("recognises the other 404 wording FMCSA uses for a key problem", async () => {
    // "Must provide Webkey" rather than "Webkey not found". Same HTTP status,
    // same class of problem, different sentence.
    const { lookupCarrier } = await importClient();
    const { webkeyMissing } = await import("./fixtures");
    fetchMock.mockResolvedValue(jsonResponse(404, webkeyMissing));

    await expectKind(lookupCarrier(DOT), "unauthorized");
  });

  it("reports a genuine 404 as not-found", async () => {
    const { lookupCarrier } = await importClient();
    fetchMock.mockResolvedValue(jsonResponse(404, { content: null }));

    await expectKind(lookupCarrier(DOT), "not-found");
  });

  it("reports a 200 with null content as not-found", async () => {
    const { lookupCarrier } = await importClient();
    const { emptyContent } = await import("./fixtures");
    fetchMock.mockResolvedValue(jsonResponse(200, emptyContent));

    await expectKind(lookupCarrier(DOT), "not-found");
  });

  it("reports an empty docket array as not-found", async () => {
    const { lookupCarrier } = await importClient();
    fetchMock.mockResolvedValue(jsonResponse(200, { content: [] }));

    await expectKind(lookupCarrier(DOCKET), "not-found");
  });

  it("maps 429 to rate-limited", async () => {
    const { lookupCarrier } = await importClient();
    fetchMock.mockResolvedValue(jsonResponse(429, {}));

    await expectKind(lookupCarrier(DOT), "rate-limited");
  });

  it.each([401, 403])("maps %i to unauthorized", async (status) => {
    const { lookupCarrier } = await importClient();
    fetchMock.mockResolvedValue(jsonResponse(status, {}));

    await expectKind(lookupCarrier(DOT), "unauthorized");
  });

  it.each([500, 502, 503])("maps %i to upstream-error", async (status) => {
    const { lookupCarrier } = await importClient();
    fetchMock.mockResolvedValue(jsonResponse(status, {}));

    await expectKind(lookupCarrier(DOT), "upstream-error");
  });

  it("maps an HTML error page to malformed-response", async () => {
    const { lookupCarrier } = await importClient();
    fetchMock.mockResolvedValue(
      new Response("<html>Gateway</html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    );

    await expectKind(lookupCarrier(DOT), "malformed-response");
  });

  it("maps a timeout to timeout", async () => {
    const { lookupCarrier } = await importClient();
    const timeout = new Error("The operation was aborted due to timeout");
    timeout.name = "TimeoutError";
    fetchMock.mockRejectedValue(timeout);

    await expectKind(lookupCarrier(DOT), "timeout");
  });

  it("maps a connection failure to network-error", async () => {
    const { lookupCarrier } = await importClient();
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    await expectKind(lookupCarrier(DOT), "network-error");
  });

  it("does not put the key into the message of a network error", async () => {
    const { lookupCarrier } = await importClient();
    fetchMock.mockRejectedValue(
      new TypeError(
        "fetch failed for https://mobile.fmcsa.dot.gov/qc/services/carriers/4581509?webKey=test-key-not-a-real-credential",
      ),
    );

    await lookupCarrier(DOT).catch((error: CarrierLookupError) => {
      expect(error.message).not.toContain("test-key-not-a-real-credential");
      expect(error.message).toContain("REDACTED");
    });
  });

  it("returns a typed record on success", async () => {
    const { lookupCarrier } = await importClient();
    const { healthyCarrier } = await import("./fixtures");
    fetchMock.mockResolvedValue(jsonResponse(200, healthyCarrier));

    const record = await lookupCarrier(DOT);

    expect(record.carrier.legalName).toBe("EXAMPLE FREIGHT LLC");
    expect(record.retrievalDate).toBe("2026-08-15T12:00:00.000+0000");
  });
});
