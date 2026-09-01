import { describe, it, expect, vi } from "vitest";
import { UrlAddressableStateAndPaginationFallbackAudit } from "./url-addressable-state-and-pagination-fallback";
import {
  mockPageContext,
  mockCheckContext,
  mockFetchResult,
} from "../../__tests__/test-utils";
import { expectNotApplicableOnEmpty } from "../../tests/na-contract";
import type { CheckContext } from "../../check-context";
import type { FetchOptions } from "../../fetcher";

vi.mock("../../fetcher", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../fetcher")>();
  return {
    ...actual,
    isSafeUrl: async (url: string) => {
      try {
        const { protocol, hostname } = new URL(url);
        if (protocol !== "http:" && protocol !== "https:") return false;
        return !/^(localhost$|127\.|\[?::1\]?$|10\.|192\.168\.)/.test(hostname);
      } catch {
        return false;
      }
    },
  };
});

const LISTING_URL = "https://example.com/collections/mugs";

/** N product cards, enough for the listing detector and for a count. */
const items = (n: number, offset = 0) =>
  Array.from(
    { length: n },
    (_v, i) =>
      `<div class="product-card"><a href="/p/${i + offset}">Mug ${i + offset}</a></div>`,
  ).join("");

/** A listing page whose only variable is the affordance under test. */
function listing(
  affordance: string,
  head = "",
  body = items(20),
): CheckContext {
  return mockCheckContext([
    mockPageContext(
      LISTING_URL,
      `<html><head>${head}</head><body><div class="product-grid">${body}</div>${affordance}</body></html>`,
      1,
    ),
  ]);
}

describe("UrlAddressableStateAndPaginationFallbackAudit", () => {
  const audit = new UrlAddressableStateAndPaginationFallbackAudit();

  it("is notApplicable on an empty site", async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it("passes href pagination and reports the deepest item index reachable by URL", async () => {
    const result = await audit.audit(
      listing(
        '<nav class="pagination"><a href="?page=2">2</a><a href="?page=3">3</a></nav>',
      ),
    );
    expect(result.status).toBe("pass");
    expect(result.found).toContain("60");
  });

  it('passes a listing whose only pagination is <link rel="next">', async () => {
    const result = await audit.audit(
      listing("", '<link rel="next" href="?page=2">'),
    );
    expect(result.status).toBe("pass");
  });

  it("fails a listing whose only affordance is an infinite-scroll sentinel", async () => {
    const result = await audit.audit(
      listing('<div class="infinite-sentinel"></div>'),
    );
    expect(result.status).toBe("fail");
  });

  // A button is a discrete action, so it beats a scroll sentinel; it still
  // needs a click per page, so it loses to an href.
  it("orders href pagination above a Load more button above a scroll sentinel", async () => {
    const href = await audit.audit(
      listing('<nav class="pagination"><a href="?page=2">2</a></nav>'),
    );
    const button = await audit.audit(
      listing('<button class="load-more">Load more</button>'),
    );
    const sentinel = await audit.audit(
      listing('<div class="infinite-sentinel"></div>'),
    );
    expect(button.status).toBe("warn");
    expect(href.score).toBeGreaterThan(button.score);
    expect(button.score).toBeGreaterThan(sentinel.score);
  });

  it("fails when a declared total dwarfs the items in the initial HTML", async () => {
    const schema = `<script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "ItemList",
      numberOfItems: 100,
    })}</script>`;
    const result = await audit.audit(listing("", schema));
    expect(result.status).toBe("fail");
    expect(result.message).toContain("100");
    expect(result.message).toContain("20");
  });

  it("reports a facet as client-only when the filtered URL returns the same page", async () => {
    const html = `<html><head></head><body><div class="product-grid">${items(20)}</div><nav class="pagination"><a href="?page=2">2</a></nav><a class="facet" href="?colour=red">Red</a></body></html>`;
    const ctx = mockCheckContext([mockPageContext(LISTING_URL, html, 1)]);
    ctx.fetch = async (_options: FetchOptions) => {
      const result = mockFetchResult(html, 200, "text/html");
      return result;
    };
    const result = await audit.audit(ctx);
    expect(result.details?.["clientOnlyFacets"]).toBe(1);
  });

  it("accepts a facet whose filtered URL returns a different item count", async () => {
    const html = `<html><head></head><body><div class="product-grid">${items(20)}</div><nav class="pagination"><a href="?page=2">2</a></nav><a class="facet" href="?colour=red">Red</a></body></html>`;
    const filtered = `<html><head></head><body><div class="product-grid">${items(4)}</div></body></html>`;
    const ctx = mockCheckContext([mockPageContext(LISTING_URL, html, 1)]);
    ctx.fetch = async (_options: FetchOptions) =>
      mockFetchResult(filtered, 200, "text/html");
    const result = await audit.audit(ctx);
    expect(result.details?.["clientOnlyFacets"]).toBe(0);
    expect(result.status).toBe("pass");
  });

  it("is notApplicable when the site has no listing page", async () => {
    const ctx = mockCheckContext([
      mockPageContext(
        "https://example.com/about",
        "<html><body><p>About us.</p></body></html>",
        1,
      ),
    ]);
    const result = await audit.audit(ctx);
    expect(result.status).toBe("na");
  });

  // Tabs and modals need a live browser to click. The audit must not claim them.
  it("does not promise the headless tab and modal extension", () => {
    const { meta } = UrlAddressableStateAndPaginationFallbackAudit;
    expect(meta.description).not.toContain("modal");
    expect(meta.evidenceGrade).toBe("B");
    expect(meta.tier).toBe("scored");
    expect(meta.scoreDisplayMode).toBe("ternary");
  });
});
