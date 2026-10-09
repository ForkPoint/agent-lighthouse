// Compatibility shim over the RFC 9309 gatherer in `gatherers/robots.ts`.
// The parsing/matching logic lives there now; this file keeps the v1 export
// names and signatures so the crawler-permission audits compile unchanged.

import type { RobotsGroup, RobotsRule } from "#core/gatherers/robots";
import { isPathAllowed, matchesUserAgent } from "#core/gatherers/robots";

// ── Types ─────────────────────────────────────────────────────

export type {
  RobotsRule as RobotsTxtRule,
  RobotsGroup as RobotsTxtGroup,
} from "#core/gatherers/robots";

// ── Re-exported gatherer primitives ───────────────────────────

export {
  parseRobots as parseRobotsTxt,
  matchesUserAgent,
  groupsForBot,
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
 * Check 2.3 needs to look at both "anthropic-ai" and "ClaudeBot" user-agents.
 */
export function isAnthropicAllowed(groups: RobotsGroup[]): {
  explicitly: boolean;
  allowed: boolean;
} {
  const result1 = isAllowed(groups, "anthropic-ai");
  const result2 = isAllowed(groups, "ClaudeBot");

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
  /** Optional alias bot names to also check (e.g. ClaudeBot for anthropic-ai) */
  aliases?: string[];
  /**
   * True for a usage-control token such as Google-Extended: robots.txt rules
   * name it, but no request carries it, so report copy must not say it crawls.
   */
  controlToken?: boolean;
}

export const TRAINING_CRAWLERS: CrawlerBot[] = [
  {
    botName: "GPTBot",
    displayName: "GPTBot",
    category: CrawlerPurpose.Training,
  },
  {
    botName: "Google-Extended",
    displayName: "Google-Extended",
    category: CrawlerPurpose.Training,
  },
  {
    botName: "anthropic-ai",
    displayName: "anthropic-ai / ClaudeBot",
    category: CrawlerPurpose.Training,
    aliases: ["ClaudeBot"],
  },
  {
    botName: "PerplexityBot",
    displayName: "PerplexityBot",
    category: CrawlerPurpose.Training,
  },
  {
    botName: "Applebot-Extended",
    displayName: "Applebot-Extended",
    category: CrawlerPurpose.Training,
  },
  { botName: "CCBot", displayName: "CCBot", category: CrawlerPurpose.Training },
  {
    botName: "Meta-ExternalAgent",
    displayName: "Meta-ExternalAgent",
    category: CrawlerPurpose.Training,
  },
  {
    botName: "Amazonbot",
    displayName: "Amazonbot",
    category: CrawlerPurpose.Training,
  },
  {
    botName: "Bytespider",
    displayName: "Bytespider",
    category: CrawlerPurpose.Training,
  },
  {
    botName: "cohere-ai",
    displayName: "cohere-ai",
    category: CrawlerPurpose.Training,
  },
  {
    botName: "YouBot",
    displayName: "YouBot",
    category: CrawlerPurpose.Training,
  },
  {
    botName: "Diffbot",
    displayName: "Diffbot",
    category: CrawlerPurpose.Training,
  },
  {
    botName: "AI2Bot",
    displayName: "AI2Bot",
    category: CrawlerPurpose.Training,
  },
];

export const REALTIME_CRAWLERS: CrawlerBot[] = [
  {
    botName: "ChatGPT-User",
    displayName: "ChatGPT-User",
    category: CrawlerPurpose.Realtime,
  },
  {
    botName: "Claude-User",
    displayName: "Claude-User",
    category: CrawlerPurpose.Realtime,
  },
  {
    botName: "OAI-SearchBot",
    displayName: "OAI-SearchBot",
    category: CrawlerPurpose.Realtime,
  },
  {
    botName: "Meta-ExternalFetcher",
    displayName: "Meta-ExternalFetcher",
    category: CrawlerPurpose.Realtime,
  },
  {
    botName: "Bravebot",
    displayName: "Bravebot",
    category: CrawlerPurpose.Realtime,
  },
  {
    botName: "DuckAssistBot",
    displayName: "DuckAssistBot",
    category: CrawlerPurpose.Realtime,
  },
  {
    botName: "MistralAI-User",
    displayName: "MistralAI-User",
    category: CrawlerPurpose.Realtime,
  },
  {
    botName: "Claude-SearchBot",
    displayName: "Claude-SearchBot",
    category: CrawlerPurpose.Realtime,
  },
];

export const ALL_CRAWLERS: CrawlerBot[] = [
  ...TRAINING_CRAWLERS,
  ...REALTIME_CRAWLERS,
];
