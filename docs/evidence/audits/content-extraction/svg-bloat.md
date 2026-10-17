---
audit: content-extraction/svg-bloat
category: content-extraction
source_file: packages/core/src/audits/content-extraction/svg-bloat.ts
slug: svg-bloat
evidence_grade: B
disposition: "keep — fix required"
reviewed: 2026-08-21
recommended_tier: scored
consumers:
  - "Anthropic read_page (50,000-char cap, depth 15 default)"
  - Playwright MCP snapshot
  - Chrome DevTools MCP
  - browser-use DOM serializer
  - Cloudflare Markdown for Agents
signals:
  - name: Inline SVG and DOM bloat consuming LLM context
    grade: B
    domain: semantic-dom-a11y
sources:
  - anthropic-browser-use-tool
  - dom-downsampling-paper
  - observation-reduction-paper
  - cloudflare-markdown-for-agents
  - playwright-mcp-snapshots
  - browser-use-clickable-elements
---

# svg-bloat (`6.18`)

> semantic-html · source `svg-bloat.ts` · review verdict **fix** · evidence grade **B** · disposition: **keep — fix required**

## What it checks

When an LLM converts your HTML to Markdown or reads raw markup, every inline SVG is inlined as thousands of path-data tokens. Decorative icon sprites, charts, and complex illustrations can silently consume tens of thousands of tokens of agent context per page — "SVG context poisoning" — crowding out the actual content the agent should read. SVGs marked aria-hidden="true" or role="presentation" are stripped by most accessibility-tree extractors and do not count. Keep visible SVGs small, move decorative ones behind aria-hidden, and prefer raster images or CSS for complex graphics.

## Evidence

### Signal: Inline SVG and DOM bloat consuming LLM context — grade B (semantic-dom-a11y)

**Mechanism:** Deeply nested DOM and large inline SVG inflate the serialized page representation an agent receives, pushing it against fixed truncation caps and depth limits so content below the cut is never seen. The general DOM-size claim is well supported; the SVG-specific claim is that inline path data is pure token cost with no semantic payload, since it carries no accessible name and contributes nothing an LLM can reason about.

**Grade: B** — The truncation half is documented first-party. Anthropic's `read_page` caps output at 50,000 characters, and truncates at a line boundary. It offers a depth limit, default 15, and ref-scoping as the remedy. That is an explicit admission that page size forces partial reads. Real DOMs are reported to exceed model context windows outright. That is a documented consumer with a stated limit but no measured effect on answer quality, which is grade B. The SVG-specific half is weaker, and the audit treats it that way. No vendor document, specification or study singles out inline SVG. Mechanically, an `<svg>` with no title and no `aria-label` collapses to one unnamed node in the accessibility tree. Its path data therefore costs nothing in a tree-based snapshot, and costs a great deal only in raw-HTML pipelines.

**Evidence:** Truncation is documented first-party: Anthropic's read_page caps output at 50,000 characters, truncates at a line boundary, and offers depth (default 15) and ref-scoping as the remedy — an explicit admission that page size forces partial reads [anthropic-browser-use-tool]. The scale of the problem is measured: 'Some real world DOMs surpass the size of a megabyte', roughly 1e6 tokens, against 1e3 to 1e4 after downsampling. The D2Snap ablation found DOM hierarchy 'the strongest among those features' for LLM performance. Its attribute filter preserves alt, href and aria-*, and discards the rest [dom-downsampling-paper]. Token magnitudes corroborated at ~56,653 HTML tokens per step [observation-reduction-paper] and by Cloudflare's 80% markdown reduction attributed to semantically empty wrappers and scripts [cloudflare-markdown-for-agents].

**Counter-evidence:** The SVG-specific half is materially weaker than the DOM-size half and should be graded C on its own. No vendor doc, spec or study located for this dossier singles out inline SVG as an agent problem. Mechanically the cost is asymmetric. An inline <svg> without a title or aria-label collapses to a single unnamed node in the accessibility tree, or is omitted from it. Its bloat therefore lands on raw-HTML and markdown consumers, not on the a11y-tree agents that dominate this domain. An SVG-bloat audit is really a payload-weight audit, not an agent-perception audit. And bigger is not uniformly worse: strong models gained double-digit points from the larger HTML observation [observation-reduction-paper]. Recommend scoring total serialized DOM size / node depth with the truncation cap as the documented anchor, and demoting the SVG-specific rule to an informative sub-check unless the SVG is also unnamed where it acts as a control.

## Implementation deviations

- This audit absorbed the data-URI and inline-SVG proposal, so one SVG is not scored twice. Its record is in [merged/content-extraction/data-uri-and-inline-svg-token-bloat.md](../../merged/content-extraction/data-uri-and-inline-svg-token-bloat.md).
- Base64 `data:` URIs of 200 characters or more are counted in any position, matched against the raw response body. Below 200 characters nothing is counted. Byte-oriented performance advice recommends inlining small assets.
- Data URIs are priced in `o200k_base` tokens. Above 5,000 tokens fails; above 1,000 warns.
- SVG byte thresholds: 2KB per SVG or 8KB total warns; 10KB per SVG or 20KB total fails.
- `details` reports the two buckets separately, because the fixes differ.
- The audit is `notApplicable` only when both buckets are empty.
