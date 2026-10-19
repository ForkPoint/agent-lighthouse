import { describe, it, expect } from "vitest";
import { SearchEndpointAudit } from "./search-endpoint";
import { weightForGrade } from "#core/scorer";
import { AuditMetaSchema } from "#core/schemas";
import {
  mockCheckContext,
  mockPageContext,
  mockFetchResult,
} from "#core/__tests__/test-utils";
import { expectNotApplicableOnEmpty } from "#core/tests/na-contract";
import type { PageContext } from "#core/check-context";
import {
  AuditTier,
  CheckPriority,
  CheckStatus,
  EvidenceGrade,
  NoticeKind,
  ScoreDisplayMode,
} from "#core/types";

const ld = (obj: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
const page = (head: string, url = "https://example.com/"): PageContext =>
  mockPageContext(url, `<html><head>${head}</head><body></body></html>`);

const SEARCH_ACTION = {
  "@type": "SearchAction",
  target: {
    "@type": "EntryPoint",
    urlTemplate: "https://example.com/search?q={search_term_string}",
  },
  "query-input": "required name=search_term_string",
};

function pageWithSearchAction(action: unknown = SEARCH_ACTION) {
  return page(
    ld({
      "@context": "https://schema.org",
      "@type": "WebSite",
      url: "https://example.com",
      potentialAction: action,
    }),
  );
}

describe("SearchEndpointAudit", () => {
  const audit = new SearchEndpointAudit();

  it("warns that the sitelinks search box is retired when a SearchAction is published", () => {
    const result = audit.audit(mockCheckContext([pageWithSearchAction()]));
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.priority).toBe(CheckPriority.Low);
    expect(result.message).toContain("sitelinks search box");
    expect(result.message).toContain("2024");
    // Google says removal is optional and WebSite markup still feeds site names.
    expect(result.message).toMatch(/no need to remove|optional/i);
    expect(result.message).toContain("WebSite");
    expect(result.found).toContain("search?q={search_term_string}");
    expect(result.pageUrl).toBe("https://example.com/");
  });

  it("reports a SearchAction whose target is unusable the same way", () => {
    const result = audit.audit(
      mockCheckContext([pageWithSearchAction({ "@type": "SearchAction" })]),
    );
    expect(result.status).toBe(CheckStatus.Warn);
  });

  it("does not probe the search URL — the markup is the finding", () => {
    const ctx = mockCheckContext([pageWithSearchAction()]);
    let fetched = false;
    ctx.fetch = async () => {
      fetched = true;
      return mockFetchResult("", 200);
    };
    audit.audit(ctx);
    expect(fetched).toBe(false);
  });

  it("is not applicable for WebSite markup without a SearchAction", () => {
    const ctx = mockCheckContext([
      page(
        ld({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Example",
          url: "https://example.com",
        }),
      ),
    ]);
    expect(audit.audit(ctx).status).toBe(CheckStatus.NotApplicable);
  });

  // The OpenAPI search-path half had no consumer and no retirement notice to
  // report, so it was dropped rather than moved into the obsolete tier.
  it("ignores an OpenAPI search operation", () => {
    const spec = JSON.stringify({
      openapi: "3.1.0",
      info: { title: "x", version: "1" },
      paths: {
        "/search": { get: { responses: { 200: { description: "ok" } } } },
      },
    });
    const ctx = mockCheckContext([page("")], {
      "/openapi.json": mockFetchResult(spec, 200, "application/json"),
    });
    expect(audit.audit(ctx).status).toBe(CheckStatus.NotApplicable);
  });

  it("is not applicable when no page carries structured data", () => {
    expect(audit.audit(mockCheckContext([page("")])).status).toBe(
      CheckStatus.NotApplicable,
    );
  });

  it("is not applicable on a scan that read nothing", async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it("is an obsolete-tier audit with an obsolete notice", () => {
    const { meta } = SearchEndpointAudit;
    expect(meta.tier).toBe(AuditTier.Obsolete);
    expect(meta.evidenceGrade).toBe(EvidenceGrade.D);
    expect(meta.weight).toBe(
      weightForGrade(EvidenceGrade.D, AuditTier.Obsolete),
    );
    expect(meta.scoreDisplayMode).toBe(ScoreDisplayMode.Informative);
    expect(meta.deprecated?.kind).toBe(NoticeKind.Obsolete);
    expect(meta.deprecated?.link).toBe(
      "https://developers.google.com/search/blog/2024/10/sitelinks-search-box",
    );
    expect(AuditMetaSchema.safeParse(meta).success).toBe(true);
  });
});
