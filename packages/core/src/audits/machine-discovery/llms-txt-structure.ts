import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import type { CheckContext } from '../../check-context';
import { weightForGrade } from '../../scorer';
import type { FetchResult } from '../../fetcher';

function isOk(result: FetchResult): boolean {
  return result.status === 200;
}

/**
 * Drop fenced code blocks from the line list.
 *
 * A file that documents llms.txt syntax quotes '##' headings and '>' summaries
 * inside fences; counting those scored a file's own examples as real structure
 * (review findings 1.2 / 1.3).
 */
function withoutFencedBlocks(lines: string[]): string[] {
  const out: string[] = [];
  let inFence = false;
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (!inFence) out.push(line);
  }
  return out;
}

/** How many non-blank lines after the H1 may still count as the summary. */
const SUMMARY_WINDOW = 3;

export class LlmsTxtStructureAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'machine-discovery/llms-txt-structure',
    category: 'machine-discovery',
    title: 'llms.txt is well-formed',
    failureTitle: 'llms.txt is well-formed',
    description:
      'The llms.txt format defines a blockquote summary under the H1 and H2 sections grouping the link lists. Both are optional in the spec, so this check is advisory: it reports the shape of the file, it does not score it.',
    scoreDisplayMode: 'informative',
    weight: weightForGrade('C', 'informative'),
    evidenceGrade: 'C',
    tier: 'informative',
    dossier: 'docs/evidence/audits/machine-discovery/llms-txt-structure.md',
    defaultPriority: 'low',
    guidance: {
      impact:
        'The reference llms.txt parser extracts the blockquote as a `summary` field and the H2 headings as a `sections` map, so a file that carries both is machine-navigable: an agent can read the summary and pick a section instead of consuming the whole file. No vendor documents an agent behaving differently when either element is absent, so this is reported, not scored.',
      fix: 'Put a blockquote line (starting with >) immediately after the H1 in your llms.txt, and group the link lists under H2 headings (## Section Name).',
      code: '# Your Site Name\n\n> Your site provides X for Y. It covers topics including A, B, and C.\n\n## Documentation\n- [Getting Started](/docs/start): Quick start guide\n- [API Reference](/docs/api): Full API documentation\n\n## Company\n- [About](/about): Company information',
      effort: 'trivial',
      docsUrl: 'https://llmstxt.org/',
      tags: ['llms-txt', 'discoverability'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const result = ctx.rootFiles['/llms.txt'];
    const expected = 'Blockquote summary after the H1 plus at least one ## section';

    // Absence of the file is llms-txt-exists' signal. Reporting it here as a
    // malformed-file failure asserted the file exists and is broken.
    if (!result || !isOk(result)) {
      return this.notApplicable(
        'llms.txt not found; there is no structure to check.',
        expected,
        result ? `HTTP ${result.status}` : 'No response',
      );
    }

    const lines = withoutFencedBlocks(result.body.split('\n'));
    // Same H1 definition as llms-txt-exists (a bare '#Site' is an H1 there), so
    // one file can no longer pass that audit and fail this one.
    const h1Index = lines.findIndex((l) => /^#(?!#)/.test(l.trimStart()));

    // A 200 that carries no markdown heading at all is a soft-404 or an HTML
    // page, not a malformed llms.txt.
    if (h1Index === -1) {
      return this.notApplicable(
        'llms.txt has no markdown heading; it is not a markdown file (see llms-txt-exists).',
        expected,
        'No # heading found',
      );
    }

    // Only the lines adjacent to the H1 are the summary: a blockquote used as a
    // footnote at the bottom of the file is not one (review finding 1.2).
    const hasBlockquote = lines
      .slice(h1Index + 1)
      .filter((l) => l.trim() !== '')
      .slice(0, SUMMARY_WINDOW)
      .some((l) => l.trimStart().startsWith('>'));

    const h2Count = lines.filter((l) => /^##(?!#)\s*\S/.test(l.trimStart())).length;

    const found = `${hasBlockquote ? 'blockquote summary found' : 'no blockquote summary'}, ${h2Count} H2 section(s)`;

    if (hasBlockquote && h2Count > 0) {
      return this.pass(
        `llms.txt has a blockquote summary after the H1 and ${h2Count} H2 section(s).`,
        expected,
        found,
      );
    }

    const missing: string[] = [];
    if (!hasBlockquote) missing.push('no blockquote summary after the H1');
    if (h2Count === 0) missing.push('no H2 sections');
    const message = `llms.txt structure is incomplete: ${missing.join(' and ')}.`;

    // Both elements are explicitly optional in the spec ("zero or more" sections,
    // H1 "the only required section"), so a partial file warns and an entirely
    // flat file fails — at low priority either way, and at weight 0 always.
    return missing.length === 1
      ? this.warn(message, expected, found, 'low')
      : this.fail(message, expected, found, 'low');
  }
}
