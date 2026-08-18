import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import type { CrawlerBot, RobotsTxtGroup } from './_robots-txt-helpers';
import {
  parseRobotsTxt,
  isBlanketBlocked,
  TRAINING_CRAWLERS,
  REALTIME_CRAWLERS,
} from './_robots-txt-helpers';

/**
 * Returns the bots from the given list that have at least one explicit
 * User-agent group in robots.txt (matched case-insensitively, including
 * aliases like ClaudeBot for anthropic-ai).
 */
function explicitlyNamed(
  groups: RobotsTxtGroup[],
  bots: CrawlerBot[],
): CrawlerBot[] {
  const agents = new Set(groups.map((g) => g.userAgent.toLowerCase()));
  return bots.filter((bot) => {
    const names = [bot.botName, ...(bot.aliases ?? [])];
    return names.some((name) => agents.has(name.toLowerCase()));
  });
}

/**
 * Merges the rules of all explicit groups belonging to the given bots and
 * reports whether that category is blocked at the root (Disallow: / with no
 * counteracting Allow: /).
 */
function categoryBlocked(groups: RobotsTxtGroup[], bots: CrawlerBot[]): boolean {
  const names = new Set(
    bots.flatMap((bot) =>
      [bot.botName, ...(bot.aliases ?? [])].map((n) => n.toLowerCase()),
    ),
  );
  const rules = groups
    .filter((g) => names.has(g.userAgent.toLowerCase()))
    .flatMap((g) => g.rules);
  return isBlanketBlocked(rules);
}

export class AgentGovernanceAudit extends Audit {
  static override meta: AuditMeta = {
    id: '2.28',
    category: 'crawler-permissions',
    title: 'AI crawler vs conversational agent separation',
    failureTitle: 'No separation between training crawlers and live agents',
    description:
      'Not all AI bots are the same. Training crawlers like GPTBot, CCBot, and Google-Extended scrape your content to build datasets, while conversational and retrieval agents like ChatGPT-User, Claude-User, and OAI-SearchBot fetch pages live to answer real user questions and can send referral traffic back to you. Many sites want to block the former while welcoming the latter — but a single catch-all User-agent: * cannot express that distinction. Granular robots.txt governance names both categories explicitly so each gets the access policy you actually intend.',
    scoreDisplayMode: 'ternary',
    weight: 0.8,
    defaultPriority: 'medium',
    guidance: {
      impact:
        'Without separate rules for training crawlers and live conversational agents, you cannot block dataset scraping while still appearing in ChatGPT, Claude, and Perplexity answers. A blanket policy either locks you out of AI-powered discovery entirely or leaves your content open to bulk training crawls you never agreed to.',
      fix: 'Add explicit User-agent groups in robots.txt for both categories: name training crawlers (GPTBot, CCBot, Google-Extended, anthropic-ai) with the policy you want, and separately name live agents (ChatGPT-User, Claude-User, OAI-SearchBot) — typically with Allow: / so your site stays visible in AI answers.',
      code: '# Block dataset-training crawlers\nUser-agent: GPTBot\nDisallow: /\n\nUser-agent: CCBot\nDisallow: /\n\n# Welcome live conversational agents\nUser-agent: ChatGPT-User\nAllow: /\n\nUser-agent: Claude-User\nAllow: /\n\nUser-agent: *\nAllow: /',
      effort: 'easy',
      docsUrl: 'https://platform.openai.com/docs/bots',
      tags: ['robots-txt', 'crawler-permissions', 'ai-governance'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const robotsFile = ctx.rootFiles['/robots.txt'];

    if (!robotsFile || robotsFile.status !== 200 || !robotsFile.body) {
      return this.notApplicable(
        'No robots.txt found — agentic governance cannot be evaluated.',
        'robots.txt with explicit rules for both training crawlers and live conversational agents',
        'No robots.txt found',
      );
    }

    const groups = parseRobotsTxt(robotsFile.body);
    const trainingNamed = explicitlyNamed(groups, TRAINING_CRAWLERS);
    const realtimeNamed = explicitlyNamed(groups, REALTIME_CRAWLERS);
    const hasCatchAll = groups.some((g) => g.userAgent === '*');

    const details = {
      trainingAgents: trainingNamed.map((b) => b.displayName),
      realtimeAgents: realtimeNamed.map((b) => b.displayName),
      hasCatchAll,
    };

    const expected =
      'Explicit User-agent groups for both training crawlers (GPTBot, CCBot, ...) and live conversational agents (ChatGPT-User, Claude-User, ...)';

    // No AI-agent-specific rules at all — pure catch-all (or empty) robots.txt.
    if (trainingNamed.length === 0 && realtimeNamed.length === 0) {
      const result = this.fail(
        hasCatchAll
          ? 'robots.txt only defines a catch-all User-agent: * — no AI-agent-specific rules found.'
          : 'robots.txt contains no AI-agent-specific rules.',
        expected,
        hasCatchAll ? 'Only User-agent: * present' : 'No AI crawler user-agents named',
        { priority: 'medium' },
      );
      result.details = details;
      return result;
    }

    const differentiated =
      trainingNamed.length > 0 &&
      realtimeNamed.length > 0 &&
      categoryBlocked(groups, trainingNamed) !== categoryBlocked(groups, realtimeNamed);

    // Both categories explicitly governed: >= 2 of each, or clearly different
    // treatment of the two categories.
    if (
      (trainingNamed.length >= 2 && realtimeNamed.length >= 2) ||
      differentiated
    ) {
      const result = this.pass(
        `Granular agentic governance: ${trainingNamed.length} training crawler(s) and ${realtimeNamed.length} live agent(s) explicitly named${differentiated ? ' with different policies' : ''}.`,
        expected,
        `Training: ${trainingNamed.map((b) => b.displayName).join(', ') || 'none'}; Realtime: ${realtimeNamed.map((b) => b.displayName).join(', ') || 'none'}`,
      );
      result.details = details;
      return result;
    }

    // Only one category addressed (or too thinly covered to count as
    // differentiated governance).
    const covered =
      trainingNamed.length > 0 ? 'training crawlers' : 'live conversational agents';
    const missing =
      trainingNamed.length > 0 ? 'live conversational agents' : 'training crawlers';
    const result = this.warn(
      `Only ${covered} are explicitly governed in robots.txt — no rules for ${missing}.`,
      expected,
      `Training: ${trainingNamed.map((b) => b.displayName).join(', ') || 'none'}; Realtime: ${realtimeNamed.map((b) => b.displayName).join(', ') || 'none'}`,
      { priority: 'medium' },
    );
    result.details = details;
    return result;
  }
}
