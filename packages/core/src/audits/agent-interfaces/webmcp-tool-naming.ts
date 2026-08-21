// TODO(split): naming rule -> agent-interfaces/openapi-operation-ids; runtime part deferred to a future MCP tools/list check (not a v2.0 audit) (Plan 4).
import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import { weightForGrade } from '../../scorer';
import type { CheckContext } from '../../check-context';

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

/** Coerce an unknown JSON value to a string; non-strings → ''. */
function asString(val: unknown): string {
  return typeof val === 'string' ? val : '';
}

function tryParseJson(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}

const VERB_PATTERN =
  /^(get|search|find|list|add|create|update|remove|delete|submit|check|view|browse|filter|sort|compare|subscribe|unsubscribe|track|cancel|buy|checkout|pay|register|login|signup|contact|send|request|book|reserve|download|export|import|upload|apply|calculate|estimate|validate|verify|reset|set|toggle|select|deselect|clear|save|load|fetch|query|lookup|retrieve|show|display|open|close|start|stop|pause|resume|join|leave|follow|unfollow|like|dislike|share|rate|review|comment|post|reply|forward|archive|pin|unpin|mark|unmark|tag|untag|assign|claim|release|approve|reject|accept|decline|confirm|deny|enable|disable|activate|deactivate|install|uninstall|connect|disconnect)([A-Z]|$)/;

const MIN_DESCRIPTION_LENGTH = 20;

export class WebmcpToolNamingAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'agent-interfaces/webmcp-tool-naming',
    category: 'agent-interfaces',
    title: 'WebMCP tool naming conventions',
    failureTitle: 'WebMCP tool naming conventions',
    description:
      "WebMCP tools should follow verb-based camelCase naming (e.g., searchProducts, addToCart) and have descriptions of at least 20 characters. This helps AI agents understand the tool's purpose and invoke the correct one.",
    scoreDisplayMode: 'informative',
    weight: weightForGrade('C', 'informative'),
    evidenceGrade: 'C',
    tier: 'informative',
    dossier: 'docs/evidence/audits/agent-interfaces/webmcp-tool-naming.md',
    defaultPriority: 'low',
    guidance: {
      impact:
        'Poorly named tools (e.g., "form1", "action") make it harder for AI agents to select the right tool for a user\'s intent. Agents rely heavily on tool names and descriptions to decide which actions to take.',
      fix: 'Use verb-based camelCase names that describe the action (e.g., searchProducts, addToCart, submitInquiry) and descriptions of at least 20 characters explaining what the tool does.',
      code: `<!-- Good naming -->
<form toolname="searchProducts"
      tooldescription="Search the product catalog by keyword, category, price range, and other filters">
  ...
</form>

<!-- Bad naming -->
<form toolname="form1"
      tooldescription="Search">
  ...
</form>`,
      effort: 'trivial',
      docsUrl: 'https://webmcp.link/',
      tags: ['webmcp', 'naming', 'best-practices', 'chrome-146'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const seen = new Set<string>();
    const tools: Array<{ name: string; description: string; source: string }> = [];

    // Collect from manifest first (canonical source)
    const manifestResult = ctx.rootFiles['/.well-known/webmcp'];
    if (manifestResult?.status === 200 && manifestResult.body) {
      const parsed = tryParseJson(manifestResult.body);
      if (isObject(parsed) && Array.isArray(parsed['tools'])) {
        for (const tool of parsed['tools'] as unknown[]) {
          if (isObject(tool)) {
            const name = asString(tool['name']);
            tools.push({
              name,
              description: asString(tool['description']),
              source: 'manifest',
            });
            if (name) seen.add(name);
          }
        }
      }
    }

    // Collect from declarative forms, skip duplicates
    for (const page of ctx.pages) {
      page.$('form[toolname]').each((_, el) => {
        const name = page.$(el).attr('toolname') || '';
        if (name && seen.has(name)) return;
        const desc = page.$(el).attr('tooldescription') || '';
        tools.push({ name, description: desc, source: 'declarative' });
        if (name) seen.add(name);
      });
    }

    if (tools.length === 0) {
      return this.notApplicable(
        'No WebMCP tools found — tool naming cannot be assessed.',
        'Tool names follow verb-based camelCase with 20+ char descriptions',
        'No WebMCP tools',
      );
    }

    let goodNames = 0;
    let goodDescriptions = 0;
    const badNames: string[] = [];
    const shortDescriptions: string[] = [];

    for (const tool of tools) {
      if (VERB_PATTERN.test(tool.name)) {
        goodNames++;
      } else {
        badNames.push(tool.name);
      }
      if (tool.description.length >= MIN_DESCRIPTION_LENGTH) {
        goodDescriptions++;
      } else {
        shortDescriptions.push(tool.name);
      }
    }

    const allGood = goodNames === tools.length && goodDescriptions === tools.length;

    if (allGood) {
      return this.pass(
        `All ${tools.length} tool(s) follow naming conventions with adequate descriptions.`,
        'Verb-based camelCase names with 20+ char descriptions',
        `${goodNames}/${tools.length} good names, ${goodDescriptions}/${tools.length} good descriptions`,
      );
    }

    const issues: string[] = [];
    if (badNames.length > 0) {
      issues.push(`non-verb names: ${badNames.join(', ')}`);
    }
    if (shortDescriptions.length > 0) {
      issues.push(`short descriptions: ${shortDescriptions.join(', ')}`);
    }

    if (goodNames >= tools.length / 2) {
      return this.warn(
        `${goodNames}/${tools.length} tools follow naming conventions. Issues: ${issues.join('; ')}.`,
        'Verb-based camelCase names with 20+ char descriptions',
        `${goodNames}/${tools.length} good names, ${goodDescriptions}/${tools.length} good descriptions`,
        'low',
      );
    }

    return this.fail(
      `Only ${goodNames}/${tools.length} tools follow naming conventions. Issues: ${issues.join('; ')}.`,
      'Verb-based camelCase names with 20+ char descriptions',
      `${goodNames}/${tools.length} good names, ${goodDescriptions}/${tools.length} good descriptions`,
      'low',
    );
  }
}
