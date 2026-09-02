import { describe, it, expect } from "vitest";
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
