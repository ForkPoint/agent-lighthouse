---
"@forkpoint/agent-lighthouse-core": major
---

The two scored `llms.txt` audits are re-graded to C / informative / weight 0
after a fresh evidence sweep. `machine-discovery/llms-txt-exists` moves from
A / scored / 1.0 and `machine-discovery/llms-txt-links-valid` from
B / scored / 0.6, so 1.6 of weight leaves the scored set and every site's
machine-discovery and overall score is recomputed against it.

`docs/evidence/POLICY.md` already used llms.txt existence as its worked example
of grade **C** — "published widely, no documented consumer, Google states Search
ignores it" — while the audit shipped grade A. The sweep asked which of the two
was wrong. It was the audits.

No AI vendor documents a consumer of `/llms.txt`. Checked and empty across
Anthropic, OpenAI, Google, Perplexity, Mistral, Meta, xAI, Microsoft, Cursor and
Cloudflare, plus llmstxt.org v2, the IANA Well-Known URIs and Link Relations
registries, and the IETF Datatracker. Six of those vendors publish an llms.txt
for their own documentation; none documents reading one, and that distinction is
what the A collapsed. Google Search Central, updated 2026-07-10, still states
that Search does not use the file. Chrome's Lighthouse does fetch it — as an
auditor, applying three conformance rules, and scoring a missing file
`notApplicable`.

The pass rules move with the grades. A missing llms.txt is now **not
applicable** in both audits instead of a `critical` failure in one and a `fail`
in the other: the file is optional and its absence is not a defect. A site that
advertises the file with a `<link>` and does not serve it warns at `low` — that
promise is the site's own. Broken links inside a published file warn at `low`
instead of failing at `high`. Descriptions and guidance no longer claim the file
is how AI agents discover a site, or that ChatGPT, Perplexity and Claude must
crawl a site blindly without it.

`machine-discovery/llms-full-txt` was re-checked and is unchanged at
C / informative / 0. `agent-interfaces/openapi-exists` was re-checked and is
unchanged at B / informative / 0; `/.well-known/api-catalog` still has no
documented consumer.

`POLICY.md`'s grade-**D** example changes too. `ai-catalog.json` is no longer
speculative: since 2026-06-17 it is the file defined by the Agentic Resource
Discovery specification, and it has a documented first-party consumer client in
`huggingface/hf-discover`. The D row now cites security headers as "AI trust
signals", `agents.txt`, and invented "AI trust score" meta tags.
