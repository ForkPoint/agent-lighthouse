import { describe, expect, it } from "vitest";
import type { FetchResult } from "./fetcher";
import { buildOfflineContext } from "./offline-context";
import { EvidenceKey, PageType, PageTypeSource } from "./types";

function page(status: number, body: string): FetchResult {
  return {
    url: "https://shop.example/products/kettle",
    finalUrl: "https://shop.example/products/kettle",
    status,
    headers: { "content-type": "text/html" },
    body,
    ttfbMs: 0,
    totalMs: 0,
    contentType: "text/html",
    contentLength: body.length,
  };
}

const ARTICLE = `<html><body><main><h1>Copper kettles</h1><p>${"Hammered by hand from recycled copper. ".repeat(20)}</p></main></body></html>`;

describe("buildOfflineContext", () => {
  it("parses a stored page and derives the scan evidence from it", () => {
    const ctx = buildOfflineContext(page(200, ARTICLE));

    expect(ctx.domain).toBe("shop.example");
    expect(ctx.baseUrl).toBe("https://shop.example");
    expect(ctx.pages).toHaveLength(1);
    expect(ctx.pages[0]!.fetchResult.status).toBe(200);
    expect(ctx.evidence.met[EvidenceKey.RenderedBody]).toBe(true);
  });

  it("declares a page type when asked instead of classifying", () => {
    const ctx = buildOfflineContext(page(200, ARTICLE), {
      pageType: PageType.Product,
    });

    expect(ctx.pages[0]!.pageType).toBe(PageType.Product);
    expect(ctx.pages[0]!.classification?.source).toBe(PageTypeSource.Declared);
  });

  it("leaves an unread response out of the pages", () => {
    const ctx = buildOfflineContext(page(403, "Access denied"));

    expect(ctx.pages).toHaveLength(0);
    expect(ctx.evidence.judgeable).toBe(false);
  });

  it("sends no request unless the caller supplies one", async () => {
    const ctx = buildOfflineContext(page(200, ARTICLE));

    const result = await ctx.fetch({ url: "https://shop.example/robots.txt" });

    expect(result.status).toBe(0);
    expect(result.error).toMatch(/no request sent/);
  });
});
