import type { AuditMeta, AuditResult, CheckResult, CheckPriority } from './types';
import { AuditResultSchema } from './schemas';
import type { CheckContext } from './check-context';

/**
 * Base class for all audits. Follows the Lighthouse pattern:
 * each audit is a class with a static `meta` descriptor and
 * an `audit()` method that receives the scan context.
 */
export abstract class Audit {
  static meta: AuditMeta;
  private static readonly PRIORITY_MAP: Record<string, CheckPriority> = {
    critical: 'critical',
    high: 'high',
    medium: 'medium',
    low: 'low',
  };

  /** Validate an audit result against the schema. */
  protected validate(result: AuditResult): AuditResult {
    if (result.found && result.found.length > 5000) {
      result.found = result.found.slice(0, 4990) + '... (truncated)';
    }
    if (result.expected && result.expected.length > 5000) {
      result.expected = result.expected.slice(0, 4990) + '... (truncated)';
    }
    return AuditResultSchema.parse(result);
  }

  /** Run the audit and return a result. */
  abstract audit(ctx: CheckContext): AuditResult | Promise<AuditResult>;

  /** Create a passing result. */
  protected pass(message: string, expected: string, found: string, pageUrl?: string): AuditResult {
    return { status: 'pass', score: 1.0, message, expected, found, pageUrl };
  }

  /**
   * Create a not-applicable result. Use when the audit's precondition is
   * absent (e.g. a quality check on a feature the site doesn't implement at
   * all). Excluded from score aggregation so it neither inflates nor deflates
   * the category score — unlike a vacuous `pass()`, which rewards absence.
   */
  protected notApplicable(message: string, expected: string, found: string, pageUrl?: string): AuditResult {
    return { status: 'na', score: 0, message, expected, found, pageUrl };
  }

  /** Create a warning result. */
  protected warn(
    message: string,
    expected: string,
    found: string,
    recommendationOrPriority?:
      | { priority: CheckPriority; [key: string]: unknown }
      | string,
    pageUrl?: string,
  ): AuditResult {
    const priority =
      typeof recommendationOrPriority === 'string'
        ? recommendationOrPriority
        : (recommendationOrPriority as { priority: CheckPriority })?.priority;

    return {
      status: 'warn',
      score: 0.5,
      message,
      expected,
      found,
      priority:
        (typeof priority === 'string' ? Audit.PRIORITY_MAP[priority] : undefined) ??
        (priority as CheckPriority),
      pageUrl,
    };
  }

  /** Create a failing result. */
  protected fail(
    message: string,
    expected: string,
    found: string,
    recommendationOrPriority?:
      | { priority: CheckPriority; [key: string]: unknown }
      | string,
    pageUrl?: string,
  ): AuditResult {
    const priority =
      typeof recommendationOrPriority === 'string'
        ? recommendationOrPriority
        : (recommendationOrPriority as { priority: CheckPriority })?.priority;

    return {
      status: 'fail',
      score: 0.0,
      message,
      expected,
      found,
      priority:
        (typeof priority === 'string' ? Audit.PRIORITY_MAP[priority] : undefined) ??
        (priority as CheckPriority),
      pageUrl,
    };
  }

  /** Merge static meta with the runtime result to produce a CheckResult. */
  toCheckResult(rawResult: AuditResult): CheckResult {
    const result = this.validate(rawResult);
    const meta = (this.constructor as typeof Audit).meta;

    // Backward compatibility mapping
    const displayValue = result.displayValue ?? result.found ?? result.message;
    const explanation = result.explanation ?? result.message;
    const expected = result.details?.expected ?? result.expected;
    const found = result.details?.found ?? result.found;

    return {
      id: meta.id,
      category: meta.category,
      title: result.status === 'pass' ? meta.title : meta.failureTitle,
      description: meta.description,
      status: result.status,
      score: result.score,
      // Single source of truth for a check's evidence weight: stamped here, at
      // the one place a CheckResult is built from its meta.
      weight: meta.weight,
      scoreDisplayMode: meta.scoreDisplayMode,
      displayValue,
      explanation,
      pageUrl: result.pageUrl,

      // UCP guidance extensions
      priority: result.priority ?? meta.defaultPriority,
      impact: meta.guidance?.impact ?? meta.description,
      fix: meta.guidance?.fix ?? 'No fix instructions available.',

      // Structured details
      details: {
        ...result.details,
        expected,
        found,
        code: result.details?.code ?? meta.guidance?.code,
        docsUrl: meta.guidance?.docsUrl,
        effort: meta.guidance?.effort,
      },
      tags: meta.guidance?.tags,
      deprecated: meta.deprecated,

      // v2 taxonomy provenance, carried alongside the weight it justifies.
      evidenceGrade: meta.evidenceGrade,
      tier: meta.tier,
    };
  }
}
