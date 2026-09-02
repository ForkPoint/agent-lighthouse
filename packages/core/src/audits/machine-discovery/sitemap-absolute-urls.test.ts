import { describe, it, expect } from "vitest";
import { SitemapAbsoluteUrlsAudit } from "./sitemap-absolute-urls";
import { mockCheckContext, mockFetchResult } from "../../__tests__/test-utils";

const sitemap = (locs: string[]) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${locs
    .map((l) => `<url><loc>${l}</loc></url>`)
    .join("")}</urlset>`;

describe("SitemapAbsoluteUrlsAudit", () => {
  const audit = new SitemapAbsoluteUrlsAudit();

  it("passes when all <loc> values are absolute URLs", async () => {
    const ctx = mockCheckContext([], {
      "/sitemap.xml": mockFetchResult(
        sitemap(["https://example.com/", "https://example.com/about"]),
        200,
        "application/xml",
      ),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe("pass");
    expect(result.message).toContain("use absolute URLs");
  });

  it("fails when some <loc> values are relative URLs", async () => {
    const ctx = mockCheckContext([], {
      "/sitemap.xml": mockFetchResult(
        sitemap(["https://example.com/", "/about"]),
        200,
        "application/xml",
      ),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe("fail");
    expect(result.message).toContain("use relative URLs");
  });

  it("declines when the sitemap has no <loc> entries", async () => {
    const ctx = mockCheckContext([], {
      "/sitemap.xml": mockFetchResult(sitemap([]), 200, "application/xml"),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe("na");
  });

  it("declines when no sitemap is found", async () => {
    const ctx = mockCheckContext([]);
    const result = await audit.audit(ctx);
    expect(result.status).toBe("na");
  });

  it("uses sitemap-index.xml as fallback when sitemap.xml is absent (covers line 16 branch)", async () => {
    const ctx = mockCheckContext([], {
      "/sitemap-index.xml": mockFetchResult(
        sitemap(["https://example.com/", "https://example.com/about"]),
        200,
        "application/xml",
      ),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe("pass");
  });

  it("skips empty <loc> entries in the sitemap (covers if(loc) false branch)", async () => {
    // An empty <loc></loc> makes loc = '' → if(loc) is false → not pushed
    const body =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
      "<url><loc></loc></url>" +
      "<url><loc>https://example.com/</loc></url>" +
      "</urlset>";
    const ctx = mockCheckContext([], {
      "/sitemap.xml": mockFetchResult(body, 200, "application/xml"),
    });
    const result = await audit.audit(ctx);
    // Only the valid absolute URL is included; empty loc is skipped
    expect(result.status).toBe("pass");
  });

  it('shows "+N more" suffix when more than 5 locs are relative URLs', async () => {
    // 6 relative locs → relative.length (6) > 5 → "+N more" branch
    const relativeLocs = Array.from({ length: 6 }, (_, i) => `/page${i + 1}`);
    const ctx = mockCheckContext([], {
      "/sitemap.xml": mockFetchResult(
        sitemap(relativeLocs),
        200,
        "application/xml",
      ),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe("fail");
    expect(result.found).toContain("+1 more");
  });
});
