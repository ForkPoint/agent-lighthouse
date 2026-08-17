import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext, PageContext } from '../../check-context';
import { getMainContentText } from '../../parser';
import { isArticleContentPage } from './dates-on-content';

// Kept identical to dates-on-content / publication-date. See the comment there.
const DATE_PATTERN =
  /\b(?:\d{4}[/-]\d{1,2}[/-]\d{1,2}(?:[T ]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?Z?)?|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)\s+\d{4}|(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)\s+\d{4}|\d+\s+(?:day|week|month|year)s?\s+ago)\b/i;

const UPDATED_PATTERN = /\b(?:last\s+)?(?:updated|modified|revised)\b/gi;

export class LastUpdatedIndicatorAudit extends Audit {
  static override meta: AuditMeta = {
    id: '9.10',
    category: 'answer-engine',
    title: 'Visible "Last updated" indicator',
    failureTitle: 'Visible "Last updated" indicator',
    description:
      'AI engines use freshness signals like "Last updated" dates to rank answers. Content without freshness indicators is deprioritized for time-sensitive queries.',
    scoreDisplayMode: 'ternary',
    weight: 1.0,
    applicablePageTypes: ['content'],
    defaultPriority: 'medium',
    guidance: {
      impact:
        'AI answer engines use "Last updated" indicators as freshness signals when ranking competing answers. Content without freshness indicators is deprioritized for time-sensitive queries, meaning your content may rank below older but dated content from competitors.',
      fix: 'Add a visible "Last updated" or "Modified" indicator with a machine-readable <time> element near the top of your content. Update the date whenever you revise the page.',
      code: '<p>Last updated: <time datetime="2025-01-15">January 15, 2025</time></p>',
      effort: 'trivial',
      tags: ['freshness', 'html', 'answer-engine'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const contentPages = ctx.pages.filter(isArticleContentPage);
    if (contentPages.length === 0) {
      return this.notApplicable(
        'No article content pages were scanned, so freshness indicators do not apply.',
        'Text containing "updated", "modified", or "revised" adjacent to a date',
        'No content pages',
      );
    }

    let keywordOnlyPage: { url: string; snippet: string } | null = null;

    for (const p of contentPages) {
      // (a) DOM signal: an update keyword sitting next to a <time> element.
      const domHit = this.timeWithUpdateKeyword(p);
      if (domHit) {
        return this.pass(
          'Found a "last updated" indicator next to a <time> element.',
          'Text containing "updated", "modified", or "revised" adjacent to a date',
          domHit.slice(0, 100),
          p.url,
        );
      }

      // (b) Text signal: an update keyword with a *parsed* date adjacent to it.
      const text = getMainContentText(p.$);
      UPDATED_PATTERN.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = UPDATED_PATTERN.exec(text)) !== null) {
        const idx = m.index;
        const window = text.slice(
          Math.max(0, idx - 24),
          Math.min(text.length, idx + m[0].length + 48),
        );
        // Require a real, parseable date (or relative phrase) — NOT just any
        // nearby 4 digits, which used to match phone numbers, SKUs and prices.
        if (DATE_PATTERN.test(window)) {
          return this.pass(
            'Found a "last updated" indicator with an adjacent date.',
            'Text containing "updated", "modified", or "revised" adjacent to a date',
            /* v8 ignore next -- window is bounded to ~85 chars (24 + match + 48); > 100 is unreachable */
            window.trim().length > 100 ? window.trim().slice(0, 100) + '...' : window.trim(),
            p.url,
          );
        }
        if (!keywordOnlyPage) {
          keywordOnlyPage = { url: p.url, snippet: window.trim().slice(0, 100) };
        }
      }
    }

    if (keywordOnlyPage) {
      return this.warn(
        'Found "updated"/"modified" text but no clear date adjacent to it.',
        'Text containing "updated", "modified", or "revised" adjacent to a date',
        keywordOnlyPage.snippet,
        {
          priority: 'medium',
          description:
            'AI engines use the date near "last updated" text as a freshness signal for ranking answers. Without a machine-parseable date alongside the update indicator, agents cannot determine how current your content is, negating the freshness benefit.',
          code: '<p>Last updated: <time datetime="2025-01-15">January 15, 2025</time></p>',
        },
        keywordOnlyPage.url,
      );
    }

    return this.fail(
      'No "last updated" indicator found on any scanned content page.',
      'Text containing "updated", "modified", or "revised" adjacent to a date',
      'Not found',
      {
        priority: 'medium',
        description:
          'AI answer engines use "Last updated" indicators as freshness signals when ranking competing answers. Content without freshness indicators is deprioritized for time-sensitive queries, meaning newer but unmarked content may rank below older dated content from competitors.',
        code: '<p>Last updated: <time datetime="2025-01-15">January 15, 2025</time></p>',
      },
      contentPages[0].url,
    );
  }

  /** Returns the surrounding text if a <time> element sits next to an update keyword. */
  private timeWithUpdateKeyword(p: PageContext): string | null {
    let hit: string | null = null;
    p.$('time').each((_, el) => {
      if (hit) return;
      const time = p.$(el);
      const context = `${time.parent().text()} ${time.text()} ${time.attr('datetime') ?? ''}`;
      UPDATED_PATTERN.lastIndex = 0;
      if (UPDATED_PATTERN.test(context)) {
        hit = context.replace(/\s+/g, ' ').trim();
      }
    });
    return hit;
  }
}
