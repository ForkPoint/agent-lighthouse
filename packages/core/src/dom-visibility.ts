import type { CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";

/** CSS-wide keywords every property accepts. */
const GLOBAL_KEYWORDS = new Set([
  "inherit",
  "initial",
  "unset",
  "revert",
  "revert-layer",
]);

/** Keywords `display` accepts, alone or in its multi-keyword form. */
const DISPLAY_KEYWORDS = new Set([
  "none",
  "contents",
  "block",
  "inline",
  "run-in",
  "flow",
  "flow-root",
  "table",
  "flex",
  "grid",
  "ruby",
  "math",
  "list-item",
  "inline-block",
  "inline-table",
  "inline-flex",
  "inline-grid",
  "table-row-group",
  "table-header-group",
  "table-footer-group",
  "table-row",
  "table-cell",
  "table-column-group",
  "table-column",
  "table-caption",
  "ruby-base",
  "ruby-text",
  "ruby-base-container",
  "ruby-text-container",
  "-webkit-box",
  "-webkit-inline-box",
  "-moz-box",
  "-moz-inline-box",
  "-ms-flexbox",
  "-ms-inline-flexbox",
  "-ms-grid",
  "-ms-inline-grid",
]);

const VISIBILITY_KEYWORDS = new Set(["visible", "hidden", "collapse"]);

export const HidingProperty = {
  Display: "display",
  Visibility: "visibility",
} as const;

export type HidingProperty =
  (typeof HidingProperty)[keyof typeof HidingProperty];

/** Cheap pre-checks, so a style that names neither property is never parsed. */
const MENTIONS: Record<HidingProperty, RegExp> = {
  display: /display/i,
  visibility: /visibility/i,
};

/**
 * A browser drops a declaration whose value it cannot parse, so the earlier
 * valid one keeps applying. `display:none;display:nonee` stays hidden, and so
 * does the `block\9` hack. jsdom, which Readability runs on, agrees.
 */
function validValue(property: HidingProperty, value: string): boolean {
  if (GLOBAL_KEYWORDS.has(value)) return true;
  // A value with var() is valid at parse time and resolved later, so it
  // overrides an earlier declaration. Its result is unknown here; callers
  // compare against `none` / `hidden` and treat it as neither.
  if (/\bvar\(/.test(value)) return true;
  if (property === HidingProperty.Visibility)
    return VISIBILITY_KEYWORDS.has(value);
  const keywords = value.split(/\s+/);
  return (
    keywords.length <= 3 && keywords.every((word) => DISPLAY_KEYWORDS.has(word))
  );
}

export interface Declaration {
  value: string;
  important: boolean;
}

/**
 * The value a declaration block applies to `property`: the last valid
 * declaration wins, unless an earlier one is `!important` and the later one
 * is not. Invalid values are dropped, as a browser drops them. Works on an
 * inline `style` attribute and on a stylesheet rule's declarations alike.
 */
export function declaredValue(
  declarations: string,
  property: HidingProperty,
): Declaration | undefined {
  if (!MENTIONS[property].test(declarations)) return undefined;
  let winner: Declaration | undefined;
  for (const part of declarations.replace(/\/\*[\s\S]*?\*\//g, "").split(";")) {
    const colon = part.indexOf(":");
    if (colon === -1) continue;
    if (part.slice(0, colon).trim().toLowerCase() !== property) continue;
    const raw = part
      .slice(colon + 1)
      .trim()
      .toLowerCase();
    const important = /!\s*important$/.test(raw);
    const value = raw
      .replace(/!\s*important$/, "")
      .trim()
      .replace(/\s+/g, " ");
    if (!validValue(property, value)) continue;
    if (!winner || important || !winner.important)
      winner = { value, important };
  }
  return winner;
}

/**
 * Whether an inline style hides its subtree the way Readability reads it:
 * `style.display == "none"` or `style.visibility == "hidden"`. Readability
 * removes the node, so a `visibility:visible` descendant goes with it.
 */
export function styleHidesFromReaders(style: string): boolean {
  return (
    declaredValue(style, HidingProperty.Display)?.value === "none" ||
    declaredValue(style, HidingProperty.Visibility)?.value === "hidden"
  );
}

type Marker = ($n: ReturnType<CheerioAPI>, tag: string) => boolean | undefined;

function anyAncestor($: CheerioAPI, el: AnyNode, hides: Marker): boolean {
  let node: AnyNode | null = el;
  while (node) {
    const tag = (node as { tagName?: string }).tagName?.toLowerCase();
    if (tag && hides($(node), tag)) return true;
    node = node.parent as AnyNode | null;
  }
  return false;
}

/** The markers the browser itself honours when it decides what to render. */
function unrenderedMarker($n: ReturnType<CheerioAPI>, tag: string): boolean {
  if (tag === "template") return true;
  if (tag === "dialog" && $n.attr("open") === undefined) return true;
  // Read the raw attribute: cheerio's attr() reports a boolean attribute by
  // its name, which loses the until-found keyword.
  const hidden = ($n.get(0) as { attribs?: Record<string, string> } | undefined)
    ?.attribs?.["hidden"];
  // `hidden="until-found"` stays searchable: find-in-page and text fragments
  // reveal it.
  if (hidden !== undefined && hidden.trim().toLowerCase() !== "until-found")
    return true;
  return (
    declaredValue($n.attr("style") ?? "", HidingProperty.Display)?.value ===
    "none"
  );
}

/**
 * `visibility` inherits, and a descendant can set it back to `visible`, so
 * the nearest element that declares it decides. `display:none` is different:
 * nothing under it renders, whatever it declares.
 */
function visibilityHidden($: CheerioAPI, el: AnyNode): boolean {
  let node: AnyNode | null = el;
  while (node) {
    if ((node as { tagName?: string }).tagName) {
      const value = declaredValue(
        $(node).attr("style") ?? "",
        HidingProperty.Visibility,
      )?.value;
      if (value && value !== "inherit" && value !== "unset")
        return value === "hidden" || value === "collapse";
    }
    node = node.parent as AnyNode | null;
  }
  return false;
}

/**
 * Whether the served markup keeps an element from being rendered: the element
 * or an ancestor carries `hidden` (other than `until-found`), an inline
 * `display:none`, is a `<template>`, or is a `<dialog>` that is not `open`;
 * or its nearest inline `visibility` is `hidden` or `collapse`. This is what find-in-page and the text-fragment matcher
 * can search. `aria-hidden` content is still rendered, so it does not count.
 *
 * Stylesheet rules are not consulted: there is no cascade here.
 */
export function notRendered($: CheerioAPI, el: AnyNode): boolean {
  return anyAncestor($, el, unrenderedMarker) || visibilityHidden($, el);
}

/**
 * Whether the served markup keeps an element out of what a reader gets: it is
 * not rendered (above), it is `hidden="until-found"` and still collapsed, or
 * it sits under `aria-hidden="true"`. The accessibility tree omits these
 * subtrees, and Readability drops all but the closed dialog before it scores
 * a node.
 *
 * `visibility:hidden` on any ancestor counts here, even under a descendant
 * that sets `visibility:visible`: Readability removes the hidden node with
 * its whole subtree. `notRendered` lets the descendant decide instead.
 *
 * `inert` is not a hiding marker: inert content still renders, find-in-page
 * still reaches it, and Readability keeps it.
 */
export function hiddenFromReaders($: CheerioAPI, el: AnyNode): boolean {
  return anyAncestor(
    $,
    el,
    ($n, tag) =>
      $n.attr("hidden") !== undefined ||
      ($n.attr("aria-hidden") ?? "").trim().toLowerCase() === "true" ||
      unrenderedMarker($n, tag) ||
      declaredValue($n.attr("style") ?? "", HidingProperty.Visibility)
        ?.value === "hidden",
  );
}
