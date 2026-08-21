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

/** Compile an RFC 9309 path pattern (* wildcard, $ anchor) to a RegExp. */
function patternToRegex(pattern: string): RegExp {
  const anchored = pattern.endsWith('$');
  const core = (anchored ? pattern.slice(0, -1) : pattern)
    .split('*')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${core}${anchored ? '$' : ''}`);
}

export function isPathAllowed(groups: RobotsGroup[], botToken: string, path: string): boolean {
  const applicable = groupsForBot(groups, botToken);
  let best: { length: number; type: 'allow' | 'disallow' } | undefined;
  for (const group of applicable) {
    for (const rule of group.rules) {
      if (rule.path === '') continue; // empty Disallow/Allow matches nothing
      const normalized = rule.path === '*' ? '/*' : rule.path;
      if (!patternToRegex(normalized).test(path)) continue;
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
