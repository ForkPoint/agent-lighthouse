import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import { weightForGrade } from "../../scorer";
import type { CheckContext, PageContext } from "../../check-context";
import { AI_CATALOG_PATH, describeFailure, readAiCatalog } from "./_ard";

/** `<link ...; rel="ai-catalog">` in an HTTP Link header (RFC 8288). */
const LINK_HEADER_RE = /<([^>]+)>\s*;[^,]*?\brel\s*=\s*"?([^",;]+)"?/gi;

/**
 * Where a site says its AI catalog lives — ARD §6.1's `rel="ai-catalog"`.
 *
 * The absorbed audit keyed on `rel="alternate"` + `type="application/json"` +
 * an English `title` containing the exact phrase "ai catalog", which no site on
 * the public web emits. The real token is `ai-catalog`, matched here as a rel
 * token (case-insensitive, any position in a multi-token rel, any media type)
 * and also accepted from the HTTP `Link` header, across every crawled page.
 */
function findCatalogAdvertisement(
  pages: readonly PageContext[],
):
  | { href: string; source: "link-tag" | "link-header"; pageUrl: string }
  | undefined {
  for (const page of pages) {
    for (const link of page.headLinks ?? []) {
      if (!link.href) continue;
      const rels = link.rel.toLowerCase().split(/\s+/);
      if (rels.includes("ai-catalog")) {
        return { href: link.href, source: "link-tag", pageUrl: page.url };
      }
    }

    const header = page.fetchResult?.headers?.["link"];
    if (!header) continue;
    for (const match of header.matchAll(LINK_HEADER_RE)) {
      if (match[2]!.toLowerCase().split(/\s+/).includes("ai-catalog")) {
        return { href: match[1]!, source: "link-header", pageUrl: page.url };
      }
    }
  }
  return undefined;
}

const EXPECTED = `${AI_CATALOG_PATH} returns 200 with an ARD §4.1 manifest: specVersion, host and a non-empty entries array`;

// The schema is ARD v0.9 §4.1-4.3, mirroring the spec's own conformance
// example. Every field below appears in live manifests (neon.com, weaviate.io,
// the Shopware core template); the framework's previous `services`/`owner`/
// `contact`/`lastUpdated` sample appears in none of them.
const SAMPLE = `// /.well-known/ai-catalog.json  (Content-Type: application/ai-catalog+json)
{
  "specVersion": "1.0",
  "host": {
    "displayName": "Your Site",
    "identifier": "did:web:yoursite.com",
    "documentationUrl": "https://yoursite.com/docs"
  },
  "entries": [
    {
      "identifier": "urn:air:yoursite.com:server:search",
      "displayName": "Product Search",
      "type": "application/mcp-server-card+json",
      "url": "https://yoursite.com/mcp/search.json",
      "description": "Search the product catalog by keyword, category or price.",
      "capabilities": ["searchProducts"],
      "representativeQueries": ["find blue running shoes under $100"]
    }
  ]
}

<!-- Optional: advertise it (ARD §6.1). The one documented consumer still
     resolves only the well-known path, so this never replaces the file. -->
<link rel="ai-catalog" type="application/ai-catalog+json" href="/.well-known/ai-catalog.json">`;

export class AiCatalogExistsAudit extends Audit {
  static override meta: AuditMeta = {
    id: "agent-interfaces/ai-catalog-exists",
    category: "agent-interfaces",
    title: "AI Catalog exists",
    failureTitle: "AI Catalog exists",
    description:
      "The AI catalog is the ARD discovery manifest that tells AI agents which MCP servers, agent cards, skills and API descriptions your site offers. Hugging Face's hf-discover resolves it at /.well-known/ai-catalog.json and reads its entries; without it, agents must probe endpoints to work out what your site can do.",
    scoreDisplayMode: "informative",
    weight: weightForGrade("C", "informative"),
    evidenceGrade: "C",
    tier: "informative",
    dossier: "docs/evidence/audits/agent-interfaces/ai-catalog-exists.md",
    requires: [
      "origin-reachable",
      "unblocked-fetches",
      "rendered-body",
      "sample-adequate",
    ],
    defaultPriority: "medium",
    guidance: {
      impact:
        "Without an AI catalog, agents must probe multiple endpoints to discover your services. This wastes time, increases error rates, and often results in agents skipping your site entirely in favor of competitors with a machine-readable capability manifest.",
      fix: 'Serve /.well-known/ai-catalog.json as application/ai-catalog+json with the three fields ARD §4.1 requires — specVersion, a host object naming your site, and an entries array where each entry has an identifier, displayName, type and either a url or inline data. Optionally advertise it with <link rel="ai-catalog"> or the equivalent HTTP Link header, but serve it at the well-known path, which is the only location a documented consumer resolves.',
      code: SAMPLE,
      effort: "easy",
      docsUrl: "https://github.com/ards-project/ard-spec/blob/main/spec/ard.md",
      tags: ["ai-catalog", "discovery", "agent-protocol", "ard"],
    },
  };

  private recommendation() {
    return {
      priority: "medium" as const,
      description: AiCatalogExistsAudit.meta.description,
      code: SAMPLE,
    };
  }

  audit(ctx: CheckContext): AuditResult {
    // Absorbed from ai-catalog-link (4.19). The advertisement is a
    // nice-to-have relative to the well-known file: the one known consumer
    // (Hugging Face hf-discover) resolves only /.well-known/ai-catalog.json,
    // so a rel="ai-catalog" link never passes this audit on its own — it turns
    // "no catalog" into "a catalog is advertised but not served there".
    const ad = findCatalogAdvertisement(ctx.pages);
    const read = readAiCatalog(ctx);

    if (!read.ok) {
      const message = describeFailure(read);

      // The advertisement only mitigates *absence*. When a manifest is served
      // and merely malformed, saying "advertised but not served there" would be
      // a wrong diagnosis, so the ad is reported as context instead.
      if (ad && (read.reason === "absent" || read.reason === "html")) {
        return this.warn(
          `${message} A catalog is advertised as ${ad.href} via rel="ai-catalog" (${ad.source}), but the one documented consumer resolves only ${AI_CATALOG_PATH}.`,
          EXPECTED,
          `${read.found}; advertised at ${ad.href}`,
          this.recommendation(),
          ad.pageUrl,
        );
      }

      return this.fail(
        message,
        EXPECTED,
        ad ? `${read.found}; also advertised via rel="ai-catalog"` : read.found,
        this.recommendation(),
        ad?.pageUrl,
      );
    }

    const { manifest } = read;
    const advertised = ad
      ? `; also advertised via rel="ai-catalog" (${ad.source})`
      : "";

    // Spec-conformant but inert: `entries: []` satisfies §4.1 and tells an
    // agent nothing. The pre-rewrite audit reported the same shape as a pass.
    if (manifest.entries.length === 0) {
      return this.warn(
        `${AI_CATALOG_PATH} is a valid ARD manifest (specVersion ${manifest.specVersion}) but lists no entries, so it advertises no capability to an agent.`,
        EXPECTED,
        `Valid ARD manifest with 0 entries${advertised}`,
        this.recommendation(),
        ad?.pageUrl,
      );
    }

    const count = manifest.entries.length;
    return this.pass(
      `AI catalog found: a valid ARD manifest (specVersion ${manifest.specVersion}) with ${count} entr${count === 1 ? "y" : "ies"}.`,
      EXPECTED,
      `Valid ARD manifest with ${count} entr${count === 1 ? "y" : "ies"}${advertised}`,
      ad?.pageUrl,
    );
  }
}
