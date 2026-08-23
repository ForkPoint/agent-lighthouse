---
check: markdown-alternate-discoverable-resolvable-faithful-cheaper
title: "Markdown alternate: discoverable, resolvable, faithful, cheaper"
domain: token-economics
status: proposed
evidence_grade: B
uniqueness: partial-overlap
difficulty: static-fetch
scoring_tier: scored
reviewed: 2026-08-20
---

# Markdown alternate: discoverable, resolvable, faithful, cheaper

> Proposed check. Evidence grade **B** · partial overlap · implementation: `static-fetch`

## What it checks

Audit the per-page markdown alternate as four independently reported assertions rather than a presence check. (a) Discoverable: an HTTP `Link: <...>; rel="alternate"; type="text/markdown"` header or a <link rel=alternate type=text/markdown> element, or the URL is listed with a .md extension in llms.txt. (b) Resolvable: url+'.md' (and, separately, GET with Accept: text/markdown) returns 200 with Content-Type text/markdown and, for negotiated responses, a Vary: Accept header. (c) Faithful: title matches, ≥90% of h1/h2 headings from the HTML extraction are present, and ≥0.8 body shingle recall — i.e. not a stub, not a 404 SPA shell served as 200. (d) Cheaper: markdown tokens ≤ 35% of raw HTML tokens. Report the measured savings percentage as the headline number.

## Claimed mechanism (falsifiable)

The convention is specified (clean markdown at the same URL with .md appended) with an explicitly token-economic rationale — every wasted token costs time and money — and it is deployed in production by at least one docs platform and a major AI vendor's own documentation, including header-based advertisement. The falsifiable claim is per-assertion: a .md that 404s, or returns text/html, or returns a 12-token stub, or is not linked from anywhere, provides no token savings to any agent, and each of those failure modes is detectable with two HTTP requests. Failure (c) is the one that actually bites in the field: sites generate .md alternates from a template and silently ship empty or truncated bodies.

## Evidence

- **[The /llms.txt file](https://llmstxt.org/)** — Answer.AI (Jeremy Howard) (draft-spec, URL verified 2026-08-20)
  - Defines llms.txt at /llms.txt (or any subpath) in Markdown, with H1 title, optional blockquote summary and H2-delimited link sections. Recommends clean Markdown mirrors 'at the same URL as the original page, either with .md appended (page.html.md) or with the extension replaced by .md (page.md)', and uses type="text/markdown" in link relations. CRITICALLY: the spec states NO requirement for the file's own HTTP Content-Type, no CORS guidance and no caching guidance — so any content-type audit is enforcing convention, not spec.
- **[llms.txt — Mintlify docs](https://mintlify.com/docs/ai/llmstxt)** — Mintlify (vendor-doc, URL verified 2026-08-20)
  - Mintlify auto-hosts llms.txt and llms-full.txt at both root and /.well-known/ paths; "Page links in the llms.txt file include a .md extension so AI tools can fetch the Markdown version of each page directly" (e.g. https://example.com/docs/api.md). Also advertises them via a standard HTTP Link header and an X-Llms-Txt header. Proves the per-page .md alternate is a deployed convention with header-level discovery, not a thought experiment.
- **[Intro to Claude (markdown alternate of the HTML docs page)](https://platform.claude.com/docs/en/intro.md)** — Anthropic (vendor-doc, URL verified 2026-08-20)
  - Fetching the HTML page URL with .md appended returns clean markdown with YAML front matter (title/url/description) instead of an HTML document — production evidence of the llms.txt .md-alternate convention on a major vendor's docs. Note the alternate embeds MDX components (<Tip>, <Steps>, <CardGroup>), which is a fidelity wrinkle a fidelity check must tolerate.
- **[RFC 7763 — The text/markdown Media Type](https://www.rfc-editor.org/rfc/rfc7763.html)** — IETF (spec, URL verified 2026-08-20)
  - Registers type text/markdown with required charset parameter and optional variant parameter (hint to the recipient, IANA registry of variants). Gives the markdown-alternate check a ratified Content-Type to assert against instead of accepting text/plain or an HTML fallback.
- **[openai/tiktoken](https://github.com/openai/tiktoken)** — OpenAI (repo, URL verified 2026-08-20)
  - Fast BPE tokenizer with cl100k_base and o200k_base encodings and encoding_for_model(); counts tokens fully offline, 3-6x faster than comparable tokenizers. Makes every token metric in this domain deterministic, reproducible and CI-friendly with no network or model call.
- **[Markdown Conversion — REST API usage (Workers AI)](https://developers.cloudflare.com/workers-ai/features/markdown-conversion/usage/rest-api/)** — Cloudflare (vendor-doc, URL verified 2026-08-20)
  - The toMarkdown REST response returns fields id, name, mimeType, format, tokens, data — e.g. "tokens": 49 for a converted HTML file. A major infra vendor bills/reports HTML→markdown conversion in tokens per document, so per-page token count is a first-class, vendor-visible unit.

## Competitor coverage

Lighthouse's Agentic Browsing category and every AEO tool (including our own current checks) score llms.txt file quality at the site level. Per-page markdown alternates, and specifically their resolvability/fidelity/savings, are not scored anywhere I could verify — the industry checks that the index file exists, not that the documents it promises are real, honest and actually smaller.

## Implementation sketch

For each audited URL: HEAD/GET url+'.md'; GET url with Accept: text/markdown; inspect response Link header and <link> elements. Assert Content-Type per RFC 7763 (accept a charset and optional variant parameter; reject text/plain and text/html). Tokenize the markdown body and the HTML body at o200k_base for the savings ratio. Fidelity: run readability on the HTML, extract headings via a markdown AST (remark), compare heading sets and 5-gram shingle recall. Tolerate MDX/JSX component tags in the markdown body when computing fidelity (real-world alternates contain them) but flag them separately as a minor deduction, since unresolved custom components are content the agent cannot interpret.

## Example failure

A docs site's llms.txt lists 400 URLs with .md extensions; 380 return the site's HTML shell with a 200 status because the router falls through, and the 20 that work return only front matter plus 'Coming soon'. Every agent that trusts llms.txt burns a fetch, gets HTML anyway, and pays more than if the file had never existed.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.
