---
audit: meta-tags/llms-full-txt-link
category: meta-tags
audit_id: "4.12"
source_file: packages/core/src/audits/meta-tags/llms-full-txt-link.ts
slug: llms-full-txt-link
review_verdict: merge
severity: medium
disposition: "sunset (approved 2026-08-21)"
status: sunset
verdict: dead
evidence_grade: D
reviewed: 2026-08-21
---

# llms-full-txt-link — confirmed dead — delete

> Adversarial redemption research, 2026-08-21. The researcher's task was to **save** this audit by finding grade A/B evidence of a real consumer. Grade found: **D**.

## Claimed mechanism (steelmanned)

Emitting <link rel="alternate" type="text/plain" href="/llms-full.txt" title="LLMs-full.txt"> in <head> gives agents a machine-readable discovery hook so they can choose the full-content dump over the llms.txt summary based on their context budget. Steelmanned, this needs a spec defining that link relation for this file, or a documented agent that parses <head> looking for it — and at minimum it should be a pattern real llms-full.txt publishers actually emit.

## What we searched

WebSearch was exhausted, so I tested this one empirically as well as against the spec. Angle 1 — spec: fetched llmstxt.org and the raw index.md; the spec's link-relation recommendation is '</docs/page.html.md>; rel="alternate"; type="text/markdown"' for per-page markdown, with no text/plain relation and no llms-full.txt at all. Angle 2 — live wire test: curl'd the HTML of five major llms.txt/llms-full.txt publishers (platform.claude.com, mintlify.com/docs, docs.stripe.com, vercel.com/docs, docs.github.com) and grepped every <link> tag for 'llms'. Angle 3 — actual discovery practice: examined how Anthropic's llms.txt itself points at llms-full.txt. Angle 4 — adoption: GitHub code search combining the filename with rel="alternate". Angle 5 — vendor docs: Mintlify (which generates llms-full.txt for everyone) documents no head-link at all.

## Best evidence found for the audit

Weak and non-matching. The only real link-tag-based discovery of an llms file I found in the wild is GitHub Docs, which emits <link rel="index" type="text/markdown" href="https://docs.github.com/llms.txt" title="LLM-friendly index of all GitHub Docs content"> — different rel (index, not alternate), different type (text/markdown, not text/plain), and it points at llms.txt, not llms-full.txt. The spec does bless a link relation, but only '</docs/page.html.md>; rel="alternate"; type="text/markdown"' for per-page markdown alternates. Nothing supports the exact triple this audit requires (rel=alternate + type=text/plain + title containing 'llms-full').

## Counter-evidence

1) Direct wire test: of the five biggest publishers checked, four emit NO llms link tag whatsoever in <head> despite serving llms-full.txt — platform.claude.com/en/docs/overview (27 <link> tags, zero mentioning llms), mintlify.com/docs (20, zero), docs.stripe.com (18, zero), vercel.com/docs (31, zero). The fifth, docs.github.com, uses rel="index" type="text/markdown" pointing at llms.txt. So the audit's detection pattern matches zero of the sites it would be grading, including Anthropic's own docs. 2) The spec defines no such relation: llmstxt.org and llmstxt.org/index.md contain no occurrence of 'llms-full.txt' and their only link-relation example is rel="alternate" type="text/markdown" for a per-page .md file. 3) Actual discovery in practice is either the well-known root path or a plain-text pointer inside llms.txt — Anthropic's llms.txt ends 'For more comprehensive documentation, see llms-full.txt' (https://platform.claude.com/llms.txt) — never a <head> link. 4) Mintlify, which auto-generates llms-full.txt for its entire customer base, documents hosting the file at the root and says nothing about a head link (https://mintlify.com/docs/ai/llmstxt). 5) No vendor (OpenAI, Anthropic, Google, Perplexity, Apple, Meta, Microsoft) documents any crawler parsing <head> for such a relation.

## Verdict

**confirmed dead — delete** (grade D)

Grade D. This is a compound of two invented layers: a filename the spec never defines, plus a link-relation/MIME-type combination that appears in no spec and, per direct HTML inspection, on none of the major sites that actually publish the file — Anthropic, Vercel, Mintlify and Stripe all emit zero llms link tags. The one real-world precedent (GitHub Docs) uses a different rel, a different type, and a different target, so it would fail this audit too. There is no consumer, no spec, and no convention to point at, and unlike llms-full.txt itself there is not even publisher adoption to salvage it as informative. Delete.

## Sources

- **[The /llms.txt file — link relation guidance](https://llmstxt.org/)** — Answer.AI (Jeremy Howard) (spec, URL verified 2026-08-21)
  - Only link relation recommended is '</docs/page.html.md>; rel="alternate"; type="text/markdown"' for per-page markdown. No text/plain relation, no llms-full.txt, no head-link discovery for any root file.
- **[GitHub Docs homepage HTML (live head inspection)](https://docs.github.com/en)** — GitHub (vendor-doc, URL verified 2026-08-21)
  - Only real-world llms link tag found across five major publishers: <link rel="index" type="text/markdown" href="https://docs.github.com/llms.txt" title="LLM-friendly index of all GitHub Docs content">. Different rel, type and target than the audit requires; docs.github.com/llms-full.txt returns 404.
- **[Anthropic developer docs page HTML (live head inspection)](https://platform.claude.com/en/docs/overview)** — Anthropic (vendor-doc, URL verified 2026-08-21)
  - 27 <link> tags in head, none referencing llms.txt or llms-full.txt — despite Anthropic serving a 33.5 MB llms-full.txt. Discovery is done via a text pointer inside llms.txt instead.
- **[llms.txt — Mintlify docs](https://mintlify.com/docs/ai/llmstxt)** — Mintlify (vendor-doc, URL verified 2026-08-21)
  - Documents auto-hosting llms-full.txt at the project root; documents no <head> link element for discovery. mintlify.com/docs itself emits no llms link tag.

## v1 dossier — what it checked and the 2026-08-20 code review

Merged in on 2026-08-22 from `docs/evidence/audits/meta-tags/llms-full-txt-link.md`, so a removed audit has exactly one dossier and it lives here.

### What it checks

The llms-full.txt file provides AI agents with a comprehensive, unabridged version of your content optimized for ingestion into context windows. Adding this link in <head> lets agents choose between the summary (llms.txt) and full content versions based on their context budget.

### Code review findings (2026-08-20, 11-agent pass)

A byte-for-byte copy of llms-txt-link (4.11) with one substring changed ('llms' → 'llms-full'), measuring the same underlying signal — presence of an llms-family alternate link — and inheriting every one of that audit's matching defects. Because 4.11's looser `includes('llms')` already matches this link, the two audits are entangled: one file can satisfy both. Charging a separate 'medium' priority failure for the second variant of a non-standard tag is double-penalizing speculation.

**Required fix:** Merge into LlmsTxtLinkAudit (4.11) as a single 'llms.txt discovery' audit that reports which llms-family resources are linked (index, full, or neither), passing on the index alone and noting the full variant as a bonus. If kept separate, it must at minimum stop depending on `title.includes('llms-full')` — match `href` against `/llms-full\.txt$/i` — accept `text/markdown` and parameterized MIME types, drop the exact `l.rel === 'alternate'` comparison in favor of a normalized one, and be downgraded from 'medium' to 'low' given zero documented consumption.

**False-positive risks:**
- Identical title-dependence to 4.11: `(l.title ?? '').toLowerCase().includes('llms-full')` fails on `<link rel="alternate" type="text/plain" href="/llms-full.txt">` with no title — correct, minimal markup rejected.
- Identical MIME rigidity: `l.type === 'text/plain'` rejects `text/markdown` and any `; charset=` parameter.
- Title-vs-href mismatch: a site could title the link 'Full documentation for LLMs' (no 'llms-full' substring) and fail while serving exactly the right file.
- Entangled with 4.11: because 4.11 matches on `includes('llms')`, a site that ships only llms-full.txt passes 4.11 and 4.12, while a site that ships only llms.txt passes 4.11 and fails 4.12 at medium priority — the pair does not partition the space cleanly.
- `l.rel === 'alternate'` exact/case-sensitive.
- Only `ctx.pages[0]` is examined.
- Recommending llms-full.txt at 'medium' priority pushes site owners toward maintaining a second, larger generated artifact for which no consumer is identified — real cost, unverified benefit.

**Test gaps:**
- No link-without-title test.
- No `type="text/markdown"` / charset-parameter test.
- No uppercase/multi-token `rel` test.
- Only 3 tests, one of which (the llms.txt-titled link failing) merely locks in the title-substring coupling rather than questioning it.
- No test of the 4.11/4.12 interaction on a site that has only one of the two files.

**Overlaps with:** `4.11`

### Evidence

#### Signal: HTML <link> tags pointing to llms.txt / markdown alternates (rel="describedby", rel="alternate" type="text/markdown") — grade C (llms-txt)

**Mechanism:** Emitting <link rel="describedby" href="/llms.txt"> and/or <link rel="alternate" type="text/markdown" href="...md"> in the HTML head (or the equivalent HTTP Link: header) causes agents to discover and fetch those resources. FALSIFIABLE TEST: does any published spec define these relations, and does any named agent parse them?

**Evidence:** REAL, NOT INVENTED — but only since 2026-08-10, and the two halves differ sharply in strength. The llms.txt v2 spec explicitly defines both relations: rel="alternate" type="text/markdown" points to the markdown version of a page and rel="describedby" points to the covering llms.txt, deliverable as HTML <link> elements or as an HTTP Link: header (the header form also working for non-HTML resources and configurable at CDN level). This was the headline addition in v2. Deployment exists: I confirmed developers.cloudflare.com emits <link rel="alternate" type="text/markdown" href="https://developers.cloudflare.com/fundamentals/index.md">, and Mintlify advertises resource locations via HTTP Link headers across every site it hosts. For the markdown half there is one named consumer: acceptmarkdown.com's June 2026 matrix reports OpenAI's Codex CLI fetches HTML first, then 'parses the response for <link rel="alternate" type="text/markdown" href=…>' and requests the markdown version separately. Note that any audit checking a bespoke rel="llms-txt" or rel="llms" value WOULD be invented — only describedby and alternate are spec'd.

**Counter-evidence:** The rel="describedby" -> llms.txt half has NO known consumer at all. Decisively, Lighthouse's own gatherer (source verified) resolves new URL('/llms.txt', finalDisplayedUrl) and nothing else — it ignores link tags entirely, so even Google's llms.txt tooling would never see the tag. There is no auto-discovery-links audit in Lighthouse's Agentic Browsing category; I fetched that hypothesized URL and got HTTP 404, and the category index lists only seven audits, none of them about link relations. The Codex CLI claim is single-sourced and I could not independently corroborate it; Checkly's Feb 2026 testing found Codex sending no markdown preference at all. Adoption is near-zero and unmeasured: of three sites I sampled, only Cloudflare emitted the tag; Stripe and Next.js emitted none, and Stripe instead uses an unrelated Link: rel="service-meta" pointing at /.well-known/skills/index.json. The relations are two weeks old as of this research.
**Consumers:** OpenAI Codex CLI (rel=alternate type=text/markdown only; single-sourced, uncorroborated), none-known for rel=describedby -> llms.txt · **Recommended tier:** experimental

**Sources:** [The /llms.txt file, v2](https://llmstxt.org/) · [llms.txt v2 changes page](https://llmstxt.org/changes.html) · [Which AI agents support Markdown content negotiation? (status matrix)](https://acceptmarkdown.com/status) · [The Current State of Content Negotiation for AI Agents (Feb 2026)](https://www.checklyhq.com/blog/state-of-ai-agent-content-negotation/) · [Lighthouse core/gather/gatherers/agentic/llms-txt.js (source code)](https://github.com/GoogleChrome/lighthouse/blob/main/core/gather/gatherers/agentic/llms-txt.js) · [Agentic Browsing category | Lighthouse | Chrome for Developers](https://developer.chrome.com/docs/lighthouse/agentic-browsing) · [llms.txt — Mintlify documentation](https://www.mintlify.com/docs/ai/llmstxt) · [Direct measurement of vendor llms.txt files and markdown content negotiation (2026-08-20)](https://llmstxt.org/)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).

- 2026-08-21 — user decision: all research verdicts accepted. Disposition by grade: **sunset** (graceful sunset per evidence-policy deprecation process; condensed rationale kept in not-a-factor.md).

- 2026-08-21 — adversarial redemption research pass (8-agent workflow); URLs fetched at research time.

- 2026-08-22 — v1 dossier merged in from `docs/evidence/audits/meta-tags/llms-full-txt-link.md`; that copy removed (one dossier per removed audit, under `sunset/`).
