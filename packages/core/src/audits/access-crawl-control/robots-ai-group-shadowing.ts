// Graduated from proposal 2026-08-22 (Plan 5, Task 19).
// Evidence dossier: docs/evidence/audits/access-crawl-control/robots-ai-group-shadowing.md
//
// Deliberately does NOT use `_robots-txt-helpers.ts`'s categoryBlocked(): that
// helper flattens rules across different bots' groups, which is right for
// governance reporting and wrong here. This audit needs strict per-token group
// isolation, so it uses the gatherer's groupsForBot / isPathAllowed directly.
import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import { weightForGrade } from '../../scorer';
import type { CheckContext } from '../../check-context';
import {
  parseRobots,
  groupsForBot,
  hasNamedGroup,
  isPathAllowed,
  type RobotsGroup,
} from '../../gatherers/robots';

/** AI product tokens whose named group, if present, voids the wildcard. */
const AI_TOKENS: readonly string[] = [
  'gptbot', 'oai-searchbot', 'chatgpt-user', 'oai-adsbot',
  'claudebot', 'claude-user', 'claude-searchbot',
  'perplexitybot', 'perplexity-user',
  'google-extended', 'applebot-extended', 'ccbot', 'bytespider', 'amazonbot',
  'meta-externalagent', 'meta-externalfetcher', 'bravebot', 'duckassistbot',
  'cohere-ai', 'mistralai-user', 'diffbot', 'ai2bot', 'youbot',
];

/** How many probe paths to evaluate per token. */
const MAX_PROBES = 200;

type Divergence =
  | { kind: 'shadowed-protection'; token: string; declared: string; path: string }
  | { kind: 'empty-group'; token: string; declared: string }
  | { kind: 'unintended-block'; token: string; declared: string };

/** A token that never appears as a named group, so `*` applies to it. */
const BASELINE_TOKEN = 'agent-lighthouse-wildcard-baseline';

/** Paths worth evaluating: every rule literal, `/`, and the scanned pages. */
function probePaths(groups: RobotsGroup[], ctx: CheckContext): string[] {
  const paths = new Set<string>(['/']);
  for (const group of groups) {
    for (const rule of group.rules) {
      if (!rule.path) continue;
      const literal = rule.path.replace(/\$$/, '');
      if (literal) paths.add(literal);
      const star = literal.indexOf('*');
      if (star > 0) paths.add(literal.slice(0, star));
    }
  }
  for (const page of ctx.pages) {
    try {
      paths.add(new URL(page.url).pathname);
    } catch {
      // A page URL the scanner could not parse contributes no probe.
    }
  }
  return [...paths].slice(0, MAX_PROBES);
}

function analyse(groups: RobotsGroup[], ctx: CheckContext): Divergence[] {
  const wildcard = groups.filter((g) => g.userAgent.trim() === '*');
  const probes = probePaths(groups, ctx);
  const out: Divergence[] = [];

  for (const token of AI_TOKENS) {
    if (!hasNamedGroup(groups, token)) continue;
    const named = groupsForBot(groups, token);
    const declared = named[0]?.userAgent ?? token;

    // §2.2.1: this group matches, its zero rules are obeyed, and `*` is never
    // consulted — so every wildcard Disallow evaporates for this bot.
    if (named.every((group) => group.rules.length === 0)) {
      if (wildcard.some((group) => group.rules.some((rule) => rule.type === 'disallow' && rule.path))) {
        out.push({ kind: 'empty-group', token, declared });
      }
      continue;
    }

    const namedAllowsRoot = isPathAllowed(groups, token, '/');
    const wildcardAllowsRoot = isPathAllowed(wildcard, BASELINE_TOKEN, '/');
    if (wildcardAllowsRoot && !namedAllowsRoot) {
      out.push({ kind: 'unintended-block', token, declared });
      continue;
    }

    for (const path of probes) {
      const underNamed = isPathAllowed(groups, token, path);
      const underWildcard = isPathAllowed(wildcard, BASELINE_TOKEN, path);
      if (!underWildcard && underNamed) {
        out.push({ kind: 'shadowed-protection', token, declared, path });
      }
    }
  }

  return out;
}

const EXPECTED =
  'No named AI-bot group silently voids the wildcard policy: every path the wildcard group protects stays protected for bots that have a group of their own';

const SAMPLE = `# The wildcard group is NOT consulted for a bot that has its own group,
# so every rule it needs must be repeated inside that group.
User-agent: *
Disallow: /admin
Disallow: /checkout

User-agent: GPTBot
Disallow: /admin
Disallow: /checkout`;

export class RobotsAiGroupShadowingAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'access-crawl-control/robots-ai-group-shadowing',
    category: 'access-crawl-control',
    title: 'robots.txt AI group shadowing',
    failureTitle: 'robots.txt AI group shadowing',
    description:
      'Detects the RFC 9309 group-precedence trap: adding ANY named group for an AI product token silently voids every rule in the `User-agent: *` group for that bot. Evaluates each AI token twice — under its own merged group and under the wildcard group — with longest-match-wins and Allow-wins-on-tie, and reports three failure classes: a wildcard-protected path reopened for the bot, a named group with no rules at all, and a named group that blocks a bot the wildcard allowed.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('A', 'scored'),
    evidenceGrade: 'A',
    tier: 'scored',
    dossier: 'docs/evidence/audits/access-crawl-control/robots-ai-group-shadowing.md',
    defaultPriority: 'high',
    guidance: {
      impact:
        "RFC 9309 §2.2.1 states the wildcard group is consulted only 'if no matching group exists'. Therefore, for any site with a named AI-bot group, the wildcard group's Disallow rules provably do not apply to that bot, and the operator's stated intent (expressed once in `*`) diverges from the enforced policy by exactly the symmetric difference of the two rule sets. Falsifiable by construction: given robots.txt R and token T, the set of paths where R_T and R_star disagree is computable and either empty or not.",
      fix: 'Repeat every wildcard rule inside each named AI-bot group. A named group replaces the wildcard group for that crawler — it does not extend it — so a group holding only Crawl-delay opens the entire site to that bot, and a group missing one Disallow reopens exactly that path. If you meant to block the bot outright, keep the group but know the wildcard rules no longer apply to it.',
      code: SAMPLE,
      effort: 'easy',
      docsUrl:
        'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/audits/access-crawl-control/robots-ai-group-shadowing.md',
      tags: ['robots', 'rfc9309', 'ai-crawlers', 'access-control'],
    },
  };

  private recommendation() {
    return {
      priority: 'high' as const,
      description: RobotsAiGroupShadowingAudit.meta.description,
      code: SAMPLE,
    };
  }

  audit(ctx: CheckContext): AuditResult {
    const robots = ctx.rootFiles['/robots.txt'];
    if (!robots || robots.status !== 200 || !robots.body.trim()) {
      return this.notApplicable(
        'No robots.txt was served, so there are no groups whose precedence could diverge.',
        EXPECTED,
        'No robots.txt',
      );
    }

    const groups = parseRobots(robots.body);
    // The declared spelling, not the lowercased token, so the finding quotes
    // what the operator actually wrote.
    const named = AI_TOKENS.filter((token) => hasNamedGroup(groups, token)).map(
      (token) => groupsForBot(groups, token)[0]?.userAgent ?? token,
    );
    if (named.length === 0) {
      return this.pass(
        'No AI product token has a group of its own, so the wildcard group applies to every AI crawler exactly as written.',
        EXPECTED,
        `${groups.length} group(s), none naming an AI token`,
      );
    }

    const divergences = analyse(groups, ctx);
    const voided = divergences.filter((d) => d.kind !== 'unintended-block');
    const blocked = divergences.filter((d) => d.kind === 'unintended-block');
    const summary = `${named.length} named AI group(s): ${named.join(', ')}; ${divergences.length} divergence(s)`;

    if (voided.length > 0) {
      const detail = voided
        .slice(0, 5)
        .map((d) =>
          d.kind === 'empty-group'
            ? `${d.declared} has a group with no Allow or Disallow rule, so it matches that group, obeys nothing, and never reads the wildcard rules`
            : `${d.declared} is allowed ${d.path}, which the wildcard group disallows`,
        )
        .join('; ');
      return this.fail(
        `A named AI group silently voids the wildcard policy: ${detail}.`,
        EXPECTED,
        summary,
        this.recommendation(),
      );
    }

    if (blocked.length > 0) {
      const detail = blocked.map((d) => d.declared).join(', ');
      return this.warn(
        `The wildcard group allows the whole site, but the named group(s) ${detail} disallow it. The wildcard group is not consulted for these bots, so this is the policy they see — deliberate if you meant to block them, a copy-pasted template if you did not.`,
        EXPECTED,
        summary,
        this.recommendation(),
      );
    }

    return this.pass(
      `${named.length} named AI group(s) enforce the same policy as the wildcard group on every probed path.`,
      EXPECTED,
      summary,
    );
  }
}
