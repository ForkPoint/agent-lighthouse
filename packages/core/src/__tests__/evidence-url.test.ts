import { describe, it, expect } from 'vitest';
import { evidenceUrl } from '../audit';
import { defaultConfig } from '../index';

describe('evidenceUrl', () => {
  it('derives the published page from the audit id', () => {
    expect(evidenceUrl('agentic-commerce/offer-truth-consistency')).toBe(
      'https://forkpoint.github.io/agent-lighthouse/audits/agentic-commerce/offer-truth-consistency/',
    );
  });

  it('gives every registered audit a URL that names its own id', () => {
    for (const registrations of Object.values(defaultConfig.audits)) {
      for (const reg of registrations) {
        expect(evidenceUrl(reg.meta.id), reg.meta.id).toContain(`/audits/${reg.meta.id}/`);
      }
    }
  });

  // A docsUrl pointing at raw markdown is a link a reader cannot read comfortably.
  // The substring stops at `docs/evidence` rather than `docs/evidence/audits` so it
  // also catches a proposal graduating into the registry with its `proposals/` blob
  // URL still attached.
  it('leaves no docsUrl pointing at a dossier blob URL', () => {
    for (const registrations of Object.values(defaultConfig.audits)) {
      for (const reg of registrations) {
        expect(reg.meta.guidance?.docsUrl ?? '', reg.meta.id).not.toContain('blob/main/docs/evidence');
      }
    }
  });

  /**
   * The pin the spec asks for: a docsUrl that points into the site's published
   * evidence pages must be *this* audit's page, not merely some page under
   * `/audits/` — which is all the tests above can tell. Without the
   * equality, renaming an audit's id leaves its guidance link pointing at
   * whatever used to live at the old address — a link that still resolves, so
   * nothing else in the suite notices.
   *
   * Only site-pointing values are pinned. The rest cite external
   * specifications (`schema.org`, RFCs, vendor docs); those are not derivable
   * from an id and are left alone.
   */
  it('pins every site-pointing docsUrl to that audit’s own evidence page', () => {
    const prefix = evidenceUrl('').replace(/\/$/, '');
    let pinned = 0;

    for (const registrations of Object.values(defaultConfig.audits)) {
      for (const reg of registrations) {
        const docsUrl = reg.meta.guidance?.docsUrl;
        if (!docsUrl?.startsWith(prefix)) continue;
        pinned += 1;
        expect(
          docsUrl,
          `${reg.meta.id}: docsUrl points at a published evidence page that is not its own`,
        ).toBe(evidenceUrl(reg.meta.id));
      }
    }

    // A guard on the guard: if the migration were reverted wholesale, every
    // docsUrl would stop matching the prefix and the loop above would assert
    // nothing at all.
    expect(pinned, 'no audit links its own evidence page any more').toBeGreaterThan(50);
  });
});

/**
 * `evidenceUrl` being correct is worthless if `toCheckResult` never stamps it.
 * These run real registered audits through the real conversion and assert the
 * field on the produced CheckResult, so deleting the stamping line fails here.
 */
describe('toCheckResult stamps the evidence URL', () => {
  const PASS = { status: 'pass', score: 1 } as const;

  it('carries the evidence URL for a named audit', () => {
    const registration = Object.values(defaultConfig.audits)
      .flat()
      .find((reg) => reg.meta.id === 'agentic-commerce/offer-truth-consistency');
    expect(registration, 'the fixture audit left the registry').toBeDefined();

    const check = registration!.create().toCheckResult({ ...PASS });

    expect(check.details?.evidenceUrl).toBe(
      'https://forkpoint.github.io/agent-lighthouse/audits/agentic-commerce/offer-truth-consistency/',
    );
  });

  it('carries it for every registered audit, derived from that audit\'s own id', () => {
    for (const registrations of Object.values(defaultConfig.audits)) {
      for (const reg of registrations) {
        const check = reg.create().toCheckResult({ ...PASS });
        expect(check.details?.evidenceUrl, reg.meta.id).toBe(evidenceUrl(reg.meta.id));
      }
    }
  });
});
