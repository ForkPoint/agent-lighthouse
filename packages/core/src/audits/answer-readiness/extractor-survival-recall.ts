import type { Element } from 'domhandler';
import type { CheerioAPI } from 'cheerio';
import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import type { CheckContext, PageContext } from '../../check-context';
import { weightForGrade } from '../../scorer';
import { readabilityArticle, AGGRESSIVE_DROP_RE } from '../../gatherers/extraction';
import { normalizeText, sentences } from '../../gatherers/text-metrics';
import { parseHtml, allJsonLdNodes } from '../../parser';

/** Below this share of key spans surviving, an agent reads a different page. */
const RECALL_FLOOR = 0.9;

/** Between the two, some facts are lost depending on the pipeline. */
const WARN_FLOOR = 0.97;

/** Below this share of the page's text kept, the extractor is over-stripping. */
const OVER_STRIP_RATIO = 0.25;

/** Above it, chrome is leaking into what an agent embeds as the page. */
const LEAKAGE_RATIO = 0.85;

/** Words of a span compared for survival. Enough to be unique, short enough to survive reflow. */
const SPAN_WORDS = 8;

/** Chrome the aggressive extractors drop before anything else. */
const AGGRESSIVE_TAGS = 'script, style, noscript, template, nav, aside, header, footer, form, iframe';

interface KeySpan {
  kind: string;
  text: string;
  needle: string;
  /** Ancestor chain, outermost first, for naming what dropped it. */
  chain: string;
}

/** `tag.class#id` for one element, as a fix would name it. */
function describe(el: Element): string {
  const cls = (el.attribs?.['class'] ?? '').split(/\s+/).filter(Boolean)[0];
  const id = el.attribs?.['id'];
  return `${el.tagName}${cls ? `.${cls}` : ''}${id ? `#${id}` : ''}`;
}

/** The chain of ancestors above an element, outermost first. */
function chainOf($: CheerioAPI, el: Element): string {
  const parents = ($(el).parents().toArray() as Element[])
    .filter((parent) => !['html', 'body'].includes(parent.tagName))
    .reverse()
    .map(describe);
  return [...parents, describe(el)].join(' > ');
}

/** The comparison form of a span: its first few words, normalized. */
function needleOf(text: string): string {
  return normalizeText(text).split(' ').slice(0, SPAN_WORDS).join(' ');
}

/**
 * The spans that carry the page's facts.
 *
 * Not "the content" — the specific strings an answer would quote: the title,
 * the opening of each section, table and definition headers, captions, and the
 * structured-data strings that also appear in the prose. Recall is measured
 * against these because losing a `<th>` loses a fact, while losing a paragraph
 * of marketing copy loses nothing.
 */
function keySpans(page: PageContext): KeySpan[] {
  const $ = page.$;
  const spans: KeySpan[] = [];
  const push = (kind: string, el: Element, text: string): void => {
    const clean = text.replace(/\s+/g, ' ').trim();
    const needle = needleOf(clean);
    // Two words is the floor for prose, where a single word matches by accident.
    // A header cell is allowed to be one word — "Capacity" is the fact.
    const singleWordKinds = ['caption', 'dt', 'th'];
    const minWords = singleWordKinds.includes(kind) ? 1 : 2;
    if (needle.split(' ').filter(Boolean).length < minWords) return;
    if (minWords === 1 && needle.length < 4) return;
    if (spans.some((span) => span.needle === needle)) return;
    spans.push({ kind, text: clean, needle, chain: chainOf($, el) });
  };

  const h1 = $('h1').first();
  if (h1.length) push('h1', h1[0] as Element, h1.text());

  for (const heading of $('h2, h3').toArray() as Element[]) {
    const body = $(heading)
      .nextUntil('h1, h2, h3')
      .toArray()
      .map((el) => $(el as Element).text())
      .join(' ');
    const opener = sentences(body).slice(0, 2).join(' ');
    if (opener.trim() !== '') push('section-opener', heading, opener);
  }

  for (const selector of ['caption', 'dt', 'th']) {
    for (const el of $(selector).toArray() as Element[]) push(selector, el, $(el).text());
  }

  const bodyText = normalizeText($('body').text());
  for (const node of allJsonLdNodes(page.jsonLd)) {
    const walk = (value: unknown): void => {
      if (typeof value === 'string') {
        const needle = needleOf(value);
        // Only strings the prose also carries: the rest is machine-only data,
        // which no extractor is expected to keep.
        if (needle.split(' ').length >= 3 && bodyText.includes(needle)) {
          const host = $(`:contains("${value.slice(0, 40).replace(/"/g, '')}")`).last();
          push('json-ld', (host[0] as Element) ?? ($('body')[0] as Element), value);
        }
        return;
      }
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === 'object') Object.values(value).forEach(walk);
    };
    walk(node);
  }

  return spans;
}

/** What a Firecrawl/Jina-style extractor keeps: chrome and promo blocks dropped. */
function aggressiveText(html: string): string {
  const $ = parseHtml(html);
  $(AGGRESSIVE_TAGS).remove();
  $('[class], [id]').each((_i, el) => {
    const element = el as Element;
    const names = `${element.attribs?.['class'] ?? ''} ${element.attribs?.['id'] ?? ''}`;
    if (AGGRESSIVE_DROP_RE.test(names)) $(element).remove();
  });
  return $('body').text();
}

export class ExtractorSurvivalRecallAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'answer-readiness/extractor-survival-recall',
    category: 'answer-readiness',
    title: 'Extractor survival recall',
    failureTitle: 'Facts on this page do not survive the extractors that read it',
    description:
      "Names the spans that carry the page's facts — the `h1`, each section's opening sentences, every `caption`, `dt` and `th`, and the structured-data strings the prose repeats — then runs the page through `@mozilla/readability` and through a Firecrawl/Jina-style stripper and reports which spans did not survive, and what dropped them.",
    scoreDisplayMode: 'ternary',
    tier: 'scored',
    evidenceGrade: 'B',
    weight: weightForGrade('B', 'scored'),
    defaultPriority: 'high',
    dossier: 'docs/evidence/audits/answer-readiness/extractor-survival-recall.md',
    requires: ['origin-reachable', 'unblocked-fetches', 'rendered-body', 'sample-adequate'],
    guidance: {
      impact:
        'An answer engine never sees the page; it sees whatever its extractor kept. A specification table inside `<aside class="related-specs">` is invisible to every pipeline that strips asides, and the answer about that product gets written without it. The loss is silent: the page looks complete to its author and to every human reviewer.',
      fix: 'Put facts inside the main content container, not in an aside, a footer, or a block whose class says "related" or "promo". Where a table must sit outside the article, repeat its facts in the prose so at least one copy survives.',
      effort: 'moderate',
      docsUrl:
        'https://forkpoint.github.io/agent-lighthouse/audits/answer-readiness/extractor-survival-recall/',
      tags: ['retrieval', 'extraction', 'content', 'answer-engines'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages[0];
    if (!page) {
      return this.notApplicable(
        'No page was fetched, so no extraction could be measured.',
        'At least one fetched page',
        'None',
      );
    }

    const spans = keySpans(page);
    if (spans.length === 0) {
      return this.notApplicable(
        'The page carries no headings, captions, table headers or structured-data strings to track.',
        'Key spans to track through an extractor',
        'None found',
      );
    }

    const html = page.$.html() ?? '';
    const readability = readabilityArticle(html, page.url);
    const readabilityText = normalizeText(readability?.text ?? '');
    const aggressive = normalizeText(aggressiveText(html));
    const visible = normalizeText(page.$('body').text());

    const survives = (text: string, span: KeySpan): boolean => text.includes(span.needle);
    const readabilityKept = spans.filter((span) => survives(readabilityText, span));
    const aggressiveKept = spans.filter((span) => survives(aggressive, span));
    const readabilityRecall = readabilityKept.length / spans.length;
    const aggressiveRecall = aggressiveKept.length / spans.length;
    const recall = Math.min(readabilityRecall, aggressiveRecall);

    const dropped = spans.filter(
      (span) => !survives(readabilityText, span) || !survives(aggressive, span),
    );
    const textRatio = visible.length === 0 ? 0 : Math.min(1, aggressive.length / visible.length);

    const ratioNote =
      textRatio < OVER_STRIP_RATIO
        ? ` The aggressive extractor keeps only ${Math.round(textRatio * 100)}% of the page's text — over-strip risk.`
        : textRatio > LEAKAGE_RATIO
          ? ` The aggressive extractor keeps ${Math.round(textRatio * 100)}% of the page's text — chrome is leaking into what an agent embeds.`
          : '';
    const lines = dropped.map(
      (span) =>
        `${span.kind} "${span.text.slice(0, 80)}" lost by ${
          survives(readabilityText, span) ? 'the aggressive extractor' : 'readability'
        } — it lives in ${span.chain}`,
    );
    const found = `readability keeps ${readabilityKept.length}/${spans.length} key spans, the aggressive extractor keeps ${aggressiveKept.length}/${spans.length}.${ratioNote}${
      lines.length > 0 ? ` ${lines.join(' | ')}` : ''
    }`;
    const expected = `At least ${RECALL_FLOOR * 100}% of key spans surviving both extractors`;
    const details = {
      keySpans: spans.length,
      spanKinds: [...new Set(spans.map((span) => span.kind))],
      recall: Number(recall.toFixed(3)),
      readabilityRecall: Number(readabilityRecall.toFixed(3)),
      aggressiveRecall: Number(aggressiveRecall.toFixed(3)),
      textRatio: Number(textRatio.toFixed(3)),
      droppedSpans: lines.slice(0, 100).map((line) => line.slice(0, 1000)),
    };

    if (recall < RECALL_FLOOR) {
      return {
        ...this.fail(
          `${dropped.length} of ${spans.length} key spans do not survive the extractors an agent uses.`,
          expected,
          found,
          'Move the facts into the main content container, or repeat them in the prose.',
          page.url,
        ),
        displayValue: `${Math.round(recall * 100)}% of facts survive`,
        details,
      };
    }

    if (recall < WARN_FLOOR) {
      return {
        ...this.warn(
          `${dropped.length} of ${spans.length} key spans are lost by one of the two extractors.`,
          expected,
          found,
          'Move the flagged spans into the main content container.',
          page.url,
        ),
        displayValue: `${Math.round(recall * 100)}% of facts survive`,
        details,
      };
    }

    return {
      ...this.pass(
        `All ${spans.length} key spans survive both extractors.`,
        expected,
        found,
        page.url,
      ),
      displayValue: `${Math.round(recall * 100)}% of facts survive`,
      details,
    };
  }
}
