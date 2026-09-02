import { describe, it, expect } from "vitest";
import { NoBrokenLinksAudit } from "./no-broken-links";
import { AuditResultSchema } from "../../schemas";
import {
  mockCheckContext,
  mockPageContext,
  mockFetchResult,
} from "../../__tests__/test-utils";

function fetchStub(statusByUrl: Record<string, number>) {
  return async ({ url }: { url: string }) => {
    const r = mockFetchResult("", statusByUrl[url] ?? 200);
    r.url = url;
    r.finalUrl = url;
    return r;
  };
}

describe("NoBrokenLinksAudit", () => {
  const audit = new NoBrokenLinksAudit();

  const twoLinks =
    '<html><body><a href="/a">A</a><a href="/b">B</a></body></html>';

  it("passes when all sampled internal links return 200", async () => {
    const ctx = mockCheckContext([
      mockPageContext("https://example.com/", twoLinks),
    ]);
    ctx.fetch = fetchStub({});
    const result = await audit.audit(ctx);
    expect(result.status).toBe("pass");
    expect(result.message).toContain("return HTTP 200");
  });

  it("warns when a minority of internal links are broken", async () => {
    const ctx = mockCheckContext([
      mockPageContext("https://example.com/", twoLinks),
    ]);
    // 1 of 2 broken -> not more than half -> warn
    ctx.fetch = fetchStub({ "https://example.com/b": 404 });
    const result = await audit.audit(ctx);
    expect(result.status).toBe("warn");
    expect(result.found).toContain("404");
  });

  it("fails when a majority of internal links are broken", async () => {
    const ctx = mockCheckContext([
      mockPageContext("https://example.com/", twoLinks),
    ]);
    ctx.fetch = fetchStub({
      "https://example.com/a": 404,
      "https://example.com/b": 500,
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe("fail");
    expect(result.message).toContain("broken");
  });

  it("warns when there are no internal links to validate", async () => {
    const ctx = mockCheckContext([
      mockPageContext(
        "https://example.com/",
        '<html><body><a href="https://other.com/x">External</a></body></html>',
      ),
    ]);
    const result = await audit.audit(ctx);
    expect(result.status).toBe("warn");
    expect(result.message).toContain("No internal links found");
  });

  it("fails when no pages were scanned", async () => {
    const ctx = mockCheckContext([]);
    const result = await audit.audit(ctx);
    expect(result.status).toBe("fail");
    expect(result.message).toContain("No pages scanned");
  });

  it("skips hrefs that fail URL parsing (catch branch)", async () => {
    // 'http://host name.com/' has a space in the hostname → new URL throws → catch fires
    const html =
      "<html><body>" +
      '<a href="http://host name.com/">Bad URL</a>' +
      '<a href="/good">Good</a>' +
      "</body></html>";
    const ctx = mockCheckContext([
      mockPageContext("https://example.com/", html),
    ]);
    ctx.fetch = fetchStub({});
    const result = await audit.audit(ctx);
    // 'Bad URL' skipped; '/good' resolves and returns 200 → pass
    expect(result.status).toBe("pass");
    expect(result.message).toContain("return HTTP 200");
  });

  it("follows redirects and treats 3xx leading to 200 as healthy", async () => {
    const html =
      '<html><body><a href="/redirect-me">Redirect</a></body></html>';
    const ctx = mockCheckContext([
      mockPageContext("https://example.com/", html),
    ]);
    ctx.fetch = async ({
      followRedirects,
    }: {
      url: string;
      followRedirects?: boolean;
    }) => {
      expect(followRedirects).toBe(true);
      return mockFetchResult("<html>OK</html>", 200);
    };
    const result = await audit.audit(ctx);
    expect(result.status).toBe("pass");
    expect(AuditResultSchema.safeParse(result).success).toBe(true);
  });

  it("truncates long broken link lists and conforms to AuditResultSchema", async () => {
    const links = Array.from(
      { length: 20 },
      (_, i) =>
        `<a href="/very-long-path-segment-with-query-parameters-that-keeps-going-${i}?param1=value1&param2=value2&param3=value3">Link ${i}</a>`,
    ).join("");
    const ctx = mockCheckContext([
      mockPageContext(
        "https://example.com/",
        `<html><body>${links}</body></html>`,
      ),
    ]);
    ctx.fetch = fetchStub(
      Object.fromEntries(
        Array.from({ length: 20 }, (_, i) => [
          `https://example.com/very-long-path-segment-with-query-parameters-that-keeps-going-${i}?param1=value1&param2=value2&param3=value3`,
          404,
        ]),
      ),
    );
    const result = await audit.audit(ctx);
    expect(result.status).toBe("fail");
    expect(AuditResultSchema.safeParse(result).success).toBe(true);
    expect(result.displayValue!.length).toBeLessThanOrEqual(1000);
  });
});
