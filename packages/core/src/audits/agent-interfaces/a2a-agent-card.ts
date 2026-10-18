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
  ScoreDisplayMode,
} from "#core/types";
import {
  AGENT_CARD_PATH,
  LEGACY_AGENT_CARD_PATH,
  NO_AGENT_CARD,
  readAgentCard,
} from "./_a2a-card";

/**
 * A2A 1.0 §4.4.1 fields marked Required (`a2a.proto` REQUIRED). `name` and
 * `description` lead because a client shows those two to the person adding
 * the agent.
 */
const REQUIRED_FIELDS = [
  "name",
  "description",
  "version",
  "supportedInterfaces",
  "capabilities",
  "defaultInputModes",
  "defaultOutputModes",
  "skills",
] as const;

/** Fields that must be strings when present. */
const STRING_FIELDS = ["name", "description", "version"] as const;

/** Fields that must be arrays when present. */
const ARRAY_FIELDS = [
  "supportedInterfaces",
  "defaultInputModes",
  "defaultOutputModes",
  "skills",
] as const;

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

/** A string that carries information; whitespace-only is not a value. */
function present(val: unknown): boolean {
  if (val === undefined || val === null) return false;
  if (typeof val === "string") return val.trim() !== "";
  return true;
}

/**
 * Type errors the reference SDK's proto parse rejects. Unknown fields are
 * tolerated there (`ignore_unknown_fields=True`), so only a known field of the
 * wrong type is a reason the card cannot load.
 */
function typeErrors(card: Record<string, unknown>): string[] {
  const errors: string[] = [];
  for (const key of STRING_FIELDS) {
    if (key in card && typeof card[key] !== "string") {
      errors.push(`\`${key}\` is not a string`);
    }
  }
  if ("capabilities" in card && !isObject(card["capabilities"])) {
    errors.push("`capabilities` is not an object");
  }
  for (const key of ARRAY_FIELDS) {
    if (key in card && !Array.isArray(card[key])) {
      errors.push(`\`${key}\` is not an array`);
    }
  }
  for (const key of ["skills", "supportedInterfaces"] as const) {
    const list = card[key];
    if (Array.isArray(list) && list.some((item) => !isObject(item))) {
      errors.push(`\`${key}\` has an entry that is not an object`);
    }
  }
  return errors;
}

/** `AgentInterface` fields marked REQUIRED in `a2a.proto`. */
const INTERFACE_FIELDS = ["url", "protocolBinding", "protocolVersion"] as const;

/**
 * `supportedInterfaces` entries that lack a Required field, named by index.
 * Type errors are caught earlier; this only reports missing values.
 */
function incompleteInterfaces(card: Record<string, unknown>): string[] {
  const list = card["supportedInterfaces"];
  if (!Array.isArray(list)) return [];
  const gaps: string[] = [];
  list.forEach((item, index) => {
    if (!isObject(item)) return;
    const missing = INTERFACE_FIELDS.filter((key) => !present(item[key]));
    if (missing.length > 0) {
      gaps.push(`supportedInterfaces[${index}] lacks ${missing.join(", ")}`);
    }
  });
  return gaps;
}

/**
 * The 0.3 shape: one top-level `url` and no `supportedInterfaces`. The
 * reference SDK's `parse_agent_card` converts it into a 1.0 interface, so a
 * client still loads it; the audit records it in `details` and does not warn.
 */
function isLegacyShape(card: Record<string, unknown>): boolean {
  return "url" in card && !("supportedInterfaces" in card);
}

/** Every interface URL the card names, from the 1.0 list or the 0.3 field. */
function interfaceUrls(card: Record<string, unknown>): string[] {
  const urls: string[] = [];
  const list = card["supportedInterfaces"];
  if (Array.isArray(list)) {
    for (const item of list) {
      if (isObject(item) && typeof item["url"] === "string") {
        urls.push(item["url"]);
      }
    }
  }
  if (typeof card["url"] === "string") urls.push(card["url"]);
  return urls;
}

/**
 * An absolute URL on a secure scheme. The spec's own examples use `wss://` for
 * a WebSocket binding beside `https://`, so both count.
 */
function isAbsoluteSecure(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === "https:" || protocol === "wss:";
  } catch {
    return false;
  }
}

const EXPECTED = `${AGENT_CARD_PATH} parses as an A2A 1.0 Agent Card with every Required field and absolute https or wss interface URLs`;

const SAMPLE = `// ${AGENT_CARD_PATH} — A2A 1.0 §4.4.1
{
  "name": "Booking Agent",
  "description": "Books tables at the restaurant.",
  "version": "1.0.0",
  "supportedInterfaces": [
    { "url": "https://yoursite.com/a2a", "protocolBinding": "JSONRPC", "protocolVersion": "1.0" }
  ],
  "capabilities": { "streaming": true },
  "defaultInputModes": ["text/plain"],
  "defaultOutputModes": ["text/plain"],
  "skills": [
    { "id": "book", "name": "Book a table", "description": "Reserve a table for a party." }
  ]
}`;

export class A2aAgentCardAudit extends Audit {
  static override meta: AuditMeta = {
    id: "agent-interfaces/a2a-agent-card",
    category: "agent-interfaces",
    title: "A2A Agent Card is readable",
    failureTitle: "A2A Agent Card cannot be read",
    description:
      "Reads the A2A Agent Card at `/.well-known/agent-card.json`, the IANA-registered discovery path that the reference A2A client fetches to learn what an agent does and where to send tasks. A site that runs no A2A agent, or answers the path with JSON that is not a card, is not applicable. A card that does not parse fails; a card that parses but lacks Required fields, names a non-https interface, or sits only at the pre-1.0 `agent.json` path warns. The audit reads the card only and never calls the agent.",
    scoreDisplayMode: ScoreDisplayMode.Ternary,
    weight: weightForGrade(EvidenceGrade.B, AuditTier.Scored),
    evidenceGrade: EvidenceGrade.B,
    tier: AuditTier.Scored,
    dossier: "docs/evidence/audits/agent-interfaces/a2a-agent-card.md",
    requires: [EvidenceKey.OriginReachable, EvidenceKey.UnblockedFetches],
    defaultPriority: CheckPriority.High,
    guidance: {
      impact:
        "The reference A2A SDK, given your domain, fetches `/.well-known/agent-card.json` and stops if the card does not parse. Microsoft Copilot Studio reads a card when a person adds your agent by its endpoint URL.",
      fix: "Serve the Agent Card as JSON at `/.well-known/agent-card.json`. Include every A2A 1.0 Required field, and list each endpoint under `supportedInterfaces` with an absolute https URL, its `protocolBinding` and its `protocolVersion`. If a card is only at `/.well-known/agent.json`, serve it at the new path too.",
      code: SAMPLE,
      effort: FixEffort.Easy,
      docsUrl: "https://a2a-protocol.org/latest/specification/",
      tags: ["a2a", "agent-card", "discovery", "well-known"],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const read = readAgentCard(ctx);

    if (read.kind === "absent") {
      return this.notApplicable(NO_AGENT_CARD.message, EXPECTED, read.found);
    }

    if (read.kind === "broken") {
      return this.fail(
        `The Agent Card at ${read.path} is not a JSON object, so an A2A client cannot load it.`,
        EXPECTED,
        read.found,
        { priority: CheckPriority.High, code: SAMPLE },
      );
    }

    const { card, path } = read;
    const signed =
      Array.isArray(card["signatures"]) && card["signatures"].length > 0;

    const errors = typeErrors(card);
    if (errors.length > 0) {
      return {
        ...this.fail(
          `The Agent Card at ${path} has fields of the wrong type: ${errors.join("; ")}. The reference A2A SDK rejects such a card.`,
          EXPECTED,
          errors.join("; "),
          { priority: CheckPriority.High, code: SAMPLE },
        ),
        details: { code: SAMPLE, path, signed },
      };
    }

    const problems: string[] = [];
    if (read.legacy) {
      problems.push(
        `the card is only at ${LEGACY_AGENT_CARD_PATH}, the pre-1.0 path; A2A 1.0 moved discovery to ${AGENT_CARD_PATH} and the reference SDK reads only the new path, though some clients still read the old one`,
      );
    }

    const legacyShape = isLegacyShape(card);
    const missing = REQUIRED_FIELDS.filter(
      (key) =>
        !present(card[key]) && !(legacyShape && key === "supportedInterfaces"),
    );
    if (missing.length > 0) {
      problems.push(`missing Required fields: ${missing.join(", ")}`);
    }
    const interfaceGaps = incompleteInterfaces(card);
    if (interfaceGaps.length > 0) {
      problems.push(
        `interface entries miss Required fields: ${interfaceGaps.join("; ")}`,
      );
    }

    const insecure = interfaceUrls(card).filter(
      (url) => !isAbsoluteSecure(url),
    );
    if (insecure.length > 0) {
      problems.push(
        `interface URLs that are not absolute https or wss: ${insecure.join(", ")}`,
      );
    }

    if (problems.length > 0) {
      return {
        ...this.warn(
          `The Agent Card at ${path} loads, but ${problems.join("; ")}.`,
          EXPECTED,
          problems.join("; "),
          { priority: CheckPriority.Medium, code: SAMPLE },
        ),
        details: { code: SAMPLE, path, signed, legacyShape },
      };
    }

    return {
      ...this.pass(
        `A2A Agent Card found at ${path} with every Required field${legacyShape ? " (A2A 0.3 shape, which the reference SDK converts)" : ""}.`,
        EXPECTED,
        `Valid A2A card${legacyShape ? " in the 0.3 shape" : ""}${signed ? ", signed" : ""}`,
      ),
      details: { path, signed, legacyShape },
    };
  }
}
