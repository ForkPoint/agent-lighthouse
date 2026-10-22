import type { CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";

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
