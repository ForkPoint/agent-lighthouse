// Graduated from proposal 2026-08-22 (Plan 5, Task 30).
// Evidence dossier: docs/evidence/audits/agent-interfaces/mcp-version-downgrade.md
//
// With the handshake gone, the only way a client learns which revisions a
// server accepts is the error it gets for guessing wrong. A server that fails
// vaguely strands clients that are one revision ahead of it, even though both
// sides support a common revision.
import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import { weightForGrade } from "../../scorer";
import type { CheckContext } from "../../check-context";
import type { FetchResult } from "../../fetcher";
import {
  discoverMcpEndpoint,
  discoverProbe,
  parseRpcResponse,
  postRpcRaw,
  isObject,
  MCP_PROTOCOL_VERSION,
} from "../../gatherers/mcp";

/** A revision no server can support, so the rejection path is unambiguous. */
const IMPOSSIBLE = "1900-01-01";
/** The revision probe B puts in the body while the header says the current one. */
const MISMATCH_BODY = "2025-11-25";
/** What a server assumes when the header is absent. */
const HEADERLESS_DEFAULT = "2025-03-26";
/** UnsupportedProtocolVersionError. */
const UNSUPPORTED = -32022;
/** HeaderMismatch. */
const HEADER_MISMATCH = -32020;
/** Revision strings are dates. */
const REVISION = /^\d{4}-\d{2}-\d{2}$/;

/** The `_meta` block, with the protocol version under the caller's control. */
function meta(version: string): Record<string, unknown> {
  return {
    _meta: {
      "io.modelcontextprotocol/protocolVersion": version,
      "io.modelcontextprotocol/clientInfo": {
        name: "AgentLighthouse",
        version: "1.0.0",
      },
      "io.modelcontextprotocol/clientCapabilities": {},
    },
  };
}

/** The JSON-RPC error a response carries, if it carries one. */
function errorOf(
  res: FetchResult,
): { code: number; data?: unknown } | undefined {
  const parsed = parseRpcResponse(res);
  return parsed.ok ? undefined : parsed.error;
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : [];
}

/** The revisions a server named in its own `server/discover` result. */
async function declaredVersions(
  ctx: CheckContext,
  url: string,
): Promise<string[]> {
  const res = await discoverProbe(ctx, url);
  if (!res || res.status !== 200) return [];
  const parsed = parseRpcResponse(res);
  return parsed.ok ? strings(parsed.value["supportedVersions"]) : [];
}

const EXPECTED = `An unsupported protocol version is rejected with HTTP 400 and JSON-RPC -32022 carrying data.supported and data.requested, a header that disagrees with the body's _meta is rejected with -32020, and the list of supported revisions matches the one server/discover advertises`;

const SAMPLE = `// A client one revision ahead sends what it prefers:
POST /mcp
MCP-Protocol-Version: 1900-01-01
{"jsonrpc":"2.0","id":"1","method":"server/discover","params":{"_meta":{
  "io.modelcontextprotocol/protocolVersion":"1900-01-01"}}}

// The only answer that lets it recover — 400, with the list to choose from:
{"jsonrpc":"2.0","id":"1","error":{
  "code":-32022,
  "message":"Unsupported protocol version",
  "data":{"supported":["2025-11-25","${MCP_PROTOCOL_VERSION}"],"requested":"1900-01-01"}}}

// Header and body must agree; when they do not, say so rather than picking one:
{"jsonrpc":"2.0","id":"1","error":{
  "code":-32020,
  "message":"MCP-Protocol-Version header does not match params._meta"}}`;

export class McpVersionDowngradeAudit extends Audit {
  static override meta: AuditMeta = {
    id: "agent-interfaces/mcp-version-downgrade",
    category: "agent-interfaces",
    title: "Version Downgrade Recoverability",
    failureTitle: "Version Downgrade Recoverability",
    description:
      "Negative-path probe that verifies the server fails correctly when handed a protocol version it does not support, and when the MCP-Protocol-Version header disagrees with the body's _meta. Both are MUST-level behaviors whose absence strands otherwise-compatible clients.",
    scoreDisplayMode: "ternary",
    weight: weightForGrade("A", "scored"),
    evidenceGrade: "A",
    tier: "scored",
    dossier: "docs/evidence/audits/agent-interfaces/mcp-version-downgrade.md",
    requires: ["origin-reachable", "unblocked-fetches"],
    defaultPriority: "medium",
    guidance: {
      impact:
        "With the handshake removed, the ONLY mechanism by which a client discovers a mutually supported version mid-flight is the `UnsupportedProtocolVersionError`: the spec requires code -32022 with `data.supported[]` listing the server's versions, and instructs clients to select from that list and retry. A server that instead returns a 500, a generic -32600/-32602, or a 400 with no `supported` array gives the client nothing to downgrade to — so a client whose preferred version is one revision ahead of the server's fails permanently even though a mutually supported version exists on both sides. Separately, the spec requires the header and the `_meta` value to agree, with a 400 + -32020 HeaderMismatch on divergence; a server that silently ignores the mismatch is trusting whichever source of truth its proxy layer did not, which is the exact split-brain the header-validation rules exist to prevent.",
      fix: `Reject an unsupported protocol version with HTTP 400 and JSON-RPC error -32022, and put \`data.supported\` — every revision you accept, as \`YYYY-MM-DD\` strings — and \`data.requested\` in the error, so the client can pick a common revision and retry instead of failing permanently. Keep that list identical to the \`supportedVersions\` your \`server/discover\` result advertises. Validate the \`MCP-Protocol-Version\` header against \`params._meta\` on every request and reject a disagreement with -32020, rather than silently trusting one of them. When the header is absent, treat the request as ${HEADERLESS_DEFAULT} as the spec says, or reject it — do not answer it as if it were the current revision.`,
      code: SAMPLE,
      effort: "moderate",
      docsUrl:
        "https://forkpoint.github.io/agent-lighthouse/audits/agent-interfaces/mcp-version-downgrade/",
      tags: [
        "mcp",
        "protocol-version",
        "error-handling",
        "compatibility",
        "agent-protocol",
      ],
    },
  };

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const endpoint = discoverMcpEndpoint(ctx);
    if (!endpoint || !endpoint.url) {
      return this.notApplicable(
        "This site declares no MCP endpoint, so there is no version negotiation to probe.",
        EXPECTED,
        endpoint
          ? `Malformed declaration (${endpoint.source})`
          : "No declared MCP endpoint",
      );
    }

    const url = endpoint.url;
    const critical: string[] = [];
    const high: string[] = [];
    const reviews: string[] = [];
    const notes: string[] = [];

    // Probe A — an impossible revision, sent identically in header and body.
    const probeA = await postRpcRaw(
      ctx,
      url,
      "al-v-a",
      "server/discover",
      meta(IMPOSSIBLE),
      {
        "MCP-Protocol-Version": IMPOSSIBLE,
      },
    );
    if (!probeA) {
      return this.notApplicable(
        `${url} did not answer, so its rejection behaviour cannot be probed. Reachability is scored by agent-interfaces/mcp-modern-era-reachability.`,
        EXPECTED,
        `${url}; endpoint unreachable`,
      );
    }

    let supported: string[] = [];
    const errorA = errorOf(probeA);
    if (probeA.status === 200) {
      critical.push(
        `it accepted \`${IMPOSSIBLE}\` with HTTP 200, so it validates no protocol version at all and a client can never learn which revisions it speaks`,
      );
    } else if (!errorA || errorA.code !== UNSUPPORTED) {
      critical.push(
        `it rejected \`${IMPOSSIBLE}\` with HTTP ${probeA.status}${errorA ? ` and JSON-RPC ${errorA.code}` : " and no JSON-RPC error"} rather than ${UNSUPPORTED}, which leaves the client nothing to downgrade to`,
      );
    } else {
      if (probeA.status !== 400) {
        reviews.push(
          `the ${UNSUPPORTED} rejection arrived as HTTP ${probeA.status} rather than 400`,
        );
      }
      const data = isObject(errorA.data) ? errorA.data : {};
      supported = strings(data["supported"]);
      if (!Array.isArray(data["supported"]) || supported.length === 0) {
        critical.push(
          "`error.data.supported` is missing or empty, so the client is told the version is wrong and never told which one is right",
        );
      } else {
        const malformed = supported.filter((v) => !REVISION.test(v));
        if (malformed.length > 0) {
          reviews.push(
            `\`error.data.supported\` lists ${malformed.map((v) => `"${v}"`).join(", ")}, which is not a YYYY-MM-DD revision`,
          );
        }
      }
      if (data["requested"] !== IMPOSSIBLE) {
        reviews.push(
          `\`error.data.requested\` is ${JSON.stringify(data["requested"] ?? null)} rather than the "${IMPOSSIBLE}" that was sent`,
        );
      }
    }

    // The two lists of supported revisions must be the same list.
    const advertised = await declaredVersions(ctx, url);
    if (supported.length > 0 && advertised.length > 0) {
      const missing = advertised.filter((v) => !supported.includes(v));
      const extra = supported.filter((v) => !advertised.includes(v));
      if (missing.length > 0 || extra.length > 0) {
        reviews.push(
          `the rejection lists ${supported.join(", ")} while server/discover advertises ${advertised.join(", ")}, so a client can be sent to a revision the other surface denies`,
        );
      }
    }

    // Probe B — header and body disagree, and the server must say so.
    const probeB = await postRpcRaw(
      ctx,
      url,
      "al-v-b",
      "server/discover",
      meta(MISMATCH_BODY),
      {
        "MCP-Protocol-Version": MCP_PROTOCOL_VERSION,
      },
    );
    if (probeB) {
      const errorB = errorOf(probeB);
      if (probeB.status === 200) {
        high.push(
          `it answered a request whose header said ${MCP_PROTOCOL_VERSION} and whose \`_meta\` said ${MISMATCH_BODY} with HTTP 200, so it never validates the header against the body and is trusting whichever of the two its proxy layer did not`,
        );
      } else if (!errorB || errorB.code !== HEADER_MISMATCH) {
        reviews.push(
          `a header/body version disagreement was rejected with HTTP ${probeB.status}${errorB ? ` and JSON-RPC ${errorB.code}` : ""} rather than ${HEADER_MISMATCH}, so the client cannot tell a mismatch from any other bad request`,
        );
      }
    }

    // Probe C — no header at all. Either default is acceptable; answering as if
    // the current revision had been requested is the gap.
    const probeC = await postRpcRaw(
      ctx,
      url,
      "al-v-c",
      "server/discover",
      meta(HEADERLESS_DEFAULT),
    );
    if (probeC) {
      const parsedC = parseRpcResponse(probeC);
      const negotiated =
        parsedC.ok && typeof parsedC.value["protocolVersion"] === "string"
          ? parsedC.value["protocolVersion"]
          : undefined;
      if (probeC.status !== 200) {
        notes.push(
          `a request with no \`MCP-Protocol-Version\` header is rejected (HTTP ${probeC.status})`,
        );
      } else if (negotiated === HEADERLESS_DEFAULT) {
        notes.push(
          `a request with no \`MCP-Protocol-Version\` header is treated as ${HEADERLESS_DEFAULT}, as the spec says`,
        );
      } else {
        reviews.push(
          `a request with no \`MCP-Protocol-Version\` header is answered with a modern result rather than being treated as ${HEADERLESS_DEFAULT} or rejected, which is a validation gap`,
        );
      }
    }

    const found = [
      url,
      `probe A HTTP ${probeA.status}${errorA ? ` / ${errorA.code}` : ""}`,
      `probe B HTTP ${probeB ? probeB.status : "no answer"}`,
      `probe C HTTP ${probeC ? probeC.status : "no answer"}`,
      `supported ${supported.length > 0 ? supported.join(", ") : "not advertised in the rejection"}`,
    ].join("; ");

    const tail = notes.length > 0 ? ` Also: ${notes.join("; ")}.` : "";

    if (critical.length > 0) {
      return this.fail(
        `The downgrade path is broken: ${critical.join("; ")}.${high.length > 0 ? ` Additionally, ${high.join("; ")}.` : ""}${tail}`,
        EXPECTED,
        found,
        "critical",
      );
    }
    if (high.length > 0) {
      return this.fail(`${high.join("; ")}.${tail}`, EXPECTED, found, "high");
    }
    if (reviews.length > 0) {
      return this.warn(
        `The server rejects an unsupported revision recoverably, with review items: ${reviews.join("; ")}.${tail}`,
        EXPECTED,
        found,
        "medium",
      );
    }
    return this.pass(
      `An unsupported revision is rejected with ${UNSUPPORTED} and a list of ${supported.length} revision(s) to retry with, and a header/body disagreement is rejected with ${HEADER_MISMATCH}.${tail}`,
      EXPECTED,
      found,
    );
  }
}
