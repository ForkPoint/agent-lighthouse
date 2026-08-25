import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import { weightForGrade } from '../../scorer';
import type { CheckContext, PageContext } from '../../check-context';
import { findReviewNodes } from './review-signals';

/**
 * Quantified social proof — the factor the GEO benchmark actually measured.
 *
 * arXiv 2605.25517 (252,000 paired trials, six LLMs) defines its "Weaker
 * Social Proof" condition as *fewer or lower ratings/reviews*, OR 2.14 to
 * >10,000, significant in 4 of 6 models. What moved citation was the number,
 * not the adjective, so every pattern here requires a magnitude. The v1
 * regexes ("trusted by", "award", "partner", "certified", "as seen in") were
 * never tested by any study and matched ordinary nav and legal boilerplate.
 */
const SOCIAL_PROOF_PATTERNS: readonly RegExp[] = [
  // "4.8/5", "4.8 out of 5". A whole number needs an adjacent rating word:
  // a bare "1 / 5" is the counter a carousel prints under its arrows, and
  // reading it as a one-star rating credited social proof that is not there.
  /\b[0-5]\.\d\s*(?:\/|out\s+of)\s*5\b/i,
  /\b(?:rated|rating|scored?|stars?|average)\b[^.\n]{0,24}?\b[0-5]\s*(?:\/|out\s+of)\s*5\b/i,
  /\b[0-5]\s*(?:\/|out\s+of)\s*5\b[^.\n]{0,24}?\b(?:stars?|rating|ratings|reviews?)\b/i,
  // "1,204 reviews", "350+ ratings"
  /\b\d{2,}[\d,]*\+?\s*(?:reviews?|ratings?)\b/i,
  // "Trusted by 12,000", "used by 500+"
  /\b(?:trusted|used|chosen|loved|backed)\s+by\s+\d{2,}[\d,]*\+?/i,
  // "12,000 customers", "500+ companies"
  /\b\d{2,}[\d,]*\+?\s*(?:customers?|clients?|users?|teams?|companies|businesses|developers?|members?|subscribers?|organi[sz]ations?)\b/i,
];

/**
 * Hosts whose links are site chrome, not citations. An icon row in the footer
 * is not evidence-backing, and counting it would recreate v1's problem of
 * passing every commercial homepage on boilerplate.
 */
const NON_CITATION_HOSTS =
  /(^|\.)(facebook|twitter|x|instagram|linkedin|youtube|tiktok|pinterest|threads|snapchat|whatsapp|t|telegram|reddit|discord|medium|substack)\.(com|co|me|be|org)$/i;

/** Whether a page declares a non-English language. The detectors are English. */
function isNonEnglish(page: PageContext): boolean {
  const lang = (page.$('html').attr('lang') ?? '').trim().toLowerCase();
  return lang !== '' && !lang.startsWith('en');
}

/** Page text with script/style noise stripped, collapsed to single spaces. */
function readableText(page: PageContext): string {
  const body = page.$('body').clone();
  body.find('script, style, noscript, template').remove();
  return body.text().replace(/\s+/g, ' ').trim();
}

/**
 * Claims paired with evidence — "Claims With Evidence" in arXiv 2605.25517,
 * OR 2.09 to >10,000, significant in 5 of 6 models, and the paper's own
 * practical guidance ("replace hedging with evidence-backed claims"). Counted
 * as outbound citations to third-party sources, or explicit <cite> attribution.
 *
 * `answer-readiness/external-citations` is scoped to content pages, so this
 * homepage-scoped check does not double-count it.
 */
function evidenceBackedClaims(page: PageContext): string[] {
  const $ = page.$;
  const found: string[] = [];

  let host: string;
  try {
    host = new URL(page.url).host;
  } catch {
    host = '';
  }

  const citations = new Set<string>();
  $('a[href]').each((_, el) => {
    const node = $(el);
    const href = node.attr('href');
    if (!href) return;
    // Icon-only links are chrome; a citation carries readable anchor text.
    if (node.text().trim().length < 3) return;
    let url: URL;
    try {
      url = new URL(href, page.url);
    } catch {
      return;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
    if (url.host === host || url.host === '') return;
    if (NON_CITATION_HOSTS.test(url.host.replace(/^www\./, ''))) return;
    citations.add(url.host);
  });

  if (citations.size >= 2) {
    found.push(`${citations.size} outbound citation host(s): ${[...citations].slice(0, 3).join(', ')}`);
  }

  const cites = $('cite').filter((_, el) => $(el).text().trim().length > 0).length;
  const citedQuotes = $('blockquote[cite]').length;
  if (cites + citedQuotes > 0) found.push(`${cites + citedQuotes} attributed source element(s)`);

  return found;
}

const EXPECTED =
  'Homepage carries every GEO-measured factor still in scope: quantified social proof (deferred to answer-readiness/review-signals when review markup is present) and evidence-backed claims';

export class TrustSignalsAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'answer-readiness/trust-signals',
    category: 'answer-readiness',
    title: 'Trust and evidence signals on homepage',
    failureTitle: 'Trust and evidence signals on homepage',
    description:
      'A 252,000-trial controlled study across six LLMs (arXiv 2605.25517) measured two page factors that shift which source an AI answer engine cites: quantified social proof (OR 2.14, significant in 4 of 6 models) and claims paired with evidence (OR 2.09, 5 of 6 models). The same study found promotional tone\'s effect too small and inconsistent to guide, and it named comparison content in its practical implications without measuring it. This audit scores those two page factors and nothing else.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('B', 'scored'),
    evidenceGrade: 'B',
    tier: 'scored',
    dossier: 'docs/evidence/audits/answer-readiness/trust-signals.md',
    applicablePageTypes: ['homepage'],
    defaultPriority: 'low',
    guidance: {
      impact:
        'Trust cues in retrieved page text change which source an answer engine cites, but only the measured ones: quantified ratings/review counts (OR 2.14 to >10,000, significant in 4 of 6 models) and claims paired with evidence (OR 2.09 to >10,000, 5 of 6 models). The same study found "Overly Promotional" tone significant in only 3 of 6 models with mixed direction — neutral phrasing won where the effect was significant — so puffery earns nothing. It named comparison content only in its practical implications and never measured it, so comparison content is reported unscored by answer-readiness/comparison-tables rather than counted here. These are the "smaller gains" tier: topic match, price, recency and list position dwarf them.',
      fix: 'Put a number on your social proof ("Rated 4.8/5 across 1,204 reviews", "Trusted by 12,000 teams"), and back factual claims with outbound citations or attributed sources instead of hedging. Delete promotional adjectives — they do not move citation. Comparison content is reported separately and unscored by answer-readiness/comparison-tables — the same study only names it in its practical implications and never measured it.',
      code: '<section>\n  <p>Rated <strong>4.8 out of 5</strong> across <strong>1,204 reviews</strong>.</p>\n  <p>Independent testing confirms a 40% reduction in latency\n     (<a href="https://example.org/benchmark">2026 benchmark report</a>),\n     and <cite>NIST SP 800-90B</cite> documents the method.</p>\n</section>',
      effort: 'moderate',
      docsUrl: 'https://arxiv.org/abs/2605.25517',
      tags: ['trust', 'social-proof', 'generative-engine', 'geo'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages.find((p) => p.pageType === 'homepage');

    if (!page) {
      return this.notApplicable(
        'No homepage was scanned, and the measured factors are homepage-scoped.',
        EXPECTED,
        'No homepage in scan',
      );
    }

    // v1 reported a confident FAIL on any non-English homepage, however much
    // real trust content it carried. English-only detectors report `na`.
    if (isNonEnglish(page)) {
      return this.notApplicable(
        `The homepage declares lang="${page.$('html').attr('lang')}"; the trust-signal detectors are English-only.`,
        EXPECTED,
        'Non-English homepage — detector not applicable',
      );
    }

    const text = readableText(page);
    const satisfied: string[] = [];
    const missing: string[] = [];
    let counted = 0;
    let deferred: string | undefined;

    // ── Factor 1: quantified social proof ───────────────────────
    // `answer-readiness/review-signals` owns machine-readable review data on
    // this same page. When it is present that audit scores it, so this factor
    // leaves both the numerator and the denominator here — and the pass bar
    // drops with the denominator (see `required` below), because a page that
    // publishes valid AggregateRating markup must never score worse than the
    // same page without it.
    const reviewMarkup = findReviewNodes(page.jsonLd);
    if (reviewMarkup.length > 0) {
      deferred = `social proof deferred to answer-readiness/review-signals (JSON-LD ${reviewMarkup.join(', ')})`;
    } else {
      counted += 1;
      const hit = SOCIAL_PROOF_PATTERNS.map((re) => text.match(re)?.[0]).find(Boolean);
      if (hit) satisfied.push(`quantified social proof ("${hit.trim()}")`);
      else missing.push('quantified social proof (a rating, review count or customer count)');
    }

    // ── Factor 2: evidence-backed claims ────────────────────────
    counted += 1;
    const evidence = evidenceBackedClaims(page);
    if (evidence.length > 0) satisfied.push(`evidence-backed claims (${evidence.join('; ')})`);
    else missing.push('evidence-backed claims (outbound citations or attributed sources)');

    const found = [...satisfied, ...(deferred ? [deferred] : [])].join('; ') || 'None found';

    // Every factor still in the denominator must be satisfied. There is no
    // longer an unmeasured third factor to take a majority against — both
    // survivors carry their own odds ratio, so a pass means both. A deferred
    // factor removes itself from the numerator and the denominator together,
    // which is what keeps the bar monotonic: adding correct review markup
    // could otherwise flip a passing page to `warn`, penalising the very
    // signal the evidence says to strengthen. The deferred factor is *known
    // present* — it is simply scored by review-signals — so it also lifts the
    // floor off `fail`.
    const required = counted;
    const tally = `${satisfied.length} of the ${counted} GEO-measured trust factor(s)`;
    const deferNote = deferred
      ? ' Social proof is scored by answer-readiness/review-signals.'
      : '';

    if (satisfied.length >= required) {
      return this.pass(
        `Homepage carries ${tally}.${deferNote}`,
        EXPECTED,
        found,
        page.url,
      );
    }

    if (satisfied.length >= 1 || deferred) {
      return this.warn(
        `Homepage carries only ${tally}.${deferNote}`,
        EXPECTED,
        found,
        {
          priority: 'low',
          description: `Missing: ${missing.join('; ')}. These are the factors a 252,000-trial study measured as moving AI citation, and a pass needs every one still in scope here. Promotional adjectives are not among them.`,
          code: TrustSignalsAudit.meta.guidance?.code,
        },
        page.url,
      );
    }

    return this.fail(
      'Homepage carries neither of the GEO-measured trust factors.',
      EXPECTED,
      found,
      {
        priority: 'low',
        description: `Missing: ${missing.join('; ')}. A 252,000-trial controlled study across six LLMs measured both as shifting which source an answer engine cites. Quantify your social proof and cite evidence for factual claims. Comparison content is reported separately and unscored by answer-readiness/comparison-tables.`,
        code: TrustSignalsAudit.meta.guidance?.code,
      },
      page.url,
    );
  }
}
