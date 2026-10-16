import { describe, it, expect } from "vitest";
import { detectWafProtection } from "./waf-detector";
import type { FetchResult } from "./fetcher";

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

  describe("Akamai block page served with HTTP 200", () => {
    const geoBlock = {
      status: 200,
      headers: { server: "AkamaiGHost", "akamai-request-bc": "[a=1]" },
      body: "<html><head><title>Access Denied</title></head><body><h1>Access Denied</h1><p>This site is not accessible from your current location.</p></body></html>",
    };

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
      "Connect Timeout Error (attempted address: shop.test:443, timeout: 10000ms)",
    ])("returns null for %p", (error) => {
      expect(onHomepage({ status: 0, error }, 0)).toBeNull();
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

  describe("corpus edge cases & false positive prevention", () => {
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
