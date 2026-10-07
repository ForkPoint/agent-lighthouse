import { describe, it, expect } from "vitest";
import { defaultConfig } from "../../audit-config";
import { planAudits, runAudits } from "../../audit-runner";
import { AuditResultSchema } from "../../schemas";
import { buildScanEvidence } from "../../scan-evidence";
import type { PageType } from "../../types";
import { NoNofollowAudit } from "./no-nofollow";
import {
  attributableFixture,
  mockCheckContext,
  mockPageContext,
  shellSiteContext,
  unreachedSiteContext,
} from "../../__tests__/test-utils";

describe("NoNofollowAudit", () => {
  const audit = new NoNofollowAudit();

  const clean =
    '<html><head><meta name="robots" content="index, follow" /></head><body>Hi</body></html>';
  const nofollow =
    '<html><head><meta name="robots" content="nofollow" /></head><body>Hi</body></html>';

  it("passes when no pages have nofollow directives", () => {
    const ctx = mockCheckContext([
      mockPageContext("https://example.com/", clean),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe("pass");
    expect(result.message).toContain("No scanned pages have nofollow");
  });

  it("warns when some pages have nofollow directives", () => {
    const ctx = mockCheckContext([
      mockPageContext("https://example.com/", clean),
      mockPageContext("https://example.com/about", nofollow, 1),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe("warn");
    expect(result.message).toContain("have nofollow directives");
  });

  it("fails when all pages have nofollow directives", () => {
    const ctx = mockCheckContext([
      mockPageContext("https://example.com/", nofollow),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe("fail");
    expect(result.message).toContain("have nofollow directives");
  });

  it("declines when no pages were scanned", () => {
    const ctx = mockCheckContext([]);
    const result = audit.audit(ctx);
    expect(result.status).toBe("na");
    expect(result.message).toContain("No pages scanned");
  });

  it('passes on a page with no robots meta tag (covers ?? "" nullish fallback)', () => {
    // No <meta name="robots"> → page.meta['robots'] is undefined → ?? '' right branch
    const noMeta =
      "<html><head><title>Page</title></head><body>Content</body></html>";
    const ctx = mockCheckContext([
      mockPageContext("https://example.com/", noMeta),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe("pass");
    expect(result.message).toContain("No scanned pages have nofollow");
  });

  it('shows "+N more" suffix when more than 5 pages have nofollow (warn path)', () => {
    // 1 clean page + 6 nofollow pages → not all have nofollow → warn, length > 5 → "+N more"
    const pages = [
      mockPageContext("https://example.com/", clean),
      ...Array.from({ length: 6 }, (_, i) =>
        mockPageContext(`https://example.com/page${i + 1}`, nofollow, i + 1),
      ),
    ];
    const ctx = mockCheckContext(pages);
    const result = audit.audit(ctx);
    expect(result.status).toBe("warn");
    expect(result.found).toContain("+1 more");
  });

  // The scan may hold a readable page that is not this site's — a broker's
  // parking page, a foreign interstitial. Attribution is the gate's decision,
  // and the runner has to honour it rather than run this audit anyway.
  it("declines when no response can be attributed to this site", async () => {
    const { pages, rootFiles } = attributableFixture();
    const instance = new NoNofollowAudit();
    const reached = await instance.audit(mockCheckContext(pages, rootFiles));
    expect(reached.status, "the same input reached is judged").not.toBe("na");

    const plan = planAudits(
      unreachedSiteContext(pages, rootFiles),
      defaultConfig,
    );
    expect(plan.runnable.map((entry) => entry.reg.meta.id)).not.toContain(
      NoNofollowAudit.meta.id,
    );
    expect(
      plan.skipped.find((stub) => stub.id === NoNofollowAudit.meta.id)?.status,
    ).toBe("na");
  });

  // `requires` deliberately omits `rendered-body`: the meta tag and the header
  // this audit reads are served whole by a page whose body renders nothing.
  it("still judges a page that served no readable text", async () => {
    const result = await new NoNofollowAudit().audit(shellSiteContext());
    expect(result.status).not.toBe("na");
  });
});

describe("no-nofollow page scope", () => {
  const audit = new NoNofollowAudit();
  const blocked = '<meta name="robots" content="nofollow">';

  it.each([false, true])(
    "keeps findings stable on reorder (clean page: %s)",
    (includeClean) => {
      const pages = [
        mockPageContext("https://example.com/z", blocked),
        mockPageContext("https://example.com/a", blocked),
        ...(includeClean
          ? [mockPageContext("https://example.com/clean", "<p>Clean</p>")]
          : []),
      ];
      const result = audit.audit(mockCheckContext(pages));
      expect(result.status).toBe(includeClean ? "warn" : "fail");
      expect(result.pageUrl).toBe("https://example.com/a");
      expect(result.found).toContain("https://example.com/a");
      expect(result.found).toContain("https://example.com/z");
      expect(audit.audit(mockCheckContext([...pages].reverse()))).toEqual(
        result,
      );
      expect(AuditResultSchema.safeParse(result).success).toBe(true);
    },
  );

  it("bounds long URL evidence on partial coverage", () => {
    const pages = [
      mockPageContext("https://example.com/clean", "<p>Clean</p>"),
      ...Array.from({ length: 6 }, (_, index) =>
        mockPageContext(
          `https://example.com/${index}/${"x".repeat(1800)}`,
          blocked,
        ),
      ),
    ];
    const result = audit.audit(mockCheckContext(pages));
    expect(result.status).toBe("warn");
    expect(result.found).toContain("(truncated)");
    expect(AuditResultSchema.safeParse(result).success).toBe(true);
    expect(audit.toCheckResult(result).status).toBe("warn");
  });

  for (const source of ["declared", "detected"] as const) {
    it.each<PageType>(["homepage", "product", "category", "content"])(
      `reads headers on empty-body %s pages with ${source} provenance`,
      async (pageType) => {
        const page = mockPageContext(
          "https://example.com/page",
          "<html><body></body></html>",
        );
        page.pageType = pageType;
        page.pageTypeSource = source;
        page.fetchResult.headers["x-robots-tag"] = "nofollow";
        const ctx = mockCheckContext([page]);
        ctx.evidence = buildScanEvidence({
          requestedUrl: page.url,
          homepageResult: page.fetchResult,
          pages: [page],
          rootFiles: {},
          wafProtection: null,
        });
        expect(ctx.evidence.renderedByPage[page.url]).toBe(false);
        const output = await runAudits(ctx, {
          categories: [
            {
              id: "access-crawl-control",
              name: "Access",
              weight: NoNofollowAudit.meta.weight,
            },
          ],
          audits: {
            "access-crawl-control": [
              {
                meta: NoNofollowAudit.meta,
                create: () => new NoNofollowAudit(),
              },
            ],
          },
        });
        const check = output.categories[0]!.checks[0]!;
        expect(check.status).toBe("fail");
        expect(check.weight).toBe(NoNofollowAudit.meta.weight);
        expect(check.pageUrl).toBe(page.url);
        expect(check.details?.found).toContain(page.url);
        expect(check.tags).not.toContain("scan-error");
      },
    );
  }
});
