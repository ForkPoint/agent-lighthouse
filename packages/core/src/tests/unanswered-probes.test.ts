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
import { AboutCredentialsAudit } from "#core/audits/answer-readiness/about-credentials";
import { RssFeedAudit } from "#core/audits/machine-discovery/rss-feed";
import { ConditionalRequestSupportAudit } from "#core/audits/machine-discovery/conditional-request-support";
import { AgentCommerceFeedParityAudit } from "#core/audits/machine-discovery/agent-commerce-feed-parity";
import { AiCatalogExistsAudit } from "#core/audits/agent-interfaces/ai-catalog-exists";
import { AuthorPageAudit } from "#core/audits/answer-readiness/author-page";
import { HOST_STOPPED_MESSAGE } from "#core/request-scheduler";

const mockRequest = vi.mocked(request);
const mockLookup = vi.mocked(dns.lookup);

const SITE = "https://example.com";

/** What the mocked network does with one request. */
type Outcome =
  | {
      status: number;
      body?: string;
      type?: string;
      headers?: Record<string, string>;
    }
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
    headers: {
      "content-type": outcome.type ?? "text/html; charset=utf-8",
      ...outcome.headers,
    },
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

const HOME_PAGE = "<html><body><main><p>Home.</p></main></body></html>";

/** Read root files through the fetcher, as the scan's root phase does. */
async function readRootFiles(
  ctx: CheckContext,
  fetcher: Fetcher,
  paths: string[],
): Promise<void> {
  for (const path of paths)
    ctx.rootFiles[path] = await fetcher.fetch({ url: `${SITE}${path}` });
}

describe("answer-readiness/about-credentials", () => {
  const audit = new AboutCredentialsAudit();
  const ABOUT_PATHS = [
    "/about/",
    "/about-us/",
    "/about",
    "/pages/about",
    "/pages/about-us",
    "/pages/our-story",
    "/our-story",
  ];

  it("leaves the about page unassessed after a host stop", async () => {
    const { ctx, fetcher } = liveContext(rateLimit, HOME_PAGE);
    await stopHost(fetcher);
    const result = await audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.NotApplicable);
    expect(result.message).toContain("7 of 7 common paths were not assessed");
    expect(result.message).toContain("was not sent");
    expectValid(result);
  });

  it("fails on the root phase's 404s without asking again", async () => {
    const { ctx, fetcher } = liveContext(rateLimit, HOME_PAGE);
    await readRootFiles(ctx, fetcher, ABOUT_PATHS);
    await stopHost(fetcher);
    const calls = mockRequest.mock.calls.length;
    const result = await audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("No about page found");
    expect(mockRequest.mock.calls.length).toBe(calls);
  });

  it("still judges an about page that answers without credentials", async () => {
    const route: Route = (url) =>
      new URL(url).pathname === "/about/"
        ? {
            status: 200,
            body: "<html><body><p>We sell shoes.</p></body></html>",
          }
        : { status: 404 };
    const { ctx } = liveContext(route, HOME_PAGE);
    const result = await audit.audit(ctx);
    expect(result.status).not.toBe(CheckStatus.NotApplicable);
    expect(result.status).not.toBe(CheckStatus.Pass);
  });
});

describe("machine-discovery/rss-feed", () => {
  const audit = new RssFeedAudit();
  const ADVERTISED = `<html><head><link rel="alternate" type="application/rss+xml" href="/news.xml"></head><body><p>Home.</p></body></html>`;

  it("does not claim the common paths are empty after a host stop", async () => {
    const { ctx, fetcher } = liveContext(rateLimit, HOME_PAGE);
    await stopHost(fetcher);
    const result = await audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.NotApplicable);
    expect(result.message).toContain("no feed was read at the common paths");
    expect(result.message).toContain("was not sent");
    expect(result.message).not.toContain("nothing at the common paths");
    expectValid(result);
  });

  it("states the observed absence when every path answers 404", async () => {
    const { ctx } = liveContext(() => ({ status: 404 }), HOME_PAGE);
    const result = await audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.NotApplicable);
    expect(result.message).toContain("nothing at the common paths");
  });

  it.each([
    ["timeout", "timed out before any HTTP response"],
    ["reset", "read ECONNRESET"],
  ] as const)(
    "does not fail an advertised feed lost to a %s",
    async (fail, cause) => {
      const route: Route = (url) =>
        new URL(url).pathname === "/news.xml" ? { fail } : { status: 404 };
      const { ctx } = liveContext(route, ADVERTISED);
      const result = await audit.audit(ctx);
      expect(result.status).toBe(CheckStatus.NotApplicable);
      expect(result.message).toContain(cause);
      expectValid(result);
    },
  );

  it("still fails an advertised feed that answers 404", async () => {
    const { ctx } = liveContext(() => ({ status: 404 }), ADVERTISED);
    expect((await audit.audit(ctx)).status).toBe(CheckStatus.Fail);
  });
});

describe("machine-discovery/conditional-request-support", () => {
  const audit = new ConditionalRequestSupportAudit();
  const ROBOTS = {
    status: 200,
    body: "User-agent: *\nAllow: /\n",
    type: "text/plain",
  };

  it("does not infer missing files after a host stop", async () => {
    const { ctx, fetcher } = liveContext(
      (url) =>
        new URL(url).pathname === "/robots.txt" ? ROBOTS : rateLimit(url, {}),
      HOME_PAGE,
    );
    await readRootFiles(ctx, fetcher, ["/robots.txt"]);
    await stopHost(fetcher);
    const result = await audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.NotApplicable);
    expect(result.message).toContain("No discovery surface could be read");
    expect(result.message).toContain("was not sent");
    expect(result.message).not.toContain("there is no robots.txt");
    expectValid(result);
  });

  const revalidating =
    (conditional: Outcome): Route =>
    (url, headers) => {
      if (new URL(url).pathname !== "/robots.txt") return { status: 404 };
      if ("If-None-Match" in headers) return conditional;
      return { ...ROBOTS, headers: { etag: '"v1"' } };
    };

  it.each([
    ["timeout", "timed out before any HTTP response"],
    ["reset", "read ECONNRESET"],
  ] as const)(
    "does not read a conditional request lost to a %s as a 200",
    async (fail, cause) => {
      const { ctx, fetcher } = liveContext(revalidating({ fail }), HOME_PAGE);
      await readRootFiles(ctx, fetcher, ["/robots.txt"]);
      const result = await audit.audit(ctx);
      expect(result.status).toBe(CheckStatus.NotApplicable);
      expect(result.message).toContain("If-None-Match request");
      expect(result.message).toContain(cause);
      expect(result.message).not.toContain("rather than 304");
      expectValid(result);
    },
  );

  it("still fails a conditional request answered 200", async () => {
    const { ctx, fetcher } = liveContext(
      revalidating({ ...ROBOTS, headers: { etag: '"v1"' } }),
      HOME_PAGE,
    );
    await readRootFiles(ctx, fetcher, ["/robots.txt"]);
    const result = await audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("problem");
  });
});

describe("machine-discovery/agent-commerce-feed-parity", () => {
  const audit = new AgentCommerceFeedParityAudit();
  const locs = Array.from(
    { length: 3 },
    (_, i) => `${SITE}/products/item-${i}`,
  );
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${locs
    .map((loc) => `<url><loc>${loc}</loc></url>`)
    .join("")}</urlset>`;
  const site =
    (page: Outcome): Route =>
    (url) => {
      const path = new URL(url).pathname;
      if (path === "/sitemap.xml")
        return { status: 200, body: sitemap, type: "application/xml" };
      if (path.startsWith("/products/")) return page;
      return { status: 404 };
    };

  it("marks an unread sample unassessed after a host stop", async () => {
    // The first product page answers 429; the scheduler holds back the rest.
    let first = true;
    const route: Route = (url, headers) => {
      if (new URL(url).pathname.startsWith("/products/") && first) {
        first = false;
        return { status: 429 };
      }
      return site({ status: 200, body: HOME_PAGE })(url, headers);
    };
    const { ctx } = liveContext(route, HOME_PAGE);
    const result = await audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.NotApplicable);
    expect(result.message).toContain("2 were not read");
    expect(result.message).toContain("was not sent");
    expectValid(result);
  });

  it("still reports no product page when the sample was read", async () => {
    const { ctx } = liveContext(
      site({ status: 200, body: HOME_PAGE }),
      HOME_PAGE,
    );
    const result = await audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.NotApplicable);
    expect(result.message).toContain("No product page in the sitemap sample");
  });
});

describe("agent-interfaces/ai-catalog-exists", () => {
  const audit = new AiCatalogExistsAudit();
  const CATALOG_PATHS = [
    "/.well-known/ard.json",
    "/.well-known/ai-catalog.json",
  ];

  it("leaves the catalog unassessed when the root reads were held back", async () => {
    const { ctx, fetcher } = liveContext(rateLimit, HOME_PAGE);
    await stopHost(fetcher);
    await readRootFiles(ctx, fetcher, CATALOG_PATHS);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.NotApplicable);
    expect(result.message).toContain("not every well-known path was read");
    expect(result.message).toContain("was not sent");
    expect(result.message).not.toContain("HTTP 0");
    expectValid(result);
  });

  it.each([
    ["timeout", "timed out before any HTTP response"],
    ["redirect loop", "is caught in a redirect loop"],
  ] as const)("names a %s on one path", async (_kind, cause) => {
    const route: Route = (url) => {
      const path = new URL(url).pathname;
      if (path === "/.well-known/ard.json") return { status: 404 };
      return _kind === "timeout"
        ? { fail: "timeout" }
        : { status: 302, headers: { location: path } };
    };
    const { ctx, fetcher } = liveContext(route, HOME_PAGE);
    for (const path of CATALOG_PATHS)
      ctx.rootFiles[path] = await fetcher.fetch({
        url: `${SITE}${path}`,
        followRedirects: true,
      });
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.NotApplicable);
    expect(result.message).toContain(cause);
  });

  it("still fails when both paths answer 404", async () => {
    const { ctx, fetcher } = liveContext(() => ({ status: 404 }), HOME_PAGE);
    await readRootFiles(ctx, fetcher, CATALOG_PATHS);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("HTTP 404");
  });

  it("names a transport failure on one path", async () => {
    const route: Route = (url) =>
      new URL(url).pathname === "/.well-known/ard.json"
        ? { status: 404 }
        : { fail: "reset" };
    const { ctx, fetcher } = liveContext(route, HOME_PAGE);
    await readRootFiles(ctx, fetcher, CATALOG_PATHS);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.NotApplicable);
    expect(result.message).toContain("failed before any HTTP response");
    expect(result.message).not.toContain("HTTP 0");
    expectValid(result);
  });

  it("keeps a confirmed 404 beside a path the scheduler held back", async () => {
    const { ctx, fetcher } = liveContext(rateLimit, HOME_PAGE);
    ctx.rootFiles["/.well-known/ard.json"] = await fetcher.fetch({
      url: `${SITE}/.well-known/ard.json`,
    });
    await stopHost(fetcher);
    ctx.rootFiles["/.well-known/ai-catalog.json"] = await fetcher.fetch({
      url: `${SITE}/.well-known/ai-catalog.json`,
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.NotApplicable);
    // The explanation and the found value both carry each path's own state.
    for (const text of [result.message, result.found]) {
      expect(text).toContain("/.well-known/ard.json: HTTP 404");
      expect(text).toContain("/.well-known/ai-catalog.json: was not sent");
      expect(text).not.toContain("HTTP 0");
    }
    expectValid(result);
  });

  it("passes when a path serves a manifest with entries", async () => {
    const manifest = JSON.stringify({
      entries: [
        {
          identifier: "urn:air:example.com:server:search",
          displayName: "Search",
          type: "application/mcp-server-card+json",
          url: `${SITE}/mcp/search.json`,
        },
      ],
    });
    const route: Route = (url) =>
      new URL(url).pathname === "/.well-known/ai-catalog.json"
        ? { status: 200, body: manifest, type: "application/json" }
        : { status: 404 };
    const { ctx, fetcher } = liveContext(route, HOME_PAGE);
    await readRootFiles(ctx, fetcher, CATALOG_PATHS);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.message).toContain("/.well-known/ai-catalog.json");
  });
});

describe("answer-readiness/author-page", () => {
  const audit = new AuthorPageAudit();
  const AUTHOR_URL = `${SITE}/authors/jane`;
  const ARTICLE = `<html><body><main>
    <script type="application/ld+json">
    {"@context":"https://schema.org","@type":"Article","author":{"@type":"Person","name":"Jane","url":"${AUTHOR_URL}"}}
    </script>
    <p>Article.</p></main></body></html>`;
  const authorAnswers =
    (outcome: Outcome): Route =>
    (url) => {
      const path = new URL(url).pathname;
      if (path === "/rate-limited") return { status: 429 };
      return path === "/authors/jane" ? outcome : { status: 404 };
    };

  /**
   * Record the URLs the scheduler held back, as the audit runner does for
   * `coverage.unsentUrls`.
   */
  function trackUnsent(ctx: CheckContext): Set<string> {
    const unsent = new Set<string>();
    const fetch = ctx.fetch;
    ctx.fetch = async (options) => {
      const fetched = await fetch(options);
      if (fetched.error?.startsWith(HOST_STOPPED_MESSAGE))
        unsent.add(options.url);
      return fetched;
    };
    return unsent;
  }

  it("leaves the author page unassessed after a host stop", async () => {
    const { ctx, fetcher } = liveContext(
      authorAnswers({ status: 200, body: "<p>Bio.</p>" }),
      ARTICLE,
      `${SITE}/blog/post`,
    );
    const unsent = trackUnsent(ctx);
    await stopHost(fetcher);
    const result = await audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.NotApplicable);
    expect(result.message).toContain(AUTHOR_URL);
    expect(result.message).toContain(
      "was not sent: the scan paused this site after HTTP 403, 429 or repeated 503",
    );
    expect(result.found).toContain(`${AUTHOR_URL} (not assessed`);
    // Verdict, explanation and coverage name the same unsent URL.
    expect([...unsent]).toEqual([AUTHOR_URL]);
    expectValid(result);
  });

  it.each([
    ["timeout", "timed out before any HTTP response"],
    ["reset", "failed before any HTTP response"],
  ] as const)("names a %s on the author link", async (kind, cause) => {
    const { ctx } = liveContext(
      authorAnswers({ fail: kind }),
      ARTICLE,
      `${SITE}/blog/post`,
    );
    const unsent = trackUnsent(ctx);
    const result = await audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.NotApplicable);
    expect(result.message).toContain(AUTHOR_URL);
    expect(result.message).toContain(cause);
    // A transport failure was sent, so coverage lists nothing as unsent.
    expect(unsent.size).toBe(0);
    expectValid(result);
  });

  it("still fails an author link that answers 404", async () => {
    const { ctx } = liveContext(
      authorAnswers({ status: 404 }),
      ARTICLE,
      `${SITE}/blog/post`,
    );
    const result = await audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("returned HTTP 404");
    expectValid(result);
  });

  it("passes an author link that answers 200", async () => {
    const { ctx } = liveContext(
      authorAnswers({ status: 200, body: "<p>Bio.</p>" }),
      ARTICLE,
      `${SITE}/blog/post`,
    );
    const result = await audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Pass);
    expectValid(result);
  });
});
