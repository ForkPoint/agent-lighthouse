import { describe, it, expect, vi } from "vitest";
import { LlmsTxtLinksValidAudit } from "./llms-txt-links-valid";
import { mockCheckContext, mockFetchResult } from "#core/__tests__/test-utils";
import { CheckStatus } from "#core/types";

// isSafeUrl performs a real DNS lookup; stub it so link resolution is
// deterministic and offline-safe. ctx.fetch is stubbed per-test below.
vi.mock("#core/fetcher", async (importOriginal) => {
  const actual = await importOriginal<typeof import("#core/fetcher")>();
  return { ...actual, isSafeUrl: async () => true };
});

function fetchStub(statusByUrl: Record<string, number>) {
  return async ({ url }: { url: string }) => {
    const r = mockFetchResult("", statusByUrl[url] ?? 200);
    r.url = url;
    r.finalUrl = url;
    return r;
  };
}

describe("LlmsTxtLinksValidAudit", () => {
  const audit = new LlmsTxtLinksValidAudit();

  it("passes when all links return HTTP 200", async () => {
    const body =
      "# Site\n\n## Pages\n" +
      "- [Home](https://example.com/): Home\n" +
      "- [About](https://example.com/about): About";
    const ctx = mockCheckContext([], {
      "/llms.txt": mockFetchResult(body, 200),
    });
    ctx.fetch = fetchStub({});
    const result = await audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.message).toContain("return HTTP 200");
  });

  it("warns when a link is broken", async () => {
    const body =
      "# Site\n\n## Pages\n" +
      "- [Home](https://example.com/): Home\n" +
      "- [Gone](https://example.com/gone): Gone";
    const ctx = mockCheckContext([], {
      "/llms.txt": mockFetchResult(body, 200),
    });
    ctx.fetch = fetchStub({ "https://example.com/gone": 404 });
    const result = await audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.found).toContain("404");
  });

  it("warns when llms.txt has no links to validate", async () => {
    const ctx = mockCheckContext([], {
      "/llms.txt": mockFetchResult("# Site\n\n> Summary, no links.", 200),
    });
    ctx.fetch = fetchStub({});
    const result = await audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.message).toContain("No links found");
  });

  // This audit measures the links inside a published file. Whether the file
  // exists is `machine-discovery/llms-txt-exists`, and reporting it twice made
  // one absent file cost two rows.
  it("is not applicable when llms.txt is missing", async () => {
    const ctx = mockCheckContext([], {});
    const result = await audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.NotApplicable);
    expect(result.message).toContain("no links to validate");
  });

  it("is not applicable when /llms.txt redirects to the homepage", async () => {
    const home = mockFetchResult(
      '<!DOCTYPE html>\n<html lang="fr"><head><title>Home</title></head><body>Shop</body></html>',
      200,
      "text/html",
    );
    home.url = "https://example.com/llms.txt";
    home.finalUrl = "https://example.com/";
    const result = await audit.audit(
      mockCheckContext([], { "/llms.txt": home }),
    );
    expect(result.status).toBe(CheckStatus.NotApplicable);
    expect(result.found).toBe(
      "HTTP 200 with an HTML page, redirected to https://example.com/, not the file",
    );
  });

  it("skips malformed URLs in the link list (catch branch)", async () => {
    // http://[invalid has an unclosed IPv6 bracket → new URL throws → catch fires
    const body =
      "# Site\n\n## Pages\n" +
      "- [Bad](http://[invalid): Malformed URL\n" +
      "- [Home](https://example.com/): Home";
    const ctx = mockCheckContext([], {
      "/llms.txt": mockFetchResult(body, 200),
    });
    ctx.fetch = fetchStub({});
    const result = await audit.audit(ctx);
    // Malformed URL skipped; valid link fetched and returns 200
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.message).toContain("return HTTP 200");
  });

  const listing = (paths: string[]) =>
    "# Site\n\n## Pages\n" +
    paths.map((p) => `- [Page](https://example.com${p}): Page`).join("\n");

  it("checks at most 20 links, spread over the file, 4 at a time", async () => {
    const paths = Array.from({ length: 300 }, (_, i) => `/p${i}`);
    const ctx = mockCheckContext([], {
      "/llms.txt": mockFetchResult(listing(paths), 200),
    });
    const seen: string[] = [];
    let inFlight = 0;
    let peak = 0;
    ctx.fetch = async ({ url }) => {
      seen.push(url);
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight -= 1;
      return mockFetchResult("", 200);
    };
    const result = await audit.audit(ctx);
    expect(seen).toHaveLength(20);
    expect(seen).toContain("https://example.com/p0");
    expect(seen).toContain("https://example.com/p285");
    expect(peak).toBeLessThanOrEqual(4);
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.found).toContain("20 of 300 link(s) checked");
  });

  it("names the broken link, not the one before it", async () => {
    const ctx = mockCheckContext([], {
      "/llms.txt": mockFetchResult(listing(["/", "/gone"]), 200),
    });
    ctx.fetch = fetchStub({ "https://example.com/gone": 404 });
    const result = await audit.audit(ctx);
    expect(result.found).toContain("https://example.com/gone (404)");
    expect(result.found).not.toContain("https://example.com/ (404)");
  });

  it("does not call a refused or unanswered link broken", async () => {
    const ctx = mockCheckContext([], {
      "/llms.txt": mockFetchResult(
        listing(["/", "/login", "/waf", "/slow", "/busy"]),
        200,
      ),
    });
    ctx.fetch = fetchStub({
      "https://example.com/login": 401,
      "https://example.com/waf": 403,
      "https://example.com/slow": 0,
      "https://example.com/busy": 429,
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.found).toContain("4 could not be verified");
  });

  it("is not applicable when no checked link could be verified", async () => {
    const ctx = mockCheckContext([], {
      "/llms.txt": mockFetchResult(listing(["/a", "/b"]), 200),
    });
    ctx.fetch = fetchStub({
      "https://example.com/a": 403,
      "https://example.com/b": 403,
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.NotApplicable);
  });

  it("follows a redirect before judging a link", async () => {
    const ctx = mockCheckContext([], {
      "/llms.txt": mockFetchResult(listing(["/moved"]), 200),
    });
    const follow: Array<boolean | undefined> = [];
    ctx.fetch = async ({ followRedirects }) => {
      follow.push(followRedirects);
      return mockFetchResult("", followRedirects ? 200 : 301);
    };
    const result = await audit.audit(ctx);
    expect(follow).toEqual([true]);
    expect(result.status).toBe(CheckStatus.Pass);
  });
});
