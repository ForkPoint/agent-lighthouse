import { describe, it, expect, vi } from "vitest";
import { BotContentDeltaDeclaredAudit } from "./bot-content-delta-declared";
import {
  mockPageContext,
  mockCheckContext,
  mockFetchResult,
} from "#core/__tests__/test-utils";
import { expectNotApplicableOnEmpty } from "#core/tests/na-contract";
import { BASELINE_UA, CONTROL_UA } from "#core/gatherers/ua-parity";
import type { FetchOptions, FetchResult } from "#core/fetcher";
import { CheckStatus } from "#core/types";

vi.mock("#core/fetcher", async (importOriginal) => {
  const actual = await importOriginal<typeof import("#core/fetcher")>();
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
  options: {
    browser?: string;
    bot?: string;
    sitemap?: boolean;
    /** HTTP status every crawler probe receives. */
    botStatus?: number;
    /** Sitemap URLs; one blog post by default. */
    urls?: string[];
    /** Body the unrecognised control bot gets. Defaults to the browser body. */
    control?: string;
    /** Collects every User-Agent the audit sends. */
    seen?: string[];
  } = {},
) {
  const audit = new BotContentDeltaDeclaredAudit();
  const ctx = mockCheckContext([
    mockPageContext("https://example.com/", page(FULL_TEXT)),
  ]);
  const locs = options.urls ?? ["https://example.com/blog/resoling"];
  const xml = `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${locs.map((loc) => `<url><loc>${loc}</loc></url>`).join("")}</urlset>`;

  ctx.fetch = async (o: FetchOptions): Promise<FetchResult> => {
    if (new URL(o.url).pathname === "/sitemap.xml") {
      return options.sitemap === false
        ? mockFetchResult("", 404)
        : mockFetchResult(xml, 200, "application/xml");
    }
    options.seen?.push(o.userAgent ?? "");
    if (o.userAgent === CONTROL_UA) {
      return mockFetchResult(
        options.control ?? options.browser ?? page(FULL_TEXT),
        200,
        "text/html",
      );
    }
    const isBrowser = o.userAgent === BASELINE_UA;
    const body = isBrowser
      ? (options.browser ?? page(FULL_TEXT))
      : (options.bot ?? options.browser ?? page(FULL_TEXT));
    return mockFetchResult(
      body,
      isBrowser ? 200 : (options.botStatus ?? 200),
      "text/html",
    );
  };
  return audit.audit(ctx);
}

describe("BotContentDeltaDeclaredAudit", () => {
  const audit = new BotContentDeltaDeclaredAudit();

  it("is notApplicable on an empty site", async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it("is notApplicable when no content URL can be sampled", async () => {
    expect((await run({ sitemap: false })).status).toBe(
      CheckStatus.NotApplicable,
    );
  });

  it("passes when the crawler and the browser get the same text", async () => {
    const result = await run();
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.message).toMatch(
      /^All \d+ crawler-UA probe\(s\) received the same main content a browser received\.$/,
    );
  });

  // Serving a crawler less than a user is sanctioned only when it is declared.
  it("fails when the crawler gets a fraction of the text and nothing declares it", async () => {
    const result = await run({
      browser: page(FULL_TEXT),
      bot: page(STUB_TEXT),
    });
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("isAccessibleForFree");
    expect(result.message).toMatch(
      /^A request naming \S+ gets different content at /,
    );
  });

  // Length alone cannot tell a stub from a rewritten page, which is why the
  // second metric is here.
  it("fails on a shingle mismatch at an equal character count", async () => {
    const result = await run({
      browser: page(FULL_TEXT),
      bot: page(REWRITTEN_TEXT),
    });
    expect(result.status).toBe(CheckStatus.Fail);
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
    expect(result.status).toBe(CheckStatus.Pass);
  });

  // The markup is present, and it points at nothing — the failure mode most
  // implementations land in.
  it("fails a declared delta whose cssSelector matches zero elements", async () => {
    const result = await run({
      browser: page(FULL_TEXT, { jsonLd: PAYWALL_MARKUP }),
      bot: page(STUB_TEXT, { jsonLd: PAYWALL_MARKUP }),
    });
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain(".paywalled-body");
    expect(result.message).toContain("no-op");
  });

  it("reports a bot-only variant that is materially longer than the browser page", async () => {
    const longer = page(`${FULL_TEXT} ${FULL_TEXT}`);
    const result = await run({ browser: page(FULL_TEXT), bot: longer });
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("longer");
    expect(result.message).toMatch(
      /^A request naming \S+ receives a longer page than the browser at /,
    );
  });

  it("reads a declaration in any of the shapes schema.org allows", async () => {
    const markup = {
      "@context": "https://schema.org",
      "@type": ["Thing", "NewsArticle"],
      isAccessibleForFree: "False",
      hasPart: [
        "not a node",
        { "@type": "WebPageElement", isAccessibleForFree: true },
        { "@type": "WebPageElement", isAccessibleForFree: false },
        {
          "@type": ["WebPageElement"],
          isAccessibleForFree: "false",
          cssSelector: " .paywalled-body ",
        },
      ],
    };
    const result = await run({
      browser: page(FULL_TEXT, {
        jsonLd: markup,
        selectorClass: "paywalled-body",
      }),
      bot: page(STUB_TEXT),
    });
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.message).toContain("declared with restricted-content markup");
  });

  // Only the complete declaration differentiates a paywall from cloaking.
  it("does not accept partial or misplaced restricted-content markup", async () => {
    const partials: object[] = [
      // The work says it is free.
      { ...PAYWALL_MARKUP, isAccessibleForFree: true },
      // Not a CreativeWork Google's markup accepts.
      { ...PAYWALL_MARKUP, "@type": "Product" },
      // No @type at all.
      { isAccessibleForFree: false, hasPart: PAYWALL_MARKUP.hasPart },
      // A part that is not a WebPageElement.
      {
        ...PAYWALL_MARKUP,
        hasPart: { ...PAYWALL_MARKUP.hasPart, "@type": "WPHeader" },
      },
      // A part with no selector.
      {
        ...PAYWALL_MARKUP,
        hasPart: { "@type": "WebPageElement", isAccessibleForFree: false },
      },
    ];
    for (const jsonLd of partials) {
      const result = await run({
        browser: page(FULL_TEXT, { jsonLd, selectorClass: "paywalled-body" }),
        bot: page(STUB_TEXT),
      });
      expect(result.status).toBe(CheckStatus.Fail);
      expect(result.message).toContain("nothing declares it");
    }
  });

  it("treats an unparseable cssSelector as matching nothing", async () => {
    const markup = {
      ...PAYWALL_MARKUP,
      hasPart: { ...PAYWALL_MARKUP.hasPart, cssSelector: "div[" },
    };
    const result = await run({
      browser: page(FULL_TEXT, { jsonLd: markup }),
      bot: page(STUB_TEXT),
    });
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain(`"div["`);
    expect(result.message).toContain("no-op");
  });

  // A refused crawler never got a page; ai-crawler-edge-parity reports that.
  it("is notApplicable when every crawler probe is refused", async () => {
    const result = await run({ botStatus: 403 });
    expect(result.status).toBe(CheckStatus.NotApplicable);
    expect(result.found).toContain("none comparable");
  });

  it("compares texts too short to shingle word by word", async () => {
    const same = await run({ browser: page("Opening hours today") });
    expect(same.status).toBe(CheckStatus.Pass);
    const changed = await run({
      browser: page("Opening hours today"),
      bot: page("Closed for bots"),
    });
    expect(changed.status).toBe(CheckStatus.Fail);
  });

  it("summarises findings past the first four", async () => {
    const result = await run({
      urls: [
        "https://example.com/blog/a",
        "https://example.com/blog/b",
        "https://example.com/blog/c",
      ],
      browser: page(FULL_TEXT),
      bot: page(STUB_TEXT),
    });
    expect(result.status).toBe(CheckStatus.Fail);
    // Three URLs times three crawlers: nine findings, four shown.
    expect(result.message).toContain("(5 more)");
  });

  // The control bot is the only way to tell a page keyed on the crawler's name
  // from bot management aimed at every unidentified client.
  it("warns, not fails, when the unrecognised control bot gets the same stub", async () => {
    const result = await run({
      browser: page(FULL_TEXT),
      bot: page(STUB_TEXT),
      control: page(STUB_TEXT),
    });
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.message).toBe(
      "The unrecognised control User-Agent got the same reduced page (at least 80% of its length, shingle similarity at least 0.70) as requests naming GPTBot at https://example.com/blog/resoling (20% of the browser text, shingle similarity 0.21); ClaudeBot at https://example.com/blog/resoling (20% of the browser text, shingle similarity 0.21); PerplexityBot at https://example.com/blog/resoling (20% of the browser text, shingle similarity 0.21). That is bot management aimed at unidentified clients, not a page keyed on the crawler's name, and the real crawler, verified by IP range or signature, may be served the full page. Confirm against the edge logs how the published crawler addresses are served before treating it as cloaking.",
    );
    expect(result.found).toContain(
      "3 delta(s) the unrecognised control User-Agent got too",
    );
  });

  // The control arm counts only when it got the crawler's reduced page, not
  // some other reduction such as a challenge or an empty shell.
  it("still fails when the control bot gets a different reduced page", async () => {
    const result = await run({
      browser: page(FULL_TEXT),
      bot: page(STUB_TEXT),
      control: page(
        "Access to this page has been restricted for automated clients. Please enable JavaScript and cookies to continue browsing.",
      ),
    });
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toMatch(
      /^A request naming GPTBot gets different content at .+ and nothing declares it/,
    );
    expect(result.message).not.toContain("control User-Agent");
  });

  it("still fails when the control bot gets an empty shell", async () => {
    const result = await run({
      browser: page(FULL_TEXT),
      bot: page(STUB_TEXT),
      control: '<html><body><div id="root"></div></body></html>',
    });
    expect(result.status).toBe(CheckStatus.Fail);
  });

  // A declared selector that matches nothing is a finding about the markup,
  // whoever got the reduced page.
  it("fails a no-op declaration even when the control bot shares the stub", async () => {
    const result = await run({
      browser: page(FULL_TEXT, { jsonLd: PAYWALL_MARKUP }),
      bot: page(STUB_TEXT),
      control: page(STUB_TEXT),
    });
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain(
      'the declared cssSelector ".paywalled-body" matches zero elements in the served DOM',
    );
  });

  // A bot-manager script on the normal page is not a challenge, so the stub
  // is compared.
  it("compares a stub when both pages carry the same bot-manager script", async () => {
    const akam = '<script src="/akam/13/7e3f1a"></script>';
    const result = await run({
      browser: page(FULL_TEXT).replace("</body>", `${akam}</body>`),
      bot: page(STUB_TEXT).replace("</body>", `${akam}</body>`),
    });
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toMatch(
      /^A request naming GPTBot gets different content/,
    );
  });

  it("still fails a stub the control bot does not get", async () => {
    const result = await run({
      browser: page(FULL_TEXT),
      bot: page(STUB_TEXT),
      control: page(FULL_TEXT),
    });
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toBe(
      "A request naming GPTBot gets different content at https://example.com/blog/resoling (20% of the browser text, shingle similarity 0.21) and nothing declares it: the browser response carries no CreativeWork with isAccessibleForFree:false and a hasPart WebPageElement cssSelector; A request naming ClaudeBot gets different content at https://example.com/blog/resoling (20% of the browser text, shingle similarity 0.21) and nothing declares it: the browser response carries no CreativeWork with isAccessibleForFree:false and a hasPart WebPageElement cssSelector; A request naming PerplexityBot gets different content at https://example.com/blog/resoling (20% of the browser text, shingle similarity 0.21) and nothing declares it: the browser response carries no CreativeWork with isAccessibleForFree:false and a hasPart WebPageElement cssSelector.",
    );
  });

  // A thin 200 carrying a challenge is a refusal, which edge parity reports.
  it("does not compare a thin 200 that is a challenge page", async () => {
    const result = await run({
      browser: page(FULL_TEXT),
      bot: "<html><head><title>Just a moment...</title></head><body><main><p>Checking.</p></main></body></html>",
    });
    expect(result.status).toBe(CheckStatus.NotApplicable);
  });

  // No delta, no control request.
  it("sends no control request when every probe matches the browser", async () => {
    const seen: string[] = [];
    await run({ seen });
    expect(seen).not.toContain(CONTROL_UA);
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
