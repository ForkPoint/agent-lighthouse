import { describe, it, expect } from "vitest";
import { detectWafProtection } from "./waf-detector";
import { HOST_STOPPED_MESSAGE } from "./request-scheduler";
import type { FetchResult } from "./fetcher";
import { WafProvider } from "#core/contracts";

/**
 * Bot-wall detection.
 *
 * The verdict changes what a report says about a store outright: a blocked
 * scan reports a bot wall rather than a low score, so a false positive tells
 * an operator their storefront is closed to agents when it is not. Every
 * provider branch is asserted, including the two that need a zero-page scan.
 */

const URL = "https://shop.test";

function result(over: Partial<FetchResult> = {}): FetchResult {
  return {
    url: URL,
    finalUrl: URL,
    status: 200,
    headers: {},
    body: "",
    ttfbMs: 0,
    totalMs: 0,
    contentType: "text/html",
    contentLength: 0,
    ...over,
  };
}

/** Detect against a single homepage response, with pages scanned. */
function onHomepage(over: Partial<FetchResult>, pages = 3) {
  return detectWafProtection(URL, result(over), {}, pages);
}

describe("detectWafProtection", () => {
  it("returns null for an ordinary 200 with no bot-wall markers", () => {
    expect(onHomepage({ body: "<html><body>Shop</body></html>" })).toBeNull();
  });

  it("reads a body of unclosed tags in linear time", () => {
    const started = performance.now();
    onHomepage({
      headers: { "x-akamai-transformed": "x" },
      body: "<title" + "<".repeat(50_000),
    });
    expect(performance.now() - started).toBeLessThan(1_000);
  });

  it("returns null when there is no homepage result at all", () => {
    expect(detectWafProtection(URL, null, {}, 3)).toBeNull();
  });

  describe("Cloudflare", () => {
    it("detects the cf-mitigated challenge header", () => {
      const waf = onHomepage({ headers: { "cf-mitigated": "challenge" } });
      expect(waf).toMatchObject({ isBlocked: true, provider: "cloudflare" });
    });

    it("detects a cf-ray on a 403", () => {
      expect(
        onHomepage({ headers: { "cf-ray": "abc" }, status: 403 })?.provider,
      ).toBe("cloudflare");
    });

    it("detects a 503 behind the cloudflare server header", () => {
      expect(
        onHomepage({ headers: { server: "cloudflare" }, status: 503 })
          ?.provider,
      ).toBe("cloudflare");
    });

    it("detects the interstitial body on a 200", () => {
      const waf = onHomepage({
        headers: { server: "cloudflare" },
        body: "<title>Just a moment...</title>",
      });
      expect(waf?.provider).toBe("cloudflare");
    });

    // Cloudflare fronts a large share of the web; serving through it is not
    // itself a block, and calling it one would mislabel most storefronts.
    it("does not flag a plain 200 served through cloudflare", () => {
      expect(
        onHomepage({
          headers: { "cf-ray": "abc", server: "cloudflare" },
          status: 200,
        }),
      ).toBeNull();
    });

    it.each([
      '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"></script>',
      '<link rel="preconnect" href="https://challenges.cloudflare.com">',
      '<script src="/cdn-cgi/challenge-platform/h/g/scripts/jsd/example/main.js"></script>',
    ])(
      "does not flag a readable storefront with Turnstile markup: %s",
      (markup) => {
        expect(
          onHomepage({
            headers: { server: "cloudflare", "cf-ray": "abc" },
            body: `<html><head><title>Example shop</title>${markup}</head><body><main><h1>Clothing</h1><p>Browse our collection.</p></main><form action="/newsletter"><input name="email"></form></body></html>`,
          }),
        ).toBeNull();
      },
    );

    it("detects a managed challenge script on a 200 without a challenge header", () => {
      expect(
        onHomepage({
          headers: { server: "cloudflare" },
          body: '<script src="/cdn-cgi/challenge-platform/h/b/orchestrate/chl_page/v1"></script>',
        }),
      ).toMatchObject({
        isBlocked: true,
        provider: "cloudflare",
        statusCode: 200,
      });
    });

    it("names the status code in the reason for a 403", () => {
      expect(
        onHomepage({ headers: { "cf-ray": "abc" }, status: 403 })?.reason,
      ).toContain("403");
    });
  });

  describe("other providers", () => {
    it.each([
      ["datadome", { headers: { "x-datadome": "protected" } }],
      ["datadome", { body: "protected by datadome" }],
      ["perimeterx", { headers: { "x-px-block": "1" } }],
      ["perimeterx", { body: '<script src="//client.perimeterx.net/x.js">' }],
      ["perimeterx", { body: "Press & Hold to confirm you are human" }],
      ["imperva", { headers: { "x-iinfo": "1-2-3" } }],
      ["imperva", { headers: { "x-cdn": "Incapsula" } }],
      ["imperva", { body: "Request unsuccessful. Incapsula incident ID 1-2" }],
      ["kasada", { headers: { "x-kpsdk-ct": "abc" } }],
      ["kasada", { body: "k-challenge" }],
    ])("detects %s", (provider, over) => {
      expect(onHomepage(over as Partial<FetchResult>)?.provider).toBe(provider);
    });
  });

  describe("Akamai", () => {
    it("detects a 403 access-denied page", () => {
      const waf = onHomepage({
        status: 403,
        headers: { server: "AkamaiGHost" },
        body: "Access Denied",
      });
      expect(waf).toMatchObject({ provider: "akamai", isBlocked: true });
      expect(waf?.reason).toContain("403");
    });

    it("detects the AkamaiGHost server header when nothing was scanned", () => {
      expect(
        onHomepage({ headers: { server: "AkamaiGHost" } }, 0)?.provider,
      ).toBe("akamai");
    });

    // The markers alone are not a block: Akamai serves plenty of open sites,
    // and the scan reached their pages.
    it("does not flag Akamai markers on a 200 whose pages were scanned", () => {
      expect(
        onHomepage(
          { headers: { "x-akamai-transformed": "9" }, status: 200 },
          3,
        ),
      ).toBeNull();
    });
  });

  describe("a scan that reached no pages", () => {
    it("reports a generic WAF on a 403", () => {
      const waf = onHomepage({ status: 403 }, 0);
      expect(waf).toMatchObject({ provider: "generic-waf", statusCode: 403 });
    });

    it("reports a rate limit on a 429, not a firewall", () => {
      expect(onHomepage({ status: 429 }, 0)?.provider).toBe("rate-limited");
    });

    it("reports a dropped connection on status 0", () => {
      expect(onHomepage({ status: 0 }, 0)?.provider).toBe("connection-drop");
    });

    it.each(["timeout", "The operation was aborted", "ECONNRESET"])(
      "reports a dropped connection for the error %p",
      (error) => {
        expect(onHomepage({ status: 200, error }, 0)?.provider).toBe(
          "connection-drop",
        );
      },
    );

    it("says what the single attempt saw, and never claims a repeat", () => {
      const timedOut = onHomepage(
        { status: 0, error: "The operation was aborted due to timeout" },
        0,
      );
      expect(timedOut?.reason).toBe(
        "The connection opened, but the homepage sent no response before the timeout",
      );
      const closed = onHomepage(
        { status: 0, error: "other side closed (UND_ERR_SOCKET)" },
        0,
      );
      expect(closed?.reason).toBe(
        "The server closed the connection without a response",
      );
      expect(`${timedOut?.reason} ${closed?.reason}`).not.toMatch(/repeated/);
    });

    it("returns null for an ordinary 404 with no other marker", () => {
      expect(onHomepage({ status: 404 }, 0)).toBeNull();
    });
  });

  describe("root files", () => {
    // The verdict is about the pages the scan read. One walled or missing
    // root file beside a homepage that answered and was read is not a wall.
    it("ignores a walled root file when the homepage was read", () => {
      const waf = detectWafProtection(
        URL,
        result({ body: "<html>Shop</html>" }),
        {
          "/robots.txt": result({
            status: 403,
            headers: { "x-datadome": "protected" },
          }),
        },
        3,
      );
      expect(waf).toBeNull();
    });

    // The scheduler stops a host on a 403 to robots.txt and never sends the
    // homepage. That is not a dropped connection.
    it("names the root file whose 403 stopped the host", () => {
      const waf = detectWafProtection(
        URL,
        result({ status: 0, error: HOST_STOPPED_MESSAGE }),
        { "/robots.txt": result({ status: 403, contentType: "text/plain" }) },
        0,
      );
      expect(waf).toMatchObject({
        provider: WafProvider.GenericWaf,
        reason: "Target server rejected crawler with HTTP 403 on /robots.txt",
        statusCode: 403,
      });
    });

    it("reports no wall for a stopped host when no root file explains it", () => {
      const waf = detectWafProtection(
        URL,
        result({ status: 0, error: HOST_STOPPED_MESSAGE }),
        { "/robots.txt": result({ status: 200, contentType: "text/plain" }) },
        0,
      );
      expect(waf).toBeNull();
    });

    it("reads root files to explain a homepage that failed", () => {
      const waf = detectWafProtection(
        URL,
        result({ status: 0, error: "read ECONNRESET" }),
        {
          "/robots.txt": result({
            status: 403,
            headers: { "x-datadome": "protected" },
          }),
        },
        0,
      );
      expect(waf?.provider).toBe("datadome");
    });

    it("ignores S3 AccessDenied documents for missing well-known files", () => {
      const denied = result({
        status: 403,
        headers: { server: "AmazonS3" },
        body: '<?xml version="1.0"?><Error><Code>AccessDenied</Code><Message>Access Denied</Message></Error>',
      });
      const waf = detectWafProtection(
        URL,
        result({ body: "<html>Shop</html>" }),
        {
          "/.well-known/api-catalog": denied,
          "/.well-known/security.txt": denied,
        },
        3,
      );
      expect(waf).toBeNull();
    });

    it("ignores a Cloudflare path rule on one root file", () => {
      const waf = detectWafProtection(
        URL,
        result({
          headers: { server: "cloudflare" },
          body: "<html>Shop</html>",
        }),
        {
          "/sitemap.xml": result({
            status: 403,
            headers: { server: "cloudflare", "cf-ray": "abc" },
            body: "<title>Attention Required! | Cloudflare</title>",
          }),
        },
        3,
      );
      expect(waf).toBeNull();
    });

    it("ignores an Imperva path named inside robots.txt", () => {
      const waf = detectWafProtection(
        URL,
        result({ body: "<html>Shop</html>" }),
        {
          "/robots.txt": result({
            contentType: "text/plain",
            body: "User-agent: *\nDisallow: /_Incapsula_Resource\n",
          }),
        },
        3,
      );
      expect(waf).toBeNull();
    });

    // The homepage failed with an answer (a 404, no page read), so root files
    // count. A vendor path named inside a plain-text robots.txt is still the
    // site's own text, not an Imperva interstitial.
    it("ignores an Imperva path in robots.txt when the homepage failed", () => {
      const waf = detectWafProtection(
        URL,
        result({ status: 404, body: "<html>Not found</html>" }),
        {
          "/robots.txt": result({
            contentType: "text/plain",
            body: "User-agent: *\nDisallow: /_Incapsula_Resource\n",
          }),
        },
        0,
      );
      expect(waf?.provider).not.toBe(WafProvider.Imperva);
    });

    it("still names Imperva from its header on a plain-text root file", () => {
      const waf = detectWafProtection(
        URL,
        result({ status: 404, body: "" }),
        {
          "/robots.txt": result({
            contentType: "text/plain",
            body: "User-agent: *\n",
            headers: { "x-iinfo": "1-2-3" },
          }),
        },
        0,
      );
      expect(waf?.provider).toBe(WafProvider.Imperva);
    });

    // A homepage that answered 200 but yielded no readable page was not read.
    // Its root files are then the only evidence of why.
    it("reads root files when the homepage answered but no page was read", () => {
      const waf = detectWafProtection(
        URL,
        result({ status: 200, body: "" }),
        {
          "/robots.txt": result({
            status: 403,
            headers: { "x-datadome": "protected" },
          }),
        },
        0,
      );
      expect(waf?.provider).toBe(WafProvider.Datadome);
    });

    // Every provider serves 429, so a throttled sitemap beside a homepage
    // that was read says nothing about the scan.
    it("ignores a 429 on a root file when the homepage was read", () => {
      expect(
        detectWafProtection(
          URL,
          result({ body: "<html>Shop</html>" }),
          { "/sitemap.xml": result({ status: 429 }) },
          3,
        ),
      ).toBeNull();
    });

    // The same S3 document that is ignored beside a read homepage still does
    // not name Akamai when the homepage failed: the phrase needs an Akamai
    // header.
    it("does not name Akamai for an S3 AccessDenied root file when the homepage failed", () => {
      const waf = detectWafProtection(
        URL,
        result({ status: 404 }),
        {
          "/.well-known/security.txt": result({
            status: 403,
            headers: { server: "AmazonS3" },
            contentType: "application/xml",
            body: "<Error><Code>AccessDenied</Code><Message>Access Denied</Message></Error>",
          }),
        },
        0,
      );
      expect(waf).toBeNull();
    });

    it("returns null when neither the homepage nor a root file is walled", () => {
      expect(
        detectWafProtection(
          URL,
          result({ body: "Shop" }),
          { "/robots.txt": result() },
          3,
        ),
      ).toBeNull();
    });
  });

  // A 429 means "too many requests" — a statement about this scan's request
  // rate, not about who the site admits. Reporting it as a bot wall told a
  // storefront that serves GPTBot perfectly well that its firewall blocks AI
  // crawlers. Every provider serves 429 for throttling, so this is decided
  // before any provider is.
  describe("rate limiting", () => {
    it("reports a 429 as a rate limit, whatever fronts the site", () => {
      const fronts: Record<string, string>[] = [
        {},
        { server: "cloudflare", "cf-ray": "abc" },
        { server: "AkamaiGHost" },
      ];
      for (const headers of fronts) {
        const waf = onHomepage({ status: 429, headers });
        expect(waf).toMatchObject({
          provider: "rate-limited",
          isRateLimit: true,
          statusCode: 429,
        });
      }
    });

    it("reports a 429 on a root file when the homepage failed", () => {
      const waf = detectWafProtection(
        URL,
        result({ status: 404 }),
        { "/robots.txt": result({ status: 429 }) },
        0,
      );
      expect(waf?.isRateLimit).toBe(true);
    });

    it("names the challenge, not a root-file throttle, when the homepage is walled", () => {
      const waf = detectWafProtection(
        URL,
        result({
          status: 403,
          headers: { server: "cloudflare", "cf-mitigated": "challenge" },
        }),
        { "/llms.txt": result({ status: 429 }) },
        0,
      );
      expect(waf).toMatchObject({ provider: "cloudflare" });
      expect(waf?.isRateLimit).toBeUndefined();
    });

    it("reports an empty 428 on the homepage as a burst limit", () => {
      expect(onHomepage({ status: 428 }, 0)).toMatchObject({
        provider: "rate-limited",
        isRateLimit: true,
        statusCode: 428,
        name: "Rate limit (HTTP 428)",
      });
    });

    it("does not read a 428 with a body as a throttle", () => {
      expect(
        onHomepage({ status: 428, body: "Precondition required" }, 0),
      ).toBeNull();
    });

    it("tells the operator to re-run rather than to change their firewall", () => {
      expect(onHomepage({ status: 429 })?.reason).toMatch(/re-run/i);
    });

    it("leaves isRateLimit unset on a genuine bot wall", () => {
      expect(
        onHomepage({ headers: { "cf-mitigated": "challenge" } })?.isRateLimit,
      ).toBeUndefined();
    });
  });

  it('always names the wall, so a report never prints "undefined"', () => {
    const waf = onHomepage({ headers: { "cf-mitigated": "challenge" } });
    expect(waf?.name).toBeTruthy();
    expect(waf?.reason).toBeTruthy();
  });

  describe("vendor markers on readable pages", () => {
    const READABLE = `<html><head><title>Shop</title></head><body><main><h1>Kitchen</h1><p>${"Copper pans and kettles for every kitchen. ".repeat(12)}</p></main></body></html>`;

    it("does not read the DataDome tag on a readable 200 as a wall", () => {
      expect(
        onHomepage({
          headers: { "x-datadome": "protected" },
          body: READABLE.replace(
            "</head>",
            '<script src="https://js.datadome.co/tags.js"></script></head>',
          ),
        }),
      ).toBeNull();
    });

    it("detects DataDome on a refusal or its captcha page", () => {
      expect(
        onHomepage({ status: 403, headers: { "x-datadome": "protected" } })
          ?.provider,
      ).toBe("datadome");
      expect(
        onHomepage({
          body: "<script>var dd={'host':'geo.captcha-delivery.com'}</script>",
        })?.provider,
      ).toBe("datadome");
    });

    it("does not read the Imperva script on a readable 200 as a wall", () => {
      expect(
        onHomepage({
          body: READABLE.replace(
            "</head>",
            '<script src="/_Incapsula_Resource?SWJIYLWA=abc"></script></head>',
          ),
        }),
      ).toBeNull();
    });

    it("detects the Imperva interstitial", () => {
      expect(
        onHomepage({
          body: '<html><body><iframe src="/_Incapsula_Resource?CWUDNSAI=1"></iframe></body></html>',
        })?.provider,
      ).toBe("imperva");
    });

    it("names PerimeterX when its challenge is served through Cloudflare", () => {
      expect(
        onHomepage(
          {
            status: 403,
            headers: { server: "cloudflare", "cf-ray": "abc" },
            body: '<div id="px-captcha"></div>',
          },
          0,
        )?.provider,
      ).toBe("perimeterx");
    });
  });

  describe("AWS WAF", () => {
    it.each([
      ["challenge", 202],
      ["captcha", 405],
    ])("names the %s action from its header", (action, status) => {
      const waf = onHomepage(
        { status, headers: { "x-amzn-waf-action": action } },
        0,
      );
      expect(waf).toMatchObject({
        isBlocked: true,
        provider: WafProvider.AwsWaf,
        statusCode: status,
      });
      expect(waf?.reason).toContain(action);
    });

    it("ignores the header on a root file when the homepage was read", () => {
      const waf = detectWafProtection(
        URL,
        result({ body: "<html><body><p>Open shop</p></body></html>" }),
        {
          "/llms.txt": result({
            status: 202,
            headers: { "x-amzn-waf-action": "challenge" },
          }),
        },
        1,
      );
      expect(waf).toBeNull();
    });

    // The regression case: an empty 202 and the header, nothing else. Before the
    // header was read this fell through to a page with too little text.
    it("names an empty 202 challenge on a homepage the scan could not read", () => {
      const waf = onHomepage(
        {
          status: 202,
          body: "",
          headers: { "x-amzn-waf-action": "challenge" },
        },
        0,
      );
      expect(waf).toEqual({
        isBlocked: true,
        provider: WafProvider.AwsWaf,
        name: "AWS WAF",
        reason: "challenge rule action, HTTP 202",
        statusCode: 202,
      });
    });

    it("reads the action whatever its case", () => {
      expect(
        onHomepage(
          { status: 405, headers: { "x-amzn-waf-action": "CAPTCHA" } },
          0,
        )?.reason,
      ).toBe("captcha rule action, HTTP 405");
    });

    it("reads the header on a root file when the homepage failed", () => {
      const waf = detectWafProtection(
        URL,
        result({ status: 0, error: "read ECONNRESET" }),
        {
          "/robots.txt": result({
            status: 202,
            headers: { "x-amzn-waf-action": "challenge" },
          }),
        },
        0,
      );
      expect(waf?.provider).toBe(WafProvider.AwsWaf);
    });
  });

  // Storefront platforms redirect a refused client to a challenge route. Its
  // page can answer 404 with the shop's own error page, or 200 with a
  // script-only challenge, so neither its status nor its text names the wall.
  describe("challenge routes", () => {
    it("names PerimeterX for a chain that ends on the PX-Show route", () => {
      const wall = onHomepage(
        {
          status: 404,
          finalUrl: `${URL}/on/demandware.store/Sites-shop-Site/en_US/PX-Show?url=abc`,
          body: "<html><body>Page not found</body></html>",
        },
        0,
      );
      expect(wall?.name).toBe("HUMAN / PerimeterX Bot Defense");
      expect(wall?.reason).toBe("redirected to the PerimeterX challenge route");
      expect(wall?.statusCode).toBe(404);
    });

    it("names DataDome for a chain that ends on the DDUser-Challenge route", () => {
      const wall = onHomepage({
        status: 200,
        finalUrl: `${URL}/on/demandware.store/Sites-shop-Site/en_US/DDUser-Challenge?redirect=%2F`,
        body: '<p id="cmsg">Please enable JS and disable any ad blocker</p>',
      });
      expect(wall?.name).toBe("DataDome Bot Protection");
      expect(wall?.reason).toBe("redirected to the DataDome challenge route");
    });

    it("does not read a route name inside a query or a longer segment", () => {
      expect(
        onHomepage({
          finalUrl: `${URL}/search?q=PX-Show`,
          body: "<html><body>Shop</body></html>",
        }),
      ).toBeNull();
      expect(
        onHomepage({
          finalUrl: `${URL}/blog/PX-Showcase`,
          body: "<html><body>Shop</body></html>",
        }),
      ).toBeNull();
    });

    // A result with no final URL is one the fetcher did not follow; the
    // requested URL is then where the chain ended.
    it("reads the requested URL when no final URL was recorded", () => {
      const wall = onHomepage(
        {
          url: `${URL}/DDUser-Challenge`,
          finalUrl: "",
          body: "<p>Please enable JS</p>",
        },
        0,
      );
      expect(wall?.provider).toBe(WafProvider.Datadome);
      expect(wall?.reason).toBe("redirected to the DataDome challenge route");
    });

    // An unparsable URL proves no route, and must not stop the vendor checks
    // that read the same response.
    it("goes on to the vendor checks when the URL cannot be parsed", () => {
      expect(
        onHomepage({ finalUrl: "not a url", url: "not a url" }, 0),
      ).toBeNull();
      expect(
        onHomepage(
          {
            finalUrl: "not a url",
            url: "not a url",
            status: 403,
            headers: { "x-datadome": "protected" },
          },
          0,
        ),
      ).toMatchObject({
        provider: WafProvider.Datadome,
        reason: "DataDome anti-bot challenge detected",
      });
    });
  });

  describe("Akamai block page served with HTTP 200", () => {
    const geoBlock = {
      status: 200,
      headers: { server: "AkamaiGHost", "akamai-request-bc": "[a=1]" },
      body: "<html><head><title>Access Denied</title></head><body><h1>Access Denied</h1><p>This site is not accessible from your current location.</p></body></html>",
    };

    // A large inline style block closed with `</style >` is still style, not
    // page text, so the page stays a short block page.
    it("detects it behind a style block whose end tag carries whitespace", () => {
      const waf = onHomepage({
        ...geoBlock,
        body: geoBlock.body.replace(
          "</head>",
          `<style>${".a{color:red}".repeat(200)}</style ></head>`,
        ),
      });
      expect(waf).toMatchObject({ isBlocked: true, provider: "akamai" });
    });

    it("detects it and names the location refusal", () => {
      const waf = onHomepage(geoBlock);
      expect(waf).toMatchObject({
        isBlocked: true,
        provider: "akamai",
        statusCode: 200,
      });
      expect(waf?.reason).toContain("location");
    });

    it("detects it when a logo description and contact line add text", () => {
      const waf = onHomepage({
        ...geoBlock,
        body: `<html><head><title>Access Denied</title></head><body><svg><title>Store logo</title><desc>Dark square with the initials of the store inside. The bottom left corner has four green dots.</desc></svg><h1>Access Denied</h1><p>This site is not accessible from your current location. If you believe this is an error or need immediate assistance, please contact us.</p></body></html>`,
      });
      expect(waf?.provider).toBe("akamai");
    });

    it("does not flag a readable Akamai page that mentions access denied", () => {
      expect(
        onHomepage({
          status: 200,
          headers: { server: "AkamaiGHost" },
          body: `<html><head><title>Help</title></head><body><p>${"If you see access denied, sign in again and retry. ".repeat(10)}</p></body></html>`,
        }),
      ).toBeNull();
    });

    it("detects it from the akamai-request-bc header alone", () => {
      const waf = onHomepage({
        ...geoBlock,
        headers: { "akamai-request-bc": "[a=1]" },
      });
      expect(waf?.provider).toBe(WafProvider.Akamai);
    });

    it("names a soft block, not a location refusal, when the page gives no location", () => {
      const waf = onHomepage({
        ...geoBlock,
        body: "<html><head><title>Access Denied</title></head><body><h1>Access Denied</h1><p>Reference #18.1a2b3c</p></body></html>",
      });
      expect(waf?.reason).toBe("Akamai HTTP 200 soft block page");
    });

    // The title alone does not make a block page. A long article that
    // happens to be titled "Access Denied" is a page the scan read.
    it("does not flag a long page titled Access Denied", () => {
      expect(
        onHomepage({
          status: 200,
          headers: { server: "AkamaiGHost" },
          body: `<html><head><title>Access Denied</title></head><body><article>${"A film review about a locked door and the people outside it. ".repeat(20)}</article></body></html>`,
        }),
      ).toBeNull();
    });

    it("reads access denied as a soft block beside an akamai-grn header", () => {
      const waf = onHomepage({
        status: 200,
        headers: { "akamai-grn": "0.1a2b3c" },
        body: "<html><body><h1>Access Denied</h1></body></html>",
      });
      expect(waf).toMatchObject({
        provider: WafProvider.Akamai,
        reason: "Akamai HTTP 200 soft block page",
      });
    });

    it("does not name Akamai for a 403 access-denied page without an Akamai header", () => {
      const waf = onHomepage(
        {
          status: 403,
          headers: { server: "AmazonS3" },
          body: "<Error><Code>AccessDenied</Code><Message>Access Denied</Message></Error>",
        },
        0,
      );
      expect(waf?.provider).toBe("generic-waf");
    });
  });

  describe("connection failures that are not a wall", () => {
    it.each([
      "certificate has expired",
      "Hostname/IP does not match certificate's altnames: Host: shop.test",
      "802167ED01000000:error:0A000410:SSL routines:ssl3_read_bytes:ssl/tls alert handshake failure",
      "connect ECONNREFUSED 192.0.2.1:443",
      "getaddrinfo ENOTFOUND shop.test",
      "connect ENETUNREACH 192.0.2.1:443",
      "connect EHOSTUNREACH 192.0.2.1:443",
      "Connect Timeout Error (attempted address: shop.test:443, timeout: 10000ms)",
    ])("returns null for %p", (error) => {
      expect(onHomepage({ status: 0, error }, 0)).toBeNull();
    });

    // The fetcher reports undici's cause code after the message, so these
    // are the strings a real scan carries.
    it.each([
      "fetch failed (ERR_SSL_WRONG_VERSION_NUMBER)",
      "fetch failed (CERT_HAS_EXPIRED)",
      "fetch failed (ERR_TLS_CERT_ALTNAME_INVALID)",
      "fetch failed (ECONNREFUSED)",
      "fetch failed (EAI_AGAIN)",
      "fetch failed (UND_ERR_CONNECT_TIMEOUT)",
    ])("returns null for the fetcher's %p", (error) => {
      expect(onHomepage({ status: 0, error }, 0)).toBeNull();
    });

    it.each([
      [
        "fetch failed (UND_ERR_HEADERS_TIMEOUT)",
        "The connection opened, but the homepage sent no response before the timeout",
      ],
      [
        "fetch failed (ECONNRESET)",
        "The server closed the connection without a response",
      ],
    ])("reports the fetcher's %p as a dropped connection", (error, reason) => {
      expect(onHomepage({ status: 0, error }, 0)).toMatchObject({
        provider: WafProvider.ConnectionDrop,
        reason,
        statusCode: 0,
      });
    });

    it("still reports a reset after connect as a dropped connection", () => {
      expect(
        onHomepage(
          {
            status: 0,
            error:
              "Stream closed with error code NGHTTP2_INTERNAL_ERROR (ERR_HTTP2_STREAM_ERROR)",
          },
          0,
        )?.provider,
      ).toBe("connection-drop");
    });
  });

  describe("challenge edge cases & false positive prevention", () => {
    it("does not classify vercel.com prose containing attack-challenge-mode as Kasada", () => {
      const waf = onHomepage({
        status: 200,
        body: "# Vercel Pricing\n\nLink to [Attack Challenge Mode](/changelog/prevent-malicious-traffic-with-attack-challenge-mode-for-vercel-firewall)",
      });
      expect(waf).toBeNull();
    });

    it("does not classify a 200 page with a PerimeterX telemetry script snippet as blocked", () => {
      const waf = onHomepage({
        status: 200,
        body: "<html><body><h1>Help Center</h1><script>window._pxAppId='PXu6b0qd2S'</script></body></html>",
      });
      expect(waf).toBeNull();
    });

    it("classifies an Akamai 200 soft block with reference number as blocked", () => {
      const waf = onHomepage({
        status: 200,
        headers: {
          server: "AkamaiNetStorage",
          "akamai-grn": "0.95d72c17.1787919342.4387e81",
        },
        body: "<html><body><p>We're sorry. This page is currently unavailable.</p><p>Reference Number: 18.95d72c17.1787919342.4387e81</p></body></html>",
      });
      expect(waf).toMatchObject({
        isBlocked: true,
        provider: "akamai",
        statusCode: 200,
      });
    });
  });
});
