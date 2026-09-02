/**
 * Core adaptation layer for the accessibility checks.
 *
 * The check/commons code operates on a `VirtualNode` abstraction. We scan
 * static HTML with jsdom and have real DOM nodes, so this module provides a
 * thin `VNode` wrapper over a real DOM `Node` that exposes the surface that
 * code expects (`.props`, `.attr()`, `.hasAttr()`, `.attrNames`, `.children`,
 * `.parent`, `.actualNode`). Wrappers are cached per DOM node (WeakMap) so node
 * identity is stable — required by the accessible-name loop guard and by the
 * table header caches.
 *
 * Shadow DOM is intentionally ignored: scanned HTML is parsed with
 * `runScripts:'outside-only'` and contains no shadow roots.
 */
import { ariaAttrs } from "./standards";

export type AnyNode = Node;

export interface VNodeProps {
  nodeType: number;
  nodeName: string;
  id: string;
  type?: string;
  nodeValue: string | null;
  multiple?: boolean;
  value?: string;
  selected?: boolean;
  checked?: boolean;
  indeterminate?: boolean;
}

const VALID_INPUT_TYPES = [
  "hidden",
  "text",
  "search",
  "tel",
  "url",
  "email",
  "password",
  "date",
  "month",
  "week",
  "time",
  "datetime-local",
  "number",
  "range",
  "color",
  "checkbox",
  "radio",
  "file",
  "submit",
  "image",
  "reset",
  "button",
];

const vnodeCache = new WeakMap<AnyNode, VNode>();

/** Wrap a real DOM node, exposing the VirtualNode surface. */
export class VNode {
  actualNode: AnyNode;
  // These caches live on the vNode; we keep them for parity behaviour.
  _isDisabled?: boolean;
  _inDisabledFieldset?: boolean;
  _rowHeaders?: unknown;
  _colHeaders?: unknown;
  // No shadow DOM in scanned HTML, but some code reads these.
  shadowId: undefined = undefined;
  elementInternals: undefined = undefined;

  private _props?: VNodeProps;

  constructor(node: AnyNode) {
    this.actualNode = node;
  }

  get props(): VNodeProps {
    if (this._props) return this._props;
    const node = this.actualNode as unknown as {
      nodeType: number;
      nodeName: string;
      id?: string;
      nodeValue: string | null;
      getAttribute?: (n: string) => string | null;
      multiple?: boolean;
      value?: string;
      selected?: boolean;
      checked?: boolean;
      indeterminate?: boolean;
    };
    const nodeName = node.nodeName.toLowerCase();
    let type: string | undefined;
    if (nodeName === "input") {
      let t = (node.getAttribute?.("type") || "").toLowerCase();
      if (!VALID_INPUT_TYPES.includes(t)) t = "text";
      type = t;
    }
    const props: VNodeProps = {
      nodeType: node.nodeType,
      nodeName,
      id: node.id ?? "",
      type,
      nodeValue: node.nodeValue,
    };
    if (node.nodeType === 1) {
      props.multiple = node.multiple;
      props.value = node.value;
      props.selected = node.selected;
      props.checked = node.checked;
      props.indeterminate = node.indeterminate;
    }
    this._props = props;
    return props;
  }

  attr(attrName: string): string | null {
    const n = this.actualNode as unknown as {
      getAttribute?: (n: string) => string | null;
    };
    if (typeof n.getAttribute !== "function") return null;
    return n.getAttribute(attrName);
  }

  hasAttr(attrName: string): boolean {
    const n = this.actualNode as unknown as {
      hasAttribute?: (n: string) => boolean;
    };
    if (typeof n.hasAttribute !== "function") return false;
    return n.hasAttribute(attrName);
  }

  get attrNames(): string[] {
    const n = this.actualNode as unknown as {
      getAttributeNames?: () => string[];
    };
    if (typeof n.getAttributeNames !== "function") return [];
    return n.getAttributeNames();
  }

  get children(): VNode[] {
    return Array.from(
      (this.actualNode as unknown as { childNodes: ArrayLike<AnyNode> })
        .childNodes,
    ).map((c) => toVNode(c));
  }

  get parent(): VNode | null {
    const p = (this.actualNode as unknown as { parentNode: AnyNode | null })
      .parentNode;
    if (!p || p.nodeType === 9 || p.nodeType === 11) return null;
    return toVNode(p);
  }

  getComputedStylePropertyValue(property: string): string {
    const el = this.actualNode as unknown as {
      ownerDocument?: { defaultView?: Window };
    };
    const view = el.ownerDocument?.defaultView;
    if (!view) return "";
    return view
      .getComputedStyle(this.actualNode as unknown as Element)
      .getPropertyValue(property);
  }
}

/** Return the cached VNode for a DOM node (or pass through an existing VNode). */
export function toVNode(node: AnyNode | VNode): VNode {
  if (node instanceof VNode) return node;
  let v = vnodeCache.get(node);
  if (!v) {
    v = new VNode(node);
    vnodeCache.set(node, v);
  }
  return v;
}

/** Returns the wrapping VNode for a DOM node. */
export function getNodeFromTree(node: AnyNode | VNode): VNode {
  return toVNode(node);
}

/** Accepts a DOM node or VNode, returns both the VNode and the DOM node. */
export function nodeLookup(node: AnyNode | VNode): {
  vNode: VNode;
  domNode: AnyNode;
} {
  const vNode = toVNode(node);
  return { vNode, domNode: vNode.actualNode };
}

export function isVNode(x: unknown): x is VNode {
  return x instanceof VNode;
}

// ── core/utils ───────────────────────────────────────────────────

export function tokenList(str: string | null | undefined): string[] {
  return (str || "")
    .trim()
    .replace(/\s{2,}/g, " ")
    .split(" ");
}

export function parseTabindex(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^([-+]?\d+)/);
  if (match) return Number(match[1]);
  return null;
}

export function uniqueArray<T>(arr1: T[], arr2: T[]): T[] {
  return arr1
    .concat(arr2)
    .filter((elem, pos, arr) => arr.indexOf(elem) === pos);
}

// oxlint-disable
/** CSS.escape-style identifier escaping (from mathiasbynens). */
export function escapeSelector(value: string): string {
  const string = String(value);
  const length = string.length;
  let index = -1;
  let codeUnit: number;
  let result = "";
  const firstCodeUnit = string.charCodeAt(0);
  while (++index < length) {
    codeUnit = string.charCodeAt(index);
    if (codeUnit == 0x0000) {
      result += "�";
      continue;
    }
    if (
      (codeUnit >= 0x0001 && codeUnit <= 0x001f) ||
      codeUnit == 0x007f ||
      (index == 0 && codeUnit >= 0x0030 && codeUnit <= 0x0039) ||
      (index == 1 &&
        codeUnit >= 0x0030 &&
        codeUnit <= 0x0039 &&
        firstCodeUnit == 0x002d)
    ) {
      result += "\\" + codeUnit.toString(16) + " ";
      continue;
    }
    if (index == 0 && length == 1 && codeUnit == 0x002d) {
      result += "\\" + string.charAt(index);
      continue;
    }
    if (
      codeUnit >= 0x0080 ||
      codeUnit == 0x002d ||
      codeUnit == 0x005f ||
      (codeUnit >= 0x0030 && codeUnit <= 0x0039) ||
      (codeUnit >= 0x0041 && codeUnit <= 0x005a) ||
      (codeUnit >= 0x0061 && codeUnit <= 0x007a)
    ) {
      result += string.charAt(index);
      continue;
    }
    result += "\\" + string.charAt(index);
  }
  return result;
}

/**
 * memoize: memoization is a performance optimisation only. Correctness never
 * depends on it (the accessible-name loop guard and table caches are handled
 * explicitly), so this is a passthrough.
 */
export function memoize<T extends (...args: never[]) => unknown>(fn: T): T {
  return fn;
}

/** getRootNode adapted to real DOM. */
export function getRootNode(node: AnyNode): Document | DocumentFragment {
  const n = node as unknown as {
    getRootNode?: () => Node;
    ownerDocument?: Document;
  };
  let doc =
    (n.getRootNode && n.getRootNode()) || (n.ownerDocument as unknown as Node);
  if (doc === node) doc = (n.ownerDocument as unknown as Node) ?? doc;
  return doc as Document | DocumentFragment;
}

/** Node#contains wrapper operating on VNodes. */
export function contains(vNode: VNode, otherVNode: VNode): boolean {
  const a = vNode.actualNode as unknown as {
    contains?: (n: AnyNode) => boolean;
  };
  if (typeof a.contains === "function") {
    return a.contains(otherVNode.actualNode);
  }
  let n: VNode | null = otherVNode;
  while (n) {
    if (n === vNode) return true;
    n = n.parent;
  }
  return false;
}

/** Array#sort callback to sort nodes (or VNodes) in DOM order. */
export function nodeSorter(a: AnyNode | VNode, b: AnyNode | VNode): number {
  const nodeA = (a instanceof VNode ? a.actualNode : a) as unknown as {
    compareDocumentPosition: (n: AnyNode) => number;
  };
  const nodeB = (b instanceof VNode ? b.actualNode : b) as unknown as AnyNode;
  if ((nodeA as unknown as AnyNode) === nodeB) return 0;
  return nodeA.compareDocumentPosition(nodeB) & 4 ? -1 : 1;
}

// ── commons/matches ──────────────────────────────────────────────

type Matcher = unknown;

function fromPrimative(someString: unknown, matcher: Matcher): boolean {
  if (Array.isArray(matcher) && typeof someString !== "undefined") {
    return matcher.includes(someString);
  }
  if (typeof matcher === "function") {
    return !!(matcher as (s: unknown) => unknown)(someString);
  }
  if (someString !== null && someString !== undefined) {
    if (matcher instanceof RegExp) return matcher.test(String(someString));
    if (typeof matcher === "string" && /^\/.*\/$/.test(matcher)) {
      const pattern = matcher.substring(1, matcher.length - 1);
      return new RegExp(pattern).test(String(someString));
    }
  }
  return matcher === someString;
}

function fromFunction(
  getValue: (prop: string) => unknown,
  matcher: Record<string, Matcher>,
): boolean {
  if (
    typeof matcher !== "object" ||
    Array.isArray(matcher) ||
    matcher instanceof RegExp
  ) {
    throw new Error("Expect matcher to be an object");
  }
  return Object.keys(matcher).every((propName) =>
    fromPrimative(getValue(propName), matcher[propName]),
  );
}

// Role-based matchers are injected lazily to avoid import cycles with aria/text.
let getExplicitRoleFn: ((v: VNode) => string | null) | null = null;
let getImplicitRoleFn: ((v: VNode) => string | null) | null = null;
let getRoleFn: ((v: VNode) => string | null) | null = null;
let accessibleTextVirtualFn: ((v: VNode) => string) | null = null;
export function registerMatchers(fns: {
  getExplicitRole: (v: VNode) => string | null;
  getImplicitRole: (v: VNode) => string | null;
  getRole: (v: VNode) => string | null;
  accessibleTextVirtual: (v: VNode) => string;
}): void {
  getExplicitRoleFn = fns.getExplicitRole;
  getImplicitRoleFn = fns.getImplicitRole;
  getRoleFn = fns.getRole;
  accessibleTextVirtualFn = fns.accessibleTextVirtual;
}

function fromDefinition(vNode: VNode, definition: Matcher): boolean {
  vNode = nodeLookup(vNode).vNode;
  if (Array.isArray(definition)) {
    return definition.some((d) => fromDefinition(vNode, d));
  }
  if (typeof definition === "string") {
    return matchesSelector(vNode, definition);
  }
  const def = definition as Record<string, Matcher>;
  return Object.keys(def).every((matcherName) => {
    const matcher = def[matcherName];
    switch (matcherName) {
      case "nodeName":
        return fromPrimative(vNode.props.nodeName, matcher);
      case "attributes":
        return fromFunction(
          (a) => vNode.attr(a),
          matcher as Record<string, Matcher>,
        );
      case "properties":
        return fromFunction(
          (p) => (vNode.props as unknown as Record<string, unknown>)[p],
          matcher as Record<string, Matcher>,
        );
      case "condition":
        return !!(matcher as (n: VNode) => unknown)(vNode);
      case "explicitRole":
        return fromPrimative(getExplicitRoleFn?.(vNode) ?? null, matcher);
      case "implicitRole":
        return fromPrimative(getImplicitRoleFn?.(vNode) ?? null, matcher);
      case "semanticRole":
        return fromPrimative(getRoleFn?.(vNode) ?? null, matcher);
      case "hasAccessibleName":
        return fromPrimative(!!accessibleTextVirtualFn?.(vNode), matcher);
      default:
        throw new Error(`Unknown matcher type "${matcherName}"`);
    }
  });
}

/** Match a VNode against a CSS selector string using the real DOM. */
function matchesSelector(vNode: VNode, selector: string): boolean {
  const el = vNode.actualNode as unknown as {
    matches?: (s: string) => boolean;
  };
  if (typeof el.matches !== "function") return false;
  try {
    return el.matches(selector);
  } catch {
    return false;
  }
}

/** Match a VNode against a definition (string/array/object). */
export function matches(vNode: VNode, definition: Matcher): boolean {
  return fromDefinition(vNode, definition);
}

/** closest() over VNodes. */
export function closest(vNode: VNode | null, selector: string): VNode | null {
  while (vNode) {
    if (matches(vNode, selector)) return vNode;
    if (typeof vNode.parent === "undefined") {
      throw new TypeError("Cannot resolve parent for non-DOM nodes");
    }
    vNode = vNode.parent;
  }
  return null;
}

/** findUp adapted: walk up the real DOM via Element#closest. */
export function findUp(node: AnyNode | VNode, target: string): Element | null {
  const dom = (node instanceof VNode ? node.actualNode : node) as unknown as {
    closest?: (s: string) => Element | null;
  };
  if (typeof dom.closest !== "function") return null;
  return dom.closest(target);
}

/** isHtmlElement: valid (non-SVG) HTML element per the standards table. */
export function isHtmlElement(node: VNode | Element): boolean {
  // Lazy import to avoid cycle with standards is unnecessary (standards is pure data).
  const v = node instanceof VNode ? node : toVNode(node as unknown as AnyNode);
  const nodeName = v.props.nodeName;
  const ns = (v.actualNode as unknown as { namespaceURI?: string })
    .namespaceURI;
  if (ns === "http://www.w3.org/2000/svg") return false;
  return !!htmlElmsRef[nodeName];
}

// Imported here (not at top) to keep isHtmlElement's standards access explicit.
import { htmlElms as htmlElmsRef } from "./standards";

/** Expose ariaAttrs for callers needing attribute metadata via core. */
export { ariaAttrs };
