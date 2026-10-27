/**
 * Probes with no HTTP response are unassessed, not site defects.
 *
 * Each case runs an audit through the real request scheduler and fetcher,
 * with only undici and DNS replaced. A host stop, a timeout and a transport
 * error must leave the probe unassessed and name the cause; a confirmed 404
 * and a 200 without the expected content must still be judged.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("undici", () => {
  class Agent {
    compose() {
      return this;
    }
  }
  return { request: vi.fn(), Agent, interceptors: { redirect: vi.fn() } };
});

vi.mock("node:dns/promises", () => ({
  default: { lookup: vi.fn() },
}));

import { request } from "undici";
import dns from "node:dns/promises";
import { createFetcher, type Fetcher } from "#core/fetcher";
import { createRequestScheduler } from "#core/request-scheduler";
import { mockCheckContext, mockPageContext } from "#core/__tests__/test-utils";
import { probeSecurityUrl } from "#core/gatherers/security";
import { AuditResultSchema } from "#core/schemas";
import { CheckStatus } from "#core/types";
import type { CheckContext } from "#core/check-context";
import type { AuditResult } from "#core/types";
import { AcpPolicyLinkSurfaceAudit } from "#core/audits/agentic-commerce/acp-policy-link-surface";
import { AgentUaCommerceParityAudit } from "#core/audits/agentic-commerce/agent-ua-commerce-parity";
import { WebBotAuthRequestToleranceAudit } from "#core/audits/access-crawl-control/web-bot-auth-request-tolerance";
import { SitemapLastmodVerifiabilityAudit } from "#core/audits/machine-discovery/sitemap-lastmod-verifiability";

const mockRequest = vi.mocked(request);
const mockLookup = vi.mocked(dns.lookup);

const SITE = "https://example.com";

/** What the mocked network does with one request. */
type Outcome =
  | { status: number; body?: string; type?: string }
  | { fail: "timeout" | "reset" };

type Route = (url: string, headers: Record<string, string>) => Outcome;

function respond(outcome: Outcome) {
  if ("fail" in outcome) {
    if (outcome.fail === "timeout") {
      const error = new Error("The operation was aborted due to timeout");
      error.name = "TimeoutError";
      throw error;
    }
    throw Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" });
  }
  const bytes = Buffer.from(outcome.body ?? "", "utf8");
  return {
    statusCode: outcome.status,
    headers: { "content-type": outcome.type ?? "text/html; charset=utf-8" },
    body: {
      async *[Symbol.asyncIterator]() {
        yield bytes;
      },
      dump: async () => {},
    },
  };
}

/** A context whose fetch is the real fetcher behind the real scheduler. */
function liveContext(
  route: Route,
  html: string,
  pageUrl = `${SITE}/`,
): { ctx: CheckContext; fetcher: Fetcher } {
  mockRequest.mockImplementation((async (
    url: string,
    init: { headers?: Record<string, string> },
  ) => respond(route(url, init.headers ?? {}))) as unknown as typeof request);
  const fetcher = createFetcher({
    requestScheduler: createRequestScheduler({ gapMs: 0 }),
  });
  const ctx = mockCheckContext([mockPageContext(pageUrl, html)]);
  ctx.fetch = (options) => fetcher.fetch(options);
  return { ctx, fetcher };
}

/** Send one request the site answers 429, so the scheduler stops the host. */
async function stopHost(fetcher: Fetcher): Promise<void> {
  const result = await fetcher.fetch({ url: `${SITE}/rate-limited` });
  expect(result.status).toBe(429);
}

const rateLimit: Route = (url) =>
  new URL(url).pathname === "/rate-limited" ? { status: 429 } : { status: 404 };

function expectValid(result: AuditResult): void {
  expect(AuditResultSchema.safeParse(result).success).toBe(true);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockLookup.mockResolvedValue({ address: "93.184.216.34", family: 4 });
});

const POLICY_TEXT = `<html><head><title>Policy</title></head><body><main><h1>Policy</h1><p>${"This policy explains the terms that apply to every order. ".repeat(20)}</p></main></body></html>`;

const POLICY_LINKS = `<html><body><main><p>Shop.</p>
  <a href="/terms">Terms of Service</a>
  <a href="/privacy">Privacy Policy</a>
  <a href="/returns">Returns</a>
  <a href="/shipping">Shipping</a>
  <a href="/contact">Contact us</a>
  <a href="/about">About us</a>
  <a href="/faq">FAQ</a>
  <a href="/support">Support</a>
</main></body></html>`;

describe("agentic-commerce/acp-policy-link-surface", () => {
  const audit = new AcpPolicyLinkSurfaceAudit();
  const policies =
    (terms: Outcome): Route =>
    (url) => {
      const path = new URL(url).pathname;
      if (path === "/rate-limited") return { status: 429 };
      if (path === "/terms") return terms;
      return { status: 200, body: POLICY_TEXT };
    };

  it("leaves every link unassessed after a host stop", async () => {
    const { ctx, fetcher } = liveContext(rateLimit, POLICY_LINKS);
    await stopHost(fetcher);
    const result = await audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.NotApplicable);
    expect(result.message).toContain("Checkout eligibility was not assessed");
    expect(result.message).toContain("was not sent");
    expect(result.message).not.toContain("HTTP 0");
    expectValid(result);
  });

  it.each([
    ["timeout", "timed out before any HTTP response"],
    ["reset", "read ECONNRESET"],
  ] as const)("leaves a hard gate unassessed on a %s", async (fail, cause) => {
    const { ctx } = liveContext(policies({ fail }), POLICY_LINKS);
    const result = await audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.NotApplicable);
    expect(result.message).toContain(cause);
    expectValid(result);
  });

  it("still fails a hard gate that answers 404", async () => {
    const { ctx } = liveContext(policies({ status: 404 }), POLICY_LINKS);
    const result = await audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("terms_of_use");
    expect(result.message).toContain("returned HTTP 404");
  });

  it("still fails a hard gate that answers 200 without policy text", async () => {
    const thin = "<html><body><main><p>Soon.</p></main></body></html>";
    const { ctx } = liveContext(
      policies({ status: 200, body: thin }),
      POLICY_LINKS,
    );
    const result = await audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("characters of text");
  });

  it("passes when every link answers with policy text", async () => {
    const { ctx } = liveContext(
      policies({ status: 200, body: POLICY_TEXT }),
      POLICY_LINKS,
    );
    expect((await audit.audit(ctx)).status).toBe(CheckStatus.Pass);
  });
});

const PAGE = `<html><body><main><p>${"the resole kit ships in three sizes ".repeat(40)}</p></main></body></html>`;

describe("agentic-commerce/agent-ua-commerce-parity", () => {
  const audit = new AgentUaCommerceParityAudit();
  const byAgent =
    (agent: Outcome): Route =>
    (_url, headers) =>
      (headers["User-Agent"] ?? "").includes("ChatGPT-User") ||
      (headers["User-Agent"] ?? "").includes("OAI-SearchBot")
        ? agent
        : { status: 200, body: PAGE };

  it("names the unsent agent probes after a mid-scan host stop", async () => {
    // ChatGPT-User's request to the homepage is answered 429, so the
    // scheduler stops the host and every later request stays unsent.
    const route: Route = (_url, headers) =>
      (headers["User-Agent"] ?? "").includes("ChatGPT-User")
        ? { status: 429 }
        : { status: 200, body: PAGE };
    const { ctx } = liveContext(route, PAGE);
    const result = await audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.message).toContain("HTTP 429 where a browser got 200");
    expect(result.message).toContain(
      "the OAI-SearchBot request to https://example.com/ was not sent",
    );
    expect(result.message).not.toContain("HTTP 0");
    expectValid(result);
  });

  it.each([
    ["timeout", "timed out before any HTTP response"],
    ["reset", "read ECONNRESET"],
  ] as const)(
    "is not applicable when every agent probe ends in a %s",
    async (fail, cause) => {
      const { ctx } = liveContext(byAgent({ fail }), PAGE);
      const result = await audit.audit(ctx);
      expect(result.status).toBe(CheckStatus.NotApplicable);
      expect(result.message).toContain(cause);
      expectValid(result);
    },
  );

  it("still warns when an agent gets a 404 the browser does not", async () => {
    const { ctx } = liveContext(byAgent({ status: 404 }), PAGE);
    const result = await audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.message).toContain("HTTP 404 where a browser got 200");
  });

  it("still fails when an agent gets a 200 stub", async () => {
    const stub = "<html><body><main><p>One line.</p></main></body></html>";
    const { ctx } = liveContext(byAgent({ status: 200, body: stub }), PAGE);
    expect((await audit.audit(ctx)).status).toBe(CheckStatus.Fail);
  });
});

describe("access-crawl-control/web-bot-auth-request-tolerance", () => {
  const audit = new WebBotAuthRequestToleranceAudit();
  const signedGets =
    (signed: Outcome): Route =>
    (url, headers) => {
      if (new URL(url).pathname === "/rate-limited") return { status: 429 };
      return "Signature" in headers ? signed : { status: 200, body: PAGE };
    };

  it("leaves the signed probe unassessed after a host stop", async () => {
    const { ctx, fetcher } = liveContext(signedGets({ status: 200 }), PAGE);
    // The unsigned baseline is read first; the stop comes before the signed one.
    const baseline = await probeSecurityUrl(ctx, `${SITE}/`, {
      followRedirects: true,
    });
    expect(baseline?.status).toBe(200);
    await stopHost(fetcher);
    const result = await audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.NotApplicable);
    expect(result.message).toContain("signed request was not sent");
    expect(result.message).not.toContain("HTTP 0");
    expectValid(result);
  });

  it.each([
    ["timeout", "timed out before any HTTP response"],
    ["reset", "read ECONNRESET"],
  ] as const)("leaves a signed %s unassessed", async (fail, cause) => {
    const { ctx } = liveContext(signedGets({ fail }), PAGE);
    const result = await audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.NotApplicable);
    expect(result.message).toContain(cause);
    expectValid(result);
  });

  it("still fails a signed request answered 403", async () => {
    const { ctx } = liveContext(signedGets({ status: 403 }), PAGE);
    expect((await audit.audit(ctx)).status).toBe(CheckStatus.Fail);
  });

  it("still fails a signed 200 without the page", async () => {
    const { ctx } = liveContext(signedGets({ status: 200, body: "" }), PAGE);
    const result = await audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("0% of the unsigned body");
  });
});

describe("machine-discovery/sitemap-lastmod-verifiability", () => {
  const audit = new SitemapLastmodVerifiabilityAudit();
  const day = (n: number) =>
    new Date(Date.parse("2026-01-01T00:00:00Z") + n * 86_400_000)
      .toISOString()
      .slice(0, 10);
  const locs = Array.from({ length: 6 }, (_, i) => `${SITE}/post-${i}`);
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${locs
    .map(
      (loc, i) =>
        `<url><loc>${loc}</loc><lastmod>${day(i * 9)}</lastmod></url>`,
    )
    .join("")}</urlset>`;
  const dated = (i: number) =>
    `<html><head><script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","dateModified":"${day(i * 9)}"}</script></head><body><p>Post.</p></body></html>`;
  const HOME = "<html><body><main><p>Home.</p></main></body></html>";

  /** Serve the sitemap, then answer each post with `post(index, attempt)`. */
  const site = (post: (index: number, attempt: number) => Outcome): Route => {
    let attempt = 0;
    return (url) => {
      const path = new URL(url).pathname;
      if (path === "/sitemap.xml")
        return { status: 200, body: sitemap, type: "application/xml" };
      const match = /^\/post-(\d)$/.exec(path);
      if (match) return post(Number(match[1]), attempt++);
      return { status: 404 };
    };
  };

  it("does not report unread pages as undated after a host stop", async () => {
    // The first post read is answered 429; the scheduler holds back the rest.
    const { ctx } = liveContext(
      site((i, attempt) =>
        attempt === 0 ? { status: 429 } : { status: 200, body: dated(i) },
      ),
      HOME,
    );
    const result = await audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.NotApplicable);
    expect(result.message).toContain("6 of 6 sampled pages could not be read");
    expect(result.message).toContain("was not sent");
    expect(result.message).toContain("answered HTTP 429");
    expect(result.message).not.toContain("publish no modification time");
    expectValid(result);
  });

  it.each([
    ["timeout", "timed out before any HTTP response"],
    ["reset", "read ECONNRESET"],
  ] as const)(
    "keeps half a sample lost to a %s out of the judgement",
    async (fail, cause) => {
      const { ctx } = liveContext(
        site((i) => (i % 2 === 0 ? { fail } : { status: 200, body: dated(i) })),
        HOME,
      );
      const result = await audit.audit(ctx);
      expect(result.status).toBe(CheckStatus.NotApplicable);
      expect(result.message).toContain(
        "3 of 6 sampled pages could not be read",
      );
      expect(result.message).toContain("3 of the 3 read agree");
      expect(result.message).toContain(cause);
      expectValid(result);
    },
  );

  it("does not read a page that answers 404 as an undated page", async () => {
    const { ctx } = liveContext(
      site(() => ({ status: 404 })),
      HOME,
    );
    const result = await audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.NotApplicable);
    expect(result.message).toContain("answered HTTP 404");
  });

  it("still warns when read pages publish no date", async () => {
    const undated = "<html><body><p>Post.</p></body></html>";
    const { ctx } = liveContext(
      site(() => ({ status: 200, body: undated })),
      HOME,
    );
    const result = await audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.message).toContain(
      "6 of 6 read sample URLs (100%) publish no modification time",
    );
  });

  it("passes when every read page corroborates its lastmod", async () => {
    const { ctx } = liveContext(
      site((i) => ({ status: 200, body: dated(i) })),
      HOME,
    );
    expect((await audit.audit(ctx)).status).toBe(CheckStatus.Pass);
  });
});
