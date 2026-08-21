import { stripBom, normalizeNewlines } from './fetch-classify';

export interface RobotsRule {
  type: 'allow' | 'disallow';
  path: string;
}

export interface RobotsGroup {
  userAgent: string;
  rules: RobotsRule[];
  crawlDelay?: number;
}

/** RFC 9309 §2.4: parsers must handle at least 500 KiB; we stop there. */
const MAX_BYTES = 500 * 1024;

export function parseRobots(body: string): RobotsGroup[] {
  const text = normalizeNewlines(stripBom(body)).slice(0, MAX_BYTES);
  const groups: RobotsGroup[] = [];
  let agents: string[] = [];
  let rules: RobotsRule[] = [];
  let crawlDelay: number | undefined;
  let inRules = false;

  const flush = () => {
    for (const agent of agents) {
      groups.push({ userAgent: agent, rules: [...rules], crawlDelay });
    }
    agents = [];
    rules = [];
    crawlDelay = undefined;
    inRules = false;
  };

  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const directive = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (directive === 'user-agent') {
      if (inRules) flush();
      agents.push(value);
    } else if (directive === 'disallow' || directive === 'allow') {
      inRules = true;
      rules.push({ type: directive, path: value });
    } else if (directive === 'crawl-delay') {
      inRules = true;
      const parsed = Number.parseFloat(value);
      if (!Number.isNaN(parsed)) crawlDelay = parsed;
    }
  }
  flush();
  return groups;
}

/** Group UA "GPTBot/1.1" matches bot token "gptbot": compare the product token. */
export function matchesUserAgent(groupUserAgent: string, botToken: string): boolean {
  const product = groupUserAgent.trim().toLowerCase().split('/')[0];
  return product === botToken.trim().toLowerCase();
}

export function groupsForBot(groups: RobotsGroup[], botToken: string): RobotsGroup[] {
  const specific = groups.filter((g) => matchesUserAgent(g.userAgent, botToken));
  if (specific.length > 0) return specific;
  return groups.filter((g) => g.userAgent.trim() === '*');
}

/**
 * Match an RFC 9309 path pattern (`*` wildcard, `$` end anchor) against a path.
 *
 * Without a trailing `$` the pattern only has to match a prefix of the path.
 *
 * This is a two-pointer glob matcher that backtracks by star position, the same
 * approach the reference robots.txt implementations use. It deliberately avoids
 * RegExp: robots.txt is attacker-controlled input, and a pattern such as
 * `/a*a*a*a*a*a*b` compiled to `^/a.*a.*a.*a.*a.*a.*b` makes the engine
 * backtrack exponentially — seconds to non-termination on a long path.
 */
function matchesPathPattern(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith('$');
  const pat = anchored ? pattern.slice(0, -1) : pattern;

  let p = 0;
  let s = 0;
  // Position of the last `*` seen, and how much of the path it currently spans.
  let star = -1;
  let mark = 0;

  for (;;) {
    if (p < pat.length && pat[p] === '*') {
      star = p;
      p += 1;
      mark = s;
      continue;
    }
    if (p === pat.length) {
      // Whole pattern consumed: a prefix pattern is satisfied, an anchored one
      // only if the path ended too.
      if (!anchored || s === path.length) return true;
    } else if (s < path.length && pat[p] === path[s]) {
      p += 1;
      s += 1;
      continue;
    }
    // Mismatch (or anchored pattern with path left over): let the most recent
    // `*` swallow one more character and retry from just after it.
    if (star === -1 || mark >= path.length) return false;
    mark += 1;
    p = star + 1;
    s = mark;
  }
}

export function isPathAllowed(groups: RobotsGroup[], botToken: string, path: string): boolean {
  const applicable = groupsForBot(groups, botToken);
  let best: { length: number; type: 'allow' | 'disallow' } | undefined;
  for (const group of applicable) {
    for (const rule of group.rules) {
      if (rule.path === '') continue; // empty Disallow/Allow matches nothing
      const normalized = rule.path === '*' ? '/*' : rule.path;
      if (!matchesPathPattern(normalized, path)) continue;
      const length = normalized.replace(/\*/g, '').length;
      // Longest match wins; on a tie, allow wins (RFC 9309 §2.2.2).
      if (!best || length > best.length || (length === best.length && rule.type === 'allow')) {
        best = { length, type: rule.type };
      }
    }
  }
  return !best || best.type === 'allow';
}

export function isBlanketBlocked(groups: RobotsGroup[], botToken: string): boolean {
  return !isPathAllowed(groups, botToken, '/');
}
