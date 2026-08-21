import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';

export class FrameworkDetectionAudit extends Audit {
  static override meta: AuditMeta = {
    id: '8.21',
    category: 'technical-readiness',
    title: 'Frontend framework detection',
    failureTitle: 'Frontend framework detection',
    description:
      'AI agents can optimize their interaction strategy if they know the underlying technology stack (e.g., React, Next.js, Vue). This also helps identify potential client-side rendering issues.',
    scoreDisplayMode: 'informative',
    weight: 0,
    defaultPriority: 'low',
    deprecated: {
      notice: 'No vendor treats framework identity as an AI-readiness factor; Google frames the question purely as rendering outcome.',
      link: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/NOT-A-FACTOR.md#technical-readinessframework-detection',
    },
    guidance: {
      impact:
        'This is an informational audit. Knowing your frontend framework helps identify potential rendering issues — for example, pure client-side React apps are invisible to AI crawlers that do not execute JavaScript. Framework detection also helps prioritize other audit recommendations.',
      fix: 'No action required. This audit detects your framework automatically. If your framework relies on client-side rendering (e.g., Create React App, Vue SPA), consider switching to a server-rendering mode (Next.js, Nuxt, or SvelteKit) so AI crawlers can read your content.',
      effort: 'trivial',
      tags: ['informational', 'framework'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages[0];
    if (!page) {
      return this.fail('No pages available for analysis.', '', 'None');
    }

    const { meta, $ } = page;
    const frameworks: string[] = [];

    // 1. Meta tag detection
    if (meta['generator']) {
      frameworks.push(`Generator: ${meta['generator']}`);
    }
    if (meta['next-head-count'] || $('script[id="__NEXT_DATA__"]').length > 0) {
      frameworks.push('Next.js');
    }
    if (
      $('script[src*="nuxt"]').length > 0 ||
      (globalThis as { window?: { __NUXT__?: unknown } }).window?.__NUXT__
    ) {
      frameworks.push('Nuxt.js');
    }

    // 2. Script/Data attributes
    if ($('[data-reactroot], [data-reactid]').length > 0 || $('script[src*="react"]').length > 0) {
      frameworks.push('React');
    }
    if ($('[data-v-field], [data-v-]').length > 0 || $('script[src*="vue"]').length > 0) {
      frameworks.push('Vue.js');
    }
    if ($('app-root, [ng-version]').length > 0) {
      frameworks.push('Angular');
    }
    if ($('script[src*="astro"]').length > 0 || $('style[data-astro-cid]').length > 0) {
      frameworks.push('Astro');
    }
    if ($('script[src*="svelte"]').length > 0) {
      frameworks.push('Svelte');
    }

    if (frameworks.length > 0) {
      const unique = Array.from(new Set(frameworks));
      return this.pass(
        `Detected frameworks: ${unique.join(', ')}.`,
        'Identify the frontend framework used by the site.',
        unique.join(', '),
      );
    }

    return this.pass(
      'No specific frontend framework clearly detected.',
      'Identify the frontend framework used by the site.',
      'Generic/Unknown',
    );
  }
}
