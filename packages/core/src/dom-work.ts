import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import { isTag, type AnyNode } from "domhandler";
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
    if (!isTag(node)) continue;
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
  return $;
}
