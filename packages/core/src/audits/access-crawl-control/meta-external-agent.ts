import type { AuditMeta, AuditResult } from '../../types';
import type { CheckContext } from '../../check-context';
import type { CrawlerBot } from './_robots-txt-helpers';
import { CrawlerBotAudit } from './_crawler-bot-audit';
import { parseRobotsFile, hasNamedGroup, isPathAllowed } from '../../gatherers/robots';
import { weightForGrade } from '../../scorer';

/** The token this audit scores, spelled as Meta documents it. */
const TOKEN = 'Meta-ExternalAgent';

export class MetaExternalAgentAudit extends CrawlerBotAudit {
  static override meta: AuditMeta = {
    id: 'access-crawl-control/meta-external-agent',
    category: 'access-crawl-control',
    title: 'Meta-ExternalAgent allowed',
    failureTitle: 'Meta-ExternalAgent disallowed by robots.txt',
    description:
      "Meta-ExternalAgent collects pages for Meta's foundation-model training and for indexing content directly into Meta products, and Meta documents it as respecting robots.txt. This check reads the robots.txt rules that actually apply to it — its own group if it has one, otherwise the catch-all — and reports whether they let it fetch the site root. A named group is not required: under RFC 9309 an open catch-all grants the same access.",
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('A', 'scored'),
    evidenceGrade: 'A',
    tier: 'scored',
    dossier: 'docs/evidence/audits/access-crawl-control/meta-external-agent.md',
    defaultPriority: 'medium',
    guidance: {
      impact:
        "Disallowing Meta-ExternalAgent keeps the site out of Meta's foundation-model training corpus and out of the direct content indexing that improves Meta products. It is an effective, documented control, so it is only a problem where the block was not intended. It does not by itself govern Meta AI search citations — Meta documents Meta-WebIndexer as the token behind those.",
      fix: 'If the block was not intended, remove the Disallow rule that applies to Meta-ExternalAgent, or add a named `User-agent: Meta-ExternalAgent` group with `Allow: /` — under RFC 9309 §2.2.1 a named group overrides the catch-all for that crawler.',
      code: 'User-agent: Meta-ExternalAgent\nAllow: /',
      effort: 'trivial',
      tags: ['robots-txt', 'meta', 'crawler-permissions'],
    },
  };

  protected bot: CrawlerBot = {
    botName: TOKEN,
    displayName: TOKEN,
    category: 'training',
  };

  /**
   * Scores the access state, not the shape of the file.
   *
   * The inherited rule in `_crawler-bot-audit.ts` passes only on
   * `allowed && explicitly` and warns on `allowed && !explicitly`, so a site
   * allowed through the catch-all scores 0.5. This dossier's own code review
   * names that criterion "the cargo-cult 'explicit Allow: /'", and its evidence
   * documents only that Meta states the agent respects robots.txt — a fact
   * about the block state, not about whether a group names the token. Under
   * RFC 9309 §2.2.1 a crawler obeys the group matching its product token and
   * falls back to `*` only when no such group exists, so an open catch-all
   * grants exactly the access a named group would.
   *
   * The override is confined to this class. Twenty sibling bot audits inherit
   * the base rule and two of them are pinned in the robots differential
   * baseline; only this audit has a recorded pass-rule finding.
   */
  override audit(ctx: CheckContext): AuditResult {
    const robotsFile = ctx.rootFiles['/robots.txt'];
    const expected = `robots.txt rules that leave ${TOKEN} able to fetch /`;

    if (!robotsFile || robotsFile.status !== 200 || !robotsFile.body) {
      return this.notApplicable(
        `No robots.txt to read, so there are no crawl rules to evaluate for ${TOKEN}.`,
        expected,
        'No robots.txt found',
      );
    }

    const { groups, sitemaps } = parseRobotsFile(robotsFile.body);

    // A 200 that carries no groups, no sitemaps and no directives is a soft 404
    // — an HTML error page served at /robots.txt — not a permissive rules file.
    if (groups.length === 0 && sitemaps.length === 0) {
      return this.notApplicable(
        `The response at /robots.txt carries no crawl rules, so there is nothing to evaluate for ${TOKEN}.`,
        expected,
        'robots.txt contains no user-agent groups and no directives',
      );
    }

    const named = hasNamedGroup(groups, TOKEN);
    const hasCatchAll = groups.some((group) => group.userAgent.trim() === '*');
    const allowed = isPathAllowed(groups, TOKEN, '/');
    const details = { namedGroup: named, hasCatchAll, allowed };

    if (allowed) {
      const [message, found] = named
        ? [`${TOKEN} is allowed by its own robots.txt group.`, `User-agent: ${TOKEN} group permits /`]
        : hasCatchAll
          ? [
              `${TOKEN} is allowed. No group names it, so under RFC 9309 §2.2.1 it obeys the catch-all group, which permits /.`,
              'Allowed through the catch-all group',
            ]
          : [
              `${TOKEN} is allowed. No group in robots.txt applies to it, so nothing restricts its crawl.`,
              `No group applies to ${TOKEN}`,
            ];
      return { ...this.pass(message, expected, found), details };
    }

    return {
      ...this.fail(
        `${TOKEN} is disallowed at the site root. Meta documents this agent as respecting robots.txt, so the block takes effect: the site is excluded from Meta's foundation-model training corpus and from the direct content indexing that improves Meta products.`,
        expected,
        named
          ? 'Its own group disallows /'
          : `The catch-all group disallows / and no group names ${TOKEN}`,
        {
          priority: 'medium',
          code: `User-agent: ${TOKEN}\nAllow: /`,
        },
      ),
      details,
    };
  }
}
