---
audit: operability-safety/landmark-unique
category: operability-safety
source_file: packages/core/src/audits/operability-safety/landmark-unique.ts
slug: landmark-unique
evidence_grade: A
disposition: "merged 2026-08-22 (Plan 4, Task 8) — absorbs nav-aria-label (7.3)"
reviewed: 2026-08-22
recommended_tier: scored
consumers:
  - Anthropic browser use tool / Claude in Chrome
  - Playwright MCP (snapshot mode)
  - Chrome DevTools MCP
  - browser-use
  - WebArena / BrowserGym-style benchmarks
  - Browserless agent MCP
signals:
  - name: "Landmark elements (main, nav, header, footer, article, aside) as extraction boundaries"
    grade: A
    domain: semantic-dom-a11y
  - name: Accessibility tree consumption by computer-use and agentic-browser agents
    grade: A
    domain: semantic-dom-a11y
sources:
  - trafilatura-xpaths
  - trafilatura-corefunctions
  - readability-src
  - w3c-html-aam
  - w3c-wai-aria-1-2
  - anthropic-browser-use-tool
  - playwright-mcp-snapshots
  - web-almanac-2025-accessibility
  - google-ai-features-trust
  - playwright-mcp-repo
  - chrome-devtools-mcp-tool-reference
  - browser-use-clickable-elements
  - webarena-repo
  - webarena-paper
  - w3c-accname
  - anthropic-cu-tool
  - openai-computer-use-guide
  - gemini-computer-use-docs
  - observation-reduction-paper
  - openai-cua-announcement
  - mozilla-readability-source
  - google-ai-features-docs
  - anthropic-computer-use-tool
---

# Landmarks are uniquely identifiable (`7.4`, `7.3`)

> operability-safety · source `landmark-unique.ts` (rule engine, base `_shared.ts`) · merged landmark-labelling audit, absorbs nav-aria-label (7.3) · evidence grade **A** · tier **scored** (weight 1.0)

## What it checks

AI browser agents traverse the accessibility tree and use a landmark's role plus accessible name to target the right region. Two landmarks of the same role — a primary `<nav>` and a footer `<nav>`, two `<aside>`s, two `<main>`s — without distinct accessible names are indistinguishable, so an agent can act on the wrong region. A landmark with no same-role sibling is unambiguous and is not flagged.

Standard `A11yBackedAudit` aggregation over the one rule it wires (`landmark-unique`): any page failing → `fail`; incomplete without a pass → `warn`; any pass → `pass`; nothing applicable → `na`.

## Code review findings (2026-08-20, 11-agent pass)

Wraps axe's `landmark-unique` — duplicate landmarks of the same role must have distinct accessible names. This is the strongest agent-relevant landmark signal in the category and the port (rules.ts `landmarkUniqueMatch` + `landmark-is-unique` with its `after` reducer) is faithful. The flaw is environmental: with CSS stripped, the responsive desktop/mobile nav pair that every modern theme ships (one of which is `display:none` at any viewport) is counted as two visible same-role landmarks, producing a fail on correctly built sites.

**Required fix:** Preserve a minimal CSS visibility model instead of discarding all stylesheets: keep `display`/`visibility` declarations by pre-computing them (e.g. run a lightweight CSS parse for `display:none`/`visibility:hidden` selectors and stamp matching elements with an inline style before jsdom construction, or keep only the first N KB of CSS). Alternatively downgrade this audit to `warn` when duplicate landmarks differ only between a desktop/mobile pair. Also emit the violation count and a stable path-based selector.

**False-positive risks:**
- CSS blindness (see categoryNotes #1): `landmarkUniqueMatch = isLandmark(vNode) && isVisibleToScreenReaders(vNode)` — a hidden mobile `<nav>` duplicating the desktop `<nav>` is 'visible' after `stripStyles()`, so a site that is unambiguous in a real browser fails here.
- Same for hidden off-canvas `<aside>`/`<footer>` copies and for pre-rendered `<header>` variants in hidden template blocks.
- CSR SPA → `inapplicable` → `na` silently, so the audit reports 'no applicable elements' rather than 'could not evaluate'.
- Cross-page pass override: duplicate landmarks on the homepage fail, but the aggregation cannot ever be rescued by another page (fail wins) — this direction is fine; the reverse (an incomplete on page 1 swallowed by a pass on page 2) is the general base-class defect.
- Evidence quality: failing target is `nav` or `nav.flex.items-center` — not actionable on a themed site.

**Test gaps:**
- No HTML-level test of this audit at all (_a11y.test.ts only tests aggregation with synthetic results for 7.10/7.17/7.18).
- No fixture with a CSS-hidden duplicate nav (the dominant real-world case).
- No fixture with two navs distinguished by `aria-labelledby` pointing at headings.
- No fixture with `<section>`/`<form>` landmarks (isLandmark has a special accessible-name branch for them that is untested).

**Overlaps with:** `7.3`, `7.2`

## Evidence

### Signal: Landmark elements (main, nav, header, footer, article, aside) as extraction boundaries — grade A (semantic-dom-a11y)

**Mechanism:** Wrapping primary content in <main> or <article>, and chrome in <nav>, <header>, <footer> or <aside>, changes what boilerplate-removal extractors keep and drop. Content inside landmark containers matching the extractor's body selectors is retained. Subtrees whose element or ARIA role resolves to navigation, banner, contentinfo or complementary are deleted before the text ever reaches the model. On a page built from undifferentiated divs, the same extractors fall back to class/id string heuristics and text-density guesses, so nav and footer text leaks into the extracted body and body text can be discarded.

**Grade: A** — The proof is in the source of the two dominant extractors, not in a claim about them. trafilatura's `BODY_XPATH` selects on `self::article or self::div or self::main or self::section`, plus `@itemprop='articleBody'` and `@role='article'`. Its `OVERALL_DISCARD_XPATH` deletes nodes whose `@role` contains `nav`, along with footer and header markers. Readable, shipping code that acts on the element is documented consumer behaviour, which is the grade-A bar. The grade is about direction, not sufficiency: trafilatura also matches bare divs by id and class and falls back to justext and readability, and Readability gives `<main>` no special boost at all, so a landmark-free page is degraded rather than invisible.

**Evidence:** Source-level proof in the two dominant extractors. trafilatura's BODY_XPATH selects on 'self::article or self::div or self::main or self::section', plus @itemprop='articleBody' and @role='article'. Its OVERALL_DISCARD_XPATH deletes nodes whose @role contains 'nav', along with footer and header markers and @aria-hidden='true' [trafilatura-xpaths]. Its documented baseline ladder tries 'article tags' before falling back to 'the raw text of the whole page body' [trafilatura-corefunctions]. Mozilla Readability consults ARIA landmark roles directly: UNLIKELY_ROLES = ['menu','menubar','complementary','navigation','alert','alertdialog','dialog'] triggers subtree removal, and its unlikelyCandidates regex penalises footer|header|menu|sidebar|related|social while okMaybeItsACandidate rescues article|body|content|main [mozilla-readability-source]. HTML-AAM makes the element→role mapping normative: main→main, nav→navigation, header→banner, footer→contentinfo, article→article, aside→complementary [w3c-html-aam], over WAI-ARIA 1.2's ratified landmark role set [w3c-wai-aria-1-2]. Anthropic's own get_page_text is documented to 'return the page's visible text as plain text, prioritizing the main article content' [anthropic-browser-use-tool], and Playwright snapshots list 'roles and landmarks… contentinfo sections' as snapshot contents [playwright-mcp-snapshots].

**Counter-evidence:** Landmarks are one path among several, not a gate. trafilatura also matches bare divs by id/class and falls back to justext/readability; Readability gives no special boost to <main> at all and can extract a landmark-free page perfectly well via text density. So a page with zero landmarks is degraded, not invisible. Adoption is partial — only 40.72% of pages use <main> [web-almanac-2025-accessibility] — which means extractors cannot depend on landmarks and have been tuned to work without them. No AI-search vendor documents landmarks as a requirement, and Google explicitly disclaims special optimizations for AI features [google-ai-features-docs]. Over-nesting also backfires: multiple <main> or a <nav> wrapping real content will actively delete content, so this signal is bidirectional and an audit should penalise misuse as well as absence.

### Signal: Accessibility tree consumption by computer-use and agentic-browser agents — grade A (semantic-dom-a11y)

**Mechanism:** Browser-embedded agents perceive the page as a serialized accessibility tree — role plus accessible name plus state plus an opaque element reference — and issue actions against those references rather than against CSS selectors or screen coordinates. An element's presence, role correctness and accessible name in the a11y tree therefore determine whether an agent can see it and act on it at all. Elements that are role-suppressed, unnamed or misrole'd are functionally invisible to this class of agent, however they look on screen.

**Grade: A** — Three major vendors document the same architecture first-party. Anthropic's `read_page` returns "the page's accessibility tree as text with each element tagged with a reference such as [ref_2]", and the security guidance tells implementers to build page reads "from what the page renders (the accessibility tree or visible text), not raw DOM source". Playwright MCP and browser-use serialise role, name, state and a reference the same way. Named agents acting on the tree is the grade-A bar. The scope is browser-embedded agents only: Anthropic's desktop computer-use tool is screenshot-only, and OpenAI's computer use "looks at the current UI through a screenshot", so a pixel-driven agent needs none of this.

**Evidence:** Three independent major-vendor harnesses, all first-party. Anthropic: read_page 'Return the page's accessibility tree as text with each element tagged with a reference such as [ref_2]', and the security guidance instructs implementers to 'build page reads from what the page renders (the accessibility tree or visible text), not raw DOM source' [anthropic-browser-use-tool]. Microsoft: 'Uses Playwright's accessibility tree, not pixel-based input' [playwright-mcp-repo], with snapshot mode the default and vision mode reserved for 'pages with poor accessibility markup' [playwright-mcp-snapshots]. Google: chrome-devtools-mcp take_snapshot is 'a text snapshot… based on the a11y tree… along with a unique identifier (uid)' [chrome-devtools-mcp-tool-reference]. The dominant OSS library resolves interactivity from ARIA roles, role/tabindex attributes, ARIA state and the accessibility properties 'focusable, editable, settable' [browser-use-clickable-elements]. The standard research benchmark exposes observation_type='accessibility_tree' [webarena-repo, webarena-paper]. The tree's contents are governed by ratified specs [w3c-wai-aria-1-2, w3c-accname, w3c-html-aam].

**Counter-evidence:** The claim must be scoped to browser-embedded agents, and even there it is contested. Some consumers are pixel-only. Anthropic's desktop computer-use tool is screenshot-only, with no DOM and no a11y access [anthropic-computer-use-tool]. OpenAI's computer-use tool takes base64 PNG screenshots, and 'the model looks at the current UI through a screenshot' with no structured input [openai-computer-use-guide, openai-cua-announcement]. Gemini Computer Use is likewise screenshots plus action history [gemini-computer-use-docs]. And the a11y tree is not even always the better representation. A 2026 study measured Claude Sonnet 4.6 gaining +14.6pp, and GPT-5.1 at high reasoning gaining +17.5pp, when given raw HTML instead of the accessibility tree. Strong models 'exploit layout information in HTML for better action grounding'. The a11y tree only won for lower-capability models [observation-reduction-paper]. So a11y-tree quality is a strong, well-documented determinant for one large and growing class of agent, not a universal precondition.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
- 2026-08-21 — approved: 7.3 merges away into 7.4 (§5).
- 2026-08-22 — merged (Plan 4, Task 8); registry 150 → 149 for this fold, the last of the v2 consolidation.

## The merge (Plan 4, Task 8, 2026-08-22)

7.3 demanded an `aria-label` or `aria-labelledby` on **every** `<nav>`. That is stricter than the mechanism it cited: a label exists to *disambiguate* landmarks that share a role, so a page with one `<nav>` is unambiguous to any agent and 7.3 still failed it at 0/1 labelled. Its required fix names this audit as the destination — *"Merge into 7.4 (LandmarkUniqueAudit), which measures the same thing with axe's role+accessible-name uniqueness logic and covers all landmark types, not just `<nav>`"* — and the two conditional clauses that follow (*"only require labels when 2+ nav landmarks exist, resolve `aria-labelledby` ids, and delete the 'no `<nav>` found' branch"*) apply only *"if a nav-specific signal is retained"*. None is, so the fold is a deletion, not a port.

### No code changed in the survivor's logic — and that is the point

The `landmark-unique` rule already measures 7.3's signal correctly. Verified against the real rule engine, and now locked by tests in `landmark-unique.test.ts`:

| Markup | Rule result | 7.3's verdict |
| :--- | :--- | :--- |
| two unlabelled `<nav>`s | `fail` | fail — agreed |
| two `<nav>`s with distinct `aria-label`s | `pass` | pass — agreed |
| one unlabelled `<nav>` | `pass` | **fail (0/1 laballed)** — 7.3 was wrong |
| `<nav aria-labelledby="h">` resolving to a heading | `pass` | pass, but only because the attribute is non-empty; 7.3 never resolved the id |
| two unlabelled `<aside>`s | `fail` | not checked at all |

The two 7.3 branches with no counterpart here are exactly the two its own fix says to drop: the "no `<nav>` elements on page" warning duplicates 7.2 (`aria-landmarks`), and the `labeled / navs.length >= 0.5` cliff (1 of 2 = warn, 1 of 3 = fail, identical ambiguity) has no mechanism behind it. 7.3 also read only `ctx.pages[0]` while phrasing its message site-wide; the rule engine runs on every scanned page.

### The a11y base: unchanged

`LandmarkUniqueAudit` is one of the per-rule files built on `A11yBackedAudit` (`_shared.ts`), created by `defineA11yAudit({ rules: ['landmark-unique'], meta })`. The fold does **not** move it off that base: since nothing of 7.3's implementation survives, there is no non-rule signal to blend in, and the pure-a11y structure stays the minimal correct one. The other rule-backed files in the category are untouched, `A11Y_RULES` is unchanged, and no extension point had to be added to the base. Only the meta copy changes, to say that a lone unlabelled landmark is not a defect and that the check covers every landmark type.

### Absorbed evidence — nav-aria-label (7.3)

7.3's dossier is kept verbatim at [merged/operability-safety/nav-aria-label.md](../../merged/operability-safety/nav-aria-label.md) (grade **A**). It carries the same two graded signals this audit rests on — *Landmark elements as extraction boundaries* and *Accessibility tree consumption by computer-use and agentic-browser agents*, both A — so the merge loses no evidence: the two audits were graded on one shared record, and 7.3 simply applied it to a narrower element with a stricter rule than the record supports.

### Grade decision: stays **A**, tier `scored`, weight 1.0

Identical A-grade evidence on both sides (three first-party agent harnesses documenting accessibility-tree perception: Anthropic's `read_page`, Playwright MCP snapshot mode, Chrome DevTools MCP `take_snapshot`), so there is nothing to raise the grade with: **A**, `tier: scored`, `weightForGrade('A', 'scored')` = **1.0**. What changes is that one audit no longer double-charges the site for the same landmark, and the surviving charge stops failing correct single-`<nav>` markup.

### Deviations

- **The survivor's own CSS-blindness defect is not fixed here.** `stripStyles()` discards stylesheets before jsdom, so the desktop/mobile `<nav>` pair every responsive theme ships (one `display:none` at any viewport) still counts as two visible same-role landmarks. That is this audit's standing required fix — a minimal visibility model, or a downgrade to `warn` for a desktop/mobile pair — and it is a rule-engine change touching every rule that calls `isVisibleToScreenReaders`, not a fold. 7.3 shared the same defect, so the merge neither adds nor removes it.
- **Violation counts and stable path-based selectors** (the second half of the required fix) are `A11yBackedAudit`'s reporting shape, shared by all 17 rule-backed audits; changing it here would change all of them.
- **No nav-specific signal is retained**, so the conditional clauses of 7.3's fix (label only when 2+ navs, resolve `aria-labelledby`, drop the no-nav branch) are satisfied by the rule rather than reimplemented — the first two are what the rule already does, the third disappears with the audit.
