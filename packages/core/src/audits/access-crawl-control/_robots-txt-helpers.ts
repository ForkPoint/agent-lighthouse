// Compatibility shim over the RFC 9309 gatherer in `gatherers/robots.ts`.
// The parsing/matching logic lives there now; this file keeps the v1 export
// names and signatures so the crawler-permission audits compile unchanged.

import type { RobotsGroup, RobotsRule } from "#core/gatherers/robots";
import { isPathAllowed, matchesUserAgent } from "#core/gatherers/robots";

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

/**
 * Robots.txt product tokens of crawlers whose operator says the content they
 * fetch may train AI models.
 *
 * Each vendor-documented row follows its operator's crawler page (verified
 * 2026-10-19): OpenAI (GPTBot), Google (Google-Extended), Anthropic
 * (ClaudeBot), Apple (Applebot-Extended), Common Crawl (CCBot), Meta
 * (Meta-ExternalAgent), Amazon (Amazonbot), Allen AI (AI2Bot) and Mistral
 * (MistralAI-Training). Anthropic's page names `ClaudeBot` as the token; the
 * legacy `anthropic-ai` spelling appears in no Anthropic document and is not
 * read here. `Bytespider` and `cohere-ai` have no reachable operator page and
 * are kept pending their own review (see the agent-governance dossier).
 *
 * PerplexityBot, YouBot and Diffbot are not here: Perplexity says PerplexityBot
 * "is not used to crawl content for AI foundation models", You.com documents
 * YouBot as its search crawler, and Diffbot says its crawler "is not used for
 * AI training".
 */
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
    botName: "ClaudeBot",
    displayName: "ClaudeBot",
    category: CrawlerPurpose.Training,
  },
  {
    botName: "Applebot-Extended",
    displayName: "Applebot-Extended",
    category: CrawlerPurpose.Training,
  },
  {
    botName: "CCBot",
    displayName: "CCBot",
    category: CrawlerPurpose.Training,
  },
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
    botName: "AI2Bot",
    displayName: "AI2Bot",
    category: CrawlerPurpose.Training,
  },
  {
    botName: "MistralAI-Training",
    displayName: "MistralAI-Training",
    category: CrawlerPurpose.Training,
  },
];

/**
 * Robots.txt product tokens of search crawlers and user-triggered fetchers
 * that serve live answers, each documented by its operator (verified
 * 2026-10-19): OpenAI, Anthropic, Perplexity, Meta, Amazon, DuckDuckGo,
 * Mistral and You.com.
 *
 * `Bravebot` is not here: Brave documents that its crawler "does not advertise
 * a differentiated user agent" and follows the Googlebot rules.
 */
export const REALTIME_CRAWLERS: CrawlerBot[] = [
  {
    botName: "ChatGPT-User",
    displayName: "ChatGPT-User",
    category: CrawlerPurpose.Realtime,
  },
  {
    botName: "OAI-SearchBot",
    displayName: "OAI-SearchBot",
    category: CrawlerPurpose.Realtime,
  },
  {
    botName: "Claude-User",
    displayName: "Claude-User",
    category: CrawlerPurpose.Realtime,
  },
  {
    botName: "Claude-SearchBot",
    displayName: "Claude-SearchBot",
    category: CrawlerPurpose.Realtime,
  },
  {
    botName: "PerplexityBot",
    displayName: "PerplexityBot",
    category: CrawlerPurpose.Realtime,
  },
  {
    botName: "Perplexity-User",
    displayName: "Perplexity-User",
    category: CrawlerPurpose.Realtime,
  },
  {
    botName: "Meta-ExternalFetcher",
    displayName: "Meta-ExternalFetcher",
    category: CrawlerPurpose.Realtime,
  },
  {
    botName: "Meta-WebIndexer",
    displayName: "Meta-WebIndexer",
    category: CrawlerPurpose.Realtime,
  },
  {
    botName: "Amzn-SearchBot",
    displayName: "Amzn-SearchBot",
    category: CrawlerPurpose.Realtime,
  },
  {
    botName: "Amzn-User",
    displayName: "Amzn-User",
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
    botName: "MistralAI-Index",
    displayName: "MistralAI-Index",
    category: CrawlerPurpose.Realtime,
  },
  {
    botName: "YouBot",
    displayName: "YouBot",
    category: CrawlerPurpose.Realtime,
  },
];
