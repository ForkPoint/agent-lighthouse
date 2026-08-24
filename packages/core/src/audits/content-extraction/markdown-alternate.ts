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

/** Share of the HTML's five-word windows the alternate must still carry. */
const RECALL_FLOOR = 0.9;

/** Share of the HTML's headings the alternate must still carry. */
const HEADING_FLOOR = 0.9;

/** A JSX/MDX component tag: capitalised element name, no HTML equivalent. */
const MDX_COMPONENT = /<([A-Z][A-Za-z0-9]*)[\s/>]/g;

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

export class MarkdownAlternateAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'content-extraction/markdown-alternate',
    category: 'content-extraction',
    title: 'Markdown alternate: discoverable, resolvable, faithful, cheaper',
    failureTitle: 'No usable markdown alternate for this page',
    description:
      'Looks for a markdown alternate of the page by the three routes agents actually try — a declared `alternate` link, `url + ".md"`, and `Accept: text/markdown` — then checks that it resolves as `text/markdown`, still carries the page\'s headings and prose, and costs fewer tokens than the HTML.',
    scoreDisplayMode: 'ternary',
    tier: 'scored',
    evidenceGrade: 'A',
    weight: weightForGrade('A', 'scored'),
    defaultPriority: 'medium',
    dossier: 'docs/evidence/audits/content-extraction/markdown-alternate.md',
    guidance: {
      impact:
        'A markdown alternate is a promise that an agent can read the page cheaply and get the same answer. A stale or partial alternate breaks that promise silently: the agent gets a document that looks authoritative, costs less, and says less than the page it claims to mirror. Serving it as `text/plain` or `text/html` is the same failure one level down — the client that negotiated for markdown cannot tell it got any.',
      fix: 'Serve the alternate with `Content-Type: text/markdown` (a `charset` parameter is fine), generate it from the same source as the HTML so headings and prose cannot drift, and declare it with `<link rel="alternate" type="text/markdown" href="...">` so an agent does not have to guess the URL.',
      code: `<link rel="alternate" type="text/markdown" href="/kettles.md">

# Content-Type: text/markdown; charset=utf-8`,
      effort: 'moderate',
      docsUrl:
        'https://forkpoint.github.io/agent-lighthouse/audits/content-extraction/markdown-alternate/',
      tags: ['markdown', 'tokens', 'content', 'llms-txt'],
    },
  };

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const page = ctx.pages[0];
    if (!page) {
      return this.fail(
        'No page was fetched, so no markdown alternate could be found.',
        '<link rel="alternate" type="text/markdown">',
        'No page fetched',
      );
    }

    const declared = declaredAlternate(page);
    const dotMd = (() => {
      const url = new URL(page.url);
      url.pathname = url.pathname.replace(/\/$/, '') + '.md';
      return url.toString();
    })();

    // Three routes, three probes, in the order an agent would try them.
    const probes: Array<{ url: string; acceptHeader?: string; route: string }> = [
      ...(declared ? [{ url: declared, route: 'declared link' }] : []),
      { url: dotMd, route: 'url + ".md"' },
      { url: page.url, acceptHeader: 'text/markdown', route: 'Accept: text/markdown' },
    ].slice(0, MAX_PROBES);

    let hit: { result: FetchResult; route: string; url: string } | undefined;
    /** Set when the declared link resolves to an error, which is checkable brokenness. */
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
        if (probe.route === 'declared link') declaredStatus = 0;
        continue;
      }
      if (probe.route === 'declared link') declaredStatus = result.status;
      if (result.status !== 200 || result.body.trim() === '') continue;
      // The Accept route returning the HTML document again is not an alternate.
      if (probe.acceptHeader && /^text\/html/i.test(result.contentType)) continue;
      hit = { result, route: probe.route, url: probe.url };
      break;
    }

    if (!hit && declared && declaredStatus >= 400) {
      return {
        ...this.fail(
          `The declared markdown alternate at ${declared} does not resolve (HTTP ${declaredStatus}).`,
          '<link rel="alternate" type="text/markdown"> resolving to a markdown document',
          `Declared alternate returned HTTP ${declaredStatus}.`,
          'Serve the URL the alternate link points at, or remove the link.',
          page.url,
        ),
        details: { route: 'declared link', alternateUrl: declared, status: declaredStatus },
      };
    }

    if (!hit && declared) {
      // Declared but unreadable here: an empty body, or a fetch this scanner
      // could not complete. Discovery is what the link is for, and punishing a
      // document the scan never saw would be a finding about our own fetch.
      return {
        ...this.pass(
          `Markdown alternate link found: "${declared}". Its document could not be read in this scan, so fidelity was not assessed.`,
          '<link rel="alternate" type="text/markdown">',
          `Declared at ${declared}; no readable document returned, so resolvability and fidelity are unverified.`,
          page.url,
        ),
        details: { route: 'declared link', alternateUrl: declared, verified: false },
      };
    }

    if (!hit) {
      return {
        ...this.fail(
          'No Markdown alternate link found, and none answered on the `.md` URL or by content negotiation.',
          '<link rel="alternate" type="text/markdown">',
          `${probes.length} route(s) tried — declared link, url + ".md", Accept: text/markdown — none answered with a markdown document.`,
          {
            priority: 'medium',
            description:
              'AI agents prefer Markdown over HTML because it strips layout noise and fits more content into a limited context window. A Markdown alternate lets an agent fetch a clean, token-efficient version of the page.',
            code: '<link rel="alternate" type="text/markdown" href="/page.md">',
          },
          page.url,
        ),
        details: { route: 'none', probes: probes.length },
      };
    }

    const markdown = hit.result.body;
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

    const components = [...new Set([...markdown.matchAll(MDX_COMPONENT)].map((m) => m[1] ?? ''))];

    const details = {
      route: hit.route,
      alternateUrl: hit.url,
      contentType: hit.result.contentType,
      markdownTokens,
      htmlTokens,
      tokenSaving: Number(saving.toFixed(3)),
      headingRecall: Number(headingRecall.toFixed(3)),
      shingleRecall: Number(recall.toFixed(3)),
      similarity: Number(jaccard(htmlShingles, mdShingles).toFixed(3)),
      mdxComponents: components.slice(0, 100),
      missingHeadings: missingHeadings.slice(0, 100).map((heading) => heading.slice(0, 1000)),
    };
    const savingNote = `${markdownTokens} tokens against ${htmlTokens} for the HTML — ${Math.round(saving * 100)}% fewer tokens`;
    const expected = `An alternate served as text/markdown, carrying at least ${RECALL_FLOOR * 100}% of the page's prose and headings`;

    if (!MARKDOWN_TYPE.test(hit.result.contentType)) {
      return {
        ...this.fail(
          `The alternate at ${hit.url} is served as ${hit.result.contentType || 'no content type'}, not text/markdown.`,
          expected,
          `Found via ${hit.route}; Content-Type "${hit.result.contentType}" — RFC 7763 registers text/markdown, and a client that negotiated for it cannot tell it received markdown. ${savingNote}.`,
          'Serve the alternate with `Content-Type: text/markdown`; a charset parameter is fine.',
          page.url,
        ),
        details,
      };
    }

    if (headingRecall < HEADING_FLOOR || recall < RECALL_FLOOR) {
      return {
        ...this.fail(
          `The alternate has drifted from the page: ${Math.round(recall * 100)}% of its prose and ${Math.round(headingRecall * 100)}% of its headings survive.`,
          expected,
          `Found via ${hit.route}. Missing headings: ${missingHeadings.join(' | ') || 'none'}. ${savingNote}.`,
          'Generate the alternate from the same source as the HTML so the two cannot drift.',
          page.url,
        ),
        details,
      };
    }

    if (components.length > 0) {
      return {
        ...this.warn(
          `The alternate is faithful but carries ${components.length} unresolved component tag(s).`,
          expected,
          `Found via ${hit.route}. Component tags an agent cannot interpret: ${components.join(', ')}. ${savingNote}.`,
          'Render component tags to markdown before serving the alternate.',
          page.url,
        ),
        details,
      };
    }

    return {
      ...this.pass(
        `A faithful markdown alternate is served as text/markdown and costs ${Math.round(saving * 100)}% fewer tokens.`,
        expected,
        `Found via ${hit.route}. ${savingNote}.`,
        page.url,
      ),
      displayValue: `${Math.round(saving * 100)}% fewer tokens`,
      details,
    };
  }
}
