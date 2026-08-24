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
  it('leaves no docsUrl pointing at a dossier blob URL', () => {
    for (const registrations of Object.values(defaultConfig.audits)) {
      for (const reg of registrations) {
        expect(reg.meta.guidance?.docsUrl ?? '', reg.meta.id).not.toContain('blob/main/docs/evidence/audits');
      }
    }
  });
});
