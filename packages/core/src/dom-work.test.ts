import { describe, expect, it } from "vitest";
import { parseHtml } from "./parser";
import { parsePageContext } from "./page-context";
import { assertDomWork, DomWorkLimitError, parseBoundedHtml } from "./dom-work";
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

describe("depth checked while parse5 builds the tree", () => {
  const over = DOM_WORK_LIMITS.maxDepth + 10;
  const timed = (html: string) => {
    const started = performance.now();
    let error: unknown;
    try {
      parseBoundedHtml(html);
    } catch (caught) {
      error = caught;
    }
    return { error, ms: performance.now() - started };
  };
  it("stops deep nesting before the quadratic parse runs on", () => {
    // A 5 MB body can nest about a million levels; parsing 20,000 took 1.7 s.
    const { error, ms } = timed(nest("<div>", "</div>", 1_000_000));
    expect(error).toBeInstanceOf(DomWorkLimitError);
    expect(ms).toBeLessThan(500);
  });
  it("stays linear on unterminated tags", () => {
    const { error, ms } = timed("<div ".repeat(20_000));
    expect(error).toBeUndefined();
    expect(ms).toBeLessThan(500);
  });
  it("nests HTML elements inside SVG <style>, as the parser does", () => {
    const { error, ms } = timed(`<svg><style>${"<div>".repeat(20_000)}`);
    expect(error).toBeInstanceOf(DomWorkLimitError);
    expect(ms).toBeLessThan(500);
  });
  it("treats <div/> as an open div, as HTML does", () => {
    expect(() => parseBoundedHtml(nest("<div/>", "", over))).toThrow(
      DomWorkLimitError,
    );
  });
  it.each([
    ["unclosed paragraphs", nest("<p>", "", 20_000)],
    ["paragraphs that close open inline children", "<p><span>x".repeat(3000)],
    [
      "tags inside a quoted attribute",
      `<div title="${"<div>".repeat(3000)}"></div>`,
    ],
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
    expect(() => parseBoundedHtml(html)).not.toThrow();
  });
  it("carries template depth into its content", () => {
    expect(() => parseBoundedHtml("<template>".repeat(over))).toThrow(
      DomWorkLimitError,
    );
  });
  it("builds the same tree as the unbounded parser", () => {
    const html =
      "<p>a<span>b<p>c</p><template><div>t</div></template><svg><style>s</style></svg>";
    expect(parseBoundedHtml(html).html()).toBe(parseHtml(html).html());
  });
});
