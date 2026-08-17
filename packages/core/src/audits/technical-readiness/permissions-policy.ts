import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';

export class PermissionsPolicyAudit extends Audit {
  static override meta: AuditMeta = {
    id: '8.6',
    category: 'technical-readiness',
    title: 'Permissions-Policy header',
    failureTitle: 'Permissions-Policy header',
    description:
      'AI browser agents that visit your site may trigger permission prompts for camera, microphone, or geolocation if Permissions-Policy is not set. These prompts block agent workflows and are flagged as security concerns by AI trust-scoring systems.',
    scoreDisplayMode: 'binary',
    weight: 1.0,
    defaultPriority: 'medium',
    guidance: {
      impact:
        "Without a Permissions-Policy header, AI browser agents visiting your site may trigger unexpected permission prompts for camera, microphone, or geolocation. These prompts block automated agent workflows entirely and are flagged by AI trust-scoring systems as a security concern, reducing your site's trust score.",
      fix: 'Add a Permissions-Policy header that disables sensitive browser features your site does not use. Deny camera, microphone, and geolocation unless your site explicitly requires them.',
      code: 'Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()',
      effort: 'trivial',
      docsUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Permissions-Policy',
      tags: ['security', 'headers', 'privacy'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages?.[0];
    const headers = page?.fetchResult.headers ?? {};
    const value = headers['permissions-policy'];

    if (value) {
      return this.pass(
        `Permissions-Policy header is present: ${value.length > 120 ? value.slice(0, 120) + '...' : value}`,
        'Permissions-Policy header present on homepage response',
        `permissions-policy: ${value.length > 120 ? value.slice(0, 120) + '...' : value}`,
        page?.url,
      );
    }

    return this.fail(
      'Permissions-Policy header is missing from the homepage response.',
      'Permissions-Policy header present on homepage response',
      'Header not found',
      {
        priority: 'medium',
        description:
          'AI browser agents that visit your site may trigger permission prompts for camera, microphone, or geolocation if Permissions-Policy is not set. These prompts block agent workflows and are flagged as security concerns by AI trust-scoring systems.',
        code: 'Permissions-Policy: camera=(), microphone=(), geolocation=()',
      },
      page?.url,
    );
  }
}
