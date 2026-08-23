import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { crossCheck } from './cross-check';
import { auditDataList, auditList, categoryList } from './registry';
import type { AuditDataRecord } from './registry';

describe('crossCheck', () => {
  it('passes when both sides carry the same ids', () => {
    expect(() => crossCheck(['a/b'], ['a/b'])).not.toThrow();
  });

  it('names an audit that has no dossier', () => {
    expect(() => crossCheck(['a/b', 'a/c'], ['a/b'])).toThrow(/a\/c/);
  });

  it('names a dossier that has no audit', () => {
    expect(() => crossCheck(['a/b'], ['a/b', 'a/orphan'])).toThrow(/a\/orphan/);
  });
});

describe('registry', () => {
  it('reads the live registry rather than a snapshot', () => {
    const audits = auditList();
    expect(audits.length).toBeGreaterThan(200);
    const one = audits.find((a) => a.id === 'agentic-commerce/offer-truth-consistency');
    expect(one?.evidenceGrade).toBe('B');
    expect(one?.tier).toBe('scored');
  });

  it('groups every audit under a known category', () => {
    const categories = new Set(categoryList().map((c) => c.id));
    for (const audit of auditList()) expect(categories.has(audit.category), audit.id).toBe(true);
  });
});

/**
 * The v1 site shipped `packages/website/audits-data.json` as a checked-in file and
 * the explorer fetched it; the Astro build now generates that path from the live
 * registry. This block pins the promise that nothing fetching it breaks: every key
 * the old record carried is still there, with the same values. Task 12 deletes the
 * checked-in file, and this block retires with it.
 */
describe('audits-data.json compatibility', () => {
  const LEGACY: AuditDataRecord[] = JSON.parse(
    readFileSync(resolve(__dirname, '../../audits-data.json'), 'utf8'),
  );

  it('publishes the audits in the order the legacy file used', () => {
    expect(auditDataList().map((audit) => audit.id)).toEqual(LEGACY.map((audit) => audit.id));
  });

  it('carries every key of the legacy record, with the same values', () => {
    const generated = new Map(auditDataList().map((audit) => [audit.id, audit]));
    for (const legacy of LEGACY) {
      const audit = generated.get(legacy.id);
      expect(audit, `${legacy.id} is missing from the generated file`).toBeDefined();
      for (const [key, value] of Object.entries(legacy)) {
        expect(audit![key as keyof AuditDataRecord], `${legacy.id}.${key}`).toEqual(value);
      }
    }
  });
});
