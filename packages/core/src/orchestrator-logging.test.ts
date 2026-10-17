import { afterEach, describe, expect, it, vi } from "vitest";
import { MockAgent } from "undici";
import type { FetcherSummary } from "./fetcher";
import { LogField, LogLevel, type LogFields, type LoggerLike } from "./logger";
import { PhaseId } from "./progress";
import { captureLogs } from "./tests/capture-logs";

// The real fetcher runs, against an undici MockAgent, so its own request
// lines are what these tests read. Only the DNS gate is stubbed, and a test
// can add requests that never ended to the fetcher's summary.
const h = vi.hoisted(() => ({
  open: undefined as FetcherSummary["open"] | undefined,
}));

vi.mock("./fetcher", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./fetcher")>();
  return {
    ...actual,
    isSafeUrl: async () => true,
    createFetcher: (options: Parameters<typeof actual.createFetcher>[0]) => {
      const fetcher = actual.createFetcher(options);
      return {
        ...fetcher,
        summary: () => {
          const summary = fetcher.summary();
          return h.open ? { ...summary, open: h.open } : summary;
        },
      };
    },
  };
});

// Avoid spinning up jsdom for every page.
vi.mock("./audits/operability-safety/runner", () => ({
  runA11yForHtml: vi.fn(async () => ({})),
  A11Y_RULES: [],
}));

import { runScan } from "./orchestrator";

const HOME = `<html><head><title>Home</title></head><body><main><h1>Hello</h1><p>Some content here.</p></main></body></html>`;

/**
 * A site that serves a homepage and answers 404 to everything else. Paths in
 * `refuse` fail to connect, as a host that drops the connection does.
 */
function site(
  origin = "https://example.com",
  refuse: string[] = [],
): MockAgent {
  const agent = new MockAgent();
  agent.disableNetConnect();
  const pool = agent.get(origin);
  for (const path of refuse)
    pool
      .intercept({ path, method: () => true })
      .replyWithError(
        Object.assign(new Error("connect ECONNREFUSED"), {
          code: "ECONNREFUSED",
        }),
      )
      .persist();
  pool
    .intercept({ path: "/", method: "GET" })
    .reply(200, HOME, { headers: { "content-type": "text/html" } })
    .persist();
  pool
    .intercept({ path: () => true, method: () => true })
    .reply(404, "")
    .persist();
  return agent;
}

afterEach(() => {
  h.open = undefined;
});

/** Run `fn` with every log line captured as JSON. */
async function logsOf<T>(
  fn: () => Promise<T>,
): Promise<{ lines: LogFields[]; value: T }> {
  const logs = captureLogs(LogLevel.Trace);
  try {
    return { value: await fn(), lines: logs.lines };
  } finally {
    logs.restore();
  }
}

const requestLines = (lines: LogFields[]): LogFields[] =>
  lines.filter(
    (l) =>
      l[LogField.Component] === "fetcher" &&
      (l["msg"] === "Request started" || l["msg"] === "Request finished"),
  );

describe("runScan — where a log line came from", () => {
  it("names the audit on every request of the audits phase, and the shared gatherer that sent it", async () => {
    const { lines } = await logsOf(() =>
      runScan("https://example.com/", { dispatcher: site() }),
    );
    const requests = requestLines(lines);
    const inAudits = requests.filter(
      (l) => l[LogField.Phase] === PhaseId.Audits,
    );
    expect(inAudits.length).toBeGreaterThan(5);
    // A request an audit's run made, directly or through a gatherer, says
    // which audit it was for.
    expect(inAudits.every((l) => typeof l[LogField.Audit] === "string")).toBe(
      true,
    );
    // Shared gatherer work names the gatherer, whichever audit started it.
    const gatherers = new Set(inAudits.map((l) => l[LogField.Gatherer]));
    for (const name of ["sitemap", "feeds", "conditional", "security", "rsl"])
      expect(gatherers).toContain(name);
    // Requests before the audits name no audit: the context does not leak
    // out of the audit that set it.
    const before = requests.filter((l) => l[LogField.Phase] !== PhaseId.Audits);
    expect(before.length).toBeGreaterThan(0);
    expect(before.map((l) => l[LogField.Phase])).toContain(PhaseId.FetchRoot);
    expect(
      before.filter(
        (l) =>
          l[LogField.Audit] !== undefined || l[LogField.Gatherer] !== undefined,
      ),
    ).toEqual([]);
  });

  it("keeps each scan's id and site on its own request lines when two run side by side", async () => {
    const { lines, value } = await logsOf(() =>
      Promise.all([
        runScan("https://example.com/", { dispatcher: site() }),
        runScan("https://example.org/", {
          dispatcher: site("https://example.org"),
        }),
      ]),
    );
    const [com, org] = value;
    expect(com.scanId).not.toBe(org.scanId);
    const requests = requestLines(lines);
    for (const [report, host] of [
      [com, "example.com"],
      [org, "example.org"],
    ] as const) {
      const mine = requests.filter((l) => l[LogField.Scan] === report.scanId);
      expect(mine.length).toBeGreaterThan(5);
      expect(mine.every((l) => l[LogField.Site] === host)).toBe(true);
      expect(
        mine.every((l) =>
          String(l[LogField.Url]).startsWith(`https://${host}/`),
        ),
      ).toBe(true);
    }
    expect(
      requests.every(
        (l) =>
          l[LogField.Scan] === com.scanId || l[LogField.Scan] === org.scanId,
      ),
    ).toBe(true);
  });

  it("sends the fetcher's lines to the caller's logger too, without the scan URL's credentials", async () => {
    const calls: Array<{ level: string; fields: LogFields; msg?: string }> = [];
    const method =
      (level: string) =>
      (fields: LogFields | string, msg?: string): void => {
        calls.push(
          typeof fields === "string"
            ? { level, fields: {}, msg: fields }
            : { level, fields, ...(msg !== undefined && { msg }) },
        );
      };
    const target: LoggerLike = {
      error: method("error"),
      warn: method("warn"),
      info: method("info"),
      debug: method("debug"),
      trace: method("trace"),
      child: () => target,
      isLevelEnabled: () => true,
    };
    const { lines } = await logsOf(() =>
      runScan("https://scanner:hunter2@example.com/", {
        dispatcher: site(),
        logger: target,
        scanId: "run-7",
      }),
    );
    // Nothing reaches the built-in sinks while a caller's logger is set.
    expect(lines).toEqual([]);
    const fetched = calls.filter(
      (c) =>
        c.fields[LogField.Component] === "fetcher" &&
        c.msg === "Request finished",
    );
    expect(fetched.length).toBeGreaterThan(5);
    expect(fetched.some((c) => c.fields[LogField.Audit] !== undefined)).toBe(
      true,
    );
    expect(fetched.every((c) => c.fields[LogField.Scan] === "run-7")).toBe(
      true,
    );
    expect(JSON.stringify(calls)).not.toContain("hunter2");
    expect(
      calls.find((c) => c.msg === "Scan started")?.fields[LogField.Url],
    ).toBe("https://[redacted]@example.com/");
  });

  // BUG: the scanner reads a raw "@" in a password as part of it, as WHATWG
  // URL parsing does, but the log redaction stops at the first "@". "Scan
  // started" logs the target as given, so the rest of the password leaks.
  // See the matching case in logger.test.ts.
  it("never logs any part of a password that holds a raw @", async () => {
    const { lines } = await logsOf(() =>
      runScan("https://scanner:hun@ter2@example.com/", { dispatcher: site() }),
    );
    expect(JSON.stringify(lines)).not.toContain("ter2");
  });
});

describe("runScan — end of the audits", () => {
  it("counts requests by status class and sends no warning when every request was answered", async () => {
    const { lines } = await logsOf(() =>
      runScan("https://example.com/", { dispatcher: site() }),
    );
    const finished = lines.find((l) => l["msg"] === "Audits finished");
    expect(finished).toMatchObject({
      level: LogLevel.Debug,
      [LogField.Component]: "orchestrator",
      [LogField.Phase]: PhaseId.Audits,
      budgetExhausted: false,
      failures: {},
      notSentBudget: 0,
      notSentUnreachable: 0,
      open: 0,
    });
    const statuses = finished?.["statuses"] as Record<string, number>;
    expect(statuses["2xx"]).toBeGreaterThan(0);
    expect(statuses["4xx"]).toBeGreaterThan(0);
    expect(finished?.["requests"]).toBe(
      Object.values(statuses).reduce((a, b) => a + b, 0),
    );
    expect(lines.filter((l) => l["level"] === LogLevel.Warn)).toEqual([]);
  });

  it("warns once, with the failed requests grouped by error code", async () => {
    const { lines } = await logsOf(() =>
      runScan("https://example.com/", {
        dispatcher: site("https://example.com", [
          "/robots.txt",
          "/sitemap.xml",
        ]),
      }),
    );
    // Each failure is its own debug line; the warning is one per scan.
    const failedLines = lines.filter(
      (l) =>
        l[LogField.Component] === "fetcher" && l["msg"] === "Request failed",
    );
    expect(failedLines.length).toBeGreaterThan(1);
    expect(failedLines.every((l) => l["level"] === LogLevel.Debug)).toBe(true);
    const warnings = lines.filter(
      (l) => l["msg"] === "Some requests got no answer",
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({
      level: LogLevel.Warn,
      [LogField.Component]: "orchestrator",
      [LogField.Phase]: PhaseId.Audits,
      failed: failedLines.length,
      failures: { ECONNREFUSED: failedLines.length },
      [LogField.Caller]: expect.stringMatching(/^orchestrator\.ts:\d+$/),
    });
    expect(warnings[0]?.["requests"]).toBeGreaterThan(failedLines.length);
  });

  it("names the requests still open after the audits, oldest first and at most five", async () => {
    h.open = [10, 700, 40, 9000, 300, 20, 5000].map((ms, i) => ({
      url: `https://example.com/slow-${i}`,
      ms,
    }));
    const { lines } = await logsOf(() =>
      runScan("https://example.com/", { dispatcher: site() }),
    );
    const finished = lines.find((l) => l["msg"] === "Audits finished");
    expect(finished?.["open"]).toBe(7);
    const warning = lines.find(
      (l) => l["msg"] === "Requests still open after the audits",
    );
    expect(warning).toMatchObject({
      level: LogLevel.Warn,
      [LogField.Component]: "orchestrator",
      count: 7,
      oldest: [
        "https://example.com/slow-3 (9000 ms)",
        "https://example.com/slow-6 (5000 ms)",
        "https://example.com/slow-1 (700 ms)",
        "https://example.com/slow-4 (300 ms)",
        "https://example.com/slow-2 (40 ms)",
      ],
    });
  });
});

describe("runScan — start and end of a scan", () => {
  it("logs its start, each phase's duration and one info line at the end", async () => {
    const { lines, value } = await logsOf(() =>
      runScan("https://example.com/", {
        dispatcher: site(),
        timeoutMs: 60_000,
      }),
    );
    const own = lines.filter((l) => l[LogField.Component] === "orchestrator");
    expect(own[0]).toMatchObject({
      level: LogLevel.Debug,
      msg: "Scan started",
      [LogField.Url]: "https://example.com/",
      budgetMs: 60_000,
    });
    const phases = own.filter((l) => l["msg"] === "Phase done");
    expect(phases.map((l) => l["phase"])).toEqual([
      PhaseId.FetchRoot,
      PhaseId.FetchPages,
      PhaseId.Analyze,
      PhaseId.Audits,
      PhaseId.Report,
    ]);
    expect(
      phases.every((l) => typeof l[LogField.DurationMs] === "number"),
    ).toBe(true);
    const infos = lines.filter((l) => l["level"] === LogLevel.Info);
    expect(infos).toHaveLength(1);
    expect(infos[0]).toMatchObject({
      msg: "Scan finished",
      score: value.overallScore,
      pages: value.pagesScanned.length,
      budgetExhausted: false,
      [LogField.Scan]: value.scanId,
    });
  });

  it("logs a scan that throws at debug, with its error", async () => {
    const controller = new AbortController();
    controller.abort(new Error("caller went away"));
    const { lines } = await logsOf(() =>
      runScan("https://example.com/", {
        dispatcher: site(),
        signal: controller.signal,
      }).catch((error: unknown) => error),
    );
    const threw = lines.find((l) => l["msg"] === "Scan threw");
    expect(threw).toMatchObject({
      level: LogLevel.Debug,
      [LogField.Site]: "example.com",
      err: { message: "caller went away" },
    });
    expect(lines.some((l) => l["msg"] === "Scan finished")).toBe(false);
  });

  it("names a target that is no URL as it was given", async () => {
    const { lines } = await logsOf(() =>
      runScan("not a url", { dispatcher: site() }).catch(
        (error: unknown) => error,
      ),
    );
    expect(lines[0]).toMatchObject({
      msg: "Scan started",
      [LogField.Site]: "not a url",
    });
  });
});
