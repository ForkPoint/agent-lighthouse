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
});
