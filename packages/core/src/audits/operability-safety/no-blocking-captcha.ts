import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import { weightForGrade } from '../../scorer';
import type { CheckContext } from '../../check-context';
import { scanReadTheSite, unreadSiteReason } from '../../scan-evidence';

const CAPTCHA_PATTERNS = [
  'recaptcha',
  'hcaptcha',
  'turnstile',
  'google.com/recaptcha',
  'hcaptcha.com',
  'challenges.cloudflare.com/turnstile',
];

export class NoBlockingCaptchaAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'operability-safety/no-blocking-captcha',
    category: 'operability-safety',
    title: "Forms don't use blocking CAPTCHA",
    failureTitle: "Forms don't use blocking CAPTCHA",
    description:
      'Blocking CAPTCHAs like reCAPTCHA and hCaptcha prevent AI agents from completing forms on behalf of users. When someone asks an AI assistant to "fill out the contact form on Example.com," the CAPTCHA blocks the action entirely. Use honeypot fields or invisible server-side validation instead.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('A', 'scored'),
    evidenceGrade: 'A',
    tier: 'scored',
    dossier: 'docs/evidence/audits/operability-safety/no-blocking-captcha.md',
    // Gate exemption: a captcha wall is what this audit reports, and a wall denies
    // `origin-reachable` — gating on it made the finding unreachable for the 403 that
    // produced it. The wall branch reads `wafProtection`, not any response body.
    requires: [],
    defaultPriority: 'high',
    guidance: {
      impact:
        'Blocking CAPTCHAs completely prevent AI agents from submitting forms on behalf of users. When a user asks an agent to "fill out the contact form," the CAPTCHA blocks the action entirely, forcing the user to do it manually or go to a competitor.',
      fix: 'Replace visible CAPTCHAs (reCAPTCHA, hCaptcha, Turnstile) with invisible bot-detection methods such as honeypot fields, server-side rate limiting, or invisible reCAPTCHA v3 score-based checks that do not require user interaction.',
      code: `<!-- Replace CAPTCHA with a honeypot field -->
<form action="/api/contact" method="POST">
  <!-- Hidden honeypot field - bots fill this, humans don't -->
  <input type="text" name="website_url" style="display:none"
    tabindex="-1" autocomplete="off" />

  <input type="text" name="name" required />
  <input type="email" name="email" required />
  <textarea name="message" required></textarea>
  <button type="submit">Send</button>
</form>

<!-- Server-side: reject if website_url is filled -->`,
      effort: 'moderate',
      tags: ['forms', 'captcha', 'accessibility', 'bot-detection'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    // A wall the scanner hit is this audit's subject, not its blind spot. The
    // shipped audit looked for CAPTCHA markup in pages it never got, found
    // none, and passed the site that had just refused it. A rate limit is a
    // different thing — the scan asked too fast — so it is not reported here.
    const waf = ctx.wafProtection;
    if (waf?.isBlocked && !waf.isRateLimit) {
      return this.fail(
        `The site answered the scanner with a bot wall (${waf.name}). An AI agent acting for a user meets the same wall.`,
        'No bot wall or blocking CAPTCHA between an agent and the page',
        `${waf.name}: ${waf.reason}`,
        { priority: 'high', description: NoBlockingCaptchaAudit.meta.description },
        ctx.baseUrl,
      );
    }

    // Nothing here can be attributed to this site; see `scanReadTheSite`.
    if (!scanReadTheSite(ctx.evidence)) {
      return this.notApplicable(
        'No page here can be attributed to this site, so no form was inspected for a CAPTCHA.',
        'No recaptcha, hcaptcha, or turnstile script includes detected',
        unreadSiteReason(ctx.evidence),
      );
    }

    if (ctx.pages.length === 0) {
      return this.notApplicable(
        'No page was fetched, so no form could be inspected for a blocking CAPTCHA.',
        'No recaptcha, hcaptcha, or turnstile script includes detected',
        'No page fetched',
      );
    }

    const detectedCaptchas: Array<{ page: string; type: string }> = [];

    for (const page of ctx.pages) {
      const html = page.fetchResult.body.toLowerCase();
      for (const pattern of CAPTCHA_PATTERNS) {
        if (html.includes(pattern)) {
          detectedCaptchas.push({ page: page.url, type: pattern });
        }
      }
    }

    if (detectedCaptchas.length === 0) {
      return this.pass(
        'No blocking CAPTCHA scripts detected on scanned pages.',
        'No recaptcha, hcaptcha, or turnstile script includes detected',
        'No CAPTCHA detected',
      );
    }

    // Deduplicate by type
    const uniqueTypes = [...new Set(detectedCaptchas.map((c) => c.type))];

    return this.warn(
      `Blocking CAPTCHA detected: ${uniqueTypes.join(', ')}. This may prevent AI agents from submitting forms.`,
      'No recaptcha, hcaptcha, or turnstile script includes detected',
      `CAPTCHA: ${uniqueTypes.join(', ')} on ${[...new Set(detectedCaptchas.map((c) => c.page))].join(', ')}`,
      {
        priority: 'high',
        description: NoBlockingCaptchaAudit.meta.description,
        code: `<!-- Replace CAPTCHA with a honeypot field -->\n<form action="/api/contact" method="POST">\n  <!-- Hidden honeypot field - bots fill this, humans don't -->\n  <input type="text" name="website_url" style="display:none"\n    tabindex="-1" autocomplete="off" />\n\n  <input type="text" name="name" required />\n  <input type="email" name="email" required />\n  <textarea name="message" required></textarea>\n  <button type="submit">Send</button>\n</form>\n\n<!-- Server-side: reject if website_url is filled -->`,
      },
      detectedCaptchas[0]!.page,
    );
  }
}
