---
audit: content-extraction/markdown-alternate
category: content-extraction
source_file: packages/core/src/audits/content-extraction/markdown-alternate.ts
slug: markdown-alternate
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
recommended_tier: scored
consumers:
  - "OpenAI Codex CLI (rel=alternate type=text/markdown only; single-sourced, uncorroborated)"
  - "none-known for rel=describedby -> llms.txt"
  - "Claude Code (Anthropic, documented)"
  - Cursor
  - GitHub Copilot Chat and Copilot CLI
  - Microsoft Copilot
  - OpenCode
  - OpenClaw
  - OpenAI Codex CLI (via .md URL / link tag rather than Accept header)
  - "GPTBot (34.8% markdown share via .md URLs, measured)"
non_consumers:
  - "ChatGPT-User (0.1%)"
  - Perplexity
  - Gemini
  - Claude.ai
signals:
  - name: 'HTML <link> tags pointing to llms.txt / markdown alternates (rel="describedby", rel="alternate" type="text/markdown")'
    grade: C
    domain: llms-txt
  - name: "Markdown alternate representations of pages (.md URLs and Accept: text/markdown content negotiation)"
    grade: A
    domain: llms-txt
sources:
  - llmstxt-spec-link
  - llmstxt-org-changes
  - acceptmarkdown-agent-matrix
  - checkly-content-negotiation-state
  - lighthouse-llms-txt-gatherer-source
  - chrome-lighthouse-agentic-browsing
  - mintlify-llmstxt-docs
  - anthropic-claude-code-tools-reference
  - cloudflare-markdown-for-agents
  - evil-martians-llm-traffic
  - dries-buytaert-markdown-llmstxt
  - otterly-markdown-vs-html
  - longato-md-files-study
  - google-ai-features-trust
---

# markdown-alternate (`4.15`)

> meta-tags · source `markdown-alternate.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

Where a site serves a markdown version of a page, this checks that the markdown is usable: that it resolves as `text/markdown`, still carries the page's headings and prose, and costs fewer tokens than the HTML. It looks on three routes — a declared `<link rel="alternate" type="text/markdown">`, the page URL plus `.md`, and the page URL with `Accept: text/markdown`.

Interactive coding agents read markdown when a site offers it, and it costs them far fewer tokens than the HTML. A markdown version that has drifted from the page is worse than none: the agent gets a document that looks authoritative, costs less, and says less than the page it claims to mirror.

A site that serves no markdown version is reported as not applicable rather than failed. The consumers documented for this mechanism are coding agents, and no source measures a cost to a site that offers no markdown at all.

## Evidence

### Signal: HTML <link> tags pointing to llms.txt / markdown alternates (rel="describedby", rel="alternate" type="text/markdown") — grade C (llms-txt)

**Mechanism:** Emitting <link rel="describedby" href="/llms.txt"> and/or <link rel="alternate" type="text/markdown" href="...md"> in the HTML head (or the equivalent HTTP Link: header) causes agents to discover and fetch those resources. FALSIFIABLE TEST: does any published spec define these relations, and does any named agent parse them?

**Grade: C** — The relations are real and specified — llms.txt v2 (2026-08-10) defines `rel="alternate" type="text/markdown"` for a page's markdown version and `rel="describedby"` for the covering llms.txt, deliverable as `<link>` elements or as an HTTP `Link:` header. What no source shows is a consumer. Google's own llms.txt tooling resolves `new URL('/llms.txt', finalDisplayedUrl)` and ignores link tags entirely, so even the one shipping checker would never see the tag. A published specification with no reader is exactly grade C: plausible, cheap, and unproven.

**Evidence:** The relations are real and specified — but only since 2026-08-10, and the two halves differ sharply in strength. The llms.txt v2 spec explicitly defines both relations. rel="alternate" type="text/markdown" points to the markdown version of a page, and rel="describedby" points to the covering llms.txt. Either can be delivered as an HTML <link> element or as an HTTP Link: header; the header form also works for non-HTML resources, and is configurable at CDN level. This was the headline addition in v2. Deployment exists: a live check found developers.cloudflare.com emits <link rel="alternate" type="text/markdown" href="https://developers.cloudflare.com/fundamentals/index.md">, and Mintlify advertises resource locations via HTTP Link headers across every site it hosts. For the markdown half there is one named consumer: acceptmarkdown.com's June 2026 matrix reports OpenAI's Codex CLI fetches HTML first, then 'parses the response for <link rel="alternate" type="text/markdown" href=…>' and requests the markdown version separately. Note that any audit checking a bespoke rel="llms-txt" or rel="llms" value would be invented — only describedby and alternate are spec'd.

**Counter-evidence:** The rel="describedby" -> llms.txt half has no known consumer at all. Decisively, Lighthouse's own gatherer (source verified) resolves new URL('/llms.txt', finalDisplayedUrl) and nothing else — it ignores link tags entirely, so even Google's llms.txt tooling would never see the tag. There is no auto-discovery-links audit in Lighthouse's Agentic Browsing category; fetching that hypothesised URL returns HTTP 404, and the category index lists only seven audits, none of them about link relations. The Codex CLI claim is single-sourced and it could not be independently corroborated; Checkly's Feb 2026 testing found Codex sending no markdown preference at all. Adoption is near-zero and unmeasured: of three sites sampled, only Cloudflare emitted the tag; Stripe and Next.js emitted none, and Stripe instead uses an unrelated Link: rel="service-meta" pointing at /.well-known/skills/index.json. The relations are two weeks old as of this research.

### Signal: Markdown alternate representations of pages (.md URLs and Accept: text/markdown content negotiation) — grade A (llms-txt)

**Mechanism:** Serving a markdown representation of each page — via HTTP content negotiation on Accept: text/markdown and/or a .md URL suffix — causes named AI coding agents to retrieve markdown instead of HTML, substantially reducing tokens consumed per page. FALSIFIABLE TEST: vendor documentation stating an agent sends the header, plus observed markdown-vs-HTML fetch shares in server logs.

**Grade: A** — The one grade-A signal here, and it is vendor-stated for a named agent. "WebFetch sets a User-Agent header beginning with Claude-User, and an Accept header that prefers Markdown over HTML so servers that support content negotiation can return Markdown". A named consumer, a named header and a stated behaviour is the grade-A bar. The scope is narrow on purpose. It covers interactive coding agents, not search crawlers or consumer chat: ChatGPT-User takes markdown on 0.1% of fetches, and ChatGPT, Perplexity, Gemini, Grok and the rest send HTML-only `Accept` headers.

**Evidence:** The only grade-A signal in this domain, and it is the one that should carry weight in the audit. Anthropic documents the behavior explicitly for a named agent: 'WebFetch sets a User-Agent header beginning with Claude-User, and an Accept header that prefers Markdown over HTML so servers that support content negotiation can return Markdown directly.' Cloudflare shipped Markdown for Agents in Feb 2026. It does network-level HTML-to-markdown conversion on Accept: text/markdown, and returns an x-markdown-tokens header and YAML frontmatter. Independent header-capture testing finds seven agents advertising text/markdown as of June 2026 (Claude Code, Copilot Chat, Copilot CLI, Cursor, Microsoft Copilot, OpenClaw, OpenCode), up from three in February — a clear upward trajectory. Field measurement confirms real volume: Evil Martians recorded ~40,000 markdown fetches, 15% of all agent reads across 268k requests, with Claude Code at 76% markdown; Dries Buytaert measured GPTBot taking markdown 34.8% of the time via .md URLs. A live check confirmed the mechanism: curl -H 'Accept: text/markdown' returns content-type: text/markdown from Anthropic's, Stripe's and Cloudflare's docs today. This mechanism also needs no site-specific knowledge from the agent, unlike llms.txt.

**Counter-evidence:** Grade A applies to interactive coding agents, not to search crawlers or consumer chat — audits should say so. ChatGPT-User takes markdown on just 0.1% of fetches; ChatGPT, Claude.ai, Perplexity, Gemini variants, Grok, Windsurf, Devin, Aider, Cline, v0 and Zed send HTML-only Accept headers. Otterly's 14-day controlled test found 0 crawler visits and 0 citations for .md files versus 137 visits to matched HTML, and Longato's 24-hour two-site CDN check found zero .md requests from GPTBot/ClaudeBot/PerplexityBot. The two best studies also directly contradict each other on which mechanism works: Dries (Jan 2026) states 'No AI crawler uses content negotiation. Not one' and saw markdown taken only via .md URLs. Evil Martians (May-Jul 2026) concluded instead that content negotiation 'is the mechanism actually delivering Markdown to the client that wants it (Claude Code)'. The later date and the crawlers-versus-agents population reconcile the two, and both argue for supporting .md URLs and the Accept header rather than choosing between them. Google states you don't need Markdown to appear in Search or its AI features. Dries also found serving markdown did not reduce bot load; crawl volume rose ~7%.

## Implementation deviations

- Absence is not scored. A page with no markdown alternate on any route returns `notApplicable`. The grade-A evidence documents consumption when a representation is served, not a cost when it is absent.
- The gate is the site's own act of serving markdown. No coding-agent audience detector exists, because no observable signal distinguishes that audience.
- The `<link rel="alternate">` declaration is a grade-C discovery route and a reported detail. It never produces a pass, warn or fail on its own.
- Three routes are probed, in order: the declared link (head or `Link` header), `url + ".md"`, and the page URL with `Accept: text/markdown`. At most three `GET` probes run, each gated by `isSafeUrl()`.
- Probing continues past a declared document that fails the fidelity floors. The best document any route returns is scored.
- A response whose body is the HTML document is a catch-all route, not an alternate, whatever its content type. A 200 that is neither typed nor shaped as markdown is a soft 404.
- Resolvability follows RFC 7763: the response must be `text/markdown`, parameters allowed. `llms.txt` states no `Content-Type` requirement.
- Fidelity is heading recall and five-word shingle recall against the page, both floored at 0.9.
- Token counts use `o200k_base` and are reported with the saving.
- Unresolved MDX/JSX component tags warn. Fenced blocks and inline code spans are removed before the scan; indented code blocks are kept, because list continuations share that indentation.
- Page selection prefers a page that declares an alternate, then any non-homepage, then the first page.
