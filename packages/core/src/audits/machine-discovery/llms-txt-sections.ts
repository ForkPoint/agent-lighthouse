// TODO(merge): folds into machine-discovery/llms-txt-structure in Plan 4 (approved 2026-08-21).

import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import { weightForGrade } from '../../scorer';
import type { FetchResult } from '../../fetcher';

function isOk(result: FetchResult): boolean {
  return result.status === 200;
}

export class LlmsTxtSectionsAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'machine-discovery/llms-txt-sections',
    category: 'machine-discovery',
    title: 'llms.txt has H2 sections',
    failureTitle: 'llms.txt has H2 sections',
    description:
      'H2 sections help AI agents navigate your llms.txt by topic. Without them, agents must scan the entire file linearly.',
    scoreDisplayMode: 'informative',
    weight: weightForGrade('C', 'informative'),
    evidenceGrade: 'C',
    tier: 'informative',
    dossier: 'docs/evidence/audits/machine-discovery/llms-txt-sections.md',
    defaultPriority: 'medium',
    guidance: {
      impact:
        'Without H2 sections, AI agents must scan your entire llms.txt linearly to find relevant content. Sections let agents jump directly to the topic they need, producing faster and more accurate responses.',
      fix: 'Organize your llms.txt links under H2 headings (## Section Name) that group related pages. Use intuitive section names like ## Documentation, ## API, ## Blog, ## Company.',
      code: '## Documentation\n- [Getting Started](/docs/start): Quick start guide\n- [API Reference](/docs/api): Full API documentation\n\n## Company\n- [About](/about): Company information\n- [Blog](/blog): Latest updates',
      effort: 'trivial',
      docsUrl: 'https://llmstxt.org/',
      tags: ['llms-txt', 'discoverability'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const result = ctx.rootFiles['/llms.txt'];

    if (!result || !isOk(result)) {
      return this.fail(
        'llms.txt not found; cannot check for H2 sections.',
        'At least one ## heading',
        'File not found',
        {
          priority: 'critical',
          description:
            'First, create your llms.txt file (see check 1.1). H2 sections organize your content into logical groups so AI agents can quickly navigate to relevant information.',
          code: `# Your Site Name\n\n> Brief description of your site for AI agents.\n\n## Pages\n- [Home](/): Main landing page\n- [About](/about/): Company information`,
        },
      );
    }

    const h2Lines = result.body.split('\n').filter((l) => /^##\s/.test(l.trimStart()));

    if (h2Lines.length === 0) {
      return this.fail(
        'llms.txt has no H2 sections to organize content.',
        'At least one ## heading',
        'No ## headings found',
        {
          priority: 'medium',
          description:
            'H2 sections help AI agents navigate your llms.txt by topic. Without them, agents must scan the entire file linearly. Use sections like ## Documentation, ## API, ## Blog to group related links.',
          code: `## Documentation\n- [Getting Started](/docs/start): Quick start guide\n- [API Reference](/docs/api): Full API documentation\n\n## Company\n- [About](/about): Company information\n- [Blog](/blog): Latest updates`,
        },
      );
    }

    return this.pass(
      `llms.txt has ${h2Lines.length} H2 section(s).`,
      'At least one ## heading',
      `${h2Lines.length} ## heading(s) found`,
    );
  }
}
