import type { AuditMeta, AuditResult } from "#core/types";
import { Audit } from "#core/audit";
import { weightForGrade } from "#core/scorer";
import type { CheckContext } from "#core/check-context";
import {
  discoverMcpEndpoint,
  listTools,
  signInMessage,
  isObject,
} from "#core/gatherers/mcp";
import {
  AuditTier,
  CheckPriority,
  EvidenceGrade,
  EvidenceKey,
  FixEffort,
  ScoreDisplayMode,
} from "#core/types";

/** How many `nextCursor` pages are followed. Same budget as the other tool audits. */
const MAX_PAGES = 4;
/** How many tool names a detail list carries. */
const MAX_SHOWN = 10;

/** The hints OpenAI's plugin guidelines require as explicit booleans on every tool. */
const REQUIRED_HINTS = [
  "readOnlyHint",
  "destructiveHint",
  "openWorldHint",
] as const;

const EXPECTED =
  "Every tool returned by tools/list carries explicit boolean readOnlyHint, destructiveHint and openWorldHint annotations";

const SAMPLE = `{"tools":[
  {"name":"search_products",
   "annotations":{"readOnlyHint":true,"destructiveHint":false,"openWorldHint":false}},
  {"name":"cancel_order",
   "annotations":{"readOnlyHint":false,"destructiveHint":true,"openWorldHint":false}}]}`;

/** True when the tool's `annotations` object carries `key` as a boolean. */
function hasBooleanHint(tool: Record<string, unknown>, key: string): boolean {
  const annotations = tool["annotations"];
  return isObject(annotations) && typeof annotations[key] === "boolean";
}

/** Percentage to one decimal, with an empty denominator counting as complete. */
function pct(part: number, total: number): number {
  return total === 0 ? 100 : Math.round((part / total) * 1000) / 10;
}

export class McpToolAnnotationCoverageAudit extends Audit {
  static override meta: AuditMeta = {
    id: "agent-interfaces/mcp-tool-annotation-coverage",
    category: "agent-interfaces",
    title: "MCP tool behaviour hints present",
    failureTitle: "MCP tools missing behaviour hints",
    description:
      "Reads the tools your MCP server already returned from tools/list and checks that each one declares the behaviour hints hosts use to decide when to ask the user: a boolean `readOnlyHint` or `destructiveHint` on every tool, and ideally all three of `readOnlyHint`, `destructiveHint` and `openWorldHint`.",
    scoreDisplayMode: ScoreDisplayMode.Ternary,
    tier: AuditTier.Scored,
    evidenceGrade: EvidenceGrade.A,
    weight: weightForGrade(EvidenceGrade.A, AuditTier.Scored),
    defaultPriority: CheckPriority.Medium,
    dossier:
      "docs/evidence/audits/agent-interfaces/mcp-tool-annotation-coverage.md",
    requires: [EvidenceKey.OriginReachable, EvidenceKey.UnblockedFetches],
    guidance: {
      impact:
        "Claude runs a tool marked read-only without asking and always asks before a destructive one. VS Code asks the user to confirm every call to a tool that does not set `readOnlyHint`. OpenAI requires explicit boolean `readOnlyHint`, `destructiveHint` and `openWorldHint` on every tool of a ChatGPT app, and its review flags annotation issues. A tool with no hints gets a confirmation prompt on every call and fails both directory reviews.",
      fix: "Add an `annotations` object to every tool in tools/list. Set `readOnlyHint` to true for tools that only read, `destructiveHint` to true for tools that delete, overwrite, cancel or revoke, and `openWorldHint` to say whether the tool reaches systems outside your own. Use explicit booleans, never null or strings.",
      code: SAMPLE,
      effort: FixEffort.Easy,
      docsUrl:
        "https://forkpoint.github.io/agent-lighthouse/audits/agent-interfaces/mcp-tool-annotation-coverage/",
      tags: ["mcp", "tools", "annotations", "confirmation", "safety"],
    },
  };

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const endpoint = await discoverMcpEndpoint(ctx);
    // Absent artifact, absent verdict: no declared MCP server means no tool
    // surface to grade. A broken declaration is mcp-endpoint's finding.
    if (!endpoint || !endpoint.url) {
      return this.notApplicable(
        "This site declares no MCP endpoint, so there are no tools whose annotations could be read.",
        EXPECTED,
        endpoint
          ? `Malformed declaration (${endpoint.source})`
          : "No declared MCP endpoint",
      );
    }

    const url = endpoint.url;
    // The same cached tools/list pages the other tool audits read: no new fetch.
    const { tools, truncated, signInStatus } = await listTools(
      ctx,
      url,
      MAX_PAGES,
    );
    if (signInStatus !== undefined) {
      return this.notApplicable(
        signInMessage(url, signInStatus, "its tool annotations"),
        EXPECTED,
        `${url}; tools/list -> HTTP ${signInStatus}`,
      );
    }
    if (tools.length === 0) {
      return this.notApplicable(
        `${url} returned no tool definitions, so there are no annotations to read. Whether the endpoint answers at all is scored by agent-interfaces/mcp-modern-era-reachability.`,
        EXPECTED,
        `${url}; 0 tools listed`,
      );
    }

    // Tools a host cannot classify at all: neither a read-only nor a
    // destructive claim, so Claude's and OpenAI's reviews both flag them.
    const unannotated: string[] = [];
    // Tools with a confirmation hint but without the full set OpenAI requires.
    const incomplete: string[] = [];
    const counts: Record<string, number> = {
      readOnlyHint: 0,
      destructiveHint: 0,
      openWorldHint: 0,
      idempotentHint: 0,
    };
    let fullyAnnotated = 0;

    for (const [index, tool] of tools.entries()) {
      const rawName = tool["name"];
      const name =
        typeof rawName === "string" && rawName ? rawName : `tool #${index + 1}`;

      for (const key of Object.keys(counts)) {
        if (hasBooleanHint(tool, key)) counts[key] = (counts[key] ?? 0) + 1;
      }

      const complete = REQUIRED_HINTS.every((key) => hasBooleanHint(tool, key));
      if (complete) {
        fullyAnnotated += 1;
      } else if (
        hasBooleanHint(tool, "readOnlyHint") ||
        hasBooleanHint(tool, "destructiveHint")
      ) {
        incomplete.push(name);
      } else {
        unannotated.push(name);
      }
    }

    const total = tools.length;
    const details = {
      tools: total,
      fullyAnnotated,
      readOnlyHintCoverage: pct(counts["readOnlyHint"] ?? 0, total),
      destructiveHintCoverage: pct(counts["destructiveHint"] ?? 0, total),
      openWorldHintCoverage: pct(counts["openWorldHint"] ?? 0, total),
      idempotentHintCoverage: pct(counts["idempotentHint"] ?? 0, total),
      unannotatedTools: unannotated.slice(0, MAX_SHOWN),
      incompleteTools: incomplete.slice(0, MAX_SHOWN),
      pagesTruncated: truncated,
    };
    const found = [
      url,
      `${total} tool(s)`,
      `${fullyAnnotated} with all three hints`,
      `${unannotated.length} with neither readOnlyHint nor destructiveHint`,
    ].join("; ");
    const displayValue = `${fullyAnnotated}/${total} tools fully annotated`;
    const list = (items: string[]) => {
      const shown = items.slice(0, 5).join(", ");
      return items.length > 5 ? `${shown} (${items.length - 5} more)` : shown;
    };

    if (unannotated.length > 0) {
      return {
        ...this.fail(
          `${unannotated.length} of ${total} tool(s) carry neither a boolean readOnlyHint nor a boolean destructiveHint: ${list(unannotated)}. Hosts cannot tell whether these tools only read or change data, so VS Code asks for confirmation on every call, and both Claude's and OpenAI's directory reviews flag them.`,
          EXPECTED,
          found,
          "Give every tool an annotations object with explicit boolean readOnlyHint, destructiveHint and openWorldHint.",
        ),
        displayValue,
        details,
      };
    }

    if (incomplete.length > 0) {
      return {
        ...this.warn(
          `${incomplete.length} of ${total} tool(s) lack an explicit boolean for at least one of readOnlyHint, destructiveHint and openWorldHint: ${list(incomplete)}. OpenAI requires all three on every tool of a ChatGPT app.`,
          EXPECTED,
          found,
          "Set readOnlyHint, destructiveHint and openWorldHint to explicit booleans on every tool.",
        ),
        displayValue,
        details,
      };
    }

    return {
      ...this.pass(
        `All ${total} tool(s) carry explicit boolean readOnlyHint, destructiveHint and openWorldHint annotations.`,
        EXPECTED,
        found,
      ),
      displayValue,
      details,
    };
  }
}
