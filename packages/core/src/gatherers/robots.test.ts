import { describe, it, expect } from 'vitest';
import {
  parseRobots, matchesUserAgent, groupsForBot, isPathAllowed, isBlanketBlocked,
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
