import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import type { CheckContext, PageContext } from '../../check-context';
import type { FetchResult } from '../../fetcher';
import { isSafeUrl } from '../../fetcher';
import { weightForGrade } from '../../scorer';
import { countTokens } from '../../gatherers/tokens';
import { shingles, jaccard } from '../../gatherers/text-metrics';

/** Read-only GETs this audit may spend looking for an alternate. */
const MAX_PROBES = 3;

/** RFC 7763 registers `text/markdown`; a parameter after it is fine. */
const MARKDOWN_TYPE = /^text\/markdown\s*(;|$)/i;

/**
 * Markup that only an HTML document carries.
 *
 * A `.md` URL that answers 200 with the HTML page again is a catch-all route,
 * not an alternate, and the content type cannot tell the two apart: a markdown
 * document served as `text/html` is a mistyped alternate, which RFC 7763 says
 * must fail. Only the body separates them.
 */
const HTML_DOCUMENT = /^\s*(<!doctype\s+html|<html[\s>])/i;

/** Markdown that a body carries even when the server types it as something else. */
const MARKDOWN_SHAPE = /^#{1,6}\s+\S|^```|^---\s*$/m;

/** Share of the HTML's five-word windows the alternate must still carry. */
const RECALL_FLOOR = 0.9;

/** Share of the HTML's headings the alternate must still carry. */
const HEADING_FLOOR = 0.9;

/** A JSX/MDX component tag: capitalised element name, no HTML equivalent. */
const MDX_COMPONENT = /<([A-Z][A-Za-z0-9]*)[\s/>]/g;

/**
 * The document with its code removed: fenced blocks and inline spans.
 *
 * Component detection reads raw markdown, so `<Button />` quoted inside a code
 * span or a fence is indistinguishable from a component the renderer left
 * unresolved. Documentation that shows JSX is the ordinary case for a markdown
 * alternate, not the exotic one, so the code comes out before the scan.
 *
 * Only these two forms are removed. An indented code block is not, because four
 * leading spaces is also how a list continues, and dropping list bodies would
 * hide real components to fix a rarer false positive.
 */
function withoutCode(markdown: string): string {
  const kept: string[] = [];
  let fence = '';
  for (const line of markdown.split('\n')) {
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (fence) {
      // A fence closes on the same character, at the same length or longer.
      if (marker && marker[0] === fence[0] && marker.length >= fence.length) fence = '';
      continue;
    }
    if (marker) {
      fence = marker;
      continue;
    }
    kept.push(line.replace(/(`+)[^\n]*?\1/g, ' '));
  }
  return kept.join('\n');
}

/**
 * Block-level text of the HTML, one block per string.
 *
 * cheerio's `.text()` concatenates block elements with no separator, so a
 * heading runs into the paragraph beneath it and every five-word window that
 * crosses that seam is a word the markdown side will never contain. Reading the
 * blocks individually keeps both sides comparable.
 */
const BLOCK_SELECTOR = 'h1, h2, h3, h4, h5, h6, p, li, td, th, caption, figcaption, blockquote, dt, dd';

/** ATX headings of a markdown document, in document order. */
function markdownHeadings(markdown: string): string[] {
  return [...markdown.matchAll(/^#{1,6}\s+(.+?)\s*#*$/gm)].map((m) => (m[1] ?? '').trim());
}

/** Prose of a markdown document: headings, markers and links stripped. */
function markdownProse(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`>|-]/g, ' ');
}

/** An alternate URL declared in the document head or in a `Link` header. */
function declaredAlternate(page: PageContext): string | undefined {
  const fromHead = page.headLinks.find(
    (link) => link.rel.toLowerCase().includes('alternate') && MARKDOWN_TYPE.test(link.type),
  );
  if (fromHead?.href) return new URL(fromHead.href, page.url).toString();

  const header = page.fetchResult.headers['link'] ?? '';
  for (const part of header.split(/,(?=\s*<)/)) {
    if (!/rel\s*=\s*"?alternate/i.test(part)) continue;
    if (!/type\s*=\s*"?text\/markdown/i.test(part)) continue;
    const href = /<([^>]+)>/.exec(part)?.[1];
    if (href) return new URL(href, page.url).toString();
  }
  return undefined;
}

/** How well a markdown document that was actually read mirrors its page. */
interface Assessment {
  /** Higher is better; the audit scores the best document any route returned. */
  rank: 0 | 1 | 2 | 3;
  route: string;
  url: string;
  contentType: string;
  markdownTokens: number;
  htmlTokens: number;
  saving: number;
  headingRecall: number;
  recall: number;
  similarity: number;
  components: string[];
  missingHeadings: string[];
}

const RANK_WRONG_TYPE = 0;
const RANK_DRIFTED = 1;
const RANK_COMPONENTS = 2;
const RANK_FAITHFUL = 3;

export class MarkdownAlternateAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'content-extraction/markdown-alternate',
    category: 'content-extraction',
    title: 'Markdown alternate: resolvable, faithful, cheaper',
    failureTitle: 'The markdown alternate this site serves is not usable',
    description:
      'Where a site serves a markdown alternate of a page — by a declared `alternate` link, by `url + ".md"`, or by `Accept: text/markdown` — checks that it resolves as `text/markdown`, still carries the page\'s headings and prose, and costs fewer tokens than the HTML. A site that serves no markdown alternate at all is reported as not applicable: the documented consumers are interactive coding agents, and no cited source measures a cost to a site that serves none.',
    scoreDisplayMode: 'ternary',
    tier: 'scored',
    evidenceGrade: 'A',
    weight: weightForGrade('A', 'scored'),
    defaultPriority: 'medium',
    dossier: 'docs/evidence/audits/content-extraction/markdown-alternate.md',
    guidance: {
      impact:
        'A markdown alternate is a promise that an agent can read the page cheaply and get the same answer. A stale or partial alternate breaks that promise silently: the agent gets a document that looks authoritative, costs less, and says less than the page it claims to mirror. Serving it as `text/plain` or `text/html` is the same failure one level down — the client that negotiated for markdown cannot tell it got any. The consumers this is graded on are interactive coding agents — Claude Code, Cursor, Copilot Chat and CLI, Codex CLI — and GPTBot, measured taking markdown on 34.8% of fetches where a `.md` URL exists.',
      fix: 'Serve the alternate from the same source as the HTML, so headings and prose cannot drift, with `Content-Type: text/markdown` (a `charset` parameter is fine). Publish it on the page URL plus `.md`, or answer `Accept: text/markdown` on the page URL itself — those are the two routes with documented consumers. Declaring it with `<link rel="alternate" type="text/markdown" href="...">` saves an agent a guess, but the link relation itself has one single-sourced consumer, so this audit reports it rather than scoring it.',
      code: `<link rel="alternate" type="text/markdown" href="/kettles.md">

# Content-Type: text/markdown; charset=utf-8`,
      effort: 'moderate',
      docsUrl:
        'https://forkpoint.github.io/agent-lighthouse/audits/content-extraction/markdown-alternate/',
      tags: ['markdown', 'tokens', 'content', 'llms-txt'],
    },
  };

  /**
   * Grade one markdown document that a probe actually returned.
   *
   * Pure: no fetching. The audit assesses every document it reads and keeps the
   * best, so a stale declared link cannot outrank the alternate the site really
   * serves on its `.md` URL.
   */
  private assess(page: PageContext, result: FetchResult, route: string, url: string): Assessment {
    const markdown = result.body;
    const htmlBody = page.fetchResult.body ?? '';
    const markdownTokens = countTokens(markdown);
    const htmlTokens = countTokens(htmlBody);
    const saving = htmlTokens === 0 ? 0 : 1 - markdownTokens / htmlTokens;

    const htmlHeadings = page
      .$('h1, h2, h3, h4, h5, h6')
      .toArray()
      .map((el) => page.$(el).text().replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    const mdHeadings = markdownHeadings(markdown).map((heading) => heading.toLowerCase());
    const missingHeadings = htmlHeadings.filter(
      (heading) => !mdHeadings.includes(heading.toLowerCase()),
    );
    const headingRecall =
      htmlHeadings.length === 0 ? 1 : 1 - missingHeadings.length / htmlHeadings.length;

    const htmlText = page
      .$('body')
      .find(BLOCK_SELECTOR)
      .toArray()
      // Innermost blocks only: a <blockquote> wrapping a <p> would otherwise
      // contribute the same sentence twice and depress recall on both sides.
      .filter((el) => page.$(el).find(BLOCK_SELECTOR).length === 0)
      .map((el) => page.$(el).text().replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join(' ');
    const htmlShingles = shingles(htmlText);
    const mdShingles = shingles(markdownProse(markdown));
    const shared = [...htmlShingles].filter((s) => mdShingles.has(s)).length;
    const recall = htmlShingles.size === 0 ? 1 : shared / htmlShingles.size;

    const components = [
      ...new Set([...withoutCode(markdown).matchAll(MDX_COMPONENT)].map((m) => m[1] ?? '')),
    ];

    const rank: Assessment['rank'] = !MARKDOWN_TYPE.test(result.contentType)
      ? RANK_WRONG_TYPE
      : headingRecall < HEADING_FLOOR || recall < RECALL_FLOOR
        ? RANK_DRIFTED
        : components.length > 0
          ? RANK_COMPONENTS
          : RANK_FAITHFUL;

    return {
      rank,
      route,
      url,
      contentType: result.contentType,
      markdownTokens,
      htmlTokens,
      saving,
      headingRecall,
      recall,
      similarity: jaccard(htmlShingles, mdShingles),
      components,
      missingHeadings,
    };
  }

  async audit(ctx: CheckContext): Promise<AuditResult> {
    // A markdown alternate is per-page, and a marketing homepage almost never
    // has one even on sites where every content page does. Prefer the page that
    // declares an alternate, then any non-homepage. Costs no fetch.
    const page =
      ctx.pages.find((candidate) => declaredAlternate(candidate) !== undefined) ??
      ctx.pages.find((candidate) => candidate.pageType !== 'homepage') ??
      ctx.pages[0];
    if (!page) {
      return this.notApplicable(
        'No page was fetched, so no markdown alternate could be looked for.',
        'A page to look for a markdown alternate of',
        'No page fetched.',
      );
    }

    const declared = declaredAlternate(page);
    const dotMd = (() => {
      const url = new URL(page.url);
      url.pathname = url.pathname.replace(/\/$/, '') + '.md';
      return url.toString();
    })();

    // Three routes, three probes, in the order an agent would try them. A
    // declared link pointing at the same URL as the `.md` convention is one
    // route, not two.
    const probes: Array<{ url: string; acceptHeader?: string; route: string }> = [
      ...(declared ? [{ url: declared, route: 'declared link' }] : []),
      ...(declared === dotMd ? [] : [{ url: dotMd, route: 'url + ".md"' }]),
      { url: page.url, acceptHeader: 'text/markdown', route: 'Accept: text/markdown' },
    ].slice(0, MAX_PROBES);

    let best: Assessment | undefined;
    /** Set when the declared link answers at all, for the not-applicable detail. */
    let declaredStatus = 0;
    for (const probe of probes) {
      if (!(await isSafeUrl(probe.url))) continue;
      let result: FetchResult;
      try {
        result = await ctx.fetch({
          url: probe.url,
          followRedirects: true,
          ...(probe.acceptHeader ? { acceptHeader: probe.acceptHeader } : {}),
        });
      } catch {
        continue;
      }
      if (probe.route === 'declared link') declaredStatus = result.status;
      if (result.status !== 200 || result.body.trim() === '') continue;
      // The HTML document answering again is a catch-all route, not an
      // alternate — whatever content type it carries.
      if (HTML_DOCUMENT.test(result.body)) continue;
      // A 200 that is neither typed nor shaped as markdown is a soft 404.
      if (!MARKDOWN_TYPE.test(result.contentType) && !MARKDOWN_SHAPE.test(result.body)) continue;

      const assessment = this.assess(page, result, probe.route, probe.url);
      if (!best || assessment.rank > best.rank) best = assessment;
      // Keep probing while a better document is still possible: the declared
      // link is a grade-C signal and must never be the last word on a scored
      // outcome when the `.md` URL or content negotiation serves a good one.
      if (best.rank === RANK_FAITHFUL) break;
    }

    if (!best) {
      // Absence is not scored. The grade-A evidence documents consumption when
      // a markdown alternate is served; no cited source measures a cost to a
      // site that serves none. ChatGPT-User takes markdown on 0.1% of fetches,
      // a 14-day controlled test found 0 crawler visits and 0 citations for
      // `.md` against 137 to matched HTML, and Google states markdown is not
      // needed for Search or its AI features.
      const expected =
        'A markdown document served as text/markdown, reachable on the ".md" URL, by Accept: text/markdown, or at a declared alternate link';
      const tried = `${probes.length} route(s) tried — ${probes.map((probe) => probe.route).join(', ')}`;
      return {
        ...this.notApplicable(
          declared
            ? `A markdown alternate is declared at ${declared}, but no markdown document could be read from it, and nothing answered on the ".md" URL or by content negotiation. The link relation has one single-sourced consumer, so its state is reported rather than scored.`
            : `This page serves no markdown alternate: nothing answered on the ".md" URL or on Accept: text/markdown. The documented consumers of markdown alternates are interactive coding agents, and no cited source measures a cost to a site that serves none, so absence is not scored.`,
          expected,
          declared
            ? `Declared at ${declared}; HTTP ${declaredStatus || 'no response'}; no markdown document read on any route. ${tried}.`
            : `${tried} — none returned a markdown document.`,
          page.url,
        ),
        details: {
          route: 'none',
          probes: probes.length,
          ...(declared ? { declared, declaredStatus, verified: false } : {}),
        },
      };
    }

    const details = {
      route: best.route,
      alternateUrl: best.url,
      contentType: best.contentType,
      markdownTokens: best.markdownTokens,
      htmlTokens: best.htmlTokens,
      tokenSaving: Number(best.saving.toFixed(3)),
      headingRecall: Number(best.headingRecall.toFixed(3)),
      shingleRecall: Number(best.recall.toFixed(3)),
      similarity: Number(best.similarity.toFixed(3)),
      mdxComponents: best.components.slice(0, 100),
      missingHeadings: best.missingHeadings.slice(0, 100).map((heading) => heading.slice(0, 1000)),
      ...(declared ? { declared } : {}),
    };
    const savingNote = `${best.markdownTokens} tokens against ${best.htmlTokens} for the HTML — ${Math.round(best.saving * 100)}% fewer tokens`;
    const expected = `An alternate served as text/markdown, carrying at least ${RECALL_FLOOR * 100}% of the page's prose and headings`;

    if (best.rank === RANK_WRONG_TYPE) {
      return {
        ...this.fail(
          `The alternate at ${best.url} is served as ${best.contentType || 'no content type'}, not text/markdown.`,
          expected,
          `Found via ${best.route}; Content-Type "${best.contentType}" — RFC 7763 registers text/markdown, and a client that negotiated for it cannot tell it received markdown. ${savingNote}.`,
          'Serve the alternate with `Content-Type: text/markdown`; a charset parameter is fine.',
          page.url,
        ),
        details,
      };
    }

    if (best.rank === RANK_DRIFTED) {
      return {
        ...this.fail(
          `The alternate has drifted from the page: ${Math.round(best.recall * 100)}% of its prose and ${Math.round(best.headingRecall * 100)}% of its headings survive.`,
          expected,
          `Found via ${best.route}. Missing headings: ${best.missingHeadings.join(' | ') || 'none'}. ${savingNote}.`,
          'Generate the alternate from the same source as the HTML so the two cannot drift.',
          page.url,
        ),
        details,
      };
    }

    if (best.rank === RANK_COMPONENTS) {
      return {
        ...this.warn(
          `The alternate is faithful but carries ${best.components.length} unresolved component tag(s).`,
          expected,
          `Found via ${best.route}. Component tags an agent cannot interpret: ${best.components.join(', ')}. ${savingNote}.`,
          'Render component tags to markdown before serving the alternate.',
          page.url,
        ),
        details,
      };
    }

    return {
      ...this.pass(
        `A faithful markdown alternate is served as text/markdown and costs ${Math.round(best.saving * 100)}% fewer tokens.`,
        expected,
        `Found via ${best.route}. ${savingNote}.`,
        page.url,
      ),
      displayValue: `${Math.round(best.saving * 100)}% fewer tokens`,
      details,
    };
  }
}
