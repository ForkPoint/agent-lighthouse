import { describe, it, expect } from 'vitest';
import {
  parseRobotsTxt,
  isBlanketBlocked,
  isAllowed,
  isAnthropicAllowed,
  checkSensitivePaths,
} from './_robots-txt-helpers';

describe('parseRobotsTxt', () => {
  it('parses user-agent groups with allow/disallow rules', () => {
    const groups = parseRobotsTxt('User-agent: GPTBot\nDisallow: /api/\nAllow: /');
    expect(groups).toHaveLength(1);
    expect(groups[0].userAgent).toBe('GPTBot');
    expect(groups[0].rules).toEqual([
      { type: 'disallow', path: '/api/' },
      { type: 'allow', path: '/' },
    ]);
  });

  it('expands a shared rule block across multiple consecutive user-agents', () => {
    const groups = parseRobotsTxt('User-agent: GPTBot\nUser-agent: CCBot\nDisallow: /');
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.userAgent)).toEqual(['GPTBot', 'CCBot']);
    expect(groups[0].rules).toEqual([{ type: 'disallow', path: '/' }]);
    expect(groups[1].rules).toEqual([{ type: 'disallow', path: '/' }]);
  });

  it('parses crawl-delay and strips comments', () => {
    const groups = parseRobotsTxt('User-agent: *  # wildcard\nCrawl-delay: 7\nDisallow: /admin/');
    expect(groups[0].crawlDelay).toBe(7);
  });

  it('discards stray directives that appear before any User-agent line', () => {
    // Disallow before any User-agent: flushGroup is called with empty currentAgents,
    // exercising the false branch of `if (currentAgents.length > 0)`.
    const groups = parseRobotsTxt('Disallow: /admin/\nUser-agent: GPTBot\nDisallow: /api/');
    expect(groups).toHaveLength(1);
    expect(groups[0].userAgent).toBe('GPTBot');
    expect(groups[0].rules).toEqual([{ type: 'disallow', path: '/api/' }]);
  });

  it('skips lines that contain no colon character', () => {
    // A line like "INVALID_NO_COLON" has colonIdx === -1 and should be ignored.
    const groups = parseRobotsTxt('User-agent: GPTBot\nINVALID_NO_COLON_HERE\nDisallow: /');
    expect(groups).toHaveLength(1);
    expect(groups[0].rules).toEqual([{ type: 'disallow', path: '/' }]);
  });

  it('ignores a Crawl-delay directive whose value is not a valid number', () => {
    // parseFloat('notanumber') returns NaN; the crawlDelay should remain undefined.
    const groups = parseRobotsTxt('User-agent: GPTBot\nCrawl-delay: notanumber\nDisallow: /api/');
    expect(groups[0].crawlDelay).toBeUndefined();
    expect(groups[0].rules).toEqual([{ type: 'disallow', path: '/api/' }]);
  });

  it('ignores unrecognised directives such as Sitemap:', () => {
    // 'sitemap' is not user-agent/disallow/allow/crawl-delay, so the else-if chain
    // falls through entirely — exercises the false branch of the last else-if.
    const groups = parseRobotsTxt('User-agent: *\nSitemap: https://example.com/sitemap.xml\nDisallow: /api/');
    expect(groups).toHaveLength(1);
    expect(groups[0].rules).toEqual([{ type: 'disallow', path: '/api/' }]);
    expect(groups[0].crawlDelay).toBeUndefined();
  });
});

describe('isBlanketBlocked', () => {
  it('is true for Disallow: / with no Allow: /', () => {
    expect(isBlanketBlocked([{ type: 'disallow', path: '/' }])).toBe(true);
  });

  it('is false when Allow: / counters Disallow: /', () => {
    expect(
      isBlanketBlocked([
        { type: 'disallow', path: '/' },
        { type: 'allow', path: '/' },
      ]),
    ).toBe(false);
  });

  it('is false without a Disallow: /', () => {
    expect(isBlanketBlocked([{ type: 'disallow', path: '/api/' }])).toBe(false);
  });
});

describe('isAllowed', () => {
  it('reports explicit allow when the bot has its own group', () => {
    const groups = parseRobotsTxt('User-agent: GPTBot\nAllow: /');
    expect(isAllowed(groups, 'GPTBot')).toEqual({ explicitly: true, allowed: true });
  });

  it('reports wildcard fallback (not explicit) when no bot group exists', () => {
    const groups = parseRobotsTxt('User-agent: *\nAllow: /');
    expect(isAllowed(groups, 'GPTBot')).toEqual({ explicitly: false, allowed: true });
  });

  it('reports blocked when the bot is explicitly disallowed', () => {
    const groups = parseRobotsTxt('User-agent: GPTBot\nDisallow: /');
    expect(isAllowed(groups, 'GPTBot')).toEqual({ explicitly: true, allowed: false });
  });

  it('defaults to allowed-but-not-explicit when robots.txt has no rules', () => {
    expect(isAllowed([], 'GPTBot')).toEqual({ explicitly: false, allowed: true });
  });
});

describe('isAnthropicAllowed', () => {
  it('passes if either alias is allowed when both are explicit', () => {
    const groups = parseRobotsTxt(
      'User-agent: anthropic-ai\nDisallow: /\n\nUser-agent: ClaudeBot\nAllow: /',
    );
    expect(isAnthropicAllowed(groups)).toEqual({ explicitly: true, allowed: true });
  });

  it('is blocked when the only explicit alias is disallowed', () => {
    const groups = parseRobotsTxt('User-agent: anthropic-ai\nDisallow: /');
    expect(isAnthropicAllowed(groups)).toEqual({ explicitly: true, allowed: false });
  });
});

describe('checkSensitivePaths', () => {
  it('separates protected from unprotected paths', () => {
    const groups = parseRobotsTxt('User-agent: *\nDisallow: /api/');
    const result = checkSensitivePaths(groups, ['/api/', '/admin/']);
    expect(result.protected).toEqual(['/api/']);
    expect(result.unprotected).toEqual(['/admin/']);
  });

  it('only considers wildcard groups, not bot-specific ones', () => {
    const groups = parseRobotsTxt('User-agent: GPTBot\nDisallow: /api/');
    const result = checkSensitivePaths(groups, ['/api/']);
    expect(result.unprotected).toEqual(['/api/']);
  });
});
