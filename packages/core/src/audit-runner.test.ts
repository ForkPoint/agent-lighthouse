import { describe, it, expect, vi } from 'vitest';
import type { AuditMeta, AuditResult, PageType } from './types';
import { logger } from './logger';
import { Audit } from './audit';
import type { CheckContext } from './check-context';
import type { ScanConfig, AuditRegistration } from './audit-config';
import { runAudits } from './audit-runner';
import { AuditResultSchema } from './schemas';
import type { AuditTrace } from './audit-trace';
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
          // reg.meta.id differs from the instance's static meta.id → the check is
          // stamped from the audit's own static meta (weight 1), not from reg.meta
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
    // checks: p1(pass,w2), w1(warn,w1), e1(pass,w1), mismatch(pass,w1)
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

  it('stamps meta.weight onto every produced check, real results and na stubs alike', async () => {
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => logger);

    const config: ScanConfig = {
      categories: [{ id: 'w', name: 'W', weight: 1 }],
      audits: {
        w: [
          // real audit path → stamped by Audit.toCheckResult
          makeReg(meta({ id: 'real', category: 'w', weight: 0.6 }), () => result('pass', 1)),
          // page-type skip → stamped by the stub built in planAudits
          makeReg(
            meta({ id: 'skip', category: 'w', weight: 0.4, applicablePageTypes: ['product'] }),
            () => result('pass', 1),
          ),
          // throwing audit → stamped by the stub built on the error path
          makeReg(meta({ id: 'boom', category: 'w', weight: 0.25 }), () => {
            throw new Error('boom');
          }),
        ],
      },
    };

    const out = await runAudits(ctxWith(['homepage']), config);
    const byId = new Map(out.checks.map((c) => [c.id, c]));

    expect(byId.get('real')!.weight).toBe(0.6);
    expect(byId.get('skip')!.weight).toBe(0.4);
    expect(byId.get('boom')!.weight).toBe(0.25);
    // Both stub kinds are still `na`, so their stamped weight stays out of the score.
    expect(byId.get('skip')!.status).toBe('na');
    expect(byId.get('boom')!.status).toBe('na');
    // Only `real` contributes: 1*0.6 / 0.6 → 100
    expect(out.categories[0].score).toBe(100);

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

  it('adding a weight-0 informative audit leaves the category score unchanged', async () => {
    const baseline: AuditRegistration[] = [
      makeReg(meta({ id: 'b1', category: 'cat', weight: 1 }), () => result('pass', 1)),
      makeReg(meta({ id: 'b2', category: 'cat', weight: 1 }), () => result('fail', 0)),
    ];
    const categories = [{ id: 'cat', name: 'Cat', weight: 1 }];

    const before = await runAudits(ctxWith(['homepage']), {
      categories,
      audits: { cat: baseline },
    });

    // A sunset (deprecated) audit: weight 0 + informative display mode. Its
    // failing check must not move the category score in either direction.
    const withInformative = await runAudits(ctxWith(['homepage']), {
      categories,
      audits: {
        cat: [
          ...baseline,
          makeReg(
            meta({ id: 'i1', category: 'cat', weight: 0, scoreDisplayMode: 'informative' }),
            () => result('fail', 0),
          ),
        ],
      },
    });

    expect(before.categories[0].score).toBe(50);
    expect(withInformative.categories[0].score).toBe(before.categories[0].score);
    expect(withInformative.overallScore).toBe(before.overallScore);
    // The informative check is still reported, just not scored.
    expect(withInformative.checks.map((c) => c.id)).toContain('i1');
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
});

describe('scan-error explanations', () => {
  /** Run one audit that fails the given way, and return its stub. */
  async function stubFor(fail: () => never) {
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
    const m = meta({ id: 'x1', category: 'cat1' });
    const config: ScanConfig = {
      categories: [{ id: 'cat1', name: 'Cat 1', weight: 1 }],
      audits: { cat1: [makeReg(m, fail)] },
    };
    const out = await runAudits(ctxWith(['homepage']), config);
    errorSpy.mockRestore();
    return out.checks.find((c) => c.id === 'x1')!;
  }

  it('carries a plain error message through', async () => {
    const stub = await stubFor(() => {
      throw new Error('Unknown pseudo-class :-tab-0');
    });
    expect(stub.tags).toContain('scan-error');
    expect(stub.explanation).toBe('Audit failed to run: Unknown pseudo-class :-tab-0');
  });

  // A Zod rejection stringifies to its whole issue tree — several hundred
  // lines of JSON for one bad field, written into every report the scan
  // produces. The path and the reason are the part that identifies the defect.
  it('reduces a schema rejection to its field paths', async () => {
    // `parse` is what throws here; the audit body never reaches a `throw` of
    // its own. That is exactly how the real failure happened — the audit
    // returned, and validation rejected the result.
    const stub = await stubFor(
      () => AuditResultSchema.parse({ status: 'pass', score: 1, details: { ghosts: [{}] } }) as never,
    );
    expect(stub.explanation).toContain('details.ghosts');
    expect(stub.explanation!.length).toBeLessThan(500);
    expect(stub.explanation).not.toContain('unionErrors');
  });

  it('names at most three fields, so one bad shape cannot fill the report', async () => {
    const stub = await stubFor(() => {
      throw {
        issues: Array.from({ length: 40 }, (_v, i) => ({
          path: ['details', 'items', i],
          message: 'Expected string, received object',
        })),
      };
    });
    expect(stub.explanation!.split('; ')).toHaveLength(3);
  });

  it('truncates a very long plain message rather than pasting it whole', async () => {
    const stub = await stubFor(() => {
      throw new Error('x'.repeat(5000));
    });
    expect(stub.explanation!.length).toBeLessThan(500);
    expect(stub.explanation!.endsWith('\u2026')).toBe(true);
  });

  it('handles a thrown non-Error', async () => {
    const stub = await stubFor((() => {
      throw 'just a string';
    }) as () => never);
    expect(stub.explanation).toBe('Audit failed to run: just a string');
  });
});

describe('audit tracing', () => {
  /** A config with one passing audit, one page-type skip and one that throws. */
  function tracingConfig(): ScanConfig {
    return {
      categories: [{ id: 'cat1', name: 'Cat 1', weight: 1 }],
      audits: {
        cat1: [
          makeReg(meta({ id: 'ok', category: 'cat1' }), () => result('pass', 1)),
          makeReg(meta({ id: 'skip', category: 'cat1', applicablePageTypes: ['product'] }), () =>
            result('pass', 1),
          ),
          makeReg(meta({ id: 'boom', category: 'cat1' }), () => {
            throw new Error('boom');
          }),
        ],
      },
    };
  }

  async function tracesOf() {
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
    const traces: AuditTrace[] = [];
    await runAudits(ctxWith(['homepage']), tracingConfig(), undefined, undefined, (t) =>
      traces.push(t),
    );
    errorSpy.mockRestore();
    return traces;
  }

  // Every registered audit, not only the ones that produced a verdict: an
  // audit missing from the trace is exactly the one worth seeing.
  it('emits one record per registered audit', async () => {
    const traces = await tracesOf();
    expect(traces.map((t) => t.id).sort()).toEqual(['boom', 'ok', 'skip']);
  });

  it('distinguishes ran, skipped and errored', async () => {
    const byId = new Map((await tracesOf()).map((t) => [t.id, t]));
    expect(byId.get('ok')?.outcome).toBe('ran');
    expect(byId.get('skip')?.outcome).toBe('skipped');
    expect(byId.get('boom')?.outcome).toBe('error');
  });

  it('explains why a skipped audit never ran', async () => {
    const byId = new Map((await tracesOf()).map((t) => [t.id, t]));
    expect(byId.get('skip')?.explanation).toContain('product');
    expect(byId.get('skip')?.durationMs).toBe(0);
  });

  it('carries the failure message on an errored audit', async () => {
    const byId = new Map((await tracesOf()).map((t) => [t.id, t]));
    expect(byId.get('boom')?.explanation).toContain('boom');
  });

  it('times an audit that ran', async () => {
    const byId = new Map((await tracesOf()).map((t) => [t.id, t]));
    expect(byId.get('ok')?.durationMs).toBeGreaterThanOrEqual(0);
  });

  // Building a record per audit is not free, so nothing is built when nobody
  // is listening and the logger is not at debug level.
  it('builds nothing when no handler is given and the logger is quiet', async () => {
    const debugSpy = vi.spyOn(logger, 'debug').mockImplementation(() => {});
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
    const previous = logger.level;
    logger.level = 'info';
    await runAudits(ctxWith(['homepage']), tracingConfig());
    logger.level = previous;
    errorSpy.mockRestore();
    expect(debugSpy).not.toHaveBeenCalled();
    debugSpy.mockRestore();
  });

  it('logs one debug line per audit when the level asks for it', async () => {
    const debugSpy = vi.spyOn(logger, 'debug').mockImplementation(() => {});
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
    const previous = logger.level;
    logger.level = 'debug';
    await runAudits(ctxWith(['homepage']), tracingConfig());
    logger.level = previous;
    errorSpy.mockRestore();
    const lines = debugSpy.mock.calls.map((c) => String(c[0]));
    expect(lines.filter((l) => l.startsWith('[audit] '))).toHaveLength(3);
    debugSpy.mockRestore();
  });
});
