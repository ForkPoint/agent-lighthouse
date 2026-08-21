import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import { weightForGrade } from '../../scorer';
import type { FetchResult } from '../../fetcher';
import { extractMarkdownLinks } from '../../parser';

function isOk(result: FetchResult): boolean {
  return result.status === 200;
}

export class LlmsTxtLinkDescriptionsAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'machine-discovery/llms-txt-link-descriptions',
    category: 'machine-discovery',
    title: 'llms.txt links include descriptions',
    failureTitle: 'llms.txt links include descriptions',
    description:
      'Link descriptions help AI agents understand what each page covers without visiting it, reducing unnecessary crawling.',
    scoreDisplayMode: 'informative',
    weight: weightForGrade('C', 'informative'),
    evidenceGrade: 'C',
    tier: 'informative',
    dossier: 'docs/evidence/audits/machine-discovery/llms-txt-link-descriptions.md',
    defaultPriority: 'medium',
    guidance: {
      impact:
        'Links without descriptions force AI agents to visit every page to understand its content, wasting crawl budget and slowing down response generation. Described links let agents filter relevant pages instantly.',
      fix: 'Add a colon and brief description after each link URL in your llms.txt file. Describe what the page covers in a few words so agents can decide which pages to visit.',
      code: '- [Getting Started](/docs/start): Step-by-step guide for new users\n- [API Reference](/docs/api): Complete endpoint documentation\n- [Pricing](/pricing): Plans and pricing information',
      effort: 'trivial',
      docsUrl: 'https://llmstxt.org/',
      tags: ['llms-txt', 'discoverability'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const result = ctx.rootFiles['/llms.txt'];

    if (!result || !isOk(result)) {
      return this.fail(
        'llms.txt not found; cannot check link descriptions.',
        'Links follow - [Name](url): description',
        'File not found',
        {
          priority: 'critical',
          description:
            'First, create your llms.txt file (see check 1.1). Link descriptions help AI agents understand what each page covers without visiting it, reducing unnecessary crawling.',
          code: `# Your Site Name\n\n> Brief description of your site for AI agents.\n\n## Pages\n- [Home](/): Main landing page\n- [About](/about/): Company information`,
        },
      );
    }

    const links = extractMarkdownLinks(result.body);

    if (links.length === 0) {
      return this.warn(
        'llms.txt contains no markdown links.',
        'Links follow - [Name](url): description pattern',
        'No links found',
        {
          priority: 'medium',
          description:
            'Without links, AI agents cannot discover your pages from llms.txt. Add links to your most important pages using the markdown list format with descriptions so agents know what each page covers.',
          code: `- [Getting Started](/docs/start): Step-by-step guide for new users\n- [API Reference](/docs/api): Complete endpoint documentation\n- [Pricing](/pricing): Plans and pricing information`,
        },
      );
    }

    const withDescription = links.filter((l) => l.description.length > 0);
    const ratio = withDescription.length / links.length;

    if (ratio < 0.5) {
      return this.fail(
        `Only ${withDescription.length}/${links.length} links have descriptions.`,
        'All links follow - [Name](url): description',
        `${withDescription.length}/${links.length} have descriptions`,
        {
          priority: 'medium',
          description:
            'Link descriptions help AI agents decide which pages to visit without crawling them all. Add a colon and brief description after each link URL explaining what the page covers.',
          code: `- [Page Name](/path): Brief description of the page content and purpose`,
        },
      );
    }

    if (ratio < 1.0) {
      return this.warn(
        `${withDescription.length}/${links.length} links have descriptions.`,
        'All links follow - [Name](url): description',
        `${withDescription.length}/${links.length} have descriptions`,
        {
          priority: 'low',
          description:
            'Some links are missing descriptions. Adding descriptions to all links helps AI agents efficiently filter relevant pages without visiting each one.',
          code: `- [Page Name](/path): Brief description of the page content and purpose`,
        },
      );
    }

    return this.pass(
      `All ${links.length} links include descriptions.`,
      'All links have descriptions',
      `${links.length}/${links.length} have descriptions`,
    );
  }
}
