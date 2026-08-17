import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import { flattenJsonLd } from '../../parser';

function matchesAnyType(schema: Record<string, unknown>, types: string[]): boolean {
  return types.some((t) => {
    const st = schema['@type'];
    if (typeof st === 'string') return st === t;
    if (Array.isArray(st)) return st.includes(t);
    return false;
  });
}

function allSchemas(ctx: CheckContext): object[] {
  return ctx.pages.flatMap((p) => flattenJsonLd(p.structuredData ?? p.jsonLd));
}

export class PotentialActionAudit extends Audit {
  static override meta: AuditMeta = {
    id: '3.10',
    category: 'structured-data',
    title: 'potentialAction on service pages',
    failureTitle: 'potentialAction on service pages',
    description:
      'AI agents use potentialAction to understand what actions users can take on your site (order, book, contact). This enables agentic workflows where ChatGPT or Claude can guide users directly to the right action URL instead of just describing your service.',
    scoreDisplayMode: 'binary',
    weight: 1.0,
    applicablePageTypes: ['homepage', 'product'],
    defaultPriority: 'medium',
    guidance: {
      impact:
        'Without potentialAction schema, AI agents cannot determine what actions users can take on your site (order, book, contact). This prevents agentic workflows where ChatGPT or Claude could guide users directly to the right action URL, reducing conversion from AI-driven traffic.',
      fix: 'Add a potentialAction property to your Organization or Service schema with a ContactAction, OrderAction, or BookAction type and a target URL.',
      code: `{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Your Company",
  "potentialAction": {
    "@type": "OrderAction",
    "target": "https://yoursite.com/order"
  }
}`,
      effort: 'easy',
      docsUrl: 'https://schema.org/potentialAction',
      tags: ['json-ld', 'schema', 'actions', 'agentic-commerce'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const actionTypes = ['ContactAction', 'OrderAction', 'BookAction'];
    const schemas = allSchemas(ctx);

    const withAction = schemas.filter((s) => {
      const obj = s as Record<string, unknown>;
      const action = obj['potentialAction'];
      if (!action) return false;

      const actions = Array.isArray(action) ? action : [action];
      return actions.some(
        (a) =>
          a && typeof a === 'object' && matchesAnyType(a as Record<string, unknown>, actionTypes),
      );
    });

    const found = withAction.length > 0;

    if (found) {
      return this.pass(
        `potentialAction (ContactAction/OrderAction/BookAction) found on ${withAction.length} schema(s).`,
        'At least one page with potentialAction (ContactAction, OrderAction, or BookAction).',
        `${withAction.length} schema(s) with qualifying potentialAction`,
      );
    }

    return this.fail(
      'No potentialAction with ContactAction, OrderAction, or BookAction found.',
      'At least one page with potentialAction (ContactAction, OrderAction, or BookAction).',
      'None',
      {
        priority: 'medium',
        description:
          'AI agents use potentialAction to understand what actions users can take on your site (order, book, contact). This enables agentic workflows where ChatGPT or Claude can guide users directly to the right action URL instead of just describing your service.',
        code: `"potentialAction": {
  "@type": "OrderAction",
  "target": "https://yoursite.com/order"
}`,
      },
    );
  }
}
