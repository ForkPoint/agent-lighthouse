import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import { getMainContentText } from '../../parser';
import { weightForGrade } from '../../scorer';

/** Rough token estimate: 1 token ≈ 4 characters for HTML and English prose. */
const CHARS_PER_TOKEN = 4;

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
      'AI agents pay for every token of raw HTML they download, but only the visible text carries meaning. This audit compares the character weight of the raw HTML against the extracted main-content text to produce a "context bloat score": the share of the page that is actual content rather than markup, scripts, and styles. The ratio is evaluated on the homepage (the first crawled page), which is the entry point agents most often fetch. A ratio under 5% means an agent parses 20 tokens of noise for every token of content; under 15% still wastes most of the context window on boilerplate. Unlike content depth (which measures text volume), this measures how efficiently that text is packaged.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('B', 'scored'),
    evidenceGrade: 'B',
    tier: 'scored',
    dossier: 'docs/evidence/audits/content-extraction/token-ratio.md',
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
    const page = ctx.pages[0];
    const rawHtml = page?.fetchResult.body ?? '';

    if (!page || rawHtml.trim().length === 0) {
      return this.notApplicable(
        'No HTML body available to measure token-to-content ratio.',
        'A non-empty HTML body',
        'Empty body',
      );
    }

    const cleanText = getMainContentText(page.$);
    const rawChars = rawHtml.length;
    const contentChars = cleanText.length;
    const ratio = contentChars / rawChars;
    const pct = `${(ratio * 100).toFixed(1)}%`;
    const displayValue = `${pct} content (${Math.round(contentChars / CHARS_PER_TOKEN)} of ${Math.round(rawChars / CHARS_PER_TOKEN)} est. tokens)`;
    const expected = `At least ${(WARN_RATIO * 100).toFixed(0)}% of the raw HTML weight is visible content text`;

    if (ratio >= WARN_RATIO) {
      return {
        ...this.pass(
          `Homepage is ${pct} content by character weight — markup overhead is within a healthy range.`,
          expected,
          displayValue,
          page.url,
        ),
        displayValue,
      };
    }

    if (ratio >= FAIL_RATIO) {
      return {
        ...this.warn(
          `Homepage is only ${pct} content by character weight — agents spend most of their context on markup noise.`,
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
      };
    }

    return {
      ...this.fail(
        `Homepage is only ${pct} content by character weight — the page is almost entirely markup noise.`,
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
    };
  }
}
