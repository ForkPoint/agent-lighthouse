import { describe, it, expect } from "vitest";
import { BreadcrumbSchemaAudit } from "./breadcrumb-schema";
import { mockPageContext, mockCheckContext } from "#core/__tests__/test-utils";
import { CheckStatus } from "#core/types";

const ld = (obj: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
const page = (url: string, head = "") =>
  mockPageContext(url, `<html><head>${head}</head><body></body></html>`, 1);

const breadcrumb = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: "https://example.com/",
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Cat",
      item: "https://example.com/cat/",
    },
  ],
};

describe("BreadcrumbSchemaAudit", () => {
  const audit = new BreadcrumbSchemaAudit();

  it("warns (low) when there are no pages with URL depth > 1", () => {
    const ctx = mockCheckContext([page("https://example.com/about")]); // depth 1
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.message).toContain("No pages with URL depth > 1");
  });

  it("passes when all deep pages have BreadcrumbList", () => {
    const ctx = mockCheckContext([
      page("https://example.com/cat/sub", ld(breadcrumb)),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.message).toContain("present on all 1 deep page(s)");
  });

  it("detects BreadcrumbList inside @graph", () => {
    const ctx = mockCheckContext([
      page(
        "https://example.com/cat/sub",
        ld({ "@context": "https://schema.org", "@graph": [breadcrumb] }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Pass);
  });

  it("detects BreadcrumbList in a top-level `[{...}]` array (Shopify-style)", () => {
    const ctx = mockCheckContext([
      page("https://example.com/cat/sub", ld([breadcrumb])),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Pass);
  });

  it("fails when no deep page has BreadcrumbList", () => {
    const ctx = mockCheckContext([page("https://example.com/cat/sub")]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("No BreadcrumbList schema found");
  });

  it("warns when only some deep pages have BreadcrumbList", () => {
    const ctx = mockCheckContext([
      page("https://example.com/cat/sub", ld(breadcrumb)),
      page("https://example.com/cat/other"),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.found).toBe("1/2 deep pages have BreadcrumbList");
  });

  it("handles a page with an invalid URL gracefully (urlDepth catch block)", () => {
    // Manually override url to a non-parseable value so urlDepth hits its
    // catch block and returns 0. The other deep page (with BreadcrumbList) still
    // drives the result to pass.
    const validDeepPage = page("https://example.com/cat/sub", ld(breadcrumb));
    const invalidUrlPage = {
      ...page("https://example.com/cat/item"),
      url: "not-a-url",
    };
    const ctx = mockCheckContext([validDeepPage, invalidUrlPage]);
    const result = audit.audit(ctx);
    // Only the valid deep page counts; it has BreadcrumbList → pass
    expect(result.status).toBe(CheckStatus.Pass);
  });

  it("detects BreadcrumbList with array @type (Array.isArray branch in matchesType)", () => {
    const ctx = mockCheckContext([
      page(
        "https://example.com/cat/sub",
        ld({
          "@context": "https://schema.org",
          "@type": ["BreadcrumbList", "ItemList"],
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "Home",
              item: "https://example.com/",
            },
          ],
        }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Pass);
  });
});
