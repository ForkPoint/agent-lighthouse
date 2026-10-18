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

/** The path the agents.json spec names for discovery. */
const AGENTS_JSON_PATH = "/.well-known/agents.json";

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

/**
 * The agents.json v0.1.0 document shape: an `info` object plus a `sources`
 * array (pointing at OpenAPI documents) or a `flows` array. Either member is
 * enough — a document may describe sources without flows, or the reverse.
 */
function isAgentsJsonDocument(parsed: unknown): boolean {
  if (!isObject(parsed)) return false;
  if (!isObject(parsed["info"])) return false;
  return Array.isArray(parsed["sources"]) || Array.isArray(parsed["flows"]);
}

const REPLACEMENT =
  "A2A /.well-known/agent-card.json for agents, an MCP Server Card in /.well-known/ard.json or /.well-known/ai-catalog.json for tools, or RFC 9727 /.well-known/api-catalog for APIs.";

export class AgentsJsonAudit extends Audit {
  static override meta: AuditMeta = {
    id: "agent-interfaces/agents-json",
    category: "agent-interfaces",
    // An obsolete audit speaks only when the owner still publishes the file,
    // so both titles describe the file rather than a site that lacks it.
    title: "agents.json at /.well-known/agents.json (obsolete)",
    failureTitle: "An obsolete agents.json document is still published",
    description:
      "Reports an agents.json document (Wild Card AI, spec v0.1.0) still served at `/.well-known/agents.json`. The spec never moved past v0.1.0, its repository has been inactive since 2025-08-21, its homepage is offline, the path is not in the IANA Well-Known URIs registry, several incompatible formats share it, and no client documents reading it. This check never asks a site to publish the file.",
    scoreDisplayMode: ScoreDisplayMode.Informative,
    weight: weightForGrade(EvidenceGrade.D, AuditTier.Obsolete),
    evidenceGrade: EvidenceGrade.D,
    tier: AuditTier.Obsolete,
    deprecated: {
      kind: NoticeKind.Obsolete,
      notice:
        "agents.json has no live specification and no known reader. Several incompatible formats use the same path.",
      link: "https://github.com/wild-card-ai/agents-json",
      replacement: REPLACEMENT,
    },
    dossier: "docs/evidence/audits/agent-interfaces/agents-json.md",
    requires: [EvidenceKey.OriginReachable, EvidenceKey.UnblockedFetches],
    defaultPriority: CheckPriority.Low,
    guidance: {
      impact:
        "The file costs nothing to keep, but no agent is known to read it: the specification has been dormant since 2025-08-21 and no vendor documents fetching the path.",
      fix: `Nothing is required. Remove the file when convenient, and declare what agents can use through a maintained route instead: ${REPLACEMENT}`,
      // `effort` is a required field on AuditGuidance and ships on every
      // status. It describes removing a file the site already publishes.
      effort: FixEffort.Trivial,
      // The audit shipped `https://agentsjson.org/`, which the 2026-08-21
      // research confirmed is NXDOMAIN. The upstream repository is the only
      // reachable primary source for the spec.
      docsUrl: "https://github.com/wild-card-ai/agents-json",
      tags: ["agents-json", "discovery", "agent-protocol", "obsolete"],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const expected =
      "No agents.json document: the format has no live specification and no known reader";

    const file = ctx.rootFiles[AGENTS_JSON_PATH];

    // Absent artifact, absent verdict. The obsolete tier tells an owner about
    // a document they still publish. A 404, an HTML stand-in, a body that does
    // not parse, or JSON of another shape is not an agents.json document, and
    // other formats share this path, so none of them is called obsolete.
    const parsed =
      isRootArtifact(file) && file.body.trim()
        ? tryParseJson(file.body)
        : undefined;
    if (!isAgentsJsonDocument(parsed)) {
      return this.notApplicable(
        "This site publishes no agents.json document, so there is nothing to retire.",
        expected,
        file
          ? `${AGENTS_JSON_PATH} answered HTTP ${file.status} without an agents.json document`
          : "No agents.json published",
      );
    }

    const doc = parsed as Record<string, unknown>;
    const sources = Array.isArray(doc["sources"]) ? doc["sources"].length : 0;
    const flows = Array.isArray(doc["flows"]) ? doc["flows"].length : 0;

    return {
      ...this.warn(
        `An agents.json document is published at ${AGENTS_JSON_PATH}. The format has no live specification and no known reader, and several incompatible formats use the same path. It does no harm. To reach agents, use ${REPLACEMENT}`,
        expected,
        `agents.json document: ${sources} source(s), ${flows} flow(s)`,
        CheckPriority.Low,
      ),
      details: { sources, flows },
    };
  }
}
