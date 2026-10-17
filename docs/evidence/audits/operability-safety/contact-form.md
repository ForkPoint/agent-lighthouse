---
audit: operability-safety/contact-form
category: operability-safety
source_file: packages/core/src/audits/operability-safety/contact-form.ts
slug: contact-form
evidence_grade: C
disposition: "keep — fix required"
reviewed: 2026-08-21
recommended_tier: informative
consumers:
  - "Google Search (Organization contactPoint/telephone/email influence the knowledge panel and the merchant brand profile — not an AI feature)"
  - "Browsers and OS dialers (tel: per RFC 3966)"
  - none-known for any AI agent as a documented task-completion affordance
signals:
  - name: "Contact and service endpoint discoverability (tel:/mailto: links, server-rendered contact forms, schema.org ContactPoint) for agent task completion"
    grade: C
    domain: discovery-infra
sources:
  - schema-contactpoint
  - google-organization-structured-data
  - rfc-3966-tel-uri
  - vercel-rise-of-ai-crawler
  - browserarena-arxiv
  - google-ai-features-trust
  - google-ai-optimization-mythbusting
---

# contact-form (`5.15`)

> operability-safety · source `contact-form.ts` · review verdict **fix** · evidence grade **C** · disposition: **keep — fix required**

## What it checks

AI agents increasingly handle tasks like "contact this company for a quote" on behalf of users. Without a machine-submittable contact form, agents cannot complete these requests, sending users to competitors who have one. Provide an HTML form or an API endpoint.

## Evidence

### Signal: Contact and service endpoint discoverability (tel:/mailto: links, server-rendered contact forms, schema.org ContactPoint) for agent task completion — grade C (discovery-infra)

**Mechanism:** Exposing contact affordances in server-rendered HTML — tel: and mailto: URIs, a non-JS-dependent contact form, and schema.org ContactPoint on the Organization — increases the rate at which AI agents extract correct contact details and complete contact/booking tasks. Falsifiable: if agents complete contact tasks at the same rate on sites with and without machine-readable contact endpoints, the claim fails.

**Evidence:** The specification layer is solid. ContactPoint is a core schema.org type carrying telephone, email, contactType, areaServed and hoursAvailable, and it is reported on 1M–10M domains. Google explicitly documents supporting contactPoint — 'The best way for a user to contact your business' — along with telephone, email and address on Organization. tel: is a ratified IETF Standards Track URI scheme (RFC 3966). The strongest AI-specific argument is derivative rather than direct, and it comes from the rendering gap. Vercel and MERJ established that GPTBot and ClaudeBot fetch but never execute JavaScript. A phone number or contact form injected client-side is therefore absent from what those crawlers see, while a server-rendered tel: link is trivially extractable. Google's generative-AI guide separately notes that 'Google Business Profiles can help your products and services be visible' — an off-site contact/service surface with a documented AI-adjacent role.

**Counter-evidence:** No AI vendor documents consuming ContactPoint, tel:, or mailto: for task completion. Google's AI-features page states outright that no special schema.org structured data is needed for AI features, and its Organization page ties contact properties to knowledge-panel display with no AI claim. Architecturally the premise is questionable for the leading agent. ChatGPT agent operates over screenshots of a virtual browser, and interacts through a simulated mouse and keyboard. It engages the rendered form visually rather than parsing machine-readable endpoints, so machine-readable contact metadata is not on its execution path at all. BrowserArena's live-web evaluation finds agent failures concentrated in CAPTCHAs, pop-up banners and direct URL navigation, i.e. in interaction friction rather than in missing contact metadata, so removing modals and keeping forms server-rendered likely matters far more than adding ContactPoint JSON-LD. Keep this informative: the markup is cheap and correct, but no measured agent-completion lift exists.

## Implementation deviations

### Not observed is not absent (2026-10-06)

The review above names the false negative: only the sampled pages are
scanned, so a form at `/support/` fails the site. A small marketing site
linked "Contact" from its header to a support page with a working form. The
scan held only the homepage and reported "No contact/lead form".

When no sampled page carries a contact form and no OpenAPI path matches, the
audit now reads the sampled pages' same-origin links. A link whose path or
text names a contact page (`contact`, `kontakt`, `support`, `inquiry`,
`enquiry`, `get in touch`, `reach out`) and that the scan did not fetch makes
the verdict `notApplicable`. The finding names up to three such links. A
form there was not observed, so its absence is not established. A site with
no form and no such link still fails.

Verdicts that moved in the real-page corpus: 18 single-page fixtures fail →
na, every one a page linking to a contact or support page outside the sample.

## Deferred

- **Unescaped `id` in `extractForms`.** The shared form parser builds a
  selector from a page-supplied `id` to find a control's label, the
  `label[for="..."]` lookup in `parser.ts`. An `id` carrying a quote or a
  backslash makes css-what throw inside `$()`; the throw escapes
  `extractForms`, so both audits that consume it — `forms-no-js` and
  `contact-form` — become `scan-error` stubs and the site is told nothing
  about either. No corpus fixture carries such an `id`, so nothing throws
  today; the class is live and latent. Two audits in this category already
  escape their interpolated values (`form-actionability` has
  `escapeAttrValue`, `form-autofill-token-coverage` has `cssEscape`), so the
  fix is to reuse one at the parser call site. Found by the real-page corpus
  snapshot, which caught the same shape throwing for real in
  `answer-readiness/extractor-survival-recall`.
- Following the unscanned contact link within a bounded fetch budget, so the
  form there is observed rather than inferred.
- A genuine absence still fails at high priority, though no documented
  consumer backs the grade-C claim. Moving it to `notApplicable` or `warn` is
  a separate decision.
