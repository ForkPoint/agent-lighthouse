---
audit: machine-discovery/llms-txt-link
audit_id: "4.11"
category: machine-discovery
source_file: packages/core/src/audits/machine-discovery/llms-txt-link.ts
slug: llms-txt-link
review_verdict: fix
severity: high
evidence_grade: C
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# llms-txt-link (`4.11`)

> meta-tags · source `llms-txt-link.ts` · review verdict **fix** · evidence grade **C** · disposition: **keep — fix required**

## What it checks

The llms.txt link in <head> is how AI agents discover your LLM-friendly content manifest. Without this link tag, agents must guess that /llms.txt exists or rely on well-known URL conventions. An explicit link ensures every AI crawler that visits your page can immediately find your structured content.

## Code review findings (2026-08-20, 11-agent pass)

The underlying file matters; this specific head-link check is both non-standard and broken three ways — it demands `type="text/plain"` for a file the spec defines as Markdown, it requires the optional `title` attribute to contain the English substring 'llms', and its substring match makes an llms-full.txt link satisfy the llms.txt audit. A site that correctly serves /llms.txt at the well-known path fails this at 'high' priority. That is actively wrong guidance.

**Required fix:** 1) Match on href, not title: replace `(l.title ?? '').toLowerCase().includes('llms')` with an href test (`/\/llms\.txt$/i` on the resolved path). The `title` attribute is optional and language-dependent, so `<link rel="alternate" type="text/plain" href="/llms.txt">` — valid, minimal, correct — fails today. 2) Stop requiring `l.type === 'text/plain'`: llms.txt is Markdown, and real sites emit `type="text/markdown"`, `type="text/plain; charset=utf-8"`, or no type at all. Accept a type set and strip MIME parameters. 3) Fix the cross-match: `includes('llms')` is true for `title="LLMs-full.txt"`, so a site that publishes only llms-full.txt passes the llms.txt audit — a straight false positive. Anchor on the exact filename. 4) Consult `ctx.rootFiles` for an actual /llms.txt before failing; if the file exists at the well-known path, the missing head link is at most a warn, not a 'high' fail. 5) Normalize `rel` (lowercase, trim, split on whitespace) — `rel === 'alternate'` is exact today.

**False-positive risks:**

- Missing/foreign title → false fail: `(l.title ?? '').toLowerCase().includes('llms')` fails on `<link rel="alternate" type="text/plain" href="/llms.txt">` (no title) and on any non-English title. Title is an optional attribute; this makes it mandatory.
- Wrong MIME requirement → false fail: `l.type === 'text/plain'` rejects `type="text/markdown"` (arguably the correct type for a Markdown file), `type="text/plain; charset=utf-8"` (any server that appends charset), and an omitted type.
- Cross-file false pass: `includes('llms')` matches `title="LLMs-full.txt"`, so a site with ONLY llms-full.txt passes 'llms.txt link in head' — the audit reports a file that isn't linked.
- `l.rel === 'alternate'` is exact and case-sensitive: `rel="Alternate"` or a multi-token rel fails.
- Well-known path ignored: a site correctly serving /llms.txt (which `ctx.rootFiles` may already have fetched) is told at 'high' priority that 'many AI crawlers will never find your structured content' — false, since the spec's whole point is the well-known path.
- `extractHeadLinks` scans the whole document, so an llms.txt link placed in the footer counts as 'in head'.
- Only `ctx.pages[0]` is examined.
- The claim that the head link 'ensures every AI crawler that visits your page can immediately find your structured content' has no known consumer implementing it — the impact statement is speculative.

**Test gaps:**

- No link-without-title test (the most common minimal correct markup).
- No `type="text/markdown"` or `type="text/plain; charset=utf-8"` test.
- No test that an llms-full.txt-only page must NOT satisfy this audit (the inverse of the test that exists in llms-full-txt-link.test.ts) — this is exactly why the `includes('llms')` cross-match survived.
- No uppercase/multi-token `rel` test.
- No test where /llms.txt exists in `ctx.rootFiles` but no head link is present.
- No non-English title test.

**Overlaps with:** `4.12`

## Evidence

### Signal: HTML <link> tags pointing to llms.txt / markdown alternates (rel="describedby", rel="alternate" type="text/markdown") — grade C (llms-txt)

**Mechanism:** Emitting <link rel="describedby" href="/llms.txt"> and/or <link rel="alternate" type="text/markdown" href="...md"> in the HTML head (or the equivalent HTTP Link: header) causes agents to discover and fetch those resources. FALSIFIABLE TEST: does any published spec define these relations, and does any named agent parse them?

**Evidence:** REAL, NOT INVENTED — but only since 2026-08-10, and the two halves differ sharply in strength. The llms.txt v2 spec explicitly defines both relations: rel="alternate" type="text/markdown" points to the markdown version of a page and rel="describedby" points to the covering llms.txt, deliverable as HTML <link> elements or as an HTTP Link: header (the header form also working for non-HTML resources and configurable at CDN level). This was the headline addition in v2. Deployment exists: I confirmed developers.cloudflare.com emits <link rel="alternate" type="text/markdown" href="https://developers.cloudflare.com/fundamentals/index.md">, and Mintlify advertises resource locations via HTTP Link headers across every site it hosts. For the markdown half there is one named consumer: acceptmarkdown.com's June 2026 matrix reports OpenAI's Codex CLI fetches HTML first, then 'parses the response for <link rel="alternate" type="text/markdown" href=…>' and requests the markdown version separately. Note that any audit checking a bespoke rel="llms-txt" or rel="llms" value WOULD be invented — only describedby and alternate are spec'd.

**Counter-evidence:** The rel="describedby" -> llms.txt half has NO known consumer at all. Decisively, Lighthouse's own gatherer (source verified) resolves new URL('/llms.txt', finalDisplayedUrl) and nothing else — it ignores link tags entirely, so even Google's llms.txt tooling would never see the tag. There is no auto-discovery-links audit in Lighthouse's Agentic Browsing category; I fetched that hypothesized URL and got HTTP 404, and the category index lists only seven audits, none of them about link relations. The Codex CLI claim is single-sourced and I could not independently corroborate it; Checkly's Feb 2026 testing found Codex sending no markdown preference at all. Adoption is near-zero and unmeasured: of three sites I sampled, only Cloudflare emitted the tag; Stripe and Next.js emitted none, and Stripe instead uses an unrelated Link: rel="service-meta" pointing at /.well-known/skills/index.json. The relations are two weeks old as of this research.
**Consumers:** OpenAI Codex CLI (rel=alternate type=text/markdown only; single-sourced, uncorroborated), none-known for rel=describedby -> llms.txt · **Recommended tier:** experimental

**Sources:** [The /llms.txt file, v2](https://llmstxt.org/) · [llms.txt v2 changes page](https://llmstxt.org/changes.html) · [Which AI agents support Markdown content negotiation? (status matrix)](https://acceptmarkdown.com/status) · [The Current State of Content Negotiation for AI Agents (Feb 2026)](https://www.checklyhq.com/blog/state-of-ai-agent-content-negotation/) · [Lighthouse core/gather/gatherers/agentic/llms-txt.js (source code)](https://github.com/GoogleChrome/lighthouse/blob/main/core/gather/gatherers/agentic/llms-txt.js) · [Agentic Browsing category | Lighthouse | Chrome for Developers](https://developer.chrome.com/docs/lighthouse/agentic-browsing) · [llms.txt — Mintlify documentation](https://www.mintlify.com/docs/ai/llmstxt) · [Direct measurement of vendor llms.txt files and markdown content negotiation (2026-08-20)](https://llmstxt.org/)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.

**Merged into:** `machine-discovery/llms-txt-exists` (Plan 4, 2026-08-22) — [merged dossier](../../audits/machine-discovery/llms-txt-exists.md)
