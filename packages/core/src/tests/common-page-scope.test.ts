import { describe, expect, it } from "vitest";
import { runAudits } from "#core/audit-runner";
import type { ScanConfig } from "#core/audit-config";
import {
  PAGE_TYPES,
  type PageType,
  CheckStatus,
  ScoreDisplayMode,
} from "#core/types";
import { AuditResultSchema } from "#core/schemas";
import { buildScanEvidence } from "#core/scan-evidence";
import { mockCheckContext, mockPageContext } from "#core/__tests__/test-utils";
import { MainElementAudit } from "#core/audits/content-extraction/main-element";
import { SingleH1Audit } from "#core/audits/content-extraction/single-h1";
import { HeaderFooterAudit } from "#core/audits/content-extraction/header-footer";
import { LanguageAttributeAudit } from "#core/audits/content-extraction/language-attribute";

const audits = [
  MainElementAudit,
  SingleH1Audit,
  HeaderFooterAudit,
  LanguageAttributeAudit,
];
const config: ScanConfig = {
  categories: [
    {
      id: "content-extraction",
      name: "Content extraction",
      weight: audits.reduce((sum, audit) => sum + audit.meta.weight, 0),
    },
  ],
  audits: {
    "content-extraction": audits.map((AuditClass) => ({
      meta: AuditClass.meta,
      create: () => new AuditClass(),
    })),
  },
};

const pageTypes: readonly PageType[] = PAGE_TYPES;
const text =
  "This page contains readable information about the shop and its products. ".repeat(
    40,
  );

describe("common page scope", () => {
  it.each([
    { declaration: 'lang="en"', status: CheckStatus.Pass },
    { declaration: "", status: CheckStatus.Fail },
  ])(
    "judges language on an empty-body page: $status",
    async ({ declaration, status }) => {
      const page = mockPageContext(
        "https://example.com/app",
        `<html ${declaration}><body><div id="app"></div></body></html>`,
      );
      const ctx = mockCheckContext([page]);
      ctx.evidence = buildScanEvidence({
        requestedUrl: page.url,
        homepageResult: page.fetchResult,
        pages: [page],
        rootFiles: {},
        wafProtection: null,
      });
      expect(ctx.evidence.renderedByPage[page.url]).toBe(false);
      const output = await runAudits(ctx, config);
      const check = output.categories[0]!.checks.find(
        (entry) => entry.id === LanguageAttributeAudit.meta.id,
      )!;
      expect(check.status).toBe(status);
      expect(check.weight).toBe(LanguageAttributeAudit.meta.weight);
      expect(check.scoreDisplayMode).toBe(ScoreDisplayMode.Binary);
      expect(check.pageUrl).toBe(page.url);
    },
  );

  it.each(audits)(
    "bounds large failure samples for $name without a schema error",
    (AuditClass) => {
      const pages = Array.from({ length: 150 }, (_, index) =>
        mockPageContext(
          `https://example.com/${String(index).padStart(3, "0")}/${"path".repeat(30)}`,
          "<p>No landmarks or heading</p>",
        ),
      );
      const instance = new AuditClass();
      const result = instance.audit(mockCheckContext(pages));
      expect(result.status).toBe(CheckStatus.Fail);
      expect(result.found).toContain("0/150");
      expect(result.found).toContain("(truncated)");
      expect(AuditResultSchema.safeParse(result).success).toBe(true);
      expect(instance.toCheckResult(result).status).toBe(CheckStatus.Fail);
    },
  );

  for (const source of ["declared", "detected"] as const) {
    it.each(pageTypes)(
      `judges every %s page with ${source} provenance through the runner`,
      async (pageType) => {
        const good = mockPageContext(
          "https://example.com/good",
          `<html lang="en"><body><header>Header</header><main><h1>Title</h1><p>${text}</p></main><footer>Footer</footer></body></html>`,
        );
        const bad = mockPageContext(
          "https://example.com/bad",
          `<html><body><p>${text}</p></body></html>`,
        );
        for (const page of [good, bad]) {
          page.pageType = pageType;
          page.pageTypeSource = source;
        }

        const results = [];
        for (const pages of [
          [good, bad],
          [bad, good],
        ]) {
          const ctx = mockCheckContext(pages);
          ctx.evidence = buildScanEvidence({
            requestedUrl: pages[0]!.url,
            homepageResult: pages[0]!.fetchResult,
            pages,
            rootFiles: {},
            wafProtection: null,
          });
          const output = await runAudits(ctx, config);
          const checks = output.categories[0]!.checks;
          expect(checks.map((check) => check.id).sort()).toEqual(
            audits.map((audit) => audit.meta.id).sort(),
          );
          for (const AuditClass of audits) {
            const check = checks.find(
              (entry) => entry.id === AuditClass.meta.id,
            )!;
            expect(check.status).toBe(
              AuditClass.meta.scoreDisplayMode === ScoreDisplayMode.Binary
                ? CheckStatus.Fail
                : CheckStatus.Warn,
            );
            expect(check.scoreDisplayMode).toBe(
              AuditClass.meta.scoreDisplayMode,
            );
            expect(check.weight).toBe(AuditClass.meta.weight);
            expect(check.pageUrl).toBe(bad.url);
            expect(check.details?.found).toContain(bad.url);
            expect(check.tags).not.toContain("scan-error");
            expect(
              AuditResultSchema.safeParse(new AuditClass().audit(ctx)).success,
            ).toBe(true);
          }
          results.push(output.categories[0]);
        }
        expect(results[1]).toEqual(results[0]);
      },
    );
  }
});
