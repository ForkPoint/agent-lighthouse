import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import { weightForGrade } from '../../scorer';

const FLAG_THRESHOLD_BYTES = 2048;
const SINGLE_FAIL_BYTES = 10240; // 10KB
const TOTAL_FAIL_BYTES = 20480; // 20KB
const TOTAL_WARN_BYTES = 8192; // 8KB
const MARKUP_SNIPPET_CHARS = 120;

interface SvgFinding {
  pageUrl: string;
  bytes: number;
  snippet: string;
}

function formatBytes(bytes: number): string {
  return bytes >= 1024 ? `${(bytes / 1024).toFixed(1)}KB` : `${bytes}B`;
}

export class SvgBloatAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'content-extraction/svg-bloat',
    category: 'content-extraction',
    title: 'SVGs not bloating agent context',
    failureTitle: 'Large inline SVGs bloating agent context',
    description:
      'When an LLM converts your HTML to Markdown or reads raw markup, every inline SVG is inlined as thousands of path-data tokens. Decorative icon sprites, charts, and complex illustrations can silently consume tens of thousands of tokens of agent context per page — "SVG context poisoning" — crowding out the actual content the agent should read. SVGs marked aria-hidden="true" or role="presentation" are stripped by most accessibility-tree extractors and do not count. Keep visible SVGs small, move decorative ones behind aria-hidden, and prefer raster images or CSS for complex graphics.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('B', 'scored'),
    evidenceGrade: 'B',
    tier: 'scored',
    dossier: 'docs/evidence/audits/content-extraction/svg-bloat.md',
    defaultPriority: 'medium',
    guidance: {
      impact:
        'Large inline SVGs are inlined verbatim as path-data tokens when an LLM converts your page to Markdown. A single 10KB icon or chart can consume thousands of tokens of agent context per page load, inflating agent cost and pushing real content out of the context window — reducing the quality of what agents extract and say about your site.',
      fix: 'Mark decorative SVGs with aria-hidden="true" so agent pipelines strip them. For visible graphics, simplify path data with SVGO, extract complex SVGs to external files referenced via <img>, or replace them with raster images when they exceed a few kilobytes.',
      code: '<svg aria-hidden="true" focusable="false" ...>...</svg>',
      effort: 'easy',
      docsUrl: 'https://github.com/svg/svgo',
      tags: ['svg', 'context-window', 'tokens', 'performance'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    let totalCount = 0;
    let unhiddenCount = 0;
    let unhiddenBytes = 0;
    const flagged: SvgFinding[] = [];

    for (const page of ctx.pages) {
      page.$('svg').each((_, el) => {
        totalCount++;
        const $el = page.$(el);
        if ($el.attr('aria-hidden') === 'true' || $el.attr('role') === 'presentation') {
          return;
        }
        unhiddenCount++;
        const markup = page.$.html(el) ?? '';
        const bytes = Buffer.byteLength(markup);
        unhiddenBytes += bytes;
        if (bytes > FLAG_THRESHOLD_BYTES) {
          const oneLine = markup.replace(/\s+/g, ' ').trim();
          const snippet =
            oneLine.length > MARKUP_SNIPPET_CHARS
              ? `${oneLine.slice(0, MARKUP_SNIPPET_CHARS)}...`
              : oneLine;
          flagged.push({ pageUrl: page.url, bytes, snippet });
        }
      });
    }

    if (totalCount === 0) {
      return this.notApplicable(
        'No inline SVG elements found on any page.',
        'No oversized unhidden inline SVGs.',
        'No SVGs present',
      );
    }

    const summary =
      `${totalCount} SVG(s) total, ${unhiddenCount} unhidden, ` +
      `${formatBytes(unhiddenBytes)} unhidden bytes across ${ctx.pages.length} page(s).`;

    if (flagged.length === 0 && unhiddenBytes <= TOTAL_WARN_BYTES) {
      return this.pass(
        `${summary} All unhidden SVGs are small enough for agent context.`,
        'Unhidden SVGs stay under 2KB each and under 8KB total.',
        `${formatBytes(unhiddenBytes)} of unhidden SVG markup`,
      );
    }

    flagged.sort((a, b) => b.bytes - a.bytes);
    const largest = flagged[0];
    const offenders = flagged.length
      ? ` Top offenders:\n${flagged
          .slice(0, 5)
          .map((f) => `${formatBytes(f.bytes)} at ${f.pageUrl}: ${f.snippet}`)
          .join('\n')}`
      : '';
    const found = `${summary}${offenders}`;
    const expected =
      'Unhidden SVGs stay under 2KB each and under 8KB total; nothing over 10KB per SVG or 20KB total.';

    if ((largest && largest.bytes > SINGLE_FAIL_BYTES) || unhiddenBytes > TOTAL_FAIL_BYTES) {
      const largestNote = largest
        ? ` — largest unhidden SVG is ${formatBytes(largest.bytes)}`
        : '';
      return this.fail(
        `${summary} Severe SVG context bloat detected${largestNote}.`,
        expected,
        found,
        {
          priority: 'medium',
          description:
            'Large unhidden inline SVGs are inlined as path-data tokens when an LLM reads your page, consuming thousands of tokens of agent context. Mark decorative SVGs aria-hidden="true", simplify paths with SVGO, or move complex graphics to external files.',
          code: '<svg aria-hidden="true" focusable="false" ...>...</svg>',
        },
      );
    }

    const warnReason = flagged.length
      ? `${flagged.length} unhidden SVG(s) exceed 2KB and may bloat agent context.`
      : `unhidden SVGs total ${formatBytes(unhiddenBytes)}, bloating agent context.`;
    return this.warn(
      `${summary} ${warnReason}`,
      expected,
      found,
      {
        priority: 'medium',
        description:
          'Unhidden inline SVGs over 2KB add meaningful token overhead when an LLM converts your page to Markdown. Mark decorative SVGs aria-hidden="true" or optimize them with SVGO to keep agent context focused on real content.',
        code: '<svg aria-hidden="true" focusable="false" ...>...</svg>',
      },
    );
  }
}
