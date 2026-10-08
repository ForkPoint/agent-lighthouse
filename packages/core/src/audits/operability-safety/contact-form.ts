import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import { weightForGrade } from "../../scorer";
import type { CheckContext } from "../../check-context";
import { extractForms } from "../../parser";
import { openApiOperations, readOpenApiSpec } from "../../gatherers/openapi";
import {
  AuditTier,
  CheckPriority,
  EvidenceGrade,
  EvidenceKey,
  FixEffort,
  ScoreDisplayMode,
} from "../../types";

const CONTACT_INDICATORS = [
  "contact",
  "inquiry",
  "enquiry",
  "lead",
  "get-in-touch",
  "getintouch",
  "reach-out",
  "message",
  "feedback",
  "support",
];

/**
 * Link paths and texts that name a contact page. Narrower than the form
 * indicators: a link to `/leadership` or a "message" from the CEO is not one.
 */
const CONTACT_LINK_RE =
  /contact|kontakt|support|inquiry|enquiry|get[-_ ]?in[-_ ]?touch|reach[-_ ]?out/i;

/** Most unscanned contact links named in the finding. */
const MAX_NAMED_LINKS = 3;

/**
 * Same-origin links on the sampled pages that name a contact page the scan
 * did not fetch. Such a form was not observed, which is not proof it is
 * absent.
 */
function unscannedContactLinks(ctx: CheckContext): string[] {
  const scanned = new Set(ctx.pages.map((page) => page.url));
  const out = new Set<string>();
  for (const page of ctx.pages) {
    const origin = new URL(page.url).origin;
    page.$("a[href]").each((_i, el) => {
      const $a = page.$(el);
      let url: URL;
      try {
        url = new URL($a.attr("href") ?? "", page.url);
      } catch {
        return;
      }
      if (url.origin !== origin) return;
      url.hash = "";
      if (scanned.has(url.href)) return;
      if (CONTACT_LINK_RE.test(url.pathname) || CONTACT_LINK_RE.test($a.text()))
        out.add(url.href);
    });
  }
  return [...out];
}

export class ContactFormAudit extends Audit {
  static override meta: AuditMeta = {
    id: "operability-safety/contact-form",
    category: "operability-safety",
    title: "Contact/lead form endpoint",
    failureTitle: "Contact/lead form endpoint",
    description:
      'AI agents increasingly handle tasks like "contact this company for a quote" on behalf of users. Without a machine-submittable contact form, agents cannot complete these requests, sending users to competitors who have one. Provide an HTML form or an API endpoint.',
    scoreDisplayMode: ScoreDisplayMode.Informative,
    weight: weightForGrade(EvidenceGrade.C, AuditTier.Informative),
    evidenceGrade: EvidenceGrade.C,
    tier: AuditTier.Informative,
    dossier: "docs/evidence/audits/operability-safety/contact-form.md",
    requires: [
      EvidenceKey.OriginReachable,
      EvidenceKey.UnblockedFetches,
      EvidenceKey.RenderedBody,
      EvidenceKey.SampleAdequate,
    ],
    defaultPriority: CheckPriority.High,
    guidance: {
      impact:
        'When users ask AI agents to "contact this company for a quote" or "send a message to their support team," the agent needs a machine-submittable form or API endpoint. Without one, the agent cannot complete the request and users turn to competitors.',
      fix: "Add an HTML <form> with a standard action and method attribute for contact/inquiry submission, or expose a POST endpoint in your OpenAPI spec for contact requests.",
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
      effort: FixEffort.Moderate,
      tags: ["forms", "contact", "lead-generation"],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    // Check pages for forms with contact indicators
    for (const page of ctx.pages) {
      const forms = extractForms(page.$);
      for (const form of forms) {
        const formStr = JSON.stringify(form).toLowerCase();
        const matchedIndicator = CONTACT_INDICATORS.find((ind) =>
          formStr.includes(ind),
        );
        if (matchedIndicator) {
          return this.pass(
            `Contact/lead form found on ${page.url} (indicator: "${matchedIndicator}").`,
            "Page has a contact/inquiry form or OpenAPI has a POST contact endpoint",
            `Form with "${matchedIndicator}" on ${page.url}`,
            page.url,
          );
        }
      }
    }

    // Check OpenAPI for POST endpoints with contact-like paths
    const spec = readOpenApiSpec(ctx);
    if (spec) {
      const ops = openApiOperations(spec);
      for (const { path, method } of ops) {
        if (method === "post") {
          const pathLower = path.toLowerCase();
          const matchedIndicator = CONTACT_INDICATORS.find((ind) =>
            pathLower.includes(ind),
          );
          if (matchedIndicator) {
            return this.pass(
              `OpenAPI has POST endpoint "${path}" matching contact indicator "${matchedIndicator}".`,
              "Page has a contact/inquiry form or OpenAPI has a POST contact endpoint",
              `POST ${path}`,
            );
          }
        }
      }
    }

    const unscanned = unscannedContactLinks(ctx);
    if (unscanned.length > 0) {
      const named = unscanned.slice(0, MAX_NAMED_LINKS).join(", ");
      return this.notApplicable(
        `No contact form on the ${ctx.pages.length} sampled page(s), but they link to ${named}, which this scan did not fetch. A form there was not observed, so its absence is not established.`,
        "Page has a contact/inquiry form or OpenAPI has a POST contact endpoint",
        `Unscanned contact link(s): ${named}`,
      );
    }

    return this.fail(
      "No contact/lead form or POST contact endpoint found.",
      "Page has a contact/inquiry form or OpenAPI has a POST contact endpoint",
      "No contact form detected",
      {
        priority: CheckPriority.High,
        description: ContactFormAudit.meta.description,
        code: `<!-- HTML form approach -->\n<form action="/api/contact" method="POST">\n  <input type="text" name="name" placeholder="Name" required />\n  <input type="email" name="email" placeholder="Email" required />\n  <textarea name="message" placeholder="Message" required></textarea>\n  <button type="submit">Send</button>\n</form>\n\n<!-- Or OpenAPI approach -->\n"paths": {\n  "/api/contact": {\n    "post": {\n      "operationId": "submitContact",\n      "summary": "Submit a contact inquiry"\n    }\n  }\n}`,
      },
    );
  }
}
