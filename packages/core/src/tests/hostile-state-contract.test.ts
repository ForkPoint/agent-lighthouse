import { describe, it, expect } from 'vitest';
import { defaultConfig } from '../audit-config';
import { planAudits } from '../audit-runner';
import { AuditResultSchema } from '../schemas';
import { NOTHING_OBTAINED, SHELL_STATE } from './hostile-states';
import { auditSources, readsPagesDirectly, SHELL_STANCE } from './audit-sources';
import type { AuditResult } from '../types';

/**
 * A scan that obtained nothing holds no evidence about the site, so the runner
 * must not execute any audit. Every registration gets a `notApplicable` stub.
 *
 * This is registry-driven on purpose. Reading the registry covers every audit
 * whether or not anyone remembered to write an audit-level empty-input test.
 */

/**
 * Audits that may pass with nothing fetched, because they judge the request
 * rather than any response. Empty by design — `https-enabled` was the obvious
 * candidate and it already requires a 200 homepage before it passes. An entry
 * needs a one-line reason. If this grows past a handful, the rule is wrong.
 */
const VACUOUS_PASS_ALLOWLIST = new Map<string, string>();

const registrations = Object.values(defaultConfig.audits).flat();

describe('hostile-state contract — nothing obtained', () => {
  it('has audits to check', () => {
    expect(registrations.length).toBeGreaterThan(200);
  });

  // Build each state once. No audit mutates its context.
  const states = NOTHING_OBTAINED.map((state) => ({ state, ctx: state.build() }));

  for (const registration of registrations) {
    const { id } = registration.meta;

    it(`${id}: claims nothing when the scan read nothing`, () => {
      for (const { state, ctx } of states) {
        const plan = planAudits(ctx, defaultConfig);
        const result = plan.skipped.find((stub) => stub.id === id);
        expect(plan.runnable.map((entry) => entry.reg.meta.id), state.name).not.toContain(id);
        expect(result?.status, state.name).toBe('na');
        expect(result?.explanation, state.name).toMatch(/^Not assessed: /);
      }
    });
  }
});

/**
 * A shell is not an empty scan: a page arrived, it just carried no text. Root
 * files were fetched and read, so a robots-based audit passing here is
 * correct. Held to the rule: every audit that declares `rendered-body`, plus
 * every audit that searches a page's served HTML whatever it declares.
 */
describe('hostile-state contract — a shell page', () => {
  const ctx = SHELL_STATE.build();
  // Held to the rule: an audit that declares `rendered-body`, plus an audit
  // whose source searches a page's served HTML whatever it declares. The
  // second half is not redundant — `audit-sources.ts` says which two audits
  // fell through the first half and why.
  const sources = auditSources();
  // Every audit that reads the sampled pages and was let off `rendered-body`
  // by a `GATE_EXEMPTIONS` entry. Derived the way the build-time check derives
  // the requirement, so the set cannot drift from the exemptions themselves.
  const exempted = registrations.filter(
    (r) =>
      !(r.meta.requires ?? []).includes('rendered-body') &&
      readsPagesDirectly(sources.get(r.meta.id) ?? ''),
  );
  const readsRenderedBody = registrations.filter(
    (r) =>
      (r.meta.requires ?? []).includes('rendered-body') ||
      SHELL_STANCE.get(r.meta.id) === 'body',
  );

  it('has page-reading audits to check', () => {
    expect(readsRenderedBody.length).toBeGreaterThan(20);
  });

  it('makes every audit that dropped rendered-body say what a shell proves about it', () => {
    // A new exemption is unclassified until someone writes it down, and an
    // unclassified audit is one nothing asks about a shell. That is how
    // `third-party-dom-write-blast-radius` went unwatched: it dropped the key
    // on this branch and the old text filter never noticed.
    const unclassified = exempted.map((r) => r.meta.id).filter((id) => !SHELL_STANCE.has(id));
    expect(unclassified).toEqual([]);
    const stale = [...SHELL_STANCE.keys()].filter(
      (id) => !exempted.some((r) => r.meta.id === id),
    );
    expect(stale, 'an entry for an audit that no longer drops rendered-body').toEqual([]);
  });

  it('holds the audits that dropped rendered-body by exemption to the rule too', () => {
    // The regression this filter exists for. All three declare an exemption
    // that lets a shell reach them, and all three decide by reading the served
    // document: two shipped a weight-1.0 vacuous pass on every client-rendered
    // site, and the third grew its guard on this branch with nothing watching.
    const held = new Set(readsRenderedBody.map((r) => r.meta.id));
    expect(held.has('access-crawl-control/no-bot-detection')).toBe(true);
    expect(held.has('operability-safety/no-blocking-captcha')).toBe(true);
    expect(held.has('operability-safety/third-party-dom-write-blast-radius')).toBe(true);
  });

  for (const registration of readsRenderedBody) {
    const { id } = registration.meta;

    it(`${id}: claims nothing about a page that rendered no text`, async () => {
      let result: AuditResult;
      try {
        result = await registration.create().audit(ctx);
      } catch (err) {
        expect.fail(`threw instead of returning a result — ${String(err)}`);
      }

      expect(AuditResultSchema.safeParse(result).success).toBe(true);
      if (VACUOUS_PASS_ALLOWLIST.has(id)) return;
      expect(
        result.status,
        `passed a page that rendered no text — "${result.message}"`,
      ).not.toBe('pass');
    });
  }
});
