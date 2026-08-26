// Redemption rewrite landed 2026-08-22 (Plan 4, Task 16). The audit used to
// demand a `/.well-known/webmcp` manifest — an invented artifact (dossier
// grade D): the WebMCP spec defines no manifest format at all, `webmcp` is not
// in the IANA Well-Known URIs registry, and every deployment in the wild is a
// different private schema (Zapier's self-identifies as
// "zapier-webmcp-discovery/1"). It was a binary hard FAIL at `high` priority
// for effectively every site on the web, and a site correctly implementing real
// WebMCP failed it too, because the real API leaves no static artifact.
// Evidence dossier: docs/evidence/audits/agent-interfaces/webmcp-registered-tools.md
//
// What replaces it is the mechanism Google Lighthouse 13.3+ reports in its
// Agentic Browsing category as "Registered WebMCP tools" (grade B): tools
// registered at runtime through `navigator.modelContext`. Lighthouse reads them
// from a live browser; this scanner has no JS runtime, so it reports the
// registrations it can see in the served document and says plainly that absence
// is not evidence of absence. That honesty is why the tier is `experimental`
// and the weight 0 — the check informs, it never scores.
//
// RE-CHECK TRIGGER: if this project ever gains a headless-browser gatherer,
// this audit should read `navigator.modelContext.getTools()` after load instead
// of pattern-matching source text, and the `warn`/`na` branches below collapse.
import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import { weightForGrade } from '../../scorer';
import type { CheckContext } from '../../check-context';

/** The runtime API surface. Nothing else in the platform carries this name. */
const API_RE = /navigator\s*\.\s*modelContext/;

/**
 * `registerTool("name", …)` — the string-first form.
 *
 * The descriptor-object form (`registerTool({ name: "…" })`) and
 * `provideContext({ tools: [{ name: "…" }] })` are both covered by NAME_KEY_RE
 * below, which is why this one only has to handle the bare string.
 */
const REGISTER_STRING_RE = /register(?:Tool|Tools)\s*\(\s*["'`]([^"'`]+)["'`]/g;

/**
 * A `name:` key inside the argument text of a registration call. Deliberately
 * scoped to the call's own source slice (see `callBodies`) so an unrelated
 * `name:` elsewhere in the bundle cannot be reported as a WebMCP tool.
 */
const NAME_KEY_RE = /\bname\s*:\s*["'`]([^"'`]+)["'`]/g;

/** Registration entry points defined by the WebMCP explainer. */
const CALL_RE = /\b(?:registerTool|registerTools|provideContext)\s*\(/g;

/**
 * The source text of each registration call, from the opening parenthesis to
 * its match. A brace/paren counter is enough here and cannot loop forever: it
 * stops at the end of the slice whether or not the source is balanced.
 */
function callBodies(source: string): string[] {
  const bodies: string[] = [];
  for (const match of source.matchAll(CALL_RE)) {
    const start = match.index! + match[0].length;
    let depth = 1;
    let i = start;
    for (; i < source.length && depth > 0; i++) {
      const ch = source[i];
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
    }
    bodies.push(source.slice(start, i));
  }
  return bodies;
}

interface Registration {
  /** Tool names observed in the served document, deduplicated and ordered. */
  tools: string[];
  /** A page referenced `navigator.modelContext` at all. */
  apiReferenced: boolean;
  /** A page carries a declarative WebMCP form, which another audit owns. */
  declarativeForms: boolean;
  pageUrl?: string;
}

function survey(ctx: CheckContext): Registration {
  const tools = new Set<string>();
  const result: Registration = { tools: [], apiReferenced: false, declarativeForms: false };

  for (const page of ctx.pages) {
    if (page.$('form[toolname]').length > 0) result.declarativeForms = true;

    // Inline scripts only. An external bundle is not fetched — following every
    // `<script src>` on every page would multiply the scan's request count for
    // a weight-0 signal, and a minified bundle would rarely survive matching.
    page.$('script:not([src])').each((_, el) => {
      const source = page.$(el).text();
      if (!source || !API_RE.test(source)) return;

      result.apiReferenced = true;
      if (!result.pageUrl) result.pageUrl = page.url;

      for (const match of source.matchAll(REGISTER_STRING_RE)) tools.add(match[1]!);
      for (const body of callBodies(source)) {
        for (const match of body.matchAll(NAME_KEY_RE)) tools.add(match[1]!);
      }
    });
  }

  result.tools = [...tools];
  return result;
}

const EXPECTED =
  'Tools registered at runtime through navigator.modelContext, observable in the served document';

const SAMPLE = `<!-- WebMCP is a JavaScript API: tools are registered imperatively at
     runtime. There is no manifest file, and no well-known path. -->
<script>
  navigator.modelContext.registerTool({
    name: "search_products",
    description: "Search the product catalog by keyword or category",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", description: "Search keywords" } },
      required: ["query"],
    },
    async execute({ query }) {
      const results = await fetch(\`/api/search?q=\${query}\`).then((r) => r.json());
      return { content: [{ type: "text", text: JSON.stringify(results) }] };
    },
  });
</script>`;

export class WebmcpRegisteredToolsAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'agent-interfaces/webmcp-registered-tools',
    category: 'agent-interfaces',
    title: 'WebMCP registered tools',
    failureTitle: 'WebMCP registered tools',
    description:
      'WebMCP lets a page register agent-callable tools at runtime through navigator.modelContext, which is what Chrome exposes to an in-browser agent and what Lighthouse reports as "Registered WebMCP tools". This scanner has no JavaScript runtime, so it reports the registrations visible in the served document and treats silence as unknown rather than as absence — which is why it is experimental and never scores.',
    scoreDisplayMode: 'informative',
    weight: weightForGrade('B', 'experimental'),
    evidenceGrade: 'B',
    // The mechanism is real and shipped in a Google product, but this scanner
    // can only observe it partially: no JS runtime means a tool registered from
    // an external bundle is invisible. `experimental` is the honest tier for a
    // detector that cannot distinguish "no tools" from "cannot see the tools".
    tier: 'experimental',
    dossier: 'docs/evidence/audits/agent-interfaces/webmcp-registered-tools.md',
    requires: ['origin-reachable', 'unblocked-fetches', 'rendered-body', 'sample-adequate'],
    // Was `high` on an admittedly non-standard convention, so it outranked
    // genuinely actionable items in the recommendation list.
    defaultPriority: 'low',
    guidance: {
      impact:
        'A page with no registered tools gives an in-browser agent nothing structured to call, so it falls back to reading the DOM and clicking — slower, and wrong more often on anything past a single text input. Note that this is upside rather than a deficiency: the API is an origin trial, and no site is penalised here for not having adopted it.',
      fix: 'Register your tools from the page with navigator.modelContext.registerTool(), giving each a name, a description an agent can select on, and an inputSchema. For tools that map onto a form, the declarative toolname/tooldescription attributes are simpler and are covered by the agent-interfaces/webmcp-declarative-forms audit.',
      code: SAMPLE,
      effort: 'moderate',
      docsUrl: 'https://developer.chrome.com/docs/ai/webmcp',
      tags: ['webmcp', 'agent-protocol', 'runtime-tools', 'experimental'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const found = survey(ctx);

    if (found.tools.length > 0) {
      const count = `${found.tools.length} tool${found.tools.length === 1 ? '' : 's'}`;
      return this.pass(
        `WebMCP tools are registered from the page: ${found.tools.join(', ')}.`,
        EXPECTED,
        `${count} registered via navigator.modelContext: ${found.tools.join(', ')}`,
        found.pageUrl,
      );
    }

    if (found.apiReferenced) {
      return this.warn(
        'A script references navigator.modelContext but no tool name is observable in the served document, so it cannot be confirmed that any tool is registered.',
        EXPECTED,
        'navigator.modelContext referenced, no tool name observable',
        'low',
        found.pageUrl,
      );
    }

    // Declarative forms are a different registration path, audited separately.
    // Reporting them here too would score one adoption decision twice.
    if (found.declarativeForms) {
      return this.notApplicable(
        'This site registers its tools declaratively from forms, which agent-interfaces/webmcp-declarative-forms assesses; no imperative navigator.modelContext registration was observed.',
        EXPECTED,
        'Declarative WebMCP forms only',
      );
    }

    // Absence of evidence, stated as such. A static scan cannot execute the
    // page's JavaScript, so a site registering tools from an external bundle
    // looks identical to a site with no WebMCP at all — and failing both was
    // the defect this rewrite removes.
    return this.notApplicable(
      'No WebMCP registration was observed. This scan cannot execute the page JavaScript, so tools registered from an external bundle are invisible to it and absence here is not evidence of absence.',
      EXPECTED,
      'No navigator.modelContext registration in the served document',
    );
  }
}
