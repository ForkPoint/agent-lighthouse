import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "Tool Self-Description Coverage".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade B → scored tier. Implementation difficulty: static-fetch.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/mcp-server-quality/tool-self-description-coverage.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// From the same tools/list fetch used by the contract-validity check, plus the DiscoverResult,
// compute: - toolDescriptionCoverage = tools with a non-empty trimmed `description` / total tools.
// Threshold: 100% to pass; additionally flag descriptions under 40 characters as stubs and report
// the count separately. - paramDescriptionCoverage = across all tools, walk inputSchema recursively
// through `properties` (and into `items.properties` for arrays of objects); count leaf parameters
// with a non-empty `description` over total leaf parameters. Threshold: >= 90%. -
// requiredParamDescriptionCoverage: same metric restricted to parameters named in `required`.
// Threshold: 100% — an undocumented required parameter is an unavoidable guess on every call. -
// constrainedStringRatio = string-typed parameters carrying `enum`, `format`, or `pattern` / total
// string parameters. Report as an advisory signal, not a pass/fail gate. - outputSchemaCoverage =
// tools with an `outputSchema` / total tools. Report; threshold advisory. - titleCoverage = tools
// with a `title` distinct from `name` / total tools (drives human-facing consent UI). -
// serverInstructions: assert DiscoverResult.instructions is present and non-empty; report its
// length. Emit each ratio alongside the specific offending tool/parameter paths (e.g.
// `create_invoice.line_items[].tax_code`) so the finding is directly actionable.
export class ToolSelfDescriptionCoverageAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/mcp-server-quality/tool-self-description-coverage',
    category: 'mcp-server-quality',
    title: "Tool Self-Description Coverage",
    failureTitle: "Tool Self-Description Coverage",
    description: "Deterministic coverage metrics over the tool surface: what fraction of tools carry a description, what fraction of every input parameter (walked recursively through properties) carries a description, what fraction declare an outputSchema and a title, and whether the server ships top-level `instructions`. No LLM judging — pure presence and length counting against declared thresholds.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "A tool description and its parameter descriptions are the entire basis on which a model decides whether and how to call it — they are the only prose the model ever sees about the tool. The spec states the documented purpose of outputSchema directly ('Guiding clients and LLMs to properly parse and utilize the returned data', 'Enabling strict schema validation of responses') and defines `instructions` as 'natural-language guidance for LLMs on how to use this server effectively'. The falsifiable claim is narrow and structural rather than aesthetic: a parameter with no `description` and no `enum`/`format`/`pattern` gives the model no way to derive a legal value, so it must guess, and guessed values surface as tool-execution errors and retry loops. Coverage is measured, not judged; only the pass thresholds are our convention, which is why this is graded B rather than A.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/mcp-server-quality/tool-self-description-coverage.md',
      tags: ['proposed', 'mcp-server-quality'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/mcp-server-quality/tool-self-description-coverage.md',
      'TODO stub',
    );
  }
}
