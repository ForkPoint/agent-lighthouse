// TODO(redeem): this audit survives only if rewritten (pending triage approval). Target tier: scored.
// Evidence dossier: docs/evidence/audits/meta-tags/openapi-link.md
// Required rework:
//   Redeem via merge into agent-tools/openapi-exists: one discovery audit for real mechanisms incl.
//   RFC 9727 api-catalog (graded B), drop link-tag requirement that fails every site.

import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';

export class OpenApiLinkAudit extends Audit {
  static override meta: AuditMeta = {
    id: '4.18',
    category: 'meta-tags',
    title: 'OpenAPI spec link in head',
    failureTitle: 'OpenAPI spec link in head',
    description:
      'AI agents use OpenAPI specifications to understand your API endpoints, parameters, and response formats. An OpenAPI link in <head> enables agents to programmatically interact with your API without manual documentation parsing, powering agentic workflows that call your services.',
    scoreDisplayMode: 'binary',
    weight: 1.0,
    defaultPriority: 'low',
    guidance: {
      impact:
        'Without an OpenAPI spec link, AI agents cannot programmatically understand your API endpoints, parameters, and response formats. This blocks agentic workflows that could call your API services on behalf of users.',
      fix: 'If your site has an API, create an OpenAPI specification and add a <link rel="alternate"> tag in <head> pointing to it.',
      code: '<link rel="alternate" type="application/json" href="/openapi.json" title="OpenAPI Spec">',
      effort: 'complex',
      docsUrl: 'https://swagger.io/specification/',
      tags: ['meta-tags', 'openapi', 'api', 'ai-discovery'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages[0];
    /* v8 ignore start */
    const link = page?.headLinks?.find(
      (l) =>
        l.rel === 'alternate' &&
        l.type === 'application/json' &&
        (l.title ?? '').toLowerCase().includes('openapi'),
    );
    /* v8 ignore stop */

    if (link) {
      return this.pass(
        `OpenAPI spec link found: "${link.href}".`,
        '<link rel="alternate" type="application/json" title="...OpenAPI...">',
        `href="${link.href}" title="${link.title}"`,
        page.url,
      );
    }

    return this.fail(
      'No OpenAPI spec link found in <head>.',
      '<link rel="alternate" type="application/json" title="...OpenAPI...">',
      'Not found',
      {
        priority: 'low',
        description:
          'AI agents use OpenAPI specifications to understand your API endpoints, parameters, and response formats. An OpenAPI link in <head> enables agents to programmatically interact with your API without manual documentation parsing, powering agentic workflows that call your services.',
        code: '<link rel="alternate" type="application/json" href="/openapi.json" title="OpenAPI Spec">',
      },
      page?.url,
    );
  }
}
