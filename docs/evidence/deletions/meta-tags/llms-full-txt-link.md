---
audit: meta-tags/llms-full-txt-link
category: meta-tags
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

## Review history

- 2026-08-21 — user decision: all research verdicts accepted. Disposition by grade: **sunset** (graceful sunset per evidence-policy deprecation process; condensed rationale kept in NOT-A-FACTOR.md).

- 2026-08-21 — adversarial redemption research pass (8-agent workflow); URLs fetched at research time.
