import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "Tool Contract Validity and Silent-Drop Risk".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade A → scored tier. Implementation difficulty: static-fetch.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/mcp-server-quality/tool-contract-validity-and-silent-drop-risk.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// POST tools/list (paginating on nextCursor). For each tool assert: - `inputSchema` exists, is a
// plain object, is not null, and has `type === "object"` (MUST). - Every string in
// `inputSchema.required` is a key of `inputSchema.properties` (dangling required entries make every
// call fail validation client-side). - `name`: length 1-128, matches /^[A-Za-z0-9_.\-]+$/, and is
// unique within the server (all three SHOULD). Additionally flag names outside plain printable
// ASCII 0x21-0x7E, which force the client into the `=?base64?…?=` sentinel encoding of the Mcp-Name
// header. - x-mcp-header sweep: walk the entire inputSchema and collect every occurrence of the
// `x-mcp-header` key. For each, assert (a) value is a non-empty string; (b) matches RFC 9110 tchar:
// /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/; (c) contains no \r or \n; (d) is case-insensitively unique
// among all x-mcp-header values in that same inputSchema; (e) the annotated property's `type` is
// exactly one of string/integer/boolean — `number` is a violation; (f) the path from the schema
// root to the annotated property consists ONLY of `properties` keys — any hop through `items`,
// `oneOf`, `anyOf`, `allOf`, `not`, `if`, `then`, `else` or `$ref` is a violation. Report each
// violating tool as CRITICAL with the explicit consequence 'conforming Streamable HTTP clients MUST
// drop this tool from tools/list'. - If `outputSchema` is present, assert it parses as a JSON
// Schema object (servers MUST then conform to it at call time). Score = (tools passing all MUSTs /
// total tools), with any x-mcp-header violation forcing a failing grade regardless of ratio.
export class ToolContractValidityAndSilentDropRiskAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/mcp-server-quality/tool-contract-validity-and-silent-drop-risk',
    category: 'mcp-server-quality',
    title: "Tool Contract Validity and Silent-Drop Risk",
    failureTitle: "Tool Contract Validity and Silent-Drop Risk",
    description: "Static validation of every tool definition returned by tools/list against the MUST/SHOULD-level structural rules in the 2026-07-28 tools spec — with special weight on x-mcp-header violations, which oblige conforming clients to silently remove the offending tool from the list they show the model.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "The spec gives clients an explicit deletion instruction: 'Clients using the Streamable HTTP transport MUST reject tool definitions where any x-mcp-header value violates these constraints. Rejection means the client MUST exclude the invalid tool from the result of tools/list.' This makes malformed tool metadata a silent-invisibility bug rather than an error: the server returns the tool, logs a successful tools/list, and the model never sees it. The constraint set is fully machine-checkable with no network calls beyond the one list fetch — token syntax, no CR/LF, case-insensitive uniqueness, primitive types only with `number` explicitly excluded, and static reachability through a chain consisting solely of `properties` keys. Alongside it, `inputSchema` MUST be a valid JSON Schema object and not null; a null or scalar inputSchema breaks argument construction in every SDK.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/mcp-server-quality/tool-contract-validity-and-silent-drop-risk.md',
      tags: ['proposed', 'mcp-server-quality'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/mcp-server-quality/tool-contract-validity-and-silent-drop-risk.md',
      'TODO stub',
    );
  }
}
