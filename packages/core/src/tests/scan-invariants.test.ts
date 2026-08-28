import { describe, it, expect } from 'vitest';
import { invariantViolations, READS_RENDERED_BODY } from './scan-invariants';
import { TAG_SCAN_ERROR, TAG_SKIPPED_NO_EVIDENCE } from '../constants';
import type { CheckResult, CheckStatus, EvidenceKey, ScanReport, ScanValidity } from '../types';

/**
 * The rules the nightly corpus job asserts, exercised on synthetic reports.
 *
 * Every rule is proved twice: once firing on a report that breaks it, once
 * silent on one that does not. A rule no test can make fire is not a rule —
 * five of the seven restate an identity production computes, and the only way
 * to know they still say something is to hand them a report that violates it.
 *
 * The reports are built by hand rather than scanned. The job's whole point is
 * that it needs no ground truth, so neither does this.
 */

function check(overrides: Partial<CheckResult> & { id: string }): CheckResult {
  return {
    category: 'content-extraction',
    title: 'A check',
    description: 'A synthetic check.',
    status: 'pass' as CheckStatus,
    score: 1,
    weight: 1,
    scoreDisplayMode: 'binary',
    priority: 'medium',
    impact: 'Some impact.',
    fix: 'Some fix.',
    ...overrides,
  };
}

const ALL_MET: Record<EvidenceKey, boolean> = {
  'origin-reachable': true,
  'unblocked-fetches': true,
  'rendered-body': true,
  'sample-adequate': true,
};

function validity(overrides: Partial<ScanValidity> = {}): ScanValidity {
  return { judgeable: true, evidence: { ...ALL_MET }, reasons: {}, ...overrides };
}

/** A report that breaks nothing, so a test can change one thing at a time. */
function report(overrides: Partial<ScanReport> = {}): ScanReport {
  return {
    scanId: 'synthetic',
    url: 'https://example.com',
    domain: 'example.com',
    overallScore: 60,
    scoreTier: 'partially-ready',
    scanValidity: validity(),
    categories: [],
    topPasses: [],
    topFails: [],
    recommendations: [],
    pagesScanned: [],
    scannedAt: '2026-08-28T00:00:00.000Z',
    durationMs: 1,
    ...overrides,
  };
}

/** An audit that declares `rendered-body`, taken from the registry. */
const BODY_READER = [...READS_RENDERED_BODY][0]!;

describe('scan invariants', () => {
  it('reads body-reading audits from the registry', () => {
    expect(READS_RENDERED_BODY.size).toBeGreaterThan(20);
  });

  it('says nothing about a self-consistent scored report', () => {
    expect(invariantViolations(report(), [check({ id: 'a/b' })])).toEqual([]);
  });

  it('reports a report with no scanValidity', () => {
    expect(invariantViolations(report({ scanValidity: undefined }), [])).toEqual([
      'the report carried no scanValidity',
    ]);
  });

  describe('rule 1 — no audit threw', () => {
    it('fires on a check carrying the scan-error tag', () => {
      const violations = invariantViolations(report(), [
        check({ id: 'a/threw', status: 'na', score: 0, tags: [TAG_SCAN_ERROR] }),
      ]);
      expect(violations).toEqual(['1 audit(s) threw, e.g. a/threw']);
    });

    it('stays quiet when the tag is another one', () => {
      expect(
        invariantViolations(report(), [check({ id: 'a/b', tags: ['some-other-tag'] })]),
      ).toEqual([]);
    });
  });

  describe('rule 2 — every check parses through the schema', () => {
    it('fires on a details value the schema rejects', () => {
      // An array of objects is the shape that throws in `toCheckResult`, which
      // a unit test calling `audit.audit(ctx)` never reaches.
      const bad = check({ id: 'a/bad' });
      bad.details = { rows: [{ nested: true }] } as CheckResult['details'];
      expect(invariantViolations(report(), [bad])).toEqual([
        '1 check(s) rejected by CheckResultSchema, e.g. a/bad',
      ]);
    });

    it('stays quiet on details of scalars and string arrays', () => {
      const ok = check({ id: 'a/ok', details: { found: 'x', count: 2, names: ['a', 'b'] } });
      expect(invariantViolations(report(), [ok])).toEqual([]);
    });
  });

  describe('rule 3 — nothing obtained forbids every pass', () => {
    const unreachable = report({
      overallScore: null,
      scoreTier: null,
      scanValidity: validity({
        judgeable: false,
        evidence: { ...ALL_MET, 'origin-reachable': false },
        unscoredReason: 'The scan never reached the site.',
      }),
    });

    it('fires on any pass', () => {
      expect(invariantViolations(unreachable, [check({ id: 'a/passed' })])).toEqual([
        'origin unreachable but 1 check(s) passed, e.g. a/passed',
      ]);
    });

    it('stays quiet when every check declined', () => {
      expect(
        invariantViolations(unreachable, [check({ id: 'a/na', status: 'na', score: 0 })]),
      ).toEqual([]);
    });
  });

  describe('rule 4 — a shell forbids a pass only from a body-reading audit', () => {
    const shell = report({
      scanValidity: validity({ evidence: { ...ALL_MET, 'rendered-body': false } }),
    });

    it('fires on a pass from an audit declaring rendered-body', () => {
      expect(invariantViolations(shell, [check({ id: BODY_READER })])).toEqual([
        `no page rendered text but 1 body-reading check(s) passed, e.g. ${BODY_READER}`,
      ]);
    });

    it('stays quiet on a pass from an audit that never needed the body', () => {
      // The split rules 3 and 4 make: on a shell the root files really were
      // fetched, so a robots-based audit passing is correct. Merging the two
      // rules would fail every client-rendered site in the list.
      expect(invariantViolations(shell, [check({ id: 'access-crawl-control/robots-txt' })])).toEqual(
        [],
      );
    });
  });

  describe('rule 5 — judgeable equals its own two evidence keys', () => {
    it('fires when the flag disagrees with the evidence map', () => {
      const lying = report({
        scanValidity: validity({ evidence: { ...ALL_MET, 'unblocked-fetches': false } }),
      });
      expect(invariantViolations(lying, [check({ id: 'a/b' })])).toEqual([
        'judgeable is true but the evidence says false',
      ]);
    });

    it('stays quiet when both keys are met', () => {
      expect(invariantViolations(report(), [check({ id: 'a/b' })])).toEqual([]);
    });
  });

  describe('rule 6 — the score is withheld exactly when the gate says so', () => {
    // Half the evidence mass gated, which is over GATED_MASS_UNSCORED_THRESHOLD.
    const halfGated = [
      check({ id: 'a/ran' }),
      check({ id: 'a/gated', status: 'na', score: 0, tags: [TAG_SKIPPED_NO_EVIDENCE] }),
    ];

    it('fires on a score the gated mass forbids', () => {
      expect(invariantViolations(report(), halfGated)).toEqual([
        'scored 60 on a scan that must be unscored (judgeable true, 50% of mass gated)',
      ]);
    });

    it('fires on a score withheld from a scan that earned one', () => {
      const withheld = report({
        overallScore: null,
        scoreTier: null,
        scanValidity: validity({ unscoredReason: 'no reason the evidence supports' }),
      });
      expect(invariantViolations(withheld, [check({ id: 'a/ran' })])).toEqual([
        'withheld a score from a judgeable scan with only 0% of mass gated',
      ]);
    });

    it('stays quiet when a heavily gated scan reports no score', () => {
      const unscored = report({
        overallScore: null,
        scoreTier: null,
        scanValidity: validity({ unscoredReason: 'The scan could not feed 50% of the mass.' }),
      });
      expect(invariantViolations(unscored, halfGated)).toEqual([]);
    });
  });

  describe('rule 7 — score, tier and unscoredReason move together', () => {
    it('fires on a score with no tier', () => {
      expect(invariantViolations(report({ scoreTier: null }), [check({ id: 'a/b' })])).toEqual([
        'score 60 but tier null',
      ]);
    });

    it('fires on a score carrying an unscoredReason', () => {
      const contradictory = report({
        scanValidity: validity({ unscoredReason: 'The scan obtained too little.' }),
      });
      expect(invariantViolations(contradictory, [check({ id: 'a/b' })])).toEqual([
        'score 60 but unscoredReason set',
      ]);
    });

    it('fires on a null score with no unscoredReason', () => {
      const silent = report({ overallScore: null, scoreTier: null });
      expect(invariantViolations(silent, [check({ id: 'a/b' })])).toEqual([
        'withheld a score from a judgeable scan with only 0% of mass gated',
        'score null but unscoredReason absent',
      ]);
    });

    it('stays quiet when all three agree', () => {
      const unscored = report({
        overallScore: null,
        scoreTier: null,
        scanValidity: validity({
          judgeable: false,
          evidence: { ...ALL_MET, 'origin-reachable': false },
          unscoredReason: 'The scan never reached the site.',
        }),
      });
      expect(invariantViolations(unscored, [check({ id: 'a/na', status: 'na', score: 0 })])).toEqual(
        [],
      );
    });
  });
});
