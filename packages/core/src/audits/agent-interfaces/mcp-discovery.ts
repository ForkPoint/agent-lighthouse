import type { AuditMeta, AuditResult } from "#core/types";
import { Audit } from "#core/audit";
import { weightForGrade } from "#core/scorer";
import type { CheckContext } from "#core/check-context";
import {
  AuditTier,
  CheckPriority,
  EvidenceGrade,
  EvidenceKey,
  FixEffort,
  NoticeKind,
  ScoreDisplayMode,
} from "#core/types";
import { isRootArtifact } from "#core/gatherers/root-files";

/** The unregistered path this audit reports. No MCP document names it. */
const SERVERS_JSON_PATH = "/.well-known/mcp/servers.json";

const REPLACEMENT =
  "An MCP Server Card listed in /.well-known/ai-catalog.json or /.well-known/ard.json, the route the MCP Server Card extension specifies for domain-level discovery.";

function tryParseJson(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

/** What the published file holds, for the `found` text. */
function describeServersFile(body: string): string {
  const parsed = tryParseJson(body);
  if (!isObject(parsed))
    return "Published, but the body does not parse as a JSON object";
  const servers = parsed["servers"];
  if (!Array.isArray(servers)) return "JSON object with no servers array";
  return `servers.json listing ${servers.length} server(s)`;
}

export class McpDiscoveryAudit extends Audit {
  static override meta: AuditMeta = {
    id: "agent-interfaces/mcp-discovery",
    category: "agent-interfaces",
    // An obsolete audit speaks only when the owner still publishes the file,
    // so both titles describe the file rather than a site that lacks it.
    title: "MCP servers.json discovery file (obsolete)",
    failureTitle: "An unread MCP servers.json file is published",
    description:
      "Reports a file still served at `/.well-known/mcp/servers.json`. No MCP specification defines the path and no MCP client documents fetching it. Domain-level MCP discovery goes through a Server Card listed in `/.well-known/ai-catalog.json`. The `/.well-known/ucp` commerce profile this audit used to read is judged by `agentic-commerce/ucp-profile`.",
    scoreDisplayMode: ScoreDisplayMode.Informative,
    weight: weightForGrade(EvidenceGrade.D, AuditTier.Obsolete),
    evidenceGrade: EvidenceGrade.D,
    tier: AuditTier.Obsolete,
    deprecated: {
      kind: NoticeKind.Obsolete,
      notice:
        "No MCP specification or client reads /.well-known/mcp/servers.json. MCP domain discovery uses a Server Card listed in /.well-known/ai-catalog.json.",
      link: "https://raw.githubusercontent.com/modelcontextprotocol/experimental-ext-server-card/main/docs/discovery.md",
      replacement: REPLACEMENT,
    },
    dossier: "docs/evidence/audits/agent-interfaces/mcp-discovery.md",
    requires: [EvidenceKey.OriginReachable, EvidenceKey.UnblockedFetches],
    defaultPriority: CheckPriority.Low,
    guidance: {
      impact:
        "The file does no harm, but no MCP client reads it, so an MCP server announced only here is not discovered through it.",
      fix: `Publish the MCP server's Server Card and list it in /.well-known/ai-catalog.json (or /.well-known/ard.json). The servers.json file can then be removed. ${REPLACEMENT}`,
      effort: FixEffort.Easy,
      docsUrl:
        "https://github.com/modelcontextprotocol/experimental-ext-server-card/blob/main/docs/discovery.md",
      tags: ["mcp", "discovery", "agent-protocol", "obsolete"],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const expected =
      "No /.well-known/mcp/servers.json: MCP discovery uses a Server Card in /.well-known/ai-catalog.json";
    const file = ctx.rootFiles[SERVERS_JSON_PATH];

    // Absent artifact, absent verdict. The obsolete tier tells an owner about
    // a file they still publish; a 404 or an HTML stand-in is not that file.
    // A present file is reported whatever it holds: the path is MCP-specific,
    // so nothing else is likely to live there, and a broken copy of an unread
    // file is not a failure.
    if (!isRootArtifact(file) || !file.body.trim()) {
      return this.notApplicable(
        "This site publishes no /.well-known/mcp/servers.json, so there is nothing to retire.",
        expected,
        file
          ? `${SERVERS_JSON_PATH} answered HTTP ${file.status} without a file`
          : "No servers.json published",
      );
    }

    return this.warn(
      `A file is published at ${SERVERS_JSON_PATH}. No MCP specification or client reads this path, so it announces nothing. It does no harm. To make the server discoverable, list its Server Card in /.well-known/ai-catalog.json.`,
      expected,
      describeServersFile(file.body),
      CheckPriority.Low,
    );
  }
}
