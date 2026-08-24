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
