import { describe, it, expect } from "vitest";
import { UniqueDataAudit } from "./unique-data";
import { mockCheckContext, mockPageContext } from "#core/__tests__/test-utils";
import { scopeAudit } from "#core/audit-runner";
import { CheckStatus, PageType } from "#core/types";

describe("UniqueDataAudit", () => {
  const audit = new UniqueDataAudit();

  it("passes with 3+ citable statistics (%/currency/grouped-thousands)", () => {
    const page = mockPageContext(
      "https://example.com/blog/post",
      `<html><body><main><p>73% prefer it, it costs $2,500, and reaches 1,200 users.</p></main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.message).toContain("data points");
  });

  it("warns with only 1-2 data points", () => {
    const page = mockPageContext(
      "https://example.com/blog/post",
      `<html><body><main><p>Only 73% of users agreed.</p></main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.message).toContain("data point");
  });

  it("fails when only bare decimals are present (tightened pattern)", () => {
    const page = mockPageContext(
      "https://example.com/blog/post",
      `<html><body><main><p>Shoe size 9.5 and software version 2.0 are here.</p></main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("No numbers, percentages, or data points");
  });

  it("fails when no pages scanned", () => {
    const result = audit.audit(mockCheckContext([]));
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("No pages scanned");
  });

  // Dossier required fix #6: the grade-B study measured content pages.
  it("is scoped to content pages", () => {
    expect(UniqueDataAudit.meta.applicablePageTypes).toEqual([
      PageType.Unknown,
      PageType.Article,
    ]);

    const home = mockPageContext(
      "https://example.com/",
      "<html><body><main><p>New season. Shop now.</p></main></body></html>",
    );
    expect(scopeAudit(mockCheckContext([home]), UniqueDataAudit.meta)).toBe(
      null,
    );

    const guide = mockPageContext(
      "https://example.com/guides/sizing",
      "<html><body><main><p>Our sizing guide.</p></main></body></html>",
      1,
    );
    const scope = scopeAudit(
      mockCheckContext([home, guide]),
      UniqueDataAudit.meta,
    );
    expect(scope?.pages.map((p) => p.url)).toEqual([
      "https://example.com/guides/sizing",
    ]);
  });

  it("counts euro, pound and comma-decimal amounts", () => {
    const page = mockPageContext(
      "https://example.com/blog/post",
      `<html><body><main><p>The kit costs 49,99 €, delivery is 4,50 € and the yearly plan is £29.99. Bulk orders start at 1.200,00 €.</p></main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.found).toContain("49,99 €");
    expect(result.found).toContain("£29.99");
  });

  it("reads a French comma-decimal percentage", () => {
    const page = mockPageContext(
      "https://example.com/blog/post",
      `<html><body><main><p>Le taux atteint 12,5 % cette année.</p></main></body></html>`,
    );
    expect(audit.audit(mockCheckContext([page])).status).toBe(CheckStatus.Warn);
  });

  // True positive: a comma decimal without a currency or % is not a statistic.
  it("still fails bare comma decimals with no unit", () => {
    const page = mockPageContext(
      "https://example.com/blog/post",
      `<html><body><main><p>Shoe size 42,5 and software version 2,0 are here.</p></main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe(CheckStatus.Fail);
  });
});
