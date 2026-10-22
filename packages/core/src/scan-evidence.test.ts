import { describe, it, expect } from "vitest";
import {
  buildScanEvidence,
  allEvidenceMet,
  scanReadTheSite,
  unreadSiteReason,
  unjudgeableReason,
} from "./scan-evidence";
import { mockPageContext, mockFetchResult } from "./__tests__/test-utils";
import type { FetchResult } from "./fetcher";
import type { PageContext } from "./check-context";
import { detectWafProtection, WafProvider } from "./waf-detector";
import { MAX_REDIRECTS } from "./fetcher";
import { FETCHER_REDIRECT_LIMIT } from "./scan-evidence";
import { EvidenceKey, PageType } from "./types";

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
    expect(evidence.met[EvidenceKey.OriginReachable]).toBe(true);
    expect(evidence.reasons[EvidenceKey.OriginReachable]).toBeUndefined();
  });

  it("is met when the host only gained or lost a www. prefix", () => {
    const evidence = build({
      requestedUrl: "https://example.com",
      homepageResult: homepage({ finalUrl: "https://www.example.com/" }),
    });
    expect(evidence.met[EvidenceKey.OriginReachable]).toBe(true);
  });

  it("is met when http was upgraded to https", () => {
    const evidence = build({
      requestedUrl: "http://example.com",
      homepageResult: homepage({
        url: "http://example.com/",
        finalUrl: "https://example.com/",
      }),
    });
    expect(evidence.met[EvidenceKey.OriginReachable]).toBe(true);
  });

  it("is unmet on a non-2xx status", () => {
    const evidence = build({ homepageResult: homepage({ status: 403 }) });
    expect(evidence.met[EvidenceKey.OriginReachable]).toBe(false);
    expect(evidence.reasons[EvidenceKey.OriginReachable]).toContain("403");
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
    expect(evidence.met[EvidenceKey.OriginReachable]).toBe(false);
    expect(evidence.reasons[EvidenceKey.OriginReachable]).toContain(
      "ENOTFOUND",
    );
  });

  it("is unmet when the origin serves something other than HTML", () => {
    const evidence = build({
      homepageResult: homepage({ contentType: "application/pdf" }),
    });
    expect(evidence.met[EvidenceKey.OriginReachable]).toBe(false);
    expect(evidence.reasons[EvidenceKey.OriginReachable]).toContain(
      "application/pdf",
    );
  });

  it("accepts application/xhtml+xml as HTML", () => {
    const evidence = build({
      homepageResult: homepage({ contentType: "application/xhtml+xml" }),
    });
    expect(evidence.met[EvidenceKey.OriginReachable]).toBe(true);
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
    expect(evidence.met[EvidenceKey.OriginReachable]).toBe(true);
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
    expect(evidence.met[EvidenceKey.OriginReachable]).toBe(true);
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
    expect(evidence.met[EvidenceKey.OriginReachable]).toBe(true);
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
    expect(evidence.met[EvidenceKey.OriginReachable]).toBe(true);
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
    expect(evidence.met[EvidenceKey.OriginReachable]).toBe(true);
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
    expect(evidence.met[EvidenceKey.OriginReachable]).toBe(false);
    expect(evidence.reasons[EvidenceKey.OriginReachable]).toContain(
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
    expect(evidence.met[EvidenceKey.OriginReachable]).toBe(false);
  });
});

describe("scan-evidence: unblocked-fetches", () => {
  it("is met when no WAF answered and the homepage was not throttled", () => {
    expect(build({}).met[EvidenceKey.UnblockedFetches]).toBe(true);
  });

  it("is unmet when a WAF blocked the scan, and names the provider", () => {
    const evidence = build({
      wafProtection: {
        isBlocked: true,
        provider: WafProvider.Cloudflare,
        name: "Cloudflare",
        reason: "HTTP 403 with cf-ray",
        statusCode: 403,
      },
    });
    expect(evidence.met[EvidenceKey.UnblockedFetches]).toBe(false);
    expect(evidence.reasons[EvidenceKey.UnblockedFetches]).toContain(
      "Cloudflare",
    );
  });

  it("keeps a self-inflicted throttle apart from a refusal", () => {
    const evidence = build({
      wafProtection: {
        isBlocked: true,
        provider: WafProvider.RateLimited,
        name: "Rate limit",
        reason: "HTTP 429",
        statusCode: 429,
        isRateLimit: true,
      },
    });
    expect(evidence.met[EvidenceKey.UnblockedFetches]).toBe(false);
    expect(evidence.reasons[EvidenceKey.UnblockedFetches]).toMatch(/throttl/i);
  });

  it("is unmet on a homepage 429 even when no WAF was identified", () => {
    const evidence = build({ homepageResult: homepage({ status: 429 }) });
    expect(evidence.met[EvidenceKey.UnblockedFetches]).toBe(false);
    expect(evidence.reasons[EvidenceKey.UnblockedFetches]).toMatch(/throttl/i);
  });

  it("stays met when a WAF was detected but did not block", () => {
    const evidence = build({
      wafProtection: {
        isBlocked: false,
        provider: WafProvider.Cloudflare,
        name: "Cloudflare",
        reason: "cf-ray header present",
      },
    });
    expect(evidence.met[EvidenceKey.UnblockedFetches]).toBe(true);
  });
});

describe("scan-evidence: rendered-body", () => {
  it("counts a page over the word threshold as rendered", () => {
    const evidence = build({ pages: [wordyPage("https://example.com/", 60)] });
    expect(evidence.renderedByPage["https://example.com/"]).toBe(true);
    expect(evidence.met[EvidenceKey.RenderedBody]).toBe(true);
  });

  it("counts a short page as not rendered", () => {
    const evidence = build({ pages: [wordyPage("https://example.com/", 10)] });
    expect(evidence.renderedByPage["https://example.com/"]).toBe(false);
    expect(evidence.met[EvidenceKey.RenderedBody]).toBe(false);
    expect(evidence.reasons[EvidenceKey.RenderedBody]).toBeDefined();
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
    expect(evidence.met[EvidenceKey.RenderedBody]).toBe(true);
  });

  it("is unmet when the scan fetched no pages at all", () => {
    const evidence = build({ pages: [] });
    expect(evidence.met[EvidenceKey.RenderedBody]).toBe(false);
  });

  it("is met when any one fetched page carries readable text", () => {
    const evidence = build({
      pages: [
        wordyPage("https://example.com/", 5),
        wordyPage("https://example.com/about", 80),
      ],
    });
    expect(evidence.met[EvidenceKey.RenderedBody]).toBe(true);
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
    expect(evidence.met[EvidenceKey.SampleAdequate]).toBe(true);
    expect(evidence.usablePageTypes.has(PageType.Homepage)).toBe(true);
  });

  it("drops the page type of a page that fetched but rendered nothing", () => {
    const evidence = build({ pages: [wordyPage("https://example.com/", 3)] });
    expect(evidence.met[EvidenceKey.SampleAdequate]).toBe(false);
    expect(evidence.usablePageTypes.size).toBe(0);
    expect(evidence.reasons[EvidenceKey.SampleAdequate]).toBeDefined();
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
    expect(evidence.met[EvidenceKey.RenderedBody]).toBe(false);
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
        provider: WafProvider.Datadome,
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
      PageType.Homepage,
      PageType.Category,
      PageType.Product,
      PageType.General,
    ]) {
      expect(evidence.usablePageTypes.has(type)).toBe(true);
    }
  });
});

describe("scanReadTheSite", () => {
  it("keeps a readable storefront with form Turnstile available to audits", () => {
    const page = mockPageContext(
      "https://www.shop.test/",
      '<html><head><script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"></script></head>' +
        `<body><main>${"Browse clothing and accessories in our shop. ".repeat(20)}</main>` +
        '<form action="/newsletter"><input name="email"></form></body></html>',
    );
    const response = homepage({
      ...page.fetchResult,
      url: "https://shop.test/",
      finalUrl: page.url,
      headers: { server: "cloudflare", "cf-ray": "abc" },
    });
    const evidence = build({
      requestedUrl: response.url,
      homepageResult: response,
      pages: [page],
      wafProtection: detectWafProtection(response.url, response, {}, 1),
    });

    expect(evidence.met[EvidenceKey.UnblockedFetches]).toBe(true);
    expect(evidence.met[EvidenceKey.RenderedBody]).toBe(true);
    expect(scanReadTheSite(evidence)).toBe(true);
  });

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
        provider: WafProvider.Cloudflare,
        name: "Cloudflare Turnstile / Managed Challenge",
        reason: "Cloudflare bot challenge detected",
        statusCode: 200,
      },
    });

    expect(
      evidence.met[EvidenceKey.OriginReachable],
      "a 200 from the right host",
    ).toBe(true);
    expect(evidence.met[EvidenceKey.UnblockedFetches]).toBe(false);
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

describe("scan-evidence: unreachable homepage reasons", () => {
  const reason = (overrides: Partial<FetchResult>) =>
    build({ homepageResult: homepage(overrides) }).reasons[
      EvidenceKey.OriginReachable
    ];

  it("keeps a one-line error as it is", () => {
    expect(reason({ status: 0, error: "certificate has expired" })).toBe(
      "The homepage could not be fetched: certificate has expired.",
    );
  });

  it("reduces a multi-line OpenSSL dump to its failure", () => {
    expect(
      reason({
        status: 0,
        error:
          "802167ED01000000:error:0A000410:SSL routines:ssl3_read_bytes:ssl/tls alert handshake failure:../deps/openssl/openssl/ssl/record/rec_layer_s3.c:918:SSL alert number 40\n",
      }),
    ).toBe(
      "The homepage could not be fetched: TLS error, ssl/tls alert handshake failure.",
    );
  });

  it("names a redirect loop", () => {
    const a = "https://example.com/";
    const b = "https://example.com/bg/";
    expect(
      reason({
        status: 302,
        redirectChain: Array.from({ length: MAX_REDIRECTS }, (_, i) =>
          i % 2 === 0
            ? { status: 302, from: a, to: b }
            : { status: 302, from: b, to: a },
        ),
      }),
    ).toBe(
      `The homepage redirects in a loop (HTTP 302 after ${String(MAX_REDIRECTS)} redirects).`,
    );
  });

  it("keeps the plain status when the chain ended before the hop limit", () => {
    expect(
      reason({
        status: 307,
        redirectChain: [
          {
            status: 301,
            from: "https://example.com/",
            to: "https://www.example.com/",
          },
        ],
      }),
    ).toBe("The homepage answered HTTP 307.");
  });

  it("uses the fetcher's own hop limit", () => {
    expect(FETCHER_REDIRECT_LIMIT).toBe(MAX_REDIRECTS);
  });

  it("keeps the first line of a multi-line error and drops its full stop", () => {
    expect(
      reason({
        status: 0,
        error: "getaddrinfo ENOTFOUND example.com.\n    at GetAddrInfoReqWrap",
      }),
    ).toBe(
      "The homepage could not be fetched: getaddrinfo ENOTFOUND example.com.",
    );
  });

  it("keeps the plain status for a redirect that carries no chain", () => {
    expect(reason({ status: 302 })).toBe("The homepage answered HTTP 302.");
  });

  it("names the redirect limit for a chain that never repeats", () => {
    const hops = Array.from({ length: MAX_REDIRECTS }, (_, i) => ({
      status: 301,
      from: `https://example.com/${i}`,
      to: `https://example.com/${i + 1}`,
    }));
    expect(reason({ status: 301, redirectChain: hops })).toBe(
      `The homepage answered HTTP 301 after ${String(MAX_REDIRECTS)} redirects, the most the scan follows.`,
    );
  });
});

// The evidence gate and the WAF detector describe one failed homepage
// together. These run the real detector, so the reason a report prints is the
// one asserted.
describe("scan-evidence: how a failed homepage is described", () => {
  const describeFailure = (
    homepageResult: FetchResult,
    rootFiles: Record<string, FetchResult> = {},
  ) => {
    const wafProtection = detectWafProtection(
      homepageResult.url,
      homepageResult,
      rootFiles,
      0,
    );
    const evidence = build({ homepageResult, rootFiles, wafProtection });
    return { wafProtection, reason: unjudgeableReason(evidence) };
  };

  it.each([
    ["fetch failed (ECONNREFUSED)", "fetch failed (ECONNREFUSED)"],
    ["fetch failed (CERT_HAS_EXPIRED)", "fetch failed (CERT_HAS_EXPIRED)"],
    [
      "802167ED01000000:error:0A00010B:SSL routines:tls_validate_record_header:wrong version number:../deps/openssl/openssl/ssl/record/methods/tlsany_meth.c:78:\n",
      "TLS error, wrong version number",
    ],
  ])("names %p by its cause, not as a bot wall", (error, cause) => {
    const { wafProtection, reason } = describeFailure(
      homepage({ status: 0, body: "", contentType: "", error }),
    );
    expect(wafProtection).toBeNull();
    expect(reason).toContain(`The homepage could not be fetched: ${cause}.`);
    expect(reason).not.toMatch(/bot wall/i);
  });

  it("says what one dropped attempt saw, without claiming a repeat", () => {
    const { reason } = describeFailure(
      homepage({
        status: 0,
        body: "",
        contentType: "",
        error: "fetch failed (UND_ERR_HEADERS_TIMEOUT)",
      }),
    );
    expect(reason).toContain(
      "Bot Wall / Aggressive Connection Drop refused the scan: The connection opened, but the homepage sent no response before the timeout.",
    );
    expect(reason).not.toMatch(/repeated/);
  });

  // The regression case: an empty 202 with the AWS header used to read as a page
  // with too little text. It now names the wall.
  it("names AWS WAF for an empty 202 challenge", () => {
    const { wafProtection, reason } = describeFailure(
      homepage({
        status: 202,
        body: "",
        headers: { "x-amzn-waf-action": "challenge" },
      }),
    );
    expect(wafProtection?.provider).toBe(WafProvider.AwsWaf);
    expect(reason).toContain(
      "AWS WAF refused the scan: challenge rule action, HTTP 202.",
    );
  });

  it("names the PerimeterX route a homepage chain ended on", () => {
    const { reason } = describeFailure(
      homepage({
        status: 404,
        finalUrl:
          "https://example.com/on/demandware.store/Sites-x-Site/PX-Show",
        body: "<html><body>Page not found</body></html>",
      }),
    );
    expect(reason).toContain(
      "HUMAN / PerimeterX Bot Defense refused the scan: redirected to the PerimeterX challenge route.",
    );
  });

  // A 428 the detector does not call a throttle (it carries a body) is not
  // reported as one: rescanning slower would not help.
  it("does not call a 428 homepage with a body a throttle", () => {
    const evidence = build({
      homepageResult: homepage({ status: 428, body: "Precondition required" }),
    });
    expect(evidence.met[EvidenceKey.UnblockedFetches]).toBe(false);
    expect(evidence.reasons[EvidenceKey.UnblockedFetches]).toBe(
      "The homepage answered HTTP 428 (Precondition Required) after a retry, so the scan read no page.",
    );
  });

  it("still calls an empty 428 homepage a throttle", () => {
    const evidence = build({
      homepageResult: homepage({ status: 428, body: "" }),
    });
    expect(evidence.reasons[EvidenceKey.UnblockedFetches]).toContain(
      "throttled",
    );
  });
});

describe("scan-evidence: unjudgeableReason", () => {
  it("says each reason once, in key order", () => {
    const reason = unjudgeableReason({
      reasons: {
        [EvidenceKey.SampleAdequate]: "The scan fetched no pages.",
        [EvidenceKey.RenderedBody]: "The scan fetched no pages.",
        [EvidenceKey.OriginReachable]: "The homepage answered HTTP 403.",
      },
    });
    expect(reason).toBe(
      "The homepage answered HTTP 403. The scan fetched no pages.",
    );
  });

  it("falls back to one sentence when no key carries a reason", () => {
    expect(unjudgeableReason({ reasons: {} })).toBe(
      "The scan obtained too little evidence to judge this site.",
    );
  });
});
