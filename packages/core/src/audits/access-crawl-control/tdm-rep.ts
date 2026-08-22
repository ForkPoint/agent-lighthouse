// Redemption rewrite landed 2026-08-22 (Plan 4, Task 16). The audit was
// internally incoherent for a tool that measures agent outcomes: it PASSED
// identically for `tdm-reservation="1"` (rights RESERVED, mining denied) and
// `"0"` (mining permitted), so a site maximally opting out of AI use earned the
// same green check as one opting in; `describeReservation` reported any value
// other than '1' as an affirmative grant of mining rights the publisher never
// made; absence returned `warn` rather than `notApplicable`, penalising
// essentially every site on the web for not adopting a convention nothing
// consumes; `JSON.parse` ran on any 200 body with no content-type check, so an
// SPA catch-all produced a confident "a file exists but is not valid JSON"
// about a file that does not exist; nothing validated the spec's array-of-
// objects shape, so `123` and `{"foo":1}` were certified as valid policies; and
// it returned on the first page carrying the meta tag, hiding disagreement.
// Evidence dossier: docs/evidence/audits/access-crawl-control/tdm-rep.md
//
// The protocol's relevance is legal (EU DSM Article 4 opt-out evidence), not
// behavioural: no major crawler operator documents honouring it. The audit
// therefore reports the declaration and its direction, and never scores.
//
// RE-CHECK TRIGGER: the IETF AIPREF working group targeted IESG submission for
// 2026-08-31 and its charter does not reference TDM-Rep. If AIPREF ratifies and
// a named crawler documents honouring either protocol, this audit's grade needs
// re-examining — and the `Content-Usage` half of that work is already read by
// access-crawl-control/ai-content-declaration.
import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import type { CheckContext } from '../../check-context';
import { weightForGrade } from '../../scorer';

const TDMREP_PATH = '/.well-known/tdmrep.json';
const RESERVATION_HEADER = 'tdm-reservation';
const POLICY_HEADER = 'tdm-policy';

/**
 * The two values the protocol defines. Anything else is a publisher error, and
 * must not be narrated to the user as a licensing position they did not take.
 */
function describeReservation(value: string): string | undefined {
  const v = value.trim();
  if (v === '1') return 'rights reserved — mining denied by default';
  if (v === '0') return 'mining explicitly permitted';
  return undefined;
}

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

/** Strip the parameters off a media type: `application/json; charset=utf-8`. */
function mediaType(contentType: string | undefined): string {
  return (contentType ?? '').split(';')[0]!.trim().toLowerCase();
}

type FileVerdict =
  | { kind: 'absent' }
  | { kind: 'unparseable' }
  | { kind: 'wrong-shape' }
  | { kind: 'valid'; reservations: string[]; policy?: string };

/**
 * Read the site-wide policy file.
 *
 * The path is prefetched by the orchestrator, so there is no fallback fetch
 * here any more — the old one could never fire in production and existed only
 * to be exercised by a test.
 */
function readPolicyFile(ctx: CheckContext): FileVerdict {
  const file = ctx.rootFiles[TDMREP_PATH];
  if (!file || file.status !== 200 || !file.body.trim()) return { kind: 'absent' };

  // Two independent guards, because either alone is bypassable: an SPA
  // catch-all usually answers text/html, but some frameworks answer
  // application/json with an HTML error document in the body.
  const type = mediaType(file.contentType);
  const looksLikeMarkup = file.body.trimStart().startsWith('<');
  const jsonish = type.includes('json') || type === '' || type === 'text/plain';
  if (!jsonish || looksLikeMarkup) return { kind: 'absent' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(file.body);
  } catch {
    return { kind: 'unparseable' };
  }

  // The spec defines the document as an array of objects, each carrying a
  // mandatory `location` and `tdm-reservation`. The old `Record<string,
  // unknown>` cast accepted `123` and `{"foo":1}` as valid policies.
  if (!Array.isArray(parsed) || parsed.length === 0) return { kind: 'wrong-shape' };
  const entries = parsed.filter(
    (e): e is Record<string, unknown> =>
      isObject(e) && typeof e['location'] === 'string' && e['tdm-reservation'] !== undefined,
  );
  if (entries.length !== parsed.length) return { kind: 'wrong-shape' };

  const reservations = [...new Set(entries.map((e) => String(e['tdm-reservation']).trim()))];
  const policy = entries.map((e) => e['tdm-policy']).find((p) => typeof p === 'string');
  return { kind: 'valid', reservations, policy: policy as string | undefined };
}

/** A `tdm-reservation` response header, which the CG report calls the preferred technique. */
function readHeader(ctx: CheckContext): { value: string; policy?: string } | undefined {
  for (const page of ctx.pages) {
    const value = page.fetchResult?.headers?.[RESERVATION_HEADER];
    if (value?.trim()) {
      return { value: value.trim(), policy: page.fetchResult.headers[POLICY_HEADER]?.trim() };
    }
  }
  return undefined;
}

/** Page-level `<meta name="tdm-reservation">`, collected across every page. */
function readMeta(ctx: CheckContext): { values: string[]; policy?: string; pageUrl?: string } {
  const values: string[] = [];
  let policy: string | undefined;
  let pageUrl: string | undefined;

  for (const page of ctx.pages) {
    const reservation = page.meta['tdm-reservation'];
    if (reservation === undefined) continue;
    const value = reservation.trim();
    if (!values.includes(value)) values.push(value);
    policy ??= page.meta['tdm-policy'];
    pageUrl ??= page.url;
  }

  return { values, policy, pageUrl };
}

const EXPECTED =
  'An unambiguous TDM-Rep declaration: a tdm-reservation response header, a spec-shaped /.well-known/tdmrep.json, or a consistent <meta name="tdm-reservation"> of 1 or 0';

const SAMPLE = `// /.well-known/tdmrep.json — the spec shape is an ARRAY of objects
[
  {
    "location": "https://yoursite.com/",
    "tdm-reservation": 1,
    "tdm-policy": "https://yoursite.com/tdm-policy"
  }
]

// …or the response header the CG report calls the preferred technique
tdm-reservation: 1
tdm-policy: https://yoursite.com/tdm-policy`;

export class TdmRepAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'access-crawl-control/tdm-rep',
    category: 'access-crawl-control',
    title: 'TDM-Rep declaration',
    failureTitle: 'TDM-Rep declaration',
    description:
      'TDM-Rep is a W3C Community Group Final Report — explicitly not a W3C Standard — that defines a machine-readable text-and-data-mining reservation, anchored in EU DSM Directive Article 4. Its value is legal evidence of an opt-out, not agent behaviour: no major AI crawler operator documents honouring it. This audit reports what a site declares and in which direction, and never scores it either way.',
    scoreDisplayMode: 'informative',
    weight: weightForGrade('C', 'experimental'),
    evidenceGrade: 'C',
    tier: 'experimental',
    dossier: 'docs/evidence/audits/access-crawl-control/tdm-rep.md',
    // Nothing consumes the signal, so nothing here should outrank an item that
    // changes what an agent can do.
    defaultPriority: 'low',
    guidance: {
      impact:
        'A TDM reservation is evidence of an opt-out under EU DSM Article 4, in the form the W3C CG defined for it. It is not enforcement: no major AI crawler operator documents honouring the protocol, and the standards momentum has moved to the IETF AIPREF working group. Declaring one neither helps nor hinders an agent reading your site, which is why this audit reports it rather than scoring it.',
      fix: 'If you want the Article 4 reservation on record, publish it in one of the forms the CG report defines: a tdm-reservation response header (its preferred technique), a /.well-known/tdmrep.json holding an array of objects each with location and tdm-reservation, or <meta name="tdm-reservation"> with the same value on every page. Use 1 to reserve and 0 to permit, and keep the value consistent across the site.',
      code: SAMPLE,
      effort: 'trivial',
      docsUrl: 'https://www.w3.org/community/reports/tdmrep/CG-FINAL-tdmrep-20240510/',
      tags: ['tdm-rep', 'licensing', 'crawler-permissions', 'compliance', 'experimental'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const pageUrl = ctx.pages[0]?.url;

    // 1. The response header — the CG report's preferred technique.
    const header = readHeader(ctx);
    if (header) {
      const described = describeReservation(header.value);
      const policyNote = header.policy ? ` Policy: ${header.policy}.` : '';
      if (!described) {
        return this.warn(
          `The tdm-reservation response header carries "${header.value}", which is not a value the protocol defines (it accepts 1 or 0), so your licensing position cannot be read from it.`,
          EXPECTED,
          `tdm-reservation header: ${header.value} (unrecognized)`,
          'low',
          pageUrl,
        );
      }
      return this.pass(
        `TDM-Rep declared by response header: ${described}.${policyNote}`,
        EXPECTED,
        `tdm-reservation header: ${header.value}`,
        pageUrl,
      );
    }

    // 2. The site-wide policy file.
    const file = readPolicyFile(ctx);
    if (file.kind === 'unparseable') {
      return this.warn(
        `A JSON document is served at ${TDMREP_PATH} but it does not parse, so no agent or licensing tool can read your policy.`,
        EXPECTED,
        `${TDMREP_PATH} served, malformed JSON`,
        'low',
        pageUrl,
      );
    }
    if (file.kind === 'wrong-shape') {
      return this.warn(
        `${TDMREP_PATH} parses but is not the shape the spec defines: an array of objects, each with a location and a tdm-reservation.`,
        EXPECTED,
        `${TDMREP_PATH} served, non-conforming shape`,
        'low',
        pageUrl,
      );
    }
    if (file.kind === 'valid') {
      const described = file.reservations.map(describeReservation);
      const policyNote = file.policy ? ` Policy: ${file.policy}.` : '';
      if (described.some((d) => d === undefined)) {
        return this.warn(
          `${TDMREP_PATH} declares tdm-reservation ${file.reservations.join(', ')}, which is not a value the protocol defines (it accepts 1 or 0).`,
          EXPECTED,
          `${TDMREP_PATH}: tdm-reservation ${file.reservations.join(', ')} (unrecognized)`,
          'low',
          pageUrl,
        );
      }
      if (file.reservations.length > 1) {
        return this.warn(
          `${TDMREP_PATH} declares more than one reservation across its entries (${file.reservations.join(', ')}); that is legal per-location, but a consumer reading only the site root will see whichever entry matches.`,
          EXPECTED,
          `${TDMREP_PATH}: mixed reservations ${file.reservations.join(', ')}`,
          'low',
          pageUrl,
        );
      }
      return this.pass(
        `TDM-Rep declared site-wide at ${TDMREP_PATH}: ${described[0]}.${policyNote}`,
        EXPECTED,
        `${TDMREP_PATH}: tdm-reservation ${file.reservations[0]}`,
        pageUrl,
      );
    }

    // 3. Page-level meta tags, judged across every scanned page rather than
    // returning on the first one that carries the tag.
    const meta = readMeta(ctx);
    if (meta.values.length > 1) {
      return this.warn(
        `The scanned pages disagree about the reservation: ${meta.values.join(' and ')}. A per-page declaration only covers its own page, so a site-wide position needs the same value everywhere, or the well-known file.`,
        EXPECTED,
        `meta tdm-reservation: conflicting values ${meta.values.join(', ')}`,
        'low',
        meta.pageUrl,
      );
    }
    if (meta.values.length === 1) {
      const value = meta.values[0]!;
      const described = describeReservation(value);
      if (!described) {
        return this.warn(
          `<meta name="tdm-reservation" content="${value}"> is not a value the protocol defines (it accepts 1 or 0), so your licensing position cannot be read from it.`,
          EXPECTED,
          `meta tdm-reservation: ${value} (unrecognized)`,
          'low',
          meta.pageUrl,
        );
      }
      const policyNote = meta.policy ? ` Policy: ${meta.policy}.` : '';
      return this.pass(
        `TDM-Rep declared on every scanned page: ${described}.${policyNote}`,
        EXPECTED,
        `meta tdm-reservation: ${value}`,
        meta.pageUrl,
      );
    }

    // 4. No declaration. Not a defect: the protocol is a legal instrument with
    // no documented consumer, and charging half a point for not adopting it
    // penalised the entire web for a choice that changes nothing an agent does.
    return this.notApplicable(
      'This site makes no TDM-Rep declaration. The protocol is a Community Group report with no documented crawler consumer, so declining to publish one is a choice rather than a gap.',
      EXPECTED,
      'No TDM-Rep header, policy file or meta declaration',
    );
  }
}
