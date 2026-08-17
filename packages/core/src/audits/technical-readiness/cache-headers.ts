import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';

export class CacheHeadersAudit extends Audit {
  static override meta: AuditMeta = {
    id: '8.11',
    category: 'technical-readiness',
    title: 'Cache headers on AI files',
    failureTitle: 'Cache headers on AI files',
    description:
      'Add Cache-Control headers to AI-facing files to improve performance and reduce unnecessary requests.',
    scoreDisplayMode: 'ternary',
    weight: 1.0,
    defaultPriority: 'low',
    guidance: {
      impact:
        'Without Cache-Control headers on AI-facing files, every AI agent request re-fetches the full file from your server. This wastes bandwidth, increases server load, and slows down agent crawling — especially during traffic spikes when multiple agents poll simultaneously.',
      fix: 'Add a Cache-Control response header to your /llms.txt and /openapi.json routes. A value of "public, max-age=3600" lets agents cache the file for one hour, which is a good balance between freshness and efficiency.',
      code: 'Cache-Control: public, max-age=3600',
      effort: 'trivial',
      tags: ['performance', 'caching', 'ai-files'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages?.[0];
    const aiPaths = ['/llms.txt', '/openapi.json'];
    const withCache: string[] = [];
    const withoutCache: string[] = [];
    let checked = 0;

    for (const path of aiPaths) {
      const file = ctx.rootFiles[path];
      if (!file || file.status !== 200) continue;
      checked++;

      if (file.headers['cache-control']) {
        withCache.push(path);
      } else {
        withoutCache.push(path);
      }
    }

    if (checked === 0) {
      return this.warn(
        'No AI files (/llms.txt, /openapi.json) found to check cache headers.',
        'AI files have a Cache-Control header',
        'No applicable files found',
        undefined,
        page?.url,
      );
    }

    if (withoutCache.length === 0) {
      return this.pass(
        `All AI files have Cache-Control headers: ${withCache.join(', ')}`,
        'AI files have a Cache-Control header',
        `Cache-Control present on: ${withCache.join(', ')}`,
        page?.url,
      );
    }

    if (withCache.length > 0) {
      return this.warn(
        `Some AI files are missing Cache-Control headers: ${withoutCache.join(', ')}`,
        'AI files have a Cache-Control header',
        `Present: ${withCache.join(', ')}; Missing: ${withoutCache.join(', ')}`,
        {
          priority: 'low',
          description:
            'Add Cache-Control headers to AI files to reduce server load from repeated agent requests.',
          code: 'Cache-Control: public, max-age=3600',
        },
        page?.url,
      );
    }

    return this.fail(
      'No AI files have Cache-Control headers. Agents may re-fetch these files unnecessarily.',
      'AI files have a Cache-Control header',
      `Missing Cache-Control: ${withoutCache.join(', ')}`,
      {
        priority: 'low',
        description:
          'Add Cache-Control headers to AI-facing files to improve performance and reduce unnecessary requests.',
        code: 'Cache-Control: public, max-age=3600',
      },
      page?.url,
    );
  }
}
