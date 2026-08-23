import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import type { CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';
import { parseHtml } from '../parser';
import { stripStyles } from '../audits/operability-safety/runner';
import { logger } from '../logger';

/**
 * Three independent main-content extractors.
 *
 * An agent does not read the page; it reads whatever its extractor kept. Two
 * audits in this wave compare the extractors against each other, and where they
 * disagree the site's content is a coin flip — which is the finding. Written
 * once so "the extractors" means the same three everywhere.
 */

export interface Extracted {
  /** Plain text of the extracted main content. */
  text: string;
  /** The extracted markup, where the extractor produced any. */
  html: string;
  /** The title the extractor settled on, empty when it has no opinion. */
  title: string;
  /** Which extractor produced this. Reported, because disagreement is the signal. */
  source: string;
}

/** Chrome that no extractor treats as content. */
const CHROME_SELECTORS = 'script, style, noscript, template, nav, aside, header, footer, form, iframe';

/** Class and id names the aggressive extractors drop wholesale. */
export const AGGRESSIVE_DROP_RE =
  /comment|sidebar|promo|related|advert|ad-|banner|cookie|newsletter|share/i;

/** Readability's own floor: below this it reports the page as not readerable. */
export const READABILITY_CHAR_THRESHOLD = 500;

const empty = (source: string): Extracted => ({ text: '', html: '', title: '', source });

/** Collapse whitespace the way every extractor's text output is compared. */
function flatten(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * `@mozilla/readability` over jsdom — the extractor most of the industry ships.
 *
 * Returns `null` when Readability declines the document, which is not an error
 * condition to paper over: it is the single most consequential fact this module
 * can report, because it means the default extractor hands an agent nothing.
 * Stylesheets are stripped before parsing for the same reason the a11y runner
 * strips them — jsdom parses every inline stylesheet synchronously.
 */
export function readabilityArticle(html: string, url: string): Extracted | null {
  if (!html.trim()) return null;
  try {
    const dom = new JSDOM(stripStyles(html), { url });
    const article = new Readability(dom.window.document).parse();
    if (!article) return null;
    const text = flatten(article.textContent ?? '');
    if (text === '') return null;
    return { text, html: article.content ?? '', title: article.title ?? '', source: 'readability' };
  } catch (error) {
    logger.debug(`readability extraction failed for ${url}: ${String(error)}`);
    return null;
  }
}

/** The first non-empty semantic container, with chrome removed. */
export function semanticText(html: string): Extracted {
  if (!html.trim()) return empty('semantic');
  const $ = parseHtml(html);
  for (const selector of ['main', '[role="main"]', 'article', 'body']) {
    const node = $(selector).first();
    if (node.length === 0) continue;
    const clone = node.clone();
    clone.find(CHROME_SELECTORS).remove();
    const text = flatten(clone.text());
    if (text === '') continue;
    return { text, html: clone.html() ?? '', title: flatten($('h1').first().text()), source: 'semantic' };
  }
  return empty('semantic');
}

/** Text characters, and the share of them that sit inside links. */
function density($: CheerioAPI, el: Element): { chars: number; linkChars: number } {
  const node = $(el).clone();
  node.find(CHROME_SELECTORS).remove();
  const chars = flatten(node.text()).length;
  const linkChars = flatten(node.find('a').text()).length;
  return { chars, linkChars };
}

/**
 * The block with the most text that is not link text.
 *
 * This is the boilerpipe/trafilatura family of heuristic, reduced to its one
 * load-bearing idea: a navigation column is mostly anchors, an article is
 * mostly prose, and the ratio separates them without a model. Scoring by text
 * length alone would pick the `<body>` every time.
 */
export function densityText(html: string): Extracted {
  if (!html.trim()) return empty('density');
  const $ = parseHtml(html);
  const candidates = $('main, article, section, div, td').toArray() as Element[];

  let best: { el: Element; score: number } | undefined;
  for (const el of candidates) {
    const { chars, linkChars } = density($, el);
    if (chars < 100) continue;
    const score = chars * (1 - linkChars / chars);
    if (!best || score > best.score) best = { el, score };
  }

  if (!best) {
    const text = flatten($('body').text());
    return text === ''
      ? empty('density')
      : { text, html: $('body').html() ?? '', title: '', source: 'density' };
  }

  const clone = $(best.el).clone();
  clone.find(CHROME_SELECTORS).remove();
  return {
    text: flatten(clone.text()),
    html: clone.html() ?? '',
    title: flatten($('h1').first().text()),
    source: 'density',
  };
}
