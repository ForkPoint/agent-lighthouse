import { describe, it, expect, vi } from "vitest";
import { AiCrawlerEdgeParityAudit } from "./ai-crawler-edge-parity";
import {
  mockPageContext,
  mockCheckContext,
  mockFetchResult,
} from "#core/__tests__/test-utils";
import { expectNotApplicableOnEmpty } from "#core/tests/na-contract";
import { BASELINE_UA } from "#core/gatherers/ua-parity";
import type { FetchOptions, FetchResult } from "#core/fetcher";
import { CheckStatus } from "#core/types";

vi.mock("#core/fetcher", async (importOriginal) => {
  const actual = await importOriginal<typeof import("#core/fetcher")>();
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
  /** Body served at /llms.txt instead of a Markdown file. */
  llmsBody?: string;
  /** Collects every URL the audit requests. */
  seen?: string[];
  baselineStatus?: number;
  /** The response every crawler UA gets. Defaults to the browser response. */
  probe?: () => FetchResult;
  /** A path that answers 404 to the browser and to every crawler UA alike. */
  stale?: string;
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
  if (options.llmsBody !== undefined)
    rootFiles["/llms.txt"] = mockFetchResult(
      options.llmsBody,
      200,
      "text/html",
    );

  const ctx = mockCheckContext(
    [mockPageContext("https://example.com/", FULL)],
    rootFiles,
  );
  const xml = `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://example.com/docs/a</loc></url></urlset>`;

  ctx.fetch = async (o: FetchOptions): Promise<FetchResult> => {
    options.seen?.push(o.url);
    if (new URL(o.url).pathname === "/sitemap.xml") {
      return mockFetchResult(xml, 200, "application/xml");
    }
    if (options.stale && new URL(o.url).pathname === options.stale) {
      return mockFetchResult("Not found", 404, "text/html");
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
    const result = await run({ robots: ALLOW_ALL });
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.message).toBe(
      "Every request naming a crawler robots.txt admits got the same response a browser got across 2 URL(s).",
    );
  });

  // robots.txt is advisory metadata; the edge decides independently, and the
  // operator only ever reads the first one.
  it("fails when robots.txt allows a crawler the edge answers with a non-2xx", async () => {
    const result = await run({
      robots: ALLOW_ALL,
      probe: () => mockFetchResult("", 503),
    });
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("503");
  });

  // A probe from the scanner's address shows how the site answers the
  // User-Agent. It never says what the verified crawler receives.
  it("words a finding as the answer to the User-Agent, not to the real crawler", async () => {
    const result = await run({
      robots: ALLOW_ALL,
      probe: () => mockFetchResult("", 503),
    });
    expect(result.message).toContain(
      "robots.txt admits these crawlers, and the edge answers differently when the User-Agent names them:",
    );
    expect(result.message).toContain(
      "so they show how the site answers a request that names the crawler, not what the real crawler receives.",
    );
    expect(result.message).not.toMatch(/\bsees\b|edge does not/);
  });

  // The mechanism compares a crawler answer against a browser 200. A stale
  // URL that answers 404 to everyone shows no difference at all.
  it("does not report a status the browser got as well", async () => {
    const result = await run({ robots: ALLOW_ALL, stale: "/docs/a" });
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.message).not.toContain("404");
    expect(result.found).toContain(
      "1 URL(s) not compared, because the browser got a non-2xx there too: https://example.com/docs/a",
    );
    expect(result.found).toContain("GPTBot: 0/1 answered differently");
  });

  it("passes when robots.txt disallows the crawler the edge also blocks", async () => {
    const result = await run({
      robots: DENY_ALL,
      probe: () => mockFetchResult("", 503),
    });
    expect(result.status).toBe(CheckStatus.Pass);
  });

  it("fails a Cloudflare challenge and names it", async () => {
    const result = await run({
      robots: ALLOW_ALL,
      probe: () =>
        withHeaders(mockFetchResult("", 403, "text/html"), {
          "cf-mitigated": "challenge",
        }),
    });
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("Cloudflare challenge");
  });

  it("fails a pay-per-crawl 402 and names it", async () => {
    const result = await run({
      robots: ALLOW_ALL,
      probe: () =>
        withHeaders(mockFetchResult("", 402), { "crawler-price": "USD 0.01" }),
    });
    expect(result.status).toBe(CheckStatus.Fail);
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
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("proof-of-work");
  });

  // A 200 carrying almost none of the page is a block wearing a 200.
  it("fails a soft block where the crawler gets a fraction of the text", async () => {
    const result = await run({
      robots: ALLOW_ALL,
      probe: () => mockFetchResult(THIN, 200, "text/html"),
    });
    expect(result.status).toBe(CheckStatus.Fail);
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
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.message).toContain("source IP");
    expect(result.message).toMatch(
      /^When the User-Agent names these crawlers, the edge answers differently: /,
    );
  });

  it("is notApplicable when the browser baseline is blocked too", async () => {
    const result = await run({ robots: ALLOW_ALL, baselineStatus: 503 });
    expect(result.status).toBe(CheckStatus.NotApplicable);
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

  // A homepage redirect answers /llms.txt with HTML. That is no llms.txt, so
  // it is not probed as one.
  it("does not probe /llms.txt when it answers with an HTML page", async () => {
    const seen: string[] = [];
    await run({
      robots: ALLOW_ALL,
      llmsBody:
        '<!DOCTYPE html>\n<html lang="fr"><head><title>Home</title></head><body>Shop</body></html>',
      seen,
    });
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.some((url) => new URL(url).pathname === "/llms.txt")).toBe(
      false,
    );
  });
});
