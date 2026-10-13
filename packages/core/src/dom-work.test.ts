import { describe, expect, it } from "vitest";
import { parseHtml } from "./parser";
import { parsePageContext } from "./page-context";
import {
  assertDomWork,
  assertMarkupDepth,
  DomWorkLimitError,
  parseBoundedHtml,
} from "./dom-work";
import { DOM_WORK_LIMITS } from "./contracts";

const nest = (open: string, close: string, n: number, inner = "Details") =>
  `<html><body>${open.repeat(n)}${inner}${close.repeat(n)}</body></html>`;

describe("shared DOM analysis work limits", () => {
  it("accepts ordinary pages", () => {
    expect(() =>
      parseBoundedHtml("<main><h1>Details</h1><p>Useful content</p></main>"),
    ).not.toThrow();
  });
  it("rejects excessive depth before structured-data extraction and classification", () => {
    const html = nest(
      "<div itemscope>",
      "</div>",
      DOM_WORK_LIMITS.maxDepth + 10,
    );
    expect(() => parsePageContext("https://example.com/product", html)).toThrow(
      DomWorkLimitError,
    );
  });
  it("bounds ancestor work even when depth stays below the limit", () => {
    const branch = "<div>".repeat(100) + "Details" + "</div>".repeat(100);
    const html = `<html><body>${branch.repeat(210)}</body></html>`;
    expect(() =>
      assertDomWork(parseHtml(html), DOM_WORK_LIMITS.snapshotAncestorSteps),
    ).toThrow("structural work limit");
  });
  it("gives served pages more ancestor room than one uploaded capture", () => {
    const branch = "<div>".repeat(100) + "Details" + "</div>".repeat(100);
    const $ = parseHtml(`<html><body>${branch.repeat(210)}</body></html>`);
    expect(() => assertDomWork($)).not.toThrow();
  });
});

describe("raw markup depth before parsing", () => {
  const over = DOM_WORK_LIMITS.maxMarkupDepth + 10;
  it("stops deep nesting before the quadratic parse starts", () => {
    // A 5 MB body can nest about a million levels; parsing 20,000 took 1.7 s.
    const html = nest("<div>", "</div>", 1_000_000);
    const started = performance.now();
    expect(() => parseBoundedHtml(html)).toThrow("markup nests deeper");
    expect(performance.now() - started).toBeLessThan(500);
  });
  it("treats <div/> as an open div, as HTML does", () => {
    expect(() => assertMarkupDepth(nest("<div/>", "", over))).toThrow(
      DomWorkLimitError,
    );
  });
  it.each([
    ["unclosed paragraphs", nest("<p>", "", 20_000)],
    ["unclosed list items", `<ul>${"<li>item".repeat(20_000)}</ul>`],
    ["unclosed table cells", `<table>${"<tr><td>x".repeat(20_000)}</table>`],
    ["repeated anchors", "<a href=x>link".repeat(20_000)],
    ["void elements", "<br><img src=x><input>".repeat(20_000)],
    [
      "self-closed SVG children",
      `<svg>${'<path d="M0"/>'.repeat(20_000)}</svg>`,
    ],
    [
      "children closed by a parent end tag",
      "<div><span><b>x</div>".repeat(20_000),
    ],
    ["tags inside script text", `<script>${"<div>".repeat(20_000)}</script>`],
    ["tags inside comments", `<!--${"<div>".repeat(20_000)}-->`],
  ])("does not over-count %s", (_, html) => {
    expect(() => assertMarkupDepth(html)).not.toThrow();
  });
});
