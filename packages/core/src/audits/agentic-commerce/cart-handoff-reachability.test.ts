import { describe, it, expect, vi } from "vitest";
import {
  CartHandoffReachabilityAudit,
  challengeIn,
  jsOnlyDocument,
} from "./cart-handoff-reachability";
import {
  mockCheckContext,
  mockPageContext,
  mockFetchResult,
} from "../../__tests__/test-utils";
import { expectNotApplicableOnEmpty } from "../../tests/na-contract";
import type { FetchOptions, FetchResult } from "../../fetcher";
import type { AuditResult } from "../../types";
import { CheckStatus } from "../../types";

vi.mock("../../fetcher", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../fetcher")>();
  return {
    ...actual,
    isSafeUrl: async (url: string) => url.startsWith("https://example.com"),
  };
});

const strings = (result: AuditResult, key: string): string[] =>
  (result.details?.[key] ?? []) as string[];

/** Enough prose that a document does not read as JS-only. */
const CART_BODY = `<html><body><h1>Your cart</h1><p>${"One item in your basket. ".repeat(12)}</p></body></html>`;

/** Markup that fingerprints the storefront platform. */
const SHOPIFY =
  '<script src="https://cdn.shopify.com/s/files/shop.js"></script>';

interface Answer {
  status?: number;
  body?: string;
  finalUrl?: string;
  headers?: Record<string, string>;
}

interface Store {
  /** Homepage markup, which is what the fingerprint is read from. */
  markup?: string;
  /** Answer per path; a path with no entry answers 404. */
  paths?: Record<string, Answer>;
  /** Answer for ChatGPT-User only, overriding `paths`. */
  agentPaths?: Record<string, Answer>;
  robots?: string;
}

function run(store: Store = {}) {
  const audit = new CartHandoffReachabilityAudit();
  const rootFiles: Record<string, FetchResult> = store.robots
    ? { "/robots.txt": mockFetchResult(store.robots, 200) }
    : {};
  const ctx = mockCheckContext(
    [
      mockPageContext(
        "https://example.com/",
        `<html><body>${store.markup ?? ""}</body></html>`,
      ),
    ],
    rootFiles,
  );
  const requests: FetchOptions[] = [];

  ctx.fetch = async (o: FetchOptions): Promise<FetchResult> => {
    requests.push(o);
    const path = new URL(o.url).pathname;
    const isAgent = (o.userAgent ?? "").includes("ChatGPT-User");
    const answer =
      (isAgent ? store.agentPaths?.[path] : undefined) ?? store.paths?.[path];
    if (!answer) return mockFetchResult("", 404);
    const result = mockFetchResult(
      answer.body ?? CART_BODY,
      answer.status ?? 200,
      "text/html",
    );
    result.url = o.url;
    result.finalUrl = answer.finalUrl ?? o.url;
    Object.assign(result.headers, answer.headers ?? {});
    return result;
  };

  return { result: audit.audit(ctx), requests };
}

describe("CartHandoffReachabilityAudit", () => {
  it("is notApplicable on an empty site", async () => {
    await expectNotApplicableOnEmpty(new CartHandoffReachabilityAudit());
  });

  it("is notApplicable with no fingerprint and no cart path answering", async () => {
    const { result } = run();
    expect((await result).status).toBe(CheckStatus.NotApplicable);
  });

  it("fails a fingerprinted storefront whose cart path 404s", async () => {
    const { result } = run({ markup: SHOPIFY });
    const r = await result;
    expect(r.status).toBe(CheckStatus.Fail);
    expect(strings(r, "failures")[0]).toContain("no discoverable cart surface");
  });

  it("passes a cart that answers both user agents", async () => {
    const { result, requests } = run({
      markup: SHOPIFY,
      paths: { "/cart": {} },
    });
    const r = await result;
    expect(r.status).toBe(CheckStatus.Pass);
    expect(r.details?.["platform"]).toBe("shopify");
    // One path, two user agents, no more.
    expect(requests).toHaveLength(2);
    expect(requests.every((o) => o.body === undefined)).toBe(true);
  });

  it("fails a cart that redirects to a login page", async () => {
    const { result } = run({
      markup: SHOPIFY,
      paths: {
        "/cart": {
          finalUrl: "https://example.com/account/login?checkout_url=%2Fcart",
        },
      },
    });
    const r = await result;
    expect(r.status).toBe(CheckStatus.Fail);
    expect(strings(r, "failures")[0]).toContain("account wall");
  });

  // The false positive: a readable cart with the site-wide Turnstile loader
  // and its inline config. The widget guards forms, not the document.
  it("passes a readable cart that loads Turnstile for its forms", async () => {
    const { result } = run({
      markup: SHOPIFY,
      paths: {
        "/cart": {
          headers: { server: "cloudflare", "cf-ray": "abc" },
          body: `${CART_BODY}<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"></script><script>app.captcha.provider = "CloudflareTurnstile"; app.captcha.tokenParam = "cf-turnstile-response";</script>`,
        },
      },
    });
    const r = await result;
    expect(r.status).toBe(CheckStatus.Pass);
    expect(strings(r, "failures")).toEqual([]);
  });

  // True positive: the widget is the whole document.
  it("fails a checkout document that is only a bot challenge", async () => {
    const { result } = run({
      markup: '<link href="/wp-content/plugins/woocommerce/style.css">',
      paths: {
        "/cart": {},
        "/checkout": {
          body: '<html><body><form action="/verify"><div class="cf-turnstile" data-sitekey="0x0000"></div></form><script src="https://challenges.cloudflare.com/turnstile/v0/api.js"></script></body></html>',
        },
      },
    });
    const r = await result;
    expect(r.status).toBe(CheckStatus.Fail);
    expect(strings(r, "failures")[0]).toContain("Cloudflare Turnstile");
  });

  // True positive: a managed challenge page served at 200 in place of the cart.
  it("fails a cart answered by a managed challenge page", async () => {
    const { result } = run({
      markup: SHOPIFY,
      paths: {
        "/cart": {
          headers: { server: "cloudflare" },
          body: '<html><head><title>Just a moment...</title></head><body><script src="/cdn-cgi/challenge-platform/h/b/orchestrate/chl_page/v1"></script></body></html>',
        },
      },
    });
    const r = await result;
    expect(r.status).toBe(CheckStatus.Fail);
    expect(strings(r, "failures")[0]).toContain("Managed Challenge");
  });

  it("fails a 403 under ChatGPT-User and names the user agent", async () => {
    const { result } = run({
      markup: SHOPIFY,
      paths: { "/cart": {} },
      agentPaths: { "/cart": { status: 403, body: "" } },
    });
    const r = await result;
    expect(r.status).toBe(CheckStatus.Fail);
    expect(strings(r, "failures")[0]).toContain("ChatGPT-User");
    expect(strings(r, "failures")[0]).toContain("403");
  });

  it("fails a 429 under the browser user agent", async () => {
    const { result } = run({
      markup: SHOPIFY,
      paths: { "/cart": { status: 429, body: "" } },
    });
    expect(strings(await result, "failures")[0]).toContain("429");
  });

  it("warns on a cart rendered only by JavaScript", async () => {
    const { result } = run({
      markup: SHOPIFY,
      paths: {
        "/cart": {
          body: '<html><body><div id="root"></div><noscript></noscript></body></html>',
        },
      },
    });
    const r = await result;
    expect(r.status).toBe(CheckStatus.Warn);
    expect(strings(r, "warnings")[0]).toContain("without JavaScript");
  });

  it("reports a robots.txt Disallow on the cart path and does not fetch it", async () => {
    const { result, requests } = run({
      markup: SHOPIFY,
      paths: { "/cart": {} },
      robots: "User-agent: ChatGPT-User\nDisallow: /cart\n",
    });
    const r = await result;
    expect(strings(r, "disallowedByRobots")).toEqual(["/cart"]);
    expect(requests).toHaveLength(0);
    expect(r.status).toBe(CheckStatus.Fail);
  });

  it("names each challenge widget it knows", () => {
    expect(
      challengeIn('<script src="https://www.google.com/recaptcha/api.js">'),
    ).toBe("reCAPTCHA");
    expect(challengeIn('<div data-sitekey="abc"></div>')).toBe(
      "a data-sitekey widget",
    );
    expect(challengeIn('<script src="https://js.hcaptcha.com/1/api.js">')).toBe(
      "hCaptcha",
    );
    expect(challengeIn(CART_BODY)).toBeUndefined();
  });

  it("does not call a document JS-only when the noscript fallback says something", () => {
    expect(jsOnlyDocument('<div id="root"></div><noscript></noscript>')).toBe(
      true,
    );
    expect(
      jsOnlyDocument(
        `<div id="root"></div><noscript>${"Your cart needs JavaScript. ".repeat(10)}</noscript>`,
      ),
    ).toBe(false);
    expect(jsOnlyDocument(CART_BODY)).toBe(false);
  });
});
