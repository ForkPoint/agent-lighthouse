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
  - Google Search (Organization contactPoint/telephone/email influence knowledge panel and merchant brand profile
consumers_note: "not an AI feature), browsers and OS dialers (tel: per RFC 3966), none-known for any AI agent as a documented task-completion affordance"
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

## Code review findings (2026-08-20, 11-agent pass)

Real user-facing signal — 'contact this company for a quote' is a genuine agent task — but detection is an English-only substring scan over `JSON.stringify(form)`, which both false-passes on unrelated forms and false-fails every non-English site.

**Required fix:** Score on form SHAPE rather than keyword substrings: a form is contact-like when it contains an email-ish field plus a free-text field (textarea or a long text input) and posts via POST. Keep keywords only as a confidence booster, extend them with major non-English equivalents, and match them against structured fields (action path, input names, label text) rather than a stringified blob. Detect iframe/third-party form embeds (hsforms.net, typeform.com, jotform) as a partial pass rather than a fail. Use the shared OpenAPI loader.

**False-positive risks:**
- `const formStr = JSON.stringify(form).toLowerCase(); CONTACT_INDICATORS.find(ind => formStr.includes(ind))` matches anywhere in the serialized form — action, method, every input name, type, and label. A newsletter form with `<textarea name="message">`, a chat-widget form, or a search form on a page posting to `/newsletter?src=support` all yield a PASS for 'contact form found'. `'message'`, `'support'`, `'feedback'`, and `'lead'` are especially promiscuous ('lead' is a substring of nothing useful but matches inputs named `leadtime`, `download`).
- English-only indicators. German `kontakt` / `kontaktformular` contains no 'contact' substring; Japanese お問い合わせ, Chinese 联系我们, Russian Контакты, Polish `kontakt`, Swedish `kontakta` (matches) vs Dutch `contactformulier` (matches) — coverage is accidental and locale-dependent. A German or Japanese site with a perfect contact form FAILS.
- JS-rendered forms are invisible. React/Vue/HubSpot/Typeform embed forms as `<div id="hbspt-form">` or an iframe; `extractForms($)` finds nothing → 'No contact form detected' on sites that plainly have one.
- Multi-page coverage is luck-based: only pages the orchestrator discovered are scanned, and /contact is not guaranteed to be among them. A site whose contact form lives only at /kontakt/anfrage fails.
- The OpenAPI branch requires `method === 'post'` and a contact substring in the PATH. A real contact endpoint at `POST /v1/leads/submit` matches ('lead'), but `POST /v1/messages` matches too ('message') even if it is a chat API.
- Reuses the JSON-only `getOpenApiSpec()` copy, so YAML-spec sites lose the OpenAPI fallback.

**Test gaps:**
- No non-English fixture (kontakt / お問い合わせ / contacto / контакты)
- No false-positive fixture — e.g. a newsletter form containing name="message", or a search form on a /support page
- No JS-rendered / iframe-embedded form fixture (HubSpot, Typeform)
- No multi-page fixture where the contact form is on an undiscovered page
- No YAML-spec fixture

**Overlaps with:** `5.19`, `5.27`

## Evidence

### Signal: Contact and service endpoint discoverability (tel:/mailto: links, server-rendered contact forms, schema.org ContactPoint) for agent task completion — grade C (discovery-infra)

**Mechanism:** Exposing contact affordances in server-rendered HTML — tel: and mailto: URIs, a non-JS-dependent contact form, and schema.org ContactPoint on the Organization — increases the rate at which AI agents extract correct contact details and complete contact/booking tasks. Falsifiable: if agents complete contact tasks at the same rate on sites with and without machine-readable contact endpoints, the claim fails.

**Evidence:** The specification layer is solid: ContactPoint is a core schema.org type with telephone, email, contactType, areaServed and hoursAvailable, reported on 1M–10M domains, and Google explicitly documents supporting contactPoint ('The best way for a user to contact your business'), telephone, email and address on Organization. tel: is a ratified IETF Standards Track URI scheme (RFC 3966). The strongest AI-specific argument is derivative rather than direct, and it comes from the rendering gap: Vercel and MERJ established that GPTBot and ClaudeBot fetch but never execute JavaScript, so a phone number or contact form injected client-side is simply absent from what those crawlers see, while a server-rendered tel: link is trivially extractable. Google's generative-AI guide separately notes that 'Google Business Profiles can help your products and services be visible' — an off-site contact/service surface with a documented AI-adjacent role.

**Counter-evidence:** No AI vendor documents consuming ContactPoint, tel:, or mailto: for task completion. Google's AI-features page states outright that no special schema.org structured data is needed for AI features, and its Organization page ties contact properties to knowledge-panel display with no AI claim. Architecturally the premise is questionable for the leading agent: ChatGPT agent operates over screenshots of a virtual browser and interacts via simulated mouse and keyboard, so it engages the RENDERED form visually rather than parsing machine-readable endpoints — machine-readable contact metadata is not on its execution path at all. BrowserArena's live-web evaluation finds agent failures concentrated in CAPTCHAs, pop-up banners and direct URL navigation, i.e. in interaction friction rather than in missing contact metadata, so removing modals and keeping forms server-rendered likely matters far more than adding ContactPoint JSON-LD. Keep this informative: the markup is cheap and correct, but no measured agent-completion lift exists.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
