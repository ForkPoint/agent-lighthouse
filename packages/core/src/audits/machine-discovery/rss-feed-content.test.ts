import { describe, it, expect } from "vitest";
import { RssFeedContentAudit } from "./rss-feed-content";
import {
  mockCheckContext,
  mockPageContext,
  mockFetchResult,
} from "../../__tests__/test-utils";

const longText = "x".repeat(600);
const shortText = "short summary";

const feed = (descriptions: string[]) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel>${descriptions
    .map(
      (d) =>
        `<item><title>Item</title><link>https://example.com/a</link><description>${d}</description></item>`,
    )
    .join("")}</channel></rss>`;

describe("RssFeedContentAudit", () => {
  const audit = new RssFeedContentAudit();

  it("passes when all items have full content", async () => {
    const ctx = mockCheckContext([], {
      "/rss.xml": mockFetchResult(
        feed([longText, longText]),
        200,
        "application/rss+xml",
      ),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe("pass");
    expect(result.message).toContain("have full content");
  });

  it("warns when only some items have full content", async () => {
    const ctx = mockCheckContext([], {
      "/rss.xml": mockFetchResult(
        feed([longText, shortText]),
        200,
        "application/rss+xml",
      ),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe("warn");
    expect(result.message).toContain("1/2 items have full content");
  });

  it("fails when fewer than half the items have full content", async () => {
    const ctx = mockCheckContext([], {
      "/rss.xml": mockFetchResult(
        feed([longText, shortText, shortText]),
        200,
        "application/rss+xml",
      ),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe("fail");
    expect(result.message).toContain("1/3 items have content");
  });

  it("warns when the feed has no items", async () => {
    const ctx = mockCheckContext([], {
      "/rss.xml": mockFetchResult(
        '<rss version="2.0"><channel></channel></rss>',
        200,
        "application/rss+xml",
      ),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe("warn");
    expect(result.message).toContain("no items");
  });

  it("fails when no feed is found", async () => {
    const ctx = mockCheckContext([]);
    const result = await audit.audit(ctx);
    expect(result.status).toBe("fail");
    expect(result.message).toContain("No RSS feed found");
  });

  it("passes when a page <head> alternate link points to a relative RSS feed with full content", async () => {
    // Covers headLinks loop: link.rel=alternate, link.type=rss+xml, feedUrl.startsWith('/')
    const html =
      '<html><head><link rel="alternate" type="application/rss+xml" href="/rss.xml" /></head><body></body></html>';
    const feedBody = feed([longText, longText]);
    const ctx = mockCheckContext([
      mockPageContext("https://example.com/", html),
    ]);
    ctx.fetch = async ({ url }) => {
      const r = mockFetchResult(feedBody, 200, "application/rss+xml");
      r.url = url;
      r.finalUrl = url;
      return r;
    };
    const result = await audit.audit(ctx);
    expect(result.status).toBe("pass");
  });

  it("passes when a page <head> alternate link uses an absolute Atom feed URL", async () => {
    // Covers: link.type=atom+xml AND feedUrl that does NOT start with '/'
    const html =
      '<html><head><link rel="alternate" type="application/atom+xml" href="https://example.com/feed.atom" /></head><body></body></html>';
    const feedBody = feed([longText]);
    const ctx = mockCheckContext([
      mockPageContext("https://example.com/", html),
    ]);
    ctx.fetch = async ({ url }) => {
      const r = mockFetchResult(feedBody, 200, "application/atom+xml");
      r.url = url;
      r.finalUrl = url;
      return r;
    };
    const result = await audit.audit(ctx);
    expect(result.status).toBe("pass");
  });

  it("falls through to rootFiles when head-link feed fetch returns non-200", async () => {
    // isOk(result) false in headLinks loop → falls through to well-known paths
    const html =
      '<html><head><link rel="alternate" type="application/rss+xml" href="/bad-feed.xml" /></head><body></body></html>';
    const ctx = mockCheckContext(
      [mockPageContext("https://example.com/", html)],
      {
        "/rss.xml": mockFetchResult(
          feed([longText, longText]),
          200,
          "application/rss+xml",
        ),
      },
    );
    ctx.fetch = async ({ url }) => {
      const r = mockFetchResult("", 404);
      r.url = url;
      r.finalUrl = url;
      return r;
    };
    const result = await audit.audit(ctx);
    // Falls through to rootFiles → /rss.xml found with full content
    expect(result.status).toBe("pass");
  });

  it("passes when atom.xml found via direct fetch fallback (covers atom fetch true branch)", async () => {
    // head link fetch fails, no rootFiles → atom.xml fetched directly → 200 → found
    const html =
      '<html><head><link rel="alternate" type="application/rss+xml" href="/bad-feed.xml" /></head><body></body></html>';
    const atomBody = feed([longText]);
    const ctx = mockCheckContext([
      mockPageContext("https://example.com/", html),
    ]);
    ctx.fetch = async ({ url }) => {
      const ok = url === "https://example.com/atom.xml";
      const r = mockFetchResult(
        ok ? atomBody : "",
        ok ? 200 : 404,
        "application/atom+xml",
      );
      r.url = url;
      r.finalUrl = url;
      return r;
    };
    const result = await audit.audit(ctx);
    expect(result.status).toBe("pass");
  });

  it("skips non-alternate headLinks and uses well-known paths (covers if-condition false branch)", async () => {
    // rel="icon" doesn't match "alternate" → condition false → loop continues without returning
    const html =
      '<html><head><link rel="icon" href="/favicon.ico" /></head><body></body></html>';
    const ctx = mockCheckContext(
      [mockPageContext("https://example.com/", html)],
      {
        "/rss.xml": mockFetchResult(
          feed([longText]),
          200,
          "application/rss+xml",
        ),
      },
    );
    ctx.fetch = async ({ url }) => {
      const r = mockFetchResult("", 404);
      r.url = url;
      r.finalUrl = url;
      return r;
    };
    const result = await audit.audit(ctx);
    expect(result.status).toBe("pass");
  });
});
