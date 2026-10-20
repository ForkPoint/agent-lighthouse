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
  /** The body the browser gets. Defaults to FULL. */
  baselineBody?: string;
  /** The response every crawler UA gets at /llms.txt, when it differs. */
  llmsProbe?: () => FetchResult;
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
    if (
      options.llmsProbe &&
      o.userAgent !== BASELINE_UA &&
      new URL(o.url).pathname === "/llms.txt"
    ) {
      return options.llmsProbe();
    }
    if (o.userAgent === BASELINE_UA) {
      return mockFetchResult(
        options.baselineBody ?? FULL,
        options.baselineStatus ?? 200,
        "text/html",
      );
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

  // A generic non-2xx to the probe can be the edge refusing an unverified
  // request that names the crawler, so it warns rather than fails.
  it("warns when robots.txt allows a crawler the edge answers with a non-2xx", async () => {
    const result = await run({
      robots: ALLOW_ALL,
      probe: () => mockFetchResult("", 503),
    });
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.message).toBe(
      "When the User-Agent names these crawlers, the edge answers differently: 8 crawler User-Agent(s) (GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot and 4 more) at https://example.com/: HTTP 503 where a browser got 200; 8 crawler User-Agent(s) (GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot and 4 more) at https://example.com/docs/a: HTTP 503 where a browser got 200. The scanner sends the crawler User-Agent from its own address, without the crawler's published IP range or Web Bot Auth signature, so a challenge, a 403, a 429 or another refusal can be the edge's defence against an unverified request naming the crawler, and the real crawler may be answered differently. Confirm against the edge logs before changing anything.",
    );
  });

  // A probe from the scanner's address shows how the site answers the
  // User-Agent. It never says what the verified crawler receives.
  it("words a finding as the answer to the User-Agent, not to the real crawler", async () => {
    const result = await run({
      robots: ALLOW_ALL,
      probe: () => mockFetchResult(THIN, 200, "text/html"),
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

  // Super Bot Fight Mode sets verified bots apart from automated traffic, so a
  // challenge to the unverified probe says nothing certain about the real bot.
  it("warns on a Cloudflare challenge and names it", async () => {
    const result = await run({
      robots: ALLOW_ALL,
      probe: () =>
        withHeaders(mockFetchResult("", 403, "text/html"), {
          "cf-mitigated": "challenge",
        }),
    });
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.message).toBe(
      "When the User-Agent names these crawlers, the edge answers differently: 8 crawler User-Agent(s) (GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot and 4 more) at https://example.com/: Cloudflare challenge (cf-mitigated: challenge); 8 crawler User-Agent(s) (GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot and 4 more) at https://example.com/docs/a: Cloudflare challenge (cf-mitigated: challenge). The scanner sends the crawler User-Agent from its own address, without the crawler's published IP range or Web Bot Auth signature, so a challenge, a 403, a 429 or another refusal can be the edge's defence against an unverified request naming the crawler, and the real crawler may be answered differently. Confirm against the edge logs before changing anything.",
    );
  });

  // The price is the site's own statement, and Cloudflare documents the 402 as
  // the answer every crawler gets until it verifies and pays.
  it("fails a pay-per-crawl 402 and names it", async () => {
    const result = await run({
      robots: ALLOW_ALL,
      probe: () =>
        withHeaders(mockFetchResult("", 402), { "crawler-price": "USD 0.01" }),
    });
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toBe(
      "robots.txt admits these crawlers, and the edge answers differently when the User-Agent names them: 8 crawler User-Agent(s) (GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot and 4 more) at https://example.com/: pay-per-crawl (402 with crawler-price: USD 0.01); 8 crawler User-Agent(s) (GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot and 4 more) at https://example.com/docs/a: pay-per-crawl (402 with crawler-price: USD 0.01). These probes come from the scanner's address without the crawler's published IP range or Web Bot Auth signature, so they show how the site answers a request that names the crawler, not what the real crawler receives.",
    );
  });

  // Anubis can admit a crawler only from its published addresses, so its wall
  // on the probe is the same ambiguity as a challenge.
  it("warns on a proof-of-work wall and names it", async () => {
    const result = await run({
      robots: ALLOW_ALL,
      probe: () =>
        mockFetchResult(
          "<html><body>Protected by Anubis</body></html>",
          200,
          "text/html",
        ),
    });
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.message).toBe(
      'When the User-Agent names these crawlers, the edge answers differently: 8 crawler User-Agent(s) (GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot and 4 more) at https://example.com/: proof-of-work wall (body contains "Protected by Anubis"); 8 crawler User-Agent(s) (GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot and 4 more) at https://example.com/docs/a: proof-of-work wall (body contains "Protected by Anubis"). The scanner sends the crawler User-Agent from its own address, without the crawler\'s published IP range or Web Bot Auth signature, so a challenge, a 403, a 429 or another refusal can be the edge\'s defence against an unverified request naming the crawler, and the real crawler may be answered differently. Confirm against the edge logs before changing anything.',
    );
  });

  // A 200 carrying almost none of the page is a different page body.
  it("fails a soft block where the crawler gets a fraction of the text", async () => {
    const result = await run({
      robots: ALLOW_ALL,
      probe: () => mockFetchResult(THIN, 200, "text/html"),
    });
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toBe(
      "robots.txt admits these crawlers, and the edge answers differently when the User-Agent names them: 8 crawler User-Agent(s) (GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot and 4 more) at https://example.com/: soft block — HTTP 200 with 1% of the baseline main-content text; 8 crawler User-Agent(s) (GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot and 4 more) at https://example.com/docs/a: soft block — HTTP 200 with 1% of the baseline main-content text. These probes come from the scanner's address without the crawler's published IP range or Web Bot Auth signature, so they show how the site answers a request that names the crawler, not what the real crawler receives.",
    );
  });

  // Akamai injects its script path into ordinary pages. A marker the browser
  // got as well is the site's normal page, so a real stub still fails.
  it("still fails a soft block when the browser page carries the same bot-manager script", async () => {
    const akam = '<script src="/akam/13/7e3f1a"></script>';
    const result = await run({
      robots: ALLOW_ALL,
      baselineBody: FULL.replace("</body>", `${akam}</body>`),
      probe: () =>
        mockFetchResult(
          THIN.replace("</body>", `${akam}</body>`),
          200,
          "text/html",
        ),
    });
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain(
      "soft block — HTTP 200 with 1% of the baseline main-content text",
    );
    expect(result.message).not.toContain("challenge page");
  });

  it("passes identical pages that both carry a bot-manager script", async () => {
    const page = FULL.replace(
      "</body>",
      '<script src="/_Incapsula_Resource?SWJIYLWA=719d34d3"></script></body>',
    );
    const result = await run({
      robots: ALLOW_ALL,
      baselineBody: page,
      probe: () => mockFetchResult(page, 200, "text/html"),
    });
    expect(result.status).toBe(CheckStatus.Pass);
  });

  // A thin 200 that is a challenge page is a refusal, not a different page.
  it("warns on a 200 challenge page rather than calling it a soft block", async () => {
    const result = await run({
      robots: ALLOW_ALL,
      probe: () =>
        mockFetchResult(
          '<html><head><title>Just a moment...</title></head><body><div id="px-captcha"></div></body></html>',
          200,
          "text/html",
        ),
    });
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.message).toBe(
      'When the User-Agent names these crawlers, the edge answers differently: 8 crawler User-Agent(s) (GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot and 4 more) at https://example.com/: challenge page (HTTP 200, body contains "Just a moment..."); 8 crawler User-Agent(s) (GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot and 4 more) at https://example.com/docs/a: challenge page (HTTP 200, body contains "Just a moment..."). The scanner sends the crawler User-Agent from its own address, without the crawler\'s published IP range or Web Bot Auth signature, so a challenge, a 403, a 429 or another refusal can be the edge\'s defence against an unverified request naming the crawler, and the real crawler may be answered differently. Confirm against the edge logs before changing anything.',
    );
  });

  // A hard finding beside a refusal fails, and the refusal is counted as
  // ambiguous rather than dropped.
  it("fails on the hard finding and notes the ambiguous ones beside it", async () => {
    const result = await run({
      robots: ALLOW_ALL,
      probe: () => mockFetchResult(THIN, 200, "text/html"),
      llms: true,
      llmsProbe: () => mockFetchResult("", 403, "text/plain"),
    });
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toBe(
      "robots.txt admits these crawlers, and the edge answers differently when the User-Agent names them: 8 crawler User-Agent(s) (GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot and 4 more) at https://example.com/: soft block — HTTP 200 with 1% of the baseline main-content text; 8 crawler User-Agent(s) (GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot and 4 more) at https://example.com/docs/a: soft block — HTTP 200 with 1% of the baseline main-content text. 1 further finding(s) are ambiguous. The scanner sends the crawler User-Agent from its own address, without the crawler's published IP range or Web Bot Auth signature, so a challenge, a 403, a 429 or another refusal can be the edge's defence against an unverified request naming the crawler, and the real crawler may be answered differently. Confirm against the edge logs before changing anything. These probes come from the scanner's address without the crawler's published IP range or Web Bot Auth signature, so they show how the site answers a request that names the crawler, not what the real crawler receives.",
    );
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
    expect(result.message).toContain(
      "without the crawler's published IP range or Web Bot Auth signature",
    );
    expect(result.message).not.toMatch(/\bsees\b|edge does not/);
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
