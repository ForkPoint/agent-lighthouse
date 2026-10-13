import type { CheerioAPI } from "cheerio";
import { isTag, type AnyNode } from "domhandler";
import { DOM_WORK_LIMITS } from "./contracts";
import { parseHtml } from "./parser";

/** Analysis cannot safely feed this DOM to ancestor-walking consumers. */
export class DomWorkLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomWorkLimitError";
  }
}

/** Elements that never hold children. */
const VOID = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "keygen",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
  "frame",
]);

/**
 * Elements a same-kind start tag closes, or that the parser keeps from
 * nesting: `<p><p>`, `<li><li>`, `<a><a>` and repeated `<body>` never deepen
 * the tree. Leaving them out keeps the scan from over-counting real pages.
 */
const NON_NESTING = new Set([
  "a",
  "body",
  "caption",
  "colgroup",
  "dd",
  "dt",
  "head",
  "html",
  "li",
  "optgroup",
  "option",
  "p",
  "rb",
  "rp",
  "rt",
  "rtc",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
]);

/** Elements whose content the tokenizer reads as text, up to the matching end tag. */
const RAW_TEXT = new Set([
  "iframe",
  "noembed",
  "noframes",
  "plaintext",
  "script",
  "style",
  "textarea",
  "title",
  "xmp",
]);

const FOREIGN = new Set(["svg", "math"]);

const TAG = /<!--[\s\S]*?(?:-->|$)|<(\/?)([a-zA-Z][^\s/>]*)[^>]*?(\/?)>/g;

/**
 * Approximate the parser's open-element stack over raw markup in linear time.
 * An end tag closes the unclosed children above its match, as the parser does,
 * so sloppy markup does not drift upward. `/>` self-closes only inside SVG or
 * MathML, because `<div/>` opens a div in HTML.
 */
export function assertMarkupDepth(
  html: string,
  limit: number = DOM_WORK_LIMITS.maxMarkupDepth,
): void {
  const stack: string[] = [];
  const open = new Map<string, number>();
  let foreign = 0;
  let lower: string | undefined; // Lower-cased once, on the first raw-text element.
  TAG.lastIndex = 0;
  for (let match = TAG.exec(html); match; match = TAG.exec(html)) {
    const [, closing, rawName, selfClosing] = match;
    if (rawName === undefined) continue; // A comment.
    const name = rawName.toLowerCase();
    if (closing) {
      if (!open.get(name)) continue;
      while (stack.length) {
        const top = stack.pop()!;
        open.set(top, open.get(top)! - 1);
        if (FOREIGN.has(top)) foreign--;
        if (top === name) break;
      }
      continue;
    }
    if (RAW_TEXT.has(name)) {
      lower ??= html.toLowerCase();
      const end = lower.indexOf(`</${name}`, TAG.lastIndex);
      if (end === -1) return;
      TAG.lastIndex = end;
      continue;
    }
    if (VOID.has(name) || NON_NESTING.has(name)) continue;
    if (selfClosing && foreign > 0) continue;
    stack.push(name);
    open.set(name, (open.get(name) ?? 0) + 1);
    if (FOREIGN.has(name)) foreign++;
    if (stack.length > limit)
      throw new DomWorkLimitError(
        `The page markup nests deeper than ${limit} elements. It exceeds the analysis limit.`,
      );
  }
}

/** Bound DOM work before extraction, classification or audits. Linear, and stops at the first excess. */
export function assertDomWork(
  $: CheerioAPI,
  maxAncestorSteps: number = DOM_WORK_LIMITS.httpAncestorSteps,
): void {
  const root = $.root().get(0);
  if (!root) return;
  const stack: Array<[AnyNode, number]> = root.children.map((node) => [
    node,
    1,
  ]);
  let steps = 0;
  while (stack.length) {
    const [node, depth] = stack.pop()!;
    if (!isTag(node)) continue;
    if (depth > DOM_WORK_LIMITS.maxDepth)
      throw new DomWorkLimitError(
        `The page DOM nests deeper than ${DOM_WORK_LIMITS.maxDepth} elements. It exceeds the analysis limit.`,
      );
    steps += depth;
    if (steps > maxAncestorSteps)
      throw new DomWorkLimitError(
        "The page DOM exceeds the structural work limit. It is not assessed.",
      );
    for (const child of node.children) stack.push([child, depth + 1]);
  }
}

/**
 * Parse untrusted HTML within the DOM work limits: a raw-markup check first,
 * because parsing itself is quadratic in depth, then the exact tree check.
 */
export function parseBoundedHtml(
  html: string,
  maxAncestorSteps: number = DOM_WORK_LIMITS.httpAncestorSteps,
): CheerioAPI {
  assertMarkupDepth(html);
  const $ = parseHtml(html);
  assertDomWork($, maxAncestorSteps);
  return $;
}
