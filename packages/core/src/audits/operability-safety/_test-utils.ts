/**
 * Test helpers shared by the colocated tests of the engine-backed
 * operability-safety audits. Not shipped logic — imported only from *.test.ts.
 */
import { mockPageContext } from '../../__tests__/test-utils';
import type { Audit } from '../../audit';
import type { CheckContext, PageContext } from '../../check-context';
import type { AuditResult } from '../../types';
import type { A11yPageResult } from './runner';

/**
 * The engine-backed audits are generated classes typed as `typeof Audit`
 * (abstract); construct them the same way the registry does. They run
 * synchronously, so cast the result off the `AuditResult | Promise<AuditResult>`
 * union.
 */
export function runA11yAudit(AuditClass: unknown, ctx: CheckContext): AuditResult {
  return new (AuditClass as new () => Audit)().audit(ctx) as AuditResult;
}

/**
 * A page carrying synthetic `a11yResults` — the shape the orchestrator caches
 * after running the rule engine. Real rule execution is covered by
 * runner.test.ts; these tests exercise the per-audit aggregation.
 */
export function pageWithA11y(url: string, a11yResults: A11yPageResult): PageContext {
  const p = mockPageContext(url, '<!doctype html><html><body></body></html>');
  p.a11yResults = a11yResults;
  return p;
}
