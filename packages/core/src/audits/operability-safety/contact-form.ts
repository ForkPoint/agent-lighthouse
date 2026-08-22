import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import { weightForGrade } from '../../scorer';
import type { CheckContext } from '../../check-context';
import { extractForms } from '../../parser';

function tryParseJson(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

type OpenApiPaths = Record<string, Record<string, unknown>>;
type OpenApiOperation = Record<string, unknown>;

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace'];

function getOpenApiSpec(ctx: {
  rootFiles: Record<string, { status: number; body: string }>;
}): Record<string, unknown> | undefined {
  const jsonResult = ctx.rootFiles['/openapi.json'];
  if (jsonResult && jsonResult.status === 200 && jsonResult.body) {
    const parsed = tryParseJson(jsonResult.body);
    if (isObject(parsed)) return parsed;
  }
  return undefined;
}

function getOperations(
  spec: Record<string, unknown>,
): Array<{ path: string; method: string; op: OpenApiOperation }> {
  const paths = spec['paths'] as OpenApiPaths | undefined;
  if (!isObject(paths)) return [];

  const ops: Array<{ path: string; method: string; op: OpenApiOperation }> = [];
  for (const [path, pathItem] of Object.entries(paths)) {
    if (!isObject(pathItem)) continue;
    for (const method of HTTP_METHODS) {
      const op = pathItem[method];
      if (isObject(op)) {
        ops.push({ path, method, op: op as OpenApiOperation });
      }
    }
  }
  return ops;
}

const CONTACT_INDICATORS = [
  'contact',
  'inquiry',
  'enquiry',
  'lead',
  'get-in-touch',
  'getintouch',
  'reach-out',
  'message',
  'feedback',
  'support',
];

export class ContactFormAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'operability-safety/contact-form',
    category: 'operability-safety',
    title: 'Contact/lead form endpoint',
    failureTitle: 'Contact/lead form endpoint',
    description:
      'AI agents increasingly handle tasks like "contact this company for a quote" on behalf of users. Without a machine-submittable contact form, agents cannot complete these requests, sending users to competitors who have one. Provide an HTML form or an API endpoint.',
    scoreDisplayMode: 'informative',
    weight: weightForGrade('C', 'informative'),
    evidenceGrade: 'C',
    tier: 'informative',
    dossier: 'docs/evidence/audits/operability-safety/contact-form.md',
    defaultPriority: 'high',
    guidance: {
      impact:
        'When users ask AI agents to "contact this company for a quote" or "send a message to their support team," the agent needs a machine-submittable form or API endpoint. Without one, the agent cannot complete the request and users turn to competitors.',
      fix: 'Add an HTML <form> with a standard action and method attribute for contact/inquiry submission, or expose a POST endpoint in your OpenAPI spec for contact requests.',
      code: `<!-- HTML form approach -->
<form action="/api/contact" method="POST">
  <input type="text" name="name" placeholder="Name" required />
  <input type="email" name="email" placeholder="Email" required />
  <textarea name="message" placeholder="Message" required></textarea>
  <button type="submit">Send</button>
</form>

<!-- Or OpenAPI approach -->
"paths": {
  "/api/contact": {
    "post": {
      "operationId": "submitContact",
      "summary": "Submit a contact inquiry"
    }
  }
}`,
      effort: 'moderate',
      tags: ['forms', 'contact', 'lead-generation'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    // Check pages for forms with contact indicators
    for (const page of ctx.pages) {
      const forms = extractForms(page.$);
      for (const form of forms) {
        const formStr = JSON.stringify(form).toLowerCase();
        const matchedIndicator = CONTACT_INDICATORS.find((ind) => formStr.includes(ind));
        if (matchedIndicator) {
          return this.pass(
            `Contact/lead form found on ${page.url} (indicator: "${matchedIndicator}").`,
            'Page has a contact/inquiry form or OpenAPI has a POST contact endpoint',
            `Form with "${matchedIndicator}" on ${page.url}`,
            page.url,
          );
        }
      }
    }

    // Check OpenAPI for POST endpoints with contact-like paths
    const spec = getOpenApiSpec(ctx);
    if (spec) {
      const ops = getOperations(spec);
      for (const { path, method } of ops) {
        if (method === 'post') {
          const pathLower = path.toLowerCase();
          const matchedIndicator = CONTACT_INDICATORS.find((ind) => pathLower.includes(ind));
          if (matchedIndicator) {
            return this.pass(
              `OpenAPI has POST endpoint "${path}" matching contact indicator "${matchedIndicator}".`,
              'Page has a contact/inquiry form or OpenAPI has a POST contact endpoint',
              `POST ${path}`,
            );
          }
        }
      }
    }

    return this.fail(
      'No contact/lead form or POST contact endpoint found.',
      'Page has a contact/inquiry form or OpenAPI has a POST contact endpoint',
      'No contact form detected',
      {
        priority: 'high',
        description: ContactFormAudit.meta.description,
        code: `<!-- HTML form approach -->\n<form action="/api/contact" method="POST">\n  <input type="text" name="name" placeholder="Name" required />\n  <input type="email" name="email" placeholder="Email" required />\n  <textarea name="message" placeholder="Message" required></textarea>\n  <button type="submit">Send</button>\n</form>\n\n<!-- Or OpenAPI approach -->\n"paths": {\n  "/api/contact": {\n    "post": {\n      "operationId": "submitContact",\n      "summary": "Submit a contact inquiry"\n    }\n  }\n}`,
      },
    );
  }
}
