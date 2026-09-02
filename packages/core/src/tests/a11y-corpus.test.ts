import { describe, it, expect } from "vitest";
import { readFixture } from "./fixture-io";
import {
  runA11yForHtml,
  type A11yPageResult,
} from "../audits/operability-safety/runner";
import {
  A11Y_RULES,
  OPERABILITY_SAFETY_AUDITS,
} from "../audits/operability-safety";
import { parseHtml } from "../parser";
import { mockCheckContext } from "../__tests__/test-utils";
import type { PageContext } from "../check-context";
import { AuditResultSchema } from "../schemas";

/**
 * Exercise the 17 accessibility-tree audits over representative real-page DOMs.
 *
 * Resolves Architecture Debt Item 1 (docs/architecture/debt.md):
 * In real-page-corpus.test.ts, page.a11yResults is omitted to keep the 41-page
 * scan suite comfortably under its 120s timeout budget. This dedicated suite
 * tests the a11y engine and A11yBackedAudit aggregations against diverse real
 * web pages (public sector, public health, forum, storefront, and SPA shell)
 * under its own isolated runtime budget (~3.2s).
 */

function buildFixturePage(
  html: string,
  url: string,
  a11yResults: A11yPageResult,
): PageContext {
  const $ = parseHtml(html);
  return {
    url,
    pageType: "content",
    pageTypeSource: "declared",
    fetchResult: {
      url,
      finalUrl: url,
      status: 200,
      headers: {},
      body: html,
      ttfbMs: 10,
      totalMs: 50,
      contentType: "text/html",
      contentLength: html.length,
    },
    $,
    jsonLd: [],
    meta: {},
    headLinks: [],
    a11yResults,
  };
}

describe("accessibility audits on real-page corpus", () => {
  const a11yBackedAudits = OPERABILITY_SAFETY_AUDITS.filter(
    (AuditClass) => Object.getPrototypeOf(AuditClass).name === "A11yBackedAudit",
  );

  it("identifies exactly 17 a11y-backed audits in operability-safety", () => {
    expect(a11yBackedAudits).toHaveLength(17);
    expect(A11Y_RULES.length).toBeGreaterThanOrEqual(26);
  });

  it("produces valid, schema-compliant verdicts across diverse real-world pages", async () => {
    const fixtures = [
      "gov-uk-vehicle-tax",
      "cdc-gov-flu-about",
      "hackernews-thread",
      "magicspoon-com-product",
      "atlassian-com-pricing-shell",
    ];

    const observedStatuses = new Set<string>();

    for (const fixtureName of fixtures) {
      const { html, provenance } = readFixture(fixtureName);
      const a11yResults = await runA11yForHtml(html, provenance.url, A11Y_RULES);
      const page = buildFixturePage(html, provenance.url, a11yResults);
      const ctx = mockCheckContext([page]);

      for (const AuditClass of a11yBackedAudits) {
        const audit = new (AuditClass as any)();
        const result = audit.audit(ctx);

        // Verify result conforms to the core result schema
        const parsed = AuditResultSchema.safeParse(result);
        expect(
          parsed.success,
          `${AuditClass.meta.id} on ${fixtureName} must conform to AuditResultSchema`,
        ).toBe(true);

        observedStatuses.add(result.status);
      }
    }

    // Proves that across real pages, the suite exercises pass, fail, warn, and na
    expect(observedStatuses.has("pass")).toBe(true);
    expect(observedStatuses.has("fail")).toBe(true);
    expect(observedStatuses.has("warn")).toBe(true);
    expect(observedStatuses.has("na")).toBe(true);
  });

  it("reports passes on semantic public sector document (gov-uk-vehicle-tax)", async () => {
    const { html, provenance } = readFixture("gov-uk-vehicle-tax");
    const a11yResults = await runA11yForHtml(html, provenance.url, A11Y_RULES);
    const page = buildFixturePage(html, provenance.url, a11yResults);
    const ctx = mockCheckContext([page]);

    const findAudit = (slug: string) => {
      const cls = a11yBackedAudits.find(
        (a) => a.meta.id === `operability-safety/${slug}`,
      );
      expect(cls).toBeDefined();
      return new (cls as any)().audit(ctx);
    };

    expect(findAudit("document-title").status).toBe("pass");
    expect(findAudit("landmark-unique").status).toBe("pass");
    expect(findAudit("aria-roles").status).toBe("pass");
    expect(findAudit("aria-attributes").status).toBe("pass");
    expect(findAudit("duplicate-id").status).toBe("pass");
  });

  it("identifies node targets on failing real-world pages (cdc-gov-flu-about)", async () => {
    const { html, provenance } = readFixture("cdc-gov-flu-about");
    const a11yResults = await runA11yForHtml(html, provenance.url, A11Y_RULES);
    const page = buildFixturePage(html, provenance.url, a11yResults);
    const ctx = mockCheckContext([page]);

    const findAudit = (slug: string) => {
      const cls = a11yBackedAudits.find(
        (a) => a.meta.id === `operability-safety/${slug}`,
      );
      expect(cls).toBeDefined();
      return new (cls as any)().audit(ctx);
    };

    const landmarkRes = findAudit("landmark-unique");
    expect(landmarkRes.status).toBe("fail");
    expect(landmarkRes.found).toContain("Failing element(s):");

    const attrRes = findAudit("aria-attributes");
    expect(attrRes.status).toBe("fail");
    expect(attrRes.found).toContain("Failing element(s):");
  });
});
