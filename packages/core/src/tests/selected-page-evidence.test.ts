import { describe, it, expect, vi } from "vitest";
import { Audit } from "#core/audit";
import { runAudits, scopeAudit } from "#core/audit-runner";
import { gatedMassShare } from "#core/scorer";
import { buildScanEvidence } from "#core/scan-evidence";
import { mockCheckContext, mockPageContext } from "#core/__tests__/test-utils";
import type { AuditMeta } from "#core/types";
import type { CheckContext, PageContext } from "#core/check-context";
import type { ScanConfig } from "#core/audit-config";
import { CheckResultSchema } from "#core/schemas";

const page = (name: string, source: PageTypeSource, readable = true) => {
  const p = mockPageContext(
    `https://example.com/${name}`,
    readable ? `<main>${"Readable text. ".repeat(60)}</main>` : "<div></div>",
  );
  p.pageType = PageType.Article;
  p.pageTypeSource = source;
  return p;
};
const context = (pages: PageContext[]) => {
  const ctx = mockCheckContext(pages);
  ctx.evidence = buildScanEvidence({
    requestedUrl: pages[0].url,
    homepageResult: pages[0].fetchResult,
    pages,
    rootFiles: {},
    wafProtection: null,
  });
  return ctx;
};
const calls: string[][] = [];
class ScopedAudit extends Audit {
  static override meta: AuditMeta = {
    id: "answer-readiness/scope-fixture",
    category: "answer-readiness",
    title: "Scope",
    failureTitle: "Scope failed",
    description: "Scope fixture",
    applicablePageTypes: [PageType.Article],
    requires: [EvidenceKey.RenderedBody, EvidenceKey.SampleAdequate],
    weight: 1,
    evidenceGrade: EvidenceGrade.A,
    tier: AuditTier.Scored,
    scoreDisplayMode: ScoreDisplayMode.Binary,
    defaultPriority: CheckPriority.Medium,
  };
  audit(ctx: CheckContext) {
    calls.push(ctx.pages.map((p) => p.url));
    const bad = ctx.pages.find((p) => p.url.includes("bad"));
    return bad
      ? this.fail("Defect", "Readable page", "Bad page", undefined, bad.url)
      : this.pass("Good", "Readable page", "Good page");
  }
}
const config: ScanConfig = {
  categories: [{ id: "answer-readiness", name: "Answer", weight: 1 }],
  audits: {
    "answer-readiness": [
      { meta: ScopedAudit.meta, create: () => new ScopedAudit() },
    ],
  },
};

describe("selected page evidence", () => {
  it("retains detected failures beside a declared pass without counting weight twice", async () => {
    calls.length = 0;
    const event = vi.fn();
    const trace = vi.fn();
    const result = await runAudits(
      context([
        page("good", PageTypeSource.Declared),
        page("bad", PageTypeSource.Detected),
      ]),
      config,
      event,
      undefined,
      trace,
    );
    const check = result.checks[0];
    expect(result.checks).toHaveLength(1);
    expect(check.status).toBe(CheckStatus.Pass);
    expect(check.advisoryResults?.[0]).toMatchObject({
      status: CheckStatus.Fail,
      scoreDisplayMode: ScoreDisplayMode.Informative,
      pageUrl: "https://example.com/bad",
    });
    expect(result.categories[0].assessedMass).toBe(1);
    expect(event).toHaveBeenCalledTimes(1);
    expect(trace).toHaveBeenCalledTimes(1);
    expect(CheckResultSchema.parse(check)).toEqual(check);
  });

  it("never borrows readability from a detected page for an unread declared page", async () => {
    calls.length = 0;
    const result = await runAudits(
      context([
        page("empty", PageTypeSource.Declared, false),
        page("bad", PageTypeSource.Detected),
      ]),
      config,
    );
    expect(result.checks[0].status).toBe(CheckStatus.NotApplicable);
    expect(result.checks[0].tags).toContain("skipped:no-evidence");
    expect(result.checks[0].advisoryResults?.[0].status).toBe(CheckStatus.Fail);
    expect(calls).toEqual([["https://example.com/bad"]]);
    expect(result.categories[0].assessedMass).toBe(0);
  });

  it("keeps unread pages in coverage but out of content verdicts", async () => {
    calls.length = 0;
    const result = await runAudits(
      context([
        page("good", PageTypeSource.Declared),
        page("empty", PageTypeSource.Declared, false),
      ]),
      config,
    );
    expect(calls).toEqual([["https://example.com/good"]]);
    expect(result.checks[0].coverage).toEqual({
      provenance: CoverageProvenance.Declared,
      selectedUrls: ["https://example.com/empty", "https://example.com/good"],
      inputUrls: ["https://example.com/good"],
      unreadUrls: ["https://example.com/empty"],
    });
  });

  it("makes the same page set independent of input order", async () => {
    const pages = [
      page("bad-z", PageTypeSource.Declared),
      page("bad-a", PageTypeSource.Declared),
      page("bad-detected", PageTypeSource.Detected),
    ];
    const first = await runAudits(context(pages), config);
    const second = await runAudits(context([...pages].reverse()), config);
    expect(first).toEqual(second);
  });
});

import { sharedFeed, discoverFeedHeadUrls } from "#core/gatherers/feeds";
import { OpenApiServersAudit } from "#core/audits/agent-interfaces/openapi-servers";
import {
  AttemptOutcome,
  AuditTier,
  CheckPriority,
  CheckStatus,
  CoverageProvenance,
  EvidenceGrade,
  EvidenceKey,
  PageType,
  PageTypeSource,
  ScoreDisplayMode,
} from "#core/types";
vi.mock("#core/fetcher", async (load) => ({
  ...(await load<typeof import("#core/fetcher")>()),
  isSafeUrl: async () => true,
}));

const one = (meta: AuditMeta, create: () => Audit): ScanConfig => ({
  categories: [{ id: meta.category, name: "Fixture", weight: meta.weight }],
  audits: { [meta.category]: [{ meta, create }] },
});

describe("scope failure and cache boundaries", () => {
  it("retains failed declared attempts while a detected page is readable", async () => {
    const ctx = context([page("bad", PageTypeSource.Detected)]);
    ctx.pageAttempts = [
      {
        url: "https://example.com/missing",
        pageType: PageType.Article,
        source: PageTypeSource.Declared,
        outcome: AttemptOutcome.Unread,
        status: 503,
      },
    ];
    const result = await runAudits(ctx, config);
    expect(result.checks[0].status).toBe(CheckStatus.NotApplicable);
    expect(result.checks[0].coverage?.selectedUrls).toEqual([
      "https://example.com/missing",
    ]);
    expect(result.checks[0].coverage?.unreadUrls).toEqual([
      "https://example.com/missing",
    ]);
    expect(result.checks[0].advisoryResults?.[0].status).toBe(CheckStatus.Fail);
    expect(result.categories[0].assessedMass).toBe(0);
  });

  it("leaves absent optional artifacts to their gatherer", async () => {
    const result = await runAudits(
      context([page("good", PageTypeSource.Declared)]),
      one(OpenApiServersAudit.meta, () => new OpenApiServersAudit()),
    );
    expect(result.checks[0].status).toBe(CheckStatus.NotApplicable);
    expect(result.checks[0].tags ?? []).not.toContain("skipped:no-evidence");
    expect(result.checks[0].tags ?? []).not.toContain("scan-error");
  });

  it("preserves a declared verdict when the advisory execution has a schema error", async () => {
    class Broken extends ScopedAudit {
      override audit(ctx: CheckContext) {
        const result = super.audit(ctx);
        return ctx.pages[0]?.pageTypeSource === PageTypeSource.Detected
          ? { ...result, details: { invalid: [{ nested: "object" }] } }
          : result;
      }
    }
    const event = vi.fn();
    const trace = vi.fn();
    const result = await runAudits(
      context([
        page("good", PageTypeSource.Declared),
        page("bad", PageTypeSource.Detected),
      ]),
      one(Broken.meta, () => new Broken()),
      event,
      undefined,
      trace,
    );
    expect(result.checks[0].status).toBe(CheckStatus.Pass);
    expect(result.checks[0].advisoryResults?.[0].tags).toContain("scan-error");
    expect(result.checks[0].advisoryResults?.[0].scoreDisplayMode).toBe(
      "informative",
    );
    expect(event).toHaveBeenCalledTimes(1);
    expect(event.mock.calls[0][0].type).toBe("unit:fail");
    expect(trace.mock.calls[0][0].advisoryResults[0].tags).toContain(
      "scan-error",
    );
    expect(CheckResultSchema.safeParse(result.checks[0]).success).toBe(true);
  });

  it("keeps completed evidence when the budget expires before the second population", async () => {
    const budget = new AbortController();
    class Slow extends ScopedAudit {
      override audit(ctx: CheckContext) {
        if (ctx.pages[0]?.pageTypeSource === PageTypeSource.Detected)
          budget.abort(new Error("Test budget"));
        return super.audit(ctx);
      }
    }
    const events = vi.fn();
    const result = await runAudits(
      context([
        page("good", PageTypeSource.Declared),
        page("bad", PageTypeSource.Detected),
      ]),
      one(Slow.meta, () => new Slow()),
      events,
      undefined,
      undefined,
      budget.signal,
    );
    expect(result.checks[0].status).toBe(CheckStatus.Pass);
    expect(result.checks[0].advisoryResults?.[0].tags).toContain(
      "skipped:scan-budget",
    );
    expect(events).toHaveBeenCalledTimes(1);
  });

  it("shares URL fetches within a scan without caching the wrong page-derived feed list", async () => {
    const selectedLists: string[][] = [];
    class Feeds extends Audit {
      static override meta = ScopedAudit.meta;
      override async audit(ctx: CheckContext) {
        selectedLists.push(discoverFeedHeadUrls(ctx));
        await Promise.all(
          discoverFeedHeadUrls(ctx).map((url) => sharedFeed(ctx, url)),
        );
        await sharedFeed(ctx, "https://example.com/shared.xml");
        return this.pass("Feed checked", "Feed", "Feed");
      }
    }
    const a = page("a", PageTypeSource.Declared),
      b = page("b", PageTypeSource.Detected);
    a.headLinks = [
      {
        rel: "alternate",
        type: "application/rss+xml",
        href: "/a.xml",
        title: "A",
      },
    ];
    b.headLinks = [
      {
        rel: "alternate",
        type: "application/rss+xml",
        href: "/b.xml",
        title: "B",
      },
    ];
    const fetch = vi.fn(async ({ url }: { url: string }) => ({
      ...a.fetchResult,
      url,
      body: "<rss><channel/></rss>",
      contentType: "application/rss+xml",
    }));
    const first = { ...context([a, b]), fetch };
    const second = { ...context([a, b]), fetch };
    await Promise.all([
      runAudits(
        first,
        one(Feeds.meta, () => new Feeds()),
      ),
      runAudits(
        second,
        one(Feeds.meta, () => new Feeds()),
      ),
    ]);
    expect(fetch.mock.calls.map((c) => c[0].url).sort()).toEqual([
      "https://example.com/a.xml",
      "https://example.com/a.xml",
      "https://example.com/b.xml",
      "https://example.com/b.xml",
      "https://example.com/shared.xml",
      "https://example.com/shared.xml",
    ]);
    expect(
      selectedLists.filter((x) => x.includes("https://example.com/a.xml")),
    ).toHaveLength(2);
    expect(
      selectedLists.filter((x) => x.includes("https://example.com/b.xml")),
    ).toHaveLength(2);
    expect(selectedLists.every((x) => x.length === 1)).toBe(true);
  });

  it("does not attribute old reports coverage they did not record", async () => {
    const check = (
      await runAudits(context([page("good", PageTypeSource.Declared)]), config)
    ).checks[0];
    const { coverage: _coverage, advisoryResults: _advisory, ...old } = check;
    expect(CheckResultSchema.parse(old).coverage).toBeUndefined();
    expect(
      CheckResultSchema.safeParse({
        ...check,
        advisoryResults: [
          { ...old, scoreDisplayMode: ScoreDisplayMode.Binary },
        ],
      }).success,
    ).toBe(false);
  });
});

describe("evidence views", () => {
  it("restricts body guards even when metadata does not require body text", async () => {
    const observed: Array<{ urls: string[]; readable: boolean }> = [];
    class Guard extends Audit {
      static override meta: AuditMeta = {
        ...ScopedAudit.meta,
        requires: [EvidenceKey.OriginReachable],
      };
      audit(ctx: CheckContext) {
        observed.push({
          urls: Object.keys(ctx.evidence.renderedByPage),
          readable: ctx.evidence.met[EvidenceKey.RenderedBody],
        });
        return ctx.evidence.met[EvidenceKey.RenderedBody]
          ? this.pass("Read", "Text", "Text")
          : this.notApplicable("Unread", "Text", "No text");
      }
    }
    const meta = Guard.meta;
    const result = await runAudits(
      context([
        page("shell", PageTypeSource.Declared, false),
        page("readable", PageTypeSource.Detected),
      ]),
      one(meta, () => new Guard()),
    );
    expect(observed).toEqual([
      { urls: ["https://example.com/shell"], readable: false },
      { urls: ["https://example.com/readable"], readable: true },
    ]);
    expect(result.checks[0].status).toBe(CheckStatus.NotApplicable);
    expect(result.checks[0].advisoryResults?.[0].status).toBe(CheckStatus.Pass);
  });

  it("keeps simultaneous scoring modes separate without mutating static metadata", async () => {
    const before = JSON.stringify(ScopedAudit.meta);
    const [declared, detected] = await Promise.all([
      runAudits(context([page("good", PageTypeSource.Declared)]), config),
      runAudits(context([page("bad", PageTypeSource.Detected)]), config),
    ]);
    expect(declared.checks[0].scoreDisplayMode).toBe(ScoreDisplayMode.Binary);
    expect(declared.categories[0].assessedMass).toBe(1);
    expect(detected.checks[0].scoreDisplayMode).toBe(
      ScoreDisplayMode.Informative,
    );
    expect(detected.categories[0].assessedMass).toBe(0);
    expect(JSON.stringify(ScopedAudit.meta)).toBe(before);
  });
});

describe("page order and failed declared populations", () => {
  const universal: AuditMeta = {
    ...ScopedAudit.meta,
    applicablePageTypes: undefined,
    requires: undefined,
  };

  it("puts the scan target first and sorts the rest by code point", () => {
    const urls = ["ab", "a-b", "Z", "target"];
    const forward = mockCheckContext(
      urls.map((u) => page(u, PageTypeSource.Detected)),
    );
    const reverse = mockCheckContext(
      [...urls].reverse().map((u) => page(u, PageTypeSource.Detected)),
    );
    const expected = ["target", "Z", "a-b", "ab"].map(
      (u) => `https://example.com/${u}`,
    );
    for (const ctx of [forward, reverse]) {
      ctx.targetUrl = "https://example.com/target";
      expect(scopeAudit(ctx, universal)?.pages.map((p) => p.url)).toEqual(
        expected,
      );
    }
  });

  it("does not count a failed declared fetch toward the gated mass", async () => {
    const other = page("other", PageTypeSource.Declared);
    other.pageType = PageType.Product;
    const ctx = context([other]);
    ctx.pageAttempts = [
      {
        url: "https://example.com/missing",
        pageType: PageType.Article,
        source: PageTypeSource.Declared,
        outcome: AttemptOutcome.Unread,
        status: 404,
      },
    ];
    const meta = { ...ScopedAudit.meta, requires: undefined };
    const result = await runAudits(
      ctx,
      one(meta, () => new ScopedAudit()),
    );
    expect(result.checks[0].status).toBe(CheckStatus.NotApplicable);
    expect(result.checks[0].tags).toEqual(["skipped:page-type"]);
    expect(gatedMassShare(result.checks)).toBe(0);
  });
});
