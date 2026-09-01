import { describe, it, expect, vi } from "vitest";
import { AgentUaCommerceParityAudit } from "./agent-ua-commerce-parity";
import {
  mockPageContext,
  mockCheckContext,
  mockFetchResult,
} from "../../__tests__/test-utils";
import { expectNotApplicableOnEmpty } from "../../tests/na-contract";
import { BASELINE_UA } from "../../gatherers/ua-parity";
import type { FetchOptions, FetchResult } from "../../fetcher";

vi.mock("../../fetcher", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../fetcher")>();
  return {
    ...actual,
    isSafeUrl: async (url: string) => {
      try {
        const { protocol, hostname } = new URL(url);
        if (protocol !== "http:" && protocol !== "https:") return false;
        return !/^(localhost$|127\.|\[?::1\]?$|10\.|192\.168\.)/.test(hostname);
      } catch {
        return false;
      }
    },
  };
});

const PDP_URL = "https://example.com/products/alpine-resole-kit";
const BODY = `<html><body><main><p>${"the resole kit ships in three sizes ".repeat(40)}</p></main></body></html>`;
const THIN = "<html><body><main><p>One line.</p></main></body></html>";

const HOME = `<html><body><main><p>Shop.</p>
  <a href="/terms">Terms of Service</a>
  <a href="/privacy">Privacy Policy</a>
</main></body></html>`;

const PDP = `<html><head><script type="application/ld+json">${JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Product",
  name: "Alpine Resole Kit",
  offers: { "@type": "Offer", price: 29.99, priceCurrency: "USD" },
})}</script></head><body><main><p>${"the resole kit ships in three sizes ".repeat(40)}</p></main></body></html>`;

interface RunOptions {
  robots?: string;
  /** The response an agent UA gets for a given URL. Defaults to the browser response. */
  probe?: (url: string) => FetchResult | undefined;
  /** Whether /cart answers 200. */
  cart?: boolean;
  /** Whether the scanned pages include a product page. */
  product?: boolean;
}

function run(options: RunOptions = {}) {
  const audit = new AgentUaCommerceParityAudit();
  const pages =
    options.product === false
      ? []
      : [
          mockPageContext("https://example.com/", HOME),
          mockPageContext(PDP_URL, PDP, 1),
        ];

  const rootFiles: Record<string, FetchResult> = {};
  if (options.robots)
    rootFiles["/robots.txt"] = mockFetchResult(
      options.robots,
      200,
      "text/plain",
    );

  const ctx = mockCheckContext(pages, rootFiles);
  ctx.fetch = async (o: FetchOptions): Promise<FetchResult> => {
    const path = new URL(o.url).pathname;
    if (path === "/cart" && options.cart === false)
      return mockFetchResult("", 404);
    if (o.userAgent === BASELINE_UA)
      return mockFetchResult(BODY, 200, "text/html");
    const override = options.probe?.(o.url);
    return override ?? mockFetchResult(BODY, 200, "text/html");
  };
  return audit.audit(ctx);
}

const ALLOW_ALL = "User-agent: *\nAllow: /\n";

describe("AgentUaCommerceParityAudit", () => {
  const audit = new AgentUaCommerceParityAudit();

  it("is notApplicable on an empty site", async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it("is notApplicable with no product page and no cart", async () => {
    const result = await run({ product: false, cart: false });
    expect(result.status).toBe("na");
  });

  it("passes when the agent UAs get what a browser gets", async () => {
    expect((await run({ robots: ALLOW_ALL })).status).toBe("pass");
  });

  it("fails when a commerce path answers the agent UA with 403 and the browser with 200", async () => {
    const result = await run({
      robots: ALLOW_ALL,
      probe: (url) => (url === PDP_URL ? mockFetchResult("", 403) : undefined),
    });
    expect(result.status).toBe("fail");
    expect(result.message).toContain("403");
  });

  it("fails on a challenge interstitial and names the fingerprint", async () => {
    const result = await run({
      robots: ALLOW_ALL,
      probe: () =>
        mockFetchResult(
          "<html><title>Just a moment...</title><body>checking</body></html>",
          200,
          "text/html",
        ),
    });
    expect(result.status).toBe("fail");
    expect(result.message).toContain("Just a moment...");
  });

  // A stub page carries a price the agent will quote and a page it cannot act on.
  it("fails on soft cloaking where the agent gets a fraction of the product page", async () => {
    const result = await run({
      robots: ALLOW_ALL,
      probe: (url) =>
        url === PDP_URL ? mockFetchResult(THIN, 200, "text/html") : undefined,
    });
    expect(result.status).toBe("fail");
    expect(result.message).toContain("%");
  });

  // Opting out of training while staying in search is a policy, not a defect.
  it("does not fail when GPTBot is disallowed and OAI-SearchBot is allowed", async () => {
    const result = await run({
      robots: "User-agent: *\nAllow: /\n\nUser-agent: GPTBot\nDisallow: /\n",
    });
    expect(result.status).not.toBe("fail");
    expect(result.message).toContain("GPTBot");
  });

  it("fails when OAI-SearchBot is disallowed on a product path", async () => {
    const result = await run({
      robots:
        "User-agent: *\nAllow: /\n\nUser-agent: OAI-SearchBot\nDisallow: /products\n",
    });
    expect(result.status).toBe("fail");
    expect(result.message).toContain("OAI-SearchBot");
  });

  it("names the published IP-range sources when it finds a block", async () => {
    const result = await run({
      robots: ALLOW_ALL,
      probe: (url) => (url === PDP_URL ? mockFetchResult("", 403) : undefined),
    });
    expect(result.message).toContain("https://openai.com/searchbot.json");
    expect(result.message).toContain("https://openai.com/chatgpt-user.json");
  });

  it("probes the policy URLs the page links", async () => {
    const result = await run({
      robots: ALLOW_ALL,
      probe: (url) =>
        url.endsWith("/terms") ? mockFetchResult("", 403) : undefined,
    });
    expect(result.status).toBe("fail");
    expect(result.message).toContain("/terms");
  });

  it("reports each target and each agent", async () => {
    const result = await run({ robots: ALLOW_ALL });
    expect(result.found).toContain("ChatGPT-User");
    expect(result.found).toContain("OAI-SearchBot");
  });
});
