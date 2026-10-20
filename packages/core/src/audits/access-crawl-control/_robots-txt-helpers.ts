// Compatibility shim over the RFC 9309 gatherer in `gatherers/robots.ts`.
// The parsing/matching logic lives there now; this file keeps the v1 export
// names and signatures so the crawler-permission audits compile unchanged.

import type { RobotsGroup, RobotsRule } from "#core/gatherers/robots";
import { isPathAllowed, matchesUserAgent } from "#core/gatherers/robots";
import { type BotEntry, BotPurpose, botsByPurpose } from "#core/bot-registry";

// ── Types ─────────────────────────────────────────────────────

export type { RobotsGroup as RobotsTxtGroup } from "#core/gatherers/robots";

// ── Re-exported gatherer primitives ───────────────────────────

export {
  parseRobots as parseRobotsTxt,
  isPathAllowed,
} from "#core/gatherers/robots";

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
  const group: RobotsGroup = { userAgent: "*", rules };
  return !isPathAllowed([group], "*", "/");
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
  return { explicitly, allowed: isPathAllowed(groups, botName, "/") };
}

/**
 * Checks whether specific sensitive paths are disallowed for the wildcard
 * user-agent. Returns an object with the paths that are and aren't protected.
 */
export function checkSensitivePaths(
  groups: RobotsGroup[],
  paths: string[],
): { protected: string[]; unprotected: string[] } {
  const wildcardGroups = groups.filter((g) => g.userAgent.trim() === "*");

  const protectedPaths: string[] = [];
  const unprotectedPaths: string[] = [];

  for (const path of paths) {
    if (isPathAllowed(wildcardGroups, "*", path)) {
      unprotectedPaths.push(path);
    } else {
      protectedPaths.push(path);
    }
  }

  return { protected: protectedPaths, unprotected: unprotectedPaths };
}

export const CrawlerPurpose = {
  Training: "training",
  Realtime: "realtime",
} as const;

export type CrawlerPurpose =
  (typeof CrawlerPurpose)[keyof typeof CrawlerPurpose];

// ── Crawler bot definitions ───────────────────────────────────

export interface CrawlerBot {
  botName: string;
  displayName: string;
  category: CrawlerPurpose;
  /** Optional alias bot names to also check. No current row needs one. */
  aliases?: string[];
  /**
   * True for a usage-control token such as Google-Extended: robots.txt rules
   * name it, but no request carries it, so report copy must not say it crawls.
   */
  controlToken?: boolean;
}

/** A registry row as one of the two robots.txt crawler tables shows it. */
function asCrawler(bot: BotEntry, category: CrawlerPurpose): CrawlerBot {
  const row: CrawlerBot = {
    botName: bot.token,
    displayName: bot.token,
    category,
  };
  if (bot.controlToken) row.controlToken = true;
  return row;
}

/**
 * Robots.txt product tokens of crawlers whose operator says the content they
 * fetch may train AI models, read from the bot registry
 * (`packages/core/src/bot-registry.ts`).
 *
 * Only documented rows count. Bytespider and cohere-ai have no operator page,
 * so under the evidence rule a directive naming them claims nothing about a
 * documented consumer and they are not read here (see the agent-governance
 * dossier). PerplexityBot, YouBot and Diffbot are not here either: their
 * operators document them as search crawlers, not training crawlers.
 */
export const TRAINING_CRAWLERS: CrawlerBot[] = botsByPurpose(
  BotPurpose.Training,
).map((bot) => asCrawler(bot, CrawlerPurpose.Training));

/**
 * Robots.txt product tokens of search crawlers and user-triggered fetchers
 * that serve live answers, read from the bot registry: every documented row
 * whose purpose is an AI search index or a user-requested fetch.
 *
 * `Bravebot` is not in the registry: Brave documents that its crawler "does
 * not advertise a differentiated user agent" and follows the Googlebot rules.
 */
export const REALTIME_CRAWLERS: CrawlerBot[] = botsByPurpose(
  BotPurpose.AiSearch,
  BotPurpose.UserFetch,
).map((bot) => asCrawler(bot, CrawlerPurpose.Realtime));
