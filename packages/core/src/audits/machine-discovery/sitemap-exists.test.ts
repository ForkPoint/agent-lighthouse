import { describe, it, expect, vi } from "vitest";
import { SitemapExistsAudit } from "./sitemap-exists";
import { mockCheckContext, mockFetchResult } from "../../__tests__/test-utils";

describe("SitemapExistsAudit", () => {
  const audit = new SitemapExistsAudit();

  it("passes when a valid <urlset> sitemap exists", async () => {
    const body =
      '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://example.com/</loc></url></urlset>';
    const ctx = mockCheckContext([], {
      "/sitemap.xml": mockFetchResult(body, 200, "application/xml"),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe("pass");
    expect(result.message).toContain("valid structure");
  });

  it("fails when the sitemap lacks <urlset> or <sitemapindex>", async () => {
    const ctx = mockCheckContext([], {
      "/sitemap.xml": mockFetchResult(
        "<html><body>not a sitemap</body></html>",
        200,
        "text/html",
      ),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe("fail");
    expect(result.message).toContain("does not contain valid");
  });

  it("fails when no sitemap is found", async () => {
    const ctx = mockCheckContext([]);
    const result = await audit.audit(ctx);
    expect(result.status).toBe("fail");
    expect(result.message).toContain("No XML sitemap found");
  });

  it("uses sitemap-index.xml as fallback when sitemap.xml is absent (covers line 16 branch)", async () => {
    const body =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
      "<url><loc>https://example.com/</loc></url>" +
      "</urlset>";
    const ctx = mockCheckContext([], {
      "/sitemap-index.xml": mockFetchResult(body, 200, "application/xml"),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe("pass");
  });

  it("passes with a <sitemapindex> root element (covers <sitemapindex> found branch)", async () => {
    // hasUrlset=false, hasSitemapindex=true → ternary returns '<sitemapindex> found'
    const body =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
      "<sitemap><loc>https://example.com/sitemap1.xml</loc></sitemap>" +
      "</sitemapindex>";
    const ctx = mockCheckContext([], {
      "/sitemap.xml": mockFetchResult(body, 200, "application/xml"),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe("pass");
    expect(result.found).toContain("sitemapindex");
  });
});

vi.mock("../../fetcher", async (original) => ({
  ...(await original<typeof import("../../fetcher")>()),
  isSafeUrl: async () => true,
}));

it("does not fail absence when the sitemap walk stopped before proving it", async () => {
  const ctx = mockCheckContext([]);
  ctx.siteRootUrl = "https://example.com/project/";
  const children = Array.from(
    { length: 11 },
    (_, i) => `https://example.com/other/${i}.xml`,
  );
  ctx.fetch = async ({ url }) => {
    if (url === "https://example.com/sitemap.xml")
      return mockFetchResult(
        `<sitemapindex>${children.map((loc) => `<sitemap><loc>${loc}</loc></sitemap>`).join("")}</sitemapindex>`,
        200,
        "application/xml",
      );
    if (children.includes(url))
      return mockFetchResult(
        `<urlset><url><loc>https://example.com/other/page</loc></url></urlset>`,
        200,
        "application/xml",
      );
    return mockFetchResult("", 404);
  };
  expect((await new SitemapExistsAudit().audit(ctx)).status).toBe("na");
});

it("does not report missing sitemap coverage when a shared index has unreadable children", async () => {
  const ctx = mockCheckContext([]);
  ctx.siteRootUrl = "https://example.com/project/";
  ctx.fetch = async ({ url }) => {
    if (url === "https://example.com/sitemap.xml")
      return mockFetchResult(
        "<sitemapindex><sitemap><loc>https://example.com/sitemaps/project.xml.gz</loc></sitemap></sitemapindex>",
        200,
        "application/xml",
      );
    if (url.endsWith(".gz"))
      return mockFetchResult("compressed bytes", 200, "application/gzip");
    return mockFetchResult("", 404);
  };
  expect((await new SitemapExistsAudit().audit(ctx)).status).toBe("na");
});
