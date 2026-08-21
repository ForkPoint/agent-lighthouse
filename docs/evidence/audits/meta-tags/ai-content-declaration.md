---
audit: meta-tags/ai-content-declaration
audit_id: "4.13"
category: meta-tags
source_file: packages/core/src/audits/meta-tags/ai-content-declaration.ts
slug: ai-content-declaration
review_verdict: delete
severity: high
evidence_grade: D
disposition: "proposed: redeem as experimental (pending triage)"
reviewed: 2026-08-21
---

# ai-content-declaration (`4.13`)

> meta-tags · source `ai-content-declaration.ts` · review verdict **delete** · evidence grade **D** · disposition: **proposed: redeem as experimental (pending triage)**

## What it checks

The ai-content-declaration meta tag is how AI systems discover your llms.txt or AI usage policy. It signals to crawlers like GPTBot and ClaudeBot where to find machine-readable instructions about how to handle your content. Without it, AI systems have no programmatic way to find your content preferences.

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

## Evidence

### Signal: AI content declaration meta tags (noai, noimageai, tdm-reservation, ai-generated) — grade D (meta-head)

**Mechanism:** A head-level AI declaration (<meta name="noai">, <meta name="tdm-reservation" content="1">, or an ai-generated declaration) causes AI crawlers to change training/ingestion behavior or causes AI systems to label the content. Falsifiable: no AI vendor recognizes any of these names, and the active standards work explicitly attaches preferences somewhere other than the HTML head.

**Evidence:** Two distinct things live here and both are pre-consumer. (1) Opt-out declarations: the W3C TDMRep Community Group Final Report (2 Feb 2024) does formally define <meta name="tdm-reservation" content="1|0"> and <meta name="tdm-policy" content="URL">, positioned as a technical answer to EU DSM Article 4 — but it is explicitly "not a W3C Standard" and names no implementing consumer. The DeviantArt-origin noai/noimageai convention has measurable adoption: 88,000+ domains as of June 2026, 87.8% of them via the meta-tag placement, meta adoption up 26.5% month-over-month (Originality.AI). (2) AI-generated declarations: there is no HTML head standard at all — IPTC's Digital Source Type (trainedAlgorithmicMedia) targets the XMP packet embedded in image/video files or a C2PA manifest, not the page head.

**Counter-evidence:** Decisive. The IETF AIPREF attachment draft (19 Aug 2026, Standards Track, authored by Google and Mozilla, updating RFC 9309) defines exactly two attachment mechanisms — the Content-Usage HTTP response header and a Content-Usage rule in robots.txt — and does not define any HTML meta element or link relation; 'Embedded Preferences' is acknowledged and left out of scope. So the standards trajectory is running away from the head, not toward it. Google's supported-meta-tags list omits noai and tdm-reservation; Originality.AI's own study concludes "Major AI companies point elsewhere ... rather than honoring the noai meta tag specifically." OpenAI's and Anthropic's crawler docs document robots.txt only. Keep as experimental with a plainly worded caveat that these tags currently express intent with no known enforcing consumer, and track AIPREF for the header/robots.txt path — do not present them to users as protection.
**Consumers:** none-known — no AI vendor documents recognizing noai, noimageai, or tdm-reservation · **Recommended tier:** experimental

**Sources:** [TDM Reservation Protocol (TDMRep) — Final Community Group Report](https://www.w3.org/community/reports/tdmrep/CG-FINAL-tdmrep-20240202/) · [Associating AI Usage Preferences with Content in HTTP (draft-ietf-aipref-attach)](https://ietf-wg-aipref.github.io/drafts/draft-ietf-aipref-attach.html) · [A Vocabulary For Expressing AI Usage Preferences (draft-ietf-aipref-vocab)](https://datatracker.ietf.org/doc/draft-ietf-aipref-vocab/) · [Noai and noimageai Tag Adoption: Study and Live Dashboard](https://originality.ai/blog/noai-noimageai-adoption-dashboard) · [Meta tags and HTML attributes that Google supports](https://developers.google.com/search/docs/crawling-indexing/special-tags) · [IPTC publishes metadata guidance for AI-generated "synthetic media"](https://iptc.org/news/iptc-publishes-metadata-guidance-for-ai-generated-synthetic-media/) · [Overview of OpenAI Crawlers](https://developers.openai.com/api/docs/bots) · [Does Anthropic crawl data from the web, and how can site owners block the crawler?](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
