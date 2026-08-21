# Agent Lighthouse v2 — Audit Restructure Design

Date: 2026-08-21 · Status: approved in review, pending spec sign-off · Scope: `@forkpoint/agent-lighthouse-*` (core, cli, report, mcp)

## 1. Why

The v1 framework ships 207 audits in 10 categories. A full evidence review (11-agent code review, 12-domain evidence research with 400+ sources, adversarial redemption research) found:

- 18 audits measure signals no consumer reads — proven, not assumed ([NOT-A-FACTOR](../../evidence/NOT-A-FACTOR.md)).
- 17 audits duplicate another audit's measurement (merge list, approved 2026-08-21).
- 24 audits survive only if rewritten ([REWORK-TODO](../../../packages/core/src/audits/REWORK-TODO.md)).
- 134 audits carry implementation defects (per-audit dossiers, [audits/](../../evidence/audits/README.md)).
- Systemic engine defects inflate scores: vacuous `pass()`, soft-404 blindness, `pages[0]`-only checks, JSON-LD entity hoisting, robots.txt parsing gaps.
- 83 new checks are proposed with grade A/B evidence ([proposals/](../../evidence/proposals/README.md)).

v2 rebuilds the taxonomy, the scoring, and the engine so that **no audit contributes to a score unless its mechanism is proven at grade A or B** ([evidence policy](../../evidence/POLICY.md)). One major version, clean break.

## 2. Decisions already approved

| Decision | Approved | Record |
| :--- | :--- | :--- |
| Deletion review: 18 sunset (grade D), 5 informative (grade C), 9 kept with rewrite (grade A/B) | 2026-08-21, deletion-proof review | `docs/evidence/deletions/README.md` |
| Graceful sunset: condensed public rationale, one minor release informative + notice, removed in major | 2026-08-21 | `docs/evidence/NOT-A-FACTOR.md`, POLICY deprecation process |
| Merge review: 17/17 accepted (13 merges, 2 splits, 2 consolidations) | 2026-08-21, merge review sheet | §5 below |
| One audit = one source file; `_a11y.ts` splits into 18 named files | 2026-08-21 | project memory, §6 |
| 15 redemption rewrites from the first triage (form-error-messages, webmcp-manifest reshape, 6 crawler bots, twitter-card, openapi-link, cors-api-routes, …) | folded into this spec — approved with spec sign-off | `packages/core/src/audits/REWORK-TODO.md` |
| Category calls: fuse AEO+GEO; dissolve technical-readiness; dissolve meta-tags; rename accessibility → Agent Operability & Safety | 2026-08-21, question round | §3 |

## 3. Taxonomy — 8 categories

Categories follow the agent journey. Each answers one site-owner question.

| # | Category (slug) | Owner question | Main sources |
| :- | :--- | :--- | :--- |
| 1 | Access & Crawl Control (`access-crawl-control`) | Can agents reach my site? | crawler-permissions survivors, bot-auth-access proposals, no-bot-detection, canonical/crawl directives from meta-tags |
| 2 | Content Extraction (`content-extraction`) | Do agents read my content correctly? | semantic-html survivors, markdown alternates, extraction-survival + token-economics proposals, rendering checks from technical-readiness |
| 3 | Machine Discovery (`machine-discovery`) | Do agents find my machine-readable surfaces? | sitemaps, feeds, llms.txt family (informative), feeds-indexing proposals, discovery-link consolidation (cluster C3), delivery checks from technical-readiness |
| 4 | Structured Data (`structured-data`) | Do agents understand my entities? | structured-data survivors, product data |
| 5 | Answer Readiness (`answer-readiness`) | Do answer engines cite me? | answer-engine + generative-engine fused, og/display tags from meta-tags, answer-selection-forensics proposals |
| 6 | Agent Interfaces (`agent-interfaces`) | Can agents act through my APIs? | agent-tools survivors: MCP, WebMCP (rewritten), OpenAPI, ai-catalog/ARD (rewritten), mcp-server-quality proposals |
| 7 | Agentic Commerce (`agentic-commerce`) | Can agents buy from me? | ACP proposals (feed/checkout/cart/delegated payment), commerce-links, commerce halves of product schema |
| 8 | Agent Operability & Safety (`operability-safety`) | Can agents operate my UI — safely? | accessibility survivors (a11y-tree operability), form actionability, injection-safety + trust-provenance proposals, security-header hygiene (consolidated, weight 0) |

Dissolutions: `technical-readiness` and `meta-tags` disappear; every survivor moves to the category of its consumer. `answer-engine` + `generative-engine` fuse (5 of 17 overlap clusters were cross-pairs of the two). `accessibility` renames — surviving checks measure agent operability via the a11y tree, not WCAG compliance, and the old name overclaimed.

Approximate size: 172 surviving audits + 83 proposed − merge shrinkage ≈ 240 audits.

## 4. Scoring

### Tiers (grade-driven, no exceptions)

| Tier | Entry condition | Score effect | Report |
| :--- | :--- | :--- | :--- |
| Scored | Evidence grade A or B | Counts in category score | Normal |
| Informative | Grade C | Weight 0 | Shown with "no proven consumer" note |
| Experimental | Grade D with active spec trajectory | Never scored | Only behind `--experimental` |
| Deprecated | Sunset list | Weight 0 | One minor with notice + NOT-A-FACTOR link, removed in major |

### Weights

- Audit weight: **A = 1.0, B = 0.6.** Nothing else. Every weight traceable to a dossier.
- Category score = weighted mean over **applicable** audits only; `notApplicable` leaves the denominator. This kills vacuous-pass inflation mechanically.
- Overall score = mean of category scores weighted by **evidence mass** (sum of member audit weights). No hand-tuned category percentages.
- Safety cap: a failing scored audit in injection-safety marks the overall score with a warning badge — it cannot be averaged away. Only Operability & Safety carries a cap.
- Quarterly re-review: an audit downgraded below B drops to informative in the next minor.

## 5. Approved merges, splits, consolidations

13 merges (source → target): nav-aria-label → landmark-unique · mcp-capabilities → mcp-endpoint · webmcp-input-quality → form-actionability · webmcp-tool-annotations → mcp-endpoint (tools/list annotations) · last-updated-indicator → dates-on-content · llms-txt-blockquote + llms-txt-sections → one llms.txt structure audit · no-orphan-pages → sitemap-key-pages ("discovery index coverage") · blockquote-usage → review-signals · og-site-name → core-open-graph · definition-elements → semantic-lists · product-reviews → review-schema · cache-headers → correct-content-types ("AI file delivery").

2 splits: webmcp-tool-naming (naming rule → openapi-operation-ids; runtime part → future MCP tools/list check) · service-product-schema (Product half → advanced-product-details; Service half standalone, narrowed to Service/ProfessionalService).

2 consolidations: hsts-header + content-type-options + audits 8.3–8.7 → one "security header hygiene" audit, weight 0, never fails a site; nosniff additionally a sub-signal of correct-content-types.

The 17 overlap clusters resolve structurally: shared gatherers (§7) end the cloned-logic clusters (C1 dates, C4 authors, C8 reviews, C9 FAQ, C15 meta-description, C16 freshness); the C3 link-tag/file-existence duplication collapses because each resource gets one audit in machine-discovery checking file + its discovery link together.

## 6. Source layout

```
packages/core/src/
  audits/
    <category-slug>/           # 8 dirs, slugs from §3
      <audit-slug>.ts          # one audit per file
      <audit-slug>.test.ts     # colocated test
      index.ts                 # category registry
  gatherers/                   # new layer, §7
```

- **Audit identity:** id = `category/slug`, stable across releases. Numeric ids die.
- **Meta gains required fields:** `evidenceGrade`, `tier`, `dossier` (path into `docs/evidence/`). CI fails when an audit lacks a dossier, the dossier lacks the audit, or a cited source URL is dead.
- `_a11y.ts` splits into 18 files named by check (`landmark-unique.ts`, `label.ts`, …), each wrapping its axe rule(s).
- `audits/proposed/` stubs graduate into their category dir when implemented; the stub's TODO header becomes the implementation brief. Proposal domains map: agentic-commerce → cat 7; mcp-server-quality → cat 6; agent-operability, injection-safety, trust-provenance → cat 8; token-economics → cat 2; bot-auth-access → cat 1; answer-selection-forensics → cat 5; feeds-indexing → cat 3; competitor-gap-verify distributes by check.

## 7. Engine: gatherer layer

Gather once, audit pure. Audits receive artifacts, never fetch or parse.

| Gatherer | Fixes |
| :--- | :--- |
| `fetch` | Soft-404 detection (today `isOk()` is `status === 200`, so an HTML body at `/robots.txt` "exists"); BOM/CRLF normalization; per-bot UA probes so edge blocks (Cloudflare "Block AI Scrapers") stop passing as "allowed" |
| `parse` | `flattenJsonLd` rewrite — no more hoisting nested entities to top level (currently invents entities that do not exist) |
| `robots` | One RFC 9309 parser for all bot audits: group merging, wildcard paths (`/*`, `*`), versioned UA tokens (`GPTBot/1.1`), size limits, encoding |
| `dom` | All scanned pages, not `pages[0]`; a11y-tree snapshot built before any CSS stripping |
| `scoring` | `notApplicable` returned whenever an audit's precondition is absent — enforced by convention + test template |

## 8. Other packages

- `report`: 8 categories, tier badges, deprecation notices with NOT-A-FACTOR links, safety-cap warning badge.
- `cli`: `--experimental` flag; category slugs in output.
- `mcp`: exposes tier + grade per result.
- `MIGRATION.md` + machine-readable old→new id map (`migration-map.json`) for report consumers.

## 9. Rollout

1. Major version via changeset (`@forkpoint/agent-lighthouse-core` and dependents).
2. Final v1 minor first: sunset audits flip to informative with deprecation notices (POLICY step 2).
3. v2 major: new taxonomy, gatherers, sunset audits removed, proposed audits land in waves (grade A first).
4. Dossier statuses updated in the same PRs that change audit code — evidence and code move together, CI enforces.

## 10. Testing

- Every audit: colocated unit test with fixture pages; test template asserts the `notApplicable` path exists.
- Gatherer fixtures: BOM'd robots.txt, soft-404 HTML, versioned UA groups, nested JSON-LD, multi-page scans — the exact false-positive cases from the review's test-gap lists.
- Axe parity test un-skipped (review found it silently skipped).
- Scorer property test: adding a `notApplicable` result never changes a category score.

## 11. Out of scope

- Report UI redesign beyond category/tier/badge rendering.
- Headless-browser audit tier (dossiers note it as an upgrade path; v2 stays static-fetch).
- Website (`packages/website`) content refresh beyond generated docs.

## 12. Success criteria

- Zero scored audits with evidence below grade B; CI enforces dossier linkage.
- All 18 sunset audits removed by v2.0 with public rationale.
- One audit per file; 8 category dirs; no numeric ids.
- The review's five systemic defects have failing-before/passing-after gatherer tests.
