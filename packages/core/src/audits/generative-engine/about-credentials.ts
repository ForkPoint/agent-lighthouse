import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';

const CREDENTIAL_KEYWORDS = [
  'team',
  'experience',
  'expertise',
  'credentials',
  'background',
  'qualified',
  'certified',
  'years of experience',
  'specializ',
  'professional',
];

export class AboutCredentialsAudit extends Audit {
  static override meta: AuditMeta = {
    id: '10.4',
    category: 'generative-engine',
    title: 'About page with credentials',
    failureTitle: 'About page with credentials',
    description:
      "AI engines crawl your about page to build an organizational authority profile. Without an about page containing team credentials, expertise, and experience details, agents cannot assess your organization's authority, reducing your content's trust score in AI-generated recommendations.",
    scoreDisplayMode: 'ternary',
    weight: 1.0,
    defaultPriority: 'medium',
    guidance: {
      impact:
        "AI engines crawl your about page to build an organizational authority profile. Without credential-rich content (team bios, expertise areas, certifications), agents cannot assess your organization's authority, reducing your content's trust score in AI-generated recommendations.",
      fix: 'Create or expand your /about/ page to include team member bios with qualifications, years of experience, expertise areas, and professional certifications. Use specific credential keywords.',
      code: '<section>\n  <h2>Our Team</h2>\n  <p>With 15+ years of experience in software engineering, our team of certified professionals specializes in AI-powered search optimization.</p>\n</section>',
      effort: 'moderate',
      tags: ['trust', 'e-e-a-t', 'generative-engine'],
    },
  };

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const aboutPaths = ['/about/', '/about-us/', '/about'];
    let aboutResult = ctx.rootFiles['/about/'] ?? ctx.rootFiles['/about-us/'];

    if (!aboutResult || aboutResult.status !== 200) {
      // Try fetching if not in rootFiles
      for (const path of aboutPaths) {
        try {
          const result = await ctx.fetch({
            url: `${ctx.baseUrl}${path}`,
          });
          if (result.status === 200 && result.body) {
            aboutResult = result;
            break;
          }
        } catch {
          // continue trying other paths
        }
      }
    }

    if (!aboutResult || aboutResult.status !== 200 || !aboutResult.body) {
      return this.fail(
        'No about page found at /about/ or /about-us/.',
        'About page returns 200 with content mentioning "team", "experience", "expertise"',
        'About page not found',
        {
          priority: 'medium',
          description:
            "AI engines crawl your about page to build an organizational authority profile. Without an about page containing team credentials, expertise, and experience details, agents cannot assess your organization's authority, reducing your content's trust score in AI-generated recommendations.",
          code: '<!-- Create /about/ with sections for:\n  - Company mission and history\n  - Team member bios with qualifications\n  - Years of experience and expertise areas\n  - Certifications and awards -->',
        },
      );
    }

    const bodyLower = aboutResult.body.toLowerCase();
    const foundKeywords = CREDENTIAL_KEYWORDS.filter((kw) => bodyLower.includes(kw));

    if (foundKeywords.length >= 2) {
      return this.pass(
        `About page found with credential signals: ${foundKeywords.join(', ')}.`,
        'About page returns 200 with content mentioning "team", "experience", "expertise"',
        `Keywords: ${foundKeywords.join(', ')}`,
      );
    }

    if (foundKeywords.length === 1) {
      return this.warn(
        `About page found but has limited credential signals (only "${foundKeywords[0]}").`,
        'About page returns 200 with content mentioning "team", "experience", "expertise"',
        `Keywords: ${foundKeywords[0]}`,
        {
          priority: 'medium',
          description:
            'AI engines scan about pages for credential keywords (team, experience, expertise, certified) to build authority profiles. A single keyword provides weak signal. Expand to include team backgrounds, years of experience, expertise areas, and certifications for stronger AI trust scoring.',
          code: '<!-- Add sections covering:\n  - "Our team has 15+ years of experience in..."\n  - "Certified by..." or "Qualified in..."\n  - Specific expertise areas and specializations -->',
        },
      );
    }

    return this.warn(
      'About page exists but lacks credential keywords (team, experience, expertise).',
      'About page returns 200 with content mentioning "team", "experience", "expertise"',
      'No credential keywords found',
      {
        priority: 'medium',
        description:
          'AI engines scan about pages for credential keywords to build authority profiles but found none on yours. Add credential-rich content: team backgrounds with named experts, years of industry experience, expertise areas, and professional certifications. These signals directly influence AI trust scoring.',
        code: '<!-- Add credential-rich content like:\n  - "Our team of 20+ engineers specializes in..."\n  - "With 10 years of experience in..."\n  - "Certified professionals in..." -->',
      },
    );
  }
}
