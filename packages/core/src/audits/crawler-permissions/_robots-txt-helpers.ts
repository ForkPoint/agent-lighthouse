// ── Types ─────────────────────────────────────────────────────

export interface RobotsTxtRule {
  type: 'allow' | 'disallow';
  path: string;
}

export interface RobotsTxtGroup {
  userAgent: string;
  rules: RobotsTxtRule[];
  crawlDelay?: number;
}

// ── Helpers ───────────────────────────────────────────────────

/**
 * Parses a robots.txt body into structured groups.
 * Each group has a user-agent, a list of allow/disallow rules,
 * and an optional crawl-delay value.
 */
export function parseRobotsTxt(body: string): RobotsTxtGroup[] {
  const groups: RobotsTxtGroup[] = [];
  let currentAgents: string[] = [];
  let currentRules: RobotsTxtRule[] = [];
  let currentCrawlDelay: number | undefined;

  const flushGroup = () => {
    if (currentAgents.length > 0) {
      for (const agent of currentAgents) {
        groups.push({
          userAgent: agent,
          rules: [...currentRules],
          crawlDelay: currentCrawlDelay,
        });
      }
    }
    currentAgents = [];
    currentRules = [];
    currentCrawlDelay = undefined;
  };

  const lines = body.split(/\r\n|\r|\n/);

  for (const rawLine of lines) {
    // Strip comments and trim
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const directive = line.slice(0, colonIdx).trim().toLowerCase();
    const value = line.slice(colonIdx + 1).trim();

    if (directive === 'user-agent') {
      // If we already collected rules, flush the previous group
      if (currentRules.length > 0 || currentCrawlDelay !== undefined) {
        flushGroup();
      }
      currentAgents.push(value);
    } else if (directive === 'disallow') {
      currentRules.push({ type: 'disallow', path: value });
    } else if (directive === 'allow') {
      currentRules.push({ type: 'allow', path: value });
    } else if (directive === 'crawl-delay') {
      const parsed = parseFloat(value);
      if (!Number.isNaN(parsed)) {
        currentCrawlDelay = parsed;
      }
    }
  }

  // Flush any remaining group
  flushGroup();

  return groups;
}

/**
 * Returns true if the rules contain a blanket Disallow: / without a
 * counteracting Allow: /.
 */
export function isBlanketBlocked(rules: RobotsTxtRule[]): boolean {
  const hasDisallowRoot = rules.some(
    (r) => r.type === 'disallow' && r.path === '/',
  );
  if (!hasDisallowRoot) return false;

  const hasAllowRoot = rules.some(
    (r) => r.type === 'allow' && r.path === '/',
  );
  return !hasAllowRoot;
}

/**
 * Checks whether a specific bot is allowed to crawl the root path.
 *
 * Returns:
 * - `explicitly`: true if there is a group specifically for this bot
 * - `allowed`: true if the bot is not blocked (Disallow: /)
 *
 * Logic:
 * 1. Look for a group matching the bot name (case-insensitive).
 * 2. If found, check its rules for Disallow: / (with no overriding Allow: /).
 * 3. If not found, fall back to the * group.
 */
export function isAllowed(
  groups: RobotsTxtGroup[],
  botName: string,
): { explicitly: boolean; allowed: boolean } {
  const botGroups = groups.filter(
    (g) => g.userAgent.toLowerCase() === botName.toLowerCase(),
  );

  if (botGroups.length > 0) {
    // Bot has explicit rules
    const rules = botGroups.flatMap((g) => g.rules);
    const blocked = isBlanketBlocked(rules);
    return { explicitly: true, allowed: !blocked };
  }

  // Fall back to wildcard
  const wildcardGroups = groups.filter((g) => g.userAgent === '*');
  if (wildcardGroups.length > 0) {
    const rules = wildcardGroups.flatMap((g) => g.rules);
    const blocked = isBlanketBlocked(rules);
    return { explicitly: false, allowed: !blocked };
  }

  // No robots.txt rules at all — allowed by default, but not explicitly
  return { explicitly: false, allowed: true };
}

/**
 * Check 2.3 needs to look at both "anthropic-ai" and "ClaudeBot" user-agents.
 */
export function isAnthropicAllowed(
  groups: RobotsTxtGroup[],
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
  groups: RobotsTxtGroup[],
  paths: string[],
): { protected: string[]; unprotected: string[] } {
  const wildcardGroups = groups.filter((g) => g.userAgent === '*');
  const allRules = wildcardGroups.flatMap((g) => g.rules);

  const protectedPaths: string[] = [];
  const unprotectedPaths: string[] = [];

  for (const path of paths) {
    const pathNorm = path.replace(/\/+$/, '');
    const isDisallowed = allRules.some((r) => {
      if (r.type !== 'disallow') return false;
      const ruleNorm = r.path.replace(/\/+$/, '');
      return ruleNorm === pathNorm || r.path.startsWith(path) || path.startsWith(r.path);
    });
    if (isDisallowed) {
      protectedPaths.push(path);
    } else {
      unprotectedPaths.push(path);
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
