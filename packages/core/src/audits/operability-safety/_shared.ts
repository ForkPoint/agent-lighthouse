/**
 * Shared plumbing for the operability-safety audits backed by our a11y rule
 * engine (see ./engine). Not an audit itself — every audit that uses this lives
 * in its own `operability-safety/<slug>.ts` file.
 *
 * Each of those audits wraps one or more a11y rules (run over jsdom in the
 * orchestrator and cached on each PageContext as `a11yResults`). We only adopt
 * rules that describe how an AI agent reads/acts on a page through the
 * accessibility tree — roles, programmatic names, ARIA relationships, document
 * structure. Human-perception rules (color contrast, focus visibility, target
 * size, reduced motion) are deliberately excluded: a non-human consumer can't
 * perceive them.
 *
 * Aggregation across the scanned pages, per audit:
 *   - any constituent rule FAILS on any page            → fail (with selectors)
 *   - else any rule is INCOMPLETE (needs review)         → warn
 *   - else any rule PASSES                               → pass
 *   - else every rule was INAPPLICABLE / unseen          → na (nothing to assess)
 */
import type {
  AuditMeta,
  AuditResult,
  AuditTier,
  EvidenceGrade,
  ScoreDisplayMode,
} from '../../types';
import { Audit } from '../../audit';
import type { CheckContext } from '../../check-context';
import { weightForGrade } from '../../scorer';
import type { A11yStatus } from './runner';

export interface A11yAuditSpec {
  meta: AuditMeta;
  /** a11y rule ids whose failure should fail this audit. */
  rules: string[];
}

/** Base class: aggregates this audit's a11y rules across all scanned pages. */
export abstract class A11yBackedAudit extends Audit {
  protected abstract rules: string[];

  audit(ctx: CheckContext): AuditResult {
    const meta = (this.constructor as typeof Audit).meta;
    const expected = `accessibility rules pass: ${this.rules.join(', ')}`;

    let sawFail = false;
    let sawIncomplete = false;
    let sawPass = false;
    const failings: string[] = [];
    let failPage: string | undefined;

    for (const p of ctx.pages) {
      const results = p.a11yResults;
      if (!results) continue;
      for (const ruleId of this.rules) {
        const r = results[ruleId];
        if (!r) continue;
        if (r.status === ('fail' as A11yStatus)) {
          sawFail = true;
          failPage ??= p.url;
          for (const n of r.nodes) {
            if (failings.length < 5) failings.push(n.target);
          }
        } else if (r.status === ('incomplete' as A11yStatus)) {
          sawIncomplete = true;
        } else if (r.status === ('pass' as A11yStatus)) {
          sawPass = true;
        }
      }
    }

    if (sawFail) {
      const found = `Failing element(s): ${failings.join('; ') || 'see report'}`;
      return this.fail(
        `${meta.failureTitle} — accessibility violations found.`,
        expected,
        found,
        { priority: meta.defaultPriority, description: meta.description, code: meta.guidance?.code },
        failPage,
      );
    }
    if (sawIncomplete && !sawPass) {
      return this.warn(
        `${meta.title} — accessibility checks could not fully determine; manual review advised.`,
        expected,
        'Incomplete (needs review)',
        meta.defaultPriority,
      );
    }
    if (sawPass) {
      return this.pass(`${meta.title} — accessibility checks pass.`, expected, 'No violations');
    }
    return this.notApplicable(
      `${meta.title} — no applicable elements on scanned pages.`,
      expected,
      'Not applicable',
    );
  }
}

/**
 * All a11y rule ids the adopted audits depend on (fed to the orchestrator).
 *
 * Populated as a side effect of each `defineA11yAudit` call, so it is only
 * complete once every audit module has been evaluated. Read it through
 * `operability-safety/index.ts`, which imports all of them.
 */
export const A11Y_RULES: string[] = [];

export function defineA11yAudit(spec: A11yAuditSpec): typeof Audit {
  /* v8 ignore next */
  for (const r of spec.rules) if (!A11Y_RULES.includes(r)) A11Y_RULES.push(r);
  return class extends A11yBackedAudit {
    static override meta = spec.meta;
    protected rules = spec.rules;
  } as unknown as typeof Audit;
}

// 7.22 (deprecated <marquee>/<blink> elements) was sunset — grade D, no
// consumer reads it. See docs/evidence/sunset/NOT-A-FACTOR.md#accessibilitymarquee.

export const base = {
  category: 'operability-safety' as const,
};

/**
 * Meta fields every audit here derives from its dossier's `evidence_grade`.
 * Grade A/B stay scored; C/D drop to informative, which means weight 0 — and
 * weight 0 must move in lockstep with `scoreDisplayMode: 'informative'`
 * (see audits/sunset.test.ts).
 */
export function graded(grade: EvidenceGrade, slug: string) {
  const tier: AuditTier = grade === 'A' || grade === 'B' ? 'scored' : 'informative';
  return {
    scoreDisplayMode: (tier === 'scored' ? 'binary' : 'informative') as ScoreDisplayMode,
    weight: weightForGrade(grade, tier),
    evidenceGrade: grade,
    tier,
    dossier: `docs/evidence/audits/operability-safety/${slug}.md`,
  };
}
