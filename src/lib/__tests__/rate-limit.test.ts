import { beforeEach, describe, expect, it } from "vitest";
import {
  checkRateLimit,
  clientKeyFromHeaders,
  resetRateLimits,
} from "../rate-limit";

const OPTIONS = { limit: 3, windowMs: 60_000 };

beforeEach(() => {
  resetRateLimits();
});

describe("checkRateLimit", () => {
  it("allows requests up to the limit and then blocks", () => {
    const t = 1_000_000;
    expect(checkRateLimit("a", OPTIONS, t).allowed).toBe(true);
    expect(checkRateLimit("a", OPTIONS, t).allowed).toBe(true);
    expect(checkRateLimit("a", OPTIONS, t).allowed).toBe(true);
    expect(checkRateLimit("a", OPTIONS, t).allowed).toBe(false);
  });

  it("counts down the remaining allowance", () => {
    const t = 1_000_000;
    expect(checkRateLimit("a", OPTIONS, t).remaining).toBe(2);
    expect(checkRateLimit("a", OPTIONS, t).remaining).toBe(1);
    expect(checkRateLimit("a", OPTIONS, t).remaining).toBe(0);
  });

  it("keeps separate counters per client", () => {
    const t = 1_000_000;
    for (let i = 0; i < 3; i += 1) checkRateLimit("a", OPTIONS, t);
    expect(checkRateLimit("a", OPTIONS, t).allowed).toBe(false);
    expect(checkRateLimit("b", OPTIONS, t).allowed).toBe(true);
  });

  it("opens a fresh window once the old one expires", () => {
    const t = 1_000_000;
    for (let i = 0; i < 4; i += 1) checkRateLimit("a", OPTIONS, t);
    expect(checkRateLimit("a", OPTIONS, t).allowed).toBe(false);
    expect(checkRateLimit("a", OPTIONS, t + 60_001).allowed).toBe(true);
  });

  it("reports how long to wait", () => {
    const t = 1_000_000;
    for (let i = 0; i < 4; i += 1) checkRateLimit("a", OPTIONS, t);
    const result = checkRateLimit("a", OPTIONS, t + 30_000);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBe(30);
  });
});

describe("clientKeyFromHeaders", () => {
  it("takes the left-most address from x-forwarded-for", () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.7, 70.41.3.18, 150.172.238.178",
    });
    expect(clientKeyFromHeaders(headers)).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip", () => {
    expect(clientKeyFromHeaders(new Headers({ "x-real-ip": "203.0.113.9" }))).toBe(
      "203.0.113.9",
    );
  });

  it("falls back to a shared bucket when there is no address at all", () => {
    // Shared means stricter, not unlimited.
    expect(clientKeyFromHeaders(new Headers())).toBe("unknown-client");
  });
});
