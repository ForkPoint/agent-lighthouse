---
audit: content-extraction/markdown-alternate
audit_id: "4.15"
category: content-extraction
source_file: packages/core/src/audits/content-extraction/markdown-alternate.ts
slug: markdown-alternate
review_verdict: fix
severity: medium
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# markdown-alternate (`4.15`)

> meta-tags · source `markdown-alternate.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

AI agents prefer Markdown over HTML because it strips away layout noise and fits more content into limited context windows. A Markdown alternate link lets agents fetch a clean, token-efficient version of your page, improving the accuracy of AI-generated summaries.

## Code review findings (2026-08-20, 11-agent pass)

Best of the AI-specific link audits — the underlying practice is real and does help agents. The implementation is the same brittle exact-match template as its siblings and recognizes only one of the several ways sites actually expose Markdown, so it will report 'not found' on sites that do serve Markdown correctly.

**Required fix:** 1) `l.type === 'text/markdown'` is an exact match: accept `text/markdown; charset=utf-8` (strip at `;`), `text/x-markdown`, and `text/plain` when the href ends in `.md`. 2) Accept href-based discovery with no type attribute: `rel="alternate"` + href matching `/\.mdx?$/i`. 3) Normalize `rel` (lowercase/trim/split) — exact `l.rel === 'alternate'` fails on `rel="Alternate"`. 4) Optionally verify the target resolves via `ctx.fetch` before passing; a dangling .md link is worse than none. 5) Iterate `ctx.pages` — a Markdown alternate is inherently per-page, and checking only `ctx.pages[0]` (usually a homepage, which rarely has one) makes this fail even on docs sites that provide .md for every article. 6) Return `notApplicable` for page types where a Markdown twin is meaningless (checkout, search) rather than a flat fail.

**False-positive risks:**
- MIME parameter breaks the match: `l.type === 'text/markdown'` fails on `type="text/markdown; charset=utf-8"`, which any server appending a charset will emit.
- `text/x-markdown` (still widely used) is not accepted.
- Type-less discovery ignored: `<link rel="alternate" href="/guide.md">` — a common minimal form — fails because the audit requires the type attribute.
- Homepage bias: `const page = ctx.pages[0]` is normally the marketing homepage, which almost never has a Markdown twin even on sites where every docs page does. The audit therefore reports 'medium' priority failure on exactly the docs sites that pioneered this practice.
- `rel` exact/case-sensitive comparison.
- `extractHeadLinks` scans the whole document, so a `.md` link in body content counts as a head link.
- Sites that expose Markdown by content negotiation (`Accept: text/markdown`) or by an implicit `.md` suffix convention with no link tag — both real patterns — are reported as having no Markdown alternate at all.
- No verification that the linked .md exists; a stale link passes.

**Test gaps:**
- No charset-parameter MIME test.
- No `text/x-markdown` test.
- No type-less `.md` href test.
- No uppercase/multi-token `rel` test.
- No multi-page test where the homepage lacks the alternate but content pages have it — the production case.
- No dangling-link test.

**Overlaps with:** _none_

## Evidence

### Signal: HTML <link> tags pointing to llms.txt / markdown alternates (rel="describedby", rel="alternate" type="text/markdown") — grade C (llms-txt)

**Mechanism:** Emitting <link rel="describedby" href="/llms.txt"> and/or <link rel="alternate" type="text/markdown" href="...md"> in the HTML head (or the equivalent HTTP Link: header) causes agents to discover and fetch those resources. FALSIFIABLE TEST: does any published spec define these relations, and does any named agent parse them?

**Evidence:** REAL, NOT INVENTED — but only since 2026-08-10, and the two halves differ sharply in strength. The llms.txt v2 spec explicitly defines both relations: rel="alternate" type="text/markdown" points to the markdown version of a page and rel="describedby" points to the covering llms.txt, deliverable as HTML <link> elements or as an HTTP Link: header (the header form also working for non-HTML resources and configurable at CDN level). This was the headline addition in v2. Deployment exists: I confirmed developers.cloudflare.com emits <link rel="alternate" type="text/markdown" href="https://developers.cloudflare.com/fundamentals/index.md">, and Mintlify advertises resource locations via HTTP Link headers across every site it hosts. For the markdown half there is one named consumer: acceptmarkdown.com's June 2026 matrix reports OpenAI's Codex CLI fetches HTML first, then 'parses the response for <link rel="alternate" type="text/markdown" href=…>' and requests the markdown version separately. Note that any audit checking a bespoke rel="llms-txt" or rel="llms" value WOULD be invented — only describedby and alternate are spec'd.

**Counter-evidence:** The rel="describedby" -> llms.txt half has NO known consumer at all. Decisively, Lighthouse's own gatherer (source verified) resolves new URL('/llms.txt', finalDisplayedUrl) and nothing else — it ignores link tags entirely, so even Google's llms.txt tooling would never see the tag. There is no auto-discovery-links audit in Lighthouse's Agentic Browsing category; I fetched that hypothesized URL and got HTTP 404, and the category index lists only seven audits, none of them about link relations. The Codex CLI claim is single-sourced and I could not independently corroborate it; Checkly's Feb 2026 testing found Codex sending no markdown preference at all. Adoption is near-zero and unmeasured: of three sites I sampled, only Cloudflare emitted the tag; Stripe and Next.js emitted none, and Stripe instead uses an unrelated Link: rel="service-meta" pointing at /.well-known/skills/index.json. The relations are two weeks old as of this research.
**Consumers:** OpenAI Codex CLI (rel=alternate type=text/markdown only; single-sourced, uncorroborated), none-known for rel=describedby -> llms.txt · **Recommended tier:** experimental

**Sources:** [The /llms.txt file, v2](https://llmstxt.org/) · [llms.txt v2 changes page](https://llmstxt.org/changes.html) · [Which AI agents support Markdown content negotiation? (status matrix)](https://acceptmarkdown.com/status) · [The Current State of Content Negotiation for AI Agents (Feb 2026)](https://www.checklyhq.com/blog/state-of-ai-agent-content-negotation/) · [Lighthouse core/gather/gatherers/agentic/llms-txt.js (source code)](https://github.com/GoogleChrome/lighthouse/blob/main/core/gather/gatherers/agentic/llms-txt.js) · [Agentic Browsing category | Lighthouse | Chrome for Developers](https://developer.chrome.com/docs/lighthouse/agentic-browsing) · [llms.txt — Mintlify documentation](https://www.mintlify.com/docs/ai/llmstxt) · [Direct measurement of vendor llms.txt files and markdown content negotiation (2026-08-20)](https://llmstxt.org/)

### Signal: Markdown alternate representations of pages (.md URLs and Accept: text/markdown content negotiation) — grade A (llms-txt)

**Mechanism:** Serving a markdown representation of each page — via HTTP content negotiation on Accept: text/markdown and/or a .md URL suffix — causes named AI coding agents to retrieve markdown instead of HTML, substantially reducing tokens consumed per page. FALSIFIABLE TEST: vendor documentation stating an agent sends the header, plus observed markdown-vs-HTML fetch shares in server logs.

**Evidence:** THE ONLY A-GRADE SIGNAL IN THIS DOMAIN, and it is the one that should carry weight in the audit. Anthropic documents the behavior explicitly for a named agent: 'WebFetch sets a User-Agent header beginning with Claude-User, and an Accept header that prefers Markdown over HTML so servers that support content negotiation can return Markdown directly.' Cloudflare shipped Markdown for Agents (Feb 2026) doing network-level HTML-to-markdown conversion on Accept: text/markdown, returning an x-markdown-tokens header and YAML frontmatter. Independent header-capture testing finds seven agents advertising text/markdown as of June 2026 (Claude Code, Copilot Chat, Copilot CLI, Cursor, Microsoft Copilot, OpenClaw, OpenCode), up from three in February — a clear upward trajectory. Field measurement confirms real volume: Evil Martians recorded ~40,000 markdown fetches, 15% of all agent reads across 268k requests, with Claude Code at 76% markdown; Dries Buytaert measured GPTBot taking markdown 34.8% of the time via .md URLs. I verified the mechanism live myself: curl -H 'Accept: text/markdown' returns content-type: text/markdown from Anthropic's, Stripe's and Cloudflare's docs today. This mechanism also needs no site-specific knowledge from the agent, unlike llms.txt.

**Counter-evidence:** Grade A applies to interactive coding agents, NOT to search crawlers or consumer chat — audits should say so. ChatGPT-User takes markdown on just 0.1% of fetches; ChatGPT, Claude.ai, Perplexity, Gemini variants, Grok, Windsurf, Devin, Aider, Cline, v0 and Zed send HTML-only Accept headers. Otterly's 14-day controlled test found 0 crawler visits and 0 citations for .md files versus 137 visits to matched HTML, and Longato's 24-hour two-site CDN check found zero .md requests from GPTBot/ClaudeBot/PerplexityBot. The two best studies also directly contradict each other on which mechanism works: Dries (Jan 2026) states 'No AI crawler uses content negotiation. Not one' and saw markdown taken only via .md URLs, while Evil Martians (May-Jul 2026) concluded content negotiation 'is the mechanism actually delivering Markdown to the client that wants it (Claude Code)' — best reconciled by the later date and by crawlers-versus-agents population, which argues for supporting BOTH .md URLs and the Accept header rather than choosing. Google states you don't need Markdown to appear in Search or its AI features. Dries also found serving markdown did not reduce bot load; crawl volume rose ~7%.
**Consumers:** Claude Code (Anthropic, documented), Cursor, GitHub Copilot Chat and Copilot CLI, Microsoft Copilot, OpenCode, OpenClaw, OpenAI Codex CLI (via .md URL / link tag rather than Accept header), GPTBot (34.8% markdown share via .md URLs, measured), NOT: ChatGPT-User (0.1%), Perplexity, Gemini, Claude.ai · **Recommended tier:** scored

**Sources:** [Tools reference — Claude Code docs (WebFetch behavior)](https://code.claude.com/docs/en/tools-reference) · [Introducing Markdown for Agents](https://blog.cloudflare.com/markdown-for-agents/) · [Which AI agents support Markdown content negotiation? (status matrix)](https://acceptmarkdown.com/status) · [The Current State of Content Negotiation for AI Agents (Feb 2026)](https://www.checklyhq.com/blog/state-of-ai-agent-content-negotation/) · [Which AI actually reads your site? Two months of LLM traffic, measured](https://evilmartians.com/chronicles/which-ai-actually-reads-your-site-two-months-of-llm-traffic-measured) · [Markdown, llms.txt and AI crawlers](https://dri.es/markdown-llms-txt-and-ai-crawlers) · [GEO Experiment: Markdown vs. HTML, Which Format Do AI Crawlers Prefer?](https://otterly.ai/blog/geo-experiment-html-vs-markdown/) · [Do LLMs Crawl Markdown (.md) Files? Data Analysis](https://www.longato.ch/llm-md-files/) · [The /llms.txt file, v2](https://llmstxt.org/) · [llms.txt — Mintlify documentation](https://www.mintlify.com/docs/ai/llmstxt) · [AI Features and Your Website](https://developers.google.com/search/docs/appearance/ai-features) · [Direct measurement of vendor llms.txt files and markdown content negotiation (2026-08-20)](https://llmstxt.org/)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.

## Absorbed proposal — Markdown alternate: discoverable, resolvable, faithful, cheaper

On 2026-08-23 the
`token-economics/markdown-alternate-discoverable-resolvable-faithful-cheaper`
proposal (evidence grade **B**, `static-fetch`) was folded into this audit
rather than shipped beside it. Both are about the same artifact, and two audits
scoring one `<link rel="alternate">` would have double-counted it.

What the fold changed here:

- Discovery is no longer head-link only. Three routes are tried, in the order an
  agent would try them: the declared `alternate` link (from the head **or** from
  a `Link` response header), then `url + ".md"`, then the same URL with
  `Accept: text/markdown`. A site that serves an alternate without declaring it
  now passes discovery where it used to fail.
- The alternate is fetched, not merely counted. At most three read-only `GET`
  probes per scan, every URL `isSafeUrl()`-gated. A content-negotiation response
  that comes back as `text/html` is the same page again and does not count.
- Resolvability: the response must be `text/markdown`, with any parameter
  allowed after it, per RFC 7763. `text/plain` and `text/html` fail — a client
  that negotiated for markdown cannot tell it received markdown.
- Fidelity: heading recall against the page's `h1`–`h6`, and five-word shingle
  recall against its block-level text, both floored at 0.9. The failing message
  names the missing headings.
- Cost: token counts of both documents at `o200k_base`, reported absolutely and
  as a percentage saving.
- MDX/JSX component tags warn rather than fail: real-world alternates contain
  them, but an unresolved component is content the agent cannot interpret.

A declared link whose document cannot be read in the scan — an empty body, or a
fetch this scanner could not complete — still passes, with `details.verified`
false and the message saying fidelity was not assessed. A declared link that
resolves to a 4xx or 5xx fails: that is checkable brokenness, where an
unreadable probe would be a finding about our own fetch.

What did not change: the audit's id, its grade **A** and weight 1.0, and its
central verdict — a page with no usable markdown alternate fails. The proposal
would have made that case `notApplicable`; this audit's grade-A evidence is
precisely about the absence of the link, so the shipped meaning stands. The
`scoreDisplayMode` moved from `binary` to `ternary` to carry the new warn band.

The proposal's own finding about the convention is worth recording: the
`llms.txt` draft specifies the `.md` mirror convention and the
`type="text/markdown"` link relation, but states no requirement for the file's
own HTTP `Content-Type`. The resolvability check therefore enforces RFC 7763,
not `llms.txt`.
