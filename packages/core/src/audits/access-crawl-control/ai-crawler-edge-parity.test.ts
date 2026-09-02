import { describe, it, expect, vi } from "vitest";
import { AiCrawlerEdgeParityAudit } from "./ai-crawler-edge-parity";
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

const FULL = `<html><body><main><p>${"the resole kit ships in three sizes ".repeat(40)}</p></main></body></html>`;
const THIN = "<html><body><main><p>One line.</p></main></body></html>";

interface RunOptions {
  robots?: string;
  llms?: boolean;
  baselineStatus?: number;
  /** The response every crawler UA gets. Defaults to the browser response. */
  probe?: () => FetchResult;
}

function run(options: RunOptions = {}) {
  const audit = new AiCrawlerEdgeParityAudit();
  const rootFiles: Record<string, FetchResult> = {};
  if (options.robots)
    rootFiles["/robots.txt"] = mockFetchResult(
      options.robots,
      200,
      "text/plain",
    );
  if (options.llms)
    rootFiles["/llms.txt"] = mockFetchResult("# Site\n", 200, "text/plain");

  const ctx = mockCheckContext(
    [mockPageContext("https://example.com/", FULL)],
    rootFiles,
  );
  const xml = `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://example.com/docs/a</loc></url></urlset>`;

  ctx.fetch = async (o: FetchOptions): Promise<FetchResult> => {
    if (new URL(o.url).pathname === "/sitemap.xml") {
      return mockFetchResult(xml, 200, "application/xml");
    }
    if (o.userAgent === BASELINE_UA) {
      return mockFetchResult(FULL, options.baselineStatus ?? 200, "text/html");
    }
    return options.probe
      ? options.probe()
      : mockFetchResult(FULL, 200, "text/html");
  };
  return audit.audit(ctx);
}

const ALLOW_ALL = "User-agent: *\nAllow: /\n";
const DENY_ALL = "User-agent: *\nDisallow: /\n";

function withHeaders(
  result: FetchResult,
  headers: Record<string, string>,
): FetchResult {
  Object.assign(result.headers, headers);
  return result;
}

describe("AiCrawlerEdgeParityAudit", () => {
  const audit = new AiCrawlerEdgeParityAudit();

  it("is notApplicable on an empty site", async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it("passes when every crawler gets the same response a browser gets", async () => {
    expect((await run({ robots: ALLOW_ALL })).status).toBe("pass");
  });

  // robots.txt is advisory metadata; the edge decides independently, and the
  // operator only ever reads the first one.
  it("fails when robots.txt allows a crawler the edge answers with a non-2xx", async () => {
    const result = await run({
      robots: ALLOW_ALL,
      probe: () => mockFetchResult("", 503),
    });
    expect(result.status).toBe("fail");
    expect(result.message).toContain("503");
  });

  it("passes when robots.txt disallows the crawler the edge also blocks", async () => {
    const result = await run({
      robots: DENY_ALL,
      probe: () => mockFetchResult("", 503),
    });
    expect(result.status).toBe("pass");
  });

  it("fails a Cloudflare challenge and names it", async () => {
    const result = await run({
      robots: ALLOW_ALL,
      probe: () =>
        withHeaders(mockFetchResult("", 403, "text/html"), {
          "cf-mitigated": "challenge",
        }),
    });
    expect(result.status).toBe("fail");
    expect(result.message).toContain("Cloudflare challenge");
  });

  it("fails a pay-per-crawl 402 and names it", async () => {
    const result = await run({
      robots: ALLOW_ALL,
      probe: () =>
        withHeaders(mockFetchResult("", 402), { "crawler-price": "USD 0.01" }),
    });
    expect(result.status).toBe("fail");
    expect(result.message).toContain("pay-per-crawl");
  });

  it("fails a proof-of-work wall and names it", async () => {
    const result = await run({
      robots: ALLOW_ALL,
      probe: () =>
        mockFetchResult(
          "<html><body>Protected by Anubis</body></html>",
          200,
          "text/html",
        ),
    });
    expect(result.status).toBe("fail");
    expect(result.message).toContain("proof-of-work");
  });

  // A 200 carrying almost none of the page is a block wearing a 200.
  it("fails a soft block where the crawler gets a fraction of the text", async () => {
    const result = await run({
      robots: ALLOW_ALL,
      probe: () => mockFetchResult(THIN, 200, "text/html"),
    });
    expect(result.status).toBe("fail");
    expect(result.message).toContain("soft block");
  });

  // The scanner spoofs the UA without the matching source IP, so it cannot tell
  // AI-crawler blocking from correct impersonation defence.
  it("warns on an opaque 403 and states why it cannot be adjudicated", async () => {
    const result = await run({
      robots: ALLOW_ALL,
      probe: () =>
        withHeaders(mockFetchResult("", 403, "text/html"), {
          server: "cloudflare",
        }),
    });
    expect(result.status).toBe("warn");
    expect(result.message).toContain("source IP");
  });

  it("is notApplicable when the browser baseline is blocked too", async () => {
    const result = await run({ robots: ALLOW_ALL, baselineStatus: 503 });
    expect(result.status).toBe("na");
    expect(result.message).toContain("scanner");
  });

  it("reports per crawler and per URL rather than one site-wide verdict", async () => {
    const result = await run({
      robots: ALLOW_ALL,
      probe: () => mockFetchResult("", 503),
    });
    expect(result.found).toContain("GPTBot");
    expect(result.found).toContain("ClaudeBot");
    expect(result.message).toContain("https://example.com/docs/a");
  });

  it("probes /llms.txt when the site publishes one", async () => {
    const result = await run({
      robots: ALLOW_ALL,
      llms: true,
      probe: () => mockFetchResult("", 503),
    });
    expect(result.message).toContain("/llms.txt");
  });
});
