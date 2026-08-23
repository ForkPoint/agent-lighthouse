import { describe, it, expect } from 'vitest';
import { AiBotDirectivesAudit } from './ai-bot-directives';
import { weightForGrade } from '../../scorer';
import { mockCheckContext, mockFetchResult } from '../../__tests__/test-utils';

const robots = (body: string) =>
  mockCheckContext([], { '/robots.txt': mockFetchResult(body, 200) });

describe('AiBotDirectivesAudit — meta', () => {
  it('is scored at the grade the merged dossier supports', () => {
    const { meta } = AiBotDirectivesAudit;
    expect(meta.id).toBe('access-crawl-control/ai-bot-directives');
    expect(meta.category).toBe('access-crawl-control');
    expect(meta.evidenceGrade).toBe('B');
    expect(meta.tier).toBe('scored');
    expect(meta.weight).toBe(weightForGrade('B', 'scored'));
    expect(meta.scoreDisplayMode).toBe('ternary');
    expect(meta.dossier).toBe(
      'docs/evidence/audits/access-crawl-control/ai-bot-directives.md',
    );
  });
});

describe('AiBotDirectivesAudit — scoring (documented-active bots only)', () => {
  const audit = new AiBotDirectivesAudit();

  it('passes when every documented-active bot is explicitly allowed', () => {
    const result = audit.audit(
      robots('User-agent: YouBot\nAllow: /\n\nUser-agent: AI2Bot\nAllow: /'),
    );
    expect(result.status).toBe('pass');
    expect(result.score).toBe(1);
  });

  it('warns when documented-active bots are only allowed by default', () => {
    const result = audit.audit(robots('User-agent: *\nAllow: /'));
    expect(result.status).toBe('warn');
  });

  it('warns when robots.txt is missing', () => {
    const result = audit.audit(mockCheckContext([], {}));
    expect(result.status).toBe('warn');
    expect(result.found).toContain('No robots.txt found');
  });

  it('warns when robots.txt returns non-200', () => {
    const result = audit.audit(
      mockCheckContext([], { '/robots.txt': mockFetchResult('', 404) }),
    );
    expect(result.status).toBe('warn');
    expect(result.found).toContain('No robots.txt found');
  });

  it('warns when only one documented-active bot is explicitly allowed', () => {
    const result = audit.audit(
      robots('User-agent: YouBot\nAllow: /\n\nUser-agent: *\nAllow: /'),
    );
    expect(result.status).toBe('warn');
  });

  it('fails when a documented-active bot is blocked', () => {
    const result = audit.audit(
      robots('User-agent: YouBot\nDisallow: /\n\nUser-agent: AI2Bot\nAllow: /'),
    );
    expect(result.status).toBe('fail');
    expect(result.message).toContain('YouBot');
  });

  it('fails when a blanket wildcard block sweeps up the documented-active bots', () => {
    const result = audit.audit(robots('User-agent: *\nDisallow: /'));
    expect(result.status).toBe('fail');
  });

  it('does not score on the informational bots — blocking them still passes', () => {
    const result = audit.audit(
      robots(
        [
          'User-agent: YouBot',
          'Allow: /',
          '',
          'User-agent: AI2Bot',
          'Allow: /',
          '',
          'User-agent: Bytespider',
          'Disallow: /',
          '',
          'User-agent: cohere-ai',
          'Disallow: /',
          '',
          'User-agent: Diffbot',
          'Disallow: /',
        ].join('\n'),
      ),
    );
    expect(result.status).toBe('pass');
    expect(result.score).toBe(1);
  });

  it('does not score on the informational bots — allowing them cannot rescue a fail', () => {
    const result = audit.audit(
      robots(
        [
          'User-agent: Bytespider',
          'Allow: /',
          '',
          'User-agent: cohere-ai',
          'Allow: /',
          '',
          'User-agent: Diffbot',
          'Allow: /',
          '',
          'User-agent: AI2Bot',
          'Disallow: /',
        ].join('\n'),
      ),
    );
    expect(result.status).toBe('fail');
  });
});

describe('AiBotDirectivesAudit — informational per-bot table', () => {
  const audit = new AiBotDirectivesAudit();

  it('reports every one of the five bots with its robots.txt stance', () => {
    const result = audit.audit(
      robots(
        [
          'User-agent: YouBot',
          'Allow: /',
          '',
          'User-agent: Bytespider',
          'Disallow: /',
          '',
          'User-agent: *',
          'Allow: /',
        ].join('\n'),
      ),
    );
    const found = result.found ?? '';
    for (const bot of ['YouBot', 'AI2Bot', 'Bytespider', 'cohere-ai', 'Diffbot']) {
      expect(found).toContain(bot);
    }
    expect(found).toContain('explicitly allowed');
    expect(found).toContain('blocked');
    expect(found).toContain('allowed by default');
  });

  it('marks the informational rows as not scored', () => {
    const result = audit.audit(robots('User-agent: *\nAllow: /'));
    const found = result.found ?? '';
    expect(found).toContain('informational');
    expect(found).toContain('scored');
  });

  it('matches user-agent tokens case-insensitively', () => {
    const result = audit.audit(
      robots('User-agent: youbot\nAllow: /\n\nUser-agent: ai2bot\nAllow: /'),
    );
    expect(result.status).toBe('pass');
  });
});

describe('AiBotDirectivesAudit — message accuracy', () => {
  const audit = new AiBotDirectivesAudit();

  it('does not claim wildcard-only access when robots.txt has no wildcard group', () => {
    const result = audit.audit(robots('User-agent: Googlebot\nAllow: /\n'));
    expect(result.status).toBe('warn');
    expect(result.message).not.toContain('allowed only through the wildcard rule');
    expect(result.message).toContain('no directive');
  });

  it('still names the wildcard rule when there is one', () => {
    const result = audit.audit(robots('User-agent: *\nAllow: /\n'));
    expect(result.status).toBe('warn');
    expect(result.message).toContain('wildcard rule');
  });

  it('does not headline a warn as a blocked bot', () => {
    const check = audit.toCheckResult(audit.audit(robots('User-agent: *\nAllow: /\n')));
    expect(check.title).not.toBe('A documented AI bot is blocked in robots.txt');
  });

  it('keeps the blocked-bot headline informative on the fail path', () => {
    const result = audit.audit(robots('User-agent: YouBot\nDisallow: /\n'));
    expect(result.status).toBe('fail');
    expect(result.priority).toBe('medium');
    expect(result.message).toContain('blocked by robots.txt');
  });
});
