import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';

export class WebmcpDeclarativeFormsAudit extends Audit {
  static override meta: AuditMeta = {
    id: '5.21',
    category: 'agent-tools',
    title: 'WebMCP declarative form tools',
    failureTitle: 'WebMCP declarative form tools',
    description:
      "WebMCP's Declarative API lets you expose HTML forms as agent-callable tools by adding toolname and tooldescription attributes. AI agents can then discover and invoke these forms without JavaScript, using standard HTML semantics.",
    scoreDisplayMode: 'ternary',
    weight: 1.0,
    defaultPriority: 'high',
    guidance: {
      impact:
        'Without WebMCP declarative attributes, AI agents cannot discover your forms as structured tools. They must rely on heuristics or vision to identify interactive elements, leading to unreliable agent interactions.',
      fix: 'Add toolname and tooldescription attributes to your <form> elements to expose them as WebMCP tools.',
      code: `<!-- WebMCP declarative form -->
<form toolname="searchProducts"
      tooldescription="Search the product catalog by keyword"
      action="/search" method="GET">
  <input type="text" name="q" placeholder="Search products..." />
  <button type="submit">Search</button>
</form>

<!-- Checkout form -->
<form toolname="addToCart"
      tooldescription="Add a product to the shopping cart"
      action="/cart/add" method="POST">
  <input type="hidden" name="product_id" />
  <input type="number" name="quantity" value="1" min="1" />
  <button type="submit">Add to Cart</button>
</form>`,
      effort: 'easy',
      docsUrl: 'https://webmcp.link/',
      tags: ['webmcp', 'declarative', 'forms', 'chrome-146'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    let totalForms = 0;
    let webmcpForms = 0;
    let firstPageUrl = '';
    const toolNames: string[] = [];

    for (const page of ctx.pages) {
      const forms = page.$('form');
      forms.each((_, el) => {
        totalForms++;
        const toolname = page.$(el).attr('toolname');
        const tooldescription = page.$(el).attr('tooldescription');
        if (toolname) {
          webmcpForms++;
          toolNames.push(toolname);
          if (!firstPageUrl) firstPageUrl = page.url;
        } else if (tooldescription) {
          // Has description but no name — partial implementation
          webmcpForms++;
          if (!firstPageUrl) firstPageUrl = page.url;
        }
      });
    }

    if (totalForms === 0) {
      return this.warn(
        'No forms found on scanned pages.',
        'At least one form with toolname and tooldescription attributes',
        '0 forms on scanned pages',
        'medium',
      );
    }

    if (webmcpForms === 0) {
      return this.fail(
        `Found ${totalForms} form(s) but none have WebMCP toolname/tooldescription attributes.`,
        'Forms have toolname and tooldescription attributes',
        `0/${totalForms} forms with WebMCP attributes`,
        'high',
      );
    }

    const toolsLabel = toolNames.length > 0 ? ` (tools: ${toolNames.join(', ')})` : '';

    if (webmcpForms < totalForms) {
      return this.warn(
        `${webmcpForms}/${totalForms} form(s) have WebMCP attributes${toolsLabel}.`,
        'All forms have toolname and tooldescription attributes',
        `${webmcpForms}/${totalForms} forms with WebMCP attributes`,
        'medium',
        firstPageUrl,
      );
    }

    return this.pass(
      `All ${totalForms} form(s) have WebMCP attributes${toolsLabel}.`,
      'Forms have toolname and tooldescription attributes',
      `${webmcpForms}/${totalForms} forms with WebMCP attributes`,
      firstPageUrl,
    );
  }
}
