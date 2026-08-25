import type { Element } from 'domhandler';
import type { CheerioAPI } from 'cheerio';
import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import type { CheckContext } from '../../check-context';
import { weightForGrade } from '../../scorer';
import { countTokens } from '../../gatherers/tokens';
import { detailLines } from '../../detail-lines';

/**
 * The retrieval window most pipelines chunk to.
 *
 * 512 tokens is the default in the embedding stacks this matters for; a section
 * over it is not "long", it is two chunks, and the second one arrives with no
 * heading on it.
 */
const WINDOW_TOKENS = 512;

/** Below this a section is too sparse to produce a discriminative embedding. */
const THIN_TOKENS = 25;

/** A page under one window is never split, so there is nothing to profile. */
const MIN_PAGE_TOKENS = WINDOW_TOKENS;

/** Above this share of body tokens inside the window, chunking is safe. */
const PASS_SCORE = 0.9;

/** Between the two, some of the page arrives as headless tail chunks. */
const WARN_SCORE = 0.7;

interface Section {
  heading: string;
  tokens: number;
  chars: number;
  findings: string[];
}

/** A GFM-ish serialization of a table or list, for pricing it as one atom. */
function serializeAtomic($: CheerioAPI, el: Element): string {
  if (el.tagName.toLowerCase() === 'table') {
    return ($(el).find('tr').toArray() as Element[])
      .map((row) =>
        `| ${($(row).find('th, td').toArray() as Element[])
          .map((cell) => $(cell).text().replace(/\s+/g, ' ').trim())
          .join(' | ')} |`,
      )
      .join('\n');
  }
  return ($(el).find('li').toArray() as Element[])
    .map((li, index) => `${index + 1}. ${$(li).text().replace(/\s+/g, ' ').trim()}`)
    .join('\n');
}

export class SectionSplitRiskProfileAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'answer-readiness/section-split-risk-profile',
    category: 'answer-readiness',
    title: 'Section split-risk profile',
    failureTitle: 'Sections are longer than the window that will chunk them',
    description:
      'Counts each `h2`/`h3` section with a real BPE tokenizer and reports the four ways a page chunks badly: sections over the 512-token window (each producing headless tail chunks), a long page with no headings to cut on, sections too thin to embed distinctly, and single tables or lists whose serialization exceeds the window on its own.',
    scoreDisplayMode: 'ternary',
    tier: 'scored',
    evidenceGrade: 'B',
    weight: weightForGrade('B', 'scored'),
    defaultPriority: 'medium',
    dossier: 'docs/evidence/audits/answer-readiness/section-split-risk-profile.md',
    guidance: {
      impact:
        'Retrieval pipelines cut pages into fixed windows. A section longer than the window becomes one chunk carrying the heading and one or more tail chunks carrying none — and a tail chunk is text with no subject, which retrieves badly and cites worse. A page with no headings at all is cut at arbitrary offsets throughout.',
      fix: 'Add an `h2` or `h3` roughly every 400 tokens of prose, and split a specification table that runs past the window into per-topic tables so the header row stays with its rows.',
      effort: 'moderate',
      docsUrl:
        'https://forkpoint.github.io/agent-lighthouse/audits/answer-readiness/section-split-risk-profile/',
      tags: ['retrieval', 'chunking', 'content', 'answer-engines'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages[0];
    if (!page) {
      return this.notApplicable(
        'No page was fetched, so no chunking risk could be profiled.',
        'At least one fetched page',
        'None',
      );
    }

    const $ = page.$;
    const container = $('main, article').first().length ? $('main, article').first() : $('body');
    const bodyText = container.text().replace(/\s+/g, ' ').trim();
    const bodyTokens = countTokens(bodyText);

    if (bodyTokens < MIN_PAGE_TOKENS) {
      return this.notApplicable(
        `The page carries ${bodyTokens} tokens, inside a single ${WINDOW_TOKENS}-token retrieval window.`,
        `A page over ${WINDOW_TOKENS} tokens, which a retriever must cut`,
        `${bodyTokens} tokens`,
      );
    }

    const headings = container.find('h2, h3').toArray() as Element[];
    const h2Count = container.find('h2').length;
    const sections: Section[] = [];

    for (const heading of headings) {
      const nodes = $(heading).nextUntil('h1, h2, h3').toArray() as Element[];
      const text = `${$(heading).text()} ${nodes.map((node) => $(node).text()).join(' ')}`
        .replace(/\s+/g, ' ')
        .trim();
      const section: Section = {
        heading: $(heading).text().replace(/\s+/g, ' ').trim(),
        tokens: countTokens(text),
        chars: text.length,
        findings: [],
      };

      if (section.tokens > WINDOW_TOKENS) {
        section.findings.push(`SPLIT(${Math.ceil(section.tokens / WINDOW_TOKENS) - 1} headless tails)`);
      }
      if (section.tokens < THIN_TOKENS) section.findings.push('THIN');

      for (const node of nodes) {
        if (!['table', 'ol', 'ul'].includes(node.tagName.toLowerCase())) continue;
        const serialized = serializeAtomic($, node);
        const tokens = countTokens(serialized);
        if (tokens > WINDOW_TOKENS) {
          section.findings.push(`ATOMIC-SPLIT(${node.tagName.toLowerCase()}, ${tokens} tokens)`);
        }
      }

      sections.push(section);
    }

    const blob = h2Count < 2;
    const insideWindow = sections
      .filter((section) => section.tokens <= WINDOW_TOKENS)
      .reduce((sum, section) => sum + section.tokens, 0);
    const sectionTokens = sections.reduce((sum, section) => sum + section.tokens, 0);
    const score = blob ? 0 : sectionTokens === 0 ? 0 : insideWindow / sectionTokens;
    const headingDistance = sections.reduce((max, section) => Math.max(max, section.chars), 0);
    const worstSeverity = sections.reduce(
      (max, section) => Math.max(max, Math.max(0, Math.ceil(section.tokens / WINDOW_TOKENS) - 1)),
      0,
    );

    const lines = sections
      .filter((section) => section.findings.length > 0)
      .map((section) => `"${section.heading}" (${section.tokens} tokens): ${section.findings.join(', ')}`);
    if (blob) {
      lines.unshift(
        `BLOB: ${bodyTokens} tokens of body with ${h2Count} h2 element(s) — the whole page is cut at arbitrary offsets.`,
      );
    }

    const found = `${bodyTokens} body tokens across ${sections.length} section(s); ${Math.round(score * 100)}% of section tokens sit inside the ${WINDOW_TOKENS}-token window; longest section ${headingDistance} characters from its heading.${
      lines.length > 0 ? ` ${lines.join(' | ')}` : ''
    }`;
    const expected = `At least ${PASS_SCORE * 100}% of body tokens inside a ${WINDOW_TOKENS}-token window, with a heading on every chunk`;
    const details = {
      bodyTokens,
      sections: sections.length,
      // Reported as strings: the result schema keeps unknown detail keys only
      // as scalars or as an array of strings, so a number array is dropped
      // whole rather than coerced.
      // Capped: `details` arrays hold at most 100 entries, and a long guide
      // page splits into more sections than that.
      sectionTokens: detailLines(sections, (section) => String(section.tokens)),
      score: Number(score.toFixed(3)),
      headingDistance,
      worstSeverity,
      blob,
      findings: lines.slice(0, 100).map((line) => line.slice(0, 1000)),
    };

    if (score < WARN_SCORE) {
      return {
        ...this.fail(
          blob
            ? 'The page has no headings to cut on, so every chunk after the first arrives without one.'
            : `${Math.round((1 - score) * 100)}% of this page's text will arrive as chunks with no heading.`,
          expected,
          found,
          'Add an h2 or h3 roughly every 400 tokens of prose.',
          page.url,
        ),
        displayValue: `${Math.round(score * 100)}% inside the window`,
        details,
      };
    }

    if (score < PASS_SCORE || lines.length > 0) {
      return {
        ...this.warn(
          `Some of this page chunks badly: ${lines.length} section-level finding(s).`,
          expected,
          found,
          'Split the flagged sections, and break any table that runs past the window.',
          page.url,
        ),
        displayValue: `${Math.round(score * 100)}% inside the window`,
        details,
      };
    }

    return {
      ...this.pass(
        `Every section fits the ${WINDOW_TOKENS}-token retrieval window.`,
        expected,
        found,
        page.url,
      ),
      displayValue: `${Math.round(score * 100)}% inside the window`,
      details,
    };
  }
}
