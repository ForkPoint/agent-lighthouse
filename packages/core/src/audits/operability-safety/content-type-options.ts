// TODO(consolidate): security-header-hygiene (Plan 4).

import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import { weightForGrade } from '../../scorer';
import type { CheckContext } from '../../check-context';

export class ContentTypeOptionsAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'operability-safety/content-type-options',
    category: 'operability-safety',
    title: 'X-Content-Type-Options: nosniff',
    failureTitle: 'X-Content-Type-Options: nosniff',
    description:
      'AI agents that fetch your JSON-LD, llms.txt, or API responses need correct MIME types to parse them. Without nosniff, browsers and agents may MIME-sniff responses incorrectly, causing JSON to be treated as HTML or plain text to be treated as a download.',
    scoreDisplayMode: 'informative',
    weight: weightForGrade('C', 'informative'),
    evidenceGrade: 'C',
    tier: 'informative',
    dossier: 'docs/evidence/audits/operability-safety/content-type-options.md',
    defaultPriority: 'medium',
    guidance: {
      impact:
        'Without the nosniff directive, browsers and AI agents may MIME-sniff your responses and misinterpret their format. JSON-LD can be treated as HTML, API responses parsed as plain text, and structured data silently ignored — breaking schema extraction and product data ingestion.',
      fix: 'Add the X-Content-Type-Options: nosniff header to all responses. Most web servers and CDNs support this as a single configuration line.',
      code: 'X-Content-Type-Options: nosniff',
      effort: 'trivial',
      docsUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Content-Type-Options',
      tags: ['security', 'headers'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages?.[0];
    const headers = page?.fetchResult.headers ?? {};
    const value = headers['x-content-type-options'];

    if (value && value.toLowerCase().includes('nosniff')) {
      return this.pass(
        'X-Content-Type-Options is set to nosniff.',
        'X-Content-Type-Options: nosniff',
        `x-content-type-options: ${value}`,
        page?.url,
      );
    }

    if (value) {
      return this.warn(
        `X-Content-Type-Options header is present but not set to nosniff: "${value}"`,
        'X-Content-Type-Options: nosniff',
        `x-content-type-options: ${value}`,
        {
          priority: 'medium',
          description: 'Set the X-Content-Type-Options header value to "nosniff".',
          code: 'X-Content-Type-Options: nosniff',
        },
        page?.url,
      );
    }

    return this.fail(
      'X-Content-Type-Options header is missing. This prevents MIME-type sniffing attacks.',
      'X-Content-Type-Options: nosniff',
      'Header not found',
      {
        priority: 'medium',
        description:
          'AI agents that fetch your JSON-LD, llms.txt, or API responses need correct MIME types to parse them. Without nosniff, browsers and agents may MIME-sniff responses incorrectly, causing JSON to be treated as HTML or plain text to be treated as a download.',
        code: 'X-Content-Type-Options: nosniff',
      },
      page?.url,
    );
  }
}
