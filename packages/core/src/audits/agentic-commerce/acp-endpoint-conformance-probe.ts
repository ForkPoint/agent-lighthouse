import { Audit } from "#core/audit";
import type { CheckContext } from "#core/check-context";
import { gatherAcpSandbox } from "#core/gatherers/acp";
import { weightForGrade } from "#core/scorer";
import {
  AuditTier,
  CheckPriority,
  EvidenceGrade,
  EvidenceKey,
  FixEffort,
  ScoreDisplayMode,
  type AuditMeta,
  type AuditResult,
} from "#core/types";

export class AcpEndpointConformanceProbeAudit extends Audit {
  static override meta: AuditMeta = {
    id: "agentic-commerce/acp-endpoint-conformance-probe",
    category: "agentic-commerce",
    title: "ACP sandbox checkout conforms to the pinned contract",
    failureTitle: "ACP sandbox checkout has contract findings",
    description:
      "Explicitly authorized sandbox probe of ACP 2026-04-17 create, retrieve, idempotency and cancel behavior. Never completes payment.",
    scoreDisplayMode: ScoreDisplayMode.Informative,
    evidenceGrade: EvidenceGrade.A,
    tier: AuditTier.Informative,
    weight: weightForGrade(EvidenceGrade.A, AuditTier.Informative),
    defaultPriority: CheckPriority.Medium,
    requires: [EvidenceKey.OriginReachable, EvidenceKey.UnblockedFetches],
    dossier:
      "docs/evidence/audits/agentic-commerce/acp-endpoint-conformance-probe.md",
    guidance: {
      impact:
        "A checkout client needs valid session responses and stable idempotency behavior.",
      fix: "Use the ACP 2026-04-17 checkout schema and endpoint contract in an explicitly authorized sandbox.",
      effort: FixEffort.Moderate,
      docsUrl:
        "https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/tree/main/spec/2026-04-17",
      tags: ["acp", "checkout", "sandbox", "conformance"],
    },
  };
  async audit(ctx: CheckContext): Promise<AuditResult> {
    const probe = gatherAcpSandbox(ctx);
    if (!probe)
      return this.notApplicable(
        "No ACP sandbox probe configured.",
        "Explicit sandbox opt-in",
        "No sandbox configuration",
      );
    const result = await probe;
    const details = {
      apiVersion: "2026-04-17",
      validationPerformed: result.validationPerformed,
      recoveryKey: result.recoveryKey,
      complete: result.complete,
      incompleteReason: result.incompleteReason,
      incompleteOperation: result.incompleteOperation,
      cleanupReason: result.cleanupReason,
      cleanupCertain: result.cleanupCertain,
      unknownCreationOutcome: result.unknownCreationOutcome,
      completedFixtureTested: result.completedFixtureTested,
      findings: result.findings,
    };
    if (!result.complete)
      return {
        ...this.warn(
          `ACP sandbox evidence is incomplete during ${result.incompleteOperation || "probe"}: ${result.incompleteReason || "incomplete evidence"}. No merchant conformance verdict is available.`,
          "Complete sandbox evidence and confirmed cleanup",
          "Incomplete evidence",
        ),
        details,
      };
    if (result.findings.length)
      return {
        ...this.warn(
          "ACP sandbox probe found contract mismatches.",
          "Pinned ACP status and response contracts",
          `${result.findings.length} findings`,
        ),
        details,
      };
    return {
      ...this.pass(
        "The tested ACP sandbox operations conform to the pinned contract.",
        "Pinned ACP status and response contracts",
        "Tested operations conform; completion and payment remain untested",
      ),
      details,
    };
  }
}
