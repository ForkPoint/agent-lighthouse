/**
 * Text helpers (`commons/text`): accessible-name computation and the
 * autocomplete validator, operating on real jsdom DOM via `VNode`.
 *
 * Icon-ligature detection (canvas-based) is dropped — our checks never request
 * it. Unicode/emoji helpers are not needed by the ported rules.
 */
import { VNode, getNodeFromTree, nodeLookup, type AnyNode } from './core';
import {
  getRole,
  getExplicitRole,
  getAriaValue,
  hasAriaValue,
  getOwnedVirtual,
  arialabelledbyText,
  arialabelText,
  namedFromContents,
} from './aria';
import { isVisibleToScreenReaders, isVisibleOnScreen, isHiddenForEveryone } from './dom';
import { getElementSpec, getElementsByContentType } from './stdhelpers';

// ── sanitize ─────────────────────────────────────────────────────

export function sanitize(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .replace(/\r\n/g, '\n')
    .replace(/\u00A0/g, ' ')
    .replace(/[\s]{2,}/g, ' ')
    .trim();
}

// ── forms predicates (commons/forms) ─────────────────────────────

const nonTextInputTypes = [
  'button', 'checkbox', 'color', 'file', 'hidden', 'image', 'password', 'radio', 'reset', 'submit',
];

function isNativeTextbox(vNode: VNode): boolean {
  const nodeName = vNode.props.nodeName;
  return (
    nodeName === 'textarea' ||
    (nodeName === 'input' && !nonTextInputTypes.includes((vNode.attr('type') || '').toLowerCase()))
  );
}

function isNativeSelect(vNode: VNode): boolean {
  return vNode.props.nodeName === 'select';
}

function isAriaTextbox(vNode: VNode): boolean {
  return getExplicitRole(vNode) === 'textbox';
}

function isAriaListbox(vNode: VNode): boolean {
  return getExplicitRole(vNode) === 'listbox';
}

function isAriaCombobox(vNode: VNode): boolean {
  return getExplicitRole(vNode) === 'combobox';
}

const rangeRoles = ['progressbar', 'scrollbar', 'slider', 'spinbutton'];
function isAriaRange(vNode: VNode): boolean {
  return rangeRoles.includes(getExplicitRole(vNode) as string);
}

function qsa(vNode: VNode, selector: string): VNode[] {
  const el = vNode.actualNode as unknown as { querySelectorAll?: (s: string) => ArrayLike<AnyNode> };
  if (typeof el.querySelectorAll !== 'function') return [];
  return Array.from(el.querySelectorAll(selector)).map((n) => getNodeFromTree(n));
}

// ── visibleVirtual ───────────────────────────────────────────────

export function visibleVirtual(element: VNode | AnyNode, screenReader?: boolean, noRecursing?: boolean): string {
  const { vNode } = nodeLookup(element);
  const visibleMethod = screenReader ? isVisibleToScreenReaders : isVisibleOnScreen;
  const visible = !vNode.actualNode || visibleMethod(vNode);

  const result = vNode.children
    .map((child) => {
      const { nodeType, nodeValue, nodeName } = child.props;
      if (nodeType === 3) {
        if (!nodeValue || !visible) return '';
        return nodeValue;
      }
      if (nodeName === 'br') return ' ';
      if (!noRecursing) return visibleVirtual(child, screenReader, false);
      return '';
    })
    .join('');
  return sanitize(result);
}

// ── form control value ───────────────────────────────────────────

const unsupported = { accessibleNameFromFieldValue: ['progressbar'] };

export const controlValueRoles = [
  'textbox', 'progressbar', 'scrollbar', 'slider', 'spinbutton', 'combobox', 'listbox',
];

function nativeTextboxValue(node: VNode): string {
  const { vNode } = nodeLookup(node);
  if (isNativeTextbox(vNode)) return vNode.props.value || '';
  return '';
}

function nativeSelectValue(node: VNode): string {
  const { vNode } = nodeLookup(node);
  if (!isNativeSelect(vNode)) return '';
  const options = qsa(vNode, 'option');
  const selectedOptions = options.filter((option) => option.props.selected);
  if (!selectedOptions.length && options.length) selectedOptions.push(options[0]);
  return selectedOptions.map((option) => visibleVirtual(option)).join(' ') || '';
}

function ariaTextboxValue(node: VNode): string {
  const { vNode, domNode } = nodeLookup(node);
  if (!isAriaTextbox(vNode)) return '';
  if (!domNode || !isHiddenForEveryone(domNode)) return visibleVirtual(vNode, true);
  return (domNode as unknown as { textContent: string }).textContent;
}

function ariaListboxValue(node: VNode, context: AccContext): string {
  const { vNode } = nodeLookup(node);
  if (!isAriaListbox(vNode)) return '';
  const selected = getOwnedVirtual(vNode).filter(
    (owned) => getRole(owned) === 'option' && getAriaValue(owned, 'aria-selected')?.value === 'true',
  );
  if (selected.length === 0) return '';
  return accessibleTextVirtual(selected[0], context);
}

function ariaComboboxValue(node: VNode, context: AccContext): string {
  const { vNode } = nodeLookup(node);
  if (!isAriaCombobox(vNode)) return '';
  const listbox = getOwnedVirtual(vNode).filter((elm) => getRole(elm) === 'listbox')[0];
  return listbox ? ariaListboxValue(listbox, context) : '';
}

function ariaRangeValue(node: VNode): string {
  const { vNode } = nodeLookup(node);
  if (!isAriaRange(vNode) || !hasAriaValue(vNode, 'aria-valuenow')) return '';
  const valueNow = +(getAriaValue(vNode, 'aria-valuenow')?.value as string);
  return !isNaN(valueNow) ? String(valueNow) : '0';
}

const formControlValueMethods = [
  nativeTextboxValue,
  nativeSelectValue,
  ariaTextboxValue,
  ariaListboxValue,
  ariaComboboxValue,
  ariaRangeValue,
];

function formControlValue(virtualNode: VNode, context: AccContext = {}): string {
  const unsupportedRoles = unsupported.accessibleNameFromFieldValue || [];
  const role = getRole(virtualNode);
  if (
    context.startNode === virtualNode ||
    !controlValueRoles.includes(role as string) ||
    unsupportedRoles.includes(role as string)
  ) {
    return '';
  }
  return formControlValueMethods.reduce((accName: string, step) => accName || step(virtualNode, context), '');
}

// ── title / label / native text ──────────────────────────────────

const alwaysTitleElements = ['iframe'];
function titleText(node: VNode): string {
  const { vNode } = nodeLookup(node);
  if (vNode.props.nodeType !== 1 || !vNode.hasAttr('title')) return '';
  if (!alwaysTitleElements.includes(vNode.props.nodeName) && ['none', 'presentation'].includes(getRole(vNode) as string)) {
    return '';
  }
  return vNode.attr('title') || '';
}

function attrText(attr: string, vNode: VNode): string {
  return vNode.attr(attr) || '';
}

function descendantText(nodeName: string, vNode: VNode, context: AccContext): string {
  nodeName = nodeName.toLowerCase();
  const actualNode = vNode.actualNode as unknown as {
    nodeName: string;
    querySelector: (s: string) => AnyNode | null;
  };
  const nodeNames = [nodeName, actualNode.nodeName.toLowerCase()].join(',');
  const candidate = actualNode.querySelector(nodeNames);
  if (!candidate || (candidate as unknown as { nodeName: string }).nodeName.toLowerCase() !== nodeName) {
    return '';
  }
  return accessibleText(candidate, context);
}

const defaultButtonValues: Record<string, string> = {
  submit: 'Submit',
  image: 'Submit',
  reset: 'Reset',
  button: '',
};

const nativeTextMethods: Record<string, (vNode: VNode, context: AccContext) => string> = {
  valueText: (vNode) => vNode.props.value || '',
  buttonDefaultText: (vNode) => defaultButtonValues[vNode.props.type as string] || '',
  tableCaptionText: (vNode, context) => descendantText('caption', vNode, context),
  figureText: (vNode, context) => descendantText('figcaption', vNode, context),
  svgTitleText: (vNode, context) => descendantText('title', vNode, context),
  fieldsetLegendText: (vNode, context) => descendantText('legend', vNode, context),
  altText: (vNode) => attrText('alt', vNode),
  tableSummaryText: (vNode) => attrText('summary', vNode),
  titleText: (vNode) => titleText(vNode),
  subtreeText: (vNode, context) => subtreeText(vNode, context),
  labelText: (vNode, context) => labelText(vNode, context),
  singleSpace: () => ' ',
  placeholderText: (vNode) => attrText('placeholder', vNode),
};

function nativeTextAlternative(virtualNode: VNode, context: AccContext = {}): string {
  if (virtualNode.props.nodeType !== 1 || ['presentation', 'none'].includes(getRole(virtualNode) as string)) {
    return '';
  }
  const elmSpec = getElementSpec(virtualNode, { noMatchAccessibleName: true }) as { namingMethods?: string[] };
  const methods = (elmSpec.namingMethods || []).map((name) => nativeTextMethods[name]);
  return methods.reduce((accName: string, step) => accName || (step ? step(virtualNode, context) : ''), '');
}

// ── label text (explicit + implicit <label>) ─────────────────────

function findElmsInContext(elm: string, attr: string, value: string, context: AnyNode): AnyNode[] {
  const root = ((context as unknown as { nodeType: number }).nodeType === 9 ||
    (context as unknown as { nodeType: number }).nodeType === 11
    ? context
    : (context as unknown as { ownerDocument: AnyNode }).ownerDocument) as unknown as {
    querySelectorAll: (s: string) => ArrayLike<AnyNode>;
  };
  // value is an id; escape minimally via attribute selector quoting
  return Array.from(root.querySelectorAll(`${elm}[${attr}="${cssAttrEscape(value)}"]`));
}

function cssAttrEscape(value: string): string {
  return value.replace(/["\\]/g, '\\$&');
}

function getExplicitLabels(virtualNode: VNode): AnyNode[] {
  if (!virtualNode.attr('id')) return [];
  if (!virtualNode.actualNode) {
    throw new TypeError('Cannot resolve explicit label reference for non-DOM nodes');
  }
  return findElmsInContext('label', 'for', virtualNode.attr('id') as string, virtualNode.actualNode);
}

function nodeSorterDom(a: AnyNode, b: AnyNode): number {
  if (a === b) return 0;
  return (a as unknown as { compareDocumentPosition: (n: AnyNode) => number }).compareDocumentPosition(b) & 4
    ? -1
    : 1;
}

function closestLabel(vNode: VNode): VNode | null {
  let v: VNode | null = vNode;
  while (v) {
    if (v.props.nodeName === 'label') return v;
    v = v.parent;
  }
  return null;
}

function labelText(virtualNode: VNode, context: AccContext = {}): string {
  if (
    context.inControlContext ||
    context.inLabelledByContext ||
    alreadyProcessed(virtualNode, context)
  ) {
    return '';
  }
  if (!context.startNode) context.startNode = virtualNode;

  const labelContext: AccContext = { inControlContext: true, ...context };
  const explicitLabels = getExplicitLabels(virtualNode);
  const implicitLabel = closestLabel(virtualNode);

  let labels: AnyNode[];
  if (implicitLabel) {
    labels = [...explicitLabels, implicitLabel.actualNode];
    labels.sort(nodeSorterDom);
  } else {
    labels = explicitLabels;
  }

  return labels
    .map((labelNode) => accessibleText(labelNode, labelContext))
    .filter((text) => text !== '')
    .join(' ');
}

// ── subtree text ─────────────────────────────────────────────────

let phrasingElementsCache: string[] | null = null;
function phrasingElements(): string[] {
  if (!phrasingElementsCache) {
    phrasingElementsCache = getElementsByContentType('phrasing').concat(['#text']);
  }
  return phrasingElementsCache;
}

export function subtreeText(virtualNode: VNode, context: AccContext = {}): string {
  context.startNode = context.startNode || virtualNode;
  const { strict, inControlContext, inLabelledByContext } = context;
  const role = getRole(virtualNode);
  const { contentTypes } = getElementSpec(virtualNode, { noMatchAccessibleName: true }) as {
    contentTypes?: string[];
  };
  if (
    alreadyProcessed(virtualNode, context) ||
    virtualNode.props.nodeType !== 1 ||
    contentTypes?.includes('embedded') ||
    controlValueRoles.includes(role as string)
  ) {
    return '';
  }
  if (!context.subtreeDescendant && !context.inLabelledByContext && !namedFromContents(virtualNode, { strict })) {
    return '';
  }
  if (!strict) {
    const subtreeDescendant = !inControlContext && !inLabelledByContext;
    context = { subtreeDescendant, ...context };
  }
  return getOwnedVirtual(virtualNode).reduce(
    (contentText: string, child) => appendAccessibleText(contentText, child, context),
    '',
  );
}

function appendAccessibleText(contentText: string, virtualNode: VNode, context: AccContext): string {
  const nodeName = virtualNode.props.nodeName;
  let contentTextAdd = accessibleTextVirtual(virtualNode, context);
  if (!contentTextAdd) return contentText;
  if (!phrasingElements().includes(nodeName)) {
    if (contentTextAdd[0] !== ' ') contentTextAdd += ' ';
    if (contentText && contentText[contentText.length - 1] !== ' ') contentTextAdd = ' ' + contentTextAdd;
  }
  return contentText + contentTextAdd;
}

// ── accessible text (top level) ──────────────────────────────────

export interface AccContext {
  startNode?: VNode;
  inControlContext?: boolean;
  inLabelledByContext?: boolean;
  includeHidden?: boolean;
  subtreeDescendant?: boolean;
  strict?: boolean;
  processed?: VNode[];
}

function alreadyProcessed(virtualNode: VNode, context: AccContext): boolean {
  context.processed = context.processed || [];
  if (context.processed.includes(virtualNode)) return true;
  context.processed.push(virtualNode);
  return false;
}

function nativelyHiddenTag(virtualNode: VNode): boolean {
  return ['style', 'script', 'noscript', 'template'].includes(virtualNode.props.nodeName);
}

function shouldIgnoreHidden(virtualNode: VNode, context: AccContext): boolean {
  if (!virtualNode) return false;
  if (context.includeHidden && !nativelyHiddenTag(virtualNode)) return false;
  if (virtualNode.props.nodeType !== 1) return false;
  return !isVisibleToScreenReaders(virtualNode);
}

function prepareContext(virtualNode: VNode, context: AccContext): AccContext {
  if (!context.startNode) context = { startNode: virtualNode, ...context };
  if (virtualNode.props.nodeType === 1 && context.inLabelledByContext && context.includeHidden === undefined) {
    context = { includeHidden: !isVisibleToScreenReaders(virtualNode), ...context };
  }
  return context;
}

export function accessibleTextVirtual(virtualNode: VNode, context: AccContext = {}): string {
  context = prepareContext(virtualNode, context);
  if (shouldIgnoreHidden(virtualNode, context)) return '';

  const computationSteps = [
    arialabelledbyText,
    arialabelText,
    nativeTextAlternative,
    formControlValue,
    subtreeText,
    textNodeValue,
    titleText,
  ];

  return computationSteps.reduce((accName: string, step) => {
    if (context.startNode === virtualNode) accName = sanitize(accName);
    if (accName !== '') return accName;
    return (step as (v: VNode, c: AccContext) => string)(virtualNode, context);
  }, '');
}

function textNodeValue(virtualNode: VNode): string {
  if (virtualNode.props.nodeType !== 3) return '';
  return virtualNode.props.nodeValue || '';
}

export function accessibleText(element: VNode | AnyNode, context?: AccContext): string {
  return accessibleTextVirtual(getNodeFromTree(element), context);
}

// ── autocomplete validity ────────────────────────────────────────

const autocomplete = {
  stateTerms: ['on', 'off'],
  standaloneTerms: [
    'name', 'honorific-prefix', 'given-name', 'additional-name', 'family-name',
    'honorific-suffix', 'nickname', 'username', 'new-password', 'current-password',
    'organization-title', 'organization', 'street-address', 'address-line1',
    'address-line2', 'address-line3', 'address-level4', 'address-level3',
    'address-level2', 'address-level1', 'country', 'country-name', 'postal-code',
    'cc-name', 'cc-given-name', 'cc-additional-name', 'cc-family-name', 'cc-number',
    'cc-exp', 'cc-exp-month', 'cc-exp-year', 'cc-csc', 'cc-type',
    'transaction-currency', 'transaction-amount', 'language', 'bday', 'bday-day',
    'bday-month', 'bday-year', 'sex', 'url', 'photo', 'one-time-code',
  ],
  qualifiers: ['home', 'work', 'mobile', 'fax', 'pager'],
  qualifiedTerms: [
    'tel', 'tel-country-code', 'tel-national', 'tel-area-code', 'tel-local',
    'tel-local-prefix', 'tel-local-suffix', 'tel-extension', 'email', 'impp',
  ],
  locations: ['billing', 'shipping'],
};

export function isValidAutocomplete(
  autocompleteValue: string,
  {
    looseTyped = false,
    stateTerms = [],
    locations = [],
    qualifiers = [],
    standaloneTerms = [],
    qualifiedTerms = [],
    ignoredValues = [],
  }: {
    looseTyped?: boolean;
    stateTerms?: string[];
    locations?: string[];
    qualifiers?: string[];
    standaloneTerms?: string[];
    qualifiedTerms?: string[];
    ignoredValues?: string[];
  } = {},
): boolean | undefined {
  autocompleteValue = autocompleteValue.toLowerCase().trim();
  stateTerms = stateTerms.concat(autocomplete.stateTerms);
  if (stateTerms.includes(autocompleteValue) || autocompleteValue === '') return true;

  qualifiers = qualifiers.concat(autocomplete.qualifiers);
  locations = locations.concat(autocomplete.locations);
  standaloneTerms = standaloneTerms.concat(autocomplete.standaloneTerms);
  qualifiedTerms = qualifiedTerms.concat(autocomplete.qualifiedTerms);

  const autocompleteTerms = autocompleteValue.split(/\s+/g);
  if (autocompleteTerms[autocompleteTerms.length - 1] === 'webauthn') {
    autocompleteTerms.pop();
    if (autocompleteTerms.length === 0) return false;
  }

  if (!looseTyped) {
    if (autocompleteTerms[0].length > 8 && autocompleteTerms[0].substr(0, 8) === 'section-') {
      autocompleteTerms.shift();
    }
    if (locations.includes(autocompleteTerms[0])) autocompleteTerms.shift();
    if (qualifiers.includes(autocompleteTerms[0])) {
      autocompleteTerms.shift();
      standaloneTerms = [];
    }
    if (autocompleteTerms.length !== 1) return false;
  }

  const purposeTerm = autocompleteTerms[autocompleteTerms.length - 1];
  if (ignoredValues.includes(purposeTerm)) return undefined;
  return standaloneTerms.includes(purposeTerm) || qualifiedTerms.includes(purposeTerm);
}
