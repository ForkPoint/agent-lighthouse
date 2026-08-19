import { describe, it, expect, vi } from 'vitest';
import type { AuditMeta, AuditResult, PageType } from './types';
import { logger } from './logger';
import { Audit } from './audit';
import type { CheckContext } from './check-context';
import type { ScanConfig, AuditRegistration } from './audit-config';
import { runAudits } from './audit-runner';
import type { AuditProgressEvent } from './audit-runner';

// ---------------------------------------------------------------------------
// Helpers: build tiny fake Audit subclasses + registrations
// ---------------------------------------------------------------------------

function meta(overrides: Partial<AuditMeta> & { id: string; category: string }): AuditMeta {
  return {
    title: 'T',
    failureTitle: 'F',
    description: 'D',
    scoreDisplayMode: 'ternary',
    weight: 1,
    defaultPriority: 'medium',
    ...overrides,
  };
}

/** Build a registration whose audit runs `fn`. Optionally override reg.meta separately. */
function makeReg(
  m: AuditMeta,
  fn: (ctx: CheckContext) => AuditResult | Promise<AuditResult>,
  regMeta: AuditMeta = m,
): AuditRegistration {
  class FakeAudit extends Audit {
    static override meta = m;
    audit(ctx: CheckContext): AuditResult | Promise<AuditResult> {
      return fn(ctx);
    }
  }
  return { create: () => new FakeAudit(), meta: regMeta };
}

const result = (status: AuditResult['status'], score: number): AuditResult => ({
  status,
  score,
  message: 'm',
  expected: 'e',
  found: 'f',
});

function ctxWith(pageTypes: PageType[]): CheckContext {
  return {
    pages: pageTypes.map((pt) => ({ pageType: pt })),
    rootFiles: {},
    domain: 'example.com',
    baseUrl: 'https://example.com',
    fetch: async () => ({}) as never,
  } as unknown as CheckContext;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('runAudits', () => {
  it('filters by page type, handles sync/async/throwing audits, and scores categories', async () => {
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => logger);

    const config: ScanConfig = {
      categories: [
        { id: 'cat1', name: 'Cat One', weight: 0.5 },
        { id: 'cat2', name: 'Cat Two', weight: 0.5 }, // no registrations → empty branch
      ],
      audits: {
        cat1: [
          // sync pass, applicablePageTypes undefined → always included, weight 2
          makeReg(meta({ id: 'p1', category: 'cat1', weight: 2 }), () => result('pass', 1)),
          // async warn, applicable to homepage (present) → included
          makeReg(meta({ id: 'w1', category: 'cat1', applicablePageTypes: ['homepage'] }), async () =>
            result('warn', 0.5),
          ),
          // applicable only to product (absent) → recorded as an `na` stub
          makeReg(meta({ id: 's1', category: 'cat1', applicablePageTypes: ['product'] }), () =>
            result('fail', 0),
          ),
          // empty applicablePageTypes array → included
          makeReg(meta({ id: 'e1', category: 'cat1', applicablePageTypes: [] }), () => result('pass', 1)),
          // throws → logger.error, recorded as an `na` error stub (not dropped)
          makeReg(meta({ id: 't1', category: 'cat1' }), () => {
            throw new Error('boom');
          }),
          // reg.meta.id differs from the instance's static meta.id → check.id not in
          // weightMap → weight falls back to 1.0
          makeReg(
            meta({ id: 'actual-mismatch', category: 'cat1' }),
            () => result('pass', 1),
            meta({ id: 'reg-mismatch', category: 'cat1' }),
          ),
        ],
        // cat2 intentionally has no entry in the audits map
      },
    };

    const events: AuditProgressEvent[] = [];
    const out = await runAudits(ctxWith(['homepage']), config, (e) => events.push(e));

    // s1 skipped (na stub) + t1 throws (na stub) + 4 real checks = 6 total.
    // 5 audits execute (s1 never runs); t1's throw is logged once.
    expect(out.checks).toHaveLength(6);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(events.filter((e) => e.type === 'unit:done')).toHaveLength(4);
    const fails = events.filter((e) => e.type === 'unit:fail');
    expect(fails).toHaveLength(1);
    expect(fails[0]).toMatchObject({ label: 't1 T', error: 'boom' });

    // s1 → not-applicable stub tagged as a page-type skip.
    const s1 = out.checks.find((c) => c.id === 's1')!;
    expect(s1.status).toBe('na');
    expect(s1.tags).toContain('skipped:page-type');
    // t1 → not-applicable stub tagged as a scan error.
    const t1 = out.checks.find((c) => c.id === 't1')!;
    expect(t1.status).toBe('na');
    expect(t1.tags).toContain('scan-error');

    const cat1 = out.categories.find((c) => c.id === 'cat1')!;
    // na stubs are excluded from the weighted score and the counts.
    // checks: p1(pass,w2), w1(warn,w1), e1(pass,w1), mismatch(pass,w1 fallback)
    // weightedSum = 1*2 + 0.5*1 + 1*1 + 1*1 = 4.5 ; totalWeight = 5 → 90
    expect(cat1.score).toBe(90);
    expect(cat1.passCount).toBe(3);
    expect(cat1.warnCount).toBe(1);
    expect(cat1.failCount).toBe(0);

    const cat2 = out.categories.find((c) => c.id === 'cat2')!;
    expect(cat2.checks).toHaveLength(0);
    expect(cat2.score).toBe(0);

    // overall = round(90*0.5 + 0*0.5) = 45
    expect(out.overallScore).toBe(45);

    errorSpy.mockRestore();
  });

  it('returns zeroed categories for empty input and works without onProgress', async () => {
    const config: ScanConfig = {
      categories: [{ id: 'only', name: 'Only', weight: 1 }],
      audits: { only: [] },
    };

    const out = await runAudits(ctxWith([]), config);
    expect(out.checks).toHaveLength(0);
    expect(out.overallScore).toBe(0);
    expect(out.categories[0]).toMatchObject({ id: 'only', score: 0, passCount: 0 });
  });

  it('scores 0 when every contributing weight is zero', async () => {
    const config: ScanConfig = {
      categories: [{ id: 'z', name: 'Z', weight: 1 }],
      audits: {
        z: [makeReg(meta({ id: 'zero', category: 'z', weight: 0 }), () => result('pass', 1))],
      },
    };

    const out = await runAudits(ctxWith(['homepage']), config);
    // one check exists (not the empty branch), but totalWeight === 0 → score 0
    expect(out.categories[0].checks).toHaveLength(1);
    expect(out.categories[0].score).toBe(0);
  });

  it('executes audits across multiple batches (more than the batch size)', async () => {
    const regs: AuditRegistration[] = [];
    for (let i = 0; i < 25; i++) {
      regs.push(makeReg(meta({ id: `m${i}`, category: 'big' }), () => result('pass', 1)));
    }
    const config: ScanConfig = {
      categories: [{ id: 'big', name: 'Big', weight: 1 }],
      audits: { big: regs },
    };

    const out = await runAudits(ctxWith(['homepage']), config);
    expect(out.checks).toHaveLength(25);
    expect(out.categories[0].score).toBe(100);
  });

  it('still supports the deprecated (completed, total) progress callback', async () => {
    const regs: AuditRegistration[] = [];
    for (let i = 0; i < 3; i++) {
      regs.push(makeReg(meta({ id: `l${i}`, category: 'leg' }), () => result('pass', 1)));
    }
    const config: ScanConfig = {
      categories: [{ id: 'leg', name: 'Leg', weight: 1 }],
      audits: { leg: regs },
    };

    const calls: Array<[number, number]> = [];
    // Intentionally exercising the deprecated legacy callback form.
    await runAudits(ctxWith(['homepage']), config, (completed: number, total: number) => {
      calls.push([completed, total]);
    });

    expect(calls).toHaveLength(3);
    expect(calls.at(-1)).toEqual([3, 3]);
    let prev = 0;
    for (const [completed] of calls) {
      expect(completed).toBeGreaterThan(prev);
      prev = completed;
    }
  });
});
