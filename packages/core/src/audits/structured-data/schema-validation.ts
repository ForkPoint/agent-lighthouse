import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import { weightForGrade } from '../../scorer';
import { flattenJsonLd } from '../../parser';

export class SchemaValidationAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'structured-data/schema-validation',
    category: 'structured-data',
    title: 'Schema validation',
    failureTitle: 'Schema validation',
    description:
      'AI agents parse @context and @type to identify entity types in your structured data. Blocks missing these properties are silently ignored by every schema consumer, including Google, ChatGPT plugins, and RAG pipelines. Add "@context": "https://schema.org" and a valid @type to each block.',
    scoreDisplayMode: 'binary',
    weight: weightForGrade('A', 'scored'),
    evidenceGrade: 'A',
    tier: 'scored',
    dossier: 'docs/evidence/audits/structured-data/schema-validation.md',
    defaultPriority: 'critical',
    guidance: {
      impact:
        'JSON-LD blocks missing @context or @type are silently ignored by every schema consumer, including Google, ChatGPT plugins, and RAG pipelines. Even if you have structured data on the page, invalid blocks provide zero value to AI agents.',
      fix: 'Ensure every JSON-LD block includes "@context": "https://schema.org" and a valid @type property. If using @graph, each item inside must also have @type.',
      code: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "Page Title",
  "description": "Page description"
}
</script>`,
      effort: 'trivial',
      docsUrl: 'https://json-ld.org/spec/latest/json-ld/',
      tags: ['json-ld', 'schema', 'validation', 'foundation'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    // Keep each block tied to the page it came from, so a failure can name
    // *which* blocks (by @type) and *where* they are — not just a count.
    // `@graph` containers are JSON-LD document wrappers, not schema entities:
    // they legitimately carry only @context + @graph and no @type, so they must
    // not be validated as blocks (their children are flattened out separately).
    const flat: Array<{ obj: Record<string, unknown>; pageUrl: string }> = [];
    for (const p of ctx.pages) {
      for (const b of flattenJsonLd(p.structuredData ?? p.jsonLd)) {
        const obj = b as Record<string, unknown>;
        if ('@graph' in obj) continue;
        // Pure node references (e.g. `{ "@id": "..." }`) are references, not entity blocks
        const keys = Object.keys(obj);
        if (!obj['@type'] && keys.every((k) => k === '@id' || k === '@context')) {
          continue;
        }
        flat.push({ obj, pageUrl: p.url });
      }
    }

    if (flat.length === 0) {
      return this.fail(
        'No JSON-LD blocks to validate.',
        'All JSON-LD blocks have @context and @type.',
        'No JSON-LD blocks found.',
        {
          priority: 'critical',
          description:
            'AI agents parse @context and @type to determine the schema vocabulary and entity type. Without these properties, the JSON-LD block is meaningless to any machine reader. Ensure every JSON-LD block includes "@context": "https://schema.org" and a valid @type.',
          code: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "Page Title"
}
</script>`,
        },
      );
    }

    const invalid = flat.filter(({ obj }) => !obj['@context'] || !obj['@type']);

    if (invalid.length === 0) {
      return this.pass(
        `All ${flat.length} schema block(s) have valid @context and @type.`,
        'All JSON-LD blocks have @context and @type.',
        `${flat.length}/${flat.length} valid`,
      );
    }

    // Name the offenders — "<@type> on <path>" — deduped and capped so the
    // one-line reason stays scannable in the report.
    const offenders = [
      ...new Set(invalid.map(({ obj, pageUrl }) => `${schemaType(obj['@type'])} on ${pathOf(pageUrl)}`)),
    ];
    const shown = offenders.slice(0, 4).join(', ');
    const more = offenders.length > 4 ? ` +${offenders.length - 4} more` : '';

    return this.fail(
      `${invalid.length} of ${flat.length} schema block(s) missing @context or @type — ${shown}${more}.`,
      'All JSON-LD blocks have @context and @type.',
      `${flat.length - invalid.length}/${flat.length} valid`,
      {
        priority: 'high',
        description:
          'AI agents parse @context and @type to identify entity types in your structured data. Blocks missing these properties are silently ignored by every schema consumer, including Google, ChatGPT plugins, and RAG pipelines. Add "@context": "https://schema.org" and a valid @type to each block.',
        code: `"@context": "https://schema.org",
"@type": "WebPage"`,
      },
    );
  }
}

/** Short label for a JSON-LD `@type` (first of an array; last path segment). */
function schemaType(type: unknown): string {
  const t = Array.isArray(type) ? type.find((v) => typeof v === 'string' && v) : type;
  if (typeof t === 'string' && t.trim()) return t.split(/[/#]/).pop() || t;
  return '(untyped)';
}

/** Path portion of a page URL, for compact "on /path" labels. */
function pathOf(url: string): string {
  try {
    return new URL(url).pathname || '/';
  } catch {
    return url;
  }
}
