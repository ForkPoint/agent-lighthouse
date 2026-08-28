import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import { weightForGrade } from '../../scorer';
import { scanReadTheSite, unreadSiteReason } from '../../scan-evidence';

export class HttpsEnabledAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'access-crawl-control/https-enabled',
    category: 'access-crawl-control',
    title: 'HTTPS enabled',
    failureTitle: 'HTTPS enabled',
    description:
      'Enterprise AI frameworks refuse to interact with non-HTTPS sites due to security policies. GPTBot, ClaudeBot, and enterprise RAG systems all skip HTTP-only sites entirely, making your content invisible to AI-generated answers. Enable HTTPS with a valid TLS certificate.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('A', 'scored'),
    evidenceGrade: 'A',
    tier: 'scored',
    dossier: 'docs/evidence/audits/access-crawl-control/https-enabled.md',
    // Gate exemption: being refused is what this category reports.
    requires: ['origin-reachable', 'rendered-body', 'sample-adequate'],
    defaultPriority: 'critical',
    guidance: {
      impact:
        'HTTP-only sites are completely excluded from all major AI systems. GPTBot, ClaudeBot, Perplexity, and enterprise RAG pipelines refuse to connect to non-HTTPS origins due to security policies. Your entire site is invisible to AI-generated answers, product recommendations, and agentic workflows.',
      fix: "Enable HTTPS by obtaining a TLS certificate (free via Let's Encrypt) and configuring your web server to serve all traffic over HTTPS. Set up a 301 redirect from HTTP to HTTPS to ensure all traffic is encrypted.",
      code: "# Certbot (Let's Encrypt) quick setup:\nsudo certbot --nginx -d yoursite.com -d www.yoursite.com\n\n# Nginx HTTPS config:\nserver {\n  listen 443 ssl;\n  ssl_certificate /etc/letsencrypt/live/yoursite.com/fullchain.pem;\n  ssl_certificate_key /etc/letsencrypt/live/yoursite.com/privkey.pem;\n}",
      effort: 'easy',
      docsUrl: 'https://letsencrypt.org/getting-started/',
      tags: ['security', 'https', 'critical'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    // Nothing here can be attributed to this site; see `scanReadTheSite`.
    if (!scanReadTheSite(ctx.evidence)) {
      return this.notApplicable(
        'No homepage here can be attributed to this site, so its transport was not judged.',
        'Base URL uses https:// and homepage returns 200',
        unreadSiteReason(ctx.evidence),
      );
    }

    const isHttps = ctx.baseUrl.startsWith('https://');
    const page = ctx.pages?.[0];
    const status200 = page?.fetchResult.status === 200;

    if (isHttps && status200) {
      return this.pass(
        'Site is served over HTTPS with a valid TLS connection.',
        'Base URL uses https:// and homepage returns 200',
        `${ctx.baseUrl} — status ${page?.fetchResult.status}`,
        page?.url,
      );
    }

    if (isHttps && !status200) {
      return this.warn(
        `Site uses HTTPS but homepage returned status ${page?.fetchResult.status ?? 'unknown'}. Possible TLS or server error.`,
        'Base URL uses https:// and homepage returns 200',
        `${ctx.baseUrl} — status ${page?.fetchResult.status ?? 'N/A'}`,
        {
          priority: 'high',
          description:
            'Enterprise AI frameworks refuse to interact with sites that have TLS errors. A non-200 HTTPS response prevents AI agents from ingesting your content, effectively making your site invisible to all AI systems. Fix server or TLS configuration to return a clean 200.',
          code: '# Verify TLS with: curl -vI https://yoursite.com\n# Check for certificate expiry, chain issues, or redirect loops',
        },
        page?.url,
      );
    }

    return this.fail(
      'Site is not served over HTTPS. AI agents require secure connections.',
      'Base URL uses https:// and homepage returns 200',
      `Base URL: ${ctx.baseUrl}`,
      {
        priority: 'critical',
        description:
          'Enterprise AI frameworks refuse to interact with non-HTTPS sites due to security policies. GPTBot, ClaudeBot, and enterprise RAG systems all skip HTTP-only sites entirely, making your content invisible to AI-generated answers. Enable HTTPS with a valid TLS certificate.',
        code: '# For nginx:\nserver {\n  listen 443 ssl;\n  ssl_certificate /path/to/cert.pem;\n  ssl_certificate_key /path/to/key.pem;\n}',
      },
      page?.url,
    );
  }
}
