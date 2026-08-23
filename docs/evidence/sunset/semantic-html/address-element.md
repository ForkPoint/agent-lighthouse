---
audit: semantic-html/address-element
category: semantic-html
audit_id: "6.12"
source_file: packages/core/src/audits/semantic-html/address-element.ts
slug: address-element
review_verdict: delete
severity: low
disposition: "sunset (approved 2026-08-21)"
status: sunset
verdict: dead
evidence_grade: D
reviewed: 2026-08-21
---

# address-element — confirmed dead — delete

> Adversarial redemption research, 2026-08-21. The researcher's task was to **save** this audit by finding grade A/B evidence of a real consumer. Grade found: **D**.

## Claimed mechanism (steelmanned)

Steelmanned: answer engines routinely field 'how do I contact X' queries. If `<address>` is the machine-readable marker for a page's contact information, then a crawler or agent could lift email/phone/postal address out of it with certainty instead of pattern-matching free text, and sites without `<address>` would see their contact details omitted or mangled in AI answers. For this to hold, some extractor, crawler, or a11y-tree-reading agent would have to treat `<address>` as a distinguishable, named contact region.

## What we searched

WebSearch quota was exhausted, so I checked the primary sources directly. I fetched the WHATWG HTML spec section for the `address` element to see what it actually licenses; W3C ARIA-in-HTML and HTML-AAM for its accessibility role mapping; and Google's LocalBusiness structured-data documentation to see what the largest answer-engine vendor actually asks for when it wants contact info. I read trafilatura's raw settings.py to see how `address` is handled by an LLM-corpus extractor, and Mozilla Readability's source for the same. I then ran a live Chromium accessibility snapshot via Playwright MCP on a probe page containing an `<address>` block in the footer alongside an identical contact block marked up as a plain `<p>`, to see whether an agent reading the a11y tree can tell them apart. I also inventoried the Agent Lighthouse structured-data audits to check whether a documented mechanism for the same information is already covered.

## Best evidence found for the audit

The strongest thing found for it is thin and nominal: W3C ARIA in HTML assigns `address` the implicit `role=group`, so it is not literally absent from the accessibility tree. That is the entire case. In practice it collapsed under test: in my live Chromium snapshot the `<address>` block rendered as an unnamed `generic [ref=e17]` node — byte-for-byte the same shape a plain `<div>` produces — while the semantically identical contact block marked as `<p>` rendered as `paragraph [ref=e19]` with the same text. Nothing in the tree said 'this is contact information'. No vendor doc, crawler doc, or extractor was found anywhere that keys on `<address>`.

## Counter-evidence

Positive proof of uselessness on three fronts. (1) Vendor mechanism is elsewhere and explicit: Google's LocalBusiness structured-data documentation specifies contact data via JSON-LD schema.org — `address` as a `PostalAddress` object with streetAddress/addressLocality/addressRegion/postalCode/addressCountry, and `telephone` for phone — and never mentions the HTML `<address>` element anywhere (https://developers.google.com/search/docs/appearance/structured-data/local-business). The documented consumer reads schema.org, not the tag. (2) An LLM-corpus extractor deletes the tag outright: trafilatura's `MANUALLY_STRIPPED` list is `"abbr", "acronym", "address", "bdi", ...` — the `<address>` element is unwrapped and its markup discarded, so any model trained or grounded on trafilatura-extracted text sees the contact text with zero signal that it was `<address>`. (3) The spec actively narrows it against the audit's own guidance: WHATWG states 'The address element represents the contact information for its nearest article or body element ancestor' and 'The address element must not be used to represent arbitrary addresses (e.g. postal addresses), unless those addresses are in fact the relevant contact information', directing general mailing addresses to `<p>` instead. The audit's own `code` example (`<address>… 123 Main St, City, ST 12345</address>`) is exactly the misuse the spec warns about when the address is not the page's own contact info — so this audit can push authors into spec-violating markup. (4) It is redundant within the project: /Users/kirov/dev/forkpoint/agent-lighthouse/packages/core/src/audits/structured-data/local-business-schema.ts and organization-schema.ts already audit the mechanism that is actually documented as consumed.

## Verdict

**confirmed dead — delete** (grade D)

Grade D. There is no consumer — not a crawler, not an extractor, not an agent. The a11y tree flattens `<address>` to an unnamed generic node indistinguishable from a div (verified live), trafilatura strips the tag entirely, and Google's own contact-info documentation routes exclusively through schema.org PostalAddress/telephone without ever naming the element. Adoption is also not wide enough to qualify as an informative community convention, and the spec restricts it more narrowly than the audit's guidance assumes — the audit's example markup would violate WHATWG's 'must not be used to represent arbitrary addresses' rule for any page where that address is not the page's own contact information. It is a strictly inferior duplicate of local-business-schema/organization-schema, which are already in the audit set. Delete; if any contact-extraction guidance is wanted, fold it into the schema.org audits.

## Sources

- **[Local business (LocalBusiness) structured data](https://developers.google.com/search/docs/appearance/structured-data/local-business)** — Google (vendor-doc, URL verified 2026-08-21)
  - Google's documented mechanism for business contact information is JSON-LD schema.org: `address` as a `PostalAddress` with streetAddress/addressLocality/addressRegion/postalCode/addressCountry, and `telephone` for the primary contact number. The HTML <address> element is not mentioned anywhere in the documentation.
- **[WHATWG HTML — the address element](https://html.spec.whatwg.org/multipage/sections.html)** — WHATWG (spec, URL verified 2026-08-21)
  - 'The address element represents the contact information for its nearest article or body element ancestor.' and 'The address element must not be used to represent arbitrary addresses (e.g. postal addresses), unless those addresses are in fact the relevant contact information.' General mailing addresses should use <p>. The audit's guidance and code example ignore this restriction.
- **[trafilatura/settings.py — MANUALLY_STRIPPED](https://raw.githubusercontent.com/adbar/trafilatura/master/trafilatura/settings.py)** — Adrien Barbaresi / trafilatura (repo, URL verified 2026-08-21)
  - MANUALLY_STRIPPED contains "address" ( "abbr", "acronym", "address", "bdi", "bdo", ... ) — the <address> tag is unwrapped and discarded during extraction, so downstream LLM text retains the contact text with no marker that it was <address>. Positive evidence the signal is destroyed before reaching a model.
- **[Live Chromium accessibility snapshot of a probe page (own experiment)](https://playwright.dev/docs/aria-snapshots)** — Own experiment via Playwright MCP + Chromium (study, URL verified 2026-08-21)
  - A footer <address> containing a mailto link and a street address rendered as an unnamed `generic [ref=e17]` node — identical in shape to a plain div — while an equivalent contact block in a <p> rendered as `paragraph [ref=e19]`. The agent-facing accessibility tree carries no 'contact information' semantics for <address>.
- **[ARIA in HTML](https://www.w3.org/TR/html-aria/)** — W3C (spec, URL verified 2026-08-21)
  - Assigns `address` the implicit `role=group`. This is the only formal machine semantics the element carries, and an unnamed group conveys no contact-information meaning; Chromium in practice exposes it as generic.
- **[Browser use tool](https://platform.claude.com/docs/en/docs/agents-and-tools/tool-use/browser-use-tool)** — Anthropic (vendor-doc, URL verified 2026-08-21)
  - Documents that the agent reads the page as an accessibility tree via `read_page`. Combined with the snapshot experiment, this establishes that the representation Claude receives contains no <address>-specific signal to act on.

## v1 dossier — what it checked and the 2026-08-20 code review

Merged in on 2026-08-22 from `docs/evidence/audits/semantic-html/address-element.md`, so a removed audit has exactly one dossier and it lives here.

### What it checks

AI agents use <address> elements to extract contact information (email, phone, physical address) for structured answers to "how to contact" queries. Without semantic <address> markup, agents must guess which text on your page is contact info.

### Code review findings (2026-08-20, 11-agent pass)

Falsy audit. It passes if a single <address> exists anywhere ('const hasAddress = pagesWithAddress > 0') and otherwise only warns, so it can never fail and never discriminates. It also cannot detect the problem it names: contact info in a <p> or a <div class="contact"> is indistinguishable from a site with no contact info. And the claimed benefit is not real — <address> is spec'd as the contact info of the nearest article/body ancestor, carries no microdata, and is not what agents read for 'how do I contact X'. A site can satisfy it with an empty <address></address>.

**Required fix:** _none — audit is sound as implemented_

**False-positive risks:**
- 'pagesWithAddress > 0' — one <address> anywhere passes; an empty <address></address> passes.
- Declares applicablePageTypes ['homepage'] but loops every page, so the reported ratio counts non-homepage pages.
- Warns any site whose contact info lives in a footer <p> (the overwhelming majority) with a fix that changes nothing an agent sees.
- Sites that expose contact info correctly via LocalBusiness/Organization JSON-LD — the format agents actually consume — still get warned.
- Contact-info-free sites (personal blogs, docs) get a permanent unfixable warning.

**Test gaps:**
- Two tests only; no empty-<address> fixture.
- No fixture with contact info in a <p> (the case the audit claims to distinguish).
- No multi-page crawl testing the applicablePageTypes/loop mismatch.
- No JSON-LD-contact fixture.

**Overlaps with:** `6.6`, `6.13`

### Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).

- 2026-08-21 — user decision: all research verdicts accepted. Disposition by grade: **sunset** (graceful sunset per evidence-policy deprecation process; condensed rationale kept in NOT-A-FACTOR.md).

- 2026-08-21 — adversarial redemption research pass (8-agent workflow); URLs fetched at research time.

- 2026-08-22 — v1 dossier merged in from `docs/evidence/audits/semantic-html/address-element.md`; that copy removed (one dossier per removed audit, under `sunset/`).
