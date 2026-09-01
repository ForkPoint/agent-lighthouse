// Graduated from proposal 2026-08-22 (Plan 5, Task 28).
// Evidence dossier: docs/evidence/audits/agent-interfaces/mcp-tool-contract-validity.md
//
// The spec tells clients to delete malformed tools, not to error on them, which
// turns a metadata typo into an invisibility bug: the server logs a successful
// tools/list and the model never sees the tool. Every rule checked here is
// static — one list fetch, no calls.
import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import { weightForGrade } from '../../scorer';
import type { CheckContext } from '../../check-context';
import {
  discoverMcpEndpoint,
  listTools,
  isObject,
} from '../../gatherers/mcp';

/** How many `nextCursor` pages are followed. */
const MAX_PAGES = 4;
/** Longest tool name the spec allows. */
const MAX_NAME = 128;
/** Tool names outside this need no escaping anywhere. */
const NAME_PATTERN = /^[A-Za-z0-9_.\-]+$/;
/** RFC 9110 tchar: what a header value may be built from. */
const TCHAR = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
/** The only property types an `x-mcp-header` annotation may sit on. */
const HEADER_TYPES = ['string', 'integer', 'boolean'];
/** Schema keywords that break static reachability from the root. */
const NON_PROPERTY_HOPS = ['items', 'oneOf', 'anyOf', 'allOf', 'not', 'if', 'then', 'else', '$ref'];
/** How many findings a message lists before it counts the rest. */
const MAX_SHOWN = 5;

/** What the spec obliges a client to do with a tool that breaks a header rule. */
const DELETION = 'conforming Streamable HTTP clients MUST drop this tool from tools/list';

interface HeaderUse {
  value: unknown;
  /** Path from the schema root, ending in the `x-mcp-header` key itself. */
  path: string[];
  /** The schema node carrying the annotation. */
  owner: Record<string, unknown>;
}

/** Every `x-mcp-header` anywhere under a schema, with the path that reached it. */
function collectHeaders(node: unknown, path: string[], into: HeaderUse[]): void {
  if (Array.isArray(node)) {
    node.forEach((item, i) => collectHeaders(item, [...path, String(i)], into));
    return;
  }
  if (!isObject(node)) return;
  for (const [key, value] of Object.entries(node)) {
    if (key === 'x-mcp-header') {
      into.push({ value, path: [...path, key], owner: node });
      continue;
    }
    collectHeaders(value, [...path, key], into);
  }
}

/**
 * True when the annotated property is reachable from the schema root through
 * `properties` keys only. A hop through `items`, a combinator or a `$ref` makes
 * the header's presence depend on the instance, which a client cannot resolve
 * statically.
 */
function reachableStatically(path: string[]): boolean {
  const segments = path.slice(0, -1);
  if (segments.length < 2 || segments.length % 2 !== 0) return false;
  for (let i = 0; i < segments.length; i += 2) {
    if (segments[i] !== 'properties') return false;
  }
  return true;
}

function hopIn(path: string[]): string | undefined {
  return path.find((segment) => NON_PROPERTY_HOPS.includes(segment));
}

function nameOf(tool: Record<string, unknown>, index: number): string {
  const raw = tool['name'];
  return typeof raw === 'string' && raw ? raw : `tool #${index + 1} (unnamed)`;
}

const EXPECTED =
  'Every tool returned by tools/list carries a unique, token-safe name and an `inputSchema` that is a JSON Schema object of type "object", with no dangling `required` entry and no `x-mcp-header` annotation that a client would have to reject';

const SAMPLE = `{"jsonrpc":"2.0","id":2,"result":{"tools":[{
  "name": "searchProducts",
  "description": "Search the catalogue.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query":  { "type": "string" },
      "locale": { "type": "string", "x-mcp-header": "Accept-Language" }
    },
    "required": ["query"]
  },
  "outputSchema": { "type": "object", "properties": { "results": { "type": "array" } } }
}]}}

// x-mcp-header rules, all statically checkable:
//   value is a non-empty RFC 9110 token — no space, no CR/LF, no ":"
//   values are unique case-insensitively within one inputSchema
//   the annotated property is type string, integer or boolean — never number
//   the path to it is properties-only: no items, oneOf, allOf, $ref hop`;

export class McpToolContractValidityAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'agent-interfaces/mcp-tool-contract-validity',
    category: 'agent-interfaces',
    title: 'Tool Contract Validity and Silent-Drop Risk',
    failureTitle: 'Tool Contract Validity and Silent-Drop Risk',
    description:
      'Static validation of every tool definition returned by tools/list against the MUST/SHOULD-level structural rules in the 2026-07-28 tools spec — with special weight on x-mcp-header violations, which oblige conforming clients to silently remove the offending tool from the list they show the model.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('A', 'scored'),
    evidenceGrade: 'A',
    tier: 'scored',
    dossier: 'docs/evidence/audits/agent-interfaces/mcp-tool-contract-validity.md',
    requires: ['origin-reachable'],
    defaultPriority: 'critical',
    guidance: {
      impact:
        "The spec gives clients an explicit deletion instruction: 'Clients using the Streamable HTTP transport MUST reject tool definitions where any x-mcp-header value violates these constraints. Rejection means the client MUST exclude the invalid tool from the result of tools/list.' This makes malformed tool metadata a silent-invisibility bug rather than an error: the server returns the tool, logs a successful tools/list, and the model never sees it. The constraint set is fully machine-checkable with no network calls beyond the one list fetch — token syntax, no CR/LF, case-insensitive uniqueness, primitive types only with `number` explicitly excluded, and static reachability through a chain consisting solely of `properties` keys. Alongside it, `inputSchema` MUST be a valid JSON Schema object and not null; a null or scalar inputSchema breaks argument construction in every SDK.",
      fix: 'Give every tool an `inputSchema` that is a real JSON Schema object with `"type": "object"`, and make sure every string in `required` is a key of `properties` — a dangling entry fails validation in the client before the call is ever made. Keep names inside `/^[A-Za-z0-9_.\\-]+$/`, at most 128 characters, unique within the server, and inside printable ASCII, so no client has to fall back to the `=?base64?…?=` sentinel encoding of the Mcp-Name header. For `x-mcp-header`: use a non-empty RFC 9110 token with no space, colon or CR/LF; keep the values unique case-insensitively inside one schema; annotate only properties of type string, integer or boolean — `number` is not allowed; and put the annotated property directly under `properties`, never behind `items`, `oneOf`, `allOf` or a `$ref`. If you publish `outputSchema`, it must be a JSON Schema object too, and your results must conform to it.',
      code: SAMPLE,
      effort: 'moderate',
      docsUrl:
        'https://forkpoint.github.io/agent-lighthouse/audits/agent-interfaces/mcp-tool-contract-validity/',
      tags: ['mcp', 'tools', 'json-schema', 'x-mcp-header', 'agent-protocol'],
    },
  };

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const endpoint = discoverMcpEndpoint(ctx);
    if (!endpoint || !endpoint.url) {
      return this.notApplicable(
        'This site declares no MCP endpoint, so there are no tool definitions to validate.',
        EXPECTED,
        endpoint ? `Malformed declaration (${endpoint.source})` : 'No declared MCP endpoint',
      );
    }

    const url = endpoint.url;
    const { tools, truncated, pages } = await listTools(ctx, url, MAX_PAGES);

    if (tools.length === 0) {
      return this.notApplicable(
        `${url} returned no tool definitions, so there is no contract to validate. Whether the endpoint answers at all is scored by agent-interfaces/mcp-modern-era-reachability.`,
        EXPECTED,
        `${url}; 0 tools listed`,
      );
    }

    const musts: string[] = [];
    const shoulds: string[] = [];
    let headerViolations = 0;
    let clean = 0;
    const seenNames = new Map<string, number>();

    for (const [index, tool] of tools.entries()) {
      const label = nameOf(tool, index);
      const before = musts.length;

      // Names — all SHOULD level, but a duplicate is how a client loses a tool.
      const name = typeof tool['name'] === 'string' ? tool['name'] : '';
      if (!name) {
        musts.push(`${label} carries no \`name\``);
      } else {
        seenNames.set(name, (seenNames.get(name) ?? 0) + 1);
        if (name.length > MAX_NAME) {
          shoulds.push(`\`${name.slice(0, 24)}…\` is ${name.length} characters, over the ${MAX_NAME} limit`);
        }
        if (!NAME_PATTERN.test(name)) {
          shoulds.push(`\`${name}\` is outside /^[A-Za-z0-9_.\\-]+$/`);
        }
        if ([...name].some((ch) => ch.codePointAt(0)! < 0x21 || ch.codePointAt(0)! > 0x7e)) {
          shoulds.push(
            `\`${name}\` leaves printable ASCII, forcing clients into the \`=?base64?…?=\` sentinel encoding of the Mcp-Name header`,
          );
        }
      }

      // inputSchema — MUST level, and the SDKs break outright without it.
      const schema = tool['inputSchema'];
      if (!isObject(schema)) {
        musts.push(
          `${label} has \`inputSchema\` ${schema === null ? 'null' : schema === undefined ? 'missing' : `of type ${typeof schema}`}, and every SDK builds arguments from it`,
        );
      } else {
        if (schema['type'] !== 'object') {
          musts.push(
            `${label} has \`inputSchema.type\` ${JSON.stringify(schema['type'] ?? null)} rather than "object"`,
          );
        }
        const properties = isObject(schema['properties']) ? schema['properties'] : {};
        const required = Array.isArray(schema['required']) ? schema['required'] : [];
        const dangling = required.filter(
          (key): key is string => typeof key === 'string' && !(key in properties),
        );
        if (dangling.length > 0) {
          musts.push(
            `${label} requires ${dangling.map((k) => `\`${k}\``).join(', ')}, which \`properties\` does not define, so every call fails validation before it is sent`,
          );
        }

        // x-mcp-header — the rules whose penalty is deletion.
        const uses: HeaderUse[] = [];
        collectHeaders(schema, [], uses);
        const byLower = new Map<string, number>();
        for (const use of uses) {
          const violations: string[] = [];
          const value = use.value;
          if (typeof value !== 'string' || value.length === 0) {
            violations.push('the value is not a non-empty string');
          } else {
            if (/[\r\n]/.test(value)) violations.push('the value embeds CR or LF');
            else if (!TCHAR.test(value)) violations.push(`"${value}" is not an RFC 9110 token`);
            const lower = value.toLowerCase();
            byLower.set(lower, (byLower.get(lower) ?? 0) + 1);
            if ((byLower.get(lower) ?? 0) > 1) {
              violations.push(`"${value}" repeats case-insensitively inside one inputSchema`);
            }
          }
          const type = use.owner['type'];
          if (typeof type !== 'string' || !HEADER_TYPES.includes(type)) {
            violations.push(
              `it annotates a property of type ${JSON.stringify(type ?? null)}, and only string, integer and boolean are allowed`,
            );
          }
          if (!reachableStatically(use.path)) {
            const hop = hopIn(use.path);
            violations.push(
              hop
                ? `it is reached through \`${hop}\`, so the path from the schema root is not properties-only`
                : 'it is not reachable from the schema root through `properties` keys only',
            );
          }
          if (violations.length > 0) {
            headerViolations += 1;
            musts.push(`${label} has an \`x-mcp-header\` where ${violations.join(', and ')} — ${DELETION}`);
          }
        }
      }

      const output = tool['outputSchema'];
      if (output !== undefined && !isObject(output)) {
        musts.push(
          `${label} declares an \`outputSchema\` that is not a JSON Schema object, so a client cannot validate the result it promised to conform to`,
        );
      }

      if (musts.length === before) clean += 1;
    }

    for (const [name, count] of seenNames) {
      if (count > 1) shoulds.push(`\`${name}\` is defined ${count} times within one server`);
    }

    const ratio = clean / tools.length;
    const found = [
      url,
      `${tools.length} tool(s) across ${pages + 1} page(s)${truncated ? ` (stopped at ${MAX_PAGES})` : ''}`,
      `${clean} pass every MUST (${Math.round(ratio * 100)}%)`,
      `${headerViolations} x-mcp-header violation(s)`,
      `${shoulds.length} SHOULD-level finding(s)`,
    ].join('; ');

    const list = (items: string[]) => {
      const shown = items.slice(0, MAX_SHOWN).join('; ');
      return items.length > MAX_SHOWN ? `${shown} (${items.length - MAX_SHOWN} more)` : shown;
    };

    if (musts.length > 0) {
      const lead =
        headerViolations > 0
          ? `${headerViolations} tool definition(s) carry an \`x-mcp-header\` a client must reject, which alone decides this check whatever the pass ratio: `
          : '';
      return this.fail(
        `${lead}${list(musts)}. ${clean} of ${tools.length} tool(s) pass every MUST.`,
        EXPECTED,
        found,
        'critical',
      );
    }

    if (shoulds.length > 0) {
      return this.warn(
        `Every tool passes the MUST-level rules, with naming findings: ${list(shoulds)}.`,
        EXPECTED,
        found,
        'medium',
      );
    }

    return this.pass(
      `All ${tools.length} tool definition(s) are structurally valid: object inputSchemas, no dangling \`required\` entry, no \`x-mcp-header\` a client would reject.`,
      EXPECTED,
      found,
    );
  }
}
