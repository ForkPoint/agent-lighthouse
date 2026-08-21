import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "RSL licensing terms discoverable and conformant".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade B → scored tier. Implementation difficulty: static-fetch.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/bot-auth-access/rsl-licensing-terms-discoverable-and-conformant.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// Static-fetch. 1) From /robots.txt collect every `License:` directive (file scope and per
// User-agent group); assert each value parses as an absolute URI — flag relative values as
// non-conformant rather than silently resolving them. 2) From the homepage and sampled pages, read
// `Link:` response headers, parse RFC 8288 params, and keep entries with rel=license AND
// type=application/rsl+xml. 3) Parse HTML for `<link rel="license" type="application/rsl+xml"
// href>` and for inline `<script type="application/rsl+xml">` blocks. 4) If no channel yields a
// candidate, optionally probe /license.xml and /rsl.xml — but report anything found only that way
// as 'present but not discoverable', since the spec mandates no default location. 5) Fetch each
// candidate and validate: root element `<rsl>` with `xmlns="https://rslstandard.org/rsl"`; response
// Content-Type is application/rsl+xml; at least one `<content url=…>`; the url prefix covers the
// audited page paths (a common bug is `<content url="/blog/">` while the site's articles live at
// `/articles/`); each `<license>` carries at least one of `<permits>`/`<prohibits>`/`<payment>`;
// every `<permits|prohibits>` has type in {usage,user,geo}; every `<payment>` has type in
// {purchase,subscription,crawl,use,attribution,free}; every `<amount>` has an ISO 4217 `currency`
// and a parseable decimal; `<copyright>` carries contactEmail or contactUrl. 6) Cross-check: if the
// site returns 402 anywhere (see the machine-actionable 402 check), require a `<payment
// type="crawl">` with an `<amount>`.
export class RslLicensingTermsDiscoverableAndConformantAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/bot-auth-access/rsl-licensing-terms-discoverable-and-conformant',
    category: 'bot-auth-access',
    title: "RSL licensing terms discoverable and conformant",
    failureTitle: "RSL licensing terms discoverable and conformant",
    description: "Validates that a site publishing content-licensing terms does so in a form an AI licensing agent can actually find and parse: an RSL 1.0 document reachable through at least one of the four spec-defined discovery channels, with a well-formed body whose content scope actually covers the audited pages.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "RSL 1.0 mandates explicit association — it defines no default or well-known location, so a valid rsl.xml sitting at an unreferenced URL is undiscoverable by specification (s12). Each discovery channel has exact conformance requirements that silently break the chain when violated: robots.txt `License:` 'value MUST be an absolute URI'; the HTTP `Link` header and the HTML `<link>` both require `rel=\"license\"` AND `type=\"application/rsl+xml\"`. A licensing crawler filtering Link headers on the media type will not follow a link served as `text/xml`. Falsifiable: given a site with licensing intent, either at least one conformant channel resolves to a parseable RSL document whose `<content url>` prefix covers the audited URL, or the terms are unreachable.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/bot-auth-access/rsl-licensing-terms-discoverable-and-conformant.md',
      tags: ['proposed', 'bot-auth-access'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/bot-auth-access/rsl-licensing-terms-discoverable-and-conformant.md',
      'TODO stub',
    );
  }
}
