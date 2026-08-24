---
audit: content-extraction/svg-bloat
audit_id: "6.18"
category: content-extraction
source_file: packages/core/src/audits/content-extraction/svg-bloat.ts
slug: svg-bloat
review_verdict: fix
severity: medium
evidence_grade: B
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# svg-bloat (`6.18`)

> semantic-html · source `svg-bloat.ts` · review verdict **fix** · evidence grade **B** · disposition: **keep — fix required**

## What it checks

When an LLM converts your HTML to Markdown or reads raw markup, every inline SVG is inlined as thousands of path-data tokens. Decorative icon sprites, charts, and complex illustrations can silently consume tens of thousands of tokens of agent context per page — "SVG context poisoning" — crowding out the actual content the agent should read. SVGs marked aria-hidden="true" or role="presentation" are stripped by most accessibility-tree extractors and do not count. Keep visible SVGs small, move decorative ones behind aria-hidden, and prefer raster images or CSS for complex graphics.

## Code review findings (2026-08-20, 11-agent pass)

The best-engineered audit in the directory — correct notApplicable, byte accounting, offender snippets with URLs, and calibrated thresholds. The flaw is the exemption rule: 'if ($el.attr('aria-hidden') === 'true' || $el.attr('role') === 'presentation') return;' skips the SVG's bytes entirely. But the token cost being measured is the cost of an agent reading the raw HTML, and aria-hidden does not remove a single byte from that HTML. Meanwhile the extractors that DO honor aria-hidden (Readability, Turndown, Jina Reader) strip essentially all <svg> regardless of aria-hidden. So the audit is exempting on a property that changes nothing for either class of consumer — a site can 'fix' a 60KB inline sprite by adding one attribute while an agent pays exactly the same tokens. The test suite locks this in ('passes when large SVGs are aria-hidden').

**Required fix:** Measure and report total inline-SVG bytes regardless of aria-hidden, and split the verdict into two dimensions: raw byte weight (what a raw-HTML reader pays, no exemption) and unhidden count (what an accessibility-tree reader sees). Do not award a pass for adding aria-hidden to a 30KB SVG. Also de-duplicate nested <svg> (the '$('svg')' selector matches inner SVGs and double-counts their bytes into the parent's total) and de-duplicate identical sprite markup repeated across pages so a shared sprite is not counted N times in the crawl total.

**False-positive risks:**
- aria-hidden exemption is not grounded in any consumer's behavior — it lets a site zero out real token cost with one attribute, and conversely fails a site whose SVGs are correctly exposed via role="img" + aria-label (the accessible pattern) purely for being visible.
- '$('svg')' matches nested <svg> inside <svg>; the inner element's bytes are counted once inside the parent's serialization and again on its own.
- A single shared icon sprite included on every page is counted once per page toward TOTAL_FAIL_BYTES (20KB), so the fail is triggered by crawl breadth rather than page weight — a 5-page crawl fails where a 2-page crawl of the same site passes.
- Byte count is taken from cheerio's re-serialization ('page.$.html(el)'), which normalizes quoting and entities and can differ from the bytes actually transferred.
- A hidden sprite block (style="display:none") without aria-hidden is charged full price although it renders nothing — arguably correct for raw-HTML readers but the audit does not explain that, and the offered fix (aria-hidden) would not reduce the real cost.
- SVGs injected client-side are invisible to the HTTP-only fetcher, so heavy-SVG SPAs pass.

**Test gaps:**
- The 'passes when large SVGs are aria-hidden' test codifies the questionable exemption rather than probing it.
- No nested-<svg> fixture (double counting untested).
- No shared-sprite-across-N-pages fixture showing crawl size drives the verdict.
- No role="img" + aria-label fixture (the accessible pattern that is penalized).
- No boundary tests at exactly 2048 / 10240 / 20480 bytes.
- No <use xlink:href> sprite-reference fixture.

**Overlaps with:** `6.19`

## Evidence

### Signal: Inline SVG and DOM bloat consuming LLM context — grade B (semantic-dom-a11y)

**Mechanism:** Deeply nested DOM and large inline SVG inflate the serialized page representation an agent receives, pushing it against fixed truncation caps and depth limits so content below the cut is never seen. The general DOM-size claim is well supported; the SVG-specific claim is that inline path data is pure token cost with no semantic payload, since it carries no accessible name and contributes nothing an LLM can reason about.

**Grade: B** — The truncation half is documented first-party: Anthropic's `read_page` caps output at 50,000 characters, truncates at a line boundary, and offers a depth limit (default 15) and ref-scoping as the remedy — an explicit admission that page size forces partial reads. Real DOMs are reported to exceed model context windows outright. That is a documented consumer with a stated limit but no measured effect on answer quality, which is grade B. The SVG-specific half is weaker and the audit treats it that way: no vendor document, specification or study singles out inline SVG, and mechanically an `<svg>` with no title or `aria-label` collapses to one unnamed node in the accessibility tree, so its path data costs nothing in a tree-based snapshot and costs a great deal only in raw-HTML pipelines.

**Evidence:** Truncation is documented first-party: Anthropic's read_page caps output at 50,000 characters, truncates at a line boundary, and offers depth (default 15) and ref-scoping as the remedy — an explicit admission that page size forces partial reads [anthropic-browser-use-tool]. Scale of the problem: 'Some real world DOMs surpass the size of a megabyte' ≈ 1e6 tokens, versus 1e3–1e4 after downsampling; the D2Snap ablation found DOM hierarchy 'the strongest among those features' for LLM performance, and its attribute filter preserves alt, href and aria-* while discarding the rest [dom-downsampling-paper]. Token magnitudes corroborated at ~56,653 HTML tokens per step [observation-reduction-paper] and by Cloudflare's 80% markdown reduction attributed to semantically empty wrappers and scripts [cloudflare-markdown-for-agents].

**Counter-evidence:** The SVG-specific half is materially weaker than the DOM-size half and should be graded C on its own. No vendor doc, spec, or study I could verify singles out inline SVG as an agent problem. Mechanically the cost is asymmetric: an inline <svg> without a title/aria-label collapses to a single unnamed node (or is omitted) in the accessibility tree, so its bloat lands on raw-HTML and markdown consumers, not on the a11y-tree agents that dominate this domain — meaning an SVG-bloat audit is really a payload-weight audit, not an agent-perception audit. And bigger is not uniformly worse: strong models gained double-digit points from the LARGER HTML observation [observation-reduction-paper]. Recommend scoring total serialized DOM size / node depth with the truncation cap as the documented anchor, and demoting the SVG-specific rule to an informative sub-check unless the SVG is also unnamed where it acts as a control.
**Consumers:** Anthropic read_page (50,000-char cap, depth 15 default), Playwright MCP snapshot, Chrome DevTools MCP, browser-use DOM serializer, Cloudflare Markdown for Agents · **Recommended tier:** scored

**Sources:** [Browser use tool (browser_toolset_20260801)](https://platform.claude.com/docs/en/agents-and-tools/tool-use/browser-use-tool) (verified 2026-08-20) · [Beyond Pixels: Exploring DOM Downsampling for LLM-Based Web Agents](https://arxiv.org/html/2508.04412v1) (verified 2026-08-20) · [Read More, Think More: Revisiting Observation Reduction for Web Agents](https://arxiv.org/abs/2604.01535) (verified 2026-08-20) · [Introducing Markdown for Agents](https://blog.cloudflare.com/markdown-for-agents/) (verified 2026-08-20) · [Snapshots — Playwright MCP](https://playwright.dev/mcp/snapshots) (verified 2026-08-20) · [browser-use ClickableElementDetector source](https://raw.githubusercontent.com/browser-use/browser-use/main/browser_use/dom/serializer/clickable_elements.py) (verified 2026-08-20)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.

## Absorbed proposal — Data-URI and inline-SVG token bloat

On 2026-08-23 the `token-economics/data-uri-and-inline-svg-token-bloat`
proposal (evidence grade **B**, `static-fetch`) was folded into this audit
rather than shipped beside it. Its inline-SVG half is what this audit already
did; shipping both would have scored the same SVG twice.

What the fold added here:

- Base64 `data:` URIs of 200 characters or more are counted wherever they sit —
  `src`, `srcset`, a `style` attribute, or inside a `<style>` block — because
  the payload costs the same in every position. They are matched against the raw
  response body, so no position is missed.
- They are priced in real `o200k_base` tokens, not bytes. Base64 has no word
  structure for a BPE tokenizer to exploit, so it prices far worse per byte than
  the prose it displaces.
- Inlined base64 above 5,000 tokens fails on its own, above 1,000 tokens warns.
  Below 200 characters nothing is counted: a 1×1 tracking pixel is not a token
  problem.
- `details` reports the two buckets separately — `svgPathTokens`,
  `unhiddenSvgBytes`, `dataUriTokens`, `dataUriCount` — because the two fixes
  differ. An SVG is optimised or marked `aria-hidden`; a data URI is moved to a
  real URL with descriptive alt text.
- The recommendation states the proposal's own arithmetic: a URL plus alt text
  costs about 15 tokens and tells a model strictly more than 4,000 tokens of
  base64 ever will.

The SVG byte thresholds did not move: 2KB per SVG and 8KB total warn, 10KB per
SVG and 20KB total fail. Existing consumers of `content-extraction/svg-bloat`
keep their meaning; the audit is now `notApplicable` only when neither bucket
has anything in it.

The proposal's own counter-evidence is worth keeping in view: byte-oriented
performance advice actively recommends inlining small assets to save requests,
which is correct for browsers and backwards for agents. That is why the floor
exists — the audit flags payloads large enough to displace content, not every
inlined asset.
