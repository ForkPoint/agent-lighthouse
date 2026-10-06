import { describe, it, expect } from "vitest";
import * as cheerio from "cheerio";
import { hiddenFromReaders, notRendered } from "./dom-visibility";

function check(html: string): boolean {
  const $ = cheerio.load(html);
  const el = $("#t").get(0);
  if (!el) throw new Error("fixture needs #t");
  return hiddenFromReaders($, el);
}

it.each([
  ["display:none;display:block", false],
  ["display:block;display:none", true],
  ["display:none!important;display:block", true],
  ["display:none!important;display:block!important", false],
  ["DISPLAY: NONE; DISPLAY: block ! IMPORTANT", false],
  ["visibility:hidden;visibility:visible", false],
  ["visibility:hidden!important;visibility:visible", true],
  ["visibility:visible!important;visibility:hidden", false],
  // A browser drops an invalid declaration; the earlier valid one applies.
  ["display:none;display:nonee", true],
  ["display:none;display:block\\9", true],
  ["display:none;display:", true],
  ["visibility:hidden;visibility:hiddn", true],
  ["display:none;display:inline flex", false],
  // var() is valid at parse time, so it overrides; its value is unknown here.
  ["display:none;display:var(--layout, block)", false],
  ["visibility:hidden;visibility:var(--v)", false],
])("resolves inline declaration precedence: %s", (style, hidden) => {
  const $ = cheerio.load(`<p id="t" style="${style}">Answer text.</p>`);
  const el = $("#t").get(0)!;
  expect(notRendered($, el)).toBe(hidden);
  expect(hiddenFromReaders($, el)).toBe(hidden);
});

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

  it("hides a collapsed until-found region from readers", () => {
    expect(check('<div hidden="until-found"><p id="t">x</p></div>')).toBe(true);
  });
});

describe("notRendered", () => {
  function rendered(html: string): boolean {
    const $ = cheerio.load(html);
    return notRendered($, $("#t").get(0)!);
  }

  it.each([
    ['<div hidden><p id="t">x</p></div>', true],
    ['<div style="display:none"><p id="t">x</p></div>', true],
    ['<dialog><p id="t">x</p></dialog>', true],
    // aria-hidden removes text from the accessibility tree, not from the screen.
    ['<div aria-hidden="true"><p id="t">x</p></div>', false],
    // until-found stays searchable by find-in-page and text fragments.
    ['<div hidden="until-found"><p id="t">x</p></div>', false],
    ['<main><p id="t">x</p></main>', false],
    ['<div style="visibility:collapse"><p id="t">x</p></div>', true],
    // visibility inherits, and a descendant may set it back.
    [
      '<div style="visibility:hidden"><p id="t" style="visibility:visible">x</p></div>',
      false,
    ],
    [
      '<div style="visibility:hidden"><section style="visibility:visible"><p id="t">x</p></section></div>',
      false,
    ],
    [
      '<div style="visibility:hidden"><p id="t" style="visibility:inherit">x</p></div>',
      true,
    ],
    // display:none takes the subtree out whatever it declares.
    [
      '<div style="display:none"><p id="t" style="visibility:visible">x</p></div>',
      true,
    ],
  ])("%s -> %s", (html, expected) => {
    expect(rendered(html)).toBe(expected);
  });

  it("leaves readers' view of a hidden subtree unchanged", () => {
    // Readability removes the hidden node with everything under it.
    expect(
      check(
        '<div style="visibility:hidden"><p id="t" style="visibility:visible">x</p></div>',
      ),
    ).toBe(true);
  });
});
