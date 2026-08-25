import { describe, it, expect } from 'vitest';
import { StatefulControlIntrospectabilityAudit } from './stateful-control-introspectability';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';
import { expectNotApplicableOnEmpty } from '../../tests/na-contract';
import type { CheckContext } from '../../check-context';
import { AuditResultSchema } from '../../schemas';

/** A homepage carrying `body`. */
function page(body: string): CheckContext {
  return mockCheckContext([
    mockPageContext('https://example.com/', `<html><head></head><body>${body}</body></html>`),
  ]);
}

describe('StatefulControlIntrospectabilityAudit', () => {
  const audit = new StatefulControlIntrospectabilityAudit();

  it('is notApplicable on an empty site', async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it('accepts a switch that publishes aria-checked', async () => {
    const result = await audit.audit(page('<div role="switch" aria-checked="false">Share data</div>'));
    expect(result.status).toBe('pass');
    expect(result.details?.['opaqueCount']).toBe(0);
  });

  it('flags a switch with no aria-checked and names the missing attribute', async () => {
    const result = await audit.audit(page('<div role="switch">Share data</div>'));
    expect(result.details?.['opaqueCount']).toBe(1);
    expect(result.message).toContain('aria-checked');
  });

  // The class is the remediation target, so it must survive into the report.
  it('flags a state class with no ARIA state and quotes the class', async () => {
    const result = await audit.audit(page('<button class="tab is-active">Overview</button>'));
    expect(result.details?.['opaqueCount']).toBe(1);
    expect(result.found).toContain('is-active');
  });

  it('accepts the same button once aria-pressed is present', async () => {
    const result = await audit.audit(
      page('<button class="tab is-active" aria-pressed="true">Overview</button>'),
    );
    expect(result.status).toBe('pass');
    expect(result.details?.['opaqueCount']).toBe(0);
  });

  it('flags a disclosure trigger that has aria-controls but no aria-expanded', async () => {
    const result = await audit.audit(
      page('<button id="t" aria-controls="p">More</button><div id="p">Panel</div>'),
    );
    expect(result.details?.['opaqueCount']).toBe(1);
    expect(result.message).toContain('aria-expanded');
  });

  it('treats details/summary as introspectable and raises no finding', async () => {
    const result = await audit.audit(page('<details><summary>More</summary><p>Panel</p></details>'));
    expect(result.status).toBe('pass');
    expect(result.details?.['opaqueCount']).toBe(0);
    expect(result.details?.['introspectableCount']).toBe(1);
  });

  it('flags a sortable table header with no aria-sort', async () => {
    const result = await audit.audit(
      page('<table><thead><tr><th class="sortable"><button>Price</button></th></tr></thead></table>'),
    );
    expect(result.details?.['opaqueCount']).toBe(1);
    expect(result.message).toContain('aria-sort');
  });

  it('scores 1 - opaque/(opaque+introspectable) on a mixed page', async () => {
    // 3 introspectable, 1 opaque -> ratio 0.75.
    const result = await audit.audit(
      page(
        [
          '<div role="switch" aria-checked="true">A</div>',
          '<div role="tab" aria-selected="false">B</div>',
          '<button class="chip is-selected" aria-pressed="true">C</button>',
          '<button class="chip is-selected">D</button>',
        ].join(''),
      ),
    );
    expect(result.details?.['opaqueCount']).toBe(1);
    expect(result.details?.['introspectableCount']).toBe(3);
    expect(result.details?.['ratio']).toBe(0.75);
    expect(result.found).toContain('0.75');
  });

  it('is notApplicable when the page carries no state-bearing control', async () => {
    const result = await audit.audit(page('<p>Just prose.</p><a href="/x">Link</a>'));
    expect(result.status).toBe('na');
  });

  // Regression for #15: `details.opaque` held Finding objects, which
  // AuditResultSchema rejects, so the audit threw on every page that had a
  // state-bearing control and the runner reported an error instead of a result.
  it('returns details the result schema accepts', async () => {
    const result = await audit.audit(page('<div role="switch">Share data</div>'));
    expect(() => AuditResultSchema.parse(result)).not.toThrow();
    expect(result.details?.['opaque']).toEqual([
      'https://example.com/ — aria-checked: <div role="switch">',
    ]);
  });

  it('registers as a scored grade-B audit', () => {
    const { meta } = StatefulControlIntrospectabilityAudit;
    expect(meta.evidenceGrade).toBe('B');
    expect(meta.tier).toBe('scored');
    expect(meta.weight).toBeCloseTo(0.6);
    expect(meta.scoreDisplayMode).toBe('ternary');
  });
});
