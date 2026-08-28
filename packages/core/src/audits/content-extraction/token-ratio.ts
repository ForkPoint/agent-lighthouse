import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import { weightForGrade } from '../../scorer';
import { countTokens } from '../../gatherers/tokens';
import { readabilityArticle, semanticText } from '../../gatherers/extraction';
import { scanReadTheSite, unreadSiteReason } from '../../scan-evidence';

/**
 * Where the delivered tokens went.
 *
 * `structure` is the residual — tags, attribute names, whitespace and whatever
 * the four measured buckets do not account for — so the buckets always sum to
 * the delivered count and the report never has to explain a missing remainder.
 * BPE counts of substrings do not add up to the count of the whole string, so
 * the residual absorbs that boundary effect too, and is clamped at zero.
 */
interface TokenBuckets {
  script: number;
  style: number;
  comment: number;
  text: number;
  structure: number;
}

/** Token cost of every node matching `selector`, markup included. */
function bucketOf(html: string, pattern: RegExp): number {
  let total = 0;
  for (const match of html.matchAll(pattern)) total += countTokens(match[0]);
  return total;
}

/** Below 5% content, the page is almost entirely markup noise. */
const FAIL_RATIO = 0.05;

/** Below 15% content, agents waste most of their context on boilerplate. */
const WARN_RATIO = 0.15;

export class TokenRatioAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'content-extraction/token-ratio',
    category: 'content-extraction',
    title: 'Lean token-to-content ratio',
    failureTitle: 'Lean token-to-content ratio',
    description:
      'AI agents pay for every token of raw HTML they download, but only the main content carries meaning. This audit counts both sides with a real BPE tokenizer (`o200k_base`): the numerator is the text `@mozilla/readability` extracts — the extractor most of the industry deploys — and the denominator is the whole delivered document. The result is a signal-density index, and the report breaks the denominator into script, style, comment, content and structure tokens so the finding names the bucket to attack. A ratio under 5% means an agent parses 20 tokens of noise for every token of content; under 15% still wastes most of the context window on boilerplate.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('B', 'scored'),
    evidenceGrade: 'B',
    tier: 'scored',
    dossier: 'docs/evidence/audits/content-extraction/token-ratio.md',
    requires: ['origin-reachable', 'unblocked-fetches', 'rendered-body', 'sample-adequate'],
    defaultPriority: 'high',
    guidance: {
      impact:
        'When less than 15% of your HTML is actual content, AI agents burn most of their context window and token budget on markup noise: inline scripts, CSS, SVG sprites, tracking tags, and deeply nested divs. The useful text that remains gets weaker attention from the model, and pages with extreme bloat may be truncated before the real content is even read.',
      fix: 'Move inline scripts and styles to external cached files, remove unused framework boilerplate and hidden DOM subtrees, flatten excessive wrapper divs, and serve content in semantic HTML rather than JSON blobs that need client-side hydration. Aim for at least 15% of the raw HTML weight to be visible content text.',
      code: '<!-- Before: content buried in markup noise -->\n<div class="w1"><div class="w2"><div class="w3">\n  <script>/* 50KB of hydration data */</script>\n  <p>Buy our product</p>\n</div></div></div>\n\n<!-- After: lean, content-first markup -->\n<main>\n  <h1>Our product</h1>\n  <p>Buy our product. It solves your problem by...</p>\n</main>\n<script src="/app.js" defer></script>',
      effort: 'moderate',
      tags: ['tokens', 'performance', 'content', 'context-window'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    // Nothing here can be attributed to this site; see `scanReadTheSite`.
    if (!scanReadTheSite(ctx.evidence)) {
      return this.notApplicable(
        'No page here can be attributed to this site, so its token mix was not measured.',
        'A homepage from this site whose token mix can be measured',
        unreadSiteReason(ctx.evidence),
      );
    }

    const page = ctx.pages[0];
    const rawHtml = page?.fetchResult.body ?? '';

    if (!page || rawHtml.trim().length === 0) {
      return this.notApplicable(
        'No HTML body available to measure token-to-content ratio.',
        'A non-empty HTML body',
        'Empty body',
      );
    }

    // The extractor an agent actually runs, with the semantic container as the
    // fallback for the pages readability declines.
    const article = readabilityArticle(rawHtml, page.url);
    const extracted = article ?? semanticText(rawHtml);
    const contentTokens = countTokens(extracted.text);
    const deliveredTokens = countTokens(rawHtml);

    const script = bucketOf(rawHtml, /<script\b[\s\S]*?<\/script>/gi);
    const style = bucketOf(rawHtml, /<style\b[\s\S]*?<\/style>/gi);
    const comment = bucketOf(rawHtml, /<!--[\s\S]*?-->/g);
    const buckets: TokenBuckets = {
      script,
      style,
      comment,
      text: contentTokens,
      structure: Math.max(0, deliveredTokens - script - style - comment - contentTokens),
    };

    const ratio = deliveredTokens === 0 ? 0 : contentTokens / deliveredTokens;
    const pct = `${(ratio * 100).toFixed(1)}%`;
    const displayValue = `${pct} content (${contentTokens} of ${deliveredTokens} o200k tokens, extracted by ${extracted.source})`;
    const expected = `At least ${(WARN_RATIO * 100).toFixed(0)}% of the delivered tokens are main-content tokens`;
    const details = { ...buckets, deliveredTokens, contentTokens, extractor: extracted.source };

    if (ratio >= WARN_RATIO) {
      return {
        ...this.pass(
          `Homepage is ${pct} content by token weight — markup overhead is within a healthy range.`,
          expected,
          displayValue,
          page.url,
        ),
        displayValue,
        details,
      };
    }

    if (ratio >= FAIL_RATIO) {
      return {
        ...this.warn(
          `Homepage is only ${pct} content by token weight — agents spend most of their context on markup noise.`,
          expected,
          displayValue,
          {
            priority: 'high',
            description:
              'AI agents pay for every token of raw HTML they download, but only the visible text carries meaning. A content share under 15% means most of the context window is consumed by scripts, styles, and wrapper markup instead of your actual content. Move inline assets to external files, remove unused boilerplate, and flatten markup.',
          },
          page.url,
        ),
        displayValue,
        details,
      };
    }

    return {
      ...this.fail(
        `Homepage is only ${pct} content by token weight — the page is almost entirely markup noise.`,
        expected,
        displayValue,
        {
          priority: 'high',
          description:
            'AI agents pay for every token of raw HTML they download, but only the visible text carries meaning. A content share under 5% means an agent parses more than 20 tokens of noise for every token of content, and the page may be truncated before the real content is read. Move inline assets to external files, remove unused boilerplate, and flatten markup.',
        },
        page.url,
      ),
      displayValue,
      details,
    };
  }
}
