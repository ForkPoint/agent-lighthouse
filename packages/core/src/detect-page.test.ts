import { describe, expect, it } from "vitest";
import { detectPage } from "./detect-page";
import { DomWorkLimitError } from "./dom-work";
import {
  ClassificationConfidence,
  DOM_WORK_LIMITS,
  PageType,
  PayloadOrigin,
  type PagePayload,
} from "./contracts";

const payload = (
  url: string,
  html: string,
  origin: PayloadOrigin = PayloadOrigin.Fetched,
): PagePayload => ({ url, html, origin, sha256: "ab12" });

const PRODUCT = `<html><head>
<meta property="og:type" content="product">
<title>Blue mug</title></head>
<body><main><h1>Blue mug</h1><p>A mug.</p></main></body></html>`;

const ARTICLE = `<html><head><meta property="og:type" content="article"></head>
<body><main><article><h1>Brewing tea</h1>
<p>${"Tea is brewed with water at the right temperature. ".repeat(4)}</p>
<p>${"Steep it for three minutes and then remove the leaves. ".repeat(4)}</p>
</article></main></body></html>`;

const GATEWAY = `<html><head><meta http-equiv="refresh" content="0;url=/en/">
<link rel="canonical" href="https://shop.example/en/"></head><body></body></html>`;

describe("detectPage", () => {
  it("detects a product page and keeps the payload facts", () => {
    const identity = detectPage(payload("https://shop.example/p/123", PRODUCT));
    expect(identity).toMatchObject({
      url: "https://shop.example/p/123",
      type: PageType.Product,
      confidence: ClassificationConfidence.Strong,
      payloadSha256: "ab12",
      origin: PayloadOrigin.Fetched,
      partial: false,
    });
    expect(identity.signals).toContain("product-open-graph");
    expect(identity.gatewayTarget).toBeUndefined();
  });

  it("detects an article", () => {
    const identity = detectPage(
      payload("https://news.example/tea", ARTICLE, PayloadOrigin.Supplied),
    );
    expect(identity.type).toBe(PageType.Article);
    expect(identity.origin).toBe(PayloadOrigin.Supplied);
  });

  it("reports a gateway's target without following it", () => {
    const identity = detectPage(payload("https://shop.example/", GATEWAY));
    expect(identity.type).toBe(PageType.Homepage);
    expect(identity.gatewayTarget).toBe("https://shop.example/en/");
  });

  it("caps a partial payload's confidence", () => {
    const identity = detectPage(
      payload("https://shop.example/p/123", PRODUCT, PayloadOrigin.Supplied),
      { partial: true },
    );
    expect(identity.type).toBe(PageType.Product);
    expect(identity.partial).toBe(true);
    expect(identity.confidence).toBe(ClassificationConfidence.Hint);
  });

  it("leaves an unknown confidence as it is on a partial payload", () => {
    const identity = detectPage(
      payload("https://shop.example/x", "<p>hi</p>", PayloadOrigin.Supplied),
      { partial: true },
    );
    expect(identity.confidence).toBe(ClassificationConfidence.Unknown);
  });

  it("throws the DOM work error for a page too deep to assess", () => {
    const deep = "<div>".repeat(DOM_WORK_LIMITS.maxDepth + 5);
    expect(() => detectPage(payload("https://shop.example/x", deep))).toThrow(
      DomWorkLimitError,
    );
  });
});
