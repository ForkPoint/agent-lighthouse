import type { CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";
import { hiddenFromReaders } from "#core/dom-visibility";

/** Supplementary regions extractors drop before the main text is read. */
const SUPPLEMENTARY = 'aside, [role="complementary"]';

/** Landmarks that are site chrome wherever they sit. */
const ALWAYS_CHROME =
  'nav, [role="navigation"], [role="banner"], [role="contentinfo"]';

/** Sectioning content that scopes a header or footer to itself. */
const SECTIONING =
  'article, aside, main, nav, section, [role="article"], [role="complementary"], [role="main"], [role="navigation"], [role="region"]';

/**
 * Whether an element sits in site-level chrome: navigation, or a header or
 * footer that is the page banner or content info.
 *
 * HTML-AAM maps `<header>` to `banner` and `<footer>` to `contentinfo` only
 * when neither sits inside article, aside, main, nav or section (including
 * their explicit ARIA roles). A post's
 * `<header class="entry-header">` carries its title and publication date, and
 * its `<footer>` often carries sources; both are content, not chrome.
 */
export function inPageChrome($: CheerioAPI, el: AnyNode): boolean {
  const node = $(el);
  if (node.closest(ALWAYS_CHROME).length > 0) return true;
  return node
    .parents("header, footer")
    .add(node.filter("header, footer"))
    .toArray()
    .some((region) => $(region).parents(SECTIONING).length === 0);
}

/**
 * Whether an element is part of what a reader gets as the page's own
 * content: visible, outside site chrome, and outside a supplementary region.
 * A footer "Glossary" heading, a sidebar "Comparison guides" widget or a
 * "Recent posts" date list would otherwise mark every page on the site.
 *
 * Callers with a cheap text or attribute test should run it first; the three
 * checks here walk the element's ancestors.
 */
export function inReaderContent($: CheerioAPI, el: AnyNode): boolean {
  return (
    !hiddenFromReaders($, el) &&
    !inPageChrome($, el) &&
    $(el).closest(SUPPLEMENTARY).length === 0
  );
}
