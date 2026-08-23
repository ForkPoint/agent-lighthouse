import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import { weightForGrade } from '../../scorer';
import type { CheckContext } from '../../check-context';
import { AI_CATALOG_PATH, entryLabel, nonEmptyString, readAiCatalog } from './_ard';
import type { ArdEntry, ArdManifest } from './_ard';

/**
 * The keys Hugging Face's hf-discover actually indexes.
 *
 * `_entry_haystack()` in hf-discover's navigation.py builds its match text from
 * displayName, description, tags, capabilities and representativeQueries.
 * displayName is already required by ARD §4.2, so the four scored here are the
 * optional ones that decide whether a query surfaces your entry at all.
 */
const INDEXED_KEYS = ['description', 'tags', 'capabilities', 'representativeQueries'] as const;

/** Which of the indexed keys this entry actually carries. */
function indexedKeys(entry: ArdEntry): string[] {
  const present: string[] = [];
  if (entry.description) present.push('description');
  if (entry.tags.length > 0) present.push('tags');
  if (entry.capabilities.length > 0) present.push('capabilities');
  if (entry.representativeQueries.length > 0) present.push('representativeQueries');
  return present;
}

/**
 * An entry is discoverable when it has prose to match on *and* at least one
 * structured facet. A bare identifier/displayName/type triple is legal ARD but
 * contributes almost nothing to a consumer's haystack.
 */
function isDiscoverable(entry: ArdEntry): boolean {
  const present = indexedKeys(entry);
  return present.includes('description') && present.length >= 2;
}

/**
 * Optional enrichment, reported and never required.
 *
 * Levels matter: ARD §4.2 defines `updatedAt` on the **entry**, and §4.2/§4.3
 * define `trustManifest` on the **entry** and the **host**. Neither is a
 * root-level manifest field, so a root-level copy is not counted.
 */
function bonuses(manifest: ArdManifest): string[] {
  const found: string[] = [];
  const dated = manifest.entries.filter((e) => e.updatedAt).length;
  if (dated > 0) found.push(`${dated}/${manifest.entries.length} entries with updatedAt`);
  if (manifest.hostHasTrustManifest || manifest.entries.some((e) => e.hasTrustManifest)) {
    found.push('trustManifest');
  }
  return found;
}

const EXPECTED =
  'host.displayName is set and every entry carries a description plus at least one of tags, capabilities or representativeQueries (ARD §4.2)';

const SAMPLE = `// /.well-known/ai-catalog.json — the keys a consumer indexes
{
  "specVersion": "1.0",
  "host": {
    "displayName": "Your Site",
    "identifier": "did:web:yoursite.com"
  },
  "entries": [
    {
      "identifier": "urn:air:yoursite.com:server:search",
      "displayName": "Product Search",
      "type": "application/mcp-server-card+json",
      "url": "https://yoursite.com/mcp/search.json",
      "description": "Search the product catalog by keyword, category or price.",
      "tags": ["commerce", "search"],
      "capabilities": ["searchProducts", "getProduct"],
      "representativeQueries": [
        "find blue running shoes under $100",
        "is the trail jacket in stock in medium"
      ],
      "updatedAt": "2026-08-01T00:00:00Z"
    }
  ]
}`;

export class AiCatalogMetadataAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'agent-interfaces/ai-catalog-metadata',
    category: 'agent-interfaces',
    title: 'AI Catalog complete metadata',
    failureTitle: 'AI Catalog complete metadata',
    description:
      "Consumers rank AI catalog entries on their metadata: Hugging Face's hf-discover builds its match text from each entry's description, tags, capabilities and representativeQueries. An entry with only an identifier and a type is legal ARD but is nearly unmatchable, so agents searching for what you offer will not surface it.",
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('B', 'scored'),
    evidenceGrade: 'B',
    tier: 'scored',
    dossier: 'docs/evidence/audits/agent-interfaces/ai-catalog-metadata.md',
    defaultPriority: 'medium',
    guidance: {
      impact:
        'A thin catalog entry is a catalog entry nobody finds. Consumers match a user query against the entry text, so entries with no description, tags, capabilities or representative queries lose to better-described alternatives even when your service is the better answer.',
      fix: 'Name the catalog operator in host.displayName (and add a did:web identifier), then give every entry a plain-language description plus at least one of tags, capabilities or representativeQueries. Optional enrichment on top: an ISO 8601 updatedAt on each entry, and a trustManifest on the host or on individual entries — both are entry/host fields, not manifest-root ones.',
      code: SAMPLE,
      effort: 'trivial',
      docsUrl: 'https://github.com/ards-project/ard-spec/blob/main/spec/ard.md',
      tags: ['ai-catalog', 'metadata', 'agent-protocol', 'ard'],
    },
  };

  private recommendation() {
    return {
      priority: 'medium' as const,
      description: AiCatalogMetadataAudit.meta.description,
      code: SAMPLE,
    };
  }

  audit(ctx: CheckContext): AuditResult {
    const read = readAiCatalog(ctx);

    // Quality check on a manifest ai-catalog-exists already scores. When there
    // is no ARD manifest there is no metadata to grade, and charging a second
    // zero for the same absence would triple-penalize one missing file.
    if (!read.ok) {
      return this.notApplicable(
        `No ARD manifest to grade: ${AI_CATALOG_PATH} ${read.reason === 'absent' ? 'is not served' : 'is not a valid ARD manifest'} — see the AI Catalog exists check.`,
        EXPECTED,
        read.found,
      );
    }

    const { manifest } = read;
    if (manifest.entries.length === 0) {
      return this.notApplicable(
        'The ARD manifest lists no entries, so there is no entry metadata to grade.',
        EXPECTED,
        'Valid ARD manifest with 0 entries',
      );
    }

    const hostDisplayName = nonEmptyString(manifest.host['displayName']);
    const hostIdentifier = nonEmptyString(manifest.host['identifier']);

    const discoverable = manifest.entries.filter(isDiscoverable);
    const annotated = manifest.entries.filter((e) => indexedKeys(e).length > 0);
    const thin = manifest.entries.filter((e) => !isDiscoverable(e));

    const extras = [
      ...(hostIdentifier ? [] : ['no host.identifier']),
      ...bonuses(manifest),
    ];
    const found =
      `${discoverable.length}/${manifest.entries.length} entries carry description + ${INDEXED_KEYS.slice(1).join('/')}` +
      (extras.length > 0 ? `; ${extras.join(', ')}` : '');

    // Nothing indexable anywhere: the manifest exists but is invisible to a
    // consumer's search.
    if (annotated.length === 0) {
      return this.fail(
        `None of the ${manifest.entries.length} catalog entr${manifest.entries.length === 1 ? 'y carries' : 'ies carry'} any of the metadata a consumer indexes (description, tags, capabilities, representativeQueries).`,
        EXPECTED,
        found,
        this.recommendation(),
      );
    }

    if (!hostDisplayName) {
      return this.warn(
        'The AI catalog does not name its operator: host.displayName is required by ARD §4.3 and is missing.',
        EXPECTED,
        `${found}; no host.displayName`,
        this.recommendation(),
      );
    }

    if (thin.length > 0) {
      const named = thin.slice(0, 5).map(entryLabel).join(', ');
      const rest = thin.length > 5 ? `, and ${thin.length - 5} more` : '';
      return this.warn(
        `${thin.length} of ${manifest.entries.length} catalog entries are too thin for a consumer to match on: ${named}${rest}.`,
        EXPECTED,
        found,
        this.recommendation(),
      );
    }

    return this.pass(
      `All ${manifest.entries.length} catalog entries carry the metadata a consumer indexes, under a named host (${hostDisplayName}).`,
      EXPECTED,
      found,
    );
  }
}
