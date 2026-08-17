/**
 * Vendored axe-core check `evaluate` functions for the 26 supported rules,
 * adapted to operate on real DOM (`node`) plus the `VNode` wrapper
 * (`virtualNode`). Each returns axe's tri-state EXACTLY: `true` = pass,
 * `false` = fail, `undefined` = incomplete / needs review.
 */
import { ariaAttrs, ariaRoles } from './standards';
import {
  VNode,
  getNodeFromTree,
  tokenList,
  parseTabindex,
  uniqueArray,
  isHtmlElement,
  escapeSelector,
  getRootNode,
  closest,
  type AnyNode,
} from './core';
import {
  getAriaValue,
  hasAriaValue,
  isValidRole,
  getRoleType,
  getRole,
  getExplicitRole,
  isUnsupportedRole,
  getElementUnallowedRoles,
  validateAttr,
  validateAttrValue,
  allowedAttr,
  requiredAttr,
  requiredOwned,
  requiredContext,
  getOwnedVirtual,
  arialabelText,
  arialabelledbyText,
  label,
} from './aria';
import {
  isVisibleToScreenReaders,
  isVisibleOnScreen,
  isFocusable,
  isInTabOrder,
  getResolvedRefs,
  hasContent,
  hasContentVirtual,
  isHTML5,
} from './dom';
import { getElementSpec, getGlobalAriaAttrs } from './stdhelpers';
import { sanitize, subtreeText, isValidAutocomplete, accessibleText, accessibleTextVirtual } from './text';
import * as tableUtils from './table';

// Document context for the two checks that read `document` globally.
let currentDocument: Document;
export function setDocument(doc: Document): void {
  currentDocument = doc;
}

// ── check result builder ─────────────────────────────────────────

export class CheckBuilder {
  _data: unknown = null;
  _related: (VNode | AnyNode)[] = [];
  data(d: unknown): void {
    this._data = d;
  }
  relatedNodes(nodes: (VNode | AnyNode) | (VNode | AnyNode)[]): void {
    this._related = Array.isArray(nodes) ? nodes : [nodes];
  }
}

type EvaluateFn = (this: CheckBuilder, node: AnyNode, options: Record<string, unknown>, virtualNode: VNode) => boolean | undefined;
type AfterFn = (results: { data: unknown; result: boolean | undefined }[]) => { data: unknown; result: boolean | undefined }[];

export interface CheckDef {
  evaluate: EvaluateFn;
  options?: Record<string, unknown>;
  after?: AfterFn;
}

// ── aria checks ──────────────────────────────────────────────────

const ariaHiddenBody: EvaluateFn = function (_node, _options, virtualNode) {
  return getAriaValue(virtualNode, 'aria-hidden', { lowercase: true })?.value !== 'true';
};

const invalidrole: EvaluateFn = function (_node, _options, virtualNode) {
  const allRoles = tokenList(virtualNode.attr('role'));
  const allInvalid = allRoles.every((role) => !isValidRole(role.toLowerCase(), { allowAbstract: true }));
  if (allInvalid) {
    this.data(allRoles);
    return true;
  }
  return false;
};

const abstractrole: EvaluateFn = function (_node, _options, virtualNode) {
  const abstractRoles = tokenList(virtualNode.attr('role')).filter((role) => getRoleType(role) === 'abstract');
  if (abstractRoles.length > 0) {
    this.data(abstractRoles);
    return true;
  }
  return false;
};

const unsupportedrole: EvaluateFn = function (_node, _options, virtualNode) {
  const role = getRole(virtualNode, { dpub: true, fallback: true });
  const isUnsupported = isUnsupportedRole(role);
  if (isUnsupported) this.data(role);
  return isUnsupported;
};

const deprecatedrole: EvaluateFn = function (_node, _options, virtualNode) {
  const role = getRole(virtualNode, { dpub: true, fallback: true });
  const roleDefinition = ariaRoles[role as string];
  if (!roleDefinition?.deprecated) return false;
  this.data(role);
  return true;
};

const ariaAllowedRole: EvaluateFn = function (_node, options = {}, virtualNode) {
  const { allowImplicit = true, ignoredTags = [] } = options as { allowImplicit?: boolean; ignoredTags?: string[] };
  const { nodeName } = virtualNode.props;
  if (ignoredTags.map((tag) => tag.toLowerCase()).includes(nodeName)) return true;
  const unallowedRoles = getElementUnallowedRoles(virtualNode, allowImplicit);
  if (unallowedRoles.length) {
    this.data(unallowedRoles);
    if (!isVisibleToScreenReaders(virtualNode)) return undefined;
    return false;
  }
  return true;
};

const ariaValidAttr: EvaluateFn = function (_node, options, virtualNode) {
  const opts = Array.isArray((options as { value?: unknown }).value) ? (options as { value: string[] }).value : [];
  const invalid: string[] = [];
  const aria = /^aria-/;
  virtualNode.attrNames.forEach((attr) => {
    if (opts.indexOf(attr) === -1 && aria.test(attr) && !validateAttr(attr)) invalid.push(attr);
  });
  if (invalid.length) {
    this.data(invalid);
    return false;
  }
  return true;
};

function isStringType(attrName: string): boolean {
  return ariaAttrs[attrName]?.type === 'string';
}

const ariaValidAttrValue: EvaluateFn = function (_node, options, virtualNode) {
  const opts = Array.isArray((options as { value?: unknown }).value) ? (options as { value: string[] }).value : [];
  let needsReview = '';
  let messageKey = '';
  const invalid: string[] = [];
  const aria = /^aria-/;
  const skipAttrs = ['aria-errormessage'];

  const preChecks: Record<string, (validValue?: boolean) => boolean | void> = {
    'aria-controls': () => {
      const hasPopup = !['false', null].includes(
        getAriaValue(virtualNode, 'aria-haspopup', { lowercase: true })?.value ?? null,
      );
      if (hasPopup) {
        needsReview = `aria-controls="${getAriaValue(virtualNode, 'aria-controls')?.value}"`;
        messageKey = 'controlsWithinPopup';
      }
      return (
        getAriaValue(virtualNode, 'aria-expanded', { lowercase: true })?.value !== 'false' &&
        getAriaValue(virtualNode, 'aria-selected', { lowercase: true })?.value !== 'false' &&
        hasPopup === false
      );
    },
    'aria-current': (validValue) => {
      if (!validValue) {
        needsReview = `aria-current="${getAriaValue(virtualNode, 'aria-current')?.value}"`;
        messageKey = 'ariaCurrent';
      }
      return;
    },
    'aria-owns': () => getAriaValue(virtualNode, 'aria-expanded', { lowercase: true })?.value !== 'false',
    'aria-describedby': (validValue) => {
      if (!validValue) {
        needsReview = `aria-describedby="${getAriaValue(virtualNode, 'aria-describedby')?.value}"`;
        messageKey = 'noId';
      }
      return;
    },
    'aria-labelledby': (validValue) => {
      if (!validValue) {
        needsReview = `aria-labelledby="${getAriaValue(virtualNode, 'aria-labelledby')?.value}"`;
        messageKey = 'noId';
      }
    },
  };

  virtualNode.attrNames.forEach((attrName) => {
    if (skipAttrs.includes(attrName) || opts.includes(attrName) || !aria.test(attrName)) return;
    let validValue: boolean | undefined;
    const attrValue = virtualNode.attr(attrName);
    try {
      validValue = validateAttrValue(virtualNode, attrName);
    } catch {
      needsReview = `${attrName}="${attrValue}"`;
      messageKey = 'idrefs';
      return;
    }
    if ((preChecks[attrName] ? preChecks[attrName](validValue) : true) && !validValue) {
      if (attrValue === '' && !isStringType(attrName)) {
        needsReview = attrName;
        messageKey = 'empty';
      } else {
        invalid.push(`${attrName}="${attrValue}"`);
      }
    }
  });

  if (invalid.length) {
    this.data(invalid);
    return false;
  }
  if (needsReview) {
    this.data({ messageKey, needsReview });
    return undefined;
  }
  return true;
};

const ariaErrormessage: EvaluateFn = function (_node, options, virtualNode) {
  const opts = Array.isArray(options) ? (options as unknown as string[]) : [];
  const errorMessageAttr = getAriaValue(virtualNode, 'aria-errormessage')?.value;
  const hasAttr = hasAriaValue(virtualNode, 'aria-errormessage');
  const invalid = getAriaValue(virtualNode, 'aria-invalid', { lowercase: true })?.value;
  const hasInvalid = hasAriaValue(virtualNode, 'aria-invalid');
  if (!hasInvalid || invalid === 'false') return true;

  const validateAttrValueLocal = (attr: string): boolean | undefined => {
    if (attr.trim() === '') return ariaAttrs['aria-errormessage'].allowEmpty;
    const errormessageTokens = tokenList(attr);
    if (errormessageTokens.length > 1) {
      this.data({ messageKey: 'unsupported', values: errormessageTokens });
      return false;
    }
    let idref: VNode | null;
    try {
      idref = getResolvedRefs(virtualNode, 'aria-errormessage')[0] ?? null;
    } catch {
      this.data({ messageKey: 'idrefs', values: errormessageTokens });
      return undefined;
    }
    if (idref) {
      if (!isVisibleToScreenReaders(idref)) {
        this.data({ messageKey: 'hidden', values: errormessageTokens });
        return false;
      }
      const describedbyTokens = tokenList(getAriaValue(virtualNode, 'aria-describedby')?.value ?? '');
      return (
        getExplicitRole(idref) === 'alert' ||
        getAriaValue(idref, 'aria-live')?.value === 'assertive' ||
        getAriaValue(idref, 'aria-live')?.value === 'polite' ||
        errormessageTokens.some((token) => describedbyTokens.includes(token))
      );
    }
    return undefined;
  };

  if (opts.indexOf(errorMessageAttr as string) === -1 && hasAttr) {
    this.data(tokenList(errorMessageAttr as string));
    return validateAttrValueLocal(errorMessageAttr as string);
  }
  return true;
};

const ariaLevel: EvaluateFn = function (_node, _options, virtualNode) {
  const ariaHeadingLevel = getAriaValue(virtualNode, 'aria-level')?.value;
  const ariaLevelValue = parseInt(ariaHeadingLevel as string, 10);
  if (ariaLevelValue > 6) return undefined;
  return true;
};

function ignoredAttrs(attrName: string, attrValue: string | null, vNode: VNode): boolean {
  if (attrName === 'aria-required' && attrValue === 'false') return true;
  if (attrName === 'aria-multiline' && attrValue === 'false' && vNode.hasAttr('contenteditable')) return true;
  return false;
}

const ariaAllowedAttr: EvaluateFn = function (_node, options, virtualNode) {
  const invalid: string[] = [];
  const role = getRole(virtualNode);
  let allowed = allowedAttr(role);
  const opts = options as Record<string, unknown>;
  if (Array.isArray(opts[role as string])) {
    allowed = uniqueArray(opts[role as string] as string[], allowed);
  }
  for (const attrName of virtualNode.attrNames) {
    if (validateAttr(attrName) && !allowed.includes(attrName) && !ignoredAttrs(attrName, virtualNode.attr(attrName), virtualNode)) {
      invalid.push(attrName);
    }
  }
  if (!invalid.length) return true;
  this.data(invalid.map((attrName) => attrName + '="' + virtualNode.attr(attrName) + '"'));
  if (!role && !isHtmlElement(virtualNode) && !isFocusable(virtualNode)) return undefined;
  return false;
};

const ariaAllowedAttrElm: EvaluateFn = function (_node, _options, virtualNode) {
  const elmSpec = getElementSpec(virtualNode) as { allowedAriaAttrs?: string[] };
  if (!elmSpec.allowedAriaAttrs) return true;
  const explicitRole = getExplicitRole(virtualNode);
  if (explicitRole) return true;
  const { allowedAriaAttrs } = elmSpec;
  const globalAriaAttrs = getGlobalAriaAttrs();
  const invalid: string[] = [];
  for (const attrName of virtualNode.attrNames) {
    if (globalAriaAttrs.includes(attrName) && !allowedAriaAttrs.includes(attrName)) invalid.push(attrName);
  }
  if (!invalid.length) return true;
  this.data({ values: invalid });
  return false;
};

const ariaUnsupportedAttr: EvaluateFn = function (_node, _options, virtualNode) {
  // No ARIA attribute in the standards table is marked unsupported, so this
  // always passes (faithful port — kept for the aria-allowed-attr rule's `none`).
  const unsupportedAttrs = virtualNode.attrNames.filter((name) => {
    const attribute = ariaAttrs[name];
    if (!validateAttr(name)) return false;
    const { unsupported } = attribute;
    if (typeof unsupported !== 'object') return !!unsupported;
    return false;
  });
  if (unsupportedAttrs.length) {
    this.data(unsupportedAttrs);
    return true;
  }
  return false;
};

function getClosestAncestorRoleType(vNode: VNode | null): string | undefined {
  if (!vNode) return undefined;
  const role = getRole(vNode, { noPresentational: true, chromium: true });
  if (role) return getRoleType(role) ?? undefined;
  return getClosestAncestorRoleType(vNode.parent);
}

function listProhibitedAttrs(vNode: VNode, role: string | null, nodeName: string, elementsAllowedAriaLabel: string[]): string[] {
  const roleSpec = ariaRoles[role as string];
  if (roleSpec) return roleSpec.prohibitedAttrs || [];
  if (!!role || elementsAllowedAriaLabel.includes(nodeName) || getClosestAncestorRoleType(vNode) === 'widget') {
    return [];
  }
  return ['aria-label', 'aria-labelledby'];
}

const ariaProhibitedAttr: EvaluateFn = function (_node, options = {}, virtualNode) {
  const elementsAllowedAriaLabel = (options as { elementsAllowedAriaLabel?: string[] }).elementsAllowedAriaLabel || [];
  const { nodeName } = virtualNode.props;
  const role = getRole(virtualNode, { chromium: true, fallback: true });
  const prohibitedList = listProhibitedAttrs(virtualNode, role, nodeName, elementsAllowedAriaLabel);
  const prohibited = prohibitedList.filter((attrName) => {
    if (!virtualNode.attrNames.includes(attrName)) return false;
    return sanitize(virtualNode.attr(attrName)) !== '';
  });
  if (prohibited.length === 0) return false;
  let messageKey = role !== null ? 'hasRole' : 'noRole';
  messageKey += prohibited.length > 1 ? 'Plural' : 'Singular';
  this.data({ role, nodeName, messageKey, prohibited });
  const textContent = subtreeText(virtualNode, { subtreeDescendant: true });
  if (sanitize(textContent) !== '') return undefined;
  return true;
};

function hasImplicitAttr(elmSpec: { implicitAttrs?: Record<string, unknown> }, attr: string): boolean {
  return elmSpec.implicitAttrs?.[attr] !== undefined;
}
function isStaticSeparator(vNode: VNode, role: string | null): boolean {
  return role === 'separator' && !isFocusable(vNode);
}
function isClosedCombobox(vNode: VNode, role: string | null): boolean {
  return role === 'combobox' && getAriaValue(vNode, 'aria-expanded', { lowercase: true })?.value === 'false';
}

const ariaRequiredAttr: EvaluateFn = function (_node, options = {}, virtualNode) {
  const role = getExplicitRole(virtualNode);
  const attrs = virtualNode.attrNames;
  let requiredAttrs = requiredAttr(role);
  const opts = options as Record<string, unknown>;
  if (Array.isArray(opts[role as string])) {
    requiredAttrs = uniqueArray(opts[role as string] as string[], requiredAttrs);
  }
  if (!role || !attrs.length || !requiredAttrs.length) return true;
  if (isStaticSeparator(virtualNode, role) || isClosedCombobox(virtualNode, role)) return true;
  if (role === 'slider' && getAriaValue(virtualNode, 'aria-valuetext')?.value) return true;
  const elmSpec = getElementSpec(virtualNode) as { implicitAttrs?: Record<string, unknown> };
  const missingAttrs = requiredAttrs.filter(
    (ra) => !getAriaValue(virtualNode, ra)?.value && !hasImplicitAttr(elmSpec, ra),
  );
  if (missingAttrs.length) {
    this.data(missingAttrs);
    return false;
  }
  return true;
};

function getGlobalAriaAttr(vNode: VNode): string | undefined {
  return getGlobalAriaAttrs().find((attr) => vNode.hasAttr(attr));
}

function getOwnedRoles(virtualNode: VNode, required: string[]): { role: string | null; attr?: string; vNode: VNode }[] {
  let vNode: VNode | undefined;
  const ownedRoles: { role: string | null; attr?: string; vNode: VNode }[] = [];
  const ownedVirtual = getOwnedVirtual(virtualNode);
  while ((vNode = ownedVirtual.shift())) {
    if (vNode.props.nodeType === 3) ownedRoles.push({ vNode, role: null });
    if (vNode.props.nodeType !== 1 || !isVisibleToScreenReaders(vNode)) continue;
    const role = getRole(vNode, { noPresentational: true });
    const globalAriaAttr = getGlobalAriaAttr(vNode);
    const hasGlobalAriaOrFocusable = !!globalAriaAttr || isFocusable(vNode);
    if (
      (!role && !hasGlobalAriaOrFocusable) ||
      (['group', 'rowgroup'].includes(role as string) && required.some((r) => r === role))
    ) {
      ownedVirtual.push(...vNode.children);
    } else if (role || hasGlobalAriaOrFocusable) {
      const attr = globalAriaAttr || (vNode.hasAttr('tabindex') ? 'tabindex' : undefined);
      ownedRoles.push({ role, attr, vNode });
    }
  }
  return ownedRoles;
}

function hasRequiredChildren(required: string[], ownedRoles: { role: string | null }[]): boolean {
  return ownedRoles.some(({ role }) => role && required.includes(role));
}

function getUnallowedSelector(vNode: VNode, attr?: string): string {
  const { nodeName, nodeType } = vNode.props;
  if (nodeType === 3) return `#text`;
  const role = getExplicitRole(vNode, { dpub: true });
  if (role) return `[role=${role}]`;
  if (attr) return nodeName + `[${attr}]`;
  return nodeName;
}

function isContentOwned({ vNode }: { vNode: VNode }): boolean {
  if (vNode.props.nodeType === 3) return (vNode.props.nodeValue || '').trim().length > 0;
  return hasContentVirtual(vNode, false, true);
}

const ariaRequiredChildren: EvaluateFn = function (_node, options, virtualNode) {
  const reviewEmpty = options && Array.isArray((options as { reviewEmpty?: unknown }).reviewEmpty)
    ? (options as { reviewEmpty: string[] }).reviewEmpty
    : [];
  const explicitRole = getExplicitRole(virtualNode, { dpub: true });
  const required = requiredOwned(explicitRole);
  if (required === null) return true;

  const ownedRoles = getOwnedRoles(virtualNode, required);
  const unallowed = ownedRoles.filter(({ role, vNode }) => vNode.props.nodeType === 1 && !required.includes(role as string));

  if (unallowed.length) {
    this.relatedNodes(unallowed.map(({ vNode }) => vNode));
    const messageKey = getAriaValue(virtualNode, 'aria-busy')?.value === 'true' ? 'aria-busy-fail' : 'unallowed';
    this.data({
      messageKey,
      values: unallowed
        .map(({ vNode, attr }) => getUnallowedSelector(vNode, attr))
        .filter((selector, index, array) => array.indexOf(selector) === index)
        .join(', '),
    });
    return false;
  }
  if (hasRequiredChildren(required, ownedRoles)) return true;
  if (getAriaValue(virtualNode, 'aria-busy')?.value === 'true') {
    this.data({ messageKey: 'aria-busy' });
    return true;
  }
  this.data(required);
  if (reviewEmpty.includes(explicitRole as string) && !ownedRoles.some(isContentOwned)) return undefined;
  return false;
};

function getMissingContext(
  virtualNode: VNode,
  ownGroupRoles: string[],
  reqContext: string[] | null,
  includeElement?: boolean,
): string[] | null {
  const explicitRole = getExplicitRole(virtualNode);
  if (!reqContext) reqContext = requiredContext(explicitRole);
  if (!reqContext) return null;
  const allowsGroup = reqContext.includes('group');
  let vNode: VNode | null = includeElement ? virtualNode : virtualNode.parent;
  while (vNode) {
    const role = getRole(vNode, { noPresentational: true });
    if (!role) {
      vNode = vNode.parent;
    } else if (role === 'group' && allowsGroup) {
      if (ownGroupRoles.includes(explicitRole as string)) reqContext.push(explicitRole as string);
      reqContext = reqContext.filter((r) => r !== 'group');
      vNode = vNode.parent;
    } else if (reqContext.includes(role)) {
      return null;
    } else {
      return reqContext;
    }
  }
  return reqContext;
}

// Per-document reverse index of `aria-owns`: referenced id → owning elements.
// Built once by scanning every `[aria-owns]` element, then reused for the whole
// document (keyed by root node, scoped per scan). The previous implementation
// ran a full-document `querySelector('[aria-owns~=id]')` for *every* ancestor of
// *every* aria-required-parent candidate; in jsdom (JS `querySelector`, not
// native) that went quadratic and froze scans at 40% "Analyzing pages" on large
// storefronts (~40s for one 8k-node page). Index lookups make it linear.
const ariaOwnsIndexByRoot = new WeakMap<object, Map<string, AnyNode[]>>();

function getAriaOwnsIndex(root: AnyNode): Map<string, AnyNode[]> {
  const cached = ariaOwnsIndexByRoot.get(root as unknown as object);
  if (cached) return cached;
  const idx = new Map<string, AnyNode[]>();
  ariaOwnsIndexByRoot.set(root as unknown as object, idx);
  const scope = root as unknown as { querySelectorAll?: (s: string) => ArrayLike<AnyNode> };
  const owners = scope.querySelectorAll ? Array.from(scope.querySelectorAll('[aria-owns]')) : [];
  for (const owner of owners) {
    const val = (owner as unknown as { getAttribute: (a: string) => string | null }).getAttribute('aria-owns') || '';
    // `[aria-owns~=id]` matches whitespace-separated tokens — tokenize the same way.
    for (const token of val.split(/\s+/)) {
      if (!token) continue;
      const list = idx.get(token);
      if (list) list.push(owner);
      else idx.set(token, [owner]);
    }
  }
  return idx;
}

function getAriaOwners(element: AnyNode): AnyNode[] | null {
  const idx = getAriaOwnsIndex(getRootNode(element));
  if (idx.size === 0) return null; // no `aria-owns` anywhere → nothing can own this subtree
  const owners: AnyNode[] = [];
  let el: { getAttribute?: (a: string) => string | null; parentElement?: AnyNode | null } | null =
    element as unknown as { getAttribute?: (a: string) => string | null; parentElement?: AnyNode | null };
  while (el) {
    const id = el.getAttribute ? el.getAttribute('id') : null;
    if (id) {
      // Preserve prior single-match semantics (`querySelector` → first owner).
      const found = idx.get(id);
      if (found && found[0]) owners.push(found[0]);
    }
    el = (el as { parentElement?: AnyNode | null }).parentElement as never;
  }
  return owners.length ? owners : null;
}

const ariaRequiredParent: EvaluateFn = function (node, options, virtualNode) {
  const ownGroupRoles = options && Array.isArray((options as { ownGroupRoles?: unknown }).ownGroupRoles)
    ? (options as { ownGroupRoles: string[] }).ownGroupRoles
    : [];
  let missingParents = getMissingContext(virtualNode, ownGroupRoles, null);
  if (!missingParents) return true;
  const owners = getAriaOwners(node);
  if (owners) {
    for (let i = 0, l = owners.length; i < l; i++) {
      missingParents = getMissingContext(getNodeFromTree(owners[i]), ownGroupRoles, missingParents, true);
      if (!missingParents) return true;
    }
  }
  this.data(missingParents);
  return false;
};

const hasGlobalAriaAttribute: EvaluateFn = function (_node, _options, virtualNode) {
  const globalAttrs = getGlobalAriaAttrs().filter((attr) => virtualNode.hasAttr(attr));
  this.data(globalAttrs);
  return globalAttrs.length > 0;
};

const isElementFocusable: EvaluateFn = function (_node, _options, virtualNode) {
  return isFocusable(virtualNode);
};

// ── parsing ──────────────────────────────────────────────────────

const duplicateId: EvaluateFn = function (node) {
  const id = ((node as unknown as { getAttribute: (a: string) => string }).getAttribute('id') || '').trim();
  if (!id) return true;
  const root = getRootNode(node) as unknown as { querySelectorAll: (s: string) => ArrayLike<AnyNode> };
  const matchingNodes = Array.from(root.querySelectorAll(`[id="${escapeSelector(id)}"]`)).filter(
    (foundNode) => foundNode !== node,
  );
  if (matchingNodes.length) this.relatedNodes(matchingNodes);
  this.data(id);
  return matchingNodes.length === 0;
};

const duplicateIdAfter: AfterFn = function (results) {
  const uniqueIds: unknown[] = [];
  return results.filter((r) => {
    if (uniqueIds.indexOf(r.data) === -1) {
      uniqueIds.push(r.data);
      return true;
    }
    return false;
  });
};

// ── forms ────────────────────────────────────────────────────────

const autocompleteValid: EvaluateFn = function (_node, options, virtualNode) {
  const autocomplete = virtualNode.attr('autocomplete') || '';
  return isValidAutocomplete(autocomplete, options as Record<string, never>);
};

// ── keyboard ─────────────────────────────────────────────────────

function usesUnreliableHidingStrategy(vNode: VNode): boolean {
  const tabIndex = parseTabindex(vNode.attr('tabindex'));
  return tabIndex !== null && tabIndex < 0;
}

function getFocusableDescendants(vNode: VNode): VNode[] {
  if (!vNode.children) {
    if (vNode.props.nodeType === 1) throw new Error('Cannot determine children');
    return [];
  }
  const retVal: VNode[] = [];
  vNode.children.forEach((child) => {
    if (getRoleType(child) === 'widget' && isFocusable(child)) retVal.push(child);
    else retVal.push(...getFocusableDescendants(child));
  });
  return retVal;
}

const noFocusableContent: EvaluateFn = function (_node, _options, virtualNode) {
  if (!virtualNode.children) return undefined;
  try {
    const focusableDescendants = getFocusableDescendants(virtualNode);
    if (!focusableDescendants.length) return true;
    const notHiddenElements = focusableDescendants.filter(usesUnreliableHidingStrategy);
    if (notHiddenElements.length > 0) {
      this.data({ messageKey: 'notHidden' });
      this.relatedNodes(notHiddenElements);
    } else {
      this.relatedNodes(focusableDescendants);
    }
    return false;
  } catch {
    return undefined;
  }
};

const tabindexCheck: EvaluateFn = function (_node, _options, virtualNode) {
  const tabIndex = parseTabindex(virtualNode.attr('tabindex'));
  return tabIndex === null || tabIndex <= 0;
};

// ── tables ───────────────────────────────────────────────────────

const tdHasHeader: EvaluateFn = function (node) {
  const badCells: AnyNode[] = [];
  const cells = tableUtils.getAllCells(node as never);
  const tableGrid = tableUtils.toGrid(node as never);
  cells.forEach((cell) => {
    if (hasContent(cell) && tableUtils.isDataCell(cell) && !label(cell)) {
      const hasHeaders = tableUtils.getHeaders(cell, tableGrid).some((header) => header !== null && !!hasContent(header));
      if (!hasHeaders) badCells.push(cell);
    }
  });
  if (badCells.length) {
    this.relatedNodes(badCells);
    return false;
  }
  return true;
};

const thHasDataCells: EvaluateFn = function (node) {
  const cells = tableUtils.getAllCells(node as never);
  let reffedHeaders: string[] = [];
  cells.forEach((cell) => {
    const headers = (cell as unknown as { getAttribute: (a: string) => string | null }).getAttribute('headers');
    if (headers) reffedHeaders = reffedHeaders.concat(headers.split(/\s+/));
    const ariaLabel = (cell as unknown as { getAttribute: (a: string) => string | null }).getAttribute('aria-labelledby');
    if (ariaLabel) reffedHeaders = reffedHeaders.concat(ariaLabel.split(/\s+/));
  });
  const headers = cells.filter((cell) => {
    if (sanitize((cell as unknown as { textContent: string }).textContent) === '') return false;
    return (
      (cell as unknown as { nodeName: string }).nodeName.toUpperCase() === 'TH' ||
      ['rowheader', 'columnheader'].indexOf(getExplicitRole(cell) as string) !== -1
    );
  });
  const tableGrid = tableUtils.toGrid(node as never);
  let out: boolean = true;
  headers.forEach((header) => {
    const h = header as unknown as { getAttribute: (a: string) => string | null };
    if (h.getAttribute('id') && reffedHeaders.includes(h.getAttribute('id') as string)) return;
    const pos = tableUtils.getCellPosition(header, tableGrid)!;
    let hasCell: unknown = false;
    if (tableUtils.isColumnHeader(header)) {
      hasCell = tableUtils
        .traverse('down', pos, tableGrid)
        .find((cell) => !tableUtils.isColumnHeader(cell) && tableUtils.getHeaders(cell, tableGrid).includes(header));
    }
    if (!hasCell && tableUtils.isRowHeader(header)) {
      hasCell = tableUtils
        .traverse('right', pos, tableGrid)
        .find((cell) => !tableUtils.isRowHeader(cell) && tableUtils.getHeaders(cell, tableGrid).includes(header));
    }
    if (!hasCell) this.relatedNodes(header);
    out = out && !!hasCell;
  });
  return out ? true : undefined;
};

const tdHeadersAttrMessageKeys = ['cell-header-not-in-table', 'cell-header-not-th', 'header-refs-self', 'empty-hdrs'];
const tdHeadersAttr: EvaluateFn = function (node) {
  const [notInTable, notTh, selfRef, emptyHdrs] = tdHeadersAttrMessageKeys;
  const tableNode = node as unknown as { rows: ArrayLike<{ cells: ArrayLike<AnyNode> }> };
  const cells: AnyNode[] = [];
  const cellRoleById: Record<string, string | null> = {};
  for (let rowIndex = 0; rowIndex < tableNode.rows.length; rowIndex++) {
    const row = tableNode.rows[rowIndex];
    for (let cellIndex = 0; cellIndex < row.cells.length; cellIndex++) {
      const cell = row.cells[cellIndex];
      cells.push(cell);
      const cellId = (cell as unknown as { getAttribute: (a: string) => string | null }).getAttribute('id');
      if (cellId) cellRoleById[cellId] = getRole(cell);
    }
  }
  const badCells: Record<string, Set<AnyNode>> = {
    [selfRef]: new Set(),
    [notInTable]: new Set(),
    [notTh]: new Set(),
    [emptyHdrs]: new Set(),
  };
  cells.forEach((cell) => {
    const c = cell as unknown as { hasAttribute: (a: string) => boolean; getAttribute: (a: string) => string | null };
    if (!c.hasAttribute('headers') || !isVisibleToScreenReaders(cell)) return;
    const headersAttr = (c.getAttribute('headers') || '').trim();
    if (!headersAttr) {
      badCells[emptyHdrs].add(cell);
      return;
    }
    const cellId = c.getAttribute('id');
    const headers = tokenList(headersAttr);
    headers.forEach((headerId) => {
      if (cellId && headerId === cellId) badCells[selfRef].add(cell);
      else if (!cellRoleById[headerId]) badCells[notInTable].add(cell);
      else if (!['columnheader', 'rowheader'].includes(cellRoleById[headerId] as string)) badCells[notTh].add(cell);
    });
  });
  for (const messageKey of tdHeadersAttrMessageKeys) {
    if (badCells[messageKey].size > 0) {
      this.relatedNodes([...badCells[messageKey]]);
      if (messageKey === emptyHdrs) return undefined;
      this.data({ messageKey });
      return false;
    }
  }
  return true;
};

const html5Scope: EvaluateFn = function (node) {
  if (!isHTML5(currentDocument)) return true;
  return (node as unknown as { nodeName: string }).nodeName.toUpperCase() === 'TH';
};

const scopeValue: EvaluateFn = function (node, options) {
  const value = ((node as unknown as { getAttribute: (a: string) => string }).getAttribute('scope') || '').toLowerCase();
  return (options as { values: string[] }).values.indexOf(value) !== -1;
};

// ── shared ───────────────────────────────────────────────────────

const docHasTitle: EvaluateFn = function () {
  const title = currentDocument.title;
  return !!sanitize(title);
};

const attrNonSpaceContent: EvaluateFn = function (_node, options = {}, vNode) {
  const attribute = (options as { attribute?: string }).attribute;
  if (!attribute || typeof attribute !== 'string') {
    throw new TypeError('attr-non-space-content requires options.attribute to be a string');
  }
  if (!vNode.hasAttr(attribute)) {
    this.data({ messageKey: 'noAttr' });
    return false;
  }
  if (!sanitize(vNode.attr(attribute))) {
    this.data({ messageKey: 'emptyAttr' });
    return false;
  }
  return true;
};

const ariaLabelCheck: EvaluateFn = function (_node, _options, virtualNode) {
  return !!sanitize(arialabelText(virtualNode));
};

const ariaLabelledbyCheck: EvaluateFn = function (_node, _options, virtualNode) {
  try {
    return !!sanitize(arialabelledbyText(virtualNode));
  } catch {
    return undefined;
  }
};

const presentationalRole: EvaluateFn = function (_node, _options, virtualNode) {
  const explicitRole = getExplicitRole(virtualNode);
  if (
    ['presentation', 'none'].includes(explicitRole as string) &&
    ['iframe', 'frame'].includes(virtualNode.props.nodeName) &&
    virtualNode.hasAttr('title')
  ) {
    this.data({ messageKey: 'iframe', nodeName: virtualNode.props.nodeName });
    return false;
  }
  const role = getRole(virtualNode);
  if (['presentation', 'none'].includes(role as string)) {
    this.data({ role });
    return true;
  }
  if (!['presentation', 'none'].includes(explicitRole as string)) return false;
  const hasGlobalAria = getGlobalAriaAttrs().some((attr) => virtualNode.hasAttr(attr));
  const focusable = isFocusable(virtualNode);
  let messageKey: string;
  if (hasGlobalAria && !focusable) messageKey = 'globalAria';
  else if (!hasGlobalAria && focusable) messageKey = 'focusable';
  else messageKey = 'both';
  this.data({ messageKey, role });
  return false;
};

const isOnScreen: EvaluateFn = function (node) {
  return isVisibleOnScreen(node);
};

// ── navigation ───────────────────────────────────────────────────

const uniqueFrameTitle: EvaluateFn = function (_node, _options, vNode) {
  const title = sanitize(vNode.attr('title')).toLowerCase();
  this.data(title);
  return true;
};

const uniqueFrameTitleAfter: AfterFn = function (results) {
  const titles: Record<string, number> = {};
  results.forEach((r) => {
    const key = r.data as string;
    titles[key] = titles[key] !== undefined ? ++titles[key] : 0;
  });
  results.forEach((r) => {
    r.result = !!titles[r.data as string];
  });
  return results;
};

const separatorRegex = /[;,\s]/;
const validRedirectNumRegex = /^[0-9.]+$/;
const metaRefresh: EvaluateFn = function (_node, options, virtualNode) {
  const { minDelay, maxDelay } = (options || {}) as { minDelay?: number; maxDelay?: number };
  const content = (virtualNode.attr('content') || '').trim();
  const [redirectStr] = content.split(separatorRegex);
  if (!redirectStr.match(validRedirectNumRegex)) return true;
  const redirectDelay = parseFloat(redirectStr);
  this.data({ redirectDelay });
  if (typeof minDelay === 'number' && redirectDelay <= minDelay) return true;
  if (typeof maxDelay === 'number' && redirectDelay > maxDelay) return true;
  return false;
};

// ── name/label/landmark checks (button-name, link-name, label, etc.) ─

const hasTextContent: EvaluateFn = function (_node, _options, virtualNode) {
  try {
    return sanitize(subtreeText(virtualNode)) !== '';
  } catch {
    return undefined;
  }
};

const focusableNoName: EvaluateFn = function (_node, _options, virtualNode) {
  if (!isInTabOrder(virtualNode)) return false;
  try {
    return !accessibleTextVirtual(virtualNode);
  } catch {
    return undefined;
  }
};

const implicitLabel: EvaluateFn = function (_node, _options, virtualNode) {
  try {
    const labelNode = closest(virtualNode, 'label');
    if (labelNode) {
      const implicit = sanitize(
        accessibleTextVirtual(labelNode, { inControlContext: true, startNode: virtualNode }),
      );
      if (labelNode.actualNode) this.relatedNodes([labelNode]);
      this.data({ implicitLabel: implicit });
      return !!implicit;
    }
    return false;
  } catch {
    return undefined;
  }
};

const explicitLabel: EvaluateFn = function (_node, _options, virtualNode) {
  if (!virtualNode.attr('id')) return false;
  if (!virtualNode.actualNode) return undefined;
  const root = getRootNode(virtualNode.actualNode) as unknown as {
    querySelectorAll: (s: string) => ArrayLike<AnyNode>;
  };
  const id = escapeSelector(virtualNode.attr('id') as string);
  const labels = Array.from(root.querySelectorAll(`label[for="${id}"]`));
  this.relatedNodes(labels);
  if (!labels.length) return false;
  try {
    return labels.some((labelNode) => {
      if (!isVisibleOnScreen(labelNode)) return true;
      const explicit = sanitize(
        accessibleText(labelNode, { inControlContext: true, startNode: virtualNode }),
      );
      this.data({ explicitLabel: explicit });
      return !!explicit;
    });
  } catch {
    return undefined;
  }
};

const hiddenExplicitLabel: EvaluateFn = function (node, _options, virtualNode) {
  if (virtualNode.hasAttr('id')) {
    if (!virtualNode.actualNode) return undefined;
    const root = getRootNode(node) as unknown as { querySelector: (s: string) => AnyNode | null };
    const id = escapeSelector((node as unknown as { getAttribute: (a: string) => string }).getAttribute('id'));
    const labelNode = root.querySelector(`label[for="${id}"]`);
    if (labelNode && !isVisibleToScreenReaders(labelNode)) {
      let name: string;
      try {
        name = accessibleTextVirtual(virtualNode).trim();
      } catch {
        return undefined;
      }
      return name === '';
    }
  }
  return false;
};

const landmarkIsUnique: EvaluateFn = function (node, _options, virtualNode) {
  const role = getRole(node);
  let accText: string | null = accessibleTextVirtual(virtualNode);
  accText = accText ? accText.toLowerCase() : null;
  this.data({ role, accessibleText: accText });
  this.relatedNodes([virtualNode]);
  return true;
};

const landmarkIsUniqueAfter: AfterFn = function (results) {
  const uniqueLandmarks: { data: unknown; result: boolean | undefined }[] = [];
  return results.filter((currentResult) => {
    const cur = currentResult.data as { role: string | null; accessibleText: string | null };
    const matched = uniqueLandmarks.find((some) => {
      const s = some.data as { role: string | null; accessibleText: string | null };
      return cur.role === s.role && cur.accessibleText === s.accessibleText;
    });
    if (matched) {
      matched.result = false;
      return false;
    }
    uniqueLandmarks.push(currentResult);
    return true;
  });
};

// ── registry ─────────────────────────────────────────────────────

export const checks: Record<string, CheckDef> = {
  'button-has-visible-text': { evaluate: hasTextContent },
  'has-visible-text': { evaluate: hasTextContent },
  'non-empty-placeholder': { evaluate: attrNonSpaceContent, options: { attribute: 'placeholder' } },
  'focusable-no-name': { evaluate: focusableNoName },
  'implicit-label': { evaluate: implicitLabel },
  'explicit-label': { evaluate: explicitLabel },
  'hidden-explicit-label': { evaluate: hiddenExplicitLabel },
  'landmark-is-unique': { evaluate: landmarkIsUnique, after: landmarkIsUniqueAfter },
  'aria-hidden-body': { evaluate: ariaHiddenBody },
  invalidrole: { evaluate: invalidrole },
  abstractrole: { evaluate: abstractrole },
  unsupportedrole: { evaluate: unsupportedrole },
  deprecatedrole: { evaluate: deprecatedrole },
  'aria-allowed-role': { evaluate: ariaAllowedRole, options: { allowImplicit: true, ignoredTags: [] } },
  'aria-valid-attr': { evaluate: ariaValidAttr },
  'aria-valid-attr-value': { evaluate: ariaValidAttrValue },
  'aria-errormessage': { evaluate: ariaErrormessage },
  'aria-level': { evaluate: ariaLevel },
  'aria-allowed-attr': {
    evaluate: ariaAllowedAttr,
    options: { validTreeRowAttrs: ['aria-posinset', 'aria-setsize', 'aria-expanded', 'aria-level'] },
  },
  'aria-allowed-attr-elm': { evaluate: ariaAllowedAttrElm },
  'aria-unsupported-attr': { evaluate: ariaUnsupportedAttr },
  'aria-prohibited-attr': { evaluate: ariaProhibitedAttr, options: { elementsAllowedAriaLabel: ['applet', 'input'] } },
  'aria-required-attr': { evaluate: ariaRequiredAttr },
  'aria-required-children': {
    evaluate: ariaRequiredChildren,
    options: {
      reviewEmpty: [
        'doc-bibliography', 'doc-endnotes', 'grid', 'list', 'listbox', 'menu',
        'menubar', 'table', 'tablist', 'tree', 'treegrid', 'rowgroup',
      ],
    },
  },
  'aria-required-parent': { evaluate: ariaRequiredParent, options: { ownGroupRoles: ['listitem', 'treeitem'] } },
  'has-global-aria-attribute': { evaluate: hasGlobalAriaAttribute },
  'is-element-focusable': { evaluate: isElementFocusable },
  'duplicate-id-aria': { evaluate: duplicateId, after: duplicateIdAfter },
  'autocomplete-valid': {
    evaluate: autocompleteValid,
    options: {
      stateTerms: ['none', 'false', 'true', 'disabled', 'enabled', 'undefined', 'null', 'xoff', 'xon'],
      ignoredValues: ['text', 'pronouns', 'gender', 'message', 'content'],
    },
  },
  'no-focusable-content': { evaluate: noFocusableContent },
  tabindex: { evaluate: tabindexCheck },
  'td-has-header': { evaluate: tdHasHeader },
  'th-has-data-cells': { evaluate: thHasDataCells },
  'td-headers-attr': { evaluate: tdHeadersAttr },
  'html5-scope': { evaluate: html5Scope },
  'scope-value': { evaluate: scopeValue, options: { values: ['row', 'col', 'rowgroup', 'colgroup'] } },
  'doc-has-title': { evaluate: docHasTitle },
  'non-empty-title': { evaluate: attrNonSpaceContent, options: { attribute: 'title' } },
  'aria-label': { evaluate: ariaLabelCheck },
  'aria-labelledby': { evaluate: ariaLabelledbyCheck },
  'presentational-role': { evaluate: presentationalRole },
  'is-on-screen': { evaluate: isOnScreen },
  'unique-frame-title': { evaluate: uniqueFrameTitle, after: uniqueFrameTitleAfter },
  'meta-refresh': { evaluate: metaRefresh, options: { minDelay: 0, maxDelay: 72000 } },
};
