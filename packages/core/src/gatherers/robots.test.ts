import { describe, it, expect } from 'vitest';
import {
  parseRobots, matchesUserAgent, groupsForBot, isPathAllowed, isBlanketBlocked, decidingRule,
  parseRobotsFile, hasNamedGroup, directiveLines,
} from './robots';

describe('parseRobots', () => {
  it('parses a BOM-prefixed file (v1 returned zero groups)', () => {
    const groups = parseRobots('﻿User-agent: *\nDisallow: /private/');
    expect(groups).toHaveLength(1);
    expect(groups[0].rules).toEqual([{ type: 'disallow', path: '/private/' }]);
  });
  it('handles CRLF and comments', () => {
    const groups = parseRobots('User-agent: GPTBot # openai\r\nDisallow: /a\r\n');
    expect(groups[0].userAgent).toBe('GPTBot');
    expect(groups[0].rules[0].path).toBe('/a');
  });
  it('merges repeated groups for the same user-agent (RFC 9309 §2.2.1)', () => {
    const body = 'User-agent: GPTBot\nDisallow: /a\n\nUser-agent: GPTBot\nDisallow: /b\n';
    const merged = groupsForBot(parseRobots(body), 'gptbot');
    const paths = merged.flatMap((g) => g.rules.map((r) => r.path)).sort();
    expect(paths).toEqual(['/a', '/b']);
  });
  it('caps parsing at 500 KiB', () => {
    const big = 'User-agent: *\n' + 'Disallow: /x\n'.repeat(60000);
    expect(big.length).toBeGreaterThan(512_000);
    const groups = parseRobots(big);
    const totalRules = groups.reduce((n, g) => n + g.rules.length, 0);
    expect(totalRules).toBeLessThan(60000);
  });
});

describe('matchesUserAgent', () => {
  it('matches case-insensitively', () => {
    expect(matchesUserAgent('gptbot', 'GPTBot')).toBe(true);
  });
  it('matches versioned tokens: group "GPTBot/1.1" for bot token gptbot', () => {
    expect(matchesUserAgent('GPTBot/1.1', 'gptbot')).toBe(true);
  });
  it('does not match a different bot', () => {
    expect(matchesUserAgent('ClaudeBot', 'gptbot')).toBe(false);
  });
});

describe('isPathAllowed', () => {
  const groups = parseRobots(
    'User-agent: GPTBot\nDisallow: /private/\nAllow: /private/press/\n\nUser-agent: *\nDisallow: /tmp/',
  );
  it('applies longest-match precedence: allow overrides shorter disallow', () => {
    expect(isPathAllowed(groups, 'gptbot', '/private/press/kit.html')).toBe(true);
    expect(isPathAllowed(groups, 'gptbot', '/private/mail.html')).toBe(false);
  });
  it('bot-specific group supersedes the wildcard group entirely', () => {
    // GPTBot group exists, so the * group's /tmp/ rule does not apply to GPTBot.
    expect(isPathAllowed(groups, 'gptbot', '/tmp/x')).toBe(true);
  });
  it('supports * wildcard inside paths', () => {
    const g = parseRobots('User-agent: *\nDisallow: /*.pdf');
    expect(isPathAllowed(g, 'gptbot', '/whitepaper.pdf')).toBe(false);
    expect(isPathAllowed(g, 'gptbot', '/whitepaper.html')).toBe(true);
  });
  it('supports $ end anchor', () => {
    const g = parseRobots('User-agent: *\nDisallow: /draft$');
    expect(isPathAllowed(g, 'gptbot', '/draft')).toBe(false);
    expect(isPathAllowed(g, 'gptbot', '/drafts')).toBe(true);
  });
  it('empty disallow value allows everything', () => {
    const g = parseRobots('User-agent: *\nDisallow:');
    expect(isPathAllowed(g, 'gptbot', '/anything')).toBe(true);
  });
});

describe('path pattern matching', () => {
  /** True when `pattern` matches `path`, i.e. the Disallow rule bites. */
  const patternMatches = (pattern: string, path: string) =>
    !isPathAllowed(parseRobots(`User-agent: *\nDisallow: ${pattern}`), 'gptbot', path);

  it('lets * span arbitrary characters', () => {
    expect(patternMatches('/a*c', '/abc')).toBe(true);
  });
  it('honours the $ anchor after a wildcard', () => {
    expect(patternMatches('/a*c$', '/abcd')).toBe(false);
  });
  it('lets * span path separators', () => {
    expect(patternMatches('/*.pdf', '/x/y.pdf')).toBe(true);
  });
  it('does not backtrack catastrophically on adversarial patterns', () => {
    // A RegExp-based matcher takes seconds-to-forever here; the suite runtime
    // is the guard. The path has no 'b', so the pattern must not match.
    expect(patternMatches('/a*a*a*a*a*a*a*a*a*a*a*a*b', '/'.padEnd(60, 'a'))).toBe(false);
  });
});

describe('isBlanketBlocked', () => {
  it.each(['/', '/*', '*'])('detects Disallow: %s as blanket block', (path) => {
    const g = parseRobots(`User-agent: GPTBot\nDisallow: ${path}`);
    expect(isBlanketBlocked(g, 'gptbot')).toBe(true);
  });
  it('is false when an Allow: / overrides', () => {
    const g = parseRobots('User-agent: GPTBot\nDisallow: /\nAllow: /');
    expect(isBlanketBlocked(g, 'gptbot')).toBe(false);
  });
  it('is false when only other bots are blocked', () => {
    const g = parseRobots('User-agent: ClaudeBot\nDisallow: /');
    expect(isBlanketBlocked(g, 'gptbot')).toBe(false);
  });
});

describe('parseRobotsFile', () => {
  it('collects Sitemap directives regardless of position', () => {
    const file = parseRobotsFile(
      'Sitemap: https://a.test/sitemap.xml\nUser-agent: *\nDisallow: /x\nSitemap: https://a.test/news.xml\n',
    );
    expect(file.sitemaps).toEqual([
      'https://a.test/sitemap.xml',
      'https://a.test/news.xml',
    ]);
    expect(file.groups).toHaveLength(1);
  });

  it('is case-insensitive on the directive name and trims the value', () => {
    const file = parseRobotsFile('SITEMAP:   https://a.test/s.xml   \n');
    expect(file.sitemaps).toEqual(['https://a.test/s.xml']);
  });

  // A Sitemap line is host-global and sits outside every group, so it must not
  // be treated as a rule line — doing so would split one group into two and
  // silently drop the second half's rules from the first.
  it('does not let a Sitemap line between rules split a group', () => {
    const file = parseRobotsFile(
      'User-agent: GPTBot\nDisallow: /a\nSitemap: https://a.test/s.xml\nDisallow: /b\n',
    );
    expect(file.groups).toHaveLength(1);
    expect(file.groups[0]!.rules).toEqual([
      { type: 'disallow', path: '/a' },
      { type: 'disallow', path: '/b' },
    ]);
  });

  it('retains non-rule directives per group in file order', () => {
    const file = parseRobotsFile(
      'User-agent: GPTBot\nContent-Signal: search=yes, ai-train=no\nDisallow: /x\n',
    );
    expect(file.groups[0]!.otherDirectives).toEqual([
      { name: 'content-signal', value: 'search=yes, ai-train=no' },
    ]);
  });

  it('leaves otherDirectives unset on a group that has none', () => {
    const file = parseRobotsFile('User-agent: *\nDisallow: /x\n');
    expect(file.groups[0]!.otherDirectives).toBeUndefined();
  });

  it('gives parseRobots and parseRobotsFile the same grouping', () => {
    const body = 'User-agent: GPTBot\nDisallow: /a\n\nUser-agent: *\nAllow: /\n';
    expect(parseRobotsFile(body).groups).toEqual(parseRobots(body));
  });
});

describe('hasNamedGroup', () => {
  const groups = parseRobots('User-agent: GPTBot\nDisallow: /a\n\nUser-agent: *\nDisallow: /b\n');

  it('is true for a bot with its own group', () => {
    expect(hasNamedGroup(groups, 'gptbot')).toBe(true);
  });

  // The distinction that matters: a bot with no named group inherits the
  // wildcard rules, and a bot with one ignores them completely.
  it('is false for a bot that only falls back to the wildcard group', () => {
    expect(hasNamedGroup(groups, 'perplexitybot')).toBe(false);
  });

  it('matches the product token, not the version suffix', () => {
    const versioned = parseRobots('User-agent: GPTBot/1.4\nDisallow: /a\n');
    expect(hasNamedGroup(versioned, 'gptbot')).toBe(true);
  });
});

describe('decidingRule', () => {
  const groups = parseRobots('User-agent: *\nDisallow: /private\nAllow: /private/press\n');

  // The audits quote this rule verbatim, so it must be the line that actually
  // decided the path, not merely a line that matched it.
  it('returns the longest matching rule', () => {
    expect(decidingRule(groups, 'gptbot', '/private/press/kit.html')).toEqual({
      type: 'allow',
      path: '/private/press',
    });
    expect(decidingRule(groups, 'gptbot', '/private/mail.html')).toEqual({
      type: 'disallow',
      path: '/private',
    });
  });

  it('returns undefined when no rule matches', () => {
    expect(decidingRule(groups, 'gptbot', '/public/x')).toBeUndefined();
  });
});

describe('directiveLines', () => {
  const ROBOTS = `# comment
Content-Usage: train-ai=n

User-agent: GPTBot
Content-Signal: ai-train=no
Disallow: /private

User-agent: *
User-agent: CCBot
License: https://example.com/license.xml
`;

  it('keeps a directive written above the first group at file scope', () => {
    const [line] = directiveLines(ROBOTS, 'Content-Usage');
    expect(line).toEqual({ name: 'content-usage', value: 'train-ai=n', group: '', line: 2 });
  });

  it('attributes a directive to the group it was written in, with its line number', () => {
    const [line] = directiveLines(ROBOTS, 'content-signal');
    expect(line?.group).toBe('GPTBot');
    expect(line?.line).toBe(5);
  });

  it('emits one entry per user-agent when a group names several', () => {
    const lines = directiveLines(ROBOTS, 'License');
    expect(lines.map((l) => l.group)).toEqual(['*', 'CCBot']);
    expect(lines[0]?.value).toBe('https://example.com/license.xml');
  });

  it('returns nothing for a directive the file does not carry', () => {
    expect(directiveLines(ROBOTS, 'Content-Security-Policy')).toEqual([]);
  });
});
