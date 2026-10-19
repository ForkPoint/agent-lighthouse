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
  getResolvedRefs,
  querySelectorAll,
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

describe("getResolvedRefs", () => {
  it("resolves every id to a VNode, or null when missing", () => {
    const doc = build(
      '<span id="a">A</span><div id="t" aria-describedby="a missing"></div>',
    );
    const refs = getResolvedRefs(doc.querySelector("#t")!, "aria-describedby");
    expect(refs.map((r) => r?.props.id ?? null)).toEqual(["a", null]);
  });

  it("drops a self-reference when asked to", () => {
    const doc = build('<div id="t" aria-describedby="t">x</div>');
    const el = doc.querySelector("#t")!;
    expect(getResolvedRefs(el, "aria-describedby")).toHaveLength(1);
    expect(getResolvedRefs(el, "aria-describedby", { self: false })).toEqual(
      [],
    );
  });

  it("is empty when the attribute is absent", () => {
    const doc = build('<div id="t"></div>');
    expect(
      getResolvedRefs(doc.querySelector("#t")!, "aria-describedby"),
    ).toEqual([]);
  });
});

describe("hiding rules beyond display", () => {
  it("hides natively hidden elements", () => {
    const doc = build('<p>x</p><template id="t"><p>y</p></template>');
    expect(isHiddenForEveryone(doc.querySelector("#t")!)).toBe(true);
  });

  it("hides a detached element", () => {
    const doc = build("<p>x</p>");
    expect(isHiddenForEveryone(doc.createElement("div"))).toBe(true);
  });

  it("keeps an area visible regardless of display", () => {
    const n = node('<map name="m"><area id="t" href="/x" alt="X"></map>');
    expect(isHiddenForEveryone(n, { skipAncestors: true })).toBe(false);
  });

  // In a closed <details>, only the first summary renders.
  it("hides the content of a closed details element", () => {
    const doc = build(
      '<details><summary id="s1">More</summary><summary id="s2">Again</summary><p id="p">Body</p></details>',
    );
    expect(isHiddenForEveryone(doc.querySelector("#s1")!)).toBe(false);
    expect(isHiddenForEveryone(doc.querySelector("#s2")!)).toBe(true);
    expect(isHiddenForEveryone(doc.querySelector("#p")!)).toBe(true);
  });

  it("shows the content of an open details element", () => {
    const doc = build(
      '<details open><summary>More</summary><p id="p">Body</p></details>',
    );
    expect(isHiddenForEveryone(doc.querySelector("#p")!)).toBe(false);
  });

  it("hides an element whose ancestor has content-visibility:hidden", () => {
    const doc = build(
      '<div style="content-visibility:hidden"><p id="p">Body</p></div>',
    );
    expect(isHiddenForEveryone(doc.querySelector("#p")!)).toBe(true);
  });

  // content-visibility hides the descendants, not the element itself.
  it("keeps the element that carries content-visibility:hidden", () => {
    const n = node('<div id="t" style="content-visibility:hidden">x</div>');
    expect(isHiddenForEveryone(n)).toBe(false);
  });
});

describe("hidden on screen but not from screen readers", () => {
  it("treats opacity:0 as off screen", () => {
    const n = node('<span id="t" style="opacity:0">x</span>');
    expect(isVisibleOnScreen(n)).toBe(false);
    expect(isVisibleToScreenReaders(n)).toBe(true);
  });

  // The visually-hidden clip pattern keeps text for screen readers.
  it("treats a zero clip rect on a positioned element as off screen", () => {
    const n = node(
      '<span id="t" style="position:absolute; clip:rect(0px, 0px, 0px, 0px)">x</span>',
    );
    expect(isVisibleOnScreen(n)).toBe(false);
    expect(isVisibleToScreenReaders(n)).toBe(true);
  });

  it("ignores a clip rect on a static element", () => {
    const n = node(
      '<span id="t" style="clip:rect(0px, 0px, 0px, 0px)">x</span>',
    );
    expect(isVisibleOnScreen(n)).toBe(true);
  });

  it("ignores a clip rect with area", () => {
    const n = node(
      '<span id="t" style="position:absolute; clip:rect(0px, 10px, 10px, 0px)">x</span>',
    );
    expect(isVisibleOnScreen(n)).toBe(true);
  });

  it.each([
    ["inset(50%)", false],
    ["inset(10%)", true],
    ["circle(0)", false],
    ["circle(5px)", true],
    ["polygon(0 0, 1px 1px)", true],
  ])("reads clip-path %s as visible on screen: %p", (clipPath, visible) => {
    const n = node(`<span id="t" style="clip-path:${clipPath}">x</span>`);
    expect(isVisibleOnScreen(n)).toBe(visible);
  });
});

describe("focusDisabled and native focus", () => {
  it("disables a control inside a disabled fieldset", () => {
    const n = node('<fieldset disabled><input id="t"></fieldset>');
    expect(focusDisabled(n)).toBe(true);
    expect(isFocusable(n)).toBe(false);
  });

  // HTML exempts the first legend's contents from fieldset disabling.
  it("keeps a control inside the legend of a disabled fieldset", () => {
    const n = node(
      '<fieldset disabled><legend><input id="t"></legend></fieldset>',
    );
    expect(focusDisabled(n)).toBe(false);
  });

  it("does not disable a control in an enabled fieldset", () => {
    expect(focusDisabled(node('<fieldset><input id="t"></fieldset>'))).toBe(
      false,
    );
  });

  it("does not treat an area as disabled by visibility", () => {
    const n = node('<map name="m"><area id="t" href="/x" alt="X"></map>');
    expect(focusDisabled(n)).toBe(false);
    expect(isNativelyFocusable(n)).toBe(true);
  });

  it.each([
    ['<input id="t">', true],
    ['<input id="t" type="hidden">', false],
    ['<textarea id="t"></textarea>', true],
    ['<select id="t"></select>', true],
    ['<details><summary id="t">More</summary></details>', true],
    ['<details id="t"><p>x</p></details>', true],
    ['<details id="t"><summary>More</summary></details>', false],
    ['<div id="t">x</div>', false],
  ])("isNativelyFocusable(%s) is %p", (html, expected) => {
    expect(isNativelyFocusable(node(html))).toBe(expected);
  });

  it("never focuses a text node", () => {
    const text = toVNode(node('<p id="t">x</p>').actualNode.firstChild!);
    expect(isFocusable(text)).toBe(false);
    expect(isInTabOrder(text)).toBe(false);
  });
});

describe("querySelectorAll", () => {
  it("returns VNodes for matching descendants", () => {
    const found = querySelectorAll(
      node('<ul id="t"><li>a</li><li>b</li></ul>'),
      "li",
    );
    expect(found.map((v) => v.props.nodeName)).toEqual(["li", "li"]);
  });

  it("returns nothing for a text node", () => {
    const text = toVNode(node('<p id="t">x</p>').actualNode.firstChild!);
    expect(querySelectorAll(text, "*")).toEqual([]);
  });
});

describe("content detection edge cases", () => {
  it("uses the explicit role to judge visual content", () => {
    expect(isVisualContent(node('<div id="t" role="img"></div>'))).toBe(true);
    expect(isVisualContent(node('<div id="t" role="button"></div>'))).toBe(
      false,
    );
  });

  it("does not count text inside elements whose text is never rendered", () => {
    expect(
      hasContent(node('<div id="t"><script>var a;</script></div>').actualNode),
    ).toBe(false);
  });
});
