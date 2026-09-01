import { describe, it, expect } from "vitest";
import {
  buildScanEvidence,
  allEvidenceMet,
  scanReadTheSite,
  unreadSiteReason,
} from "./scan-evidence";
import { mockPageContext, mockFetchResult } from "./__tests__/test-utils";
import type { FetchResult } from "./fetcher";
import type { PageContext } from "./check-context";

/** A homepage fetch result, overridable field by field. */
function homepage(overrides: Partial<FetchResult> = {}): FetchResult {
  const result = mockFetchResult(
    "<html><body>ok</body></html>",
    200,
    "text/html; charset=utf-8",
  );
  result.url = "https://example.com/";
  result.finalUrl = "https://example.com/";
  return { ...result, ...overrides };
}

function build(input: {
  requestedUrl?: string;
  homepageResult?: FetchResult;
  pages?: PageContext[];
  rootFiles?: Record<string, FetchResult>;
  wafProtection?: Parameters<typeof buildScanEvidence>[0]["wafProtection"];
}) {
  return buildScanEvidence({
    requestedUrl: input.requestedUrl ?? "https://example.com",
    homepageResult: input.homepageResult ?? homepage(),
    pages: input.pages ?? [],
    rootFiles: input.rootFiles ?? {},
    wafProtection: input.wafProtection ?? null,
  });
}

/** A page whose served body carries `words` readable words. */
function wordyPage(url: string, words: number): PageContext {
  const text = Array.from({ length: words }, (_, i) => `word${i}`).join(" ");
  return mockPageContext(url, `<html><body><main>${text}</main></body></html>`);
}

describe("scan-evidence: origin-reachable", () => {
  it("is met for a 200 HTML response on the requested host", () => {
    const evidence = build({});
    expect(evidence.met["origin-reachable"]).toBe(true);
    expect(evidence.reasons["origin-reachable"]).toBeUndefined();
  });

  it("is met when the host only gained or lost a www. prefix", () => {
    const evidence = build({
      requestedUrl: "https://example.com",
      homepageResult: homepage({ finalUrl: "https://www.example.com/" }),
    });
    expect(evidence.met["origin-reachable"]).toBe(true);
  });

  it("is met when http was upgraded to https", () => {
    const evidence = build({
      requestedUrl: "http://example.com",
      homepageResult: homepage({
        url: "http://example.com/",
        finalUrl: "https://example.com/",
      }),
    });
    expect(evidence.met["origin-reachable"]).toBe(true);
  });

  it("is unmet on a non-2xx status", () => {
    const evidence = build({ homepageResult: homepage({ status: 403 }) });
    expect(evidence.met["origin-reachable"]).toBe(false);
    expect(evidence.reasons["origin-reachable"]).toContain("403");
  });

  it("is unmet when the fetch itself failed", () => {
    const evidence = build({
      homepageResult: homepage({
        status: 0,
        error: "ENOTFOUND",
        body: "",
        contentType: "",
      }),
    });
    expect(evidence.met["origin-reachable"]).toBe(false);
    expect(evidence.reasons["origin-reachable"]).toContain("ENOTFOUND");
  });

  it("is unmet when the origin serves something other than HTML", () => {
    const evidence = build({
      homepageResult: homepage({ contentType: "application/pdf" }),
    });
    expect(evidence.met["origin-reachable"]).toBe(false);
    expect(evidence.reasons["origin-reachable"]).toContain("application/pdf");
  });

  it("accepts application/xhtml+xml as HTML", () => {
    const evidence = build({
      homepageResult: homepage({ contentType: "application/xhtml+xml" }),
    });
    expect(evidence.met["origin-reachable"]).toBe(true);
  });

  it("is met for a cross-host 301: a permanent move is still the site", () => {
    const evidence = build({
      requestedUrl: "https://old-brand.com",
      homepageResult: homepage({
        url: "https://old-brand.com/",
        finalUrl: "https://new-brand.com/",
        redirectChain: [
          {
            status: 301,
            from: "https://old-brand.com/",
            to: "https://new-brand.com/",
          },
        ],
      }),
    });
    expect(evidence.met["origin-reachable"]).toBe(true);
  });

  it("is met for a cross-host 308", () => {
    const evidence = build({
      requestedUrl: "https://old-brand.com",
      homepageResult: homepage({
        url: "https://old-brand.com/",
        finalUrl: "https://new-brand.com/",
        redirectChain: [
          {
            status: 308,
            from: "https://old-brand.com/",
            to: "https://new-brand.com/",
          },
        ],
      }),
    });
    expect(evidence.met["origin-reachable"]).toBe(true);
  });

  it("is met for a 302 that stays inside the registrable domain (a geo router)", () => {
    const evidence = build({
      requestedUrl: "https://site.com",
      homepageResult: homepage({
        url: "https://site.com/",
        finalUrl: "https://us.site.com/",
        redirectChain: [
          {
            status: 302,
            from: "https://site.com/",
            to: "https://us.site.com/",
          },
        ],
      }),
    });
    expect(evidence.met["origin-reachable"]).toBe(true);
  });

  it("is met for a 302 inside a multi-label registrable domain", () => {
    const evidence = build({
      requestedUrl: "https://shop.co.uk",
      homepageResult: homepage({
        url: "https://shop.co.uk/",
        finalUrl: "https://eu.shop.co.uk/",
        redirectChain: [
          {
            status: 302,
            from: "https://shop.co.uk/",
            to: "https://eu.shop.co.uk/",
          },
        ],
      }),
    });
    expect(evidence.met["origin-reachable"]).toBe(true);
  });

  it("is met for a geo 302 to the same name under a country suffix", () => {
    // zalando.com answers 302 to www.zalando.bg on every request from Bulgaria.
    const evidence = build({
      requestedUrl: "https://zalando.com",
      homepageResult: homepage({
        url: "https://zalando.com/",
        finalUrl: "https://www.zalando.bg/",
        redirectChain: [
          {
            status: 302,
            from: "https://zalando.com/",
            to: "https://www.zalando.bg/",
          },
        ],
      }),
    });
    expect(evidence.met["origin-reachable"]).toBe(true);
  });

  it("is unmet for a 302 to a different registrable domain", () => {
    const evidence = build({
      requestedUrl: "https://site.com",
      homepageResult: homepage({
        url: "https://site.com/",
        finalUrl: "https://parking-service.net/",
        redirectChain: [
          {
            status: 302,
            from: "https://site.com/",
            to: "https://parking-service.net/",
          },
        ],
      }),
    });
    expect(evidence.met["origin-reachable"]).toBe(false);
    expect(evidence.reasons["origin-reachable"]).toContain(
      "parking-service.net",
    );
  });

  it("is unmet for a cross-domain hop of unknown kind when no chain was recorded", () => {
    const evidence = build({
      requestedUrl: "https://site.com",
      homepageResult: homepage({
        url: "https://site.com/",
        finalUrl: "https://other.net/",
      }),
    });
    expect(evidence.met["origin-reachable"]).toBe(false);
  });
});

describe("scan-evidence: unblocked-fetches", () => {
  it("is met when no WAF answered and the homepage was not throttled", () => {
    expect(build({}).met["unblocked-fetches"]).toBe(true);
  });

  it("is unmet when a WAF blocked the scan, and names the provider", () => {
    const evidence = build({
      wafProtection: {
        isBlocked: true,
        provider: "cloudflare",
        name: "Cloudflare",
        reason: "HTTP 403 with cf-ray",
        statusCode: 403,
      },
    });
    expect(evidence.met["unblocked-fetches"]).toBe(false);
    expect(evidence.reasons["unblocked-fetches"]).toContain("Cloudflare");
  });

  it("keeps a self-inflicted throttle apart from a refusal", () => {
    const evidence = build({
      wafProtection: {
        isBlocked: true,
        provider: "rate-limited",
        name: "Rate limit",
        reason: "HTTP 429",
        statusCode: 429,
        isRateLimit: true,
      },
    });
    expect(evidence.met["unblocked-fetches"]).toBe(false);
    expect(evidence.reasons["unblocked-fetches"]).toMatch(/throttl/i);
  });

  it("is unmet on a homepage 429 even when no WAF was identified", () => {
    const evidence = build({ homepageResult: homepage({ status: 429 }) });
    expect(evidence.met["unblocked-fetches"]).toBe(false);
    expect(evidence.reasons["unblocked-fetches"]).toMatch(/throttl/i);
  });

  it("stays met when a WAF was detected but did not block", () => {
    const evidence = build({
      wafProtection: {
        isBlocked: false,
        provider: "cloudflare",
        name: "Cloudflare",
        reason: "cf-ray header present",
      },
    });
    expect(evidence.met["unblocked-fetches"]).toBe(true);
  });
});

describe("scan-evidence: rendered-body", () => {
  it("counts a page over the word threshold as rendered", () => {
    const evidence = build({ pages: [wordyPage("https://example.com/", 60)] });
    expect(evidence.renderedByPage["https://example.com/"]).toBe(true);
    expect(evidence.met["rendered-body"]).toBe(true);
  });

  it("counts a short page as not rendered", () => {
    const evidence = build({ pages: [wordyPage("https://example.com/", 10)] });
    expect(evidence.renderedByPage["https://example.com/"]).toBe(false);
    expect(evidence.met["rendered-body"]).toBe(false);
    expect(evidence.reasons["rendered-body"]).toBeDefined();
  });

  it("reads the whole served body, not the first <main>", () => {
    const text = Array.from({ length: 80 }, (_, i) => `word${i}`).join(" ");
    const page = mockPageContext(
      "https://example.com/",
      `<html><body><main></main><div id="app">${text}</div></body></html>`,
    );
    expect(
      build({ pages: [page] }).renderedByPage["https://example.com/"],
    ).toBe(true);
  });

  it("counts a CJK page by characters: the || branch is load-bearing", () => {
    // Six whitespace-delimited words, 400 characters. The word branch fails,
    // the character branch carries it.
    const cjk = Array.from({ length: 6 }, () => "漢".repeat(66)).join(" ");
    const page = mockPageContext(
      "https://example.com/",
      `<html><body><p>${cjk}</p></body></html>`,
    );
    const evidence = build({ pages: [page] });
    expect(evidence.renderedByPage["https://example.com/"]).toBe(true);
    expect(evidence.met["rendered-body"]).toBe(true);
  });

  it("is unmet when the scan fetched no pages at all", () => {
    const evidence = build({ pages: [] });
    expect(evidence.met["rendered-body"]).toBe(false);
  });

  it("is met when any one fetched page carries readable text", () => {
    const evidence = build({
      pages: [
        wordyPage("https://example.com/", 5),
        wordyPage("https://example.com/about", 80),
      ],
    });
    expect(evidence.met["rendered-body"]).toBe(true);
    expect(evidence.renderedByPage["https://example.com/"]).toBe(false);
    expect(evidence.renderedByPage["https://example.com/about"]).toBe(true);
  });
});

describe("scan-evidence: sample-adequate", () => {
  it("collects the page types of pages that actually rendered", () => {
    const evidence = build({
      pages: [
        wordyPage("https://example.com/", 80),
        wordyPage("https://example.com/blog/post", 80),
      ],
    });
    expect(evidence.met["sample-adequate"]).toBe(true);
    expect(evidence.usablePageTypes.has("homepage")).toBe(true);
  });

  it("drops the page type of a page that fetched but rendered nothing", () => {
    const evidence = build({ pages: [wordyPage("https://example.com/", 3)] });
    expect(evidence.met["sample-adequate"]).toBe(false);
    expect(evidence.usablePageTypes.size).toBe(0);
    expect(evidence.reasons["sample-adequate"]).toBeDefined();
  });
});

describe("scan-evidence: judgeable", () => {
  it("is true when the origin answered and nothing blocked the scan", () => {
    expect(
      build({ pages: [wordyPage("https://example.com/", 80)] }).judgeable,
    ).toBe(true);
  });

  it("survives a shell site: what it serves is a finding, not a blind spot", () => {
    const evidence = build({ pages: [wordyPage("https://example.com/", 2)] });
    expect(evidence.met["rendered-body"]).toBe(false);
    expect(evidence.judgeable).toBe(true);
  });

  it("is false when the origin was unreachable", () => {
    expect(build({ homepageResult: homepage({ status: 500 }) }).judgeable).toBe(
      false,
    );
  });

  it("is false when the scan was blocked", () => {
    const evidence = build({
      wafProtection: {
        isBlocked: true,
        provider: "datadome",
        name: "DataDome",
        reason: "HTTP 403",
      },
    });
    expect(evidence.judgeable).toBe(false);
  });
});

describe("allEvidenceMet", () => {
  it("meets every requirement, carries no reasons and is judgeable", () => {
    const evidence = allEvidenceMet();
    expect(Object.values(evidence.met).every(Boolean)).toBe(true);
    expect(Object.keys(evidence.reasons)).toHaveLength(0);
    expect(evidence.judgeable).toBe(true);
  });

  it("treats every page type as usable, so a harness never self-gates", () => {
    const evidence = allEvidenceMet();
    for (const type of [
      "homepage",
      "category",
      "product",
      "content",
    ] as const) {
      expect(evidence.usablePageTypes.has(type)).toBe(true);
    }
  });
});

describe("scanReadTheSite", () => {
  // The guard 36 audits consult. It used to read `origin-reachable` alone,
  // which a bot wall satisfies whenever the wall answers 200.
  it("is false when the origin answered but the scan was refused", () => {
    const evidence = build({
      homepageResult: homepage({
        status: 200,
        contentType: "text/html",
        headers: { "cf-mitigated": "challenge", server: "cloudflare" },
      }),
      wafProtection: {
        isBlocked: true,
        provider: "cloudflare",
        name: "Cloudflare Turnstile / Managed Challenge",
        reason: "Cloudflare bot challenge detected",
        statusCode: 200,
      },
    });

    expect(evidence.met["origin-reachable"], "a 200 from the right host").toBe(
      true,
    );
    expect(evidence.met["unblocked-fetches"]).toBe(false);
    expect(scanReadTheSite(evidence)).toBe(false);
    // The reason has to name the wall, not fall through to the generic line:
    // `origin-reachable` is met, so it carries no reason of its own.
    expect(unreadSiteReason(evidence)).toContain("Cloudflare");
  });

  it("is true when the origin answered and nothing refused the scan", () => {
    const evidence = build({});
    expect(scanReadTheSite(evidence)).toBe(true);
  });

  it("is false when the response cannot be attributed to the requested site", () => {
    const evidence = build({
      requestedUrl: "https://example.com",
      homepageResult: homepage({
        finalUrl: "https://parking.brandsale.test/example.com",
        redirectChain: [
          {
            status: 302,
            from: "https://example.com/",
            to: "https://parking.brandsale.test/example.com",
          },
        ],
      }),
    });
    expect(scanReadTheSite(evidence)).toBe(false);
    expect(unreadSiteReason(evidence)).toContain("different site");
  });
});
