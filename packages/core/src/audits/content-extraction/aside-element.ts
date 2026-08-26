import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import type { CheckContext, PageContext } from '../../check-context';
import { weightForGrade } from '../../scorer';

/**
 * Class/id tokens that name a supplementary-content container.
 *
 * These are the same string families the extractors themselves key on when a
 * page has no landmarks to go by: Readability's `unlikelyCandidates` regex
 * matches `sidebar|skyscraper|supplemental|related` and its negative
 * class-weight regex penalises `sidebar`. Matching them here is how the audit
 * decides a page *has* supplementary content in the first place.
 */
const SUPPLEMENTARY_HINT =
  /(?:^|[^a-z])(sidebar|side-bar|sidenav|side-nav|supplemental|complementary|secondary|related|recirc|promo|callout|pullquote|pull-quote|newsletter|subscribe-box|advert|ad-slot|sponsored|widget)(?:[^a-z]|$)/i;

/** An `<aside>` or an explicit `role="complementary"` — the marked forms. */
const MARKED_SELECTOR = 'aside, [role="complementary"]';

/** Elements that can stand in for `<aside>` when authors reach for a `<div>`. */
const CANDIDATE_SELECTOR = 'div, section, ul, nav';

interface PageFindings {
  /** Supplementary blocks an extractor can recognise by element or role. */
  readonly marked: string[];
  /** Supplementary blocks that are invisible to extractors and a11y trees. */
  readonly unmarked: string[];
}

function describe(tag: string, attrs: string): string {
  const token = attrs.trim().split(/\s+/)[0] ?? '';
  return token ? `<${tag} ${token}>` : `<${tag}>`;
}

/** Find the supplementary-content blocks on one page, split by markup. */
function findSupplementary(page: PageContext): PageFindings {
  const $ = page.$;
  const marked: string[] = [];
  const unmarked: string[] = [];

  // Top-level marked landmarks. A nested one is part of the same block, so it
  // is not counted twice.
  $(MARKED_SELECTOR).each((_, el) => {
    const node = $(el);
    if (node.parents(MARKED_SELECTOR).length > 0) return;
    marked.push(describe((el as { tagName?: string }).tagName ?? 'aside', `${node.attr('class') ?? ''} ${node.attr('id') ?? ''}`));
  });

  $(CANDIDATE_SELECTOR).each((_, el) => {
    const node = $(el);
    const attrs = `${node.attr('class') ?? ''} ${node.attr('id') ?? ''}`;
    if (!SUPPLEMENTARY_HINT.test(attrs)) return;

    // Inside a marked landmark the block is already handled — Readability and
    // trafilatura drop the whole subtree.
    if (node.closest(MARKED_SELECTOR).length > 0) return;

    // Only report the outermost container of a nested promo/sidebar stack.
    const nestedInHint = node
      .parents(CANDIDATE_SELECTOR)
      .toArray()
      .some((a) => SUPPLEMENTARY_HINT.test(`${$(a).attr('class') ?? ''} ${$(a).attr('id') ?? ''}`));
    if (nestedInHint) return;

    unmarked.push(describe((el as { tagName?: string }).tagName ?? 'div', attrs));
  });

  return { marked, unmarked };
}

const EXPECTED =
  'Every sidebar / promo / related-links block on a content page is wrapped in <aside> (or carries role="complementary")';

export class AsideElementAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'content-extraction/aside-element',
    category: 'content-extraction',
    title: '<aside> for supplementary content',
    failureTitle: '<aside> for supplementary content',
    description:
      'Mozilla Readability and trafilatura delete <aside> subtrees before extraction, and Chromium exposes <aside> as a complementary landmark in the accessibility tree agents read. Wrapping sidebars, promos and related-links blocks in <aside> is what keeps them out of the text an LLM ingests; a sidebar left in a bare <div> is extracted as if it were article body.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('B', 'scored'),
    evidenceGrade: 'B',
    tier: 'scored',
    dossier: 'docs/evidence/audits/content-extraction/aside-element.md',
    requires: ['origin-reachable', 'unblocked-fetches', 'rendered-body', 'sample-adequate'],
    applicablePageTypes: ['content'],
    defaultPriority: 'low',
    guidance: {
      impact:
        'Mozilla Readability removes every <aside> from extracted article content (`this._clean(articleContent, "aside")`) and trafilatura lists "aside" first in its MANUALLY_CLEANED tag list, so supplementary blocks marked this way never reach the model. Firefox Reader Mode, Jina Reader and a long tail of LLM/agent tools run on Readability. Chromium additionally exposes <aside> as a `complementary` landmark, which is what Anthropic\'s browser-use `read_page` returns. A sidebar left in a bare <div> is invisible to all three paths and gets extracted as if it were part of your article.',
      fix: 'Wrap sidebar, promo, advert and related-links containers in <aside> (or give them role="complementary"). Because Readability and trafilatura discard that subtree entirely, never put citable facts — author bios, specifications, key figures — inside an <aside>; those belong in the main article body.',
      code: '<article>\n  <p>Citable article body stays here.</p>\n</article>\n<aside>\n  <h3>Related Resources</h3>\n  <ul>\n    <li><a href="/related-topic">Related Topic</a></li>\n  </ul>\n</aside>',
      effort: 'easy',
      docsUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Element/aside',
      tags: ['aside', 'structure', 'semantic', 'html', 'content-extraction'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    // The meta declares content pages, so only content pages are evaluated —
    // the v1 code looped every page and reported a denominator that mixed
    // page types.
    const pages = ctx.pages.filter((p) => p.pageType === 'content');

    let marked = 0;
    const unmarked: string[] = [];
    let firstGapUrl: string | undefined;
    let evaluated = 0;

    for (const page of pages) {
      const found = findSupplementary(page);
      if (found.marked.length === 0 && found.unmarked.length === 0) continue;
      evaluated += 1;
      marked += found.marked.length;
      if (found.unmarked.length > 0) {
        unmarked.push(...found.unmarked.slice(0, 5));
        firstGapUrl ??= page.url;
      }
    }

    // A page with no sidebar, promo or related-links block is correct as it
    // stands. v1 warned at it, which asked authors to invent a sidebar.
    if (evaluated === 0) {
      return this.notApplicable(
        'No content page carries a sidebar, promo or related-links block, so there is nothing to mark up as supplementary.',
        EXPECTED,
        'No supplementary content detected',
      );
    }

    const sample = [...new Set(unmarked)].slice(0, 5).join(', ');

    if (unmarked.length === 0) {
      return this.pass(
        `All ${marked} supplementary block(s) across ${evaluated} content page(s) are marked with <aside> or role="complementary".`,
        EXPECTED,
        `${marked} marked supplementary block(s), 0 unmarked`,
      );
    }

    if (marked > 0) {
      return this.warn(
        `${unmarked.length} supplementary block(s) are not marked as complementary: ${sample}.`,
        EXPECTED,
        `${marked} marked, ${unmarked.length} unmarked — ${sample}`,
        {
          priority: 'low',
          description:
            'Some sidebar/promo blocks are wrapped in <aside> and some are not. The unwrapped ones survive Readability and trafilatura extraction and are fed to the model as article body, diluting the page. Wrap them in <aside> too — but keep citable facts out, because that subtree is discarded.',
          code: '<aside class="sidebar">\n  <h3>Related Resources</h3>\n  <ul><li><a href="/related">Related page</a></li></ul>\n</aside>',
        },
        firstGapUrl,
      );
    }

    return this.fail(
      `${unmarked.length} supplementary block(s) are in bare containers with no <aside> or role="complementary" anywhere: ${sample}.`,
      EXPECTED,
      `0 marked, ${unmarked.length} unmarked — ${sample}`,
      {
        priority: 'low',
        description:
          'Sidebar, promo and related-links containers on your content pages are plain <div>s. Readability and trafilatura cannot tell them from article body, so promos and tangential links are extracted into the text an LLM reads and summarises, and accessibility-tree agents see an undifferentiated generic node instead of a complementary landmark.',
        code: '<article>\n  <p>Citable article body stays here.</p>\n</article>\n<aside class="sidebar">\n  <h3>Related Resources</h3>\n  <ul><li><a href="/related">Related page</a></li></ul>\n</aside>',
      },
      firstGapUrl,
    );
  }
}
