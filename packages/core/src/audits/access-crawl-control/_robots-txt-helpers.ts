// Compatibility shim over the RFC 9309 gatherer in `gatherers/robots.ts`.
// The parsing/matching logic lives there now; this file keeps the v1 export
// names and signatures so the crawler-permission audits compile unchanged.

import type { RobotsGroup, RobotsRule } from '../../gatherers/robots';
import { isPathAllowed, matchesUserAgent } from '../../gatherers/robots';

// ── Types ─────────────────────────────────────────────────────

export type { RobotsRule as RobotsTxtRule, RobotsGroup as RobotsTxtGroup } from '../../gatherers/robots';

// ── Re-exported gatherer primitives ───────────────────────────

export {
  parseRobots as parseRobotsTxt,
  matchesUserAgent,
  groupsForBot,
  isPathAllowed,
} from '../../gatherers/robots';

// ── v1-compatible helpers ─────────────────────────────────────

/**
 * Returns true if the given rule set blocks the site root without a
 * counteracting Allow.
 *
 * Kept on the v1 signature (a flat rule list) because audits pass pre-merged
 * rules; the RFC-correct group/bot variant is
 * `isBlanketBlocked(groups, botToken)` in `gatherers/robots.ts`.
 *
 * Unlike v1 this also catches wildcard blanket blocks (`Disallow: /*` and
 * `Disallow: *`), not just the literal `Disallow: /`.
 */
export function isBlanketBlocked(rules: RobotsRule[]): boolean {
  const group: RobotsGroup = { userAgent: '*', rules };
  return !isPathAllowed([group], '*', '/');
}

/**
 * Checks whether a specific bot is allowed to crawl the root path.
 *
 * Returns:
 * - `explicitly`: true if there is a group specifically for this bot
 * - `allowed`: true if the bot is not blocked at the root
 *
 * Bot matching is RFC 9309 product-token matching, so a `User-agent:
 * GPTBot/1.1` group now counts as an explicit group for `GPTBot`.
 */
export function isAllowed(
  groups: RobotsGroup[],
  botName: string,
): { explicitly: boolean; allowed: boolean } {
  const explicitly = groups.some((g) => matchesUserAgent(g.userAgent, botName));
  // isPathAllowed already falls back to the `*` groups, and defaults to
  // allowed when robots.txt carries no applicable rule at all.
  return { explicitly, allowed: isPathAllowed(groups, botName, '/') };
}

/**
 * Check 2.3 needs to look at both "anthropic-ai" and "ClaudeBot" user-agents.
 */
export function isAnthropicAllowed(
  groups: RobotsGroup[],
): { explicitly: boolean; allowed: boolean } {
  const result1 = isAllowed(groups, 'anthropic-ai');
  const result2 = isAllowed(groups, 'ClaudeBot');

  // If both have explicit rules, pass if either alias is allowed
  if (result1.explicitly && result2.explicitly) {
    return { explicitly: true, allowed: result1.allowed || result2.allowed };
  }
  if (result1.explicitly) return result1;
  if (result2.explicitly) return result2;

  // Neither is explicit — fall back (both return the same wildcard result)
  return result1;
}

/**
 * Checks whether specific sensitive paths are disallowed for the wildcard
 * user-agent. Returns an object with the paths that are and aren't protected.
 */
export function checkSensitivePaths(
  groups: RobotsGroup[],
  paths: string[],
): { protected: string[]; unprotected: string[] } {
  const wildcardGroups = groups.filter((g) => g.userAgent.trim() === '*');

  const protectedPaths: string[] = [];
  const unprotectedPaths: string[] = [];

  for (const path of paths) {
    if (isPathAllowed(wildcardGroups, '*', path)) {
      unprotectedPaths.push(path);
    } else {
      protectedPaths.push(path);
    }
  }

  return { protected: protectedPaths, unprotected: unprotectedPaths };
}

// ── Crawler bot definitions ───────────────────────────────────

export interface CrawlerBot {
  id: string;
  botName: string;
  displayName: string;
  category: 'training' | 'realtime';
  /** Optional alias bot names to also check (e.g. ClaudeBot for anthropic-ai) */
  aliases?: string[];
}

export const TRAINING_CRAWLERS: CrawlerBot[] = [
  { id: '2.1', botName: 'GPTBot', displayName: 'GPTBot', category: 'training' },
  { id: '2.2', botName: 'Google-Extended', displayName: 'Google-Extended', category: 'training' },
  { id: '2.3', botName: 'anthropic-ai', displayName: 'anthropic-ai / ClaudeBot', category: 'training', aliases: ['ClaudeBot'] },
  { id: '2.4', botName: 'PerplexityBot', displayName: 'PerplexityBot', category: 'training' },
  { id: '2.5', botName: 'Applebot-Extended', displayName: 'Applebot-Extended', category: 'training' },
  { id: '2.6', botName: 'CCBot', displayName: 'CCBot', category: 'training' },
  { id: '2.7', botName: 'Meta-ExternalAgent', displayName: 'Meta-ExternalAgent', category: 'training' },
  { id: '2.8', botName: 'Amazonbot', displayName: 'Amazonbot', category: 'training' },
  { id: '2.9', botName: 'Bytespider', displayName: 'Bytespider', category: 'training' },
  { id: '2.10', botName: 'cohere-ai', displayName: 'cohere-ai', category: 'training' },
  { id: '2.11', botName: 'YouBot', displayName: 'YouBot', category: 'training' },
  { id: '2.12', botName: 'Diffbot', displayName: 'Diffbot', category: 'training' },
  { id: '2.13', botName: 'AI2Bot', displayName: 'AI2Bot', category: 'training' },
];

export const REALTIME_CRAWLERS: CrawlerBot[] = [
  { id: '2.14', botName: 'ChatGPT-User', displayName: 'ChatGPT-User', category: 'realtime' },
  { id: '2.15', botName: 'Claude-User', displayName: 'Claude-User', category: 'realtime' },
  { id: '2.16', botName: 'OAI-SearchBot', displayName: 'OAI-SearchBot', category: 'realtime' },
  { id: '2.17', botName: 'Meta-ExternalFetcher', displayName: 'Meta-ExternalFetcher', category: 'realtime' },
  { id: '2.18', botName: 'Bravebot', displayName: 'Bravebot', category: 'realtime' },
  { id: '2.19', botName: 'DuckAssistBot', displayName: 'DuckAssistBot', category: 'realtime' },
  { id: '2.20', botName: 'MistralAI-User', displayName: 'MistralAI-User', category: 'realtime' },
  { id: '2.21', botName: 'Claude-SearchBot', displayName: 'Claude-SearchBot', category: 'realtime' },
];

export const ALL_CRAWLERS: CrawlerBot[] = [...TRAINING_CRAWLERS, ...REALTIME_CRAWLERS];
