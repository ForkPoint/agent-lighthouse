import { describe, it, expect, vi } from "vitest";
import { BotContentDeltaDeclaredAudit } from "./bot-content-delta-declared";
import {
  mockPageContext,
  mockCheckContext,
  mockFetchResult,
} from "../../__tests__/test-utils";
import { expectNotApplicableOnEmpty } from "../../tests/na-contract";
import { BASELINE_UA } from "../../gatherers/ua-parity";
import type { FetchOptions, FetchResult } from "../../fetcher";

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

const SENTENCES = Array.from(
  { length: 40 },
  (_v, i) =>
    `Paragraph ${i} explains how the resole process works in a workshop.`,
);
const FULL_TEXT = SENTENCES.join(" ");
const REWRITTEN_BASE = Array.from(
  { length: 40 },
  (_v, i) =>
    `Section ${i} covers boot repair topics inside our facility today.`,
).join(" ");
/** Different words, padded to the browser text's exact length: only the shingles differ. */
const REWRITTEN_TEXT = REWRITTEN_BASE.padEnd(
  FULL_TEXT.length,
  " nowadays",
).slice(0, FULL_TEXT.length);
const STUB_TEXT = SENTENCES.slice(0, 8).join(" ");

const PAYWALL_MARKUP = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "How resoling works",
  isAccessibleForFree: false,
  hasPart: {
    "@type": "WebPageElement",
    isAccessibleForFree: false,
    cssSelector: ".paywalled-body",
  },
};

function page(
  text: string,
  options: { jsonLd?: object; selectorClass?: string } = {},
): string {
  const script = options.jsonLd
    ? `<script type="application/ld+json">${JSON.stringify(options.jsonLd)}</script>`
    : "";
  const cls = options.selectorClass ?? "";
  return `<html><head>${script}</head><body><main><article ${cls ? `class="${cls}"` : ""}><p>${text}</p></article></main></body></html>`;
}

function run(
  options: { browser?: string; bot?: string; sitemap?: boolean } = {},
) {
  const audit = new BotContentDeltaDeclaredAudit();
  const ctx = mockCheckContext([
    mockPageContext("https://example.com/", page(FULL_TEXT)),
  ]);
  const xml = `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://example.com/blog/resoling</loc></url></urlset>`;

  ctx.fetch = async (o: FetchOptions): Promise<FetchResult> => {
    if (new URL(o.url).pathname === "/sitemap.xml") {
      return options.sitemap === false
        ? mockFetchResult("", 404)
        : mockFetchResult(xml, 200, "application/xml");
    }
    const body =
      o.userAgent === BASELINE_UA
        ? (options.browser ?? page(FULL_TEXT))
        : (options.bot ?? options.browser ?? page(FULL_TEXT));
    return mockFetchResult(body, 200, "text/html");
  };
  return audit.audit(ctx);
}

describe("BotContentDeltaDeclaredAudit", () => {
  const audit = new BotContentDeltaDeclaredAudit();

  it("is notApplicable on an empty site", async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it("is notApplicable when no content URL can be sampled", async () => {
    expect((await run({ sitemap: false })).status).toBe("na");
  });

  it("passes when the crawler and the browser get the same text", async () => {
    expect((await run()).status).toBe("pass");
  });

  // Serving a crawler less than a user is sanctioned only when it is declared.
  it("fails when the crawler gets a fraction of the text and nothing declares it", async () => {
    const result = await run({
      browser: page(FULL_TEXT),
      bot: page(STUB_TEXT),
    });
    expect(result.status).toBe("fail");
    expect(result.message).toContain("isAccessibleForFree");
  });

  // Length alone cannot tell a stub from a rewritten page, which is why the
  // second metric is here.
  it("fails on a shingle mismatch at an equal character count", async () => {
    const result = await run({
      browser: page(FULL_TEXT),
      bot: page(REWRITTEN_TEXT),
    });
    expect(result.status).toBe("fail");
    expect(result.message).toContain("shingle");
  });

  it("passes a declared delta whose cssSelector resolves in the served DOM", async () => {
    const result = await run({
      browser: page(FULL_TEXT, {
        jsonLd: PAYWALL_MARKUP,
        selectorClass: "paywalled-body",
      }),
      bot: page(STUB_TEXT, {
        jsonLd: PAYWALL_MARKUP,
        selectorClass: "paywalled-body",
      }),
    });
    expect(result.status).toBe("pass");
  });

  // The markup is present, and it points at nothing — the failure mode most
  // implementations land in.
  it("fails a declared delta whose cssSelector matches zero elements", async () => {
    const result = await run({
      browser: page(FULL_TEXT, { jsonLd: PAYWALL_MARKUP }),
      bot: page(STUB_TEXT, { jsonLd: PAYWALL_MARKUP }),
    });
    expect(result.status).toBe("fail");
    expect(result.message).toContain(".paywalled-body");
    expect(result.message).toContain("no-op");
  });

  it("reports a bot-only variant that is materially longer than the browser page", async () => {
    const longer = page(`${FULL_TEXT} ${FULL_TEXT}`);
    const result = await run({ browser: page(FULL_TEXT), bot: longer });
    expect(result.status).toBe("fail");
    expect(result.message).toContain("longer");
  });

  it("reports the crawler, the URL and both metrics", async () => {
    const result = await run({
      browser: page(FULL_TEXT),
      bot: page(STUB_TEXT),
    });
    expect(result.message).toContain("GPTBot");
    expect(result.message).toContain("https://example.com/blog/resoling");
    expect(result.found).toMatch(/\d+ URL\(s\)/);
  });
});
