import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import { setDocument } from "./checks";
import { toVNode } from "./core";
import { getImplicitRole } from "./aria";

/**
 * The implicit HTML role table in `stdhelpers.ts`.
 *
 * Several entries depend on context rather than the tag alone: a `<header>`
 * is a banner only outside sectioning content, a `<section>` is a region only
 * when named, an `<input>` with a datalist becomes a combobox. These follow
 * the HTML-AAM mappings. A wrong answer moves landmark-unique, aria-allowed-role
 * and every name rule at once.
 */

function role(body: string, selector = "#t"): string | null {
  const d = new JSDOM(
    `<!doctype html><html lang="en"><head><title>T</title></head><body>${body}</body></html>`,
  ).window.document;
  setDocument(d);
  const found = d.querySelector(selector);
  if (!found) throw new Error(`no element matched ${selector}`);
  return getImplicitRole(toVNode(found));
}

describe("implicit roles that depend on attributes", () => {
  it("maps area with href to link", () => {
    expect(role('<map name="m"><area id="t" href="/x" alt="X"></map>')).toBe(
      "link",
    );
  });

  it("gives area without href no role", () => {
    expect(role('<map name="m"><area id="t" alt="X"></map>')).toBeNull();
  });

  it.each([
    ["number", "spinbutton"],
    ["range", "slider"],
    ["search", "searchbox"],
    ["button", "button"],
    ["image", "button"],
    ["reset", "button"],
    ["email", "textbox"],
    ["date", "textbox"],
  ])("maps input type=%s to %s", (type, expected) => {
    expect(role(`<input id="t" type="${type}">`)).toBe(expected);
  });

  it("maps a search input with a datalist to combobox", () => {
    expect(
      role('<input id="t" type="search" list="l"><datalist id="l"></datalist>'),
    ).toBe("combobox");
  });

  it("maps a text input with a datalist to combobox", () => {
    expect(role('<input id="t" list="l"><datalist id="l"></datalist>')).toBe(
      "combobox",
    );
  });

  it("keeps textbox when list points at something other than a datalist", () => {
    expect(role('<input id="t" list="l"><div id="l"></div>')).toBe("textbox");
  });

  it.each([
    ['<select id="t" multiple></select>', "listbox"],
    ['<select id="t" size="4"></select>', "listbox"],
    ['<select id="t" size="1"></select>', "combobox"],
  ])("maps %s to %s", (html, expected) => {
    expect(role(html)).toBe(expected);
  });
});

describe("implicit roles that depend on a name", () => {
  it("maps a named section to region", () => {
    expect(role('<section id="t" aria-label="Offers">x</section>')).toBe(
      "region",
    );
  });

  it("gives an unnamed section no role", () => {
    expect(role('<section id="t">x</section>')).toBeNull();
  });

  it("maps a form named by aria-labelledby to form", () => {
    expect(
      role('<h2 id="h">Sign up</h2><form id="t" aria-labelledby="h"></form>'),
    ).toBe("form");
  });
});

describe("implicit roles that depend on context", () => {
  it("maps a top-level aside to complementary", () => {
    expect(role('<aside id="t">x</aside>')).toBe("complementary");
  });

  it("gives an unnamed aside inside an article no role", () => {
    expect(role('<article><aside id="t">x</aside></article>')).toBeNull();
  });

  it("keeps complementary for an aside inside an article named by title", () => {
    expect(
      role('<article><aside id="t" title="Related">x</aside></article>'),
    ).toBe("complementary");
  });

  it("gives a header inside main no role", () => {
    expect(role('<main><header id="t">x</header></main>')).toBeNull();
  });

  it("gives a footer inside an article no role", () => {
    expect(role('<article><footer id="t">x</footer></article>')).toBeNull();
  });

  it("maps a td in a grid to gridcell", () => {
    expect(role('<table role="grid"><tr><td id="t">1</td></tr></table>')).toBe(
      "gridcell",
    );
  });

  it("maps a th with scope=row to rowheader", () => {
    expect(
      role('<table><tr><th id="t" scope="row">A</th><td>1</td></tr></table>'),
    ).toBe("rowheader");
  });
});
