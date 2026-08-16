import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Home, { generateMetadata } from "../page";
import { checkRateLimit, resetRateLimits } from "@/lib/rate-limit";
import {
  markup,
  streamedMarkup,
  streamedText,
  text,
} from "../../../test/render";

/**
 * The page itself, rendered.
 *
 * `next/headers` is stubbed because it reads from the per-request store that
 * only exists inside a Next server; everything else here is the real thing —
 * the real identifier parser, the real rate limiter, the real client, the real
 * error panels. The states below are the ones a visitor hits when nothing is
 * configured or nothing is working, which are exactly the states that are hard
 * to check by hand and easy to break.
 */

const CLIENT_IP = "203.0.113.7";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": CLIENT_IP }),
}));

const ORIGINAL_KEY = process.env.FMCSA_WEB_KEY;

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  delete process.env.FMCSA_WEB_KEY;
  resetRateLimits();
  fetchMock = vi.fn(() => {
    throw new Error("no test may reach the network");
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (ORIGINAL_KEY === undefined) {
    delete process.env.FMCSA_WEB_KEY;
  } else {
    process.env.FMCSA_WEB_KEY = ORIGINAL_KEY;
  }
});

function render(q?: string) {
  return Home({ searchParams: Promise.resolve(q === undefined ? {} : { q }) });
}

describe("the page with nothing searched for", () => {
  it("explains what the tool checks and what it does not", async () => {
    const rendered = text(await render());
    expect(rendered).toContain("FMCSA Carrier Check");
    expect(rendered).toContain("What this checks");
    expect(rendered).toContain("What it is not");
    expect(rendered).toContain("not proof of current coverage");
    expect(rendered).toContain("Not affiliated with or endorsed by");
  });

  it("offers a working example and a search form that needs no JavaScript", async () => {
    const html = markup(await render());
    expect(html).toContain('href="/?q=4581509"');
    expect(html).toContain('method="get"');
    expect(html).toContain('name="q"');
    expect(html).toContain('role="search"');
  });

  it("raises no alert and makes no request", async () => {
    expect(markup(await render())).not.toContain('role="alert"');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("treats a blank query as no query", async () => {
    expect(text(await render("   "))).toContain("What this checks");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("the page with something that is not a carrier number", () => {
  it("rejects a carrier name before any request is made", async () => {
    const rendered = text(await render("Fast Line Logistics"));
    expect(rendered).toContain("That is not a carrier number");
    expect(rendered).toContain("USDOT");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["abc123", "MC-", "312 555 0134", "12345678901234"])(
    "rejects %s without calling FMCSA",
    async (query) => {
      expect(markup(await render(query))).toContain('role="alert"');
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("keeps what was typed in the box so it can be corrected", async () => {
    expect(markup(await render("Fast Line Logistics"))).toContain(
      'value="Fast Line Logistics"',
    );
  });
});

describe("the page when the deployment has no webKey", () => {
  it("renders the setup panel rather than an empty report or a stack trace", async () => {
    const rendered = await streamedText(await render("4581509"));
    expect(rendered).toContain("This deployment has no FMCSA API key");
    expect(rendered).toContain("FMCSA_WEB_KEY");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("the page when the visitor has searched too often", () => {
  it("stops at the limit and says how long the wait is", async () => {
    // Spend the window on this client before the page is rendered for it.
    for (let i = 0; i < 20; i += 1) checkRateLimit(CLIENT_IP);

    const rendered = await streamedText(await render("4581509"));
    expect(rendered).toContain("Too many lookups");
    expect(rendered).toContain("Try again in");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("the page when FMCSA itself is failing", () => {
  it("says the failure is upstream, and leaks no key doing it", async () => {
    process.env.FMCSA_WEB_KEY = "test-key-not-a-real-credential";
    fetchMock.mockResolvedValue(
      new Response("<html>Service Unavailable</html>", {
        status: 503,
        headers: { "content-type": "text/html" },
      }),
    );

    const html = await streamedMarkup(await render("4581509"));

    expect(html).toContain("FMCSA returned an error");
    expect(html).not.toContain("test-key-not-a-real-credential");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("the page title", () => {
  it("stays with the site default when nothing is searched for", async () => {
    expect(
      await generateMetadata({ searchParams: Promise.resolve({}) }),
    ).toEqual({});
  });

  it("names the carrier identifier that was looked up", async () => {
    expect(
      await generateMetadata({ searchParams: Promise.resolve({ q: "4581509" }) }),
    ).toEqual({ title: "USDOT 4581509" });
    expect(
      await generateMetadata({
        searchParams: Promise.resolve({ q: "mc 1515020" }),
      }),
    ).toEqual({ title: "MC-1515020" });
  });

  it("falls back for input that is not an identifier at all", async () => {
    expect(
      await generateMetadata({
        searchParams: Promise.resolve({ q: "Fast Line Logistics" }),
      }),
    ).toEqual({ title: "Search" });
  });
});
