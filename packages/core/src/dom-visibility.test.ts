import { describe, it, expect } from "vitest";
import * as cheerio from "cheerio";
import {
  declaredValue,
  hiddenFromReaders,
  notRendered,
  readerText,
  styleHidesFromReaders,
  HidingProperty,
} from "./dom-visibility";

describe("declaredValue", () => {
  it.each([
    ["color:red", undefined],
    ["display; color:red", undefined],
    ["--display:none", undefined],
    ["display:none; /* display:block */", { value: "none", important: false }],
    [
      "display: /* comment */ none ! important",
      { value: "none", important: true },
    ],
    [
      "display:none!important;display:invalid!important",
      { value: "none", important: true },
    ],
    ["display:none;display:initial", { value: "initial", important: false }],
    [
      "display:none;display:inline flow-root",
      { value: "inline flow-root", important: false },
    ],
  ])("resolves %s", (style, expected) => {
    expect(declaredValue(style, HidingProperty.Display)).toEqual(expected);
  });

  it.each(["inherit", "initial", "unset", "revert", "revert-layer"])(
    "accepts CSS-wide %s after a hidden declaration",
    (keyword) => {
      expect(
        declaredValue(
          `visibility:hidden;visibility:${keyword}`,
          HidingProperty.Visibility,
        ),
      ).toEqual({ value: keyword, important: false });
    },
  );
});

describe("reader style markers", () => {
  it.each([
    ["color:red", false],
    ["display:none", true],
    ["visibility:hidden", true],
    ["visibility:collapse", false],
    ["display:none;display:block;visibility:hidden", true],
  ])("%s -> %s", (style, expected) => {
    expect(styleHidesFromReaders(style)).toBe(expected);
  });
});

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
    ['<template><p id="t">x</p></template>', true],
    // aria-hidden removes text from the accessibility tree, not from the screen.
    ['<div aria-hidden="true"><p id="t">x</p></div>', false],
    // until-found stays searchable by find-in-page and text fragments.
    ['<div hidden="until-found"><p id="t">x</p></div>', false],
    ['<main><p id="t">x</p></main>', false],
    [
      '<div style="visibility:hidden"><p id="t" style="visibility:unset">x</p></div>',
      true,
    ],
    [
      '<div style="visibility:hidden"><p id="t" style="visibility:initial">x</p></div>',
      false,
    ],
    [
      '<div style="visibility:visible"><p id="t" style="visibility:hidden">x</p></div>',
      true,
    ],
    ['<div hidden=" UNTIL-FOUND "><p id="t">x</p></div>', false],
    ['<dialog open><p id="t">x</p></dialog>', false],
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

describe("readerText", () => {
  const text = (html: string) => {
    const $ = cheerio.load(html);
    return readerText($, $("#t")[0]!);
  };

  it.each([
    ['<p id="t">a <span hidden>b</span>c</p>', "a c"],
    ['<p id="t">a <span style="display:none">b</span>c</p>', "a c"],
    ['<p id="t">a <span style="visibility:hidden">b</span>c</p>', "a c"],
    ['<p id="t">a <span aria-hidden="true">b</span>c</p>', "a c"],
    ['<p id="t">a <script>b</script><style>b</style>c</p>', "a c"],
    // Readers drop collapsed until-found content, like hiddenFromReaders.
    ['<p id="t">a <span hidden="until-found">b</span>c</p>', "a c"],
    ['<div hidden><p id="t">a</p></div>', ""],
  ])("reads %s as %j", (html, expected) => {
    expect(text(html)).toBe(expected);
  });
});

describe("document-level hiding markers", () => {
  // A theme hides <body> inline until its script reveals it. Readability
  // removes the hidden body and then rebuilds it from the detached children,
  // so the text still reaches the reader; the a11y tree reflects the revealed
  // page. Neither html nor body counts as a hiding ancestor.
  it.each([
    '<html><body style="visibility:hidden"><p id="t">a</p></body></html>',
    '<html><body style="display:none"><p id="t">a</p></body></html>',
    '<html><body hidden><p id="t">a</p></body></html>',
    '<html style="visibility:hidden"><body><p id="t">a</p></body></html>',
  ])("ignores %s", (html) => {
    const $ = cheerio.load(html);
    const el = $("#t")[0]!;
    expect(hiddenFromReaders($, el)).toBe(false);
    expect(notRendered($, el)).toBe(false);
    expect(readerText($, el)).toBe("a");
  });
  it("still honours a hidden wrapper below body", () => {
    const $ = cheerio.load(
      '<html><body style="visibility:hidden"><div hidden><p id="t">a</p></div></body></html>',
    );
    expect(hiddenFromReaders($, $("#t")[0]!)).toBe(true);
  });
});

describe("readerText word boundaries", () => {
  const text = (html: string) => {
    const $ = cheerio.load(html);
    return readerText($, $("#t")[0]!).replace(/\s+/g, " ").trim();
  };
  it.each([
    ['<h2 id="t">iPhone vs<br>Pixel</h2>', "iPhone vs Pixel"],
    ['<ul id="t"><li>Survey</li><li>40%</li></ul>', "Survey 40%"],
    ['<div id="t"><p>a</p><p>b</p></div>', "a b"],
    [
      '<table><tr><td id="t"><div>March 3,</div><div>2024</div></td></tr></table>',
      "March 3, 2024",
    ],
    ['<p id="t">un<em>believ</em>able</p>', "unbelievable"],
    [
      '<p id="t">A <a href="/x">link</a>, then <strong>bold</strong>.</p>',
      "A link, then bold.",
    ],
  ])("reads %s as %j", (html, expected) => {
    expect(text(html)).toBe(expected);
  });
});
