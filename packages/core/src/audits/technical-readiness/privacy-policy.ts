import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';

// Match a privacy-policy link by anchor text or href. Deliberately specific so
// product links like "privacy levers and knobs" don't false-positive.
const PRIVACY_TEXT = /\bprivacy\s*(policy|notice|statement|center|&\s*security|and\s*security)\b/;
const PRIVACY_HREF =
  /privacy[-_]?(policy|notice|statement|security|center)|\/privacy(\.[a-z0-9]+)?($|[/?#])/;

/** Find a linked privacy policy anywhere in the scanned pages' anchors. */
function findPrivacyLink(ctx: CheckContext): string | null {
  for (const page of ctx.pages) {
    let hit: string | null = null;
    page.$('a[href]').each((_, el) => {
      if (hit) return;
      /* v8 ignore next */
      const href = (page.$(el).attr('href') ?? '').trim();
      if (!href) return;
      const text = page.$(el).text().trim().toLowerCase();
      if (text === 'privacy' || PRIVACY_TEXT.test(text) || PRIVACY_HREF.test(href.toLowerCase())) {
        hit = href;
      }
    });
    if (hit) return hit;
  }
  return null;
}

export class PrivacyPolicyAudit extends Audit {
  static override meta: AuditMeta = {
    id: '8.19',
    category: 'technical-readiness',
    title: 'Privacy policy exists',
    failureTitle: 'Privacy policy exists',
    description:
      'Enterprise AI frameworks check for privacy policies before recommending sites in regulated industries. A missing privacy policy reduces your trust score in AI systems that prioritize sites with transparent data handling practices, especially for health, finance, and legal content.',
    scoreDisplayMode: 'binary',
    weight: 1.0,
    defaultPriority: 'medium',
    guidance: {
      impact:
        'Enterprise AI frameworks and compliance-aware recommendation systems check for a privacy policy before surfacing your site in regulated industries (health, finance, legal, e-commerce). A missing privacy policy lowers your trust score and may cause AI systems to exclude your site from recommendations where data handling transparency is required.',
      fix: 'Create a dedicated privacy policy page at /privacy-policy/ or /privacy/. Cover data collection practices, cookie usage, third-party data sharing, and user rights under GDPR/CCPA.',
      code: '<!-- Create /privacy-policy/ with these key sections:\n  1. What data you collect\n  2. How you use cookies and tracking\n  3. Third-party data sharing\n  4. User rights (access, deletion, opt-out)\n  5. Contact information for privacy inquiries -->',
      effort: 'moderate',
      tags: ['trust', 'legal', 'compliance'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages?.[0];
    const privacyPaths = ['/privacy-policy/', '/privacy/', '/privacy-policy', '/privacy'];
    const found = privacyPaths.find((p) => ctx.rootFiles[p] && ctx.rootFiles[p].status === 200);

    if (found) {
      return this.pass(
        `Privacy policy found at ${found}.`,
        '/privacy-policy/ or /privacy/ returns 200',
        `${found} — status 200`,
        page?.url,
      );
    }

    // Fallback: a privacy policy linked at a non-standard path (e.g.
    // /customer-service/.../privacy-policy.html) — how search engines find it.
    const linked = findPrivacyLink(ctx);
    if (linked) {
      return this.pass(
        `Privacy policy linked at ${linked}.`,
        'A discoverable link to a privacy policy page',
        linked,
        page?.url,
      );
    }

    const statuses = privacyPaths
      .map((p) => {
        const file = ctx.rootFiles[p];
        return `${p}: ${file ? `status ${file.status}` : 'not fetched'}`;
      })
      .join('; ');

    return this.fail(
      'No privacy policy page found. A privacy policy builds trust with users and AI agents.',
      '/privacy-policy/ or /privacy/ returns 200',
      statuses,
      {
        priority: 'medium',
        description:
          'Enterprise AI frameworks check for privacy policies before recommending sites in regulated industries. A missing privacy policy reduces your trust score in AI systems that prioritize sites with transparent data handling practices, especially for health, finance, and legal content.',
        code: '<!-- Create a page at /privacy-policy/ or /privacy/ with sections covering:\n  - Data collection practices\n  - Cookie usage\n  - Third-party sharing\n  - User rights (GDPR/CCPA) -->',
      },
      page?.url,
    );
  }
}
