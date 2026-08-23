import type { AnyNode, Element } from 'domhandler';
import type { CheerioAPI } from 'cheerio';
import type { CssRule } from '../../gatherers/css-rules';

/**
 * Shared signal sets for the agent-operability audits.
 *
 * Three audits in this category each need the same two answers — "does this
 * element look clickable?" and "does this class name carry state?" — and one
 * needs accessible-name resolution. Written once so the patterns cannot drift
 * apart between them.
 */

/** Tags that carry an interactive role with no ARIA attribute needed. */
export const NATIVE_INTERACTIVE: ReadonlySet<string> = new Set([
  'a',
  'button',
  'input',
  'select',
  'textarea',
  'summary',
  'details',
  'option',
  'label',
]);

/** Class and data-attribute names that advertise a click target. */
export const CLICKABILITY_CLASS_RE =
  /(^|[-_])(btn|button|cta|link|clickable|tile|card-link|toggle)([-_]|$)/;

/** Class names that carry a control's state in CSS rather than in ARIA. */
export const STATE_CLASS_RE =
  /(^|[-_])(is-)?(active|selected|on|off|open|expanded|checked|current|enabled)([-_]|$)/;

/** Inline handler attributes that make a non-interactive tag clickable. */
const INLINE_HANDLERS = ['onclick', 'onmousedown', 'onkeydown', 'onmouseup', 'onkeypress'];

/** A declaration block that sets the hand cursor, whatever else it carries. */
const CURSOR_POINTER = /(^|;)\s*cursor\s*:\s*pointer\b/;

/**
 * Does anything about this element advertise that clicking it does something?
 *
 * Three independent signals, any one of which is enough: an inline handler
 * attribute, a class or `data-*` name from the clickability vocabulary, or a
 * stylesheet rule that gives it the hand cursor. The CSS arm is why the
 * caller passes the rules the css-rules gatherer collected.
 */
export function hasClickSignal(
  el: Element,
  $: CheerioAPI,
  rules: readonly CssRule[] = [],
): boolean {
  const attribs = el.attribs ?? {};

  for (const handler of INLINE_HANDLERS) {
    if (attribs[handler]) return true;
  }

  const names = [attribs['class'] ?? '', ...Object.keys(attribs).filter((k) => k.startsWith('data-'))];
  for (const name of names) {
    for (const token of name.split(/\s+/)) {
      if (token && CLICKABILITY_CLASS_RE.test(token)) return true;
    }
  }

  for (const rule of rules) {
    if (!CURSOR_POINTER.test(rule.declarations)) continue;
    // A stylesheet may carry selectors cheerio cannot parse (vendor
    // pseudo-elements, `:has()` in older builds). One of those must not take
    // the audit down, so an unparseable selector is skipped, not fatal.
    try {
      if ($(el).is(rule.selector)) return true;
    } catch {
      continue;
    }
  }

  return false;
}

/** Collapse whitespace and trim, the way an accessible name is computed. */
function flatten(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * The element's accessible name, resolved in accname order.
 *
 * `aria-labelledby` wins over `aria-label`, which wins over the element's own
 * text, then `title`, then a child image's `alt`, then a child SVG's `<title>`.
 * Returns an empty string when nothing resolves — which is exactly the state
 * that keeps an element out of an agent's snapshot.
 */
export function accessibleName(el: Element, $: CheerioAPI): string {
  const attribs = el.attribs ?? {};

  const labelledBy = attribs['aria-labelledby'];
  if (labelledBy) {
    const parts = labelledBy
      .split(/\s+/)
      .filter(Boolean)
      // Resolved by attribute rather than by an `#id` selector: an id is
      // author-controlled and may carry characters a selector cannot hold,
      // and `CSS.escape` is a browser global this package does not have.
      .map((id) => flatten($('[id]').filter((_i, e) => e.attribs['id'] === id).first().text()))
      .filter(Boolean);
    if (parts.length > 0) return parts.join(' ');
  }

  const label = flatten(attribs['aria-label'] ?? '');
  if (label) return label;

  const own = flatten($(el).text());
  if (own) return own;

  const title = flatten(attribs['title'] ?? '');
  if (title) return title;

  const alt = flatten($(el).find('img[alt]').first().attr('alt') ?? '');
  if (alt) return alt;

  const svgTitle = flatten($(el).find('svg > title').first().text());
  if (svgTitle) return svgTitle;

  return '';
}

/** True when the node is an element rather than text or a comment. */
export function isElement(node: AnyNode): node is Element {
  return node.type === 'tag';
}
