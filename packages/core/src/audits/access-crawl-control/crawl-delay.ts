import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import { parseRobotsTxt } from './_robots-txt-helpers';
import { weightForGrade } from '../../scorer';

export class CrawlDelayAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'access-crawl-control/crawl-delay',
    category: 'access-crawl-control',
    title: 'Crawl-delay is reasonable',
    failureTitle: 'Crawl-delay is reasonable',
    description:
      'Excessive Crawl-delay values (over 10 seconds) dramatically slow AI indexing, meaning your latest content may take days or weeks to appear in AI search results.',
    scoreDisplayMode: 'informative',
    weight: weightForGrade('C', 'informative'),
    evidenceGrade: 'C',
    tier: 'informative',
    dossier: 'docs/evidence/audits/access-crawl-control/crawl-delay.md',
    // Gate exemption: being refused is what this category reports.
    requires: ['origin-reachable'],
    defaultPriority: 'high',
    guidance: {
      impact:
        'Excessive Crawl-delay values (over 10 seconds) dramatically slow AI indexing, meaning your latest content may take days or weeks to appear in AI search results while competitors with lower delays get indexed faster.',
      fix: 'Reduce Crawl-delay to 5 seconds or less, or remove it entirely if your server can handle the crawl load. Most modern servers can handle AI crawler traffic without throttling.',
      code: 'User-agent: *\nCrawl-delay: 5',
      effort: 'trivial',
      tags: ['robots-txt', 'performance', 'crawler-permissions'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const robotsFile = ctx.rootFiles['/robots.txt'];

    if (!robotsFile || robotsFile.status !== 200 || !robotsFile.body) {
      return this.warn(
        'No robots.txt found — cannot verify crawler permissions.',
        'If Crawl-delay is present, it is <= 10 seconds',
        'No robots.txt found',
        {
          priority: 'medium',
          description:
            'Without a robots.txt file, there is no way to verify crawl-delay settings. Create a robots.txt file to explicitly manage crawler behavior.',
          code: 'User-agent: *\nAllow: /',
        },
      );
    }

    const groups = parseRobotsTxt(robotsFile.body);
    const delays = groups
      .filter((g) => g.crawlDelay !== undefined)
      .map((g) => ({ userAgent: g.userAgent, crawlDelay: g.crawlDelay! }));

    if (delays.length === 0) {
      return this.pass(
        'No Crawl-delay directives found in robots.txt.',
        'If Crawl-delay is present, it is <= 10 seconds',
        'No Crawl-delay directives present',
      );
    }

    const excessive = delays.filter((d) => d.crawlDelay > 10);

    if (excessive.length > 0) {
      const details = excessive.map((d) => `${d.userAgent}: ${d.crawlDelay}s`).join(', ');
      return this.fail(
        `Excessive Crawl-delay values found: ${details}. Values above 10 seconds significantly slow down AI crawlers.`,
        'If Crawl-delay is present, it is <= 10 seconds',
        `Excessive delays: ${details}`,
        {
          priority: 'high',
          description:
            'Excessive Crawl-delay values (over 10 seconds) dramatically slow AI indexing, meaning your latest content may take days or weeks to appear in AI search results. Reduce to 5 seconds or less, or remove the directive entirely if your server can handle the load.',
          code: 'User-agent: *\nCrawl-delay: 5',
        },
      );
    }

    const allDetails = delays.map((d) => `${d.userAgent}: ${d.crawlDelay}s`).join(', ');
    return this.pass(
      `Crawl-delay values are reasonable: ${allDetails}`,
      'If Crawl-delay is present, it is <= 10 seconds',
      `Crawl-delays: ${allDetails}`,
    );
  }
}
