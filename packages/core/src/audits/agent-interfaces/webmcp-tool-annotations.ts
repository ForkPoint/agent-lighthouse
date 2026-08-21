// TODO(merge): folds into agent-interfaces/mcp-endpoint in Plan 4 (approved 2026-08-21).
import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import { weightForGrade } from '../../scorer';
import type { CheckContext } from '../../check-context';

function tryParseJson(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

/** Coerce an unknown JSON value to a string; non-strings → ''. */
function asString(val: unknown): string {
  return typeof val === 'string' ? val : '';
}

// readOnlyHint is in the WebMCP spec; the rest are from MCP and commonly used together
const SAFETY_ANNOTATIONS = ['readOnlyHint', 'destructiveHint', 'idempotentHint', 'openWorldHint'];

export class WebmcpToolAnnotationsAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'agent-interfaces/webmcp-tool-annotations',
    category: 'agent-interfaces',
    title: 'WebMCP tool safety annotations',
    failureTitle: 'WebMCP tool safety annotations',
    description:
      'WebMCP tools should include the readOnlyHint annotation (defined in the WebMCP spec) and ideally MCP-compatible annotations like destructiveHint and idempotentHint, so AI agents can make informed decisions about when to invoke tools and whether to ask for user confirmation.',
    scoreDisplayMode: 'informative',
    weight: weightForGrade('D', 'informative'),
    evidenceGrade: 'D',
    tier: 'informative',
    dossier: 'docs/evidence/audits/agent-interfaces/webmcp-tool-annotations.md',
    defaultPriority: 'medium',
    guidance: {
      impact:
        'Without safety annotations, AI agents treat all tools equally — a "delete account" tool looks the same as a "search products" tool. Annotations let agents automatically request user confirmation for destructive actions and freely use read-only tools, improving both safety and user experience.',
      fix: 'Add annotation properties to your WebMCP tool definitions in the manifest or as data attributes on declarative forms.',
      code: `// In /.well-known/webmcp manifest
{
  "tools": [
    {
      "name": "searchProducts",
      "description": "Search the product catalog",
      "annotations": {
        "readOnlyHint": true,
        "destructiveHint": false,
        "idempotentHint": true
      },
      "inputSchema": { ... }
    },
    {
      "name": "addToCart",
      "description": "Add a product to the cart",
      "annotations": {
        "readOnlyHint": false,
        "destructiveHint": false,
        "idempotentHint": false
      },
      "inputSchema": { ... }
    }
  ]
}

<!-- Or on declarative forms -->
<form toolname="addToCart"
      tooldescription="Add a product to the shopping cart"
      data-readonly="false"
      data-destructive="false">`,
      effort: 'easy',
      docsUrl: 'https://webmcp.link/',
      tags: ['webmcp', 'annotations', 'safety', 'chrome-146'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    let totalTools = 0;
    let toolsWithAnnotations = 0;
    const annotationsFound: string[] = [];
    const seen = new Set<string>();

    // Check manifest tools (canonical source)
    const manifestResult = ctx.rootFiles['/.well-known/webmcp'];
    if (manifestResult?.status === 200 && manifestResult.body) {
      const parsed = tryParseJson(manifestResult.body);
      if (isObject(parsed) && Array.isArray(parsed['tools'])) {
        for (const tool of parsed['tools'] as unknown[]) {
          if (!isObject(tool)) continue;
          const name = asString(tool['name']);
          totalTools++;
          if (name) seen.add(name);
          const annotations = tool['annotations'];
          if (isObject(annotations)) {
            const found = SAFETY_ANNOTATIONS.filter((a) => a in annotations);
            if (found.length > 0) {
              toolsWithAnnotations++;
              for (const f of found) {
                if (!annotationsFound.includes(f)) annotationsFound.push(f);
              }
            }
          }
        }
      }
    }

    // Check declarative forms for data-* annotations, skip duplicates
    for (const page of ctx.pages) {
      page.$('form[toolname]').each((_, el) => {
        const $form = page.$(el);
        const name = $form.attr('toolname') || '';
        if (name && seen.has(name)) return;
        totalTools++;
        if (name) seen.add(name);
        const found = SAFETY_ANNOTATIONS.filter((a) => {
          const dataAttr = a.replace(/([A-Z])/g, '-$1').toLowerCase();
          return $form.attr(`data-${dataAttr}`) !== undefined;
        });
        if (found.length > 0) {
          toolsWithAnnotations++;
          for (const f of found) {
            if (!annotationsFound.includes(f)) annotationsFound.push(f);
          }
        }
      });
    }

    if (totalTools === 0) {
      return this.notApplicable(
        'No WebMCP tools found — safety annotations cannot be assessed.',
        'WebMCP tools include safety annotations',
        'No WebMCP tools',
      );
    }

    if (toolsWithAnnotations === 0) {
      return this.fail(
        `None of the ${totalTools} WebMCP tool(s) include safety annotations.`,
        'Tools include readOnlyHint, destructiveHint, or idempotentHint annotations',
        `0/${totalTools} tools with annotations`,
        'medium',
      );
    }

    if (toolsWithAnnotations < totalTools) {
      return this.warn(
        `${toolsWithAnnotations}/${totalTools} tool(s) have annotations (${annotationsFound.join(', ')}).`,
        'All tools include safety annotations',
        `${toolsWithAnnotations}/${totalTools} annotated`,
        'medium',
      );
    }

    return this.pass(
      `All ${totalTools} tool(s) include safety annotations (${annotationsFound.join(', ')}).`,
      'Tools include safety annotations',
      `${toolsWithAnnotations}/${totalTools} annotated`,
    );
  }
}
