import { describe, it, expect } from 'vitest';
import type { AuditMeta, AuditResult, CheckPriority } from './types';
import { Audit } from './audit';
import type { CheckContext } from './check-context';

// ---------------------------------------------------------------------------
// Concrete test subclasses that expose the protected helpers.
// ---------------------------------------------------------------------------

const META_WITH_GUIDANCE: AuditMeta = {
  id: 'a1',
  category: 'machine-discovery',
  title: 'Passing Title',
  failureTitle: 'Failing Title',
  description: 'Some description',
  scoreDisplayMode: 'ternary',
  weight: 1.0,
  defaultPriority: 'medium',
  guidance: {
    impact: 'Guidance impact',
    fix: 'Guidance fix',
    code: 'guidance-code',
    effort: 'easy',
    docsUrl: 'https://docs.example.com',
    tags: ['tag-a', 'tag-b'],
  },
};

const META_NO_GUIDANCE: AuditMeta = {
  id: 'a2',
  category: 'machine-discovery',
  title: 'Passing Title 2',
  failureTitle: 'Failing Title 2',
  description: 'Description fallback',
  scoreDisplayMode: 'binary',
  weight: 1.0,
  defaultPriority: 'high',
};

class WithGuidanceAudit extends Audit {
  static override meta = META_WITH_GUIDANCE;
  audit(_ctx: CheckContext): AuditResult {
    return this.pass('ok', 'expected', 'found');
  }
  // Public passthroughs to the protected helpers.
  callPass(message: string, expected: string, found: string, pageUrl?: string) {
    return this.pass(message, expected, found, pageUrl);
  }
  callNotApplicable(message: string, expected: string, found: string, pageUrl?: string) {
    return this.notApplicable(message, expected, found, pageUrl);
  }
  callWarn(
    message: string,
    expected: string,
    found: string,
    rec?: { priority: CheckPriority; [key: string]: unknown } | string,
    pageUrl?: string,
  ) {
    return this.warn(message, expected, found, rec, pageUrl);
  }
  callFail(
    message: string,
    expected: string,
    found: string,
    rec?: { priority: CheckPriority; [key: string]: unknown } | string,
    pageUrl?: string,
  ) {
    return this.fail(message, expected, found, rec, pageUrl);
  }
}

class NoGuidanceAudit extends Audit {
  static override meta = META_NO_GUIDANCE;
  audit(_ctx: CheckContext): AuditResult {
    return this.fail('bad', 'expected', 'found');
  }
}

// ---------------------------------------------------------------------------
// pass / notApplicable
// ---------------------------------------------------------------------------

describe('Audit.pass', () => {
  const a = new WithGuidanceAudit();

  it('builds a passing result without pageUrl', () => {
    const r = a.callPass('m', 'e', 'f');
    expect(r).toEqual({
      status: 'pass',
      score: 1.0,
      message: 'm',
      expected: 'e',
      found: 'f',
      pageUrl: undefined,
    });
  });

  it('builds a passing result with pageUrl', () => {
    const r = a.callPass('m', 'e', 'f', 'https://example.com/p');
    expect(r.status).toBe('pass');
    expect(r.pageUrl).toBe('https://example.com/p');
  });
});

describe('Audit.notApplicable', () => {
  const a = new WithGuidanceAudit();

  it('builds an na result without pageUrl', () => {
    const r = a.callNotApplicable('m', 'e', 'f');
    expect(r.status).toBe('na');
    expect(r.score).toBe(0);
    expect(r.pageUrl).toBeUndefined();
  });

  it('builds an na result with pageUrl', () => {
    const r = a.callNotApplicable('m', 'e', 'f', '/relative');
    expect(r.status).toBe('na');
    expect(r.pageUrl).toBe('/relative');
  });
});

// ---------------------------------------------------------------------------
// warn / fail — priority resolution branches
// ---------------------------------------------------------------------------

describe('Audit.warn', () => {
  const a = new WithGuidanceAudit();

  it('resolves a known string priority via PRIORITY_MAP', () => {
    const r = a.callWarn('m', 'e', 'f', 'high');
    expect(r.status).toBe('warn');
    expect(r.score).toBe(0.5);
    expect(r.priority).toBe('high');
  });

  it('falls back to the raw string for an unknown string priority', () => {
    const r = a.callWarn('m', 'e', 'f', 'bogus');
    expect(r.priority).toBe('bogus');
  });

  it('resolves priority from an object form', () => {
    const r = a.callWarn('m', 'e', 'f', { priority: 'critical', extra: 1 });
    expect(r.priority).toBe('critical');
  });

  it('leaves priority undefined when no recommendation given', () => {
    const r = a.callWarn('m', 'e', 'f');
    expect(r.priority).toBeUndefined();
  });

  it('passes through pageUrl', () => {
    const r = a.callWarn('m', 'e', 'f', undefined, 'https://example.com/p');
    expect(r.pageUrl).toBe('https://example.com/p');
  });
});

describe('Audit.fail', () => {
  const a = new WithGuidanceAudit();

  it('resolves a known string priority via PRIORITY_MAP', () => {
    const r = a.callFail('m', 'e', 'f', 'low');
    expect(r.status).toBe('fail');
    expect(r.score).toBe(0.0);
    expect(r.priority).toBe('low');
  });

  it('falls back to the raw string for an unknown string priority', () => {
    const r = a.callFail('m', 'e', 'f', 'weird');
    expect(r.priority).toBe('weird');
  });

  it('resolves priority from an object form', () => {
    const r = a.callFail('m', 'e', 'f', { priority: 'critical' });
    expect(r.priority).toBe('critical');
  });

  it('leaves priority undefined when no recommendation given', () => {
    const r = a.callFail('m', 'e', 'f');
    expect(r.priority).toBeUndefined();
  });

  it('passes through pageUrl', () => {
    const r = a.callFail('m', 'e', 'f', undefined, '/p');
    expect(r.pageUrl).toBe('/p');
  });
});

// ---------------------------------------------------------------------------
// toCheckResult
// ---------------------------------------------------------------------------

describe('Audit.toCheckResult', () => {
  it('uses left-hand sources (displayValue/explanation/details/guidance) for a pass', () => {
    const a = new WithGuidanceAudit();
    const result: AuditResult = {
      status: 'pass',
      score: 1.0,
      displayValue: 'DV',
      explanation: 'EX',
      details: { expected: 'd-exp', found: 'd-found', code: 'd-code' },
      priority: 'critical',
    };
    const c = a.toCheckResult(result);

    expect(c.id).toBe('a1');
    expect(c.title).toBe('Passing Title'); // pass → meta.title
    expect(c.status).toBe('pass');
    expect(c.displayValue).toBe('DV');
    expect(c.explanation).toBe('EX');
    expect(c.priority).toBe('critical'); // result.priority wins
    expect(c.impact).toBe('Guidance impact');
    expect(c.fix).toBe('Guidance fix');
    expect(c.details?.expected).toBe('d-exp');
    expect(c.details?.found).toBe('d-found');
    expect(c.details?.code).toBe('d-code');
    expect(c.details?.docsUrl).toBe('https://docs.example.com');
    expect(c.details?.effort).toBe('easy');
    expect(c.tags).toEqual(['tag-a', 'tag-b']);
  });

  it('falls back to found/message/meta when optional fields absent (fail, no guidance)', () => {
    const a = new NoGuidanceAudit();
    const result: AuditResult = {
      status: 'fail',
      score: 0.0,
      found: 'top-found',
      expected: 'top-expected',
      message: 'MSG',
    };
    const c = a.toCheckResult(result);

    expect(c.title).toBe('Failing Title 2'); // non-pass → failureTitle
    expect(c.displayValue).toBe('top-found'); // no displayValue → found
    expect(c.explanation).toBe('MSG'); // no explanation → message
    expect(c.details?.expected).toBe('top-expected'); // no details → result.expected
    expect(c.details?.found).toBe('top-found'); // no details → result.found
    expect(c.details?.code).toBeUndefined(); // no details, no guidance
    expect(c.details?.docsUrl).toBeUndefined();
    expect(c.details?.effort).toBeUndefined();
    expect(c.priority).toBe('high'); // no result.priority → meta.defaultPriority
    expect(c.impact).toBe('Description fallback'); // no guidance → meta.description
    expect(c.fix).toBe('No fix instructions available.');
    expect(c.tags).toBeUndefined();
  });

  it('falls back displayValue to message and code to guidance.code', () => {
    const a = new WithGuidanceAudit();
    const result: AuditResult = {
      status: 'warn',
      score: 0.5,
      message: 'only-message',
    };
    const c = a.toCheckResult(result);

    expect(c.displayValue).toBe('only-message'); // no displayValue, no found → message
    expect(c.explanation).toBe('only-message');
    expect(c.details?.code).toBe('guidance-code'); // no details.code → guidance.code
  });
});

describe('Audit — structured details and per-result code', () => {
  it('carries unknown details keys through validation into the CheckResult', () => {
    const a = new WithGuidanceAudit();
    const result: AuditResult = {
      status: 'pass',
      score: 1,
      message: 'ok',
      expected: 'e',
      found: 'f',
      details: { expected: 'e', found: 'f', trainingAgents: 3, hasCatchAll: false, note: 'kept' },
    };
    const c = a.toCheckResult(result);

    expect(c.details).toMatchObject({ trainingAgents: 3, hasCatchAll: false, note: 'kept' });
  });

  it('carries a per-result code from fail() into the check details', () => {
    const a = new WithGuidanceAudit();
    const c = a.toCheckResult(
      a.callFail('m', 'e', 'f', { priority: 'high', code: 'SITE-SPECIFIC' }),
    );

    expect(c.details?.code).toBe('SITE-SPECIFIC');
    expect(c.priority).toBe('high');
  });

  it('carries a per-result code from warn() into the check details', () => {
    const a = new WithGuidanceAudit();
    const c = a.toCheckResult(
      a.callWarn('m', 'e', 'f', { priority: 'low', code: 'WARN-SNIPPET' }),
    );

    expect(c.details?.code).toBe('WARN-SNIPPET');
    expect(c.priority).toBe('low');
  });

  it('still falls back to guidance.code when the result carries none', () => {
    const a = new WithGuidanceAudit();
    const c = a.toCheckResult(a.callFail('m', 'e', 'f', { priority: 'high' }));

    expect(c.details?.code).toBe('guidance-code');
  });
});
