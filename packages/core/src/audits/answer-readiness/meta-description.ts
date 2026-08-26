import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import { weightForGrade } from '../../scorer';
import type { CheckContext, PageContext } from '../../check-context';

/**
 * Words carried by any English page, which say nothing about *this* page. Kept
 * deliberately short: the overlap test only has to fail when a description and
 * a title share no subject matter at all.
 */
const STOP_WORDS = new Set([
  'and', 'are', 'for', 'from', 'the', 'that', 'this', 'with', 'you', 'your', 'our', 'their',
  'has', 'have', 'was', 'were', 'can', 'will', 'all', 'any', 'its', 'into', 'out', 'more',
  'about', 'over', 'than', 'them', 'they', 'what', 'when', 'where', 'who', 'why', 'how',
  'here', 'there', 'been', 'being', 'not', 'but', 'his', 'her', 'she', 'him', 'com', 'www',
]);

/** Content words of a string: 3+ letters/digits, stop words removed. */
function contentTerms(text: string): Set<string> {
  const words = text.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [];
  return new Set(words.filter((w) => !STOP_WORDS.has(w)));
}

/** The page's own subject line: `<title>` plus the first `<h1>`. */
function pageSubject(page: PageContext): string {
  const title = page.$('title').first().text().trim();
  const h1 = page.$('h1').first().text().trim();
  return `${title} ${h1}`.trim();
}

/**
 * Google asks for descriptions that read as prose rather than "long strings of
 * keywords". A comma- or pipe-separated run of short fragments with no sentence
 * in it is that failure mode.
 */
function looksLikeKeywordString(desc: string): boolean {
  if (/[.!?]\s/.test(desc)) return false;
  const segments = desc
    .split(/[,|·•;]/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length < 5) return false;
  return segments.every((s) => s.split(/\s+/).length <= 4);
}

export class MetaDescriptionAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'answer-readiness/meta-description',
    category: 'answer-readiness',
    title: 'Meta description quality',
    failureTitle: 'Meta description quality',
    description:
      'Google may reproduce <meta name="description"> verbatim as the snippet for a page when it describes the page better than the body text does, and the same snippet pipeline feeds AI Overviews and AI Mode source cards. This audit checks the properties Google documents: the tag is present, it is a usable length, it reads as prose rather than a keyword string, and it actually describes this page.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('B', 'scored'),
    evidenceGrade: 'B',
    tier: 'scored',
    dossier: 'docs/evidence/audits/answer-readiness/meta-description.md',
    requires: ['origin-reachable', 'unblocked-fetches', 'rendered-body', 'sample-adequate'],
    defaultPriority: 'high',
    guidance: {
      impact:
        'Google sometimes uses the meta description as the search snippet when it describes the page more accurately than the body text, and AI Overviews and AI Mode inherit that snippet pipeline. A missing, keyword-stuffed or off-topic description means the summary shown alongside your page is written by someone else.',
      fix: 'Add a <meta name="description"> tag with a concise 50-300 character summary, written as prose, that accurately describes what is on this page — reusing the page\'s own subject terms.',
      code: '<meta name="description" content="A concise summary of the page content in 50-300 characters that describes what users will learn.">',
      effort: 'trivial',
      tags: ['meta-tags', 'seo', 'content-discovery'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages[0];
    const desc = page?.meta?.['description'] ?? '';
    const len = desc.length;

    const expected =
      'meta[description] with 50-300 characters, written as prose, describing this page';

    if (desc && len >= 50 && len <= 300) {
      // Quality half, absorbed from v1 9.11. Both criteria are Google's own
      // ("not long strings of keywords"; "accurately describes the page"), both
      // are falsifiable, and neither can do worse than warn.
      if (looksLikeKeywordString(desc)) {
        return this.warn(
          'Meta description reads as a keyword string, not a description.',
          expected,
          desc,
          {
            priority: 'medium',
            description:
              'Google asks for descriptions that are readable text rather than "long strings of keywords", because a keyword run is not usable as a snippet. Rewrite it as one or two sentences about the page.',
            code: '<meta name="description" content="One or two sentences describing what is on this page and who it is for.">',
          },
          page.url,
        );
      }

      const subject = pageSubject(page);
      if (subject) {
        const subjectTerms = contentTerms(subject);
        const descTerms = contentTerms(desc);
        const shared = [...descTerms].filter((t) => subjectTerms.has(t));
        // A brand-only title ("Acme") yields one term, and an accurate
        // description that never repeats the brand shares nothing with it.
        // That is a thin subject, not an irrelevant description, so there have
        // to be at least two terms before the comparison means anything.
        if (subjectTerms.size >= 2 && shared.length === 0) {
          return this.warn(
            'Meta description does not describe this page — it shares no term with the title or H1.',
            expected,
            `Description: "${desc}" · Page subject: "${subject}"`,
            {
              priority: 'medium',
              description:
                'Google uses the meta description when it "might give users a more accurate description of the page", and asks for page-specific descriptions rather than boilerplate. A description with no term in common with the page\'s own title or heading is describing something else.',
              code: '<meta name="description" content="A summary that names what this page is actually about.">',
            },
            page.url,
          );
        }
      }

      return this.pass(
        `Meta description present (${len} chars).`,
        expected,
        desc,
        page.url,
      );
    }

    if (desc && (len < 50 || len > 300)) {
      return this.warn(
        `Meta description length is ${len} chars; should be 50-300.`,
        expected,
        desc,
        {
          priority: 'high',
          description:
            'Google places no hard limit on the tag, but a very short description carries too little context to be chosen over the body text, and a very long one is truncated in the result. 50-300 characters is the working window this audit reports against.',
          code: '<meta name="description" content="A clear, 50-300 character summary of what this page covers and why it matters.">',
        },
        page?.url,
      );
    }

    return this.fail(
      'Meta description is missing.',
      expected,
      'Not found',
      {
        priority: 'high',
        description:
          'With no description tag, the snippet shown beside your page is written entirely from body text by whoever indexes it. Add a concise 50-300 character summary of the page.',
        code: '<meta name="description" content="A concise summary of the page content in 50-300 characters.">',
      },
      page?.url,
    );
  }
}
