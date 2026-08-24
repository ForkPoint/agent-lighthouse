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

Where a site serves a markdown version of a page, this checks that the markdown is usable: that it resolves as `text/markdown`, still carries the page's headings and prose, and costs fewer tokens than the HTML. It looks on three routes — a declared `<link rel="alternate" type="text/markdown">`, the page URL plus `.md`, and the page URL with `Accept: text/markdown`.

Interactive coding agents read markdown when a site offers it, and it costs them far fewer tokens than the HTML. A markdown version that has drifted from the page is worse than none: the agent gets a document that looks authoritative, costs less, and says less than the page it claims to mirror.

A site that serves no markdown version is reported as not applicable rather than failed. The consumers documented for this mechanism are coding agents, and no source measures a cost to a site that offers no markdown at all.

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

**Grade: C** — The relations are real and specified — llms.txt v2 (2026-08-10) defines `rel="alternate" type="text/markdown"` for a page's markdown version and `rel="describedby"` for the covering llms.txt, deliverable as `<link>` elements or as an HTTP `Link:` header. What no source shows is a consumer. Google's own llms.txt tooling resolves `new URL('/llms.txt', finalDisplayedUrl)` and ignores link tags entirely, so even the one shipping checker would never see the tag. A published specification with no reader is exactly grade C: plausible, cheap, and unproven.

**Evidence:** REAL, NOT INVENTED — but only since 2026-08-10, and the two halves differ sharply in strength. The llms.txt v2 spec explicitly defines both relations: rel="alternate" type="text/markdown" points to the markdown version of a page and rel="describedby" points to the covering llms.txt, deliverable as HTML <link> elements or as an HTTP Link: header (the header form also working for non-HTML resources and configurable at CDN level). This was the headline addition in v2. Deployment exists: I confirmed developers.cloudflare.com emits <link rel="alternate" type="text/markdown" href="https://developers.cloudflare.com/fundamentals/index.md">, and Mintlify advertises resource locations via HTTP Link headers across every site it hosts. For the markdown half there is one named consumer: acceptmarkdown.com's June 2026 matrix reports OpenAI's Codex CLI fetches HTML first, then 'parses the response for <link rel="alternate" type="text/markdown" href=…>' and requests the markdown version separately. Note that any audit checking a bespoke rel="llms-txt" or rel="llms" value WOULD be invented — only describedby and alternate are spec'd.

**Counter-evidence:** The rel="describedby" -> llms.txt half has NO known consumer at all. Decisively, Lighthouse's own gatherer (source verified) resolves new URL('/llms.txt', finalDisplayedUrl) and nothing else — it ignores link tags entirely, so even Google's llms.txt tooling would never see the tag. There is no auto-discovery-links audit in Lighthouse's Agentic Browsing category; I fetched that hypothesized URL and got HTTP 404, and the category index lists only seven audits, none of them about link relations. The Codex CLI claim is single-sourced and I could not independently corroborate it; Checkly's Feb 2026 testing found Codex sending no markdown preference at all. Adoption is near-zero and unmeasured: of three sites I sampled, only Cloudflare emitted the tag; Stripe and Next.js emitted none, and Stripe instead uses an unrelated Link: rel="service-meta" pointing at /.well-known/skills/index.json. The relations are two weeks old as of this research.
**Consumers:** OpenAI Codex CLI (rel=alternate type=text/markdown only; single-sourced, uncorroborated), none-known for rel=describedby -> llms.txt · **Recommended tier:** experimental

**Sources:** [The /llms.txt file, v2](https://llmstxt.org/) (verified 2026-08-20) · [llms.txt v2 changes page](https://llmstxt.org/changes.html) (verified 2026-08-20) · [Which AI agents support Markdown content negotiation? (status matrix)](https://acceptmarkdown.com/status) (verified 2026-08-20) · [The Current State of Content Negotiation for AI Agents (Feb 2026)](https://www.checklyhq.com/blog/state-of-ai-agent-content-negotation/) (verified 2026-08-20) · [Lighthouse core/gather/gatherers/agentic/llms-txt.js (source code)](https://github.com/GoogleChrome/lighthouse/blob/main/core/gather/gatherers/agentic/llms-txt.js) (verified 2026-08-20) · [Agentic Browsing category | Lighthouse | Chrome for Developers](https://developer.chrome.com/docs/lighthouse/agentic-browsing) (verified 2026-08-20) · [llms.txt — Mintlify documentation](https://www.mintlify.com/docs/ai/llmstxt) (verified 2026-08-20) · [Direct measurement of vendor llms.txt files and markdown content negotiation (2026-08-20)](https://llmstxt.org/) (verified 2026-08-20)

### Signal: Markdown alternate representations of pages (.md URLs and Accept: text/markdown content negotiation) — grade A (llms-txt)

**Mechanism:** Serving a markdown representation of each page — via HTTP content negotiation on Accept: text/markdown and/or a .md URL suffix — causes named AI coding agents to retrieve markdown instead of HTML, substantially reducing tokens consumed per page. FALSIFIABLE TEST: vendor documentation stating an agent sends the header, plus observed markdown-vs-HTML fetch shares in server logs.

**Grade: A** — The one grade-A signal here, and it is vendor-stated for a named agent: "WebFetch sets a User-Agent header beginning with Claude-User, and an Accept header that prefers Markdown over HTML so servers that support content negotiation can return Markdown". A named consumer, a named header and a stated behaviour is the grade-A bar. The scope is narrow on purpose. It covers interactive coding agents, not search crawlers or consumer chat: ChatGPT-User takes markdown on 0.1% of fetches, and ChatGPT, Perplexity, Gemini, Grok and the rest send HTML-only `Accept` headers.

**Evidence:** THE ONLY A-GRADE SIGNAL IN THIS DOMAIN, and it is the one that should carry weight in the audit. Anthropic documents the behavior explicitly for a named agent: 'WebFetch sets a User-Agent header beginning with Claude-User, and an Accept header that prefers Markdown over HTML so servers that support content negotiation can return Markdown directly.' Cloudflare shipped Markdown for Agents (Feb 2026) doing network-level HTML-to-markdown conversion on Accept: text/markdown, returning an x-markdown-tokens header and YAML frontmatter. Independent header-capture testing finds seven agents advertising text/markdown as of June 2026 (Claude Code, Copilot Chat, Copilot CLI, Cursor, Microsoft Copilot, OpenClaw, OpenCode), up from three in February — a clear upward trajectory. Field measurement confirms real volume: Evil Martians recorded ~40,000 markdown fetches, 15% of all agent reads across 268k requests, with Claude Code at 76% markdown; Dries Buytaert measured GPTBot taking markdown 34.8% of the time via .md URLs. I verified the mechanism live myself: curl -H 'Accept: text/markdown' returns content-type: text/markdown from Anthropic's, Stripe's and Cloudflare's docs today. This mechanism also needs no site-specific knowledge from the agent, unlike llms.txt.

**Counter-evidence:** Grade A applies to interactive coding agents, NOT to search crawlers or consumer chat — audits should say so. ChatGPT-User takes markdown on just 0.1% of fetches; ChatGPT, Claude.ai, Perplexity, Gemini variants, Grok, Windsurf, Devin, Aider, Cline, v0 and Zed send HTML-only Accept headers. Otterly's 14-day controlled test found 0 crawler visits and 0 citations for .md files versus 137 visits to matched HTML, and Longato's 24-hour two-site CDN check found zero .md requests from GPTBot/ClaudeBot/PerplexityBot. The two best studies also directly contradict each other on which mechanism works: Dries (Jan 2026) states 'No AI crawler uses content negotiation. Not one' and saw markdown taken only via .md URLs, while Evil Martians (May-Jul 2026) concluded content negotiation 'is the mechanism actually delivering Markdown to the client that wants it (Claude Code)' — best reconciled by the later date and by crawlers-versus-agents population, which argues for supporting BOTH .md URLs and the Accept header rather than choosing. Google states you don't need Markdown to appear in Search or its AI features. Dries also found serving markdown did not reduce bot load; crawl volume rose ~7%.
**Consumers:** Claude Code (Anthropic, documented), Cursor, GitHub Copilot Chat and Copilot CLI, Microsoft Copilot, OpenCode, OpenClaw, OpenAI Codex CLI (via .md URL / link tag rather than Accept header), GPTBot (34.8% markdown share via .md URLs, measured), NOT: ChatGPT-User (0.1%), Perplexity, Gemini, Claude.ai · **Recommended tier:** scored

**Sources:** [Tools reference — Claude Code docs (WebFetch behavior)](https://code.claude.com/docs/en/tools-reference) (verified 2026-08-20) · [Introducing Markdown for Agents](https://blog.cloudflare.com/markdown-for-agents/) (verified 2026-08-20) · [Which AI agents support Markdown content negotiation? (status matrix)](https://acceptmarkdown.com/status) (verified 2026-08-20) · [The Current State of Content Negotiation for AI Agents (Feb 2026)](https://www.checklyhq.com/blog/state-of-ai-agent-content-negotation/) (verified 2026-08-20) · [Which AI actually reads your site? Two months of LLM traffic, measured](https://evilmartians.com/chronicles/which-ai-actually-reads-your-site-two-months-of-llm-traffic-measured) (verified 2026-08-20) · [Markdown, llms.txt and AI crawlers](https://dri.es/markdown-llms-txt-and-ai-crawlers) (verified 2026-08-20) · [GEO Experiment: Markdown vs. HTML, Which Format Do AI Crawlers Prefer?](https://otterly.ai/blog/geo-experiment-html-vs-markdown/) (verified 2026-08-20) · [Do LLMs Crawl Markdown (.md) Files? Data Analysis](https://www.longato.ch/llm-md-files/) (verified 2026-08-20) · [The /llms.txt file, v2](https://llmstxt.org/) (verified 2026-08-20) · [llms.txt — Mintlify documentation](https://www.mintlify.com/docs/ai/llmstxt) (verified 2026-08-20) · [AI Features and Your Website](https://developers.google.com/search/docs/appearance/ai-features) (verified 2026-08-20) · [Direct measurement of vendor llms.txt files and markdown content negotiation (2026-08-20)](https://llmstxt.org/) (verified 2026-08-20)

## Pass-rule correction (contradiction sweep, 2026-08-24)

Two defects, both recorded in this dossier's own research, both fixed together.

**The rule applied the grade to a population the evidence never covered.** The
grade-A signal above is explicit: "Grade A applies to interactive coding agents,
NOT to search crawlers or consumer chat — audits should say so." The audit said
no such thing. It failed every site that served no markdown alternate, at weight
1.0, including a retail store with no coding-agent audience. What the sources
document is *consumption when the representation is served* — Anthropic's
WebFetch preferring markdown, seven agents advertising `text/markdown`, Evil
Martians' ~40,000 markdown fetches. No cited source measures a cost to a site
that serves none, and three point the other way: ChatGPT-User takes markdown on
0.1% of fetches, Otterly's 14-day controlled test found 0 crawler visits and 0
citations for `.md` against 137 to matched HTML, and Google states markdown is
not needed to appear in Search or its AI features.

Absence is therefore no longer scored. A page with no markdown alternate on any
route returns `notApplicable` and leaves the score denominator. A page that
serves one is scored exactly as before, at grade A and weight 1.0: resolvability
against RFC 7763, heading and shingle recall at 0.9, unresolved component tags
as a warn, and the token saving reported.

The gate is the site's own act of serving a markdown document, not a detector
for a coding-agent audience. No such detector was built, and none should be: this
dossier records no observable signal that distinguishes that audience, so any
heuristic would be an invented mechanism with no consumer behind it — the exact
defect the grading policy exists to prevent. A site that serves an alternate has
self-selected into the documented population by observable behaviour.

This reverses one sentence written on 2026-08-23 in *Absorbed proposal*: "The
proposal would have made that case `notApplicable`; this audit's grade-A
evidence is precisely about the absence of the link, so the shipped meaning
stands." That reading does not survive its own counter-evidence. The absorbed
proposal was right and the fold was wrong. The 2026-08-23 text stays above as
the record of what was decided then.

**The grade-C signal was deciding grade-A outcomes.** Two signals are graded
here and they are not interchangeable. The link relations — `rel="alternate"
type="text/markdown"` and `rel="describedby"` — carry `Recommended tier:
experimental`, with one single-sourced, uncorroborated consumer for the first
and none-known for the second. The markdown *representation*, reached by a `.md`
URL or by `Accept: text/markdown`, carries `Recommended tier: scored` and many
named consumers. The audit let the first decide the second: a declared link
whose document could not be read returned a full `pass` at weight 1.0, and a
declared link that 404'd returned a full `fail`.

Both arms are gone. The declaration is now a discovery route and a reported
detail, never an outcome. It cannot produce a pass, a fail or a warn on its own.
Two further changes protect that boundary:

- A declared link is no longer the last word. Probing continues past a declared
  document that fails the fidelity floors, and the best document any route
  returned is the one scored. `developers.cloudflare.com` declares a single
  site-wide `index.md` from every page; scoring that against the page being
  scanned would have failed a site for the alternate it actually serves.
- "This is the HTML page again" is now decided from the body, not the content
  type. A `.md` URL answering with the HTML document is a catch-all route and is
  not an alternate at all; a markdown document served as `text/html` or
  `text/plain` is a mistyped alternate and still fails, which is what RFC 7763
  supports. The content type cannot tell those apart — only the body can. A 200
  response that is neither typed nor shaped as markdown is treated as a soft 404.

Page selection also moved, closing the homepage bias this dossier recorded as
required fix #5: the audit now prefers a page that declares an alternate, then
any non-homepage, before falling back to the first page.

*What it checks* was rewritten to match. It described a check that no longer
exists — it promised that a markdown alternate "improves the accuracy of
AI-generated summaries", a claim no source here carries, and it framed the
`<link>` as the thing being checked.

Grade, tier, weight and display mode are unchanged — A, scored, 1.0, ternary.
The scored population is now the one the grade-A evidence covers, so the grade
needs no adjustment. One caution for anyone reading the counter-evidence as
"crawlers do not take markdown": this dossier also records GPTBot taking
markdown 34.8% of the time via `.md` URLs. That is consumption when served,
which is the mechanism being scored — not a cost of absence, which is the claim
the audit no longer makes.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
- 2026-08-24 — contradiction sweep: pass rule narrowed to the population the grade covers, and the grade-C link relation demoted to a discovery route.

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
