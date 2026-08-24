import type { CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';
import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import type { CheckContext, PageContext } from '../../check-context';
import { weightForGrade } from '../../scorer';
import { INSTRUCTION_LEXICON } from './invisible-instruction-scan';
import { allJsonLdNodes } from '../../parser';

/**
 * DOM anchors for visitor-contributed regions.
 *
 * Deliberately the vocabulary a theme uses for the container, not for one
 * comment: a region is the unit a fix edits, and a fix edits one template.
 */
const REGION_SELECTORS = [
  '#comments',
  '.comments',
  '.comment',
  '[id^="comment-"]',
  '.review',
  '.reviews',
  '[itemprop="reviewBody"]',
  '.testimonial',
].join(', ');

/** Hosted comment systems, matched on the embed script's src. */
const EMBED_VENDORS: ReadonlyArray<{ pattern: RegExp; name: string }> = [
  { pattern: /disqus\.com/i, name: 'disqus' },
  { pattern: /commento/i, name: 'commento' },
  { pattern: /giscus/i, name: 'giscus' },
  { pattern: /utteranc\.es/i, name: 'utterances' },
];

/** schema.org types whose content is written by a visitor, not by the site. */
const UGC_TYPES = new Set([
  'comment',
  'usercomments',
  'review',
  'question',
  'answer',
  'discussionforumposting',
]);

/** Textarea names that mark a form as a submission surface for visitor prose. */
const UGC_FIELD_RE = /comment|review|message|feedback|testimonial/i;

/** The only elements Google honours `data-nosnippet` on. */
const NOSNIPPET_TAGS = new Set(['span', 'div', 'section']);

/** What the audit reports about one region. */
interface Region {
  /** A selector-shaped label, so the finding maps to one template. */
  label: string;
  pageUrl: string;
  /** Markup that a sanitizer should have stripped, and other boundary facts. */
  issues: string[];
  /** Contained by a `data-nosnippet` span/div/section, or marked `rel="ugc"`. */
  bounded: boolean;
  /** Raw markup survived, or an instruction payload sits in an open region. */
  failing: boolean;
}

/** A selector-shaped name for an element: `#id`, `.class`, else the tag. */
function label(el: Element): string {
  const id = el.attribs?.['id'];
  if (id) return `#${id}`;
  const cls = (el.attribs?.['class'] ?? '').split(/\s+/).filter(Boolean)[0];
  if (cls) return `.${cls}`;
  return el.tagName;
}

/** True when `el` has an ancestor inside `set` — the outer region reports it. */
function hasAncestorIn($: CheerioAPI, el: Element, set: Set<Element>): boolean {
  return $(el)
    .parents()
    .toArray()
    .some((parent) => set.has(parent as Element));
}

/** Boundary markers on the region itself or on an ancestor. */
function boundaryFor($: CheerioAPI, el: Element): { bounded: boolean; issues: string[] } {
  const issues: string[] = [];
  let bounded = false;

  for (const node of [el, ...($(el).parents().toArray() as Element[])]) {
    if (node.attribs?.['data-nosnippet'] === undefined) continue;
    if (NOSNIPPET_TAGS.has(node.tagName)) {
      bounded = true;
      break;
    }
    issues.push(
      `data-nosnippet sits on <${node.tagName}>, which Google does not honour — it honours the attribute on span, div and section only`,
    );
  }

  const links = $(el).find('a[href]').toArray() as Element[];
  const marked = links.filter((a) => /\b(ugc|nofollow)\b/i.test(a.attribs?.['rel'] ?? ''));
  if (!bounded && links.length > 0 && marked.length === links.length) bounded = true;

  return { bounded, issues };
}

/** Visitor markup that a sanitizer should have removed before rendering. */
function survivingMarkup($: CheerioAPI, el: Element, pageUrl: string): string[] {
  const issues: string[] = [];
  const scope = $(el);

  if (scope.find('[style]').length > 0) issues.push('an inline style attribute survived');
  if (scope.find('iframe').length > 0) issues.push('an iframe survived');
  if (scope.find('script').length > 0) issues.push('a script tag survived');

  const origin = (() => {
    try {
      return new URL(pageUrl).origin;
    } catch {
      return '';
    }
  })();
  const foreignImage = (scope.find('img[src]').toArray() as Element[]).some((img) => {
    const src = img.attribs?.['src'] ?? '';
    if (!/^https?:/i.test(src)) return false;
    try {
      return new URL(src).origin !== origin;
    } catch {
      return false;
    }
  });
  if (foreignImage) issues.push('a cross-origin image survived');

  return issues;
}

/** Every region on one page, outermost only, already judged. */
function regionsOf(page: PageContext): Region[] {
  const $ = page.$;
  const elements = new Set<Element>($(REGION_SELECTORS).toArray() as Element[]);

  const forms = ($('form').toArray() as Element[]).filter((form) => {
    if (/wp-comments-post\.php/i.test(form.attribs?.['action'] ?? '')) return true;
    return ($(form).find('textarea[name]').toArray() as Element[]).some((area) =>
      UGC_FIELD_RE.test(area.attribs?.['name'] ?? ''),
    );
  });
  for (const form of forms) elements.add(form);

  const regions: Region[] = [];

  for (const el of elements) {
    if (hasAncestorIn($, el, elements)) continue;
    const { bounded, issues } = boundaryFor($, el);
    const markup = survivingMarkup($, el, page.url);
    const text = $(el).text();
    const instruction = !bounded && INSTRUCTION_LEXICON.some((re) => re.test(text));
    if (instruction) issues.push('an instruction-shaped payload sits in this open region');
    regions.push({
      label: label(el),
      pageUrl: page.url,
      issues: [...issues, ...markup],
      bounded,
      failing: markup.length > 0 || instruction,
    });
  }

  // A hosted comment system renders its thread after load, so the served DOM
  // carries the embed and nothing to contain.
  for (const script of $('script[src]').toArray() as Element[]) {
    const src = script.attribs?.['src'] ?? '';
    const vendor = EMBED_VENDORS.find((v) => v.pattern.test(src));
    if (!vendor) continue;
    const { bounded, issues } = boundaryFor($, script);
    regions.push({
      label: `${vendor.name} embed`,
      pageUrl: page.url,
      issues,
      bounded,
      failing: false,
    });
  }

  if (regions.length > 0) return regions;

  // No DOM anchor, but the page still declares visitor-written content.
  const declared = allJsonLdNodes(page.jsonLd).filter((node) => {
    const type = (node as { '@type'?: unknown })['@type'];
    const names = Array.isArray(type) ? type : [type];
    return names.some((name) => typeof name === 'string' && UGC_TYPES.has(name.toLowerCase()));
  });
  if (declared.length === 0) return [];

  return [
    {
      label: 'JSON-LD visitor content',
      pageUrl: page.url,
      issues: ['visitor-written content is declared in JSON-LD with no marked region around it'],
      bounded: false,
      failing: false,
    },
  ];
}

export class UgcTrustBoundaryMarkersAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'operability-safety/ugc-trust-boundary-markers',
    category: 'operability-safety',
    title: 'UGC Trust-Boundary Markers',
    failureTitle: 'Visitor-written regions carry no boundary an agent can see',
    description:
      'Locates visitor-contributed regions — comments, reviews, Q&A, forum posts, submission forms — and checks whether any machine-readable boundary separates them from editorial copy: `data-nosnippet` containment on a span, div or section, `rel="ugc"` on their outbound links, and whether raw markup survives the sanitizer inside them.',
    scoreDisplayMode: 'ternary',
    tier: 'scored',
    evidenceGrade: 'B',
    weight: weightForGrade('B', 'scored'),
    defaultPriority: 'high',
    dossier: 'docs/evidence/audits/operability-safety/ugc-trust-boundary-markers.md',
    guidance: {
      impact:
        'Attacker-controllable text sits in the same DOM as first-party copy with no boundary, so anything a visitor types reads, to a fetching agent, as a statement the domain made. Google excludes text inside a `data-nosnippet` span, div or section from snippets across web search, Discover and AI Overviews, and includes everything outside it. The sanitizer arm matters most: if a comment body can carry an inline style or an iframe, hiding an instruction inside visitor text becomes self-serve on this site.',
      fix: 'Wrap each visitor-written region in a `<div data-nosnippet>` — the attribute is honoured on span, div and section only — and add `rel="ugc"` to links inside it. Strip inline `style`, `iframe`, `script` and remote `img` from submitted markup at render time rather than at submit time, so already-stored content is covered too.',
      code: `<!-- Visitor text with no boundary an agent can see -->
<section id="comments">
  <div class="comment">Great mug. <a href="https://spam.test/">More</a></div>
</section>

<!-- Contained and marked -->
<div data-nosnippet>
  <section id="comments">
    <div class="comment">Great mug. <a rel="ugc nofollow" href="https://spam.test/">More</a></div>
  </section>
</div>`,
      effort: 'moderate',
      docsUrl:
        'https://forkpoint.github.io/agent-lighthouse/audits/operability-safety/ugc-trust-boundary-markers/',
      tags: ['injection-safety', 'security', 'agent-trust'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const regions = ctx.pages.flatMap(regionsOf);

    if (regions.length === 0) {
      return this.notApplicable(
        'No visitor-contributed region was found on the sampled pages.',
        'Comment, review, Q&A or forum regions to assess',
        'None found',
      );
    }

    const failing = regions.filter((r) => r.failing);
    const open = regions.filter((r) => !r.failing && !r.bounded);
    const expected = 'Every visitor-written region contained by data-nosnippet or marked rel="ugc"';
    const describe = (r: Region) =>
      `${r.label} on ${r.pageUrl}${r.issues.length > 0 ? ` — ${r.issues.join('; ')}` : ' — no data-nosnippet containment and no rel="ugc" link'}`;
    const lines = [...failing, ...open].map(describe);
    const details = {
      regionCount: regions.length,
      failingCount: failing.length,
      openCount: open.length,
      regions: lines.slice(0, 100).map((line) => line.slice(0, 1000)),
    };

    if (failing.length > 0) {
      return {
        ...this.fail(
          `${failing.length} of ${regions.length} visitor-written regions render markup the sanitizer should have stripped, or carry an instruction payload with no boundary.`,
          expected,
          lines.join(' | '),
          'Strip inline style, iframe, script and remote images from visitor markup at render time, then wrap the region in a data-nosnippet div.',
        ),
        details,
      };
    }

    if (open.length > 0) {
      return {
        ...this.warn(
          `${open.length} of ${regions.length} visitor-written regions carry no trust boundary.`,
          expected,
          lines.join(' | '),
          'Wrap each region in a `<div data-nosnippet>` and add `rel="ugc"` to the links inside it.',
        ),
        details,
      };
    }

    return {
      ...this.pass(
        `All ${regions.length} visitor-written regions are contained or marked.`,
        expected,
        `${regions.length} regions, each data-nosnippet-contained or rel="ugc"-marked`,
      ),
      details,
    };
  }
}
