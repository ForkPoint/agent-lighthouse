import type { CheckContext } from "../check-context";
import type { AuditResult } from "../types";
import { unreachableContext } from "./fixtures";

/**
 * Contract test: on a site the scan could not read, an audit must decline.
 *
 * Narrower than `unreachable-contract.test.ts`, which proves the runner never
 * constructs the audit at all. This proves the audit itself declines when
 * called directly, which is what an audit's own unit test can check.
 *
 * The fixture is `unreachableContext`. The version this replaced handed out
 * `allEvidenceMet()` alongside zero pages, so an audit was asserted against a
 * scan claiming to have read four page types it had never fetched.
 */
export async function expectNotApplicableOnEmpty(audit: {
  audit(ctx: CheckContext): AuditResult | Promise<AuditResult>;
}): Promise<void> {
  const result = await audit.audit(unreachableContext());
  if (result.status !== "na") {
    throw new Error(
      `Expected notApplicable on a scan that read nothing, got "${result.status}" — a vacuous pass or a verdict here describes the scanner, not the site.`,
    );
  }
}
