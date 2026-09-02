// Compatibility shim over the RFC 9309 gatherer in `gatherers/robots.ts`.
// The parsing/matching logic lives there now; this file keeps the v1 export
// names and signatures so the crawler-permission audits compile unchanged.

import type { RobotsGroup, RobotsRule } from "../../gatherers/robots";
import { isPathAllowed, matchesUserAgent } from "../../gatherers/robots";

// ── Types ─────────────────────────────────────────────────────

export type {
  RobotsRule as RobotsTxtRule,
  RobotsGroup as RobotsTxtGroup,
} from "../../gatherers/robots";

// ── Re-exported gatherer primitives ───────────────────────────

export {
  parseRobots as parseRobotsTxt,
  matchesUserAgent,
  groupsForBot,
  isPathAllowed,
} from "../../gatherers/robots";

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

// ── Crawler bot definitions ───────────────────────────────────

export interface CrawlerBot {
  botName: string;
  displayName: string;
  category: "training" | "realtime";
  /** Optional alias bot names to also check (e.g. ClaudeBot for anthropic-ai) */
  aliases?: string[];
}

export const TRAINING_CRAWLERS: CrawlerBot[] = [
  { botName: "GPTBot", displayName: "GPTBot", category: "training" },
  {
    botName: "Google-Extended",
    displayName: "Google-Extended",
    category: "training",
  },
  {
    botName: "anthropic-ai",
    displayName: "anthropic-ai / ClaudeBot",
    category: "training",
    aliases: ["ClaudeBot"],
  },
  {
    botName: "PerplexityBot",
    displayName: "PerplexityBot",
    category: "training",
  },
  {
    botName: "Applebot-Extended",
    displayName: "Applebot-Extended",
    category: "training",
  },
  { botName: "CCBot", displayName: "CCBot", category: "training" },
  {
    botName: "Meta-ExternalAgent",
    displayName: "Meta-ExternalAgent",
    category: "training",
  },
  { botName: "Amazonbot", displayName: "Amazonbot", category: "training" },
  { botName: "Bytespider", displayName: "Bytespider", category: "training" },
  { botName: "cohere-ai", displayName: "cohere-ai", category: "training" },
  { botName: "YouBot", displayName: "YouBot", category: "training" },
  { botName: "Diffbot", displayName: "Diffbot", category: "training" },
  { botName: "AI2Bot", displayName: "AI2Bot", category: "training" },
];

export const REALTIME_CRAWLERS: CrawlerBot[] = [
  {
    botName: "ChatGPT-User",
    displayName: "ChatGPT-User",
    category: "realtime",
  },
  { botName: "Claude-User", displayName: "Claude-User", category: "realtime" },
  {
    botName: "OAI-SearchBot",
    displayName: "OAI-SearchBot",
    category: "realtime",
  },
  {
    botName: "Meta-ExternalFetcher",
    displayName: "Meta-ExternalFetcher",
    category: "realtime",
  },
  { botName: "Bravebot", displayName: "Bravebot", category: "realtime" },
  {
    botName: "DuckAssistBot",
    displayName: "DuckAssistBot",
    category: "realtime",
  },
  {
    botName: "MistralAI-User",
    displayName: "MistralAI-User",
    category: "realtime",
  },
  {
    botName: "Claude-SearchBot",
    displayName: "Claude-SearchBot",
    category: "realtime",
  },
];

export const ALL_CRAWLERS: CrawlerBot[] = [
  ...TRAINING_CRAWLERS,
  ...REALTIME_CRAWLERS,
];
