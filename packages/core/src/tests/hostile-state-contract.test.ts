import { describe, it, expect } from 'vitest';
import { defaultConfig } from '../audit-config';
import { AuditResultSchema } from '../schemas';
import { NOTHING_OBTAINED } from './hostile-states';
import type { AuditResult } from '../types';

/**
 * A scan that obtained nothing holds no evidence about the site, so no audit
 * may congratulate it. `notApplicable` is right, and `fail` is right when the
 * missing response is itself the finding — `no-blocking-captcha` reports the
 * wall it met. Only `pass` is forbidden.
 *
 * This is registry-driven on purpose. `expectNotApplicableOnEmpty` says almost
 * the same thing and 73 of 222 audit test files call it, because calling it is
 * the author's job and the author forgets. Reading the registry covers every
 * audit whether or not anyone remembered.
 *
 * `operability-safety/no-blocking-captcha` shipped a vacuous pass here: it
 * looked for CAPTCHA markup in pages it never received, found none, and passed
 * the site that had just refused it.
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

    it(`${id}: claims nothing when the scan read nothing`, async () => {
      for (const { state, ctx } of states) {
        let result: AuditResult;
        try {
          result = await registration.create().audit(ctx);
        } catch (err) {
          expect.fail(`${state.name}: threw instead of returning a result — ${String(err)}`);
        }

        const parsed = AuditResultSchema.safeParse(result);
        if (!parsed.success) {
          const issues = parsed.error.issues
            .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
            .slice(0, 3)
            .join('; ');
          expect.fail(`${state.name}: result rejected by AuditResultSchema — ${issues}`);
        }

        if (VACUOUS_PASS_ALLOWLIST.has(id)) continue;
        if (result.status === 'pass') {
          expect.fail(
            `${state.name}: passed a site the scan never read — "${result.message}". ` +
              `Return notApplicable, or fail if the missing response is the finding.`,
          );
        }
      }
    });
  }
});
