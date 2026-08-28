---
audit: access-crawl-control/ai-content-declaration
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/ai-content-declaration.ts
slug: ai-content-declaration
evidence_grade: D
disposition: "kept — rewritten to the real directive names 2026-08-22 (Plan 4, Task 16)"
reviewed: 2026-08-22
recommended_tier: experimental
consumers: []
consumers_note: "no AI vendor documents recognizing noai, noimageai, or tdm-reservation"
signals:
  - name: "AI content declaration meta tags (noai, noimageai, tdm-reservation, ai-generated)"
    grade: D
    domain: meta-head
sources:
  - s18
  - anthropic-crawlers
  - ietf-aipref-attach-draft
  - w3c-tdmrep-final-report
  - s10
  - originality-noai-adoption
  - google-special-tags
  - iptc-synthetic-media-guidance
---

# ai-content-declaration (`4.13`)

> access-crawl-control · source `ai-content-declaration.ts` · evidence grade **D** · tier **experimental** (weight 0) · rewritten from an invented meta name to the AIPREF `Content-Usage` attachment and the noai/noimageai convention — see below

## What it checks

Where a site declares how AI systems may use its content. The IETF AIPREF work attaches that preference to a `Content-Usage` response header or a robots.txt rule and explicitly leaves the HTML head out of scope; the head-level `noai`/`noimageai` convention has real adoption but no documented consumer. The audit reports what a site declares and where, and never treats declaring nothing as a defect.

_(The pre-rewrite description asserted that `<meta name="ai-content-declaration">` is "how AI systems discover your llms.txt or AI usage policy" and that GPTBot and ClaudeBot read it. That was false; it is quoted with its refutation in the rewrite section below.)_

## Code review findings (2026-08-20, 11-agent pass)

Invented signal with an actively false justification. The description asserts that this tag is 'how AI systems discover your llms.txt or AI usage policy' and that GPTBot and ClaudeBot use it to find your content preferences. That is not true: GPTBot and ClaudeBot read robots.txt, and neither documents any meta-tag policy channel. Telling users at 'medium' priority that AI systems 'cannot respect your content preferences automatically' without this tag is misinformation that could lead a site owner to believe they have expressed an opt-out they have not expressed. Delete.

**Required fix:** Delete the audit. If the maintainer wants to keep an AI-policy-discovery check, put it where the real mechanism lives: robots.txt user-agent directives (crawler-permissions) and, where applicable, the TDM Reservation Protocol / `tdm-reservation` signals — not an invented meta tag. At absolute minimum, if retained, the description must stop claiming GPTBot/ClaudeBot consume it and the priority must drop to 'low'/informational.

**False-positive risks:**
- Every correctly configured site fails: no site emits this tag because it does not exist as a standard, so this is a guaranteed 'medium' priority failure on 100% of real-world scans — pure score noise.
- Dangerous misinformation: the fail text says AI systems 'cannot respect your content preferences automatically' without it. A site owner who adds the tag may believe they have declared an AI usage policy when no crawler will ever read it, while the mechanism that does work (robots.txt) goes unaddressed.
- The URL validation is also crude: `value.startsWith('http://') || value.startsWith('https://')` rejects a protocol-relative `//example.com/llms.txt` and a root-relative `/llms.txt` — both perfectly resolvable — downgrading them to a warn for a tag that has no spec defining what a valid value even is.
- Only `ctx.pages[0]` is examined.
- Name collision risk: if a site DID adopt the real aicontentdeclaration.org convention (whose value is a disclosure string, not a URL), this audit would emit a 'not a valid URL' warn against markup that is correct for the actual proposal.

**Test gaps:**
- No test against the real aicontentdeclaration.org value format (the name collision).
- No protocol-relative or root-relative URL test.
- No evidence-based test that any consumer reads this tag — which is the gap that matters: the tests validate the invented contract rather than questioning it.
- Only 4 tests, all single-page.

**Overlaps with:** `4.14`

## The real-directive-names rewrite (Plan 4, Task 16, 2026-08-22)

**Old pass condition:** `ctx.pages[0]` carries `<meta name="ai-content-declaration">` whose value starts with `http://` or `https://`. A present-but-non-URL value warned; anything else — which is every site on the web, since the name has no specification — **failed** at `medium` priority.

**New pass condition:** the site attaches an AI-usage preference where the AIPREF drafts put it, as a `Content-Usage` response header or a `Content-Usage` rule in `robots.txt`. Head-level declarations (`noai`, `noimageai`, or the invented name itself) warn with their limitation stated. Nothing declared is `notApplicable`. The audit can no longer fail anything.

### The misinformation is deleted

The shipped copy read: *"It signals to crawlers like GPTBot and ClaudeBot where to find machine-readable instructions about how to handle your content"*, and the failure text said AI systems *"cannot respect your content preferences automatically"* without it. Neither is true. [OpenAI's crawler documentation](https://developers.openai.com/api/docs/bots) and [Anthropic's](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler) describe robots.txt and nothing else; no vendor documents a meta-tag policy channel. The concrete harm the code review identified was that a site owner could add the tag, believe they had expressed an opt-out, and leave the mechanism that does work untouched. Both vendor names are gone from the audit's meta and a regression test asserts the strings `GPTBot` and `ClaudeBot` appear nowhere in it.

### What it looks for now, in evidence order

1. **AIPREF `Content-Usage`** — pass. The counter-evidence in the graded signal below is the reason this ranks first: [draft-ietf-aipref-attach](https://ietf-wg-aipref.github.io/drafts/draft-ietf-aipref-attach.html) is Standards Track, authored by Google and Mozilla, updates RFC 9309, and defines exactly two attachment mechanisms — the response header and a robots.txt rule — while "Embedded Preferences" is acknowledged and left out of scope. The standards trajectory runs away from the head, so an audit in this family should point at the header and the robots.txt rule, and does.
2. **`noai` / `noimageai`** — warn, with the caveat in the message text rather than implied. Adoption is real and measurable (88,000+ domains as of June 2026, 87.8% via meta placement, per Originality.AI), which is why it is reported at all; Originality.AI's own conclusion — "Major AI companies point elsewhere … rather than honoring the noai meta tag specifically" — is why it is not a pass. Detected as a standalone `<meta name="noai">` **and** as a token of `<meta name="robots">`. Both matter: the convention is routinely written valueless, which the parsed meta map drops (it keeps only tags carrying `content`), so the DOM is queried directly; and token splitting is required so `noarchive` is not read as `noai`.
3. **The invented name** — warn, reported as invented. It is still detected, so a site that adopted it on this audit's old advice is told plainly that nothing reads it.
4. **Nothing** — `na`.

### Value-format judgement dropped

The old `value.startsWith('http://') || value.startsWith('https://')` test rejected protocol-relative and root-relative values, and — the name-collision risk the code review flagged — would have emitted "not a valid URL" against markup that is correct for the real aicontentdeclaration.org proposal, whose value is a disclosure string rather than a URL. No specification defines what a valid value would be, so the audit no longer judges one. A regression test pins that a URL value and a prose value produce the same verdict.

### Non-double-counting

`tdm-reservation` and `tdm-policy` are named in this dossier's evidence signal but are **not** read here: `access-crawl-control/tdm-rep` owns the TDM-Rep protocol end to end, including its meta form. Counting the same tag in two audits would double-price one adoption decision. The scope split is stated in the source header, and a regression test asserts a `tdm-reservation`-only site is `na` here.

### Grade decision: stays **D**, tier `experimental`, weight 0

Source: the [REWORK-TODO redemption note](../../../../packages/core/src/audits/rework-todo.md) — "noai/noimageai/tdm-reservation declaration meta tags graded D/experimental — real emerging opt-out ecosystem, no ratified consumer yet. Experimental, unscored, rework to check the real directive names" — and the graded signal below, whose recommended tier is `experimental` with the instruction to "keep as experimental with a plainly worded caveat that these tags currently express intent with no known enforcing consumer … do not present them to users as protection." Both the tier and the caveat are implemented literally. Per the §4 weight law `weightForGrade('D', 'experimental') = 0`, so `scoreDisplayMode` stays `informative`; `defaultPriority` drops `medium` → `low`.

### Re-check trigger

AIPREF is chartered with an IESG submission target of 31 August 2026. If `Content-Usage` is ratified and a named crawler documents honoring it, this audit's mechanism gains a consumer and the grade should be re-examined — the `pass` branch is already written against the ratified form, so only the grade and tier would move.

## Evidence

### Signal: AI content declaration meta tags (noai, noimageai, tdm-reservation, ai-generated) — grade D (meta-head)

**Mechanism:** A head-level AI declaration (<meta name="noai">, <meta name="tdm-reservation" content="1">, or an ai-generated declaration) causes AI crawlers to change training/ingestion behavior or causes AI systems to label the content. Falsifiable: no AI vendor recognizes any of these names, and the active standards work explicitly attaches preferences somewhere other than the HTML head.

**Evidence:** Two distinct things live here and both are pre-consumer. (1) Opt-out declarations. The W3C TDMRep Community Group Final Report (2 Feb 2024) does formally define <meta name="tdm-reservation" content="1|0"> and <meta name="tdm-policy" content="URL">, positioned as a technical answer to EU DSM Article 4. But it is explicitly "not a W3C Standard", and it names no implementing consumer. The DeviantArt-origin noai/noimageai convention has measurable adoption: 88,000+ domains as of June 2026, 87.8% of them via the meta-tag placement, meta adoption up 26.5% month-over-month (Originality.AI). (2) AI-generated declarations: there is no HTML head standard at all — IPTC's Digital Source Type (trainedAlgorithmicMedia) targets the XMP packet embedded in image/video files or a C2PA manifest, not the page head.

**Counter-evidence:** Decisive. The IETF AIPREF attachment draft of 19 Aug 2026 is Standards Track, authored by Google and Mozilla, and updates RFC 9309. It defines exactly two attachment mechanisms: the Content-Usage HTTP response header, and a Content-Usage rule in robots.txt. It defines no HTML meta element and no link relation — 'Embedded Preferences' is acknowledged and left out of scope. So the standards trajectory is running away from the head, not toward it. Google's supported-meta-tags list omits noai and tdm-reservation; Originality.AI's own study concludes "Major AI companies point elsewhere ... rather than honoring the noai meta tag specifically." OpenAI's and Anthropic's crawler docs document robots.txt only. Keep as experimental with a plainly worded caveat that these tags currently express intent with no known enforcing consumer, and track AIPREF for the header/robots.txt path — do not present them to users as protection.

## Implementation deviations

- 2026-08-28 — the audit declines when the scan holds no response it can
  attribute to this site. The `Content-Usage` header and the head-level opt-out
  tags are read off whatever answered the request, and a bot wall served at
  HTTP 200 through the site's own edge carries the site-wide response headers
  on a body the site did not write. The audit reported the wall's header as an
  AIPREF declaration by this site. It now consults `scanReadTheSite()` and
  returns `notApplicable` carrying the gate's own reason. Measured merge-base
  to here on a text-rich HTTP 200 wall: pass → na (informative, weight 0).
  Found by `packages/core/src/tests/hostile-state-contract.test.ts`.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
- 2026-08-22 — user approved the pending-triage redeem; required rework executed (Plan 4, Task 16): the invented meta name is replaced by the AIPREF `Content-Usage` attachment (pass) and the noai/noimageai convention (warn, caveat stated), the GPTBot/ClaudeBot claim is deleted, absence is `na` rather than a universal fail, all pages are scanned instead of `pages[0]`, value-format judgement is dropped, and `tdm-reservation` is left to `tdm-rep`. Grade D, tier `experimental`, weight 0 unchanged; `defaultPriority` `medium` → `low`. `TODO(redeem)` marker removed from the source file.
