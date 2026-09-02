import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import { weightForGrade } from "../../scorer";
import type { CheckContext } from "../../check-context";
import {
  discoverMcpEndpoint,
  discoverProbe,
  listTools,
  parseRpcResponse,
  isObject,
} from "../../gatherers/mcp";

/** How many `nextCursor` pages are followed. Same budget as contract validity. */
const MAX_PAGES = 4;
/** A description shorter than this documents nothing. */
const STUB_LENGTH = 40;
/** How deep the parameter walk goes before it stops descending. */
const MAX_DEPTH = 6;
/** How many offending paths a detail list names. */
const MAX_SHOWN = 10;

/** Every tool carries prose, and so does every parameter a caller must supply. */
const THRESHOLDS = { tool: 100, param: 90, required: 100 } as const;

/** One leaf parameter, with the path a caller would name it by. */
export interface Leaf {
  path: string;
  described: boolean;
  required: boolean;
  /** True for a string-typed leaf, the only kind the constraint ratio counts. */
  isString: boolean;
  /** True when a string leaf carries `enum`, `format` or `pattern`. */
  constrained: boolean;
}

function described(node: Record<string, unknown>): boolean {
  const value = node["description"];
  return typeof value === "string" && value.trim() !== "";
}

function typeOf(node: Record<string, unknown>): string {
  const raw = node["type"];
  if (typeof raw === "string") return raw;
  // A union type is what the first entry says it is for counting purposes.
  if (Array.isArray(raw) && typeof raw[0] === "string") return raw[0];
  return "";
}

/**
 * Walk an `inputSchema` and return one entry per leaf parameter.
 *
 * A leaf is a property that is not itself an object with properties, and not an
 * array of such objects. Container nodes are walked through rather than counted:
 * the model does not supply `line_items`, it supplies the fields inside it.
 */
export function collectLeaves(
  schema: unknown,
  prefix: string,
  depth = 0,
  requiredHere = false,
): Leaf[] {
  if (!isObject(schema) || depth > MAX_DEPTH) return [];

  const properties = isObject(schema["properties"])
    ? schema["properties"]
    : undefined;
  const requiredNames = new Set(
    Array.isArray(schema["required"])
      ? (schema["required"] as unknown[]).filter(
          (v): v is string => typeof v === "string",
        )
      : [],
  );

  if (!properties) {
    // A leaf reached through `items`: the array itself carried the path.
    return prefix === ""
      ? []
      : [
          {
            path: prefix,
            described: described(schema),
            required: requiredHere,
            isString: typeOf(schema) === "string",
            constrained:
              "enum" in schema || "format" in schema || "pattern" in schema,
          },
        ];
  }

  const leaves: Leaf[] = [];
  for (const [name, raw] of Object.entries(properties)) {
    if (!isObject(raw)) continue;
    const path = prefix === "" ? name : `${prefix}.${name}`;
    const isRequired = requiredNames.has(name);

    if (isObject(raw["properties"])) {
      leaves.push(...collectLeaves(raw, path, depth + 1, isRequired));
      continue;
    }
    if (
      typeOf(raw) === "array" &&
      isObject(raw["items"]) &&
      isObject(raw["items"]["properties"])
    ) {
      leaves.push(
        ...collectLeaves(raw["items"], `${path}[]`, depth + 1, isRequired),
      );
      continue;
    }

    leaves.push({
      path,
      described: described(raw),
      required: isRequired,
      isString: typeOf(raw) === "string",
      constrained: "enum" in raw || "format" in raw || "pattern" in raw,
    });
  }
  return leaves;
}

/** Percentage, with an empty denominator counting as complete. */
function pct(part: number, total: number): number {
  return total === 0 ? 100 : Math.round((part / total) * 1000) / 10;
}

const EXPECTED =
  "Every tool carries a description, every required parameter carries one, and at least 90% of all parameters do";

export class McpToolDescriptionCoverageAudit extends Audit {
  static override meta: AuditMeta = {
    id: "agent-interfaces/mcp-tool-description-coverage",
    category: "agent-interfaces",
    title: "Tool Self-Description Coverage",
    failureTitle: "Tool Self-Description Coverage",
    description:
      "Counts, over the tool surface the endpoint already returned, what fraction of tools carry a description, what fraction of every input parameter carries one — walking `properties` recursively and into `items.properties` for arrays of objects — and reports the advisory ratios alongside: constrained string parameters, declared output schemas, titles and the server’s own `instructions`.",
    scoreDisplayMode: "ternary",
    tier: "scored",
    evidenceGrade: "B",
    weight: weightForGrade("B", "scored"),
    defaultPriority: "medium",
    dossier:
      "docs/evidence/audits/agent-interfaces/mcp-tool-description-coverage.md",
    requires: ["origin-reachable"],
    guidance: {
      impact:
        "A tool description and its parameter descriptions are the only prose a model ever sees about a tool — they are the whole basis on which it decides whether to call it and what to pass. A required parameter with no description, no enum and no pattern gives the model nothing to derive a legal value from, so it guesses. Guessed values come back as validation errors, and the agent spends retry turns per call until it gives up on the tool.",
      fix: "Describe every tool and every parameter, in prose long enough to say what a legal value looks like. Constrain string parameters with `enum`, `format` or `pattern` where the legal set is finite. Declare an `outputSchema` so a client can parse the result rather than re-reading it, give each tool a `title` for the consent prompt, and return top-level `instructions` telling a model how the tools fit together.",
      code: `{
  "name": "create_reservation",
  "title": "Create a reservation",
  "description": "Book a stay for a guest at a property, at a chosen rate plan.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "property_id": { "type": "string", "description": "The property to book, as returned by search_properties." },
      "rate_plan":   { "type": "string", "description": "Which rate the booking uses.", "enum": ["FLEX", "NREF", "CORP", "GRP"] },
      "line_items":  {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "tax_code": { "type": "string", "description": "Jurisdiction tax code applied to this line." }
          }
        }
      }
    },
    "required": ["property_id", "rate_plan"]
  },
  "outputSchema": { "type": "object", "properties": { "confirmation": { "type": "string" } } }
}`,
      effort: "moderate",
      docsUrl:
        "https://forkpoint.github.io/agent-lighthouse/audits/agent-interfaces/mcp-tool-description-coverage/",
      tags: ["mcp", "tools", "documentation", "json-schema"],
    },
  };

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const endpoint = discoverMcpEndpoint(ctx);
    if (!endpoint || !endpoint.url) {
      return this.notApplicable(
        "This site declares no MCP endpoint, so there is no tool surface to measure.",
        EXPECTED,
        endpoint
          ? `Malformed declaration (${endpoint.source})`
          : "No declared MCP endpoint",
      );
    }

    const url = endpoint.url;
    const { tools, truncated } = await listTools(ctx, url, MAX_PAGES);
    if (tools.length === 0) {
      return this.notApplicable(
        `${url} returned no tool definitions, so there is nothing to measure. Whether the endpoint answers at all is scored by agent-interfaces/mcp-modern-era-reachability.`,
        EXPECTED,
        `${url}; 0 tools listed`,
      );
    }

    const undescribedTools: string[] = [];
    const stubTools: string[] = [];
    const undescribedParams: string[] = [];
    const undescribedRequired: string[] = [];
    let withOutputSchema = 0;
    let withTitle = 0;
    let leafCount = 0;
    let leafDescribed = 0;
    let requiredCount = 0;
    let requiredDescribed = 0;
    let stringCount = 0;
    let stringConstrained = 0;

    for (const [index, tool] of tools.entries()) {
      const rawName = tool["name"];
      const name =
        typeof rawName === "string" && rawName ? rawName : `tool #${index + 1}`;

      if (!described(tool)) undescribedTools.push(name);
      else if ((tool["description"] as string).trim().length < STUB_LENGTH)
        stubTools.push(name);

      if (isObject(tool["outputSchema"])) withOutputSchema += 1;
      const title = tool["title"];
      if (typeof title === "string" && title.trim() !== "" && title !== rawName)
        withTitle += 1;

      for (const leaf of collectLeaves(tool["inputSchema"], "")) {
        const path = `${name}.${leaf.path}`;
        leafCount += 1;
        if (leaf.described) leafDescribed += 1;
        else undescribedParams.push(path);
        if (leaf.required) {
          requiredCount += 1;
          if (leaf.described) requiredDescribed += 1;
          else undescribedRequired.push(path);
        }
        if (leaf.isString) {
          stringCount += 1;
          if (leaf.constrained) stringConstrained += 1;
        }
      }
    }

    // The server's own guidance, read off the discover response the reachability
    // audit already paid for.
    let instructionsLength = 0;
    const discover = await discoverProbe(ctx, url);
    if (discover && discover.status === 200) {
      const parsed = parseRpcResponse(discover);
      const value = parsed.ok ? parsed.value["instructions"] : undefined;
      if (typeof value === "string") instructionsLength = value.trim().length;
    }

    const toolCoverage = pct(
      tools.length - undescribedTools.length,
      tools.length,
    );
    const paramCoverage = pct(leafDescribed, leafCount);
    const requiredCoverage = pct(requiredDescribed, requiredCount);
    const details = {
      tools: tools.length,
      parameters: leafCount,
      requiredParameters: requiredCount,
      toolDescriptionCoverage: toolCoverage,
      paramDescriptionCoverage: paramCoverage,
      requiredParamDescriptionCoverage: requiredCoverage,
      constrainedStringRatio: pct(stringConstrained, stringCount),
      outputSchemaCoverage: pct(withOutputSchema, tools.length),
      titleCoverage: pct(withTitle, tools.length),
      instructionsLength,
      stubDescriptions: stubTools.length,
      undescribedTools: undescribedTools.slice(0, MAX_SHOWN),
      undescribedRequiredParams: undescribedRequired.slice(0, MAX_SHOWN),
      undescribedParams: undescribedParams.slice(0, MAX_SHOWN),
      pagesTruncated: truncated,
    };
    const found = [
      url,
      `${tools.length} tool(s), ${leafCount} parameter(s)`,
      `tool descriptions ${toolCoverage}%`,
      `parameters ${paramCoverage}%`,
      `required parameters ${requiredCoverage}%`,
      `instructions ${instructionsLength} character(s)`,
    ].join("; ");
    const displayValue = `${paramCoverage}% of parameters documented`;
    const list = (items: string[]) => {
      const shown = items.slice(0, 5).join(", ");
      return items.length > 5 ? `${shown} (${items.length - 5} more)` : shown;
    };

    const failures: string[] = [];
    if (toolCoverage < THRESHOLDS.tool) {
      failures.push(
        `${undescribedTools.length} of ${tools.length} tool(s) carry no description: ${list(undescribedTools)}`,
      );
    }
    if (requiredCoverage < THRESHOLDS.required) {
      failures.push(
        `${undescribedRequired.length} required parameter(s) are undocumented, so every call guesses at them: ${list(undescribedRequired)}`,
      );
    }
    if (paramCoverage < THRESHOLDS.param) {
      failures.push(
        `Only ${paramCoverage}% of parameters carry a description, under the ${THRESHOLDS.param}% threshold: ${list(undescribedParams)}`,
      );
    }

    if (failures.length > 0) {
      return {
        ...this.fail(
          failures.join(". "),
          EXPECTED,
          found,
          "Describe every tool and every required parameter, and say what a legal value looks like.",
        ),
        displayValue,
        details,
      };
    }

    const warnings: string[] = [];
    if (stubTools.length > 0) {
      warnings.push(
        `${stubTools.length} tool description(s) are under ${STUB_LENGTH} characters and document nothing: ${list(stubTools)}`,
      );
    }
    if (instructionsLength === 0) {
      warnings.push(
        "The server returns no `instructions`, so a model gets no guidance on how the tools fit together",
      );
    }

    if (warnings.length > 0) {
      return {
        ...this.warn(
          warnings.join(". "),
          EXPECTED,
          found,
          "Expand the stub descriptions and return top-level `instructions`.",
        ),
        displayValue,
        details,
      };
    }

    return {
      ...this.pass(
        `Every tool and every required parameter is documented, and ${paramCoverage}% of all parameters are.`,
        EXPECTED,
        found,
      ),
      displayValue,
      details,
    };
  }
}
