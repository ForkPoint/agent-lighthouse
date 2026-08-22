import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import { weightForGrade } from '../../scorer';

export class TimeElementAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'content-extraction/time-element',
    category: 'content-extraction',
    title: '<time datetime=""> used for dates',
    failureTitle: '<time datetime=""> used for dates',
    description:
      'AI agents use <time datetime> elements to reliably parse dates for freshness scoring and temporal reasoning. Without machine-readable dates, agents must regex-parse human-readable date formats, which frequently fails across locales and ambiguous formats like "01/02/2025".',
    scoreDisplayMode: 'informative',
    weight: weightForGrade('C', 'informative'),
    evidenceGrade: 'C',
    tier: 'informative',
    dossier: 'docs/evidence/audits/content-extraction/time-element.md',
    applicablePageTypes: ['content'],
    defaultPriority: 'medium',
    guidance: {
      impact:
        'AI agents use <time datetime> elements to reliably parse dates for freshness scoring and temporal reasoning. Without machine-readable dates, agents must regex-parse human-readable formats, which frequently fails across locales and ambiguous formats like "01/02/2025" (Jan 2 vs. Feb 1).',
      fix: 'Wrap all dates and times in <time> elements with a datetime attribute in ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDThh:mm:ss). Include publication dates, event dates, and last-modified dates.',
      code: '<p>Published on <time datetime="2025-01-15">January 15, 2025</time></p>\n<p>Event starts <time datetime="2025-03-20T09:00:00-05:00">March 20 at 9 AM EST</time></p>',
      effort: 'trivial',
      docsUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Element/time',
      tags: ['dates', 'time', 'semantic', 'html'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    let pagesWithTime = 0;

    for (const page of ctx.pages) {
      if (page.$('time[datetime]').length > 0) pagesWithTime++;
    }

    const hasTime = pagesWithTime > 0;

    if (hasTime) {
      return this.pass(
        `${pagesWithTime}/${ctx.pages.length} page(s) use <time datetime=""> for dates.`,
        '<time datetime=""> elements used for dates',
        `${pagesWithTime} page(s) with <time datetime="">`,
      );
    }

    return this.fail(
      'No <time datetime=""> elements found on any page.',
      '<time datetime=""> elements used for dates',
      'No <time datetime=""> elements',
      {
        priority: 'medium',
        description:
          'AI agents use <time datetime> elements to reliably parse dates for freshness scoring and temporal reasoning. Without machine-readable dates, agents must regex-parse human-readable date formats, which frequently fails across locales and ambiguous formats like "01/02/2025".',
        code: '<time datetime="2025-01-15">January 15, 2025</time>',
      },
    );
  }
}
