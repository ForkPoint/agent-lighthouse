import type { AuditMeta, AuditResult } from "../../../types";
import { Audit } from "../../../audit";
import type { CheckContext } from "../../../check-context";

// TODO: implement proposed audit "Behavior Annotation Coverage and Claim Consistency".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade C → informative tier. Implementation difficulty: llm-assisted.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/mcp-server-quality/behavior-annotation-coverage-and-claim-consistency.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// Phase 1 (deterministic, ships first): from tools/list, compute annotationCoverage = tools with a
// non-empty `annotations` object / total tools, and report the distribution of which annotation
// keys actually appear across the tool set. Report as an unscored informational metric with the
// caveat that the authoritative field list must be confirmed against the 2026-07-28 schema.ts
// before any threshold is attached. Phase 2 (LLM judge, gated on Phase 1 confirming the field
// names): for each tool, pass {name, title, description, inputSchema property names, annotations}
// to a judge with a strict rubric and require it to return a verdict plus the specific token it
// relied on. Flag only high-confidence contradictions: a tool whose name or description contains a
// mutating verb (delete, remove, cancel, refund, purchase, send, publish, revoke, transfer, charge)
// while annotations assert a read-only or non-destructive posture; or a tool that reaches an
// external network service while asserting a closed-world posture. Require two independent judge
// passes to agree before reporting, and always render the finding as 'review this claim' with the
// evidence quoted, never as an automatic failure — the scanner cannot execute the tool and so
// cannot prove the annotation false. Prerequisite before promoting to scoreable: fetch
// https://modelcontextprotocol.io/specification/2026-07-28/schema and locate the ToolAnnotations
// definition to confirm the exact field names and documented defaults in the current revision. If
// the defaults are unchanged from 2025-03-26 (readOnlyHint false, destructiveHint true,
// idempotentHint false, openWorldHint true), the coverage metric can be scored at grade B, since an
// absent annotation block then means the host's conservative default treats every tool as
// destructive.
export class BehaviorAnnotationCoverageAndClaimConsistencyAudit extends Audit {
  static override meta: AuditMeta = {
    id: "proposed/mcp-server-quality/behavior-annotation-coverage-and-claim-consistency",
    category: "mcp-server-quality",
    title: "Behavior Annotation Coverage and Claim Consistency",
    failureTitle: "Behavior Annotation Coverage and Claim Consistency",
    description:
      "Roadmap check. Measures what fraction of tools carry the behavior-hint annotations hosts use to decide whether to auto-approve a call, then uses an LLM judge to flag annotations that contradict the tool's own name and description (a tool named delete_* or refund_* asserting readOnlyHint: true).",
    scoreDisplayMode: "binary",
    weight: 0,
    defaultPriority: "medium",
    guidance: {
      impact:
        "Hosts that offer auto-approval, allowlisting, or 'safe tools only' modes gate on the annotation block; a tool with no annotations must be treated conservatively and therefore prompts the user on every invocation, which is precisely the friction that makes multi-step agent workflows unusable. The consistency half rests on the spec's own repeated warning that 'clients MUST consider tool annotations to be untrusted unless they come from trusted servers' — an annotation that contradicts the tool's stated behavior is exactly the signal that warning anticipates, and a first-party audit is the right place to catch an accidental one. Graded C deliberately: we verified that the 2026-07-28 tools page describes `annotations` as 'optional properties describing tool behavior' and carries the untrusted-annotations warning, but we could NOT retrieve the ToolAnnotations type definition or its per-field default values from the 2026-07-28 schema reference. Any check that scores against specific defaults (readOnlyHint, destructiveHint, idempotentHint, openWorldHint) must first confirm those field names and defaults against schema/2026-07-28/schema.ts. Until that is done this is unscoreable.",
      fix: "TODO: written when the audit is implemented.",
      effort: "moderate",
      docsUrl:
        "https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/mcp-server-quality/behavior-annotation-coverage-and-claim-consistency.md",
      tags: ["proposed", "mcp-server-quality"],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      "Proposed audit not implemented yet.",
      "Implementation per docs/evidence/proposals/mcp-server-quality/behavior-annotation-coverage-and-claim-consistency.md",
      "TODO stub",
    );
  }
}
