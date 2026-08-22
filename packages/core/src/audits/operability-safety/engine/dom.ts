/**
 * DOM helpers (`commons/dom`), operating on real jsdom DOM.
 *
 * jsdom has no layout engine (no element geometry), so geometry-dependent
 * visibility heuristics (overflow/scroll/clip-by-rect/offscreen) cannot run. We
 * keep the layout-independent visibility model — `display:none`,
 * `visibility:hidden|collapse`, `opacity:0`, the `hidden` attribute,
 * `aria-hidden`, `inert`, natively-hidden tags, and closed `<details>` — which
 * is exactly what `window.getComputedStyle` reports reliably under jsdom.
 * Geometry-only hiding is treated as "not hidden" (documented divergence; never
 * affects ARIA/table/parsing rules).
 */
import {
  VNode,
  nodeLookup,
  getNodeFromTree,
  tokenList,
  getRootNode as utilGetRootNode,
  parseTabindex,
  type AnyNode,
} from './core';
import { getAriaValue, getExplicitRole } from './aria';

export function getRootNode(node: AnyNode): Document | DocumentFragment {
  return utilGetRootNode(node);
}

export function getComposedParent(element: AnyNode): AnyNode | null {
  const el = element as unknown as { parentNode: AnyNode | null };
  if (el.parentNode && el.parentNode.nodeType === 1) return el.parentNode;
  return null;
}

// ── idref resolution ─────────────────────────────────────────────

export function idrefs(node: VNode | AnyNode, attr: string): (AnyNode | null)[] {
  const dom = (node instanceof VNode ? node.actualNode : node) as unknown as {
    getAttribute: (a: string) => string | null;
  };
  try {
    const doc = getRootNode(node instanceof VNode ? node.actualNode : node) as unknown as {
      getElementById: (id: string) => AnyNode | null;
    };
    const result: (AnyNode | null)[] = [];
    let attrValue = dom.getAttribute(attr);
    if (attrValue) {
      const tokens = tokenList(attrValue);
      for (let i = 0; i < tokens.length; i++) result.push(doc.getElementById(tokens[i]));
    }
    return result;
  } catch {
    throw new TypeError('Cannot resolve id references for non-DOM nodes');
  }
}

export function getResolvedRefs(
  node: VNode | AnyNode,
  attr: string,
  options: { self?: boolean } = {},
): (VNode | null)[] {
  const { self = true } = options;
  const { vNode, domNode } = nodeLookup(node);
  try {
    const attrValue = vNode.attr(attr);
    if (!attrValue) return [];
    const doc = getRootNode(domNode) as unknown as { getElementById: (id: string) => AnyNode | null };
    let refs = tokenList(attrValue).map((value) => doc.getElementById(value));
    if (!self) refs = refs.filter((n) => n !== domNode);
    return refs.map((n) => (n ? getNodeFromTree(n) : null));
  } catch {
    throw new TypeError('Cannot resolve id references for non-DOM nodes');
  }
}

// ── visibility primitives ────────────────────────────────────────

function nativelyHidden(vNode: VNode): boolean {
  return ['style', 'script', 'noscript', 'template'].includes(vNode.props.nodeName);
}

function displayHidden(vNode: VNode): boolean {
  if (vNode.props.nodeName === 'area') return false;
  return vNode.getComputedStylePropertyValue('display') === 'none';
}

function visibilityHidden(vNode: VNode, { isAncestor }: { isAncestor?: boolean } = {}): boolean {
  return !isAncestor && ['hidden', 'collapse'].includes(vNode.getComputedStylePropertyValue('visibility'));
}

function contentVisibilityHidden(vNode: VNode, { isAncestor }: { isAncestor?: boolean } = {}): boolean {
  return !!isAncestor && vNode.getComputedStylePropertyValue('content-visibility') === 'hidden';
}

function detailsHidden(vNode: VNode): boolean {
  if (vNode.parent?.props.nodeName !== 'details') return false;
  if (vNode.props.nodeName === 'summary') {
    const firstSummary = vNode.parent.children.find((node) => node.props.nodeName === 'summary');
    if (firstSummary === vNode) return false;
  }
  return !vNode.parent.hasAttr('open');
}

export function ariaHidden(vNode: VNode): boolean {
  return getAriaValue(vNode, 'aria-hidden', { lowercase: true })?.value === 'true';
}

function opacityHidden(vNode: VNode): boolean {
  return vNode.getComputedStylePropertyValue('opacity') === '0';
}

const clipRegex = /rect\s*\(([0-9]+)px,?\s*([0-9]+)px,?\s*([0-9]+)px,?\s*([0-9]+)px\s*\)/;
const clipPathRegex = /(\w+)\((\d+)/;
function clipHidden(vNode: VNode): boolean {
  const matchesClip = vNode.getComputedStylePropertyValue('clip').match(clipRegex);
  const matchesClipPath = vNode.getComputedStylePropertyValue('clip-path').match(clipPathRegex);
  if (matchesClip && matchesClip.length === 5) {
    const position = vNode.getComputedStylePropertyValue('position');
    if (['fixed', 'absolute'].includes(position)) {
      return (
        Number(matchesClip[3]) - Number(matchesClip[1]) <= 0 &&
        Number(matchesClip[2]) - Number(matchesClip[4]) <= 0
      );
    }
  }
  if (matchesClipPath) {
    const type = matchesClipPath[1];
    const value = parseInt(matchesClipPath[2], 10);
    if (type === 'inset') return value >= 50;
    if (type === 'circle') return value === 0;
  }
  return false;
}

const hiddenMethods = [displayHidden, visibilityHidden, contentVisibilityHidden, detailsHidden];

function isHiddenSelf(vNode: VNode, isAncestor: boolean): boolean {
  if (nativelyHidden(vNode)) return true;
  if (!vNode.actualNode) return false;
  if (hiddenMethods.some((method) => method(vNode, { isAncestor }))) return true;
  if (!(vNode.actualNode as unknown as { isConnected?: boolean }).isConnected) return true;
  return false;
}

export function isHiddenForEveryone(
  vNode: VNode | AnyNode,
  { skipAncestors, isAncestor = false }: { skipAncestors?: boolean; isAncestor?: boolean } = {},
): boolean {
  vNode = nodeLookup(vNode).vNode;
  if (skipAncestors) return isHiddenSelf(vNode, isAncestor);
  let v: VNode | null = vNode;
  let ancestor = isAncestor;
  while (v) {
    if (isHiddenSelf(v, ancestor)) return true;
    v = v.parent;
    ancestor = true;
  }
  return false;
}

const screenHiddenMethods = [opacityHidden, clipHidden];

export function isVisibleOnScreen(node: VNode | AnyNode): boolean {
  const vNode = nodeLookup(node).vNode;
  let v: VNode | null = vNode;
  let isAncestor = false;
  while (v) {
    if (isHiddenForEveryone(v, { skipAncestors: true, isAncestor })) return false;
    if (v.actualNode && screenHiddenMethods.some((method) => method(v as VNode))) return false;
    v = v.parent;
    isAncestor = true;
  }
  return true;
}

// ── inert ────────────────────────────────────────────────────────

export function isInert(
  vNode: VNode,
  { skipAncestors }: { skipAncestors?: boolean; isAncestor?: boolean } = {},
): boolean {
  if (skipAncestors) return vNode.hasAttr('inert');
  let v: VNode | null = vNode;
  while (v) {
    if (v.hasAttr('inert')) return true;
    v = v.parent;
  }
  return false;
}

export function isVisibleToScreenReaders(node: VNode | AnyNode): boolean {
  const vNode = nodeLookup(node).vNode;
  let v: VNode | null = vNode;
  let isAncestor = false;
  while (v) {
    if (ariaHidden(v) || isInert(v, { skipAncestors: true, isAncestor })) return false;
    if (isHiddenForEveryone(v, { skipAncestors: true, isAncestor })) return false;
    v = v.parent;
    isAncestor = true;
  }
  return true;
}

// ── focusability ─────────────────────────────────────────────────

const allowedDisabledNodeNames = [
  'button', 'command', 'fieldset', 'keygen', 'optgroup', 'option', 'select', 'textarea', 'input',
];

export function focusDisabled(el: VNode | AnyNode): boolean {
  const { vNode } = nodeLookup(el);
  if ((allowedDisabledNodeNames.includes(vNode.props.nodeName) && vNode.hasAttr('disabled')) || isInert(vNode)) {
    return true;
  }
  let parentNode = vNode.parent;
  let fieldsetDisabled = false;
  while (parentNode && !fieldsetDisabled) {
    if (parentNode.props.nodeName === 'legend') break;
    if (parentNode.props.nodeName === 'fieldset' && parentNode.hasAttr('disabled')) {
      fieldsetDisabled = true;
    }
    parentNode = parentNode.parent;
  }
  if (fieldsetDisabled) return true;
  if (vNode.props.nodeName !== 'area') {
    if (!vNode.actualNode) return false;
    return isHiddenForEveryone(vNode);
  }
  return false;
}

export function isNativelyFocusable(el: VNode | AnyNode): boolean {
  const { vNode } = nodeLookup(el);
  if (!vNode || focusDisabled(vNode)) return false;
  switch (vNode.props.nodeName) {
    case 'a':
    case 'area':
      if (vNode.hasAttr('href')) return true;
      break;
    case 'input':
      return vNode.props.type !== 'hidden';
    case 'textarea':
    case 'select':
    case 'summary':
    case 'button':
      return true;
    case 'details':
      return !(vNode.actualNode as unknown as Element).querySelectorAll('summary').length;
  }
  return false;
}

export function isFocusable(el: VNode | AnyNode): boolean {
  const { vNode } = nodeLookup(el);
  if (vNode.props.nodeType !== 1) return false;
  if (focusDisabled(vNode)) return false;
  if (isNativelyFocusable(vNode)) return true;
  const tabindex = parseTabindex(vNode.attr('tabindex'));
  return tabindex !== null;
}

export function isInTabOrder(el: VNode | AnyNode): boolean {
  const { vNode } = nodeLookup(el);
  if (vNode.props.nodeType !== 1) return false;
  const tabindex = parseTabindex(vNode.attr('tabindex'));
  if (tabindex !== null && tabindex <= -1) return false;
  return isFocusable(vNode);
}

/** querySelectorAll over a VNode's real DOM subtree, returning VNodes. */
export function querySelectorAll(vNode: VNode, selector: string): VNode[] {
  const el = vNode.actualNode as unknown as { querySelectorAll?: (s: string) => ArrayLike<AnyNode> };
  if (typeof el.querySelectorAll !== 'function') return [];
  return Array.from(el.querySelectorAll(selector)).map((n) => getNodeFromTree(n));
}

// ── content detection ────────────────────────────────────────────

const visualRoles = [
  'checkbox', 'img', 'meter', 'progressbar', 'scrollbar', 'radio', 'slider', 'spinbutton', 'textbox',
];

export function isVisualContent(el: VNode | AnyNode): boolean {
  const { vNode } = nodeLookup(el);
  const role = getExplicitRole(vNode);
  if (role) return visualRoles.indexOf(role) !== -1;
  switch (vNode.props.nodeName) {
    case 'img':
    case 'iframe':
    case 'object':
    case 'video':
    case 'audio':
    case 'canvas':
    case 'svg':
    case 'math':
    case 'button':
    case 'select':
    case 'textarea':
    case 'keygen':
    case 'progress':
    case 'meter':
      return true;
    case 'input':
      return vNode.props.type !== 'hidden';
    default:
      return false;
  }
}

const hiddenTextElms = [
  'head', 'title', 'template', 'script', 'style', 'iframe', 'object', 'video', 'audio', 'noscript',
];

export function hasChildTextNodes(elm: VNode): boolean {
  if (hiddenTextElms.includes(elm.props.nodeName)) return false;
  return elm.children.some(({ props }) => props.nodeType === 3 && (props.nodeValue || '').trim());
}

export function hasContentVirtual(elm: VNode, noRecursion?: boolean, ignoreAria?: boolean): boolean {
  return (
    hasChildTextNodes(elm) ||
    isVisualContent(elm.actualNode) ||
    (!ignoreAria && !!labelVirtualAria(elm)) ||
    (!noRecursion &&
      elm.children.some((child) => child.actualNode.nodeType === 1 && hasContentVirtual(child)))
  );
}

export function hasContent(elm: AnyNode, noRecursion?: boolean, ignoreAria?: boolean): boolean {
  return hasContentVirtual(getNodeFromTree(elm), noRecursion, ignoreAria);
}

export function isHTML5(doc: Document): boolean {
  const node = (doc as unknown as { doctype: { name: string; publicId: string; systemId: string } | null })
    .doctype;
  if (node === null) return false;
  return node.name === 'html' && !node.publicId && !node.systemId;
}

// Lazy import to break aria↔dom cycle (labelVirtual lives in aria).
import { labelVirtual as labelVirtualAria } from './aria';
