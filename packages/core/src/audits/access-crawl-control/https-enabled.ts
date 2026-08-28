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
    // Gate exemption: a base URL on plain HTTP is proven by the request, with no response
    // at all, and that fail is worth reporting on a site whose homepage never answered.
    requires: [],
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
    const isHttps = ctx.baseUrl.startsWith('https://');
    const page = ctx.pages?.[0];
    const status200 = page?.fetchResult.status === 200;

    // The scheme is a property of the request, so this branch is true with no
    // response at all — and a site on plain HTTP is worth saying even when the
    // scan was walled. It therefore runs before the attribution guard.
    if (!isHttps) {
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

    // Past here every verdict rests on the homepage response, and a response
    // this scan cannot attribute to the site proves nothing about its TLS.
    // The branch below warned "Possible TLS or server error" whenever no 200
    // arrived, which on a bot wall named a fault that does not exist.
    if (!scanReadTheSite(ctx.evidence)) {
      return this.notApplicable(
        'No homepage here can be attributed to this site, so its transport was not judged.',
        'Base URL uses https:// and homepage returns 200',
        unreadSiteReason(ctx.evidence),
      );
    }

    if (status200) {
      return this.pass(
        'Site is served over HTTPS with a valid TLS connection.',
        'Base URL uses https:// and homepage returns 200',
        `${ctx.baseUrl} — status ${page?.fetchResult.status}`,
        page?.url,
      );
    }

    // One state reaches this, and it is not the one the old wording named. The
    // orchestrator admits a page only on `status === 200 && body`, so
    // `ctx.pages[0]` is always a 200 — `status200` is false only when the scan
    // holds no page at all. Attribution is proven above, so the homepage did
    // answer over HTTPS from this host and the connection succeeded; what it
    // did not return is a document. That is worth reporting, and it is not a
    // TLS error, which is what the old message diagnosed.
    //
    // The status is deliberately not named. `origin-reachable` accepts any
    // 2xx, so a homepage answering 204, 203 or 206 lands here as readily as an
    // empty 200, and the audit holds no homepage `FetchResult` to read the
    // real one from — `ctx.pages` is empty by definition on this branch. The
    // previous wording printed "200 with an empty body" for all of them.
    return this.warn(
      'Site uses HTTPS and the homepage answered, but the response carried no document, so an agent has nothing to read over that connection.',
      'Base URL uses https:// and homepage returns 200',
      `${ctx.baseUrl} — a 2xx response that carried no document`,
      {
        priority: 'high',
        description:
          'The homepage answered over HTTPS and returned no document — an empty 200 body, or a 2xx status that carries none. An AI agent that follows a link to this origin receives nothing, so nothing about the site can be indexed or quoted. Check the origin, the CDN cache entry and any edge rule that can strip a response body.',
        code: '# Reproduce with:\ncurl -sSi https://yoursite.com | head -20',
      },
      page?.url,
    );
  }
}
