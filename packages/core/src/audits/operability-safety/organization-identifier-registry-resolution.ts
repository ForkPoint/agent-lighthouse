import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import type { CheckContext, PageContext } from '../../check-context';
import { weightForGrade } from '../../scorer';
import { isSafeUrl } from '../../fetcher';
import { allJsonLdNodes } from '../../parser';

/** The shape an LEI has before any registry is asked about it. */
const LEI_SHAPE = /^[A-Z0-9]{18}[0-9]{2}$/;

/** ISO 6523 issuing-agency prefixes Google names in its documentation. */
const LEI_PREFIX = '0199:';
const DUNS_PREFIX = '0060:';

/** Legal-form suffixes dropped before two names are compared. */
const LEGAL_SUFFIX =
  /\b(inc|incorporated|ltd|limited|llc|l\.?l\.?c|plc|corp|corporation|co|company|gmbh|ag|sa|s\.?a|nv|n\.?v|bv|b\.?v|ab|as|oy|sas|sarl|spa|srl|pty|lp|l\.?p|llp|kk|pte)\b/g;

/** Below this token overlap, two names are not the same organization. */
const NAME_SIMILARITY = 0.6;

/** Registration statuses that are neither current nor a hard absence. */
const LAPSED_STATUSES = new Set(['LAPSED', 'RETIRED', 'ANNULLED', 'PENDING_TRANSFER', 'PENDING_ARCHIVAL']);

interface Claim {
  lei?: string;
  iso6523: string[];
  duns?: string;
  name?: string;
  legalName?: string;
  pageUrl: string;
}

/**
 * The ISO/IEC 7064 MOD 97-10 check over an LEI.
 *
 * A cheap local filter: it rejects a typo before a request is spent on it, and
 * it says nothing about whether the code is registered.
 */
export function leiCheckDigitsValid(lei: string): boolean {
  if (!LEI_SHAPE.test(lei)) return false;
  let remainder = 0;
  for (const char of lei) {
    const value = /[0-9]/.test(char) ? char : String(char.charCodeAt(0) - 55);
    for (const digit of value) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

/** Strip case, punctuation and legal form, so two spellings of one name meet. */
export function normalizeName(raw: string): string[] {
  return raw
    .toLowerCase()
    .replace(/[.,''`"()]/g, ' ')
    .replace(LEGAL_SUFFIX, ' ')
    .split(/[\s\-/&]+/)
    .filter((token) => token !== '');
}

/** Token overlap between two names, 0 to 1. */
export function nameSimilarity(a: string, b: string): number {
  const left = new Set(normalizeName(a));
  const right = new Set(normalizeName(b));
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  return shared / Math.max(left.size, right.size);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

/** Every organization identifier a page declares. */
function claimsOn(page: PageContext): Claim[] {
  const out: Claim[] = [];
  for (const node of allJsonLdNodes(page.jsonLd)) {
    if (!isObject(node)) continue;
    const type = node['@type'];
    const types = (Array.isArray(type) ? type : [type]).filter((t): t is string => typeof t === 'string');
    if (!types.some((t) => t === 'Organization' || t.endsWith('Organization') || t === 'Corporation')) continue;

    const iso = node['iso6523Code'];
    const claim: Claim = {
      iso6523: (Array.isArray(iso) ? iso : [iso]).filter((v): v is string => typeof v === 'string'),
      pageUrl: page.url,
    };
    const lei = asString(node['leiCode']);
    if (lei !== undefined) claim.lei = lei.toUpperCase();
    const duns = asString(node['duns']);
    if (duns !== undefined) claim.duns = duns;
    const name = asString(node['name']);
    if (name !== undefined) claim.name = name;
    const legalName = asString(node['legalName']);
    if (legalName !== undefined) claim.legalName = legalName;
    if (claim.lei !== undefined || claim.iso6523.length > 0 || claim.duns !== undefined) out.push(claim);
  }
  return out;
}

export class OrganizationIdentifierRegistryResolutionAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'operability-safety/organization-identifier-registry-resolution',
    category: 'operability-safety',
    title: 'The organization identifier resolves in the authoritative registry',
    failureTitle: 'This site’s organization identifier does not resolve, or names a different organization',
    description:
      'Reads `leiCode` / `iso6523Code` off the Organization markup, checks the identifier’s shape and ISO/IEC 7064 check digits locally, then resolves it against GLEIF’s public registry: exactly one record, an active entity, an issued registration, and a registered legal name that agrees with the name in the markup.',
    scoreDisplayMode: 'ternary',
    tier: 'scored',
    evidenceGrade: 'B',
    weight: weightForGrade('B', 'scored'),
    defaultPriority: 'medium',
    dossier: 'docs/evidence/audits/operability-safety/organization-identifier-registry-resolution.md',
    guidance: {
      impact:
        'A shopping or payment agent transacting with an unfamiliar merchant needs one thing no amount of markup can self-assert: a legal identity it can check against an authority. The LEI is the only schema.org organization identifier backed by a free, queryable, authoritative registry, which makes it the only one whose truth an outside party can establish. An identifier that resolves to nothing, or to a lapsed registration, or to a different legal name, is worse than none: it looks like verification and is not.',
      fix: 'Publish the LEI as `iso6523Code: "0199:<LEI>"` — Google documents a preference for the prefixed form over bare `leiCode` — keep the GLEIF registration renewed so its status stays ISSUED, and make sure the `legalName` in your markup is the name GLEIF has on record, not the trading name.',
      effort: 'moderate',
      docsUrl:
        'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/audits/operability-safety/organization-identifier-registry-resolution.md',
      tags: ['identity', 'lei', 'gleif', 'organization'],
    },
  };

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const claims = ctx.pages.flatMap((page) => claimsOn(page));
    if (claims.length === 0) {
      return this.notApplicable(
        'No page declares an organization identifier.',
        'An Organization node carrying leiCode or iso6523Code',
        'No leiCode, iso6523Code or duns found in any page’s JSON-LD',
      );
    }

    const failures: string[] = [];
    const warnings: string[] = [];
    const advisories: string[] = [];
    const resolved: string[] = [];

    // One identifier is one organization; the same LEI repeated across pages is
    // one lookup.
    const seen = new Set<string>();

    for (const claim of claims) {
      const fromIso = claim.iso6523
        .filter((value) => value.toUpperCase().startsWith(LEI_PREFIX))
        .map((value) => value.slice(LEI_PREFIX.length).toUpperCase());
      const lei = fromIso[0] ?? claim.lei;

      for (const value of claim.iso6523) {
        if (!/^\d{4}:/.test(value)) {
          failures.push(`iso6523Code "${value}" carries no four-digit issuing-agency prefix`);
        }
      }
      if (claim.lei !== undefined && fromIso.length === 0) {
        advisories.push(
          `leiCode is published without an iso6523Code "0199:${claim.lei}" twin, which is the form Google documents a preference for`,
        );
      }
      if (claim.duns !== undefined && !claim.iso6523.some((v) => v.startsWith(DUNS_PREFIX))) {
        advisories.push(
          `duns is published without an iso6523Code "${DUNS_PREFIX}${claim.duns}" twin, which is the form Google documents a preference for`,
        );
      }

      if (lei === undefined) continue;
      if (seen.has(lei)) continue;
      seen.add(lei);

      if (!LEI_SHAPE.test(lei)) {
        failures.push(`"${lei}" is not the shape of an LEI: 18 alphanumerics followed by two check digits`);
        continue;
      }
      if (!leiCheckDigitsValid(lei)) {
        failures.push(`LEI "${lei}" fails its ISO/IEC 7064 check digits, so it is a typo or a fabrication`);
        continue;
      }

      const url = `https://api.gleif.org/api/v1/lei-records?filter[lei]=${encodeURIComponent(lei)}`;
      if (!(await isSafeUrl(url))) {
        warnings.push(`The GLEIF registry could not be reached to resolve ${lei}`);
        continue;
      }
      const response = await ctx.fetch({ url, acceptHeader: 'application/vnd.api+json' });
      if (response.status !== 200) {
        warnings.push(`The GLEIF registry answered HTTP ${response.status} for ${lei}, so it could not be resolved`);
        continue;
      }

      const parsed = (() => {
        try {
          return JSON.parse(response.body) as { data?: unknown };
        } catch {
          return undefined;
        }
      })();
      const records = Array.isArray(parsed?.data) ? parsed.data : [];
      if (records.length === 0) {
        failures.push(`GLEIF holds no record for LEI ${lei}, so the identifier resolves to nothing`);
        continue;
      }

      const record = records[0] as { attributes?: Record<string, unknown> };
      const attributes = isObject(record.attributes) ? record.attributes : {};
      const entity = isObject(attributes['entity']) ? attributes['entity'] : {};
      const registration = isObject(attributes['registration']) ? attributes['registration'] : {};
      const entityStatus = asString(entity['status']) ?? 'UNKNOWN';
      const registrationStatus = asString(registration['status']) ?? 'UNKNOWN';
      const legalNameNode = isObject(entity['legalName']) ? entity['legalName'] : {};
      const registeredName = asString(legalNameNode['name']) ?? '';
      resolved.push(`${lei}: ${registeredName || 'no registered name'} (${entityStatus}/${registrationStatus})`);

      if (entityStatus !== 'ACTIVE') {
        warnings.push(`LEI ${lei} resolves to an entity whose GLEIF status is ${entityStatus}`);
      }
      if (registrationStatus !== 'ISSUED') {
        const message = `LEI ${lei} has a GLEIF registration status of ${registrationStatus}, so it is no longer maintained`;
        if (LAPSED_STATUSES.has(registrationStatus)) warnings.push(message);
        else failures.push(message);
      }

      const claimed = claim.legalName ?? claim.name;
      if (registeredName !== '' && claimed !== undefined) {
        const similarity = nameSimilarity(registeredName, claimed);
        if (similarity < NAME_SIMILARITY) {
          failures.push(
            `LEI ${lei} is registered to "${registeredName}", which does not match the "${claimed}" in the markup`,
          );
        }
      }
    }

    const details = {
      identifiersFound: seen.size,
      resolved: resolved.slice(0, 10),
      failures: failures.slice(0, 10),
      warnings: warnings.slice(0, 10),
      advisories: advisories.slice(0, 10),
    };
    const expected =
      'Every declared organization identifier resolves to exactly one active, issued GLEIF record whose legal name matches the markup';
    const found = `${seen.size} identifier(s) checked; ${resolved.length} resolved. ${failures.length} failure(s), ${warnings.length} warning(s), ${advisories.length} advisory note(s).`;
    const displayValue = `${resolved.length}/${seen.size} resolved`;

    if (failures.length > 0) {
      return {
        ...this.fail(
          failures[0]!,
          expected,
          found,
          'Publish an LEI that resolves in GLEIF, keep its registration ISSUED, and use the registered legal name in the markup.',
        ),
        displayValue,
        details,
      };
    }

    if (warnings.length > 0 || advisories.length > 0) {
      return {
        ...this.warn(
          warnings[0] ?? advisories[0]!,
          expected,
          found,
          'Renew the GLEIF registration and publish the identifier as iso6523Code "0199:<LEI>".',
        ),
        displayValue,
        details,
      };
    }

    return {
      ...this.pass(
        `${resolved.length} organization identifier(s) resolve to an active, issued GLEIF record.`,
        expected,
        found,
      ),
      displayValue,
      details,
    };
  }
}
