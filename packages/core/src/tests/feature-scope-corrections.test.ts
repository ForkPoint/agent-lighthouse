import { describe, it, expect } from "vitest";
import { mockCheckContext, mockPageContext } from "#core/__tests__/test-utils";
import { runAudits } from "#core/audit-runner";
import { buildScanEvidence } from "#core/scan-evidence";
import type { PageContext } from "#core/check-context";
import type { ScanConfig } from "#core/audit-config";
import { CheckResultSchema } from "#core/schemas";
import {
  PageType,
  PageTypeSource,
  CheckStatus,
  ScoreDisplayMode,
  CoverageProvenance,
} from "#core/types";
import { TimeElementAudit } from "#core/audits/content-extraction/time-element";
import { ComparisonTablesAudit } from "#core/audits/answer-readiness/comparison-tables";
import { ExternalCitationsAudit } from "#core/audits/answer-readiness/external-citations";
import { UniqueDataAudit } from "#core/audits/answer-readiness/unique-data";
import { BreadcrumbSchemaAudit } from "#core/audits/structured-data/breadcrumb-schema";

const cases = [
  {
    meta: TimeElementAudit.meta,
    create: () => new TimeElementAudit(),
    marked: '<main><time datetime="2025-01-15">January 15, 2025</time></main>',
    missing: "<main><p>Published January 15, 2025</p></main>",
    weight: 0,
  },
  {
    meta: ComparisonTablesAudit.meta,
    create: () => new ComparisonTablesAudit(),
    marked:
      "<main><h1>A versus B</h1><table><tr><th>A</th><th>B</th></tr><tr><td>10</td><td>20</td></tr></table></main>",
    missing:
      "<main><h1>A versus B</h1><p>A is faster. B costs less.</p></main>",
    weight: 0,
  },
  {
    meta: ExternalCitationsAudit.meta,
    create: () => new ExternalCitationsAudit(),
    marked:
      '<main><p>See <a href="https://research.example/study">the study</a>.</p></main>',
    missing: null,
    weight: 0,
  },
  {
    meta: UniqueDataAudit.meta,
    create: () => new UniqueDataAudit(),
    marked:
      "<main><p>Our survey found that 73% of respondents agreed.</p></main>",
    missing: null,
    weight: 0,
  },
  {
    meta: BreadcrumbSchemaAudit.meta,
    create: () => new BreadcrumbSchemaAudit(),
    marked:
      '<script type="application/ld+json">{"@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"https://example.com/"},{"@type":"ListItem","position":2,"name":"Current"}]}</script>',
    missing:
      '<nav aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li aria-current="page">Current</li></ol></nav>',
    weight: 1,
  },
];
function page(
  body: string,
  type: PageType,
  source: PageTypeSource,
  slug = "page",
) {
  const p = mockPageContext(
    `https://example.com/${slug}`,
    `<html><body>${body}<p>${"Readable content. ".repeat(60)}</p></body></html>`,
    1,
  );
  p.pageType = type;
  p.pageTypeSource = source;
  return p;
}
for (const scenario of cases) {
  const config: ScanConfig = {
    categories: [{ id: scenario.meta.category, name: "Scope", weight: 1 }],
    audits: {
      [scenario.meta.category]: [
        { meta: scenario.meta, create: scenario.create },
      ],
    },
  };
  const run = async (pages: PageContext[]) => {
    const ctx = mockCheckContext(pages);
    ctx.evidence = buildScanEvidence({
      requestedUrl: pages[0]!.url,
      homepageResult: pages[0]!.fetchResult,
      pages,
      rootFiles: {},
      wafProtection: null,
    });
    return runAudits(ctx, config);
  };
  describe(scenario.meta.id, () => {
    for (const source of Object.values(PageTypeSource)) {
      describe(source, () => {
        it.each(Object.values(PageType))(
          "selects features on %s",
          async (type) => {
            const variants: Array<[string, CheckStatus]> = [
              [scenario.marked, CheckStatus.Pass],
              ["<main><p>Contact us.</p></main>", CheckStatus.NotApplicable],
            ];
            if (scenario.missing)
              variants.push([scenario.missing, CheckStatus.Fail]);
            for (const [html, status] of variants) {
              const result = await run([page(html, type, source)]);
              const check = CheckResultSchema.parse(result.checks[0]);
              expect(check.status).toBe(status);
              expect(check.weight).toBe(scenario.weight);
              expect(check.coverage?.provenance).toBe(CoverageProvenance.All);
              expect(check.tags).not.toContain("skipped:page-type");
              expect(check.advisoryResults).toBeUndefined();
              if (!scenario.weight) {
                expect(check.scoreDisplayMode).toBe(
                  ScoreDisplayMode.Informative,
                );
                expect(result.categories[0]!.assessedMass).toBe(0);
              }
            }
          },
        );
      });
    }
    it("aggregates mixed relevant, unrelated and unread pages independent of order", async () => {
      const marked = page(
        scenario.marked,
        PageType.Product,
        PageTypeSource.Declared,
        "marked",
      );
      const missing = page(
        scenario.missing ?? "<p>Contact us.</p>",
        PageType.Homepage,
        PageTypeSource.Detected,
        "missing",
      );
      const unrelated = page(
        "<p>Contact us.</p>",
        PageType.Category,
        PageTypeSource.Detected,
        "unrelated",
      );
      const unread = page(
        scenario.marked,
        PageType.Article,
        PageTypeSource.Declared,
        "unread",
      );
      unread.$ = mockPageContext(unread.url, "").$;
      unread.fetchResult = { ...unread.fetchResult, body: "", status: 503 };
      for (const pages of [
        [marked, missing, unrelated, unread],
        [unrelated, missing, unread, marked],
      ]) {
        const result = await run(pages);
        const check = CheckResultSchema.parse(result.checks[0]);
        expect(check.status).toBe(
          scenario.missing ? CheckStatus.Warn : CheckStatus.Pass,
        );
        if (scenario.missing) expect(check.displayValue).toContain("1/2");
        expect(check.coverage?.unreadUrls).toEqual([unread.url]);
        expect(check.coverage?.inputUrls).not.toContain(unread.url);
        expect(check.advisoryResults).toBeUndefined();
        expect(check.weight).toBe(scenario.weight);
      }
    });
  });
}
