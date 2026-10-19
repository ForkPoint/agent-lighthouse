import { parseHtml } from "./parser";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FetchResult } from "./fetcher";
import { runScan } from "./orchestrator";
import {
  BrowserSnapshotsSchema,
  BrowserAssessmentSchema,
  ScanReportSchema,
  snapshotUrlKey,
} from "./schemas";
import {
  CaptureSource,
  DocumentState,
  EvidenceSource,
  CheckStatus,
  SNAPSHOT_LIMITS,
  DOM_WORK_LIMITS,
} from "./contracts";
import type { BrowserSnapshot, BrowserSnapshots } from "./contracts";
import { runAudits, planAudits } from "./audit-runner";
import { cacheOwner } from "./gatherers/cache-owner";
import { defaultConfig } from "./audit-config";
import { buildSnapshotEvidence } from "./scan-evidence";
import { parsePageContext } from "./page-context";
import type { CheckContext, PageContext } from "./check-context";
import { PageType } from "./contracts";
import { defaultOriginCache } from "./origin-cache";

const state = vi.hoisted(() => ({
  body: "<html><body><div id='app'></div></body></html>",
  status: 200,
  calls: [] as string[],
}));
vi.mock("./fetcher", async (original) => ({
  ...(await original<typeof import("./fetcher")>()),
  isSafeUrl: async (value: string) =>
    new URL(value).hostname === "example.test",
  createFetcher: () => ({
    summary: () => ({ requests: 0, statuses: {}, failures: {}, open: [] }),
    fetch: async ({ url }: { url: string }): Promise<FetchResult> => {
      state.calls.push(url);
      const target = url === "https://example.test/";
      return {
        url,
        finalUrl: url,
        status: target ? state.status : 404,
        headers: { "content-type": "text/html" },
        body: target ? state.body : "",
        contentType: "text/html",
        contentLength: state.body.length,
        ttfbMs: 1,
        totalMs: 2,
      };
    },
  }),
}));
vi.mock("./audits/operability-safety/runner", () => ({
  runA11yForHtml: async () => ({}),
}));
vi.mock("./audit-runner", async (original) => {
  const actual = await original<typeof import("./audit-runner")>();
  return { ...actual, runAudits: vi.fn(actual.runAudits) };
});
const url = "https://example.test/";
const text = "Readable browser content with useful facts. ".repeat(20);
const html = `<html><head><script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage","name":"Browser only"}</script></head><body><main><section><h2>Details</h2><p>${text}</p></section><img src="http://127.0.0.1/private" alt="Example"><form action="http://169.254.169.254/"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email"><button>Send</button></form></main></body></html>`;
function snapshot(overrides: Partial<BrowserSnapshot> = {}): BrowserSnapshot {
  return {
    requestedUrl: url,
    capturedUrl: url,
    html,
    capturedAt: "2026-10-13T10:00:00Z",
    captureSource: CaptureSource.CurrentTab,
    collector: { name: "fixture", version: "1.0" },
    documentState: DocumentState.Complete,
    truncation: { truncated: false },
    redaction: { redacted: false, fields: [] },
    ...overrides,
  };
}
const input = (page = snapshot()): BrowserSnapshots => ({
  version: 1,
  pages: [page],
});
const options = {
  categories: ["content-extraction", "structured-data", "operability-safety"],
  timeoutMs: 0,
  bypassOriginCache: true,
};
const check = (report: Awaited<ReturnType<typeof runScan>>, id: string) =>
  report.categories.flatMap((c) => c.checks).find((c) => c.id === id);
const browserCheck = (
  report: Awaited<ReturnType<typeof runScan>>,
  id: string,
) => report.browserAssessment?.findings.find((f) => f.check.id === id)?.check;
beforeEach(() => {
  vi.mocked(runAudits).mockClear();
  state.status = 200;
  state.body = "<html><body><div id='app'></div></body></html>";
  state.calls = [];
  defaultOriginCache.clear();
});

describe("browser snapshot scan boundary", () => {
  it("keeps a shell unscored and runs DOM checks without changing crawler coverage", async () => {
    const plain = await runScan(url, options);
    const browser = await runScan(url, { ...options, snapshots: input() });
    expect(plain.overallScore).toBeNull();
    expect(browser.overallScore).toBeNull();
    expect(browser.categories).toEqual(plain.categories);
    expect(browser.scanValidity).toEqual(plain.scanValidity);
    expect(browser.conditions?.coverage).toEqual(plain.conditions?.coverage);
    expect(browser.conditions?.unscored).toEqual(plain.conditions?.unscored);
    expect(check(browser, "content-extraction/server-rendered")?.status).toBe(
      CheckStatus.Fail,
    );
    expect(
      browserCheck(browser, "content-extraction/image-alt-text")?.status,
    ).toBe(CheckStatus.Pass);
    expect(browser.browserAssessment?.coverage.assessed).toBe(7);
    expect(browser.browserAssessment?.score).toBeNull();
  });
  it("finds added structured data only in the browser population", async () => {
    state.body = `<html><body><p>${text}</p></body></html>`;
    const report = await runScan(url, { ...options, snapshots: input() });
    expect(check(report, "structured-data/json-ld-present")?.status).toBe(
      CheckStatus.Fail,
    );
    expect(
      browserCheck(report, "structured-data/json-ld-present")?.status,
    ).toBe(CheckStatus.Pass);
    expect(
      report.browserAssessment?.findings.every(
        (f) =>
          f.pageUrl === url &&
          f.evidenceSource === EvidenceSource.BrowserSnapshot,
      ),
    ).toBe(true);
  });
  it("runs snapshot checks after blocked HTTP access", async () => {
    state.status = 403;
    const report = await runScan(url, { ...options, snapshots: input() });
    expect(report.overallScore).toBeNull();
    expect(report.scanValidity?.evidence["origin-reachable"]).toBe(false);
    expect(
      browserCheck(report, "structured-data/json-ld-present")?.status,
    ).toBe(CheckStatus.Pass);
    expect(
      report.browserAssessment?.notEligible.some((group) =>
        group.auditIds.includes("content-extraction/server-rendered"),
      ),
    ).toBe(true);
  });
  it("lists ineligible audits once, not once per capture", async () => {
    const other = `${url}other`;
    const report = await runScan(url, {
      ...options,
      pages: [{ url: other, pageType: PageType.General }],
      snapshots: {
        version: 1,
        pages: [
          snapshot(),
          snapshot({ requestedUrl: other, capturedUrl: other }),
        ],
      },
    });
    const assessment = report.browserAssessment!;
    const ids = assessment.notEligible.flatMap((group) => group.auditIds);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain("structured-data/json-ld-present");
    expect(
      assessment.missingEvidence.every((m) =>
        assessment.coverage.eligibleAuditIds.includes(m.auditId),
      ),
    ).toBe(true);
  });
  it("never executes scripts or sends snapshot resource or action requests", async () => {
    const marker = "__snapshotExecuted";
    const report = await runScan(url, {
      ...options,
      snapshots: input(
        snapshot({
          html:
            html +
            `<script>globalThis.${marker}=true;fetch('http://127.0.0.1/')</script><img onerror="globalThis.${marker}=true" src="http://127.0.0.1/">`,
        }),
      ),
    });
    expect((globalThis as Record<string, unknown>)[marker]).toBeUndefined();
    expect(
      state.calls.every((u) => new URL(u).hostname === "example.test"),
    ).toBe(true);
    expect(report.browserAssessment?.limits.join(" ")).toContain(
      "action success",
    );
    expect(
      report.browserAssessment?.findings.some((f) =>
        f.check.id.includes("actionability"),
      ),
    ).toBe(false);
  });
  it("keeps current-tab access separate from fresh-browser claims", async () => {
    const report = await runScan(url, { ...options, snapshots: input() });
    expect(report.browserAssessment?.captures[0]?.captureSource).toBe(
      CaptureSource.CurrentTab,
    );
    expect(report.browserAssessment?.limits.join(" ")).toContain(
      "login independence",
    );
    expect(
      BrowserAssessmentSchema.parse(
        JSON.parse(JSON.stringify(report.browserAssessment)),
      ),
    ).toEqual(report.browserAssessment);
    expect(ScanReportSchema.parse(JSON.parse(JSON.stringify(report)))).toEqual(
      report,
    );
    expect(JSON.stringify(report.browserAssessment)).not.toContain('"html":');
  });
  it.each([
    { truncation: { truncated: true, originalBytes: 99999 } },
    { redaction: { redacted: true, fields: ["input.value"] } },
    { documentState: DocumentState.Loading },
  ])(
    "reports incomplete capture evidence explicitly: %j",
    async (overrides) => {
      const report = await runScan(url, {
        ...options,
        snapshots: input(snapshot(overrides)),
      });
      expect(report.browserAssessment?.coverage.assessed).toBe(0);
      expect(report.browserAssessment?.findings).toEqual([]);
      expect(report.browserAssessment?.missingEvidence.length).toBeGreaterThan(
        0,
      );
    },
  );
  it("does not count hidden prose as readable and does not infer live form state", async () => {
    const report = await runScan(url, {
      ...options,
      snapshots: input(
        snapshot({
          html: `<html><body><div hidden>${text}</div><form><input type="email" id="email" name="email" autocomplete="email" value="old"></form></body></html>`,
        }),
      ),
    });
    expect(report.browserAssessment?.findings).toEqual([]);
    expect(report.browserAssessment?.limits.join(" ")).toContain("form state");
    const visible = await runScan(url, {
      ...options,
      snapshots: input(
        snapshot({
          html: `<html><body><p>${text}</p><form><input type="email" id="email" name="email" autocomplete="email" value="old"></form></body></html>`,
        }),
      ),
    });
    expect(
      browserCheck(
        visible,
        "operability-safety/profile-autofill-token-coverage",
      )?.status,
    ).toBe(CheckStatus.Pass);
  });
  it("does not let a textless capture prove absence", async () => {
    const report = await runScan(url, {
      ...options,
      snapshots: input(
        snapshot({
          html: "<html><body><div>Accept cookies to continue.</div></body></html>",
        }),
      ),
    });
    const assessment = report.browserAssessment!;
    expect(assessment.findings).toEqual([]);
    expect(assessment.missingEvidence.map((m) => m.auditId).sort()).toEqual(
      assessment.coverage.eligibleAuditIds,
    );
  });
  it("matches snapshots like page overrides: credentials and trailing slash", async () => {
    const other = `${url}p/`;
    const report = await runScan("https://user:pass@example.test/", {
      ...options,
      pages: [{ url: other, pageType: PageType.Article }],
      snapshots: {
        version: 1,
        pages: [
          snapshot(),
          snapshot({ requestedUrl: `${url}p`, capturedUrl: `${url}p` }),
        ],
      },
    });
    expect(report.browserAssessment?.captures).toHaveLength(2);
    const contexts = vi.mocked(runAudits).mock.calls.map((call) => call[0]);
    expect(contexts.at(-1)!.pages[0]!.pageType).toBe(PageType.Article);
  });
  it("keeps the crawler report when snapshot assessment throws", async () => {
    const actual =
      await vi.importActual<typeof import("./audit-runner")>("./audit-runner");
    vi.mocked(runAudits).mockImplementation(async (ctx, ...rest) => {
      if (ctx.evidenceSource === EvidenceSource.BrowserSnapshot)
        throw new Error("boom");
      return actual.runAudits(ctx, ...rest);
    });
    const report = await runScan(url, {
      ...options,
      snapshots: input(),
    }).finally(() => vi.mocked(runAudits).mockImplementation(actual.runAudits));
    expect(report.categories.length).toBeGreaterThan(0);
    expect(report.browserAssessment?.findings).toEqual([]);
    expect(
      report.browserAssessment?.missingEvidence.every((m) =>
        m.reason.includes("Snapshot assessment failed: boom"),
      ),
    ).toBe(true);
  });
  it("isolates page contexts, cache owners, and per-page verdicts across both sources", async () => {
    state.body = `<html><body><p>${text}</p><img src="server.jpg" alt="Server image"></body></html>`;
    const other = `${url}other`;
    const report = await runScan(url, {
      ...options,
      pages: [{ url: other, pageType: PageType.General }],
      snapshots: {
        version: 1,
        pages: [
          snapshot(),
          snapshot({
            requestedUrl: other,
            capturedUrl: other,
            html: `<html><body><p>${text}</p><img src="bad.jpg"></body></html>`,
          }),
        ],
      },
    });
    const contexts = vi.mocked(runAudits).mock.calls.map((call) => call[0]);
    expect(contexts).toHaveLength(3);
    expect(new Set(contexts.map(cacheOwner)).size).toBe(3);
    expect(contexts[0]!.pages[0]!.$).not.toBe(contexts[1]!.pages[0]!.$);
    expect(contexts[1]!.pages[0]!.$).not.toBe(contexts[2]!.pages[0]!.$);
    expect(contexts[1]!.rootFiles).toEqual({});
    expect(() => contexts[1]!.pages[0]!.fetchResult).toThrow(
      "HTTP response evidence is unavailable",
    );
    expect(() => contexts[1]!.fetch({ url: "http://127.0.0.1/" })).toThrow(
      "Network evidence is unavailable",
    );
    expect(check(report, "content-extraction/image-alt-text")?.status).toBe(
      CheckStatus.Pass,
    );
    expect(
      report
        .browserAssessment!.findings.filter(
          (f) => f.check.id === "content-extraction/image-alt-text",
        )
        .map((f) => [f.pageUrl, f.check.status]),
    ).toEqual([
      [url, CheckStatus.Pass],
      [other, CheckStatus.Fail],
    ]);
    expect(report.browserAssessment!.coverage.assessed).toBe(14);
  });
  it("keeps HTTP-only gates closed even when a caller disables per-audit gates", () => {
    const page: PageContext = {
      ...parsePageContext(url, html),
      get fetchResult(): never {
        throw new Error("No HTTP");
      },
    };
    const ctx: CheckContext = {
      pages: [page],
      rootFiles: {},
      domain: "example.test",
      baseUrl: url,
      evidenceSource: EvidenceSource.BrowserSnapshot,
      evidence: buildSnapshotEvidence([page]),
      fetch: () => {
        throw new Error("No network");
      },
    };
    const plan = planAudits(ctx, defaultConfig, { enforceEvidence: false });
    expect(
      plan.runnable.some(
        (entry) => entry.reg.meta.id === "content-extraction/server-rendered",
      ),
    ).toBe(false);
    expect(
      plan.skipped.find(
        (entry) => entry.id === "content-extraction/server-rendered",
      )?.status,
    ).toBe(CheckStatus.NotApplicable);
    expect(ctx.evidence.met["origin-reachable"]).toBe(false);
    expect(ctx.evidence.met["unblocked-fetches"]).toBe(false);
  });
  it("keeps completed captures when a later capture fails", async () => {
    const other = `${url}other`;
    const actual =
      await vi.importActual<typeof import("./audit-runner")>("./audit-runner");
    vi.mocked(runAudits).mockImplementation(async (ctx, ...rest) => {
      if (ctx.targetUrl === other) throw new Error("bad capture");
      return actual.runAudits(ctx, ...rest);
    });
    const report = await runScan(url, {
      ...options,
      pages: [{ url: other, pageType: PageType.General }],
      snapshots: {
        version: 1,
        pages: [
          snapshot(),
          snapshot({ requestedUrl: other, capturedUrl: other }),
        ],
      },
    }).finally(() => vi.mocked(runAudits).mockImplementation(actual.runAudits));
    const assessment = report.browserAssessment!;
    expect(assessment.findings).toHaveLength(7);
    expect(assessment.findings.every((f) => f.pageUrl === url)).toBe(true);
    expect(assessment.coverage.assessed).toBe(7);
    expect(
      assessment.missingEvidence.filter((m) => m.pageUrl === other),
    ).toHaveLength(7);
  });
  it("reads deeply nested snapshot text in linear time", () => {
    const depth = 8000;
    const deep = `<html><body>${"<div>".repeat(depth)}${text}${"</div>".repeat(depth)}</body></html>`;
    const page = {
      url,
      pageType: PageType.General,
      $: parseHtml(deep),
    } as PageContext;
    const started = performance.now();
    const evidence = buildSnapshotEvidence([page]);
    expect(performance.now() - started).toBeLessThan(1000);
    expect(evidence.renderedByPage[url]).toBe(true);
    const hidden = `<html><body>${"<div>".repeat(depth)}<div hidden>${text}</div>${"</div>".repeat(depth)}</body></html>`;
    expect(
      buildSnapshotEvidence([
        {
          url,
          pageType: PageType.General,
          $: parseHtml(hidden),
        } as PageContext,
      ]).renderedByPage[url],
    ).toBe(false);
  });
  it("gives no verdict for DOM deeper than a browser parser builds", async () => {
    const depth = DOM_WORK_LIMITS.maxDepth + 10;
    const started = performance.now();
    const report = await runScan(url, {
      ...options,
      snapshots: input(
        snapshot({
          html: `<html><body>${"<div>".repeat(depth)}${text}${"</div>".repeat(depth)}</body></html>`,
        }),
      ),
    });
    expect(performance.now() - started).toBeLessThan(5000);
    const assessment = report.browserAssessment!;
    expect(assessment.findings).toEqual([]);
    expect(
      assessment.missingEvidence.every((m) =>
        m.reason.includes(`deeper than ${DOM_WORK_LIMITS.maxDepth}`),
      ),
    ).toBe(true);
    expect(assessment.missingEvidence).toHaveLength(7);
  });
  it("leaves URL-only output free of browser claims", async () => {
    const report = await runScan(url, options);
    expect(report).not.toHaveProperty("browserAssessment");
  });
});

describe("snapshot validation", () => {
  it("returns structured validation failures for malformed URLs", () => {
    for (const value of [
      "bad",
      "",
      "https://",
      "/relative",
      "https://example.test/\n",
    ]) {
      expect(() =>
        BrowserSnapshotsSchema.safeParse(
          input(snapshot({ requestedUrl: value, capturedUrl: value })),
        ),
      ).not.toThrow();
      expect(
        BrowserSnapshotsSchema.safeParse(
          input(snapshot({ requestedUrl: value, capturedUrl: value })),
        ).success,
      ).toBe(false);
    }
  });
  it.each([
    { requestedUrl: "https://elsewhere.test/" },
    { capturedUrl: "https://example.test/other" },
    { capturedUrl: "https://user:secret@example.test/" },
    { capturedUrl: "javascript:alert(1)" },
    { capturedAt: "not a date" },
    { collector: { name: "fixture", version: "" } },
    {
      collector: {
        name: "x\n\n![t](https://tracker.example/p.png)",
        version: "1",
      },
    },
    { redaction: { redacted: true, fields: ["a\nb"] } },
    { documentState: "unknown" },
    { truncation: { truncated: false, originalBytes: -1 } },
    { redaction: { redacted: false, fields: ["password"] } },
    { html: "x".repeat(2 * 1024 * 1024 + 1) },
    { html: "😀".repeat(600000) },
  ])("rejects malformed input before fetch", async (overrides) => {
    await expect(
      runScan(url, {
        ...options,
        snapshots: input({ ...snapshot(), ...overrides } as BrowserSnapshot),
      }),
    ).rejects.toThrow();
    expect(state.calls).toEqual([]);
  });
  it("keeps the query exact when matching snapshot URLs", () => {
    expect(snapshotUrlKey(`${url}?next=/`)).not.toBe(
      snapshotUrlKey(`${url}?next=`),
    );
    expect(snapshotUrlKey(`${url}p/`)).toBe(snapshotUrlKey(`${url}p`));
    expect(
      BrowserSnapshotsSchema.safeParse({
        version: 1,
        pages: [
          snapshot({
            requestedUrl: `${url}?next=/`,
            capturedUrl: `${url}?next=/`,
          }),
          snapshot({
            requestedUrl: `${url}?next=`,
            capturedUrl: `${url}?next=`,
          }),
        ],
      }).success,
    ).toBe(true);
    expect(
      BrowserSnapshotsSchema.safeParse(
        input(snapshot({ requestedUrl: `${url}p/`, capturedUrl: `${url}p` })),
      ).success,
    ).toBe(false);
  });
  it("rejects versions, duplicate associations and aggregate limits", () => {
    expect(
      BrowserSnapshotsSchema.safeParse({ ...input(), version: 2 }).success,
    ).toBe(false);
    expect(
      BrowserSnapshotsSchema.safeParse({
        version: 1,
        pages: [snapshot(), snapshot()],
      }).success,
    ).toBe(false);
    const pages = Array.from({ length: 4 }, (_, i) =>
      snapshot({
        requestedUrl: `${url}${i}`,
        capturedUrl: `${url}${i}`,
        html: "x".repeat(SNAPSHOT_LIMITS.maxHtmlBytes),
      }),
    );
    expect(
      BrowserSnapshotsSchema.safeParse({ version: 1, pages }).success,
    ).toBe(false);
  });
});
