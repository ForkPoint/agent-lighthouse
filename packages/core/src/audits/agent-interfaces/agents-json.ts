import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import { weightForGrade } from "../../scorer";
import type { CheckContext } from "../../check-context";

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
 * True when the body is the site's HTML shell rather than a document.
 *
 * Deliberately a body sniff and nothing else: a document that parses as JSON is
 * never reported as HTML just because the response carried the wrong
 * `Content-Type`. That case is a separate, milder finding below.
 */
function looksLikeHtml(body: string): boolean {
  return /^\s*(<!doctype html|<html)/i.test(body);
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

/** A short, scalar description of what was served, for the `found` field. */
function describeJsonShape(parsed: unknown): string {
  if (Array.isArray(parsed)) return `JSON array (${parsed.length} entr(ies))`;
  if (parsed === null) return "JSON null";
  if (!isObject(parsed)) return `JSON ${typeof parsed}`;
  const keys = Object.keys(parsed);
  return keys.length === 0
    ? "Empty JSON object"
    : `JSON object with keys: ${keys.slice(0, 10).join(", ")}`;
}

export class AgentsJsonAudit extends Audit {
  static override meta: AuditMeta = {
    id: "agent-interfaces/agents-json",
    category: "agent-interfaces",
    // `title` renders on `pass` and on `na`, `failureTitle` on everything else.
    // Absence of the file is `na` here, so the title has to read true over a
    // site that has never heard of the convention — hence a neutral label
    // rather than a claim about what the site did or failed to do.
    title: "agents.json at /.well-known/agents.json",
    failureTitle:
      "agents.json is published but not served as a usable document",
    description:
      "agents.json (Wild Card AI, spec v0.1.0) layers agent-facing flows over OpenAPI at `/.well-known/agents.json`. No AI vendor documents consuming it, the spec never moved past v0.1.0, both of its project domains are offline and the path is absent from the IANA Well-Known URIs registry — so this check never asks a site to publish the file. It reports, with no score effect, whether what is served at that path is a real agents.json document or an HTML shell.",
    scoreDisplayMode: "informative",
    weight: weightForGrade("C", "informative"),
    evidenceGrade: "C",
    tier: "informative",
    dossier: "docs/evidence/audits/agent-interfaces/agents-json.md",
    requires: ["origin-reachable"],
    defaultPriority: "low",
    guidance: {
      impact:
        "Publishing agents.json is not known to make a site reachable to any agent: no vendor documents reading the file, and the specification has been dormant since 2025-08-21. What does matter is that a document already published at a well-known path can be read — a 200 carrying the site's HTML shell tells a conforming client the resource exists and then gives it nothing to parse, which is worse than a clean 404.",
      fix: "Nothing to do if the site does not publish this file; its absence is not a finding. If the site already publishes one, the agents.json v0.1.0 shape is an `info` object alongside a `sources` array (each entry pointing at an OpenAPI document) or a `flows` array, served as JSON. A path that answers 200 with the site shell is better served as a 404.",
      code: `// Reference only — the agents.json v0.1.0 document shape,
// for a site that already publishes /.well-known/agents.json.
{
  "$schema": "https://raw.githubusercontent.com/wild-card-ai/agents-json/main/schema/agents.schema.json",
  "info": {
    "title": "Your Site",
    "version": "0.1.0",
    "description": "Agent-facing flows over your existing API"
  },
  "sources": [
    { "id": "api", "path": "/openapi.json" }
  ],
  "flows": []
}`,
      // `effort` is a required field on AuditGuidance and ships on every
      // status, including `na`. It describes correcting a file the site has
      // already chosen to publish, not creating one.
      effort: "easy",
      // The audit shipped `https://agentsjson.org/`, which the 2026-08-21
      // research confirmed is NXDOMAIN. The upstream repository is the only
      // reachable primary source for the spec.
      docsUrl: "https://github.com/wild-card-ai/agents-json",
      tags: ["agents-json", "discovery", "agent-protocol"],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const expected =
      "If /.well-known/agents.json is published, it parses as an agents.json document (an `info` object plus a `sources` or `flows` array)";

    const file = ctx.rootFiles[AGENTS_JSON_PATH];

    // Absence is not a defect. The convention has no documented consumer, no
    // IANA registration and a dormant spec, so a site that publishes nothing
    // here has withheld nothing any agent is known to want. `notApplicable`
    // keeps it out of scoring entirely rather than rewarding absence.
    if (!file || file.status !== 200 || !file.body.trim()) {
      const found = !file
        ? "No agents.json published"
        : file.status === 200
          ? "HTTP 200 with an empty body"
          : `${AGENTS_JSON_PATH} returned HTTP ${file.status}`;
      return this.notApplicable(
        "This site publishes no agents.json. The convention has no documented consumer, so not publishing it is not a finding.",
        expected,
        found,
      );
    }

    const contentType = file.contentType || "no content-type";

    // An HTML body behind a 200 at a well-known path claims adoption the site
    // does not have. It used to be reported as "agents.json is not valid
    // JSON", which names the wrong defect.
    if (looksLikeHtml(file.body)) {
      return {
        ...this.warn(
          `${AGENTS_JSON_PATH} answers HTTP 200 with an HTML page rather than a document. A well-known path that returns the site shell reports adoption the site does not have; a clean 404 is the honest answer and is not a finding here.`,
          expected,
          `HTTP 200 ${contentType}, body begins with HTML`,
          "low",
        ),
        details: { contentType, bodyLooksLikeHtml: true },
      };
    }

    const parsed = tryParseJson(file.body);

    if (parsed === undefined) {
      return {
        ...this.warn(
          `Something is served at ${AGENTS_JSON_PATH}, but the body does not parse as JSON.`,
          expected,
          `HTTP 200 ${contentType}, body does not parse as JSON`,
          "low",
        ),
        details: { contentType },
      };
    }

    // The old rule accepted `isObject(parsed) || Array.isArray(parsed)`, so
    // `[]`, `{}` and any unrelated config file at this path were reported as
    // adoption. Validate the shape the spec actually defines.
    if (!isAgentsJsonDocument(parsed)) {
      return {
        ...this.warn(
          `JSON is served at ${AGENTS_JSON_PATH}, but it is not an agents.json document — the spec requires an \`info\` object and a \`sources\` or \`flows\` array.`,
          expected,
          describeJsonShape(parsed),
          "low",
        ),
        details: { contentType },
      };
    }

    const doc = parsed as Record<string, unknown>;
    const sources = Array.isArray(doc["sources"]) ? doc["sources"].length : 0;
    const flows = Array.isArray(doc["flows"]) ? doc["flows"].length : 0;

    // The body is a real document, but a client dispatching on media type will
    // not read it as one. Reported separately so the message never claims the
    // body is HTML when it is not.
    if (file.contentType.toLowerCase().includes("text/html")) {
      return {
        ...this.warn(
          `An agents.json document is published at ${AGENTS_JSON_PATH}, but it is served as \`${file.contentType}\`. A client that dispatches on media type will not read it as a document.`,
          expected,
          `Valid agents.json document served with Content-Type: ${file.contentType}`,
          "low",
        ),
        details: { contentType, sources, flows },
      };
    }

    return {
      ...this.pass(
        "A valid agents.json document is published (an `info` object with a `sources` or `flows` array).",
        expected,
        `Valid agents.json document: ${sources} source(s), ${flows} flow(s)`,
      ),
      details: { contentType, sources, flows },
    };
  }
}
