import { describe, expect, it } from "vitest";
import { gatewayTarget } from "./gateway";
import { parsePageContext } from "./page-context";

const ROOT = "https://example.com/";
const READABLE = `<p>${"word ".repeat(60)}</p>`;

function target(head: string, body = "<h1>Welcome</h1>"): string | undefined {
  const html = `<html><head>${head}</head><body>${body}</body></html>`;
  return gatewayTarget(parsePageContext(ROOT, html), ROOT);
}

describe("gatewayTarget", () => {
  it("follows a same-origin meta refresh", () => {
    expect(target(`<meta http-equiv="refresh" content="4;url=/en/">`)).toBe(
      "https://example.com/en/",
    );
  });

  it("reads quoted and spaced refresh values", () => {
    expect(target(`<meta http-equiv="Refresh" content="0; URL='/de/'">`)).toBe(
      "https://example.com/de/",
    );
  });

  it("follows a same-origin canonical when no refresh is present", () => {
    expect(
      target(`<link rel="canonical" href="https://example.com/en/">`),
    ).toBe("https://example.com/en/");
  });

  it("prefers the refresh target over the canonical", () => {
    expect(
      target(
        `<link rel="canonical" href="/fr/"><meta http-equiv="refresh" content="3;url=/en/">`,
      ),
    ).toBe("https://example.com/en/");
  });

  it("falls back to the canonical when the refresh has no URL", () => {
    expect(
      target(
        `<meta http-equiv="refresh" content="30"><link rel="canonical" href="/en/">`,
      ),
    ).toBe("https://example.com/en/");
  });

  it("does not follow a cross-origin target", () => {
    expect(
      target(
        `<meta http-equiv="refresh" content="0;url=https://other.example/"><link rel="canonical" href="https://other.example/">`,
      ),
    ).toBeUndefined();
  });

  it("follows a refresh to the www twin of the host", () => {
    expect(
      target(
        `<title>Shop</title><meta http-equiv="refresh" content="0;URL=https://www.example.com">`,
        "",
      ),
    ).toBe("https://www.example.com/");
  });

  it("follows a refresh from the www host to the apex", () => {
    const html = `<html><head><meta http-equiv="refresh" content="0;url=https://example.com/en/"></head><body></body></html>`;
    const from = "https://www.example.com/";
    expect(gatewayTarget(parsePageContext(from, html), from)).toBe(
      "https://example.com/en/",
    );
  });

  it.each([
    "https://shop.example.com/",
    "http://www.example.com/",
    "https://www.example.com:8443/",
    "https://www.notexample.com/",
  ])("does not follow %s, which is not the www twin", (url) => {
    expect(
      target(`<meta http-equiv="refresh" content="0;url=${url}">`),
    ).toBeUndefined();
  });

  it("does not follow a canonical that names the page itself", () => {
    expect(target(`<link rel="canonical" href="https://example.com">`)).toBe(
      undefined,
    );
    expect(target(`<link rel="canonical" href="/#top">`)).toBeUndefined();
  });

  it("never treats a page with readable text as a gateway", () => {
    expect(
      target(`<meta http-equiv="refresh" content="4;url=/en/">`, READABLE),
    ).toBeUndefined();
  });

  it("returns undefined for a short page with no target", () => {
    expect(target(`<title>Coming soon</title>`)).toBeUndefined();
  });

  // Only `refresh` sends a browser anywhere. Another http-equiv whose content
  // happens to look like a refresh value is not a redirect.
  it("ignores an http-equiv that is not refresh", () => {
    expect(
      target(`<meta http-equiv="content-language" content="0;url=/en/">`),
    ).toBeUndefined();
  });

  it("falls back to the canonical when the refresh has no content", () => {
    expect(
      target(`<meta http-equiv="refresh"><link rel="canonical" href="/en/">`),
    ).toBe("https://example.com/en/");
  });

  it("falls back to the canonical when the refresh URL is an empty quote", () => {
    expect(
      target(
        `<meta http-equiv="refresh" content="0; url=''"><link rel="canonical" href="/en/">`,
      ),
    ).toBe("https://example.com/en/");
  });

  // A malformed candidate is skipped, not fatal: the next one still counts.
  it("skips a refresh URL that does not parse and reads the canonical", () => {
    expect(
      target(
        `<meta http-equiv="refresh" content="0;url=http://[bad/"><link rel="canonical" href="/en/">`,
      ),
    ).toBe("https://example.com/en/");
  });

  // The refresh wins only when it can be followed. One that leaves the site
  // does not hide a same-site canonical.
  it("falls back to a same-site canonical when the refresh leaves the site", () => {
    expect(
      target(
        `<meta http-equiv="refresh" content="0;url=https://other.example/"><link rel="canonical" href="/en/">`,
      ),
    ).toBe("https://example.com/en/");
  });

  it("drops the fragment from the target", () => {
    expect(target(`<link rel="canonical" href="/en/#main">`)).toBe(
      "https://example.com/en/",
    );
  });

  it("follows a www twin on an explicit non-default port", () => {
    const html = `<html><head><meta http-equiv="refresh" content="0;url=https://www.example.com:8443/en/"></head><body></body></html>`;
    const from = "https://example.com:8443/";
    expect(gatewayTarget(parsePageContext(from, html), from)).toBe(
      "https://www.example.com:8443/en/",
    );
  });
});
