import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext, PageContext } from '../../check-context';
import { weightForGrade } from '../../scorer';

/** Regions whose lists are chrome, not content. */
const CHROME_REGION =
  'nav, header, footer, aside, [role="navigation"], [role="banner"], [role="contentinfo"], [role="search"]';

/** Class names that mark a list as navigation furniture rather than content. */
const CHROME_CLASS =
  /(breadcrumb|pagination|paginat|pager|menu|navbar|nav-|tabs?\b|carousel|slider|toc\b|table-of-contents|social|share)/i;

/** Microdata/RDFa types that mark an ordered list as navigation. */
const CHROME_ITEMTYPE = /(BreadcrumbList|SiteNavigationElement)/i;

/** A child whose text opens with a bullet or a step number: "1.", "2)", "• ", "- ". */
const LEADING_MARKER = /^\s*(?:step\s*)?(?:\d{1,2}\s*[.):]|[•·▪‣*+]\s|[-–—]\s)/i;

/** Longest text a child can carry and still read as one list item. */
const MAX_ITEM_TEXT = 200;

interface PageTally {
  /** Content lists correctly marked up as <ul>/<ol>/<dl>. */
  semantic: number;
  /** Div stacks, broken <dl>s and manually numbered prose that should be lists. */
  pseudo: number;
  /** Well-formed <dl> pairs plus inline <dfn> — the 6.13 dimension. */
  definitions: number;
  /** Content <ol>s that read as procedural step lists — the 9.6 dimension. */
  steps: number;
}

const EMPTY: PageTally = { semantic: 0, pseudo: 0, definitions: 0, steps: 0 };

function isChrome(page: PageContext, el: unknown): boolean {
  const $el = page.$(el as never);
  if ($el.closest(CHROME_REGION).length > 0) return true;
  if (CHROME_CLASS.test($el.attr('class') ?? '')) return true;
  if (CHROME_ITEMTYPE.test($el.attr('itemtype') ?? '')) return true;
  return $el.parents().toArray().some((p) => CHROME_ITEMTYPE.test(page.$(p).attr('itemtype') ?? ''));
}

/**
 * Count the div stacks, broken definition lists and manually numbered prose
 * sequences that carry list-shaped content without list markup — the failure
 * mode the audit's description always claimed to detect and never looked for.
 */
function countPseudoLists(page: PageContext): number {
  const $ = page.$;
  let pseudo = 0;

  $('body *').each((_, parent) => {
    const tag = (parent as { tagName?: string }).tagName?.toLowerCase() ?? '';
    if (tag === 'ul' || tag === 'ol' || tag === 'dl') return;
    if (isChrome(page, parent)) return;

    const children = $(parent).children().toArray();
    if (children.length < 3) return;

    // Rule 1: ≥3 siblings sharing a class, each holding one item's worth of text.
    const byClass = new Map<string, number>();
    for (const child of children) {
      const cls = ($(child).attr('class') ?? '').trim();
      if (!cls) continue;
      const text = $(child).text().trim();
      if (!text || text.length > MAX_ITEM_TEXT) continue;
      byClass.set(cls, (byClass.get(cls) ?? 0) + 1);
    }
    const classGroups = [...byClass.values()].filter((n) => n >= 3).length;
    if (classGroups > 0) {
      pseudo += classGroups;
      return;
    }

    // Rule 2: ≥3 same-tag siblings opening with a bullet or step number —
    // the "1. Do this / 2. Do that" prose sequence a CMS produces.
    const marked = children.filter((child) => {
      const childTag = (child as { tagName?: string }).tagName?.toLowerCase() ?? '';
      if (childTag === 'li' || childTag === 'dt' || childTag === 'dd') return false;
      return LEADING_MARKER.test($(child).text());
    });
    if (marked.length >= 3) pseudo++;
  });

  return pseudo;
}

function tallyPage(page: PageContext): PageTally {
  const $ = page.$;
  const tally: PageTally = { ...EMPTY };

  $('ul, ol, dl').each((_, el) => {
    if (isChrome(page, el)) return;
    const $el = $(el);
    const tag = (el as { tagName?: string }).tagName?.toLowerCase() ?? '';

    if (tag === 'dl') {
      const paired = $el.children('dt').length > 0 && $el.children('dd').length > 0;
      if (paired) {
        tally.semantic++;
        tally.definitions++;
      } else {
        // Grouping markup that groups nothing: the same defect class as a div stack.
        tally.pseudo++;
      }
      return;
    }

    const items = $el.children('li').length;
    if (items < 2) return;
    tally.semantic++;
    // 9.6's procedural bar: a real step list, not a two-link widget.
    if (tag === 'ol' && items >= 3) tally.steps++;
  });

  tally.definitions += $('dfn').length;
  tally.pseudo += countPseudoLists(page);
  return tally;
}

const EXPECTED =
  'Content lists marked up as <ul>/<ol>/<dl> rather than as div stacks or manually numbered prose.';

export class SemanticListsAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'content-extraction/semantic-lists',
    category: 'content-extraction',
    title: 'Semantic list usage',
    failureTitle: 'Semantic list usage',
    description:
      'AI agents recognize <ul>, <ol>, and <dl> as structured data lists and extract them as bullet points, numbered steps and term/definition pairs in generated answers. Content formatted as styled divs or manually numbered paragraphs is invisible to list-extraction algorithms, so your feature lists, how-to steps and glossary entries will not be surfaced as structured answers.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('B', 'scored'),
    evidenceGrade: 'B',
    tier: 'scored',
    dossier: 'docs/evidence/audits/content-extraction/semantic-lists.md',
    defaultPriority: 'medium',
    guidance: {
      impact:
        'AI agents recognize <ul>, <ol>, and <dl> as structured lists and extract them as bullet points, numbered steps or term/definition pairs. Content formatted as styled <div> elements — or as paragraphs that start with "1.", "2." — collapses into undelimited prose when the page is converted to markdown or an accessibility tree, so the agent has to re-infer where each item begins.',
      fix: 'Replace styled <div> stacks and manually numbered paragraph sequences with <ul> (unordered), <ol> (sequential steps, one <li> per step) or <dl> with paired <dt>/<dd> (terms and definitions). Navigation, breadcrumb and pagination lists do not count — this is about content.',
      code: '<ul>\n  <li>Feature one: description</li>\n  <li>Feature two: description</li>\n</ul>\n\n<ol>\n  <li>Create an account</li>\n  <li>Configure your API key</li>\n  <li>Make your first call</li>\n</ol>\n\n<dl>\n  <dt><dfn>API rate limit</dfn></dt>\n  <dd>The maximum number of requests allowed per time period.</dd>\n</dl>',
      effort: 'easy',
      docsUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Element/ul',
      tags: ['lists', 'structure', 'semantic', 'html', 'definitions', 'steps'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const tallies = ctx.pages.map((page) => ({ page, tally: tallyPage(page) }));
    const sum = (pick: (t: PageTally) => number) =>
      tallies.reduce((n, entry) => n + pick(entry.tally), 0);

    const semantic = sum((t) => t.semantic);
    const pseudo = sum((t) => t.pseudo);
    const definitions = sum((t) => t.definitions);
    const steps = sum((t) => t.steps);

    const found =
      `${semantic} semantic list(s) vs ${pseudo} pseudo-list(s); ` +
      `${definitions} definition element(s); ${steps} step list(s)`;

    if (semantic + pseudo === 0) {
      return this.notApplicable(
        ctx.pages.length === 0
          ? 'No pages scanned.'
          : 'No list-shaped content found to evaluate.',
        EXPECTED,
        found,
      );
    }

    const firstOffender = tallies.find((entry) => entry.tally.pseudo > 0)?.page.url;
    const ratio = semantic / (semantic + pseudo);

    if (pseudo === 0) {
      return this.pass(
        `All ${semantic} content list(s) use semantic list markup.`,
        EXPECTED,
        found,
      );
    }

    const recommendation = {
      priority: 'medium' as const,
      description:
        'Lists built from styled divs, broken <dl> markup or manually numbered paragraphs lose their item boundaries when a page is converted to markdown or serialized into an accessibility tree, which is how extraction pipelines and browsing agents read it.',
      code: '<ul>\n  <li>Feature one</li>\n  <li>Feature two</li>\n  <li>Feature three</li>\n</ul>',
    };

    if (ratio >= 0.5) {
      return this.warn(
        `${pseudo} of ${semantic + pseudo} content list(s) are div stacks or numbered prose rather than list markup.`,
        EXPECTED,
        found,
        recommendation,
        firstOffender,
      );
    }

    return this.fail(
      `${pseudo} of ${semantic + pseudo} content list(s) are div stacks or numbered prose rather than list markup.`,
      EXPECTED,
      found,
      recommendation,
      firstOffender,
    );
  }
}
