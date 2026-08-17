import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';

export class AddressElementAudit extends Audit {
  static override meta: AuditMeta = {
    id: '6.12',
    category: 'semantic-html',
    title: '<address> for contact info',
    failureTitle: '<address> for contact info',
    description:
      'AI agents use <address> elements to extract contact information (email, phone, physical address) for structured answers to "how to contact" queries. Without semantic <address> markup, agents must guess which text on your page is contact info.',
    scoreDisplayMode: 'binary',
    weight: 1.0,
    applicablePageTypes: ['homepage'],
    defaultPriority: 'low',
    guidance: {
      impact:
        'AI agents cannot reliably extract contact information (email, phone, physical address) when it is not wrapped in an <address> element. This means your business contact details may be omitted from AI-generated answers to "how do I contact" queries.',
      fix: 'Wrap all contact information blocks (email addresses, phone numbers, physical addresses) in an <address> element. Place it in the <footer> or near the relevant content section.',
      code: '<address>\n  <a href="mailto:info@yoursite.com">info@yoursite.com</a><br>\n  <a href="tel:+1234567890">+1 (234) 567-890</a><br>\n  123 Main St, City, ST 12345\n</address>',
      effort: 'trivial',
      docsUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Element/address',
      tags: ['contact', 'semantic', 'html'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    let pagesWithAddress = 0;

    for (const page of ctx.pages) {
      if (page.$('address').length > 0) pagesWithAddress++;
    }

    const hasAddress = pagesWithAddress > 0;

    if (hasAddress) {
      return this.pass(
        `${pagesWithAddress}/${ctx.pages.length} page(s) use <address> for contact information.`,
        '<address> element used for contact information',
        `${pagesWithAddress} page(s) with <address>`,
      );
    }

    return this.warn(
      'No <address> elements found. If contact information exists, consider using <address>.',
      '<address> element used for contact information',
      'No <address> elements found',
      {
        priority: 'low',
        description:
          'AI agents use <address> elements to extract contact information (email, phone, physical address) for structured answers to "how to contact" queries. Without semantic <address> markup, agents must guess which text on your page is contact info.',
        code: '<address>\n  <a href="mailto:info@yoursite.com">info@yoursite.com</a><br>\n  123 Main St, City, ST 12345\n</address>',
      },
    );
  }
}
