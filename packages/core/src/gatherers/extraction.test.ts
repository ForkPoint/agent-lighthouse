import { describe, it, expect } from "vitest";
import {
  readabilityArticle,
  semanticText,
  densityText,
  READABILITY_CHAR_THRESHOLD,
} from "./extraction";

const prose = (n: number) =>
  Array.from(
    { length: n },
    (_v, i) => `Sentence number ${i} explains the mug in some detail.`,
  ).join(" ");

describe("extraction", () => {
  it("returns null from readability on a document with nothing in it", () => {
    expect(
      readabilityArticle("<html><body></body></html>", "https://example.com/"),
    ).toBeNull();
  });

  // Readability rarely declines outright; it far more often returns a stub
  // below its own char threshold, which means the same thing to an agent.
  it("returns a below-threshold stub for a nav-only document", () => {
    const article = readabilityArticle(
      '<html><body><nav><a href="/">Home</a></nav></body></html>',
      "https://example.com/",
    );
    expect(article?.text.length).toBeLessThan(READABILITY_CHAR_THRESHOLD);
  });

  it("returns the article text from readability on a normal document", () => {
    const html = `<html><head><title>Mugs</title></head><body><article><h1>Mugs</h1><p>${prose(20)}</p></article></body></html>`;
    const article = readabilityArticle(html, "https://example.com/");
    expect(article).not.toBeNull();
    expect(article?.text).toContain("explains the mug");
    expect(article?.source).toBe("readability");
  });

  it("prefers main over article and strips chrome", () => {
    const html = `<html><body><main><p>Main copy.</p><nav>Nav copy.</nav></main><article><p>Article copy.</p></article></body></html>`;
    const extracted = semanticText(html);
    expect(extracted.text).toBe("Main copy.");
    expect(extracted.source).toBe("semantic");
  });

  // Scoring by length alone would pick the link column; per-link density does not.
  it("picks the block with the most text per link", () => {
    const links = Array.from(
      { length: 40 },
      (_v, i) => `<a href="/p/${i}">Product number ${i} link text</a>`,
    ).join("");
    const html = `<html><body><div id="nav">${links}</div><div id="content"><p>${prose(6)}</p></div></body></html>`;
    expect(densityText(html).text).toContain("explains the mug");
  });

  it("gives each extractor a distinct source name", () => {
    const html = `<html><body><main><p>${prose(20)}</p></main></body></html>`;
    const sources = new Set([
      readabilityArticle(html, "https://example.com/")?.source,
      semanticText(html).source,
      densityText(html).source,
    ]);
    expect(sources.size).toBe(3);
  });
});
