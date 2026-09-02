import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import { setDocument } from "./checks";
import { toVNode } from "./core";
import {
  ariaHidden,
  isHiddenForEveryone,
  isVisibleOnScreen,
  isVisibleToScreenReaders,
  isInert,
  focusDisabled,
  isNativelyFocusable,
  isFocusable,
  isInTabOrder,
  isVisualContent,
  hasContent,
  isHTML5,
  idrefs,
} from "./dom";

/**
 * Visibility, focusability and reference resolution.
 *
 * Every rule filters its candidates by screen-reader visibility before it runs
 * a single check, so a defect here silently changes what every rule sees. The
 * conformance suite asserts verdicts; this file asserts the filter underneath
 * them, including the split that matters most: hidden from a screen reader is
 * not the same as invisible on screen, and neither is the same as unfocusable.
 */

function build(body: string, head = "<title>T</title>"): Document {
  const dom = new JSDOM(
    `<!doctype html><html lang="en"><head>${head}</head><body>${body}</body></html>`,
  );
  setDocument(dom.window.document);
  return dom.window.document;
}

/** The VNode for `selector` in a document built from `body`. */
function node(body: string, selector = "#t") {
  const doc = build(body);
  const el = doc.querySelector(selector);
  if (!el) throw new Error(`no element matched ${selector}`);
  return toVNode(el);
}

describe("ariaHidden", () => {
  it('is true for aria-hidden="true"', () => {
    expect(ariaHidden(node('<div id="t" aria-hidden="true">x</div>'))).toBe(
      true,
    );
  });

  it('is false for aria-hidden="false"', () => {
    expect(ariaHidden(node('<div id="t" aria-hidden="false">x</div>'))).toBe(
      false,
    );
  });

  it("is false when the attribute is absent", () => {
    expect(ariaHidden(node('<div id="t">x</div>'))).toBe(false);
  });

  // Per-node, not inherited: the walk up the tree belongs to
  // `isVisibleToScreenReaders`, which is what the rules actually filter on.
  it("does not inherit from an aria-hidden ancestor", () => {
    const html = '<div aria-hidden="true"><span id="t">x</span></div>';
    expect(ariaHidden(node(html))).toBe(false);
    expect(isVisibleToScreenReaders(node(html))).toBe(false);
  });
});

describe("isHiddenForEveryone", () => {
  it("is false for ordinary visible content", () => {
    expect(isHiddenForEveryone(node('<div id="t">x</div>'))).toBe(false);
  });

  it.each([
    ["display:none", '<div id="t" style="display:none">x</div>'],
    ["visibility:hidden", '<div id="t" style="visibility:hidden">x</div>'],
    ["the hidden attribute", '<div id="t" hidden>x</div>'],
  ])("is true for %s", (_label, html) => {
    expect(isHiddenForEveryone(node(html))).toBe(true);
  });

  it("is true for an element inside a display:none ancestor", () => {
    expect(
      isHiddenForEveryone(
        node('<div style="display:none"><span id="t">x</span></div>'),
      ),
    ).toBe(true);
  });
});

// The two are not the same test: aria-hidden removes an element from the
// accessibility tree while leaving it on screen, and a rule that conflated them
// would skip visible content or check invisible content.
describe("isVisibleOnScreen versus isVisibleToScreenReaders", () => {
  it("agree on ordinary content", () => {
    const n = node('<div id="t">x</div>');
    expect(isVisibleOnScreen(n)).toBe(true);
    expect(isVisibleToScreenReaders(n)).toBe(true);
  });

  it("disagree on aria-hidden content, which is on screen but not in the tree", () => {
    const n = node('<div id="t" aria-hidden="true">x</div>');
    expect(isVisibleOnScreen(n)).toBe(true);
    expect(isVisibleToScreenReaders(n)).toBe(false);
  });

  it("agree that display:none is hidden from both", () => {
    const n = node('<div id="t" style="display:none">x</div>');
    expect(isVisibleOnScreen(n)).toBe(false);
    expect(isVisibleToScreenReaders(n)).toBe(false);
  });
});

describe("isInert", () => {
  it("is false for ordinary content", () => {
    expect(isInert(node('<div id="t">x</div>'))).toBe(false);
  });

  it("is true inside an inert subtree", () => {
    expect(isInert(node('<div inert><span id="t">x</span></div>'))).toBe(true);
  });
});

describe("focus", () => {
  it("a button is natively focusable and in the tab order", () => {
    const n = node('<button id="t">Save</button>');
    expect(isNativelyFocusable(n)).toBe(true);
    expect(isFocusable(n)).toBe(true);
    expect(isInTabOrder(n)).toBe(true);
  });

  it("a disabled button is not focusable", () => {
    const n = node('<button id="t" disabled>Save</button>');
    expect(focusDisabled(n)).toBe(true);
    expect(isFocusable(n)).toBe(false);
  });

  it("a plain div is not focusable", () => {
    expect(isFocusable(node('<div id="t">x</div>'))).toBe(false);
  });

  it('tabindex="0" makes a div focusable and keeps it in the tab order', () => {
    const n = node('<div id="t" tabindex="0">x</div>');
    expect(isFocusable(n)).toBe(true);
    expect(isInTabOrder(n)).toBe(true);
  });

  // Reachable by script, deliberately skipped by the Tab key.
  it('tabindex="-1" is focusable but out of the tab order', () => {
    const n = node('<div id="t" tabindex="-1">x</div>');
    expect(isFocusable(n)).toBe(true);
    expect(isInTabOrder(n)).toBe(false);
  });

  it("an anchor with href is focusable, one without is not", () => {
    expect(isNativelyFocusable(node('<a id="t" href="/x">Link</a>'))).toBe(
      true,
    );
    expect(isNativelyFocusable(node('<a id="t">Link</a>'))).toBe(false);
  });
});

describe("isVisualContent", () => {
  it.each(["img", "canvas", "video", "audio", "svg"])(
    "is true for %s",
    (tag) => {
      expect(isVisualContent(node(`<${tag} id="t"></${tag}>`))).toBe(true);
    },
  );

  it("is false for a div", () => {
    expect(isVisualContent(node('<div id="t">x</div>'))).toBe(false);
  });

  it("is true for an input that is not a text field", () => {
    expect(isVisualContent(node('<input id="t" type="checkbox">'))).toBe(true);
  });
});

describe("hasContent", () => {
  it("is true for an element with text", () => {
    expect(hasContent(node('<div id="t">Hello</div>').actualNode)).toBe(true);
  });

  it("is false for an empty element", () => {
    expect(hasContent(node('<div id="t"></div>').actualNode)).toBe(false);
  });

  it("is true for an element holding only an image", () => {
    expect(
      hasContent(
        node('<div id="t"><img src="/x.png" alt="Hat"></div>').actualNode,
      ),
    ).toBe(true);
  });
});

describe("idrefs", () => {
  it("resolves every id in the attribute, in order", () => {
    const doc = build(
      '<span id="a">A</span><span id="b">B</span><div id="t" aria-labelledby="a b"></div>',
    );
    const refs = idrefs(doc.querySelector("#t")!, "aria-labelledby");
    expect(refs.map((r) => (r as Element | null)?.id)).toEqual(["a", "b"]);
  });

  it("yields null for an id that resolves to nothing", () => {
    const doc = build('<div id="t" aria-labelledby="missing"></div>');
    expect(idrefs(doc.querySelector("#t")!, "aria-labelledby")).toEqual([null]);
  });

  it("is empty when the attribute is absent", () => {
    const doc = build('<div id="t"></div>');
    expect(idrefs(doc.querySelector("#t")!, "aria-labelledby")).toEqual([]);
  });
});

describe("isHTML5", () => {
  it("is true for a document with the html doctype", () => {
    expect(isHTML5(build("<p>x</p>"))).toBe(true);
  });

  it("is false for a document with no doctype", () => {
    const dom = new JSDOM(
      '<html lang="en"><head><title>T</title></head><body><p>x</p></body></html>',
    );
    expect(isHTML5(dom.window.document)).toBe(false);
  });
});
