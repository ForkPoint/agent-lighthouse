import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';

// Match a terms link by anchor text or href (terms of service/use, terms &
// conditions, conditions of use, /tos), without over-matching unrelated text.
const TERMS_TEXT =
  /\bterms\s*(of\s*(service|use|sale)|&\s*conditions|and\s*conditions)\b|\bconditions\s*of\s*use\b/;
const TERMS_HREF =
  /terms[-_](of[-_](service|use|sale)|and[-_]conditions|conditions)|\/terms(\.[a-z0-9]+)?($|[/?#])|\/tos($|[/?#])/;

/** Find a linked terms-of-service page anywhere in the scanned pages' anchors. */
function findTermsLink(ctx: CheckContext): string | null {
  for (const page of ctx.pages) {
    let hit: string | null = null;
    page.$('a[href]').each((_, el) => {
      if (hit) return;
      /* v8 ignore next */
      const href = (page.$(el).attr('href') ?? '').trim();
      if (!href) return;
      const text = page.$(el).text().trim().toLowerCase();
      if (
        text === 'terms' ||
        text === 'terms & conditions' ||
        TERMS_TEXT.test(text) ||
        TERMS_HREF.test(href.toLowerCase())
      ) {
        hit = href;
      }
    });
    if (hit) return hit;
  }
  return null;
}

export class TermsOfServiceAudit extends Audit {
  static override meta: AuditMeta = {
    id: '8.20',
    category: 'technical-readiness',
    title: 'Terms of service exists',
    failureTitle: 'Terms of service exists',
    description:
      'AI agents check for terms of service to determine whether automated access is permitted. A missing ToS page creates legal ambiguity that may cause enterprise AI systems to avoid recommending your site. Clear terms also let you specify AI usage policies for your content.',
    scoreDisplayMode: 'binary',
    weight: 1.0,
    defaultPriority: 'medium',
    guidance: {
      impact:
        'AI agents check for terms of service to determine whether automated access and content usage are permitted. A missing ToS creates legal ambiguity that causes enterprise AI systems to deprioritize your site to avoid compliance risk. Clear terms also let you explicitly define AI usage policies for your content.',
      fix: 'Create a terms of service page at /terms/ covering acceptable use, AI/automated access policy, content licensing, and liability limitations. Consider adding an explicit section on AI agent access and content reuse permissions.',
      code: '<!-- Create /terms/ with these key sections:\n  1. Acceptable use policy\n  2. AI and automated access policy\n  3. Content licensing and reuse terms\n  4. Liability limitations\n  5. Termination conditions -->',
      effort: 'moderate',
      tags: ['trust', 'legal', 'compliance'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages?.[0];
    const termsPaths = ['/terms/', '/terms'];
    const found = termsPaths.find((p) => ctx.rootFiles[p] && ctx.rootFiles[p].status === 200);

    if (found) {
      return this.pass(
        `Terms of service found at ${found}.`,
        '/terms/ or /terms returns 200',
        `${found} — status 200`,
        page?.url,
      );
    }

    // Fallback: terms linked at a non-standard path (e.g.
    // /terms-and-conditions.html) — how search engines actually find it.
    const linked = findTermsLink(ctx);
    if (linked) {
      return this.pass(
        `Terms of service linked at ${linked}.`,
        'A discoverable link to a terms page',
        linked,
        page?.url,
      );
    }

    const file = ctx.rootFiles['/terms/'] ?? ctx.rootFiles['/terms'];

    return this.fail(
      'No terms of service page found. Terms of service establish usage rules for visitors and AI agents.',
      '/terms/ returns 200',
      file ? `Status ${file.status}` : 'Not fetched',
      {
        priority: 'medium',
        description:
          'AI agents check for terms of service to determine whether automated access is permitted. A missing ToS page creates legal ambiguity that may cause enterprise AI systems to avoid recommending your site. Clear terms also let you specify AI usage policies for your content.',
        code: '<!-- Create a page at /terms/ with sections covering:\n  - Acceptable use\n  - AI/automated access policy\n  - Content licensing\n  - Liability limitations -->',
      },
      page?.url,
    );
  }
}
