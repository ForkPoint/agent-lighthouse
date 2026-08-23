/**
 * ARIA helpers (`commons/aria`), operating on real jsdom
 * DOM via the `VNode` wrapper. ARIA value lookups read attributes only (static
 * HTML has no AOM/ElementInternals); shadow DOM is ignored.
 */
import { ariaAttrs, ariaRoles } from './standards';
import {
  VNode,
  nodeLookup,
  getNodeFromTree,
  tokenList,
  isHtmlElement,
  getRootNode,
  type AnyNode,
} from './core';
import { getGlobalAriaAttrs, getElementSpec, implicitHtmlRoles } from './stdhelpers';

// ── role validity ────────────────────────────────────────────────

export function isUnsupportedRole(role: string | null): boolean {
  const roleDefinition = ariaRoles[role as string];
  return roleDefinition ? !!roleDefinition.unsupported : false;
}

export function isValidRole(
  role: string | null,
  { allowAbstract, flagUnsupported = false }: { allowAbstract?: boolean; flagUnsupported?: boolean } = {},
): boolean {
  const roleDefinition = ariaRoles[role as string];
  const isRoleUnsupported = isUnsupportedRole(role);
  if (!roleDefinition || (flagUnsupported && isRoleUnsupported)) return false;
  return allowAbstract ? true : roleDefinition.type !== 'abstract';
}

export function getRoleType(role: string | VNode | null): string | null {
  if (role instanceof VNode) {
    role = getRole(role);
  }
  const roleDef = ariaRoles[role as string];
  return roleDef?.type || null;
}

// ── aria value access (attribute-only) ───────────────────────────

export function getAriaValue(
  node: VNode | AnyNode,
  attrName: string,
  options: { lowercase?: boolean } = {},
): { value: string; source: string } | null {
  const attrStandard = ariaAttrs[attrName];
  if (!attrStandard) return null;
  const { type } = attrStandard;
  const { vNode } = nodeLookup(node);
  const { lowercase } = options;

  let value = vNode.attr(attrName);
  if (value === null || value === undefined) return null;
  if (type !== 'string') value = value.trim();
  if (lowercase) value = value.toLowerCase();
  return { value, source: 'attribute' };
}

export function hasAriaValue(node: VNode | AnyNode, attrName: string): boolean {
  const attrStandard = ariaAttrs[attrName];
  if (!attrStandard) {
    throw new TypeError(`Attribute ${attrName} is not an ARIA attribute`);
  }
  const { vNode } = nodeLookup(node);
  return vNode.hasAttr(attrName);
}

// ── role resolution ──────────────────────────────────────────────

export function getExplicitRole(
  vNode: VNode | AnyNode,
  { fallback, abstracts, dpub }: { fallback?: boolean; abstracts?: boolean; dpub?: boolean } = {},
): string | null {
  vNode = vNode instanceof VNode ? vNode : getNodeFromTree(vNode);
  if (vNode.props.nodeType !== 1) return null;

  const roleAttr = (vNode.attr('role') || '').trim().toLowerCase();
  const roleList = fallback ? tokenList(roleAttr) : [roleAttr];
  const firstValidRole = roleList.find((role) => {
    if (!dpub && role.substr(0, 4) === 'doc-') return false;
    return isValidRole(role, { allowAbstract: abstracts });
  });
  return firstValidRole || null;
}

export function getImplicitRole(
  node: VNode | AnyNode,
  { chromium }: { chromium?: boolean } = {},
): string | null {
  const { vNode } = nodeLookup(node);
  if (!vNode) {
    throw new ReferenceError('Cannot get implicit role of a node outside the current scope.');
  }
  const nodeName = vNode.props.nodeName;
  const role = implicitHtmlRoles[nodeName];
  if (!role && chromium) {
    const { chromiumRole } = getElementSpec(vNode) as { chromiumRole?: string };
    return chromiumRole || null;
  }
  if (typeof role === 'function') return role(vNode) ?? null;
  return (role as string) || null;
}

const inheritsPresentationChain: Record<string, string[]> = {
  td: ['tr'],
  th: ['tr'],
  tr: ['thead', 'tbody', 'tfoot', 'table'],
  thead: ['table'],
  tbody: ['table'],
  tfoot: ['table'],
  li: ['ol', 'ul'],
  dt: ['dl', 'div'],
  dd: ['dl', 'div'],
  div: ['dl'],
};

function getInheritedRole(
  vNode: VNode,
  explicitRoleOptions: { fallback?: boolean; abstracts?: boolean; dpub?: boolean },
): string | null {
  const parentNodeNames = inheritsPresentationChain[vNode.props.nodeName];
  if (!parentNodeNames) return null;
  if (!vNode.parent) {
    if (!vNode.actualNode) return null;
    throw new ReferenceError(
      'Cannot determine role presentational inheritance of a required parent outside the current scope.',
    );
  }
  if (!parentNodeNames.includes(vNode.parent.props.nodeName)) return null;

  const parentRole = getExplicitRole(vNode.parent, explicitRoleOptions);
  if (['none', 'presentation'].includes(parentRole as string) && !hasConflictResolution(vNode.parent)) {
    return parentRole;
  }
  if (parentRole) return null;
  return getInheritedRole(vNode.parent, explicitRoleOptions);
}

function resolveImplicitRole(
  vNode: VNode,
  { chromium, ...explicitRoleOptions }: { chromium?: boolean; fallback?: boolean; abstracts?: boolean; dpub?: boolean },
): string | null {
  const implicitRole = getImplicitRole(vNode, { chromium });
  if (!implicitRole) return null;
  const presentationalRole = getInheritedRole(vNode, explicitRoleOptions);
  if (presentationalRole) return presentationalRole;
  return implicitRole;
}

function hasConflictResolution(vNode: VNode): boolean {
  const hasGlobalAria = getGlobalAriaAttrs().some((attr) => vNode.hasAttr(attr));
  return hasGlobalAria || isFocusableRef(vNode);
}

function resolveRole(
  node: VNode | AnyNode,
  { noImplicit, ...roleOptions }: { noImplicit?: boolean; chromium?: boolean; fallback?: boolean; abstracts?: boolean; dpub?: boolean } = {},
): string | null {
  const { vNode } = nodeLookup(node);
  if (vNode.props.nodeType !== 1) return null;
  const explicitRole = getExplicitRole(vNode, roleOptions);
  if (!explicitRole) {
    return noImplicit ? null : resolveImplicitRole(vNode, roleOptions);
  }
  if (!['presentation', 'none'].includes(explicitRole)) return explicitRole;
  if (hasConflictResolution(vNode)) {
    return noImplicit ? null : resolveImplicitRole(vNode, roleOptions);
  }
  return explicitRole;
}

export function getRole(
  node: VNode | AnyNode,
  {
    noPresentational,
    ...options
  }: {
    noPresentational?: boolean;
    noImplicit?: boolean;
    chromium?: boolean;
    fallback?: boolean;
    abstracts?: boolean;
    dpub?: boolean;
  } = {},
): string | null {
  const role = resolveRole(node, options);
  if (noPresentational && ['presentation', 'none'].includes(role as string)) return null;
  return role;
}

export function namedFromContents(vNode: VNode | AnyNode, { strict }: { strict?: boolean } = {}): boolean {
  vNode = vNode instanceof VNode ? vNode : getNodeFromTree(vNode);
  if (vNode.props.nodeType !== 1) return false;
  const role = getRole(vNode);
  const roleDef = ariaRoles[role as string];
  if (roleDef && roleDef.nameFromContent) return true;
  if (strict) return false;
  return !roleDef || ['presentation', 'none'].includes(role as string);
}

// ── allowed / required attributes ────────────────────────────────

export function allowedAttr(role: string | null): string[] {
  const roleDef = ariaRoles[role as string];
  const attrs = [...getGlobalAriaAttrs()];
  if (!roleDef) return attrs;
  if (roleDef.allowedAttrs) attrs.push(...roleDef.allowedAttrs);
  if (roleDef.requiredAttrs) attrs.push(...roleDef.requiredAttrs);
  return attrs;
}

export function requiredAttr(role: string | null): string[] {
  const roleDef = ariaRoles[role as string];
  if (!roleDef || !Array.isArray(roleDef.requiredAttrs)) return [];
  return [...roleDef.requiredAttrs];
}

export function requiredContext(role: string | null): string[] | null {
  const roleDef = ariaRoles[role as string];
  if (!roleDef || !Array.isArray(roleDef.requiredContext)) return null;
  return [...roleDef.requiredContext];
}

export function requiredOwned(role: string | null): string[] | null {
  const roleDef = ariaRoles[role as string];
  if (!roleDef || !Array.isArray(roleDef.requiredOwned)) return null;
  return [...roleDef.requiredOwned];
}

export function validateAttr(att: string): boolean {
  return !!ariaAttrs[att];
}

export function validateAttrValue(vNode: VNode | AnyNode, attr: string): boolean | undefined {
  vNode = vNode instanceof VNode ? vNode : getNodeFromTree(vNode);
  let m: RegExpMatchArray | null;
  let list: string[];
  const value = vNode.attr(attr);
  const attrInfo = ariaAttrs[attr];

  if (!attrInfo) return true;
  if (attrInfo.allowEmpty && (!value || value.trim() === '')) return true;

  switch (attrInfo.type) {
    case 'boolean':
      return ['true', 'false'].includes((value as string).toLowerCase());
    case 'nmtoken':
      return typeof value === 'string' && attrInfo.values.includes(value.toLowerCase());
    case 'nmtokens':
      list = tokenList(value as string);
      return list.reduce(
        (result: boolean, token: string) => result && attrInfo.values.includes(token),
        list.length !== 0,
      );
    case 'idref':
      try {
        const doc = getRootNode(vNode.actualNode) as unknown as { getElementById: (id: string) => Element | null };
        return !!(value && doc.getElementById(value));
      } catch {
        throw new TypeError('Cannot resolve id references for partial DOM');
      }
    case 'idrefs':
      return idrefs(vNode, attr).some((node) => !!node);
    case 'string':
      return (value as string).trim() !== '';
    case 'decimal':
      m = (value as string).match(/^[-+]?([0-9]*)\.?([0-9]*)$/);
      return !!(m && (m[1] || m[2]));
    case 'int': {
      const minValue = typeof attrInfo.minValue !== 'undefined' ? attrInfo.minValue : -Infinity;
      return /^[-+]?[0-9]+$/.test(value as string) && parseInt(value as string, 10) >= minValue;
    }
    default:
      return undefined;
  }
}

// ── unallowed roles ──────────────────────────────────────────────

const dpubFallbackRoles = [
  'doc-backlink', 'doc-biblioentry', 'doc-biblioref', 'doc-cover',
  'doc-endnote', 'doc-glossref', 'doc-noteref',
];

const landmarkRoles: Record<string, string> = { header: 'banner', footer: 'contentinfo' };

function getRoleSegments(vNode: VNode | null): string[] {
  let roles: string[] = [];
  if (!vNode) return roles;
  if (vNode.hasAttr('role')) {
    const nodeRoles = tokenList((vNode.attr('role') || '').toLowerCase());
    roles = roles.concat(nodeRoles);
  }
  return roles.filter((role) => isValidRole(role));
}

export function isAriaRoleAllowedOnElement(node: VNode | AnyNode, role: string): boolean {
  const vNode = node instanceof VNode ? node : getNodeFromTree(node);
  const implicitRole = getImplicitRole(vNode);
  const spec = getElementSpec(vNode) as { allowedRoles?: boolean | string[] };
  if (Array.isArray(spec.allowedRoles)) return spec.allowedRoles.includes(role);
  if (role === implicitRole) return false;
  return !!spec.allowedRoles;
}

export function getElementUnallowedRoles(node: VNode | AnyNode, allowImplicit = true): string[] {
  const { vNode } = nodeLookup(node);
  if (!isHtmlElement(vNode)) return [];
  const { nodeName } = vNode.props;
  const implicitRole = getImplicitRole(vNode) || landmarkRoles[nodeName];
  const roleSegments = getRoleSegments(vNode);
  return roleSegments.filter((role) => !roleIsAllowed(role, vNode, allowImplicit, implicitRole));
}

function roleIsAllowed(role: string, vNode: VNode, allowImplicit: boolean, implicitRole: string | null): boolean {
  if (allowImplicit && role === implicitRole) return true;
  if (dpubFallbackRoles.includes(role) && getRoleType(role) !== implicitRole) return false;
  return isAriaRoleAllowedOnElement(vNode, role);
}

// ── owned virtual children ───────────────────────────────────────

export function getOwnedVirtual(virtualNode: VNode): VNode[] {
  const { children } = virtualNode;
  if (!children) throw new Error('getOwnedVirtual requires a virtual node');
  if (virtualNode.hasAttr('aria-owns')) {
    const owns = idrefs(virtualNode.actualNode, 'aria-owns')
      .filter((element) => !!element)
      .map((element) => getNodeFromTree(element as AnyNode));
    const uniqueOwns = owns.filter((own, index) => owns.indexOf(own) === index);
    const nativeChildren = children.filter((child) => !uniqueOwns.includes(child));
    return [...nativeChildren, ...uniqueOwns];
  }
  return [...children];
}

// ── accessible reference detection ───────────────────────────────

const idRefsRegex = /^idrefs?$/;

function cacheIdRefs(node: AnyNode, idRefs: Map<string, AnyNode[]>, refAttrs: string[]): void {
  const el = node as unknown as {
    hasAttribute?: (n: string) => boolean;
    getAttribute?: (n: string) => string | null;
    nodeName: string;
    childNodes: ArrayLike<AnyNode>;
  };
  if (el.hasAttribute) {
    if (el.nodeName.toUpperCase() === 'LABEL' && el.hasAttribute('for')) {
      const id = el.getAttribute!('for') as string;
      if (!idRefs.has(id)) idRefs.set(id, [node]);
      else idRefs.get(id)!.push(node);
    }
    for (let i = 0; i < refAttrs.length; ++i) {
      const attr = refAttrs[i];
      const attrValue = sanitize(el.getAttribute!(attr) || '');
      if (!attrValue) continue;
      for (const token of tokenList(attrValue)) {
        if (!idRefs.has(token)) idRefs.set(token, [node]);
        else idRefs.get(token)!.push(node);
      }
    }
  }
  for (let i = 0; i < el.childNodes.length; i++) {
    if (el.childNodes[i].nodeType === 1) cacheIdRefs(el.childNodes[i], idRefs, refAttrs);
  }
}

// Per-document cache of id-ref maps.
const idRefsByRoot = new WeakMap<object, Map<string, AnyNode[]>>();

export function getAccessibleRefs(node: VNode | AnyNode): AnyNode[] {
  const dom = (node instanceof VNode ? node.actualNode : node) as unknown as {
    id: string;
    documentElement?: AnyNode;
  };
  let root = getRootNode(dom as unknown as AnyNode) as unknown as { documentElement?: AnyNode };
  root = (root.documentElement || root) as unknown as { documentElement?: AnyNode };

  let idRefs = idRefsByRoot.get(root as unknown as object);
  if (!idRefs) {
    idRefs = new Map();
    idRefsByRoot.set(root as unknown as object, idRefs);
    const refAttrs = Object.keys(ariaAttrs).filter((attr) => {
      const { type } = ariaAttrs[attr];
      return idRefsRegex.test(type);
    });
    cacheIdRefs(root as unknown as AnyNode, idRefs, refAttrs);
  }
  return idRefs.get((dom as { id: string }).id) ?? [];
}

export function isAccessibleRef(node: VNode | AnyNode): boolean {
  return !!getAccessibleRefs(node).length;
}

// ── ARIA label text ──────────────────────────────────────────────

export function arialabelText(element: VNode | AnyNode): string {
  const { vNode } = nodeLookup(element);
  if (vNode?.props.nodeType !== 1) return '';
  return vNode.attr('aria-label') || '';
}

export function arialabelledbyText(
  element: VNode | AnyNode,
  context: { inLabelledByContext?: boolean; inControlContext?: boolean; startNode?: VNode } = {},
): string {
  const { vNode } = nodeLookup(element);
  if (vNode?.props.nodeType !== 1) return '';
  if (
    vNode.props.nodeType !== 1 ||
    context.inLabelledByContext ||
    context.inControlContext ||
    !vNode.attr('aria-labelledby')
  ) {
    return '';
  }
  const refs = idrefs(vNode, 'aria-labelledby').filter((elm) => elm) as AnyNode[];
  return refs.reduce((accessibleName: string, elm) => {
    const accessibleNameAdd = accessibleText(elm, {
      inLabelledByContext: true,
      startNode: context.startNode || vNode,
      ...context,
    });
    if (!accessibleName) return accessibleNameAdd;
    return `${accessibleName} ${accessibleNameAdd}`;
  }, '');
}

// ── aria label (visible) ─────────────────────────────────────────

export function labelVirtual(virtualNode: VNode): string | null {
  let ref: AnyNode[];
  let candidate: string | null;

  if (virtualNode.attr('aria-labelledby')) {
    ref = idrefs(virtualNode.actualNode, 'aria-labelledby') as AnyNode[];
    candidate = ref
      .map((thing) => {
        const vNode = thing ? getNodeFromTree(thing) : null;
        return vNode ? visibleVirtual(vNode) : '';
      })
      .join(' ')
      .trim();
    if (candidate) return candidate;
  }

  candidate = virtualNode.attr('aria-label');
  if (candidate) {
    candidate = sanitize(candidate);
    if (candidate) return candidate;
  }
  return null;
}

export function label(node: VNode | AnyNode): string | null {
  return labelVirtual(getNodeFromTree(node));
}

// ── combobox popup detection (for no-naming-method-matches) ──────

const isCombobox = (node: VNode): boolean => !!node && getRole(node) === 'combobox';

function nearestParentWithRole(vNode: VNode): VNode | null {
  let v: VNode | null = vNode;
  while ((v = v.parent)) {
    if (getRole(v, { noPresentational: true }) !== null) return v;
  }
  return null;
}

export function isComboboxPopup(virtualNode: VNode, { popupRoles }: { popupRoles?: string[] } = {}): boolean {
  const role = getRole(virtualNode);
  popupRoles ??= ariaAttrs['aria-haspopup'].values;
  if (!popupRoles!.includes(role as string)) return false;

  const vParent = nearestParentWithRole(virtualNode);
  if (vParent && isCombobox(vParent)) return true;

  const id = virtualNode.props.id;
  if (!id) return false;
  if (!virtualNode.actualNode) return false;

  const root = getRootNode(virtualNode.actualNode) as unknown as {
    querySelectorAll: (s: string) => ArrayLike<AnyNode>;
  };
  const ownedCombobox = Array.from(
    root.querySelectorAll(
      `[aria-owns~="${id}"][role~="combobox"]:not(select), [aria-controls~="${id}"][role~="combobox"]:not(select)`,
    ),
  );
  return ownedCombobox.some((n) => isCombobox(getNodeFromTree(n)));
}

// Lazy imports to break the aria↔dom↔text cycle at runtime.
import { idrefs, isFocusable as isFocusableRef } from './dom';
import { sanitize, accessibleText, visibleVirtual } from './text';
