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

function isConfirmationUrl(url: string): boolean {
  return /\/(thank-?you|confirmation|success|order-complete)\b/i.test(url);
}

export class ActionSchemaAudit extends Audit {
  static override meta: AuditMeta = {
    id: '3.16',
    category: 'structured-data',
    title: 'ConfirmAction/ReserveAction schema',
    failureTitle: 'ConfirmAction/ReserveAction schema',
    description:
      'AI agents use ConfirmAction/ReserveAction schema to complete transactions on behalf of users in agentic workflows. Without this schema on your confirmation pages, agents cannot programmatically verify that a booking or purchase was successful.',
    scoreDisplayMode: 'informative',
    weight: 0,
    defaultPriority: 'low',
    deprecated: {
      notice: 'Agentic checkout confirms transactions over APIs (ACP, Maps Booking), never by page markup; ConfirmAction deployment is under 1K domains.',
      link: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/NOT-A-FACTOR.md#structured-dataaction-schema',
    },
    guidance: {
      impact:
        'Without ConfirmAction or ReserveAction schema on confirmation pages, AI agents cannot programmatically verify that a booking or purchase completed successfully. This breaks end-to-end agentic commerce workflows, forcing users back into manual checkout confirmation.',
      fix: 'Add a ConfirmAction or ReserveAction as a potentialAction on your thank-you/confirmation page JSON-LD. Include the target URL pointing to the confirmation endpoint.',
      code: `{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "potentialAction": {
    "@type": "ConfirmAction",
    "target": "https://yoursite.com/confirm"
  }
}`,
      effort: 'moderate',
      docsUrl: 'https://schema.org/ConfirmAction',
      tags: ['json-ld', 'schema', 'agentic-commerce', 'actions'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const confirmationPages = ctx.pages.filter((p) => isConfirmationUrl(p.url));

    if (confirmationPages.length === 0) {
      return this.warn(
        'No thank-you or confirmation pages detected to evaluate.',
        'ConfirmAction or ReserveAction schema on thank-you/confirmation pages.',
        'No confirmation pages detected (URLs containing /thank-you/, /confirmation/, /success/).',
        {
          priority: 'low',
          description:
            'If your site has booking or purchase flows, AI agents use ConfirmAction/ReserveAction schema to complete transactions on behalf of users. This enables end-to-end agentic workflows where the agent can confirm a booking without the user manually navigating forms.',
          code: `"potentialAction": {
  "@type": "ConfirmAction",
  "target": "https://yoursite.com/confirm"
}`,
        },
      );
    }

    const actionTypes = ['ConfirmAction', 'ReserveAction'];

    const pagesWithAction = confirmationPages.filter((p) => {
      const schemas = flattenJsonLd(p.structuredData ?? p.jsonLd);

      // Check for standalone action schemas
      const hasActionSchema = schemas.some((s) =>
        matchesAnyType(s as Record<string, unknown>, actionTypes),
      );

      // Check for potentialAction property with these types
      const hasActionProp = schemas.some((s) => {
        const obj = s as Record<string, unknown>;
        const action = obj['potentialAction'];
        if (!action) return false;
        const actions = Array.isArray(action) ? action : [action];
        return actions.some(
          (a) =>
            a && typeof a === 'object' && matchesAnyType(a as Record<string, unknown>, actionTypes),
        );
      });

      return hasActionSchema || hasActionProp;
    });

    const allHave = pagesWithAction.length === confirmationPages.length;
    const someHave = pagesWithAction.length > 0;

    if (allHave) {
      return this.pass(
        `ConfirmAction/ReserveAction found on all ${confirmationPages.length} confirmation page(s).`,
        'ConfirmAction or ReserveAction schema on thank-you/confirmation pages.',
        `${pagesWithAction.length}/${confirmationPages.length} confirmation pages with action schema`,
      );
    }

    if (someHave) {
      return this.warn(
        `ConfirmAction/ReserveAction found on ${pagesWithAction.length} of ${confirmationPages.length} confirmation page(s).`,
        'ConfirmAction or ReserveAction schema on thank-you/confirmation pages.',
        `${pagesWithAction.length}/${confirmationPages.length} confirmation pages with action schema`,
        {
          priority: 'low',
          description:
            'AI agents use ConfirmAction/ReserveAction schema to complete transactions on behalf of users in agentic workflows. Without this schema on your confirmation pages, agents cannot programmatically verify that a booking or purchase was successful.',
          code: `"potentialAction": {
  "@type": "ConfirmAction",
  "target": "https://yoursite.com/confirm"
}`,
        },
      );
    }

    return this.fail(
      `No ConfirmAction/ReserveAction found on ${confirmationPages.length} confirmation page(s).`,
      'ConfirmAction or ReserveAction schema on thank-you/confirmation pages.',
      `${pagesWithAction.length}/${confirmationPages.length} confirmation pages with action schema`,
      {
        priority: 'low',
        description:
          'AI agents use ConfirmAction/ReserveAction schema to complete transactions on behalf of users in agentic workflows. Without this schema on your confirmation pages, agents cannot programmatically verify that a booking or purchase was successful.',
        code: `"potentialAction": {
  "@type": "ConfirmAction",
  "target": "https://yoursite.com/confirm"
}`,
      },
    );
  }
}
