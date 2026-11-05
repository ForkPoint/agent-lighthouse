import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import { hasChildren, isTag, type AnyNode } from "domhandler";
import { adapter } from "parse5-htmlparser2-tree-adapter";
import { DOM_WORK_LIMITS } from "./contracts";

/** Analysis cannot safely feed this DOM to ancestor-walking consumers. */
export class DomWorkLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomWorkLimitError";
  }
}

const depthLimitMessage = `The page DOM nests deeper than ${DOM_WORK_LIMITS.maxDepth} elements. It exceeds the analysis limit.`;

/**
 * parse5's tree adapter with a depth check on every insertion. The parser
 * itself walks its open-element stack for each tag, so a deep page costs
 * quadratic time before any check after the parse could run. Checking the
 * tree as parse5 builds it uses the parser's own rules (raw text, foreign
 * content, implied end tags) and stops at the first element past the limit.
 */
function depthBoundedAdapter(): typeof adapter {
  const depths = new WeakMap<object, number>();
  // parse5 attaches a template's content fragment before the template itself
  // enters the tree, so the fragment reads its depth from the template later.
  const templates = new WeakMap<object, object>();
  const depthOf = (node: object): number => {
    const known = depths.get(node);
    if (known !== undefined) return known;
    const template = templates.get(node);
    return template ? (depths.get(template) ?? 0) : 0;
  };
  const place = (parent: object, child: AnyNode): void => {
    const depth = depthOf(parent) + 1;
    if (isTag(child) && depth > DOM_WORK_LIMITS.maxDepth)
      throw new DomWorkLimitError(depthLimitMessage);
    depths.set(child, depth);
  };
  return {
    ...adapter,
    appendChild(parent, child) {
      place(parent, child);
      adapter.appendChild(parent, child);
    },
    insertBefore(parent, child, reference) {
      place(parent, child);
      adapter.insertBefore(parent, child, reference);
    },
    // Template content is a separate fragment; it inherits the template's depth
    // so nested templates cannot restart the count.
    setTemplateContent(template, content) {
      templates.set(content, template);
      adapter.setTemplateContent(template, content);
    },
  };
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
    if (!isTag(node)) {
      // Template content lives in a document fragment. Traverse it without
      // counting the fragment as an element, matching the parser depth guard.
      if (hasChildren(node))
        for (const child of node.children) stack.push([child, depth]);
      continue;
    }
    if (depth > DOM_WORK_LIMITS.maxDepth)
      throw new DomWorkLimitError(depthLimitMessage);
    steps += depth;
    if (steps > maxAncestorSteps)
      throw new DomWorkLimitError(
        "The page DOM exceeds the structural work limit. It is not assessed.",
      );
    for (const child of node.children) stack.push([child, depth + 1]);
  }
}

/**
 * Parse untrusted HTML within the DOM work limits: depth while parse5 builds
 * the tree, because parsing itself is quadratic in depth, then total ancestor
 * work on the finished tree.
 */
export function parseBoundedHtml(
  html: string,
  maxAncestorSteps: number = DOM_WORK_LIMITS.httpAncestorSteps,
): CheerioAPI {
  const $ = cheerio.load(html, { treeAdapter: depthBoundedAdapter() });
  assertDomWork($, maxAncestorSteps);
  flattenStrings($.root()[0]!);
  return $;
}

/** V8 stores a string this short flat; only longer ones can be ropes. */
const MIN_ROPE_LENGTH = 13;

/**
 * `value` as a new flat string. Slicing needs flat characters, so V8
 * flattens the temporary concatenation and slices the flat copy; the rope
 * `value` pointed to is left for collection. Flattening the rope in place,
 * by searching it, held in a small test but not in a live scan.
 */
function flat(value: string): string {
  return value.length < MIN_ROPE_LENGTH ? value : `${value} `.slice(0, -1);
}

/**
 * Replace every text and attribute string of a parsed tree with a flat copy.
 *
 * parse5 builds each text node and attribute value one character at a time,
 * and V8 keeps such a string as a rope of one 32-byte piece per character
 * until something copies it whole. A parsed page held through the audits kept
 * its inline scripts that way: a 2 MB script cost 63 MB of heap.
 */
export function flattenStrings(root: AnyNode): void {
  const stack: AnyNode[] = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if ("data" in node && typeof node.data === "string")
      node.data = flat(node.data);
    if (isTag(node))
      for (const [name, value] of Object.entries(node.attribs))
        node.attribs[name] = flat(value);
    if (hasChildren(node)) for (const child of node.children) stack.push(child);
  }
}
