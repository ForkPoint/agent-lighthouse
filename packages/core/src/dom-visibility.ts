import type { CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";

/** Inline declarations that take a subtree out of rendering. */
const INLINE_HIDDEN = /(^|;)\s*(display\s*:\s*none|visibility\s*:\s*hidden)/i;

/**
 * Whether the served markup itself keeps an element out of what a reader
 * gets: the element or an ancestor carries `hidden`, `aria-hidden="true"`, an
 * inline `display:none` / `visibility:hidden`, is a `<template>`, or is a
 * `<dialog>` that is not `open`. Browsers do not render these subtrees, the
 * accessibility tree omits them, and Readability drops all but the closed
 * dialog before it scores a node.
 *
 * Stylesheet rules are not consulted: there is no cascade here. `inert` is
 * not a hiding marker either: inert content still renders, find-in-page and
 * text fragments still reach it, and Readability keeps it.
 */
export function hiddenFromReaders($: CheerioAPI, el: AnyNode): boolean {
  let node: AnyNode | null = el;
  while (node) {
    const tag = (node as { tagName?: string }).tagName?.toLowerCase();
    if (tag) {
      const $n = $(node);
      if (tag === "template") return true;
      if (tag === "dialog" && $n.attr("open") === undefined) return true;
      if ($n.attr("hidden") !== undefined) return true;
      if (($n.attr("aria-hidden") ?? "").trim().toLowerCase() === "true")
        return true;
      if (INLINE_HIDDEN.test($n.attr("style") ?? "")) return true;
    }
    node = node.parent as AnyNode | null;
  }
  return false;
}
