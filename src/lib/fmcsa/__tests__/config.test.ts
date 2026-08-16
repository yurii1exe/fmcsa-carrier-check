import { afterEach, describe, expect, it } from "vitest";

import {
  CACHE_TTL_SECONDS,
  FMCSA_BASE_URL,
  REQUEST_TIMEOUT_MS,
  getWebKey,
  isConfigured,
} from "../config";

/**
 * The configuration layer, which is the part a first-time deployer actually
 * collides with.
 *
 * Every case below is a way the webKey can be *present but useless* — unset,
 * blank, or pasted with the whitespace that a copy out of the FMCSA portal
 * brings with it. Each has to end in the "this deployment has no key" panel
 * rather than in a request that FMCSA rejects, because those two produce very
 * different advice for the person reading the screen.
 */

const ORIGINAL = process.env.FMCSA_WEB_KEY;

afterEach(() => {
  if (ORIGINAL === undefined) {
    delete process.env.FMCSA_WEB_KEY;
  } else {
    process.env.FMCSA_WEB_KEY = ORIGINAL;
  }
});

describe("getWebKey", () => {
  it("returns null when the variable is absent", () => {
    delete process.env.FMCSA_WEB_KEY;
    expect(getWebKey()).toBeNull();
    expect(isConfigured()).toBe(false);
  });

  it("treats an empty or whitespace-only value as absent", () => {
    // Vercel will happily store an empty string, so "set" is not the same
    // question as "usable".
    process.env.FMCSA_WEB_KEY = "";
    expect(getWebKey()).toBeNull();
    expect(isConfigured()).toBe(false);

    process.env.FMCSA_WEB_KEY = "   ";
    expect(getWebKey()).toBeNull();
    expect(isConfigured()).toBe(false);
  });

  it("trims the whitespace a pasted key arrives with", () => {
    process.env.FMCSA_WEB_KEY = "  key-with-a-trailing-newline\n";
    expect(getWebKey()).toBe("key-with-a-trailing-newline");
    expect(isConfigured()).toBe(true);
  });

  it("reads the environment at call time, not at import time", () => {
    // This is what lets the app boot without a key and still pick one up from
    // the platform environment, instead of caching `null` at module load.
    delete process.env.FMCSA_WEB_KEY;
    expect(getWebKey()).toBeNull();

    process.env.FMCSA_WEB_KEY = "set-after-this-module-was-imported";
    expect(getWebKey()).toBe("set-after-this-module-was-imported");
  });
});

describe("endpoint configuration", () => {
  it("points at the published QCMobile base URL", () => {
    // Verified against the live API on 2026-08-16: this base plus
    // `/carriers/{dot}` and `/carriers/docket-number/{n}` both answer, and
    // both are listed on mobile.fmcsa.dot.gov/QCDevsite/docs/qcApi.
    expect(FMCSA_BASE_URL).toBe("https://mobile.fmcsa.dot.gov/qc/services");
  });

  it("bounds an upstream request so a hung FMCSA cannot hold the page open", () => {
    expect(REQUEST_TIMEOUT_MS).toBeGreaterThan(0);
    expect(REQUEST_TIMEOUT_MS).toBeLessThanOrEqual(15_000);
  });

  it("caches for a period shorter than FMCSA's own refresh cycle", () => {
    // Census snapshots are monthly and inspection counts move within days, so
    // anything up to a day is inside the data's own resolution.
    expect(CACHE_TTL_SECONDS).toBeGreaterThan(0);
    expect(CACHE_TTL_SECONDS).toBeLessThanOrEqual(86_400);
  });
});
