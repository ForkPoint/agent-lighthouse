import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import type { FetchResult } from '../../fetcher';

const TDMREP_PATH = '/.well-known/tdmrep.json';

/**
 * Fetch the TDM-Rep well-known policy file. The orchestrator does not prefetch
 * this path, but check rootFiles first for forward compatibility, then fall
 * back to an explicit fetch. Network errors degrade gracefully to null.
 */
async function getTdmRepFile(ctx: CheckContext): Promise<FetchResult | null> {
  const cached = ctx.rootFiles[TDMREP_PATH];
  if (cached) return cached;

  try {
    return await ctx.fetch({ url: `${ctx.baseUrl}${TDMREP_PATH}` });
  } catch {
    return null;
  }
}

/**
 * Interpret a TDM reservation value. Per the TDM-Rep protocol, "1" reserves
 * text-and-data-mining rights (deny by default) and "0" explicitly permits it.
 */
function describeReservation(value: string): string {
  return value.trim() === '1'
    ? 'rights reserved (mining denied by default)'
    : 'mining explicitly permitted';
}

export class TdmRepAudit extends Audit {
  static override meta: AuditMeta = {
    id: '2.27',
    category: 'crawler-permissions',
    title: 'TDM-Rep data mining rights declared',
    failureTitle: 'TDM-Rep data mining rights declared',
    description:
      'The TDM-Rep (Text and Data Mining Reservation) protocol is the emerging machine-readable standard for declaring whether your content may be used for text and data mining, anchored in EU DSM Directive Article 4. Without an explicit declaration — either a <meta name="tdm-reservation"> tag or a /.well-known/tdmrep.json policy file — AI crawlers and licensing agents cannot tell whether you reserve your mining rights, leaving your content in a legal gray zone where well-behaved agents guess and the rest assume permission. Declaring your terms explicitly puts you in control of how AI systems may use your content.',
    scoreDisplayMode: 'ternary',
    weight: 0.7,
    defaultPriority: 'medium',
    guidance: {
      impact:
        'Without an explicit TDM declaration, AI crawlers and content-licensing agents have no machine-readable signal about your data mining terms. Rights-respecting agents may skip your content to be safe, while others assume permission — you lose control either way, and you forfeit the EU DSM Article 4 opt-out protection that requires a machine-readable reservation.',
      fix: 'Declare your text and data mining policy explicitly. Add <meta name="tdm-reservation" content="1"> to reserve mining rights (or "0" to permit mining) on every page, and optionally point to a full policy with <meta name="tdm-policy" content="https://yoursite.com/tdm-policy">. For a site-wide declaration, publish a JSON policy at /.well-known/tdmrep.json instead.',
      code: '<!-- Reserve mining rights on every page -->\n<meta name="tdm-reservation" content="1" />\n<meta name="tdm-policy" content="https://yoursite.com/tdm-policy" />\n\n<!-- Or site-wide at /.well-known/tdmrep.json -->\n{\n  "tdm-reservation": 1,\n  "tdm-policy": "https://yoursite.com/tdm-policy"\n}',
      effort: 'trivial',
      docsUrl: 'https://www.w3.org/community/reports/tdmrep/CG-FINAL-tdmrep-20240510/',
      tags: ['tdm-rep', 'licensing', 'crawler-permissions', 'compliance'],
    },
  };

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const pageUrl = ctx.pages[0]?.url;

    // 1. Page-level <meta name="tdm-reservation"> / <meta name="tdm-policy">
    for (const page of ctx.pages) {
      const reservation = page.meta['tdm-reservation'];
      if (reservation !== undefined) {
        const policy = page.meta['tdm-policy'];
        const policyNote = policy ? ` Policy URL: ${policy}.` : '';
        return this.pass(
          `Explicit TDM-Rep declaration found on ${page.url}: tdm-reservation="${reservation.trim()}" (${describeReservation(reservation)}).${policyNote}`,
          'Explicit TDM reservation via meta tag or /.well-known/tdmrep.json',
          `meta tdm-reservation="${reservation.trim()}"`,
          page.url,
        );
      }
    }

    // 2. Site-wide /.well-known/tdmrep.json policy file
    const file = await getTdmRepFile(ctx);
    if (file && file.status === 200) {
      try {
        const policy = JSON.parse(file.body) as Record<string, unknown>;
        const reservation = policy['tdm-reservation'];
        const reservationNote =
          reservation !== undefined
            ? ` tdm-reservation=${String(reservation)} (${describeReservation(String(reservation))}).`
            : '';
        return this.pass(
          `TDM-Rep policy file found at ${TDMREP_PATH}.${reservationNote}`,
          'Explicit TDM reservation via meta tag or /.well-known/tdmrep.json',
          `Valid JSON policy at ${TDMREP_PATH}`,
          pageUrl,
        );
      } catch {
        return this.warn(
          `A file exists at ${TDMREP_PATH} but is not valid JSON, so agents cannot parse your data mining policy.`,
          'Valid JSON policy at /.well-known/tdmrep.json',
          'Malformed tdmrep.json',
          'medium',
          pageUrl,
        );
      }
    }

    // 3. Nothing declared — a gap, not an error. Absence means the site has
    // not stated its scraping/mining licensing terms in machine-readable form.
    const detail =
      file && file.status !== 200 && file.status !== 0
        ? ` (${TDMREP_PATH} returned HTTP ${file.status})`
        : '';
    return this.warn(
      `No TDM-Rep declaration found. No <meta name="tdm-reservation"> tag on any page and no policy file at ${TDMREP_PATH}${detail}. Your site has not declared its text and data mining terms, so AI crawlers cannot tell whether you reserve your mining rights.`,
      'Explicit TDM reservation via meta tag or /.well-known/tdmrep.json',
      'No TDM-Rep declaration found',
      'medium',
      pageUrl,
    );
  }
}
