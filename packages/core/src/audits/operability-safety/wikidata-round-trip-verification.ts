import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import type { CheckContext } from '../../check-context';
import { weightForGrade } from '../../scorer';
import { isSafeUrl } from '../../fetcher';
import { allJsonLdNodes } from '../../parser';
import { registrableOf, registrableDomain } from '../../gatherers/domains';

/** Q-ids resolved per scan. Each is a request to Wikidata. */
const MAX_ENTITIES = 2;

/** The property that holds an entity's official website. */
const OFFICIAL_WEBSITE = 'P856';

/** Statement ranks, in the order a consumer prefers them. */
const RANK_ORDER: Record<string, number> = { preferred: 2, normal: 1, deprecated: 0 };

/** Types whose sameAs is an identity claim rather than a reading list. */
const IDENTITY_TYPES = /^(Organization|Corporation|NewsMediaOrganization|LocalBusiness|Person|Brand)$/;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The Wikidata Q-id a URL names, if it names one. */
export function wikidataId(raw: string): string | undefined {
  const match = /^https?:\/\/(www\.)?wikidata\.org\/(wiki|entity)\/(Q\d+)/i.exec(raw.trim());
  return match ? match[3]!.toUpperCase() : undefined;
}

/** Every Q-id the page's identity nodes claim, in document order. */
export function claimedEntities(jsonLd: object[]): string[] {
  const out: string[] = [];
  for (const node of allJsonLdNodes(jsonLd)) {
    if (!isObject(node)) continue;
    const type = node['@type'];
    const types = (Array.isArray(type) ? type : [type]).filter((t): t is string => typeof t === 'string');
    if (!types.some((t) => IDENTITY_TYPES.test(t))) continue;

    const sameAs = node['sameAs'];
    for (const value of Array.isArray(sameAs) ? sameAs : [sameAs]) {
      if (typeof value !== 'string') continue;
      const id = wikidataId(value);
      if (id !== undefined && !out.includes(id)) out.push(id);
    }
  }
  return out;
}

/** The best-ranked P856 website in a wbgetclaims response. */
export function officialWebsite(body: string): string | undefined {
  const parsed = (() => {
    try {
      return JSON.parse(body) as { claims?: Record<string, unknown> };
    } catch {
      return undefined;
    }
  })();
  const claims = parsed?.claims?.[OFFICIAL_WEBSITE];
  if (!Array.isArray(claims)) return undefined;

  let best: { rank: number; value: string } | undefined;
  for (const claim of claims) {
    if (!isObject(claim)) continue;
    const rank = RANK_ORDER[String(claim['rank'] ?? 'normal')] ?? 1;
    if (rank === 0) continue;
    const snak = isObject(claim['mainsnak']) ? claim['mainsnak'] : undefined;
    const datavalue = snak && isObject(snak['datavalue']) ? snak['datavalue'] : undefined;
    const value = datavalue?.['value'];
    if (typeof value !== 'string') continue;
    if (!best || rank > best.rank) best = { rank, value };
  }
  return best?.value;
}

export class WikidataRoundTripVerificationAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'operability-safety/wikidata-round-trip-verification',
    category: 'operability-safety',
    title: 'The Wikidata entity this site claims points back at this site',
    failureTitle: 'This site’s Wikidata identity claim is not reciprocated',
    description:
      'Takes the Wikidata Q-id the site claims in its Organization or Person `sameAs`, asks Wikidata what that entity gives as its official website (P856), and compares registrable domains. A `sameAs` is self-asserted and any site can claim any entity; only the round trip is evidence.',
    scoreDisplayMode: 'ternary',
    tier: 'scored',
    evidenceGrade: 'B',
    weight: weightForGrade('B', 'scored'),
    defaultPriority: 'medium',
    dossier: 'docs/evidence/audits/operability-safety/wikidata-round-trip-verification.md',
    requires: ['origin-reachable', 'unblocked-fetches', 'rendered-body', 'sample-adequate'],
    guidance: {
      impact:
        'A knowledge-graph consumer that grounds a brand to an entity needs corroboration from the authority side, because `sameAs` carries no reciprocity requirement — Google documents it as a link to a page with more information, nothing more. Wikidata publishes that corroboration for free as P856. A claim whose entity points at an unrelated domain is either the wrong entity or an unbacked identity claim, and an answer engine that resolves it grounds the brand to somebody else.',
      fix: 'Claim the entity that really is your organization, and make sure the Wikidata item carries your domain as its official website (P856). If the item has no P856 at all, add one: until it does, the claim cannot be corroborated by anyone.',
      effort: 'moderate',
      docsUrl:
        'https://forkpoint.github.io/agent-lighthouse/audits/operability-safety/wikidata-round-trip-verification/',
      tags: ['identity', 'wikidata', 'knowledge-graph', 'sameas'],
    },
  };

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const entities = [...new Set(ctx.pages.flatMap((page) => claimedEntities(page.jsonLd)))];
    if (entities.length === 0) {
      return this.notApplicable(
        'No page claims a Wikidata entity.',
        'An Organization or Person node whose sameAs names a Wikidata entity',
        'No wikidata.org URL found in any sameAs',
      );
    }

    const site = registrableOf(ctx.baseUrl);
    const failures: string[] = [];
    const warnings: string[] = [];
    const verified: string[] = [];

    for (const id of entities.slice(0, MAX_ENTITIES)) {
      const url = `https://www.wikidata.org/w/api.php?action=wbgetclaims&entity=${id}&property=${OFFICIAL_WEBSITE}&format=json`;
      if (!(await isSafeUrl(url))) {
        warnings.push(`${id}: Wikidata could not be reached, so the claim is unverified`);
        continue;
      }
      const response = await ctx.fetch({ url, acceptHeader: 'application/json' });
      if (response.status !== 200) {
        warnings.push(`${id}: Wikidata answered HTTP ${response.status}, so the claim is unverified`);
        continue;
      }

      const website = officialWebsite(response.body);
      if (website === undefined) {
        warnings.push(
          `${id}: the entity declares no official website (P856), so the claim cannot be corroborated from the authority side`,
        );
        continue;
      }

      const claimed = registrableOf(website);
      if (claimed === site) {
        verified.push(`${id} -> ${website}`);
      } else if (claimed !== '' && claimed.split('.')[0] === site.split('.')[0]) {
        // Same brand name under a different TLD: about.google for google.com.
        warnings.push(
          `${id}: the entity's official website is ${website}, which is the same name under a different domain than ${site}`,
        );
      } else {
        failures.push(
          `${id}: the entity's official website is ${website}, which belongs to ${claimed || 'no resolvable domain'}, not to ${site}`,
        );
      }
    }

    const details = {
      entitiesClaimed: entities.length,
      entitiesChecked: Math.min(entities.length, MAX_ENTITIES),
      siteDomain: registrableDomain(site),
      verified: verified.slice(0, 10),
      failures: failures.slice(0, 10),
      warnings: warnings.slice(0, 10),
    };
    const expected = 'Each claimed Wikidata entity gives this site’s domain as its official website (P856)';
    const found = `${entities.length} entity claim(s); ${verified.length} verified, ${failures.length} pointing elsewhere, ${warnings.length} unverifiable.`;
    const displayValue = `${verified.length}/${details.entitiesChecked} verified`;

    if (failures.length > 0) {
      return {
        ...this.fail(
          failures[0]!,
          expected,
          found,
          'Claim the entity that is really your organization, and make sure its P856 names your domain.',
        ),
        displayValue,
        details,
      };
    }

    if (warnings.length > 0) {
      return {
        ...this.warn(
          warnings[0]!,
          expected,
          found,
          'Add an official website (P856) to the Wikidata item so the claim can be corroborated.',
        ),
        displayValue,
        details,
      };
    }

    return {
      ...this.pass(
        `${verified.length} Wikidata entity claim(s) are reciprocated by the entity's own official website.`,
        expected,
        found,
      ),
      displayValue,
      details,
    };
  }
}
