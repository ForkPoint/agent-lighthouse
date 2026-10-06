import { describe, it, expect } from "vitest";
import * as cheerio from "cheerio";
import { hiddenFromReaders } from "./dom-visibility";

function check(html: string): boolean {
  const $ = cheerio.load(html);
  const el = $("#t").get(0);
  if (!el) throw new Error("fixture needs #t");
  return hiddenFromReaders($, el);
}

describe("hiddenFromReaders", () => {
  it("is false for ordinary visible content", () => {
    expect(check('<main><p id="t">Hi</p></main>')).toBe(false);
  });

  it.each([
    ['<div hidden><p id="t">x</p></div>', "hidden ancestor"],
    ['<p id="t" hidden>x</p>', "hidden self"],
    ['<div aria-hidden="true"><p id="t">x</p></div>', "aria-hidden"],
    [
      '<div style="color:red; display: none"><p id="t">x</p></div>',
      "display:none",
    ],
    [
      '<div style="visibility:hidden"><p id="t">x</p></div>',
      "visibility:hidden",
    ],
    ['<dialog><p id="t">x</p></dialog>', "closed dialog"],
  ])("is true for %s (%s)", (html) => {
    expect(check(html)).toBe(true);
  });

  it("is false inside an open dialog", () => {
    expect(check('<dialog open><p id="t">x</p></dialog>')).toBe(false);
  });

  // Inert content still renders and is still found by find-in-page.
  it("is false for inert content", () => {
    expect(check('<div inert><p id="t">x</p></div>')).toBe(false);
  });

  it("is false for aria-hidden=false", () => {
    expect(check('<div aria-hidden="false"><p id="t">x</p></div>')).toBe(false);
  });
});
