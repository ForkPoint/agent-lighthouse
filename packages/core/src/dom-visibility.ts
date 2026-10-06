import type { CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";

/** Resolve duplicate inline declarations before deciding whether they hide. */
function inlineHidden(style: string): boolean {
  const values = new Map<string, { value: string; important: boolean }>();
  for (const part of style.replace(/\/\*[\s\S]*?\*\//g, "").split(";")) {
    const colon = part.indexOf(":");
    const property = part.slice(0, colon).trim().toLowerCase();
    if (colon === -1 || (property !== "display" && property !== "visibility"))
      continue;
    const raw = part
      .slice(colon + 1)
      .trim()
      .toLowerCase();
    const important = /!\s*important$/.test(raw);
    const value = raw.replace(/!\s*important$/, "").trim();
    if (!value) continue;
    const prior = values.get(property);
    if (!prior?.important || important)
      values.set(property, { value, important });
  }
  return (
    values.get("display")?.value === "none" ||
    values.get("visibility")?.value === "hidden"
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
  return inlineHidden($n.attr("style") ?? "");
}

/**
 * Whether the served markup keeps an element from being rendered: the element
 * or an ancestor carries `hidden` (other than `until-found`), an inline
 * `display:none` / `visibility:hidden`, is a `<template>`, or is a `<dialog>`
 * that is not `open`. This is what find-in-page and the text-fragment matcher
 * can search. `aria-hidden` content is still rendered, so it does not count.
 *
 * Stylesheet rules are not consulted: there is no cascade here.
 */
export function notRendered($: CheerioAPI, el: AnyNode): boolean {
  return anyAncestor($, el, unrenderedMarker);
}

/**
 * Whether the served markup keeps an element out of what a reader gets: it is
 * not rendered (above), it is `hidden="until-found"` and still collapsed, or
 * it sits under `aria-hidden="true"`. The accessibility tree omits these
 * subtrees, and Readability drops all but the closed dialog before it scores
 * a node.
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
      unrenderedMarker($n, tag),
  );
}
