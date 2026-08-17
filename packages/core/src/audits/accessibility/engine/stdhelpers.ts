/**
 * Standards-derived helpers (axe `commons/standards`): functions that read the
 * pure data tables in `standards.ts` — element specs, global ARIA attributes,
 * implicit HTML role mapping, content-type lookups.
 */
import { ariaAttrs, ariaRoles, htmlElms } from './standards';
import { VNode, matches, closest } from './core';

export function getAriaRolesByType(type: string): string[] {
  return Object.keys(ariaRoles).filter((roleName) => ariaRoles[roleName].type === type);
}

export function getAriaRolesSupportingNameFromContent(): string[] {
  return Object.keys(ariaRoles).filter((roleName) => ariaRoles[roleName].nameFromContent);
}

export function getGlobalAriaAttrs(): string[] {
  return Object.keys(ariaAttrs).filter((attrName) => ariaAttrs[attrName].global);
}

export function getElementsByContentType(type: string): string[] {
  return Object.keys(htmlElms).filter((nodeName) => {
    const elm = htmlElms[nodeName];
    if (elm.contentTypes) return elm.contentTypes.includes(type);
    if (!elm.variant) return false;
    if (elm.variant.default && elm.variant.default.contentTypes) {
      return elm.variant.default.contentTypes.includes(type);
    }
    return false;
  });
}

/**
 * Return the spec for an HTML element, resolving variants against the node.
 */
export function getElementSpec(
  vNode: VNode,
  { noMatchAccessibleName = false }: { noMatchAccessibleName?: boolean } = {},
): Record<string, unknown> {
  const standard = htmlElms[vNode.props.nodeName];
  if (!standard) return {};
  if (!standard.variant) return standard;

  const { variant, ...spec } = standard as { variant: Record<string, unknown> } & Record<string, unknown>;

  for (const variantName in variant) {
    if (!Object.prototype.hasOwnProperty.call(variant, variantName) || variantName === 'default') {
      continue;
    }
    const { matches: variantMatches, ...props } = variant[variantName] as Record<string, unknown>;
    const matchProperties = Array.isArray(variantMatches) ? variantMatches : [variantMatches];
    for (let i = 0; i < matchProperties.length && noMatchAccessibleName; i++) {
      if (Object.prototype.hasOwnProperty.call(matchProperties[i], 'hasAccessibleName')) {
        return standard;
      }
    }
    if (matches(vNode, variantMatches)) {
      for (const propName in props) {
        if (Object.prototype.hasOwnProperty.call(props, propName)) {
          (spec as Record<string, unknown>)[propName] = props[propName];
        }
      }
    }
  }

  const def = (variant as { default?: Record<string, unknown> }).default;
  for (const propName in def) {
    if (
      Object.prototype.hasOwnProperty.call(def, propName) &&
      typeof (spec as Record<string, unknown>)[propName] === 'undefined'
    ) {
      (spec as Record<string, unknown>)[propName] = def[propName];
    }
  }

  return spec;
}

// implicit-html-roles requires aria/dom/text helpers; imported lazily-safe
// (called only at runtime, never at module init) to tolerate import cycles.
import { arialabelledbyText, arialabelText, getExplicitRole } from './aria';
import { idrefs, isFocusable } from './dom';
import { isColumnHeader, isRowHeader } from './table';
import { sanitize } from './text';

const getSectioningContentSelector = (): string =>
  getElementsByContentType('sectioning')
    .map((nodeName) => `${nodeName}:not([role])`)
    .join(', ') + ' , [role=article], [role=complementary], [role=navigation], [role=region]';

const getSectioningContentPlusMainSelector = (): string =>
  getSectioningContentSelector() + ' , main:not([role]), [role=main]';

function hasAccessibleName(vNode: VNode, { checkTitle = false }: { checkTitle?: boolean } = {}): boolean {
  return !!(
    sanitize(arialabelledbyText(vNode)) ||
    sanitize(arialabelText(vNode)) ||
    (checkTitle && vNode?.props.nodeType === 1 && sanitize(vNode.attr('title') || ''))
  );
}

type ImplicitRoleResolver = string | ((vNode: VNode) => string | null | undefined);

export const implicitHtmlRoles: Record<string, ImplicitRoleResolver> = {
  a: (vNode) => (vNode.hasAttr('href') ? 'link' : null),
  area: (vNode) => (vNode.hasAttr('href') ? 'link' : null),
  article: 'article',
  aside: (vNode) => {
    if (
      closest(vNode.parent, getSectioningContentSelector()) &&
      !hasAccessibleName(vNode, { checkTitle: true })
    ) {
      return null;
    }
    return 'complementary';
  },
  body: 'document',
  button: 'button',
  datalist: 'listbox',
  dd: 'definition',
  dfn: 'term',
  details: 'group',
  dialog: 'dialog',
  dt: 'term',
  fieldset: 'group',
  figure: 'figure',
  footer: (vNode) => {
    const sectioningElement = closest(vNode, getSectioningContentPlusMainSelector());
    return !sectioningElement ? 'contentinfo' : null;
  },
  form: (vNode) => (hasAccessibleName(vNode) ? 'form' : null),
  h1: 'heading',
  h2: 'heading',
  h3: 'heading',
  h4: 'heading',
  h5: 'heading',
  h6: 'heading',
  header: (vNode) => {
    const sectioningElement = closest(vNode, getSectioningContentPlusMainSelector());
    return !sectioningElement ? 'banner' : null;
  },
  hr: 'separator',
  img: (vNode) => {
    const emptyAlt = vNode.hasAttr('alt') && !vNode.attr('alt');
    const hasGlobalAria = getGlobalAriaAttrs().find((attr) => vNode.hasAttr(attr));
    return emptyAlt && !hasGlobalAria && !isFocusable(vNode) ? 'presentation' : 'img';
  },
  input: (vNode) => {
    let suggestionsSourceElement: boolean | undefined;
    if (vNode.hasAttr('list')) {
      const listElement = idrefs(vNode, 'list').filter((node) => !!node)[0];
      suggestionsSourceElement =
        !!listElement && (listElement as Element).nodeName.toLowerCase() === 'datalist';
    }
    switch (vNode.props.type) {
      case 'checkbox':
        return 'checkbox';
      case 'number':
        return 'spinbutton';
      case 'radio':
        return 'radio';
      case 'range':
        return 'slider';
      case 'search':
        return !suggestionsSourceElement ? 'searchbox' : 'combobox';
      case 'button':
      case 'image':
      case 'reset':
      case 'submit':
        return 'button';
      case 'text':
      case 'tel':
      case 'url':
      case 'email':
      case '':
        return !suggestionsSourceElement ? 'textbox' : 'combobox';
      default:
        return 'textbox';
    }
  },
  li: 'listitem',
  main: 'main',
  math: 'math',
  menu: 'list',
  meter: 'meter',
  nav: 'navigation',
  ol: 'list',
  optgroup: 'group',
  option: 'option',
  output: 'status',
  progress: 'progressbar',
  search: 'search',
  section: (vNode) => (hasAccessibleName(vNode) ? 'region' : null),
  select: (vNode) =>
    vNode.hasAttr('multiple') || parseInt(vNode.attr('size') || '', 10) > 1 ? 'listbox' : 'combobox',
  summary: 'button',
  table: 'table',
  tbody: 'rowgroup',
  td: (vNode) => {
    const table = closest(vNode, 'table');
    const role = table ? getExplicitRole(table) : null;
    return ['grid', 'treegrid'].includes(role as string) ? 'gridcell' : 'cell';
  },
  textarea: 'textbox',
  tfoot: 'rowgroup',
  th: (vNode) => {
    if (isColumnHeader(vNode)) return 'columnheader';
    if (isRowHeader(vNode)) return 'rowheader';
    return undefined;
  },
  thead: 'rowgroup',
  tr: 'row',
  ul: 'list',
};
