import { vi } from "vitest";
import type { FetchResult } from "./fetcher";

// The robots-first root-file fetch and the per-scan dead-host refusal, end to
// end through runScan. The fetcher is stubbed: each URL answers from a
// test-controlled map, and every request is logged with when it started and
// when it ended, so a test can see what was sent and in what order.

const h = vi.hoisted(() => ({
  map: new Map<string, FetchResult>(),
  /** Every request, in the order it was sent. */
  calls: [] as string[],
  /** Start and end of every request, in the order they happened. */
  events: [] as string[],
  /** Hosts that accept no connection. */
  deadHosts: new Set<string>(),
  /** Error text returned for /robots.txt, with status 0, when set. */
  robotsError: "",
  /** How long /robots.txt takes to answer. */
  robotsDelayMs: 0,
}));

const CONNECT_TIMEOUT =
  "Connect Timeout Error (attempted address: example.com:443, timeout: 10000ms) (UND_ERR_CONNECT_TIMEOUT)";

function result(url: string, status: number, body = ""): FetchResult {
  return {
    url,
    finalUrl: url,
    status,
    headers: { "content-type": "text/html" },
    body,
    ttfbMs: 1,
    totalMs: 2,
    contentType: "text/html",
    contentLength: body.length,
  };
}

function failed(url: string, error: string): FetchResult {
  return { ...result(url, 0), headers: {}, contentType: "", error };
}

vi.mock("./fetcher", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./fetcher")>();
  return {
    ...actual,
    isSafeUrl: async () => true,
    createFetcher: () => ({
      fetch: async ({ url }: { url: string }) => {
        h.calls.push(url);
        h.events.push(`start ${url}`);
        const target = new URL(url);
        let answer: FetchResult;
        if (h.deadHosts.has(target.hostname)) {
          answer = failed(url, CONNECT_TIMEOUT);
        } else if (target.pathname === "/robots.txt") {
          if (h.robotsDelayMs > 0)
            await new Promise((resolve) => setTimeout(resolve, h.robotsDelayMs));
          answer = h.robotsError
            ? failed(url, h.robotsError)
            : (h.map.get(url) ?? result(url, 404));
        } else {
          answer = h.map.get(url) ?? result(url, 404);
        }
        h.events.push(`end ${url}`);
        return answer;
      },
      summary: () => ({ requests: 0, statuses: {}, failures: {}, open: [] }),
    }),
  };
});

// Avoid jsdom for every page; the orchestrator only needs a result object.
vi.mock("./audits/operability-safety/runner", () => ({
  runA11yForHtml: vi.fn(async () => ({})),
  A11Y_RULES: [],
}));

// The real audit runner, kept spy-able so a test can read the context the
// audits get and fetch through it as an audit would.
vi.mock("./audit-runner", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./audit-runner")>();
  return { ...actual, runAudits: vi.fn(actual.runAudits) };
});

import { runScan } from "./orchestrator";
import { runAudits } from "./audit-runner";
import type { CheckContext } from "./check-context";
import { defaultOriginCache } from "./origin-cache";
import { PhaseId } from "./progress";
import type { ScanEvent } from "./progress";

const SITE = "https://example.com/";
const HOME = `<html><body><main><h1>Kettles</h1><p>${"copper kettle ".repeat(60)}</p></main></body></html>`;

/** The context the audits were handed in the last scan. */
function auditContext(): CheckContext {
  const calls = vi.mocked(runAudits).mock.calls;
  return calls.at(-1)![0];
}

/**
 * Requests of the root-file phase: everything before the homepage request.
 * Audits fetch some root files again later, robots.txt among them.
 */
function rootPhase(): string[] {
  const home = h.calls.indexOf(SITE);
  return home === -1 ? [...h.calls] : h.calls.slice(0, home);
}

/** robots.txt requests of the root-file phase. */
function robotsRequests(): number {
  return rootPhase().filter((url) => url === `${SITE}robots.txt`).length;
}

/** Root-file requests other than robots.txt, in the order they were sent. */
function otherRootFiles(): string[] {
  return rootPhase().filter((url) => url !== `${SITE}robots.txt`);
}

beforeEach(() => {
  h.map.clear();
  h.calls.length = 0;
  h.events.length = 0;
  h.deadHosts.clear();
  h.robotsError = "";
  h.robotsDelayMs = 0;
  defaultOriginCache.clear();
  vi.mocked(runAudits).mockClear();
});

describe("runScan — root files wait for robots.txt", () => {
  // On an origin that accepts no connection, root files sent together each
  // waited out the connect timeout. robots.txt goes alone, so its answer
  // decides whether the rest leave at all.
  it("sends no other root file until robots.txt has answered", async () => {
    h.robotsDelayMs = 20;
    h.map.set(SITE, result(SITE, 200, HOME));

    await runScan(SITE);

    const robotsEnd = h.events.indexOf(`end ${SITE}robots.txt`);
    const firstOther = h.events.findIndex(
      (event) =>
        event.startsWith("start ") && event !== `start ${SITE}robots.txt`,
    );
    expect(robotsEnd).toBeGreaterThanOrEqual(0);
    expect(firstOther).toBeGreaterThan(robotsEnd);
    expect(otherRootFiles()).toContain(`${SITE}llms.txt`);
  });

  it("hands the audits an unsent result for each root file when robots.txt cannot connect", async () => {
    h.robotsError = CONNECT_TIMEOUT;

    await runScan(SITE);

    expect(otherRootFiles()).toEqual([]);
    const { rootFiles } = auditContext();
    expect(rootFiles["/robots.txt"]?.error).toBe(CONNECT_TIMEOUT);
    const llms = rootFiles["/llms.txt"];
    expect(llms?.status).toBe(0);
    expect(llms?.url).toBe(`${SITE}llms.txt`);
    expect(llms?.error).toContain("example.com did not accept a connection");
    expect(llms?.error).toContain("UND_ERR_CONNECT_TIMEOUT");
    // Every root file has a slot, so no audit reads `undefined` as a file
    // the scan forgot to ask for.
    expect(Object.keys(rootFiles).length).toBeGreaterThan(20);
    for (const file of Object.values(rootFiles)) expect(file.status).toBe(0);
  });

  // Each root file is reported done once, whether it was sent or not, so
  // the progress bar reaches the end of the phase and does not overshoot it.
  it("reports every root file done exactly once when the origin refuses", async () => {
    h.robotsError = CONNECT_TIMEOUT;
    const events: ScanEvent[] = [];

    await runScan(SITE, { onEvent: (event) => events.push(event) });

    const start = events.find(
      (e) => e.type === "phase:start" && e.phase === PhaseId.FetchRoot,
    );
    const labels = events
      .filter((e) => e.type === "unit:done" && e.phase === PhaseId.FetchRoot)
      .map((e) => (e.type === "unit:done" ? e.label : undefined));
    expect(start).toMatchObject({ totalUnits: labels.length });
    expect(labels.filter((label) => label === "/robots.txt")).toHaveLength(1);
    expect(new Set(labels).size).toBe(labels.length);
  });

  // Only a failure before the connection opened says the origin is gone. A
  // reset or TLS error shows a host that is there, so robots.txt is not tried
  // again and the other root files are sent.
  it("does not retry robots.txt or hold the root files after a reset", async () => {
    h.robotsError = "other side closed (UND_ERR_SOCKET)";
    h.map.set(SITE, result(SITE, 200, HOME));

    await runScan(SITE);

    expect(robotsRequests()).toBe(1);
    expect(otherRootFiles()).toContain(`${SITE}llms.txt`);
  });

  it("does not retry robots.txt after an HTTP error status", async () => {
    h.map.set(`${SITE}robots.txt`, result(`${SITE}robots.txt`, 503));
    h.map.set(SITE, result(SITE, 200, HOME));

    await runScan(SITE);

    expect(robotsRequests()).toBe(1);
    expect(auditContext().rootFiles["/robots.txt"]?.status).toBe(503);
    expect(otherRootFiles()).toContain(`${SITE}llms.txt`);
  });

  it("uses a robots.txt the caller already has instead of fetching it", async () => {
    const robots = result(`${SITE}robots.txt`, 200, "User-agent: *\nAllow: /");
    h.map.set(SITE, result(SITE, 200, HOME));

    await runScan(SITE, { robotsTxt: robots });

    expect(robotsRequests()).toBe(0);
    expect(auditContext().rootFiles["/robots.txt"]).toBe(robots);
    expect(otherRootFiles()).toContain(`${SITE}llms.txt`);
  });

  // A caller's robots.txt that failed to connect is the first attempt. The
  // scan makes the second one itself before it gives up on the origin.
  it("tries once more when the caller's robots.txt failed to connect", async () => {
    h.map.set(SITE, result(SITE, 200, HOME));

    await runScan(SITE, {
      robotsTxt: failed(`${SITE}robots.txt`, CONNECT_TIMEOUT),
    });

    expect(robotsRequests()).toBe(1);
    expect(auditContext().rootFiles["/robots.txt"]?.status).toBe(404);
    expect(otherRootFiles()).toContain(`${SITE}llms.txt`);
  });
});

describe("runScan — hosts that refused a connection", () => {
  /** Run one scan whose audits first make `probe`'s requests. */
  async function scanWithProbe(
    probe: (ctx: CheckContext) => Promise<void>,
  ): Promise<void> {
    const actual =
      await vi.importActual<typeof import("./audit-runner")>("./audit-runner");
    vi.mocked(runAudits).mockImplementationOnce(async (ctx, ...rest) => {
      await probe(ctx);
      return actual.runAudits(ctx, ...rest);
    });
    await runScan(SITE);
  }

  // A sitemap listing pages on a host that never connects made each audit
  // wait out the connect timeout once per URL. The host is tried once.
  it("sends one request to a dead host and refuses the rest at once", async () => {
    h.map.set(SITE, result(SITE, 200, HOME));
    h.deadHosts.add("cdn.dead.test");
    const results: FetchResult[] = [];

    await scanWithProbe(async (ctx) => {
      results.push(await ctx.fetch({ url: "https://cdn.dead.test/a" }));
      results.push(await ctx.fetch({ url: "https://cdn.dead.test/b" }));
    });

    expect(h.calls.filter((url) => url.includes("cdn.dead.test"))).toEqual([
      "https://cdn.dead.test/a",
    ]);
    expect(results[0]?.error).toBe(CONNECT_TIMEOUT);
    expect(results[1]?.status).toBe(0);
    expect(results[1]?.url).toBe("https://cdn.dead.test/b");
    expect(results[1]?.error).toContain(
      "cdn.dead.test refused a connection earlier in this scan",
    );
  });

  // A connect timeout on the scanned site can be a one-off under load. The
  // scan keeps asking the site it reads.
  it("keeps sending to the scanned site after it failed to connect", async () => {
    h.map.set(SITE, result(SITE, 200, HOME));
    const results: FetchResult[] = [];

    await scanWithProbe(async (ctx) => {
      h.deadHosts.add("example.com");
      results.push(await ctx.fetch({ url: `${SITE}a` }));
      results.push(await ctx.fetch({ url: `${SITE}b` }));
      h.deadHosts.clear();
    });

    expect(h.calls).toContain(`${SITE}a`);
    expect(h.calls).toContain(`${SITE}b`);
    expect(results[1]?.error).toBe(CONNECT_TIMEOUT);
  });

  // The homepage redirected to another host. That host is the site too.
  it("never refuses the host the homepage redirected to", async () => {
    const landing = "https://shop.example.net/";
    h.map.set(SITE, { ...result(SITE, 200, HOME), finalUrl: landing });

    await scanWithProbe(async (ctx) => {
      h.deadHosts.add("shop.example.net");
      await ctx.fetch({ url: `${landing}a` });
      await ctx.fetch({ url: `${landing}b` });
      h.deadHosts.clear();
    });

    expect(h.calls).toContain(`${landing}a`);
    expect(h.calls).toContain(`${landing}b`);
  });
});
