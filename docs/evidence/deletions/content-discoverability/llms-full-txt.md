---
audit: content-discoverability/llms-full-txt
category: content-discoverability
status: informative
verdict: dead-but-informative-candidate
evidence_grade: C
reviewed: 2026-08-21
---

# llms-full-txt — dead as scored audit — informative candidate (weight 0)

> Adversarial redemption research, 2026-08-21. The researcher's task was to **save** this audit by finding grade A/B evidence of a real consumer. Grade found: **C**.

## Claimed mechanism (steelmanned)

A /llms-full.txt at the site root containing the whole site's content as markdown lets an AI agent ingest everything in one request instead of crawling page by page, producing deeper and fresher answers about the site. Steelmanned, this needs either (a) a spec that defines the filename so consumers know to look for it, or (b) a named agent/crawler/answer engine documented to fetch it — even a coding-agent tool or MCP server counts.

## What we searched

WebSearch was exhausted after one call, so I worked from primary sources. Angle 1 — spec text: fetched llmstxt.org and its raw llmstxt.org/index.md, and pulled the AnswerDotAI/llms-txt README via the GitHub API; the literal string 'llms-full.txt' appears in none of the three. Angle 2 — originator: fetched Mintlify's llms.txt doc (Mintlify is who auto-hosts llms-full.txt for its customers) to see who they name as consumers. Angle 3 — consumers: fetched langchain-ai/mcpdoc (the best-known MCP server built specifically to feed llms.txt to IDE agents), Cursor's docs, and Google's AI-features doc looking for any documented reader. Angle 4 — real-world adoption: HTTP-probed llms.txt and llms-full.txt on ten major docs hosts, and ran GitHub code search ('llms-full.txt' language:HTML => 16,960 files). Angle 5 — spec-author position: searched AnswerDotAI/llms-txt issues for llms-full discussion (issue #55 'llms.full.txt generated is too large' sits open with no maintainer response).

## Best evidence found for the audit

Adoption by exactly the companies that build the agents. Live probes (HTTP 200 + byte counts): platform.claude.com/llms-full.txt = 33.5 MB; developers.openai.com/llms-full.txt = 6.2 MB; developers.cloudflare.com/llms-full.txt = 57.3 MB; vercel.com/llms-full.txt = 1.6 MB; supabase.com/llms-full.txt = 6.6 MB; docs.perplexity.ai/llms-full.txt = 4.1 MB; mintlify.com/llms-full.txt = 86 KB. Crucially, Anthropic's own spec-compliant llms.txt ends with a pointer to it: 'For more comprehensive documentation, see llms-full.txt' (https://platform.claude.com/llms.txt) — so within the llms.txt ecosystem the file IS a discoverable, referenced artifact, and Mintlify auto-hosts one for every customer ('Mintlify automatically hosts an llms-full.txt file at the root of your project'). GitHub code search shows 16,960 HTML files referencing the filename. The nearest thing to a documented reader is langchain-ai/mcpdoc, an MCP server whose fetch_docs tool 'read[s] URLs within any of the provided llms.txt files' for Cursor, Windsurf and Claude Code — but that reads llms.txt, and its README never mentions llms-full.txt.

## Counter-evidence

1. The spec does not define it. llmstxt.org's page and its raw source llmstxt.org/index.md contain zero occurrences of 'llms-full.txt'; the AnswerDotAI/llms-txt README (fetched via GitHub API, 13,622 bytes) likewise contains none. What the spec actually recommends is per-page markdown at the same URL ('.md appended (page.html.md) or with the extension replaced by .md'), a completely different mechanism. 2) Mintlify, which popularized the file, cites llmstxt.org only for llms.txt and names no consumer for llms-full.txt beyond generic 'AI tools' and 'LLM indexing' (https://mintlify.com/docs/ai/llmstxt). 3) Google's AI-features doc lists the complete set of controls affecting AI Overviews/AI Mode/Gemini and mentions no llms.txt-family file (https://developers.google.com/search/docs/appearance/ai-features). 4) Adoption is not universal even among llms.txt publishers: docs.stripe.com/llms-full.txt = 404 and docs.github.com/llms-full.txt = 404, though both serve llms.txt with HTTP 200. 5) Practical dead-end: Cloudflare's is 57 MB and Anthropic's is 33 MB — far beyond any context window, so 'ingest everything in one request' is not achievable for the very sites held up as exemplars; the open, unanswered issue #55 in the spec repo is titled 'llms.full.txt generated is too large'. 6) I found no vendor documentation from OpenAI, Anthropic, Google, Perplexity, Microsoft, Apple or Meta stating that any crawler or agent fetches it.

## Verdict

**dead as scored audit — informative candidate (weight 0)** (grade C)

Grade C — a community convention with no documented consumer — but the adoption is genuinely wide and concentrated among the AI vendors themselves (Anthropic, OpenAI, Cloudflare, Perplexity, Vercel, Supabase all serve one; Mintlify generates it for every customer; ~17k HTML files on GitHub reference it), and Anthropic's spec-compliant llms.txt explicitly links to it. That clears the rubric's 'genuinely wide adoption' bar, so it survives as informative rather than being deleted outright. It must NOT keep defaultPriority 'high' or the current failure copy: the description asserts effects ('AI assistants give shallow or outdated answers') that no evidence supports, the file is not in the spec, and the two exemplars are 33 MB and 57 MB — unusable in one request. Recommend demoting to informational, dropping the llmstxt.org docsUrl (which does not define the file), and reframing as 'publisher convention popularized by Mintlify; no documented automatic consumer'.

## Sources

- **[The /llms.txt file](https://llmstxt.org/)** — Answer.AI (Jeremy Howard) (spec, URL verified 2026-08-21)
  - Does not define or mention llms-full.txt or any full-content variant. Recommends per-page clean markdown at page.md / page.html.md, discoverable via link rel="alternate" type="text/markdown".
- **[llmstxt.org raw specification source (index.md)](https://llmstxt.org/index.md)** — Answer.AI (spec, URL verified 2026-08-21)
  - Raw spec text confirmed to contain zero occurrences of the string 'llms-full.txt'.
- **[AnswerDotAI/llms-txt](https://github.com/AnswerDotAI/llms-txt)** — Answer.AI (repo, URL verified 2026-08-21)
  - README (13,622 bytes, fetched via GitHub API) contains no mention of llms-full.txt. Issue #55 'llms.full.txt generated is too large' is open with no maintainer response on the file's status.
- **[llms.txt — Mintlify docs](https://mintlify.com/docs/ai/llmstxt)** — Mintlify (vendor-doc, URL verified 2026-08-21)
  - 'The llms-full.txt file combines your entire documentation site into a single file as context for AI tools and LLM indexing.' Mintlify auto-hosts it. Cites llmstxt.org only for llms.txt, never for llms-full.txt, and names no specific consumer.
- **[Anthropic Developer Documentation llms.txt](https://platform.claude.com/llms.txt)** — Anthropic (vendor-doc, URL verified 2026-08-21)
  - Spec-compliant llms.txt that ends with 'For more comprehensive documentation, see llms-full.txt' — an AI vendor both publishing and cross-linking the file. The referenced llms-full.txt returns HTTP 200 at 33.5 MB.
- **[langchain-ai/mcpdoc — MCP server for llms.txt](https://raw.githubusercontent.com/langchain-ai/mcpdoc/main/README.md)** — LangChain (repo, URL verified 2026-08-21)
  - Closest thing to a documented consumer: a fetch_docs tool that reads URLs inside provided llms.txt files, configured for Cursor, Windsurf and Claude Code. Reads llms.txt only; never mentions llms-full.txt.
- **[AI features and your website](https://developers.google.com/search/docs/appearance/ai-features)** — Google Search Central (vendor-doc, URL verified 2026-08-21)
  - Complete list of controls over Google AI features is nosnippet/data-nosnippet/max-snippet/noindex. No llms.txt or llms-full.txt anywhere.

## Review history

- 2026-08-21 — user decision: all research verdicts accepted. Disposition by grade: **informative** (kept as informative, weight 0).

- 2026-08-21 — adversarial redemption research pass (8-agent workflow); URLs fetched at research time.
