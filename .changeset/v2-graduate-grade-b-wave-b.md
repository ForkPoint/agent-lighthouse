---
"@forkpoint/agent-lighthouse-core": major
"@forkpoint/agent-lighthouse-report": patch
"@forkpoint/agent-lighthouse": patch
"@forkpoint/agent-lighthouse-mcp": patch
---

Plan 5b Wave B: the token-economics and answer-selection-forensics proposals
land. Nine graduate as new audits and three fold into audits that already
shipped. The registry grows from 184 to 193 audits.

New in `content-extraction`:

- **preamble-tax** — how many tokens an agent reads before the page says
  anything about its subject.
- **boilerplate-tax** — across the crawl, how much of what an agent fetches it
  has already read.
- **extraction-determinism** — whether three extractors reading the same page
  agree on what the page says.
- **json-ld-duplication-mass** — how many tokens the structured data repeats
  from the body. Informative at weight 0: repeating a description in JSON-LD is
  a cost, not a defect, and the audit never fails a page for it.

New in `answer-readiness`:

- **chunk-boundary-referent-integrity** — pronouns and positional references
  that stop resolving once a retriever cuts the page into chunks.
- **extractor-survival-recall** — the share of a page's key spans that survive
  extraction, and the ancestor chain that deleted the ones that did not.
- **section-split-risk-profile** — how the page survives being cut into
  512-token windows: headings separated from their bodies, sections with no
  heading, sections too thin to answer anything, and tables cut in half.
- **site-wide-passage-uniqueness-ratio** — the share of each page's sentences
  that are its own, and near-duplicate clusters whose members all name
  themselves canonical, which leaves the canonical election with no answer.
- **table-markdown-round-trip-loss** — every main-content table converted to
  GFM markdown and read back, with each lost cell reported by coordinate.

Three proposals folded into audits that already shipped, rather than landing
beside them:

- `content-extraction/token-ratio` now measures signal density the way the
  signal-density-index proposal specifies: real `o200k_base` tokens, a
  readability-extracted numerator, and a bucket breakdown of where the rest of
  the payload went.
- `content-extraction/svg-bloat` now also counts base64 `data:` URIs, which
  cost an agent tokens the same way an inline SVG path does.
- `content-extraction/markdown-alternate` now verifies the alternate it finds:
  it fetches the file, checks the RFC 7763 media type, and measures how much of
  the HTML's headings and prose the markdown actually carries. A declared
  alternate that 404s fails; one that is served but unreadable passes with
  `details.verified = false`.

Two new runtime dependencies of `@forkpoint/agent-lighthouse-core`, which
consumers will install:

- `gpt-tokenizer` — real `o200k_base` token counts. Every token number this
  release reports is a tokenizer count, never `chars / 4`.
- `@mozilla/readability` — the main-content extractor, run over jsdom, that the
  new audits measure against.

`answer-readiness` gains 3.0 evidence mass and `content-extraction` 1.8, so both
categories take a larger share of the overall score and every other category's
share falls. A site that scored well on the 184-audit registry is not
guaranteed the same number here.

No audit in this wave sends a request that the previous release did not, except
`content-extraction/markdown-alternate`, which fetches the markdown alternate a
page declares — a same-origin GET of a file the site advertises.
