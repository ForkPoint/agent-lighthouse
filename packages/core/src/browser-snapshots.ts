import type {
  BrowserAssessment,
  BrowserSnapshot,
  BrowserSnapshots,
} from "./contracts";
import {
  DOM_WORK_LIMITS,
  DocumentState,
  EvidenceSource,
  ScoreDisplayMode,
  TAG_SCAN_ERROR,
  TAG_SKIPPED_NO_EVIDENCE,
  TAG_SKIPPED_PAGE_TYPE,
  TAG_SKIPPED_SCAN_BUDGET,
} from "./contracts";
import type { ScanConfig } from "./audit-config";
import type { CheckContext, PageContext } from "./check-context";
import type { ScanOptions } from "./orchestrator";
import { runAudits } from "./audit-runner";
import { DomWorkLimitError } from "./dom-work";
import { parsePageContext } from "./page-context";
import { buildSnapshotEvidence } from "./scan-evidence";
import { BrowserAssessmentSchema, snapshotUrlKey } from "./schemas";
import {
  SNAPSHOT_AUDITS,
  SNAPSHOT_EVIDENCE_LIMITS,
  isSnapshotAudit,
} from "./snapshot-eligibility";

const SERVER_RENDERED = "content-extraction/server-rendered";

/**
 * Shared runner, isolated input. Snapshot evidence cannot initiate network requests.
 * A failure in one capture becomes missing evidence for that capture only: other
 * captures keep their findings, and the crawler report is never discarded. Only
 * cancellation propagates.
 */
export async function assessBrowserSnapshots(
  input: BrowserSnapshots,
  config: ScanConfig,
  options: ScanOptions,
  signal?: AbortSignal,
): Promise<BrowserAssessment> {
  const registrations = config.categories.flatMap(
    (cat) => config.audits[cat.id] ?? [],
  );
  const eligibleAuditIds = registrations
    .filter((reg) => isSnapshotAudit(reg.meta.id))
    .map((reg) => reg.meta.id)
    .sort();
  const ineligibleIds = registrations
    .map((reg) => reg.meta.id)
    .filter((id) => !isSnapshotAudit(id))
    .sort();
  const notEligible: BrowserAssessment["notEligible"] = [
    {
      auditIds: ineligibleIds.filter((id) => id === SERVER_RENDERED),
      reason:
        "Requires the original HTTP response body. Rendered DOM cannot prove server rendering.",
    },
    {
      auditIds: ineligibleIds.filter((id) => id !== SERVER_RENDERED),
      reason:
        "Not reviewed for snapshot evidence. The original HTTP/network/execution evidence contract remains required.",
    },
  ].filter((group) => group.auditIds.length > 0);
  const result = emptyAssessment(input, eligibleAuditIds, notEligible);
  // Running only eligible audits keeps planAudits from stubbing ~200 others per capture;
  // planAudits still refuses any ineligible audit a direct caller passes in.
  const browserConfig: ScanConfig = {
    ...config,
    audits: Object.fromEntries(
      Object.entries(config.audits).map(([id, audits]) => [
        id,
        audits.filter((reg) => isSnapshotAudit(reg.meta.id)),
      ]),
    ),
  };
  for (const snapshot of input.pages) {
    signal?.throwIfAborted();
    try {
      const capture = await assessCapture(
        snapshot,
        browserConfig,
        options,
        eligibleAuditIds,
        signal,
      );
      result.findings.push(...capture.findings);
      result.missingEvidence.push(...capture.missingEvidence);
      result.coverage.assessed += capture.findings.length;
    } catch (error) {
      if (signal?.aborted) throw error;
      const message = error instanceof Error ? error.message : String(error);
      // A work limit is a stated scanner bound, not a failure of the capture.
      const reason =
        error instanceof DomWorkLimitError
          ? message
          : `Snapshot assessment failed: ${message}`;
      for (const auditId of eligibleAuditIds)
        result.missingEvidence.push({
          auditId,
          pageUrl: snapshot.requestedUrl,
          reason: reason.slice(0, 5000),
        });
    }
  }
  return BrowserAssessmentSchema.parse(result) as BrowserAssessment;
}

function emptyAssessment(
  input: BrowserSnapshots,
  eligibleAuditIds: string[],
  notEligible: BrowserAssessment["notEligible"],
): BrowserAssessment {
  return {
    version: 1,
    evidenceSource: EvidenceSource.BrowserSnapshot,
    score: null,
    unscoredReason:
      "Browser snapshots provide a reviewed subset of static DOM evidence. No calibrated browser scoring population or denominator exists. Findings and coverage are unscored.",
    captures: input.pages.map(({ html: _html, ...capture }) => capture),
    findings: [],
    coverage: {
      eligibleAuditIds,
      eligible: eligibleAuditIds.length * input.pages.length,
      assessed: 0,
    },
    missingEvidence: [],
    notEligible,
    limits: [...SNAPSHOT_EVIDENCE_LIMITS],
  };
}

type CaptureResult = Pick<BrowserAssessment, "findings" | "missingEvidence">;

/** One capture, validated on its own so a bad value fails only this capture. */
async function assessCapture(
  snapshot: BrowserSnapshot,
  browserConfig: ScanConfig,
  options: ScanOptions,
  eligibleAuditIds: string[],
  signal?: AbortSignal,
): Promise<CaptureResult> {
  const result: CaptureResult = { findings: [], missingEvidence: [] };
  const { html } = snapshot;
  const pageUrl = snapshot.requestedUrl;
  const incomplete = snapshot.truncation.truncated
    ? "The snapshot is truncated. Missing DOM cannot prove absence."
    : snapshot.redaction.redacted
      ? "The snapshot is redacted. Removed DOM cannot prove absence."
      : snapshot.documentState === DocumentState.Loading
        ? "The document was still loading at capture time."
        : undefined;
  if (incomplete) {
    for (const auditId of eligibleAuditIds)
      result.missingEvidence.push({ auditId, pageUrl, reason: incomplete });
    return result;
  }
  const forcedType = options.pages?.find(
    (page) => snapshotUrlKey(page.url) === snapshotUrlKey(pageUrl),
  )?.pageType;
  const parsed = parsePageContext(
    pageUrl,
    html,
    forcedType,
    DOM_WORK_LIMITS.snapshotAncestorSteps,
  );
  const page: PageContext = {
    ...parsed,
    evidenceSource: EvidenceSource.BrowserSnapshot,
    // Keep the audit context API compatible, but fail closed on HTTP reads.
    // No response status, headers, timings, or body are fabricated.
    get fetchResult(): never {
      throw new Error(
        "HTTP response evidence is unavailable for a browser snapshot",
      );
    },
  };
  const ctx: CheckContext = {
    evidenceSource: EvidenceSource.BrowserSnapshot,
    pages: [page],
    rootFiles: {},
    domain: new URL(pageUrl).hostname,
    baseUrl: new URL(pageUrl).origin,
    targetUrl: pageUrl,
    evidence: buildSnapshotEvidence([page]),
    // A distinct owner per capture keeps gatherer state out of HTTP and other captures.
    cacheOwner: {},
    fetch: () => {
      throw new Error(
        "Network evidence is unavailable in snapshot-only assessment",
      );
    },
  };
  const assessed = await runAudits(ctx, browserConfig);
  signal?.throwIfAborted();
  for (const check of assessed.checks) {
    if (
      check.tags?.some((tag) =>
        [
          TAG_SCAN_ERROR,
          TAG_SKIPPED_NO_EVIDENCE,
          TAG_SKIPPED_PAGE_TYPE,
          TAG_SKIPPED_SCAN_BUDGET,
        ].includes(tag),
      )
    ) {
      result.missingEvidence.push({
        auditId: check.id,
        pageUrl,
        reason: check.explanation || "Required evidence is unavailable.",
      });
      continue;
    }
    result.findings.push({
      evidenceSource: EvidenceSource.BrowserSnapshot,
      pageUrl,
      captureSource: snapshot.captureSource,
      // Keep the original audit verdict and guidance, but never present its weight as browser scoring.
      check: {
        ...check,
        pageUrl,
        scoreDisplayMode: ScoreDisplayMode.Informative,
        weight: 0,
        description: SNAPSHOT_AUDITS[check.id]!.evidence,
      },
    });
  }
  return {
    findings: BrowserAssessmentSchema.shape.findings.parse(result.findings),
    missingEvidence: BrowserAssessmentSchema.shape.missingEvidence.parse(
      result.missingEvidence,
    ),
  } as CaptureResult;
}
